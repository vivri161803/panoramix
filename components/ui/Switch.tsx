"use client";

export function Switch({ checked, onChange, label, sub }: { checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-14 items-center justify-between gap-4 border-x-0 border-b-0 border-t border-solid border-px-line bg-transparent px-0 py-1.5 text-left text-px-ink"
    >
      <span className="flex flex-col gap-0.5">
        <span className="t-body-strong">{label}</span>
        {sub && <span className="text-[15px] leading-[1.35] text-px-ink-2">{sub}</span>}
      </span>
      <span aria-hidden="true" className="relative h-[26px] w-11 flex-none rounded-full transition-[background] duration-150" style={{ background: checked ? "var(--px-ok-fg)" : "var(--px-line-strong)" }}>
        <span
          className="absolute top-[3px] h-5 w-5 rounded-full transition-[left] duration-150"
          style={{ left: checked ? 21 : 3, background: "var(--px-surface)", boxShadow: "0 1px 2px rgba(0,0,0,.3)" }}
        />
      </span>
    </button>
  );
}
