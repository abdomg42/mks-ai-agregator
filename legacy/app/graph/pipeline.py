"""
Graphe LangGraph d'orchestration.

Pourquoi LangGraph et pas juste une fonction Python avec des if/else ?
- state persistant et sérialisable -> on peut reprendre un job après crash
- checkpointing natif -> historique de chaque étape (utile pour debug/support)
- branchements conditionnels explicites et lisibles (edges) -> plus facile
  à faire évoluer quand tu ajoutes des capacités (ex: enchaîner
  render -> upscale -> animate -> narration automatiquement)
- si demain tu ajoutes un vrai agent qui *choisit* le meilleur modèle
  selon la scène (comme la "couche de raisonnement" de Higgsfield),
  ce sera un noeud LLM de plus dans le même graphe, pas une réécriture

Le graphe ici reste volontairement simple (peu de LLM, beaucoup de règles)
car la majorité des décisions sont déterministes (clic utilisateur -> action).
Le seul endroit où un LLM intervient vraiment, c'est pour traduire une
édition en langage naturel ("change le sol en porcelanato") en paramètres
structurés pour le modèle d'image.
"""
from langgraph.graph import END, StateGraph

from app.clients.model_registry import Capability, credits_cost, run_capability
from app.core.credits import has_enough_credits
from app.graph.state import PipelineState
from app.graph.prompt_planner import build_generation_inputs


async def node_check_credits(state: PipelineState) -> PipelineState:
    cost = credits_cost(state["capability"])
    state["credits_required"] = cost
    if not await has_enough_credits(state["user_id"], cost):
        state["status"] = "error"
        state["error_message"] = "Crédits insuffisants"
    return state


async def node_plan_generation(state: PipelineState) -> PipelineState:
    """
    Transforme l'input utilisateur (image + preset cliqué + éventuel texte
    libre) en paramètres concrets pour le modèle choisi. C'est ici qu'on
    injecte les prompts internes générés par les presets, pour que
    l'utilisateur final n'écrive jamais de prompt technique lui-même.
    """
    state["generation_inputs"] = build_generation_inputs(
        capability=state["capability"],
        source_image_url=state["source_image_url"],
        preset_params=state.get("preset_params", {}),
        natural_language_edit=state.get("natural_language_edit"),
    )
    state["status"] = "generating"
    return state


async def node_execute_generation(state: PipelineState) -> PipelineState:
    try:
        result = await run_capability(state["capability"], state["generation_inputs"])
        state["raw_output_url"] = result.get("images", [{}])[0].get("url") or result.get("video", {}).get("url")
        state["status"] = "post_processing"
    except Exception as exc:  # noqa: BLE001 - on veut capturer toute erreur fournisseur
        state["status"] = "error"
        state["error_message"] = str(exc)
    return state


async def node_auto_upscale(state: PipelineState) -> PipelineState:
    """
    Chaînage automatique : si l'utilisateur a demandé un rendu final
    (pas un brouillon) et que le capability d'origine est une image,
    on enchaîne un upscale 4K sans action supplémentaire de sa part.
    """
    if not state.get("auto_upscale"):
        state["final_output_url"] = state["raw_output_url"]
        state["status"] = "done"
        return state

    upscale_inputs = {"image_url": state["raw_output_url"], "scale": 4}
    result = await run_capability(Capability.UPSCALE_4K, upscale_inputs)
    state["final_output_url"] = result.get("image", {}).get("url", state["raw_output_url"])
    state["status"] = "done"
    return state


def route_after_credit_check(state: PipelineState) -> str:
    return "error" if state["status"] == "error" else "plan"


def route_after_generation(state: PipelineState) -> str:
    return "error" if state["status"] == "error" else "post_process"


async def node_error(state: PipelineState) -> PipelineState:
    # Ici : notifier l'utilisateur, ne PAS débiter les crédits, logguer
    return state


def build_pipeline_graph():
    graph = StateGraph(PipelineState)

    graph.add_node("check_credits", node_check_credits)
    graph.add_node("plan", node_plan_generation)
    graph.add_node("generate", node_execute_generation)
    graph.add_node("post_process", node_auto_upscale)
    graph.add_node("error", node_error)

    graph.set_entry_point("check_credits")

    graph.add_conditional_edges(
        "check_credits", route_after_credit_check, {"plan": "plan", "error": "error"}
    )
    graph.add_edge("plan", "generate")
    graph.add_conditional_edges(
        "generate", route_after_generation, {"post_process": "post_process", "error": "error"}
    )
    graph.add_edge("post_process", END)
    graph.add_edge("error", END)

    return graph.compile()


# Instance compilée, réutilisée à chaque requête
pipeline_graph = build_pipeline_graph()
