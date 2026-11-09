import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlanBundle, getStockEvents } from "@/lib/data";
import { capitalize, dateOfTimestampRome, formatLong, formatShort, formatTimeRome } from "@/lib/dates";
import { formatQty } from "@/lib/forecast";
import type { StockEventRow } from "@/lib/db-types";
import { Pill } from "@/components/ui/Pill";
import { StatusChip } from "@/components/ui/StatusChip";
import { IconBack } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Storico" };

const FILTERS = [
  { id: "tutti", label: "Tutti" },
  { id: "arrivi", label: "Arrivi" },
  { id: "prep", label: "Preparazioni" },
  { id: "conteggi", label: "Conteggi" },
  { id: "prese", label: "Prese" },
] as const;

function describe(e: StockEventRow): { icon: string; title: string; note: string } {
  const meta = e.meta ?? {};
  switch (e.type) {
    case "arrival": {
      const packs = Number(meta.packs ?? 0);
      return { icon: "+", title: "Arrivata confezione", note: packs > 1 ? ` · ${packs} confezioni` : "" };
    }
    case "count": {
      if (meta.initial) return { icon: "•", title: "Conteggio iniziale", note: "" };
      const prev = meta.previous;
      const why = meta.reason === "mode_change" ? " · cambio di modalità" : meta.source === "edit" ? " · dalla modifica" : "";
      const was = prev !== undefined ? ` · risultavano ${formatQty(Number(prev))}` : "";
      return { icon: "=", title: "Ricontrolla conteggio", note: `${why}${was}` };
    }
    case "prep":
      return { icon: "↓", title: "Portapillole preparato", note: meta.week_start ? ` · settimana dal ${formatShort(String(meta.week_start))}` : "" };
    case "prep_undo":
      return { icon: "↺", title: "Preparazione annullata", note: "" };
    case "adjust":
      return { icon: "↺", title: meta.undo_of ? "Movimento annullato" : "Correzione", note: "" };
    case "use":
      return { icon: "−", title: "Presa al bisogno", note: "" };
  }
}

function matches(filter: string, e: StockEventRow) {
  if (filter === "arrivi") return e.type === "arrival";
  if (filter === "prep") return e.type === "prep" || e.type === "prep_undo";
  if (filter === "conteggi") return e.type === "count";
  if (filter === "prese") return e.type === "use";
  return true;
}

export default async function StoricoPage({ params, searchParams }: PageProps<"/piani/[id]/medicinali/[medId]/storico">) {
  const { id, medId } = await params;
  const sp = await searchParams;
  const filter = FILTERS.some((f) => f.id === sp.filtro) ? String(sp.filtro) : "tutti";
  const b = await getPlanBundle(id);
  const item = b.forecast.items.find((i) => i.med.id === medId);
  if (!item) notFound();
  const { med, forecast: f } = item;
  const { events: all, authors } = await getStockEvents(med.id);
  const events = all.filter((e) => matches(filter, e));
  const by = (e: { created_by: string | null }) => (e.created_by === b.profile.id ? "da te" : e.created_by && authors.get(e.created_by) ? `da ${authors.get(e.created_by)}` : "");
  const summary = [
    `${formatQty(f.stock)} compresse`,
    f.coverageDays !== null ? `${f.coverageDays} giorni di copertura` : f.asNeeded ? "al bisogno" : "basta fino alla fine",
    f.runOutDate ? `finisce ${formatShort(f.runOutDate)}` : "",
  ].filter(Boolean);

  return (
    <>
      <div className="flex flex-col gap-3.5">
        <Link href={`/piani/${id}`} className="px-back">
          <IconBack />
          {b.plan.patient_name}
        </Link>
        <div className="flex flex-wrap items-center gap-3.5">
          <div className="grid h-14 w-14 place-items-center rounded-[14px] bg-px-surface-2">
            <Pill color={med.color} shape={med.shape} size={36} />
          </div>
          <div className="flex min-w-[200px] flex-1 flex-col gap-1">
            <h1 className="m-0 text-[clamp(26px,3.4vw,34px)] font-[650] leading-[1.1] tracking-[-0.02em]">
              Storico · {med.name} <span className="font-medium text-px-ink-2">{med.strength}</span>
            </h1>
            <p className="m-0 text-px-ink-2">{summary.join(" · ")}</p>
          </div>
          <StatusChip status={f.status} />
        </div>
      </div>
      <nav aria-label="Filtra movimenti" className="flex flex-wrap gap-2">
        {FILTERS.map((x) => {
          const sel = x.id === filter;
          return (
            <Link
              key={x.id}
              href={x.id === "tutti" ? `?` : `?filtro=${x.id}`}
              aria-current={sel ? "true" : undefined}
              className="inline-flex h-11 items-center rounded-full px-4 text-[15px] font-semibold leading-none no-underline"
              style={{ border: `1px solid ${sel ? "var(--px-primary)" : "var(--px-line-strong)"}`, background: sel ? "var(--px-primary)" : "var(--px-surface)", color: sel ? "var(--px-on-primary)" : "var(--px-ink)" }}
            >
              {x.label}
            </Link>
          );
        })}
      </nav>
      {events.length === 0 ? (
        <p className="px-card m-0 p-5 text-px-ink-2">Nessun movimento da mostrare.</p>
      ) : (
        <ol className="m-0 list-none overflow-hidden rounded-[18px] border border-px-line bg-px-surface p-0">
          {events.map((e, i) => {
            const d = describe(e);
            const delta = Number(e.delta);
            const day = dateOfTimestampRome(e.created_at);
            const date = day === b.today ? "Oggi" : capitalize(formatLong(day));
            const isInitial = e.type === "count" && e.meta?.initial;
            return (
              <li key={e.id} className={`flex items-center gap-3.5 px-[clamp(14px,2vw,24px)] py-3.5 ${i ? "border-t border-px-line" : ""}`}>
                <span aria-hidden="true" className="grid h-10 w-10 flex-none place-items-center rounded-[12px] bg-px-surface-2 font-mono text-[18px] font-[650] leading-none text-px-ink-2">
                  {d.icon}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="t-body-strong">{d.title}</span>
                  <span className="text-[15px] leading-[1.35] text-px-ink-2">
                    {date}, {formatTimeRome(e.created_at)}
                    {d.note}
                    {by(e) ? ` · ${by(e)}` : ""}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="font-mono text-[18px] font-[650] leading-[1.2]">{isInitial ? formatQty(delta) : delta > 0 ? `+${formatQty(delta)}` : delta < 0 ? `−${formatQty(-delta)}` : "±0"}</span>
                  <span className="text-[14px] leading-[1.3] text-px-ink-3">Restano {formatQty(Number(e.qty_after))}</span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
