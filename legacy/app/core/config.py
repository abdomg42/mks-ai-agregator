"""
Configuration centrale. Toutes les clés API et paramètres sensibles
viennent de variables d'environnement (.env en local, secrets manager en prod).
"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Base de données
    database_url: str = "postgresql+asyncpg://user:pass@localhost:5432/immoai"

    # Stockage objets (S3-compatible : AWS S3, Cloudflare R2, Backblaze B2...)
    s3_bucket: str = "immoai-assets"
    s3_endpoint_url: str = ""
    s3_access_key: str = ""
    s3_secret_key: str = ""

    # Agrégateurs de modèles IA (on ne parle JAMAIS directement à Kling/Veo/Sora,
    # on passe par ces agrégateurs pour ne pas gérer N intégrations différentes)
    fal_api_key: str = ""
    replicate_api_token: str = ""

    # Upscale dédié (optionnel, Topaz ou équivalent)
    topaz_api_key: str = ""

    # Voix / narration
    elevenlabs_api_key: str = ""

    # Auth
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"

    # Redis (queue de jobs)
    redis_url: str = "redis://localhost:6379/0"

    class Config:
        env_file = ".env"


settings = Settings()
