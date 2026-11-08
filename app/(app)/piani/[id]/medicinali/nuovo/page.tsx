import type { Metadata } from "next";
import { getPlanBundle } from "@/lib/data";
import { MedicationForm } from "@/components/MedicationForm";
import { PILL_COLORS } from "@/lib/pills";

export const metadata: Metadata = { title: "Nuovo medicinale" };

export default async function NuovoMedicinalePage({ params }: PageProps<"/piani/[id]/medicinali/nuovo">) {
  const { id } = await params;
  const b = await getPlanBundle(id);
  // colore non ancora usato nel piano, per distinguerle a colpo d'occhio
  const used = new Set(b.medications.map((m) => m.color));
  const color = PILL_COLORS.find((c) => !used.has(c.hex))?.hex ?? PILL_COLORS[0].hex;
  return (
    <MedicationForm
      planId={b.plan.id}
      planName={b.plan.patient_name}
      settings={b.settings}
      today={b.today}
      nextPrep={b.forecast.nextPrep}
      initial={{
        name: "",
        strength: "",
        description: "",
        pills_per_pack: 30,
        requires_prescription: false,
        color,
        shape: "tonda",
        dose_morning: 1,
        dose_noon: 0,
        dose_evening: 0,
        frequency_type: "daily",
        weekdays: [],
        interval_days: 2,
        cycle_on: 21,
        cycle_off: 7,
        start_date: b.today,
        end_date: null,
        stock_qty: 0,
      }}
    />
  );
}
