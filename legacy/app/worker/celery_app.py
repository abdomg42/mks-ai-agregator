"""
Worker Celery : remplace les BackgroundTasks de FastAPI (qui ne survivent
pas à un redémarrage du serveur et ne scalent pas horizontalement).

Lancer le worker :
    celery -A app.worker.celery_app worker --loglevel=info --concurrency=4

Les générations vidéo pouvant prendre plusieurs minutes, on augmente le
concurrency et on isole ce worker du process API (scale indépendamment).
"""
from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "immo_ai_platform",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_track_started=True,
    # Les générations vidéo peuvent prendre plusieurs minutes : on évite
    # qu'un job long soit tué prématurément par un timeout par défaut.
    task_time_limit=20 * 60,
    task_soft_time_limit=18 * 60,
)

# Charge les tâches définies dans tasks.py
celery_app.autodiscover_tasks(["app.worker"])
