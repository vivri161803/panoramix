import type { Metadata } from "next";
import Link from "next/link";
import { getPlanBundle } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { loadAvailability, type AifaStatusRow, type MedAvailability } from "@/lib/availability";
import { formatDayMonthYear } from "@/lib/dates";
import { canEdit } from "@/lib/roles";
import { PlanHeader } from "@/components/PlanHeader";
import { Pill } from "@/components/ui/Pill";
import { IconCheckCircle } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Disponibilità" };

const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const price = (n: number | null) => (n === null ? "—" : euro.format(n));
const day = (d: string | null) => (d ? formatDayMonthYear(d) : null);

function chip(kind: "out" | "ok" | "neutral") {
  const c = {
    out: { bg: "var(--px-out-fg)", fg: "var(--px-surface)", bc: "var(--px-out-fg)" },
    ok: { bg: "var(--px-ok-bg)", fg: "var(--px-ok-fg)", bc: "var(--px-ok-line)" },
    neutral: { bg: "var(--px-surface-2)", fg: "var(--px-ink-2)", bc: "var(--px-line)" },
  }[kind];
  return { background: c.bg, color: c.fg, border: `1px solid ${c.bc}` };
}

function Shortages({ a }: { a: MedAvailability }) {
  if (!a.shortages.length) {
    return (
      <p className="m-0 flex items-start gap-2 text-[15px] leading-[1.4] text-px-ink-2">
        <IconCheckCircle /> Non risulta tra i farmaci carenti dell&apos;elenco AIFA.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {a.shortages.map((s, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-[14px] border border-px-out-line bg-px-out-bg p-4">
          <span className="inline-flex h-7 items-center self-start rounded-full px-3 text-[14px] font-[650]" style={chip("out")}>
            In carenza
          </span>
          <dl className="m-0 grid gap-x-4 gap-y-1.5 text-[15px] leading-[1.4] [grid-template-columns:auto_1fr]">
            {s.started_on && (
              <>
                <dt className="text-px-ink-2">Dal</dt>
                <dd className="m-0 font-semibold">{day(s.started_on)}</dd>
              </>
            )}
            <dt className="text-px-ink-2">Fine presunta</dt>
            <dd className="m-0 font-semibold">{day(s.expected_end) ?? "non indicata"}</dd>
            {s.reasons && (
              <>
                <dt className="text-px-ink-2">Motivo</dt>
                <dd className="m-0 whitespace-pre-line">{s.reasons}</dd>
              </>
            )}
            {s.equivalent && (
              <>
                <dt className="text-px-ink-2">Equivalente</dt>
                <dd className="m-0">{s.equivalent === "Sì" ? "AIFA indica che esiste un equivalente" : s.equivalent === "No" ? "AIFA non indica equivalenti" : s.equivalent}</dd>
              </>
            )}
          </dl>
          {s.aifa_suggestions && (
            <p className="m-0 whitespace-pre-line text-[15px] leading-[1.45]">
              <strong className="font-[650]">Indicazioni AIFA: </strong>
              {s.aifa_suggestions}
            </p>
          )}
          {s.aifa_note && <p className="m-0 whitespace-pre-line text-[14px] leading-[1.45] text-px-ink-2">{s.aifa_note}</p>}
        </div>
      ))}
    </div>
  );
}

function Equivalents({ a }: { a: MedAvailability }) {
  if (!a.group) return <p className="m-0 text-[15px] leading-[1.4] text-px-ink-2">Nessun equivalente nelle liste di trasparenza AIFA.</p>;
  const g = a.group;
  return (
    <div className="flex flex-col gap-2.5">
      <p className="m-0 text-[15px] leading-[1.45]">
        Prezzo di riferimento SSN: <strong className="font-[650]">{price(g.referencePrice)}</strong>
        <span className="text-px-ink-2"> · {g.referencePack}</span>
      </p>
      <div className="overflow-x-auto rounded-[12px] border border-px-line">
        <table className="w-full min-w-[440px] border-collapse text-left text-[15px] leading-[1.35]">
          <caption className="sr-only">Equivalenti di {a.med.name}, in ordine di prezzo</caption>
          <thead>
            <tr className="bg-px-surface-2 text-[14px] text-px-ink-2">
              <th scope="col" className="px-3 py-2 font-semibold">Medicinale</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Prezzo</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Differenza</th>
            </tr>
          </thead>
          <tbody>
            {g.equivalents.map((e) => (
              <tr key={e.aic} className="border-t border-px-line" style={e.isPlan ? { background: "var(--px-ordered-bg)" } : undefined} aria-current={e.isPlan ? "true" : undefined}>
                <td className="px-3 py-2.5">
                  <span className="font-semibold">{e.name}</span>
                  {e.isPlan && (
                    <span className="ml-2 inline-flex h-6 items-center rounded-full px-2 text-[13px] font-[650]" style={chip("neutral")}>
                      nel piano
                    </span>
                  )}
                  <span className="block text-[14px] text-px-ink-2">{e.packDescription}</span>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold">{price(e.publicPrice)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right">
                  {e.difference === 0 ? (
                    <span className="inline-flex h-6 items-center rounded-full px-2 text-[13px] font-[650]" style={chip("ok")}>
                      Nessuna differenza
                    </span>
                  ) : e.difference === null ? (
                    "—"
                  ) : (
                    `+ ${price(e.difference)}`
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="m-0 text-[14px] leading-[1.45] text-px-ink-2">
        Con la ricetta del Servizio sanitario, chi sceglie una confezione con un prezzo sopra quello di riferimento di solito paga la differenza.
      </p>
    </div>
  );
}

function dataDate(status: AifaStatusRow[]) {
  const by = (s: string) => status.find((r) => r.source === s);
  const parts: string[] = [];
  const car = by("carenze");
  const tr = by("trasparenza");
  if (car?.source_date) parts.push(`farmaci carenti al ${formatDayMonthYear(car.source_date)}`);
  if (tr?.source_date) parts.push(`prezzi della lista di trasparenza al ${formatDayMonthYear(tr.source_date)}`);
  return parts.length ? `Dati AIFA aggiornati: ${parts.join(", ")}.` : "Dati AIFA non ancora importati.";
}

export default async function DisponibilitaPage({ params }: PageProps<"/piani/[id]/disponibilita">) {
  const { id } = await params;
  const b = await getPlanBundle(id);
  const supabase = await createClient();
  const { items, status, error } = await loadAvailability(supabase, b.medications);
  const editable = canEdit(b.role);

  return (
    <>
      <PlanHeader plan={b.plan} tab="disponibilita" role={b.role} ownerName={b.ownerName} />
      <div className="flex flex-col gap-1.5">
        <h2 className="t-heading m-0">Carenze ed equivalenti</h2>
        <p className="m-0 max-w-[720px] text-[15px] leading-[1.45] text-px-ink-2">
          Per ogni medicina: se è nell&apos;elenco AIFA dei farmaci carenti e quali confezioni equivalenti ci sono, con il prezzo.
        </p>
      </div>
      {error && (
        <p role="alert" className="m-0 rounded-[12px] border border-px-out-line bg-px-out-bg p-3.5 text-[15px]">
          {error}
        </p>
      )}
      {items.length === 0 ? (
        <p className="m-0 text-px-ink-2">Nel piano non ci sono ancora medicinali.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((a) => (
            <section key={a.med.id} aria-labelledby={`px-av-${a.med.id}`} className="px-card flex flex-col gap-4 p-5">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 flex-none place-items-center rounded-[12px] bg-px-surface-2">
                  <Pill color={a.med.color} shape={a.med.shape} size={30} rotate={-14} />
                </span>
                <div className="flex min-w-0 flex-col">
                  <h3 id={`px-av-${a.med.id}`} className="m-0 text-[18px] font-[650] leading-[1.3] [overflow-wrap:anywhere]">
                    {a.med.name}
                  </h3>
                  {a.med.strength && <span className="text-[15px] text-px-ink-2">{a.med.strength}</span>}
                </div>
              </div>
              {a.noAic ? (
                <p className="m-0 text-[15px] leading-[1.45] text-px-ink-2">
                  Aggiungi il codice AIC per vedere carenze ed equivalenti.{" "}
                  {editable && (
                    <Link href={`/piani/${b.plan.id}/medicinali/${a.med.id}`} className="font-semibold">
                      Aggiungi il codice →
                    </Link>
                  )}
                </p>
              ) : (
                <>
                  <div className="flex flex-col gap-2">
                    <h4 className="t-label m-0 text-px-ink-3">Carenza</h4>
                    <Shortages a={a} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <h4 className="t-label m-0 text-px-ink-3">Equivalenti</h4>
                    <Equivalents a={a} />
                  </div>
                </>
              )}
            </section>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-1.5 text-[14px] leading-[1.5] text-px-ink-2">
        <p className="m-0">{dataDate(status)} Fonte: AIFA, dati aperti con licenza CC-BY 4.0.</p>
        <p className="m-0">
          “Non risulta tra i carenti” non vuol dire che sia in farmacia. Prima di cambiare marca chiedi al farmacista o al medico.
        </p>
      </div>
    </>
  );
}
