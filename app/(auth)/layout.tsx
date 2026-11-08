import { Disclaimer } from "@/components/ui/Disclaimer";
import { AppIcon } from "@/components/ui/AppIcon";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <main className="flex-1 grid place-items-center px-4 py-10">
        <div className="flex w-full max-w-[420px] flex-col gap-7">
          <div className="flex items-center gap-3">
            <AppIcon size={48} label={null} />
            <span className="text-[26px] font-[650] leading-none tracking-[-0.02em]">Panoramix</span>
          </div>
          <div className="px-card flex flex-col gap-5 p-6 shadow-px">{children}</div>
        </div>
      </main>
      <Disclaimer />
    </>
  );
}
