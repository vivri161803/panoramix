"use client";

import { useEffect, useRef, useState } from "react";
import { IconPrint } from "@/components/ui/icons";
import { jpegToA4Pdf } from "@/lib/pdf";

const SHEET_ID = "px-sheet";
/** Foglio A4 in pixel CSS (96 dpi) */
const A4_PX = { width: 794, height: 1123 };

/**
 * App aperta dall'icona sulla schermata Home di iPhone/iPad:
 * lì Safari ignora `window.print()`.
 */
function isIosHomeScreenApp() {
  const nav = navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return ios && window.matchMedia("(display-mode: standalone)").matches;
}

/**
 * Se il calendario non entra nel foglio (nomi lunghi, tante dosi),
 * lo rimpicciolisce finché non ci sta: altrimenti gli ultimi giorni
 * verrebbero tagliati in stampa.
 */
function fitSheet(sheet: HTMLElement) {
  const grid = sheet.querySelector<HTMLElement>("[data-fit]");
  if (!grid) return;
  // la tabella si restringe nello spazio libero e taglia ciò che avanza
  const overflows = () => grid.scrollHeight > grid.clientHeight + 1 || grid.scrollWidth > grid.clientWidth + 1;
  grid.style.zoom = "";
  let zoom = 1;
  while (overflows() && zoom > 0.5) {
    zoom = Math.round((zoom - 0.02) * 100) / 100;
    grid.style.zoom = String(zoom);
  }
}

async function sheetToPdf(sheet: HTMLElement, fileName: string): Promise<File> {
  const { domToCanvas } = await import("modern-screenshot");
  // sul telefono il foglio è rimpicciolito con `zoom`, che falsa le misure:
  // si fotografa una copia a grandezza piena, fuori dallo schermo
  const holder = document.createElement("div");
  holder.style.cssText = "position:fixed;left:-10000px;top:0;pointer-events:none";
  const copy = sheet.cloneNode(true) as HTMLElement;
  copy.removeAttribute("id");
  copy.style.boxShadow = "none";
  holder.append(copy);
  document.body.append(holder);
  let canvas: HTMLCanvasElement;
  try {
    fitSheet(copy);
    canvas = await domToCanvas(copy, { ...A4_PX, scale: 2, backgroundColor: "#ffffff" });
  } finally {
    holder.remove();
  }
  const jpeg = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("jpeg"))), "image/jpeg", 0.92),
  );
  const pdf = jpegToA4Pdf(new Uint8Array(await jpeg.arrayBuffer()), canvas.width, canvas.height);
  return new File([pdf as BlobPart], fileName, { type: "application/pdf" });
}

function download(file: File) {
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement("a"), { href: url, download: file.name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

type Mode = "print" | "preparing" | "share" | "error";

export function PrintButton({ fileName }: { fileName: string }) {
  const [mode, setMode] = useState<Mode>("print");
  const pdf = useRef<File | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      await document.fonts.ready;
      const sheet = document.getElementById(SHEET_ID);
      if (!alive || !sheet) return;
      fitSheet(sheet);
      if (!isIosHomeScreenApp()) return;
      // il PDF si prepara subito: iOS apre la condivisione solo se
      // parte immediatamente dal tocco sul bottone
      setMode("preparing");
      try {
        pdf.current = await sheetToPdf(sheet, fileName);
        if (alive) setMode("share");
      } catch {
        if (alive) setMode("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [fileName]);

  async function onClick() {
    const file = pdf.current;
    if (mode !== "share" || !file) return window.print();
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: fileName.replace(/\.pdf$/, "") });
      } catch (e) {
        if ((e as DOMException).name !== "AbortError") download(file);
      }
    } else {
      download(file);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={onClick} disabled={mode === "preparing"} className="px-btn px-btn-primary">
        <IconPrint /> {mode === "preparing" ? "Preparo il foglio…" : "Stampa"}
      </button>
      {mode === "share" && <span className="text-sm text-px-ink-2">Nel menu che si apre scegli «Stampa».</span>}
      {mode === "error" && <span className="text-sm text-px-ink-2">Per stampare apri questa pagina in Safari.</span>}
    </div>
  );
}
