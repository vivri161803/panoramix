import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPlanBundle } from "@/lib/data";
import { MedicationForm } from "@/components/MedicationForm";
import type { PillColor, PillShape } from "@/lib/pills";

export const metadata: Metadata = { title: "Modifica medicinale" };

export default async function ModificaMedicinalePage({ params }: PageProps<"/piani/[id]/medicinali/[medId]">) {
  const { id, medId } = await params;
  const b = await getPlanBundle(id);
  const item = b.forecast.items.find((i) => i.med.id === medId);
  if (!item) notFound();
  const m = item.med;
  return (
    <MedicationForm
      planId={b.plan.id}
      planName={b.plan.patient_name}
      medicationId={m.id}
      settings={b.settings}
      today={b.today}
      nextPrep={b.forecast.nextPrep}
      initial={{
        name: m.name,
        strength: m.strength,
        description: m.description,
        pills_per_pack: m.pillsPerPack,
        requires_prescription: m.requiresPrescription,
        color: m.color as PillColor,
        shape: m.shape as PillShape,
        dose_morning: m.doseMorning,
        dose_noon: m.doseNoon,
        dose_evening: m.doseEvening,
        frequency_type: m.frequencyType,
        weekdays: m.weekdays,
        interval_days: m.intervalDays,
        cycle_on: m.cycleOn,
        cycle_off: m.cycleOff,
        start_date: m.startDate,
        end_date: m.endDate,
        stock_qty: item.forecast.stock,
      }}
    />
  );
}
