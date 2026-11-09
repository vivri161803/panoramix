// Conteggi di utilizzo per chi gestisce l'app (funzioni pure, i dati arrivano da lib/usage.ts).

/** Giorni coperti dal riepilogo di utilizzo. */
export const USAGE_DAYS = 7;

/** Destinatari al giorno che Gmail accetta da una casella normale (circa). */
export const GMAIL_DAILY_LIMIT = 500;

/** Righe lette dal database e dall'Auth. Movimenti, preparazioni e invii sono già solo quelli del periodo. */
export interface UsageRaw {
  users: { id: string; created_at: string; last_sign_in_at?: string | null }[];
  plans: { id: string; created_at: string }[];
  members: { plan_id: string }[];
  pendingInvites: number;
  activeMeds: number;
  stockEvents: { created_by: string | null }[];
  preps: { created_by: string | null }[];
  alertRuns: { status: string; recipients: string[] | null }[];
  notificationRuns: { status: string; recipients: string[] | null }[];
}

export interface UsageStats {
  days: number;
  accounts: { total: number; created: number; signedIn: number };
  /** chi ha registrato un movimento delle scorte o preparato il portapillole */
  recorded: number;
  /** chi ha fatto l'accesso o registrato qualcosa (senza doppioni) */
  active: number;
  plans: { total: number; created: number; shared: number };
  members: number;
  pendingInvites: number;
  activeMeds: number;
  movements: number;
  emails: { alerts: number; notifications: number; failed: number; recipients: number; recipientsPerDay: number };
}

const after = (iso: string | null | undefined, since: Date) => !!iso && new Date(iso).getTime() >= since.getTime();

export function summarizeUsage(raw: UsageRaw, since: Date, days = USAGE_DAYS): UsageStats {
  const signedIn = new Set(raw.users.filter((u) => after(u.last_sign_in_at, since)).map((u) => u.id));
  const recorded = new Set([...raw.stockEvents, ...raw.preps].map((e) => e.created_by).filter((id): id is string => !!id));
  const sent = [...raw.alertRuns, ...raw.notificationRuns].filter((r) => r.status === "sent");
  const recipients = sent.reduce((n, r) => n + (r.recipients?.length ?? 0), 0);
  return {
    days,
    accounts: { total: raw.users.length, created: raw.users.filter((u) => after(u.created_at, since)).length, signedIn: signedIn.size },
    recorded: recorded.size,
    active: new Set([...signedIn, ...recorded]).size,
    plans: { total: raw.plans.length, created: raw.plans.filter((p) => after(p.created_at, since)).length, shared: new Set(raw.members.map((m) => m.plan_id)).size },
    members: raw.members.length,
    pendingInvites: raw.pendingInvites,
    activeMeds: raw.activeMeds,
    movements: raw.stockEvents.length + raw.preps.length,
    emails: {
      alerts: raw.alertRuns.filter((r) => r.status === "sent").length,
      notifications: raw.notificationRuns.filter((r) => r.status === "sent").length,
      failed: [...raw.alertRuns, ...raw.notificationRuns].filter((r) => r.status === "failed").length,
      recipients,
      recipientsPerDay: Math.round((recipients / days) * 10) / 10,
    },
  };
}
