// Icone SVG riprese dal design.

export function IconPlus({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function IconBack() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M12.5 4.5L7 10l5.5 5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconNext() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M7.5 4.5L13 10l-5.5 5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconCheck({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" style={{ flex: "none" }}>
      <path d="M3.5 8.3l3 3 6-6.3" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconCheckCircle({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" style={{ flex: "none" }}>
      <circle cx="8" cy="8" r="8" fill="currentColor" />
      <path d="M4.6 8.3l2.2 2.2 4.6-4.8" stroke="var(--px-surface)" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconAlertCircle({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" style={{ flex: "none", marginTop: 1 }}>
      <circle cx="8" cy="8" r="8" fill="currentColor" />
      <path d="M8 4.2v4.6" stroke="var(--px-surface)" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="8" cy="11.5" r="1.1" fill="var(--px-surface)" />
    </svg>
  );
}

export function IconXCircle({ size = 18, inner = "var(--px-surface)" }: { size?: number; inner?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" style={{ flex: "none", marginTop: 1 }}>
      <circle cx="8" cy="8" r="8" fill="currentColor" />
      <path d="M5.4 5.4l5.2 5.2M10.6 5.4l-5.2 5.2" stroke={inner} strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

export function IconClose({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true">
      <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconChevronDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconPrint() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <rect x="4.5" y="2" width="9" height="4.5" rx="1" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="2" y="6.5" width="14" height="6.5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="5" y="11" width="8" height="5" rx="1" fill="var(--px-primary)" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function IconMail() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
      <rect x="3" y="6" width="22" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M4 8l10 7 10-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
