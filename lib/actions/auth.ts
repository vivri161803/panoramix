"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { getSessionUser } from "@/lib/data";
import { fail, flash, zodFail, type ActionResult } from "./common";

const emailSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Controlla l’indirizzo: sembra mancare la @ o il dominio.")),
});

export async function sendMagicLink(_prev: ActionResult<{ email: string }> | null, formData: FormData): Promise<ActionResult<{ email: string }>> {
  const raw = String(formData.get("email") ?? "");
  const parsed = emailSchema.safeParse({ email: raw });
  if (!parsed.success) {
    const msg = raw.includes("@") ? "Controlla l’indirizzo: sembra incompleto." : "Controlla l’indirizzo: sembra mancare la @.";
    return fail(msg, { email: msg });
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { shouldCreateUser: true, emailRedirectTo: `${env.appUrl()}/auth/confirm` },
  });
  if (error) {
    console.error("Invio link di accesso non riuscito:", error.status, error.code, error.message);
    if (error.status === 429 || error.code === "over_email_send_rate_limit") {
      return fail("Hai chiesto troppi link in poco tempo: aspetta un minuto e riprova.");
    }
    return fail("Non riesco a mandare il link adesso. Riprova tra qualche minuto.");
  }
  return { ok: true, data: { email: parsed.data.email } };
}

const profileSchema = z.object({
  first_name: z.string().trim().min(1, "Scrivi il tuo nome.").max(60, "Al massimo 60 caratteri."),
  last_name: z.string().trim().min(1, "Scrivi il tuo cognome.").max(60, "Al massimo 60 caratteri."),
});

export async function saveProfile(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) redirect("/accesso");
  const parsed = profileSchema.safeParse({ first_name: formData.get("first_name"), last_name: formData.get("last_name") });
  if (!parsed.success) return zodFail(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", user.id);
  if (error) return fail("Non riesco a salvare il nome. Riprova.");
  const next = String(formData.get("next") ?? "/piani");
  if (next === "/account") {
    await flash("Nome salvato");
    redirect("/account");
  }
  redirect("/piani");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/accesso");
}

export async function deleteAccount(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) redirect("/accesso");
  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== "ELIMINA") {
    return fail("Per confermare scrivi ELIMINA nel campo.", { confirm: "Scrivi ELIMINA per confermare." });
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_my_account");
  if (error) {
    console.error("Eliminazione account non riuscita:", error);
    return fail("Non riesco a eliminare l’account adesso. Riprova tra poco.");
  }
  await supabase.auth.signOut();
  redirect("/accesso?eliminato=1");
}
