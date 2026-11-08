export const DISCLAIMER =
  "Panoramix è un promemoria: i conti si basano sui dati inseriti nel piano. Non dà consigli medici, non controlla le interazioni tra farmaci e non contatta medici o farmacie. Per dosi e terapie segui sempre le indicazioni del medico o del farmacista.";

export function Disclaimer() {
  return (
    <footer className="print:hidden border-t border-px-line bg-px-surface">
      <p className="mx-auto max-w-[1240px] px-4 py-5 sm:px-6 lg:px-10 text-[14px] leading-[1.5] text-px-ink-2">{DISCLAIMER}</p>
    </footer>
  );
}
