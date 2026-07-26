"""
Routes API. Le flux typique côté frontend :

1. POST /uploads/presign -> upload direct du screenshot vers S3
2. POST /generations -> crée le job en base, l'enfile sur Celery,
   retourne immédiatement un job_id (aucun calcul ne bloque la requête HTTP)
3. GET /generations/{job_id} -> polling du statut depuis la base

Le calcul réel tourne dans le worker Celery (app/worker/tasks.py), qui
invoque le graphe LangGraph (app/graph/pipeline.py). Cette couche API ne
fait que créer/lire l'état en base — elle reste stateless et scalable
horizontalement.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.model_registry import Capability, credits_cost
from app.core.database import get_session
from app.models.db_models import GenerationJob, UserAccount
from app.worker.tasks import run_generation_job

router = APIRouter(prefix="/generations", tags=["generations"])


class GenerationRequest(BaseModel):
    user_id: str
    project_id: str
    capability: Capability
    source_image_url: str
    preset_params: dict = {}
    natural_language_edit: str | None = None
    auto_upscale: bool = False


class GenerationResponse(BaseModel):
    job_id: str
    status: str


class GenerationStatusResponse(BaseModel):
    job_id: str
    status: str
    result_url: str | None
    error: str | None
    credits_spent: int


@router.post("", response_model=GenerationResponse)
async def create_generation(req: GenerationRequest, session: AsyncSession = Depends(get_session)):
    # Vérification rapide des crédits AVANT même de créer le job — évite de
    # polluer la table avec des jobs voués à échouer.
    result = await session.execute(select(UserAccount).where(UserAccount.id == req.user_id))
    account = result.scalar_one_or_none()
    if account is None:
        raise HTTPException(status_code=404, detail="Compte utilisateur introuvable")

    cost = credits_cost(req.capability)
    if account.credits_balance < cost:
        raise HTTPException(status_code=402, detail="Crédits insuffisants")

    job = GenerationJob(
        project_id=req.project_id,
        user_id=req.user_id,
        capability=req.capability.value,
        status="pending",
        source_image_url=req.source_image_url,
        params={
            "preset_params": req.preset_params,
            "natural_language_edit": req.natural_language_edit,
            "auto_upscale": req.auto_upscale,
        },
    )
    session.add(job)
    await session.commit()
    await session.refresh(job)

    # Enfilé sur Celery : ne bloque pas la requête HTTP, résiste à un
    # redémarrage du serveur API (contrairement aux BackgroundTasks FastAPI).
    run_generation_job.delay(job.id)

    return GenerationResponse(job_id=job.id, status=job.status)


@router.get("/{job_id}", response_model=GenerationStatusResponse)
async def get_generation(job_id: str, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(GenerationJob).where(GenerationJob.id == job_id))
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=404, detail="Job introuvable")

    return GenerationStatusResponse(
        job_id=job.id,
        status=job.status,
        result_url=job.result_url,
        error=job.error_message,
        credits_spent=job.credits_spent,
    )
