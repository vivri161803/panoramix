import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { fullName, getPlanBundle } from "@/lib/data";
import { isOwner } from "@/lib/roles";
import { PlanForm } from "@/components/PlanForm";
import { TestEmailButton } from "@/components/TestEmailButton";
import { MembersPanel } from "@/components/MembersPanel";

export const metadata: Metadata = { title: "Impostazioni del piano" };

export default async function ModificaPianoPage({ params }: PageProps<"/piani/[id]/modifica">) {
  const { id } = await params;
  const b = await getPlanBundle(id);
  if (!isOwner(b.role)) redirect(`/piani/${id}`);
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
        prep_reminder: p.prep_reminder,
        weekly_summary: p.weekly_summary,
        recipients: b.recipients.map((r) => r.email),
      }}
      extra={
        <>
          <MembersPanel
            planId={p.id}
            ownerEmail={b.profile.email}
            members={b.members.map((m) => ({ userId: m.user_id, name: fullName(m.profile), email: m.profile?.email ?? "", role: m.role }))}
            invites={b.invites.map((i) => ({ id: i.id, email: i.email, role: i.role }))}
          />
          <TestEmailButton planId={p.id} email={b.profile.email} />
        </>
      }
    />
  );
}
