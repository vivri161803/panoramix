import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runDailyAlerts } from "@/lib/alerts";
import { todayInRome } from "@/lib/dates";

export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

// Vercel Cron chiama questo indirizzo ogni giorno alle 07:00 UTC (8:00 o 9:00 in Italia)
// con l'intestazione "Authorization: Bearer <CRON_SECRET>".
// ?dry=1 calcola senza scrivere né inviare (utile per le prove).
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const dry = req.nextUrl.searchParams.get("dry") === "1";
  try {
    const result = await runDailyAlerts(createAdminClient(), todayInRome(), dry);
    console.info("[cron] esito:", JSON.stringify({ ...result, plans: result.plans.length }));
    return NextResponse.json(result, { status: result.errors.length ? 207 : 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[cron] controllo non riuscito:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
