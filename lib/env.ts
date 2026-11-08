import "server-only";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variabile d'ambiente mancante: ${name}`);
  return v;
}

export const env = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  /** solo lato server, solo nel controllo giornaliero */
  supabaseServiceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),
  appUrl: () => (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, ""),
  cronSecret: () => required("CRON_SECRET"),
  emailProvider: () => (process.env.EMAIL_PROVIDER || "smtp") as "smtp" | "resend",
  mailFromName: () => process.env.MAIL_FROM_NAME || "Panoramix",
};
