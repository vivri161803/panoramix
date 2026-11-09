import type { Metadata } from "next";
import Link from "next/link";
import { getPlanBundle } from "@/lib/data";
import { formatDayMonthYear, formatNumeric } from "@/lib/dates";
import { EMAIL_DISCLAIMER } from "@/lib/email/alert-template";
import { changeLabel } from "@/lib/digest";
import { dosesAt, formatQty, frequencyPhrase, SLOTS, slotDose, upcomingChanges } from "@/lib/forecast";
import { pillLook } from "@/lib/pills";
import { IconBack } from "@/components/ui/icons";
import { PrintButton } from "../stampa/PrintButton";
import "../stampa/print.css";

export const metadata: Metadata = { title: "Scheda terapia" };

const cell = { padding: "10px 12px", borderTop: "1.5px solid #AEB8C2", verticalAlign: "top" as const };
const head = { padding: "10px 12px", background: "#0E1620", color: "#fff", font: "600 16px/1.2 var(--px-font)", textAlign: "left" as const };

function Dot({ color }: { color: string }) {
  return <span aria-hidden="true" style={{ display: "inline-block", flex: "none", width: 16, height: 16, borderRadius: "50%", background: color, boxShadow: "inset 0 -2px 3px rgba(0,0,0,.2),0 0 0 1.5px rgba(0,0,0,.25)" }} />;
}

export default async function TerapiaPage({ params }: PageProps<"/piani/[id]/terapia">) {
  const { id } = await params;
  const b = await getPlanBundle(id);
  const active = b.medications.filter((m) => !(m.endDate && m.endDate < b.today));
  const regular = active.filter((m) => m.frequencyType !== "as_needed");
  const asNeeded = active.filter((m) => m.frequencyType === "as_needed");

  const notes = (m: (typeof active)[number]) =>
    [
      m.description,
      m.requiresPrescription ? "Serve la ricetta" : "",
      m.startDate > b.today ? `Dal ${formatNumeric(m.startDate)}` : "",
      m.endDate ? `Fino al ${formatNumeric(m.endDate)}` : "",
      ...upcomingChanges(m, b.today).map(changeLabel),
    ].filter(Boolean);

  return (
    <div className="flex flex-col items-center gap-4 py-6 print:p-0">
      <div className="px-no-print flex w-[min(100%,794px)] flex-wrap items-center justify-between gap-2 px-4">
        <Link href={`/piani/${id}`} className="px-back">
          <IconBack />
          Torna al piano
        </Link>
        <PrintButton fileName={`Terapia ${b.plan.patient_name} ${b.today}.pdf`} />
      </div>
      <div className="px-sheet-wrap">
        <article id="px-sheet" className="px-sheet" aria-label={`Scheda terapia di ${b.plan.patient_name}`}>
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 20, borderBottom: "3px solid #0E1620", paddingBottom: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
              <span style={{ font: "600 19px/1.2 var(--px-font)", color: "#44505C" }}>Terapia in corso di</span>
              <h1 style={{ margin: 0, font: "700 40px/1 var(--px-font)", letterSpacing: "-.02em", overflowWrap: "anywhere" }}>{b.plan.patient_name}</h1>
            </div>
            <div style={{ textAlign: "right", font: "500 16px/1.4 var(--px-font)", color: "#44505C", flex: "none" }}>
              Aggiornata al
              <br />
              <strong style={{ color: "#0E1620", fontSize: 19 }}>{formatDayMonthYear(b.today)}</strong>
              {b.ownerName && (
                <>
                  <br />a cura di {b.ownerName}
                </>
              )}
            </div>
          </header>

          {b.plan.notes && <p style={{ margin: 0, font: "500 16px/1.45 var(--px-font)", whiteSpace: "pre-line", color: "#0E1620" }}>{b.plan.notes}</p>}

          <div data-fit style={{ display: "flex", flexDirection: "column", gap: 18, minHeight: 0, flex: "1 1 auto", overflow: "hidden" }}>
            {regular.length > 0 && (
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, border: "2px solid #0E1620", borderRadius: 10, overflow: "hidden", font: "500 16px/1.35 var(--px-font)" }}>
                <thead>
                  <tr>
                    <th style={{ ...head, width: "34%" }}>Medicinale</th>
                    <th style={{ ...head, textAlign: "center" }}>Mattina</th>
                    <th style={{ ...head, textAlign: "center" }}>Pranzo</th>
                    <th style={{ ...head, textAlign: "center" }}>Sera</th>
                    <th style={{ ...head, width: "30%" }}>Quando e note</th>
                  </tr>
                </thead>
                <tbody>
                  {regular.map((m) => {
                    const d = dosesAt(m, b.today);
                    return (
                      <tr key={m.id}>
                        <td style={cell}>
                          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                            <span style={{ paddingTop: 3 }}>
                              <Dot color={m.color} />
                            </span>
                            <span>
                              <strong style={{ font: "650 17px/1.25 var(--px-font)" }}>{m.name}</strong> {m.strength}
                              <br />
                              <span style={{ color: "#44505C", fontSize: 14 }}>{pillLook(m.atcCode, m.shape)}</span>
                            </span>
                          </div>
                        </td>
                        {SLOTS.map((s) => (
                          <td key={s} style={{ ...cell, textAlign: "center", font: "700 20px/1.2 var(--px-font)", borderLeft: "1.5px solid #AEB8C2" }}>
                            {slotDose(d, s) > 0 ? formatQty(slotDose(d, s)) : <span style={{ color: "#AEB8C2" }}>—</span>}
                          </td>
                        ))}
                        <td style={{ ...cell, borderLeft: "1.5px solid #AEB8C2", fontSize: 15 }}>
                          <span style={{ fontWeight: 600 }}>{frequencyPhrase(m).charAt(0).toUpperCase() + frequencyPhrase(m).slice(1)}</span>
                          {notes(m).map((n) => (
                            <span key={n} style={{ display: "block", color: "#44505C" }}>
                              {n}
                            </span>
                          ))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {asNeeded.length > 0 && (
              <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <h2 style={{ margin: 0, font: "650 20px/1.2 var(--px-font)" }}>Al bisogno</h2>
                {asNeeded.map((m) => (
                  <div key={m.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", font: "500 16px/1.4 var(--px-font)" }}>
                    <span style={{ paddingTop: 3 }}>
                      <Dot color={m.color} />
                    </span>
                    <span>
                      <strong>{m.name}</strong> {m.strength}
                      {notes(m).length > 0 && <span style={{ color: "#44505C" }}> · {notes(m).join(" · ")}</span>}
                    </span>
                  </div>
                ))}
              </section>
            )}

            {active.length === 0 && <p style={{ margin: 0, font: "500 18px/1.4 var(--px-font)" }}>Nessuna medicina in corso.</p>}
          </div>

          <p style={{ margin: "auto 0 0", font: "400 13px/1.45 var(--px-font)", color: "#44505C" }}>
            Le dosi riportano quanto inserito in Panoramix. {EMAIL_DISCLAIMER.replace("Panoramix è un promemoria: i conti si basano sui dati inseriti nel piano. ", "")}
          </p>
        </article>
      </div>
    </div>
  );
}
