"use client";

import { useMemo, useState, useTransition } from "react";
import { markOrdered } from "@/lib/actions/stock";
import type { ISODate } from "@/lib/dates";
import { doctorRequestText, pharmacyText, type PharmacyItem, type PharmacyLine } from "@/lib/pharmacy";
import { useToast } from "@/components/Toast";
import { Pill } from "@/components/ui/Pill";
import { StatusChip } from "@/components/ui/StatusChip";
import { IconPrint } from "@/components/ui/icons";

interface Props {
  planId: string;
  patientName: string;
  senderName: string;
  today: ISODate;
  items: PharmacyItem[];
  editable: boolean;
}

const stepBtn = "h-11 w-11 flex-none rounded-[10px] border border-px-line-strong bg-px-surface text-[20px] font-semibold leading-none";

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function PharmacyList({ planId, patientName, senderName, today, items, editable }: Props) {
  const [sel, setSel] = useState<Record<string, boolean>>(() => Object.fromEntries(items.map((i) => [i.id, i.selected])));
  const [packs, setPacks] = useState<Record<string, number>>(() => Object.fromEntries(items.map((i) => [i.id, i.packs])));
  const [pending, start] = useTransition();
  const toast = useToast();

  const lines: PharmacyLine[] = useMemo(
    () =>
      items
        .filter((i) => sel[i.id])
        .map((i) => ({ name: i.name, strength: i.strength, packs: packs[i.id] ?? 1, pillsPerPack: i.pillsPerPack, rx: i.rx, phrase: i.phrase })),
    [items, sel, packs],
  );
  const text = pharmacyText(patientName, lines, today);
  const doctor = doctorRequestText(patientName, lines, senderName);
  const chosen = items.filter((i) => sel[i.id]);
  const toMark = chosen.filter((i) => !i.ordered);

  async function share(t: string, title: string) {
    if (navigator.share) {
      try {
        await navigator.share({ title, text: t });
        return;
      } catch (e) {
        if ((e as DOMException).name === "AbortError") return;
      }
    }
    toast((await copy(t)) ? "Testo copiato" : "Non riesco a copiare: seleziona il testo a mano");
  }

  return (
    <>
      <section aria-label="Medicine" className="flex flex-col overflow-hidden rounded-[18px] border border-px-line bg-px-surface print:hidden">
        {items.map((i, n) => (
          <div key={i.id} className={`flex flex-wrap items-center gap-3 px-4 py-3.5 ${n ? "border-t border-px-line" : ""}`}>
            <label className="flex min-w-[220px] flex-1 cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={!!sel[i.id]}
                onChange={(e) => setSel((s) => ({ ...s, [i.id]: e.target.checked }))}
                className="h-6 w-6 flex-none accent-[var(--px-primary)]"
              />
              <Pill color={i.color} shape={i.shape} size={26} />
              <span className="flex min-w-0 flex-col">
                <span className="t-body-strong [overflow-wrap:anywhere]">
                  {i.name} <span className="font-medium text-px-ink-2">{i.strength}</span>
                </span>
                <span className="text-[14px] text-px-ink-2">
                  {i.pillsPerPack} per confezione{i.rx ? " · serve la ricetta" : ""}
                </span>
              </span>
            </label>
            <StatusChip status={i.status} />
            <div className="flex items-center gap-1" aria-label={`Confezioni di ${i.name}`} role="group">
              <button type="button" aria-label={`Una confezione in meno di ${i.name}`} onClick={() => setPacks((p) => ({ ...p, [i.id]: Math.max(1, (p[i.id] ?? 1) - 1) }))} className={stepBtn}>
                −
              </button>
              <output aria-live="polite" className="w-10 text-center text-[18px] font-[650]">
                {packs[i.id]}
              </output>
              <button type="button" aria-label={`Una confezione in più di ${i.name}`} onClick={() => setPacks((p) => ({ ...p, [i.id]: Math.min(20, (p[i.id] ?? 1) + 1) }))} className={stepBtn}>
                +
              </button>
            </div>
          </div>
        ))}
      </section>

      {lines.length === 0 ? (
        <p className="px-card m-0 p-5 text-px-ink-2 print:hidden">Scegli almeno una medicina per preparare il testo.</p>
      ) : (
        <>
          <section className="px-card flex flex-col gap-3 p-5" aria-labelledby="px-ph-text">
            <h2 id="px-ph-text" className="m-0 text-[18px] font-[650]">
              Testo per la farmacia
            </h2>
            <pre className="m-0 whitespace-pre-wrap rounded-[12px] border border-px-line bg-px-surface-2 p-4 font-[inherit] text-[16px] leading-[1.55] text-px-ink">{text}</pre>
            <div className="flex flex-wrap gap-2 print:hidden">
              <button type="button" onClick={async () => toast((await copy(text)) ? "Testo copiato" : "Non riesco a copiare: seleziona il testo a mano")} className="px-btn px-btn-sm px-btn-primary">
                Copia
              </button>
              <button type="button" onClick={() => share(text, `Medicine per ${patientName}`)} className="px-btn px-btn-sm px-btn-secondary">
                Condividi
              </button>
              <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" className="px-btn px-btn-sm px-btn-secondary">
                WhatsApp
              </a>
              <button type="button" onClick={() => window.print()} className="px-btn px-btn-sm px-btn-secondary">
                <IconPrint /> Stampa
              </button>
            </div>
          </section>

          {doctor && (
            <section className="px-card flex flex-col gap-3 p-5 print:hidden" aria-labelledby="px-ph-doc">
              <h2 id="px-ph-doc" className="m-0 text-[18px] font-[650]">
                Richiesta della ricetta al medico
              </h2>
              <pre className="m-0 whitespace-pre-wrap rounded-[12px] border border-px-line bg-px-surface-2 p-4 font-[inherit] text-[16px] leading-[1.55] text-px-ink">{doctor}</pre>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={async () => toast((await copy(doctor)) ? "Testo copiato" : "Non riesco a copiare: seleziona il testo a mano")} className="px-btn px-btn-sm px-btn-secondary">
                  Copia
                </button>
                <button type="button" onClick={() => share(doctor, `Ricetta per ${patientName}`)} className="px-btn px-btn-sm px-btn-secondary">
                  Condividi
                </button>
              </div>
            </section>
          )}

          {editable && toMark.length > 0 && (
            <section className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-px-line bg-px-surface-2 p-4 print:hidden">
              <span className="text-[15px] text-px-ink-2">Hai ordinato? Segnale come ordinate: gli avvisi si fermano finché non arrivano.</span>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await markOrdered(planId, toMark.map((i) => i.id));
                    toast(res.ok ? (res.message ?? "Fatto") : res.error);
                  })
                }
                className="px-btn px-btn-sm px-btn-primary"
              >
                {pending ? "Salvo…" : `Segna ${toMark.length === 1 ? "come ordinata" : `${toMark.length} come ordinate`}`}
              </button>
            </section>
          )}
        </>
      )}
    </>
  );
}
