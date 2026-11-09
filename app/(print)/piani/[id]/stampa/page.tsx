import type { Metadata } from "next";
import Link from "next/link";
import { getPlanBundle } from "@/lib/data";
import { formatDayMonth, isoWeekday, WEEKDAYS_LONG } from "@/lib/dates";
import { formatQty, SLOT_LABEL, SLOTS } from "@/lib/forecast";
import { pillLook } from "@/lib/pills";
import { resolveWeek, weekGrid } from "@/lib/week";
import { IconBack } from "@/components/ui/icons";
import { PrintButton } from "./PrintButton";
import "./print.css";

export const metadata: Metadata = { title: "Stampa" };

function Dot({ color, size }: { color: string; size: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ flex: "none", width: size, height: size, borderRadius: "50%", background: color, boxShadow: "inset 0 -2px 3px rgba(0,0,0,.2),0 0 0 1.5px rgba(0,0,0,.25)" }}
    />
  );
}

export default async function StampaPage({ params, searchParams }: PageProps<"/piani/[id]/stampa">) {
  const { id } = await params;
  const sp = await searchParams;
  const b = await getPlanBundle(id);
  const week = resolveWeek(sp.settimana, b.settings, b.today);
  const { days, byId, legend } = weekGrid(b.medications, week.start);

  // più dosi per casella → caratteri un po' più piccoli, per restare in un A4
  const maxPerCell = Math.max(1, ...days.flatMap((d) => SLOTS.map((s) => d.slots[s].length)));
  const scale = maxPerCell <= 2 ? 1 : maxPerCell === 3 ? 0.86 : maxPerCell === 4 ? 0.74 : 0.64;
  const legendScale = legend.length > 8 ? 0.8 : 1;
  const px = (n: number) => `${Math.round(n * scale * 10) / 10}px`;

  return (
    <div className="flex flex-col items-center gap-4 py-6 print:p-0">
      <div className="px-no-print flex w-[min(100%,794px)] flex-wrap items-center justify-between gap-2 px-4">
        <Link href={`/piani/${id}/calendario?settimana=${week.start}`} className="px-back">
          <IconBack />
          Torna al calendario
        </Link>
        <PrintButton fileName={`Medicine ${b.plan.patient_name} ${week.start}.pdf`} />
      </div>
      <div className="px-sheet-wrap">
        <article id="px-sheet" className="px-sheet" aria-label={`Foglio settimanale per ${b.plan.patient_name}`}>
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 20, borderBottom: "3px solid #0E1620", paddingBottom: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
              <span style={{ font: "600 20px/1.2 var(--px-font)", color: "#44505C" }}>Le medicine di</span>
              <h1 style={{ margin: 0, font: "700 44px/1 var(--px-font)", letterSpacing: "-.02em", overflowWrap: "anywhere" }}>{b.plan.patient_name}</h1>
            </div>
            <div style={{ textAlign: "right", font: "600 22px/1.3 var(--px-font)", flex: "none" }}>
              Settimana
              <br />
              {week.label}
            </div>
          </header>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px" }}>
            {legend.map((m) => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Dot color={m.color} size={22} />
                <span style={{ font: `600 ${19 * legendScale}px/1.25 var(--px-font)` }}>
                  {m.name}{" "}
                  <span style={{ fontWeight: 400, color: "#44505C" }}>
                    {[m.strength, pillLook(m.atcCode, m.shape)].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </div>
            ))}
          </div>

          <div data-fit style={{ display: "grid", gridTemplateColumns: "150px repeat(3, 1fr)", border: "2px solid #0E1620", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "12px 14px", background: "#0E1620", color: "#fff", font: "600 18px/1.2 var(--px-font)" }}>Giorno</div>
            {SLOTS.map((s) => (
              <div key={s} style={{ padding: "12px 14px", background: "#0E1620", color: "#fff", font: "600 18px/1.2 var(--px-font)", borderLeft: "1px solid #44505C" }}>
                {SLOT_LABEL[s]}
              </div>
            ))}
            {days.map((d) => (
              <div key={d.date} style={{ display: "contents" }}>
                <div style={{ padding: 14, borderTop: "1.5px solid #AEB8C2", display: "flex", flexDirection: "column", justifyContent: "center", gap: 2 }}>
                  <span style={{ font: "700 21px/1.1 var(--px-font)", textTransform: "capitalize" }}>{WEEKDAYS_LONG[isoWeekday(d.date) - 1]}</span>
                  <span style={{ font: "500 17px/1.2 var(--px-font)", color: "#44505C" }}>{formatDayMonth(d.date)}</span>
                </div>
                {SLOTS.map((s) => (
                  <div key={s} style={{ padding: `${px(12)} 14px`, borderTop: "1.5px solid #AEB8C2", borderLeft: "1.5px solid #AEB8C2", display: "flex", flexDirection: "column", justifyContent: "center", gap: px(10) }}>
                    {d.slots[s].map((it) => {
                      const m = byId.get(it.medicationId)!;
                      return (
                        <div key={it.medicationId} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span aria-hidden="true" style={{ flex: "none", width: px(24), height: px(24), border: "2.5px solid #0E1620", borderRadius: 5 }} />
                          <Dot color={m.color} size={18 * scale} />
                          <span style={{ font: `600 ${px(19)}/1.15 var(--px-font)` }}>
                            {m.name} <span style={{ fontWeight: 500, color: "#44505C" }}>× {formatQty(it.qty)}</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <p style={{ margin: "auto 0 0", font: "500 18px/1.4 var(--px-font)", color: "#44505C" }}>Fai una crocetta nella casella quando hai preso la medicina.</p>
        </article>
      </div>
    </div>
  );
}
