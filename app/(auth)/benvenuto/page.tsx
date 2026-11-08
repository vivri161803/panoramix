import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getProfile, getSessionUser } from "@/lib/data";
import { ProfileForm } from "@/components/ProfileForm";

export const metadata: Metadata = { title: "Benvenuto" };

export default async function BenvenutoPage() {
  if (!(await getSessionUser())) redirect("/accesso");
  const profile = await getProfile();
  if (profile?.first_name.trim() && profile.last_name.trim()) redirect("/piani");
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="t-title m-0">Benvenuto in Panoramix</h1>
        <p className="m-0 text-px-ink-2">È il tuo primo accesso. Come ti chiami? Useremo il nome nelle email di avviso.</p>
      </div>
      <ProfileForm firstName={profile?.first_name ?? ""} lastName={profile?.last_name ?? ""} submitLabel="Continua" next="/piani" />
    </>
  );
}
