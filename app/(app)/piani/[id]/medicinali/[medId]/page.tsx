import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getPlanBundle } from "@/lib/data";
import { dosesAt, upcomingChanges } from "@/lib/forecast";
import { canEdit } from "@/lib/roles";
import { MedicationForm } from "@/components/MedicationForm";
import { DoseChangesPanel } from "@/components/DoseChangesPanel";
import { ATC_UNKNOWN, ATC_UNKNOWN_VALUE } from "@/lib/atc";
import { isLevel, levelPhrase } from "@/lib/categories";

export const metadata: Metadata = { title: "Modifica medicinale" };

export default async function ModificaMedicinalePage({ params }: PageProps<"/piani/[id]/medicinali/[medId]">) {
  const { id, medId } = await params;
  const b = await getPlanBundle(id);
  if (!canEdit(b.role)) redirect(`/piani/${id}`);
  const item = b.forecast.items.find((i) => i.med.id === medId);
  if (!item) notFound();
  const m = item.med;
  // il modulo mostra le dosi in vigore oggi (i cambi già iniziati confluiscono lì al salvataggio)
  const now = dosesAt(m, b.today);
  const level = isLevel(m);
  return (
    <MedicationForm
      planId={b.plan.id}
      planName={b.plan.patient_name}
      medicationId={m.id}
      settings={b.settings}
      today={b.today}
      currentColor={m.color}
      levelStockText={level ? levelPhrase(item.forecast.stock, item.forecast.coverageDays, m) : undefined}
      initial={{
        name: m.name,
        strength: m.strength,
        description: m.description,
        pills_per_pack: m.pillsPerPack,
        requires_prescription: m.requiresPrescription,
        aic: m.aic,
        // medicinali di prima (senza gruppo): il modulo chiede a cosa servono; grigio = "Non so"
        atc_code: m.atcCode ?? (m.color === ATC_UNKNOWN.color ? ATC_UNKNOWN_VALUE : ""),
        category: m.category,
        days_per_pack: m.daysPerPack ?? null,
        shape: m.shape as "tonda" | "ovale" | "capsula" | null,
        dose_morning: now.doseMorning,
        dose_noon: now.doseNoon,
        dose_evening: now.doseEvening,
        frequency_type: m.frequencyType,
        weekdays: m.weekdays,
        interval_days: m.intervalDays,
        cycle_on: m.cycleOn,
        cycle_off: m.cycleOff,
        start_date: m.startDate,
        end_date: m.endDate,
        // a livello la scorta non è un campo del modulo: si riconta dal Dispenser
        stock_qty: level ? null : item.forecast.stock,
      }}
      extra={
        m.frequencyType === "as_needed" ? null : (
          <DoseChangesPanel
            planId={b.plan.id}
            medicationId={m.id}
            today={b.today}
            endDate={m.endDate}
            current={now}
            category={m.category}
            daysPerPack={m.daysPerPack ?? null}
            frequencyType={m.frequencyType}
            changes={upcomingChanges(m, b.today).map((c) => ({ id: c.id!, from: c.from, doseMorning: c.doseMorning, doseNoon: c.doseNoon, doseEvening: c.doseEvening }))}
          />
        )
      }
    />
  );
}
