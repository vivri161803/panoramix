"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fullName, getPlanBundle, requireProfile } from "@/lib/data";
import { env } from "@/lib/env";
import { getEmailProvider } from "@/lib/email/provider";
import { renderInviteEmail } from "@/lib/email/templates";
import { inviteSchema, ROLES, type InviteInput } from "@/lib/schemas";
import { isOwner, OWNER_ONLY_MESSAGE, ROLE_LABEL, type MemberRole } from "@/lib/roles";
import { dbError, fail, flash, zodFail, type ActionResult } from "./common";

function refresh(planId: string) {
  revalidatePath(`/piani/${planId}`, "layout");
  revalidatePath("/piani");
}

const isRole = (r: string): r is MemberRole => (ROLES as readonly string[]).includes(r);

/** Invita una persona: riceve un'email e trova l'invito entrando con quell'indirizzo. */
export async function inviteMember(planId: string, input: InviteInput): Promise<ActionResult> {
  const b = await getPlanBundle(planId);
  if (!isOwner(b.role)) return fail(OWNER_ONLY_MESSAGE);
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const { email, role } = parsed.data;
  if (email === b.profile.email.toLowerCase()) return fail("Sei già il proprietario del piano.", { email: "Questo è il tuo indirizzo." });
  if (b.members.some((m) => m.profile?.email.toLowerCase() === email)) {
    return fail("Questa persona ha già accesso al piano.", { email: "Ha già accesso: cambia il permesso dall’elenco." });
  }
  if (b.invites.some((i) => i.email === email)) return fail("Questa persona è già stata invitata.", { email: "Invito già inviato." });

  const supabase = await createClient();
  const { error } = await supabase.from("plan_invites").insert({ plan_id: planId, email, role });
  if (error) {
    if (error.hint === "members_limit") return fail("Hai raggiunto il massimo di 10 persone per piano.");
    return fail(dbError(error, "Non riesco a salvare l’invito. Riprova."));
  }
  refresh(planId);

  const inviter = fullName(b.profile, b.profile.email);
  const mail = renderInviteEmail({ inviterName: inviter, inviterEmail: b.profile.email, patientName: b.plan.patient_name, role, inviteeEmail: email, appUrl: env.appUrl() });
  try {
    await getEmailProvider().send({ to: [email], replyTo: b.profile.email, ...mail });
  } catch (e) {
    console.error("Email di invito non inviata:", e);
    return { ok: true, message: `Invito salvato, ma l’email non è partita: avvisa tu ${email} di entrare in Panoramix.` };
  }
  return { ok: true, message: `Invito inviato a ${email}` };
}

export async function cancelInvite(planId: string, inviteId: string): Promise<ActionResult> {
  const b = await getPlanBundle(planId);
  if (!isOwner(b.role)) return fail(OWNER_ONLY_MESSAGE);
  const invite = b.invites.find((i) => i.id === inviteId);
  if (!invite) return fail("Invito non trovato.");
  const supabase = await createClient();
  const { error } = await supabase.from("plan_invites").delete().eq("id", inviteId);
  if (error) return fail(dbError(error));
  refresh(planId);
  return { ok: true, message: `Invito a ${invite.email} annullato` };
}

export async function changeAccess(planId: string, target: { userId?: string; inviteId?: string }, role: string): Promise<ActionResult> {
  const b = await getPlanBundle(planId);
  if (!isOwner(b.role)) return fail(OWNER_ONLY_MESSAGE);
  if (!isRole(role)) return fail("Permesso non valido.");
  const supabase = await createClient();
  const { error } = target.userId
    ? await supabase.from("plan_members").update({ role }).eq("plan_id", planId).eq("user_id", target.userId)
    : await supabase.from("plan_invites").update({ role }).eq("plan_id", planId).eq("id", target.inviteId ?? "");
  if (error) return fail(dbError(error));
  refresh(planId);
  return { ok: true, message: `Permesso cambiato: ${ROLE_LABEL[role].toLowerCase()}` };
}

export async function removeMember(planId: string, userId: string): Promise<ActionResult> {
  const b = await getPlanBundle(planId);
  if (!isOwner(b.role)) return fail(OWNER_ONLY_MESSAGE);
  const m = b.members.find((x) => x.user_id === userId);
  if (!m) return fail("Persona non trovata.");
  const supabase = await createClient();
  const { error } = await supabase.from("plan_members").delete().eq("plan_id", planId).eq("user_id", userId);
  if (error) return fail(dbError(error));
  refresh(planId);
  return { ok: true, message: `${fullName(m.profile, m.profile?.email ?? "La persona")} non ha più accesso al piano` };
}

/** Chi ha ricevuto accesso può uscire dal piano. */
export async function leavePlan(planId: string): Promise<ActionResult> {
  const b = await getPlanBundle(planId);
  if (isOwner(b.role)) return fail("Sei il proprietario: per lasciare il piano eliminalo dalle impostazioni.");
  const supabase = await createClient();
  const { error } = await supabase.from("plan_members").delete().eq("plan_id", planId).eq("user_id", b.profile.id);
  if (error) return fail(dbError(error));
  revalidatePath("/piani");
  await flash(`Non segui più il piano di ${b.plan.patient_name}`);
  redirect("/piani");
}

export async function acceptInvite(inviteId: string): Promise<ActionResult> {
  await requireProfile();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_plan_invite", { p_invite_id: inviteId });
  if (error) {
    if (error.hint === "invite_not_found") return fail("Questo invito non c’è più: forse è stato annullato.");
    return fail(dbError(error, "Non riesco ad accettare l’invito. Riprova."));
  }
  revalidatePath("/piani");
  await flash("Invito accettato");
  redirect(`/piani/${data as string}`);
}

export async function declineInvite(inviteId: string): Promise<ActionResult> {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { data, error } = await supabase.from("plan_invites").delete().eq("id", inviteId).eq("email", profile.email.toLowerCase()).select("id");
  if (error) return fail(dbError(error));
  if (!data?.length) return fail("Questo invito non c’è più.");
  revalidatePath("/piani");
  return { ok: true, message: "Invito rifiutato" };
}
