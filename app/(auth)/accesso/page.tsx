import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/data";
import { AccessForm } from "./AccessForm";

export const metadata: Metadata = { title: "Accedi" };

export default async function AccessoPage({ searchParams }: PageProps<"/accesso">) {
  if (await getSessionUser()) redirect("/piani");
  const sp = await searchParams;
  return <AccessForm expired={sp.errore === "scaduto"} deleted={sp.eliminato === "1"} />;
}
