"""
La tâche Celery elle-même. Elle fait le pont entre le monde sync de Celery
et le graphe LangGraph qui est async : on lance une boucle asyncio dédiée
par exécution de tâche.

Le vrai état d'avancement (pending/generating/post_processing/done/error)
est persisté en base à chaque étape clé, ce qui permet au client de faire
son polling sur GET /generations/{job_id} sans dépendre de la mémoire du
process API.
"""
import asyncio

from sqlalchemy import select

from app.core.credits import debit_credits
from app.core.database import AsyncSessionLocal
from app.graph.pipeline import pipeline_graph
from app.graph.state import PipelineState
from app.models.db_models import GenerationJob
from app.worker.celery_app import celery_app


@celery_app.task(name="run_generation_job")
def run_generation_job(job_id: str):
    asyncio.run(_run_generation_job_async(job_id))


async def _run_generation_job_async(job_id: str):
    async with AsyncSessionLocal() as session:
        job = await _load_job(session, job_id)
        if job is None:
            return

        initial_state: PipelineState = {
            "user_id": job.user_id,
            "project_id": job.project_id,
            "capability": job.capability,
            "source_image_url": job.source_image_url,
            "preset_params": job.params.get("preset_params", {}),
            "natural_language_edit": job.params.get("natural_language_edit"),
            "auto_upscale": job.params.get("auto_upscale", False),
            "status": "planning",
        }

        job.status = "generating"
        await session.commit()

        final_state = await pipeline_graph.ainvoke(initial_state)

        job.status = final_state.get("status", "error")
        job.result_url = final_state.get("final_output_url")
        job.error_message = final_state.get("error_message")
        await session.commit()

        # On ne débite les crédits QUE si la génération a réellement réussi.
        if job.status == "done":
            cost = final_state.get("credits_required", 0)
            await debit_credits(job.user_id, cost, session)
            job.credits_spent = cost
            await session.commit()


async def _load_job(session, job_id: str) -> GenerationJob | None:
    result = await session.execute(select(GenerationJob).where(GenerationJob.id == job_id))
    return result.scalar_one_or_none()
