"use client";

import { IconPrint } from "@/components/ui/icons";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="px-btn px-btn-primary">
      <IconPrint /> Stampa
    </button>
  );
}
