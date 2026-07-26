"""
State du graphe LangGraph. C'est l'objet qui circule entre les noeuds
et qui persiste l'avancement d'un job — utile pour reprendre un job
après une panne, ou pour chaîner plusieurs actions (render -> upscale -> anime).
"""
from typing import Any, Optional, TypedDict

from app.clients.model_registry import Capability


class PipelineState(TypedDict, total=False):
    # --- Entrée utilisateur ---
    user_id: str
    project_id: str
    capability: Capability            # action demandée (render, mood_swap, animate...)
    source_image_url: str             # le screenshot / rendu de départ
    natural_language_edit: Optional[str]   # ex: "change le sol en porcelanato"
    preset_params: dict[str, Any]     # style, ambiance, angle choisis par clic

    # --- Décisions prises par le graphe ---
    resolved_model_id: str
    generation_inputs: dict[str, Any]
    credits_required: int

    # --- Résultats ---
    raw_output_url: Optional[str]
    final_output_url: Optional[str]
    auto_upscale: bool

    # --- Contrôle de flux ---
    status: str                       # "planning" | "generating" | "post_processing" | "done" | "error"
    error_message: Optional[str]
