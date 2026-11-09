import type { Metadata } from "next";
import Link from "next/link";
import { fullName, getPlanBundle } from "@/lib/data";
import { buildPharmacyItems, ORDER_TARGET_DAYS } from "@/lib/pharmacy";
import { canEdit } from "@/lib/roles";
import { PharmacyList } from "@/components/PharmacyList";
import { IconBack } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Lista per la farmacia" };

export default async function FarmaciaPage({ params }: PageProps<"/piani/[id]/farmacia">) {
  const { id } = await params;
  const b = await getPlanBundle(id);
  const items = buildPharmacyItems(b.forecast.items, b.today, b.forecast.nextPrep);
  return (
    <div className="mx-auto flex w-full max-w-[820px] flex-col gap-4">
      <Link href={`/piani/${id}`} className="px-back print:hidden">
        <IconBack />
        {b.plan.patient_name}
      </Link>
      <div className="flex flex-col gap-1.5">
        <h1 className="t-display m-0">Lista per la farmacia</h1>
        <p className="m-0 text-px-ink-2 [text-wrap:pretty]">
          Sono già scelte le medicine da ordinare. Le confezioni proposte coprono circa {ORDER_TARGET_DAYS} giorni di terapia oltre a quelle in casa: cambiale se serve, poi copia o condividi il testo. Panoramix non lo manda a nessuno.
        </p>
      </div>
      {items.length === 0 ? (
        <p className="px-card m-0 p-5 text-px-ink-2">Nel piano non ci sono medicine in corso.</p>
      ) : (
        <PharmacyList planId={id} patientName={b.plan.patient_name} senderName={fullName(b.profile, b.profile.email)} today={b.today} items={items} editable={canEdit(b.role)} />
      )}
    </div>
  );
}
