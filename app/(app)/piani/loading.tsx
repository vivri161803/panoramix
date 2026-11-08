export default function Loading() {
  const card = (w1: string, w2: string, w3: string) => (
    <div className="flex h-[220px] flex-col gap-3.5 rounded-[18px] border border-px-line bg-px-surface p-5">
      <div className="h-[22px] rounded-[6px] bg-px-surface-2" style={{ width: w1 }} />
      <div className="h-3.5 rounded-[6px] bg-px-surface-2" style={{ width: w2 }} />
      <div className="h-[50px] rounded-[12px] bg-px-surface-2" />
      <div className="h-3.5 rounded-[6px] bg-px-surface-2" style={{ width: w3 }} />
    </div>
  );
  return (
    <div role="status" className="flex flex-col gap-3">
      <span className="text-px-ink-2">Caricamento…</span>
      <div aria-hidden="true" className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr))] motion-safe:animate-[pxPulse_1.6s_ease-in-out_infinite]">
        {card("55%", "35%", "70%")}
        {card("45%", "30%", "60%")}
      </div>
    </div>
  );
}
