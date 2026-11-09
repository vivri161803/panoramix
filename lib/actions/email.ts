"use server";

import { getPlanBundle } from "@/lib/data";
import { buildPlanEmail } from "@/lib/alerts";
import { getEmailProvider } from "@/lib/email/provider";
import { isOwner, OWNER_ONLY_MESSAGE } from "@/lib/roles";
import { fail, type ActionResult } from "./common";

/** Manda al solo gestore un'email di prova con le scorte di oggi. Non tocca gli avvisi veri. */
export async function sendTestEmail(planId: string): Promise<ActionResult> {
  const b = await getPlanBundle(planId);
  if (!isOwner(b.role)) return fail(OWNER_ONLY_MESSAGE);
  const active = b.forecast.items.filter((i) => !i.forecast.ended);
  const selected = b.forecast.toOrder.length ? b.forecast.toOrder : active.map((i) => i.med);
  if (!selected.length) return fail("Aggiungi almeno un medicinale per vedere l’email di prova.");
  const email = buildPlanEmail({ plan: b.plan, owner: b.profile, forecast: b.forecast, meds: selected, today: b.today, test: true });
  try {
    await getEmailProvider().send({ to: [b.profile.email], replyTo: b.profile.email, ...email });
  } catch (e) {
    console.error("Email di prova non inviata:", e);
    return fail("Non riesco a mandare l’email. Controlla le impostazioni SMTP e riprova.");
  }
  return { ok: true, message: `Email di prova inviata a ${b.profile.email}` };
}
