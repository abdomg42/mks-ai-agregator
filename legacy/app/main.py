from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.generations import router as generations_router
from app.api.uploads import router as uploads_router
from app.core.database import init_db

app = FastAPI(title="Immo AI Platform", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # à restreindre au domaine du frontend en prod
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(generations_router)
app.include_router(uploads_router)


@app.on_event("startup")
async def on_startup():
    # Pratique en dev ; utiliser Alembic pour les migrations en production.
    await init_db()


@app.get("/health")
async def health():
    return {"status": "ok"}

