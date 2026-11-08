import Link from "next/link";
import { AppIcon } from "@/components/ui/AppIcon";
import { Disclaimer } from "@/components/ui/Disclaimer";
import { ToastProvider } from "@/components/Toast";
import { initials, requireProfile } from "@/lib/data";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const profile = await requireProfile();
  const name = `${profile.first_name} ${profile.last_name}`.trim();
  return (
    <ToastProvider>
      <a href="#contenuto" className="sr-only-px focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:w-auto focus:h-auto focus:rounded-md focus:bg-px-surface focus:p-3">
        Vai al contenuto
      </a>
      <header className="print:hidden flex h-16 items-center justify-between gap-3 border-b border-px-line bg-px-surface px-4 sm:px-6 lg:px-10">
        <Link href="/piani" aria-label="Panoramix, vai a I miei piani" className="flex h-11 items-center gap-2.5 text-px-ink no-underline hover:text-px-ink">
          <AppIcon size={32} label={null} />
          <span className="text-[19px] font-[650] leading-none tracking-[-0.02em]">Panoramix</span>
        </Link>
        <Link
          href="/account"
          aria-label={`Account di ${name}`}
          className="grid h-11 w-11 place-items-center rounded-full border border-px-line bg-px-surface-2 text-[14px] font-semibold text-px-ink-2 no-underline hover:text-px-ink"
        >
          {initials(profile)}
        </Link>
      </header>
      <main id="contenuto" className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col gap-6 px-4 pt-4 pb-24 sm:px-6 sm:pt-6 lg:px-10 lg:pt-10">
        {children}
      </main>
      <Disclaimer />
    </ToastProvider>
  );
}
