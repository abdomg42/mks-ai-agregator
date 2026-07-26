"""
C'est le fichier le plus important du projet.

Il définit un registre de modèles pluggable : chaque "capacité" métier
(render photoréaliste, changement d'ambiance, upscale, animation, voix...)
est mappée vers un ou plusieurs modèles tiers concrets, appelés via fal.ai
ou Replicate. Higgsfield et RenderLab ne développent presque aucun modèle
fondamental eux-mêmes : leur valeur, c'est CE registre + l'UX autour.

Pour changer de fournisseur de modèle demain (ex: Kling -> Veo), tu modifies
UNE ligne ici, rien ailleurs dans le code.
"""
from __future__ import annotations

import base64
from enum import Enum
from typing import Any, Protocol

import httpx

from app.core.config import settings


class Capability(str, Enum):
    """Les actions métier que la plateforme propose à l'utilisateur."""
    RENDER_EXTERIOR = "render_exterior"        # print SketchUp -> photoréaliste
    RENDER_INTERIOR = "render_interior"
    MOOD_SWAP = "mood_swap"                    # jour <-> golden hour, etc.
    OBJECT_SWAP = "object_swap"                # remplacer meuble/canapé/etc.
    NEW_ANGLE = "new_angle"                    # générer un angle inédit
    UPSCALE_4K = "upscale_4k"
    ANIMATE = "animate"                        # image -> vidéo courte
    NARRATE = "narrate"                        # texte/vidéo -> voix off


class GenerationClient(Protocol):
    async def run(self, model_id: str, inputs: dict[str, Any]) -> dict[str, Any]:
        ...


class FalClient:
    """Client pour fal.ai — agrège Flux, Kling, Kontext, Real-ESRGAN, etc."""

    BASE_URL = "https://queue.fal.run"

    async def run(self, model_id: str, inputs: dict[str, Any]) -> dict[str, Any]:
        headers = {"Authorization": f"Key {settings.fal_api_key}"}
        async with httpx.AsyncClient(timeout=300) as client:
            submit = await client.post(
                f"{self.BASE_URL}/{model_id}", json=inputs, headers=headers
            )
            submit.raise_for_status()
            request_id = submit.json()["request_id"]

            # Polling du statut jusqu'à complétion (les vidéos prennent du temps)
            status_url = f"{self.BASE_URL}/{model_id}/requests/{request_id}/status"
            result_url = f"{self.BASE_URL}/{model_id}/requests/{request_id}"
            import asyncio

            for _ in range(180):  # jusqu'à 15 min (180 * 5s)
                status = await client.get(status_url, headers=headers)
                status.raise_for_status()
                if status.json().get("status") == "COMPLETED":
                    result = await client.get(result_url, headers=headers)
                    result.raise_for_status()
                    return result.json()
                await asyncio.sleep(5)

            raise TimeoutError(f"Génération fal.ai {model_id} non terminée à temps")


class ReplicateClient:
    """Client pour Replicate — alternative/complément à fal.ai."""

    BASE_URL = "https://api.replicate.com/v1"

    async def run(self, model_id: str, inputs: dict[str, Any]) -> dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {settings.replicate_api_token}",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=300) as client:
            resp = await client.post(
                f"{self.BASE_URL}/models/{model_id}/predictions",
                json={"input": inputs},
                headers=headers,
            )
            resp.raise_for_status()
            prediction = resp.json()
            get_url = prediction["urls"]["get"]

            import asyncio

            for _ in range(180):
                poll = await client.get(get_url, headers=headers)
                poll.raise_for_status()
                data = poll.json()
                if data["status"] == "succeeded":
                    return data
                if data["status"] == "failed":
                    raise RuntimeError(f"Replicate prediction failed: {data.get('error')}")
                await asyncio.sleep(5)

            raise TimeoutError(f"Génération Replicate {model_id} non terminée à temps")


# --- Registre : capacité métier -> (client, modèle, coût en crédits) ---
# Ajuste les model_id réels selon ce qui est disponible sur fal.ai/Replicate
# au moment où tu implémentes (leurs catalogues changent souvent).

FAL = FalClient()
REPLICATE = ReplicateClient()

MODEL_REGISTRY: dict[Capability, dict[str, Any]] = {
    Capability.RENDER_EXTERIOR: {
        "client": FAL,
        "model_id": "fal-ai/flux-pro/kontext",  # img2img avec préservation de structure
        "credits": 10,
    },
    Capability.RENDER_INTERIOR: {
        "client": FAL,
        "model_id": "fal-ai/flux-pro/kontext",
        "credits": 10,
    },
    Capability.MOOD_SWAP: {
        "client": FAL,
        "model_id": "fal-ai/flux-pro/kontext",
        "credits": 8,
    },
    Capability.OBJECT_SWAP: {
        "client": FAL,
        "model_id": "fal-ai/flux-pro/kontext",
        "credits": 8,
    },
    Capability.NEW_ANGLE: {
        "client": FAL,
        "model_id": "fal-ai/flux-pro/kontext",
        "credits": 12,
    },
    Capability.UPSCALE_4K: {
        "client": FAL,
        "model_id": "fal-ai/real-esrgan",
        "credits": 50,
    },
    Capability.ANIMATE: {
        "client": FAL,
        "model_id": "fal-ai/kling-video/v2/standard/image-to-video",
        "credits": 30,
    },
    Capability.NARRATE: {
        "client": REPLICATE,
        "model_id": "elevenlabs/tts",
        "credits": 10,
    },
}


async def run_capability(capability: Capability, inputs: dict[str, Any]) -> dict[str, Any]:
    """Point d'entrée unique : exécute une capacité métier via le bon modèle."""
    entry = MODEL_REGISTRY[capability]
    return await entry["client"].run(entry["model_id"], inputs)


def credits_cost(capability: Capability) -> int:
    return MODEL_REGISTRY[capability]["credits"]


def encode_image_to_data_uri(image_bytes: bytes, mime: str = "image/png") -> str:
    b64 = base64.b64encode(image_bytes).decode()
    return f"data:{mime};base64,{b64}"
