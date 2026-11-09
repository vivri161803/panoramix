import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const URL = process.env.TEST_SUPABASE_URL ?? "";
const ANON = process.env.TEST_SUPABASE_ANON_KEY ?? "";
const SERVICE = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? "";

/** Questi test scrivono nel database: girano solo su un Supabase locale. */
export const enabled = !!URL && !!ANON && !!SERVICE && /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(URL);

const opts = { auth: { persistSession: false, autoRefreshToken: false } };

export function admin(): SupabaseClient {
  return createClient(URL, SERVICE, opts);
}

export interface TestUser {
  id: string;
  email: string;
  db: SupabaseClient;
}

const run = Date.now().toString(36);
const created: string[] = [];

/** Utente vero (Auth locale) con nome e cognome, collegato con la sua sessione. */
export async function makeUser(name: string): Promise<TestUser> {
  const email = `${name.toLowerCase()}-${run}@test.localhost`;
  const password = `pw-${run}-${name}`;
  const a = admin();
  const { data, error } = await a.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
  created.push(data.user.id);
  await a.from("profiles").update({ first_name: name, last_name: "Test" }).eq("id", data.user.id);
  const db = createClient(URL, ANON, opts);
  const { error: sErr } = await db.auth.signInWithPassword({ email, password });
  if (sErr) throw new Error(`signIn: ${sErr.message}`);
  return { id: data.user.id, email, db };
}

/** Elimina gli utenti creati (piani e dati spariscono a cascata). */
export async function cleanup() {
  const a = admin();
  for (const id of created.splice(0)) await a.auth.admin.deleteUser(id);
}
