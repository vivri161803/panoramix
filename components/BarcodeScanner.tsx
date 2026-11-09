"use client";

// Lettore del codice sulla scatola: DataMatrix GS1 o bollino (Code 39). Si carica solo quando si
// apre (next/dynamic nel modulo). Usa BarcodeDetector del browser se c'è, altrimenti il polyfill
// zxing-wasm con il WebAssembly servito da /zxing/ (public/zxing, nessuna CDN).
// Se in futuro si aggiunge un header Permissions-Policy, deve includere camera=(self).

import { useEffect, useRef, useState } from "react";

const FORMATS = ["data_matrix", "code_39", "code_128", "ean_13"];

interface DetectedBarcode {
  rawValue: string;
  format: string;
}
interface Detector {
  detect(source: CanvasImageSource | ImageBitmap | Blob): Promise<DetectedBarcode[]>;
}

async function makeDetector(): Promise<Detector> {
  const native = (globalThis as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats(): Promise<string[]> } }).BarcodeDetector;
  if (native) {
    try {
      const supported = await native.getSupportedFormats();
      if (supported.includes("data_matrix") && supported.includes("code_39")) return new native({ formats: FORMATS.filter((f) => supported.includes(f)) });
    } catch {
      // si passa al polyfill
    }
  }
  const { BarcodeDetector, prepareZXingModule } = await import("barcode-detector/ponyfill");
  prepareZXingModule({
    overrides: { locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? `/zxing/${path}` : prefix + path) },
  });
  return new BarcodeDetector({ formats: FORMATS as never[] }) as unknown as Detector;
}

export default function BarcodeScanner({ onDetected, onClose }: { onDetected: (raw: string, format: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const detectorRef = useRef<Promise<Detector> | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const [status, setStatus] = useState<"starting" | "live" | "nocamera">("starting");
  const [message, setMessage] = useState<string | null>(null);
  const [torch, setTorch] = useState<boolean | null>(null);
  const done = useRef(false);

  const detector = () => (detectorRef.current ??= makeDetector());

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    closeRef.current?.focus();

    const found = (codes: DetectedBarcode[]) => {
      const c = codes.find((x) => x.rawValue);
      if (!c || done.current) return false;
      done.current = true;
      navigator.vibrate?.(60);
      onDetected(c.rawValue, c.format);
      return true;
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("nocamera");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
      } catch {
        setStatus("nocamera");
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const track = stream.getVideoTracks()[0];
      trackRef.current = track;
      const caps = (track.getCapabilities?.() ?? {}) as { torch?: boolean };
      if (caps.torch) setTorch(false);
      const video = videoRef.current!;
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        // iOS a volte rifiuta play() senza gesto: il video parte comunque con autoplay muted
      }
      setStatus("live");
      const d = await detector();
      const tick = async () => {
        if (cancelled || done.current) return;
        try {
          if (video.readyState >= 2 && found(await d.detect(video))) return;
        } catch {
          // fotogramma non leggibile: si riprova
        }
        timer = setTimeout(tick, 180);
      };
      tick();
    })();

    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
      stream?.getTracks().forEach((t) => t.stop());
      trackRef.current = null;
    };
  }, [onDetected, onClose]);

  async function toggleTorch() {
    const t = trackRef.current;
    if (!t || torch === null) return;
    try {
      await t.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] });
      setTorch(!torch);
    } catch {
      setTorch(null);
    }
  }

  async function fromPhoto(file: File) {
    setMessage("Cerco il codice nella foto…");
    try {
      const d = await detector();
      const bitmap = await createImageBitmap(file);
      const codes = await d.detect(bitmap);
      const c = codes.find((x) => x.rawValue);
      if (c) {
        done.current = true;
        onDetected(c.rawValue, c.format);
      } else setMessage("Nella foto non trovo un codice: avvicinati alla scatola, con più luce, e riprova.");
    } catch {
      setMessage("Non riesco a leggere la foto. Riprova o scrivi il codice AIC.");
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="px-scan-t" className="fixed inset-0 z-50 flex flex-col bg-[#0b0f14] text-white">
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-[max(12px,env(safe-area-inset-top))]">
        <h2 id="px-scan-t" className="m-0 text-[18px] font-[650] leading-[1.3]">Inquadra il codice sulla scatola</h2>
        <button ref={closeRef} type="button" onClick={onClose} className="px-btn px-btn-sm px-btn-secondary">
          Chiudi
        </button>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <video ref={videoRef} muted playsInline autoPlay aria-label="Inquadratura della fotocamera" className="h-full w-full object-cover" />
        {status === "live" && (
          <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 h-[46%] w-[78%] max-w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-[18px] border-[3px] border-white/90 shadow-[0_0_0_100vmax_rgba(0,0,0,.45)]" />
        )}
        {status !== "live" && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            <p className="m-0 max-w-[340px] text-[17px] leading-[1.45]">
              {status === "starting" ? "Apro la fotocamera…" : "La fotocamera non si apre qui. Scatta una foto del codice oppure chiudi e scrivi le 9 cifre del codice AIC."}
            </p>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-3 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
        <p role="status" aria-live="polite" className="m-0 text-[15px] leading-[1.4] text-white/85">
          {message ?? "Va bene il quadratino (DataMatrix) o il bollino: inquadra il codice che inizia con la A."}
        </p>
        <div className="flex flex-wrap gap-2">
          {torch !== null && (
            <button type="button" onClick={toggleTorch} aria-pressed={torch} className="px-btn px-btn-secondary flex-[1_1_140px]">
              {torch ? "Spegni la torcia" : "Accendi la torcia"}
            </button>
          )}
          <button type="button" onClick={() => fileRef.current?.click()} className="px-btn px-btn-secondary flex-[1_1_140px]">
            Scatta una foto
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) fromPhoto(file);
            }}
          />
        </div>
      </div>
    </div>
  );
}
