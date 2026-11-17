import type { Metadata } from "next";
import { requireProfile } from "@/lib/data";
import { PlanForm } from "@/components/PlanForm";

export const metadata: Metadata = { title: "Nuovo piano" };

export default async function NuovoPianoPage() {
  const profile = await requireProfile();
  return (
    <PlanForm
      managerEmail={profile.email}
      medCount={0}
      initial={{
        patient_name: "",
        notes: "",
        prep_weekday: 7,
        alert_under_14: true,
        alert_under_7: false,
        alert_last_pack: true,
        prep_reminder: false,
        weekly_summary: false,
        recipients: [],
      }}
    />
  );
}
