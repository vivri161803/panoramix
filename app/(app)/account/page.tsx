import type { Metadata } from "next";
import Link from "next/link";
import { requireProfile } from "@/lib/data";
import { signOut } from "@/lib/actions/auth";
import { ProfileForm } from "@/components/ProfileForm";
import { DeleteAccount } from "./DeleteAccount";
import { IconBack } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const profile = await requireProfile();
  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4">
      <Link href="/piani" className="px-back">
        <IconBack />I miei piani
      </Link>
      <h1 className="t-display m-0">Il tuo account</h1>

      <section className="px-card flex flex-col gap-4 p-5" aria-labelledby="acc-dati">
        <h2 id="acc-dati" className="m-0 text-[18px] font-[650]">Dati personali</h2>
        <p className="m-0 text-px-ink-2">
          Accedi con <strong className="text-px-ink">{profile.email}</strong>. È anche l’indirizzo che riceve sempre gli avvisi e le risposte alle email.
        </p>
        <ProfileForm firstName={profile.first_name} lastName={profile.last_name} submitLabel="Salva nome" next="/account" />
      </section>

      <section className="px-card flex flex-col gap-3 p-5" aria-labelledby="acc-esci">
        <h2 id="acc-esci" className="m-0 text-[18px] font-[650]">Esci</h2>
        <p className="m-0 text-px-ink-2">Per rientrare ti basterà chiedere un nuovo link.</p>
        <form action={signOut}>
          <button type="submit" className="px-btn px-btn-secondary">Esci da Panoramix</button>
        </form>
      </section>

      <DeleteAccount />
    </div>
  );
}
