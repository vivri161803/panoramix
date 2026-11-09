import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPlanBundle } from "@/lib/data";
import { canEdit } from "@/lib/roles";
import { MedicationForm } from "@/components/MedicationForm";

export const metadata: Metadata = { title: "Nuovo medicinale" };

export default async function NuovoMedicinalePage({ params }: PageProps<"/piani/[id]/medicinali/nuovo">) {
  const { id } = await params;
  const b = await getPlanBundle(id);
  if (!canEdit(b.role)) redirect(`/piani/${id}`);
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
        // il colore lo decide il gruppo ATC: da AIFA (codice AIC) o da "A cosa serve"
        aic: null,
        atc_code: "",
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
