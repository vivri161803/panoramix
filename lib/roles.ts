// Ruoli su un piano: il proprietario e le persone a cui ha dato accesso.

export type MemberRole = "viewer" | "editor";
export type PlanRole = "owner" | MemberRole;

export const ROLE_LABEL: Record<PlanRole, string> = {
  owner: "Proprietario",
  editor: "Può modificare",
  viewer: "Sola lettura",
};

export const ROLE_SUB: Record<MemberRole, string> = {
  editor: "Aggiorna scorte, portapillole e medicinali. Non cambia le impostazioni del piano.",
  viewer: "Vede dispenser, calendario e storico, senza cambiare nulla.",
};

/** Può cambiare medicinali, scorte e portapillole. */
export function canEdit(role: PlanRole | null | undefined): boolean {
  return role === "owner" || role === "editor";
}

/** Può cambiare impostazioni, destinatari, persone con accesso ed eliminare il piano. */
export function isOwner(role: PlanRole | null | undefined): boolean {
  return role === "owner";
}

export const READ_ONLY_MESSAGE = "Hai accesso in sola lettura a questo piano.";
export const OWNER_ONLY_MESSAGE = "Solo chi ha creato il piano può cambiare queste impostazioni.";

/** Indirizzi unici in minuscolo, nell'ordine dato (per i destinatari delle email). */
export function uniqueEmails(list: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of list) {
    const v = (e ?? "").trim().toLowerCase();
    if (v && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}
