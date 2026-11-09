import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getPlanBundle } from "@/lib/data";
import { dosesAt, upcomingChanges } from "@/lib/forecast";
import { canEdit } from "@/lib/roles";
import { MedicationForm } from "@/components/MedicationForm";
import { DoseChangesPanel } from "@/components/DoseChangesPanel";
import type { PillShape } from "@/lib/pills";
import { ATC_UNKNOWN, ATC_UNKNOWN_VALUE } from "@/lib/atc";

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
  return (
    <MedicationForm
      planId={b.plan.id}
      planName={b.plan.patient_name}
      medicationId={m.id}
      settings={b.settings}
      today={b.today}
      nextPrep={b.forecast.nextPrep}
      currentColor={m.color}
      initial={{
        name: m.name,
        strength: m.strength,
        description: m.description,
        pills_per_pack: m.pillsPerPack,
        requires_prescription: m.requiresPrescription,
        aic: m.aic,
        // medicinali di prima (senza gruppo): il modulo chiede a cosa servono; grigio = "Non so"
        atc_code: m.atcCode ?? (m.color === ATC_UNKNOWN.color ? ATC_UNKNOWN_VALUE : ""),
        shape: m.shape as PillShape,
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
        stock_qty: item.forecast.stock,
      }}
      extra={
        m.frequencyType === "as_needed" ? null : (
          <DoseChangesPanel
            planId={b.plan.id}
            medicationId={m.id}
            today={b.today}
            endDate={m.endDate}
            current={now}
            changes={upcomingChanges(m, b.today).map((c) => ({ id: c.id!, from: c.from, doseMorning: c.doseMorning, doseNoon: c.doseNoon, doseEvening: c.doseEvening }))}
          />
        )
      }
    />
  );
}
