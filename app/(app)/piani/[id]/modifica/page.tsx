import type { Metadata } from "next";
import { getPlanBundle } from "@/lib/data";
import { PlanForm } from "@/components/PlanForm";
import { TestEmailButton } from "@/components/TestEmailButton";

export const metadata: Metadata = { title: "Impostazioni del piano" };

export default async function ModificaPianoPage({ params }: PageProps<"/piani/[id]/modifica">) {
  const { id } = await params;
  const b = await getPlanBundle(id);
  const p = b.plan;
  return (
    <PlanForm
      planId={p.id}
      managerEmail={b.profile.email}
      medCount={b.medications.length}
      meds={b.forecast.items.map(({ med, forecast }) => ({ id: med.id, name: med.name, strength: med.strength, color: med.color, shape: med.shape, current: forecast.stock }))}
      initial={{
        patient_name: p.patient_name,
        notes: p.notes,
        stock_mode: p.stock_mode,
        prep_weekday: p.prep_weekday,
        alert_under_14: p.alert_under_14,
        alert_under_7: p.alert_under_7,
        alert_last_pack: p.alert_last_pack,
        recipients: b.recipients.map((r) => r.email),
      }}
      extra={<TestEmailButton planId={p.id} email={b.profile.email} />}
    />
  );
}
