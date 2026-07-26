// Solde de crédits — STUB en attendant le jalon auth + DB.
//
// Au jalon 3, ce module sera remplacé par le ledger append-only
// `credit_ledger` (mint/spend/refund/expire) : le solde deviendra la somme
// des deltas, et le débit n'interviendra QU'au succès de la génération.
// L'interface de ce module restera la même, les routes n'auront pas à
// changer.

export const STUB_BALANCE = 100;

export async function getCreditBalance(): Promise<number> {
  return STUB_BALANCE;
}
