"""
Construit les paramètres réels envoyés au modèle à partir de :
- l'action cliquée (capability)
- les presets choisis par clic (style, ambiance, matériau...)
- éventuellement une instruction en langage naturel de l'utilisateur

C'est ici qu'on cache toute la complexité de prompt engineering :
l'utilisateur ne voit jamais un prompt technique, seulement des boutons
et une barre de texte libre en option.
"""
from typing import Any, Optional

from app.clients.model_registry import Capability

# Presets métier -> fragments de prompt internes (jamais montrés à l'utilisateur)
STYLE_PROMPTS = {
    "moderne": "modern minimalist architecture, clean lines, large glass panels",
    "mediterraneen": "mediterranean architecture, warm stucco walls, terracotta roof",
    "scandinave": "scandinavian interior style, light wood, neutral tones, cozy lighting",
}

MOOD_PROMPTS = {
    "golden_hour": "golden hour lighting, warm sunset glow, long soft shadows",
    "jour_nuageux": "overcast daylight, soft diffused light, neutral color grading",
    "nuit": "night scene, interior lights on, blue hour sky",
}


def build_generation_inputs(
    capability: Capability,
    source_image_url: str,
    preset_params: dict[str, Any],
    natural_language_edit: Optional[str],
) -> dict[str, Any]:
    prompt_parts: list[str] = [
        "photorealistic architectural render, preserve exact geometry and proportions of the input image"
    ]

    style = preset_params.get("style")
    if style and style in STYLE_PROMPTS:
        prompt_parts.append(STYLE_PROMPTS[style])

    mood = preset_params.get("mood")
    if mood and mood in MOOD_PROMPTS:
        prompt_parts.append(MOOD_PROMPTS[mood])

    if capability == Capability.OBJECT_SWAP and preset_params.get("object_description"):
        prompt_parts.append(f"replace with: {preset_params['object_description']}")

    if natural_language_edit:
        # Passé tel quel au modèle d'édition d'image (Flux Kontext gère bien
        # les instructions en langage naturel) — pas besoin d'un LLM séparé
        # pour la plupart des cas simples ; un LLM de reformulation peut être
        # ajouté ici plus tard si les résultats sont trop instables.
        prompt_parts.append(natural_language_edit)

    return {
        "image_url": source_image_url,
        "prompt": ", ".join(prompt_parts),
        "strength": 0.35,  # faible strength = forte fidélité à la géométrie d'origine
    }
