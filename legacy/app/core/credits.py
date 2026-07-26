"""
Système de crédits, façon RenderLab : chaque action coûte un nombre fixe
de crédits (défini dans model_registry.py), débité UNIQUEMENT si la
génération réussit. Les crédits d'abonnement se réinitialisent chaque
cycle ; les crédits de recharge sont cumulatifs et n'expirent pas.
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import UserAccount


async def has_enough_credits(user_id: str, cost: int, session: AsyncSession | None = None) -> bool:
    if session is None:
        return True  # placeholder tant que la session n'est pas injectée par l'appelant
    result = await session.execute(select(UserAccount).where(UserAccount.id == user_id))
    account = result.scalar_one_or_none()
    return bool(account and account.credits_balance >= cost)


async def debit_credits(user_id: str, cost: int, session: AsyncSession) -> None:
    result = await session.execute(select(UserAccount).where(UserAccount.id == user_id))
    account = result.scalar_one()
    account.credits_balance -= cost
    await session.commit()


async def refill_monthly_credits(user_id: str, plan_credits: int, session: AsyncSession) -> None:
    """À appeler depuis le webhook Stripe au renouvellement d'abonnement."""
    result = await session.execute(select(UserAccount).where(UserAccount.id == user_id))
    account = result.scalar_one()
    # Les crédits d'abonnement ne s'accumulent pas d'un cycle à l'autre
    account.credits_balance = plan_credits + account.topup_credits_balance
    await session.commit()
