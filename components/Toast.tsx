"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { IconCheck, IconClose } from "@/components/ui/icons";

interface ToastData {
  id: number;
  text: string;
  undo?: () => void | Promise<void>;
}

const ToastContext = createContext<(text: string, undo?: ToastData["undo"]) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

function readFlash(): string | null {
  const m = document.cookie.match(/(?:^|; )px_flash=([^;]*)/);
  if (!m) return null;
  document.cookie = "px_flash=; Max-Age=0; path=/";
  try {
    return decodeURIComponent(decodeURIComponent(m[1]));
  } catch {
    return null;
  }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastData | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();

  const show = useCallback((text: string, undo?: ToastData["undo"]) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), text, undo });
    timer.current = setTimeout(() => setToast(null), 7000);
  }, []);

  // messaggi lasciati da un'azione prima di un reindirizzamento
  useEffect(() => {
    const text = readFlash();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- il cookie si legge solo nel browser
    if (text) show(text);
  }, [pathname, show]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <ToastContext value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4 print:hidden">
        <div role="status" aria-live="polite" className="contents">
          {toast && (
            <div
              key={toast.id}
              className="pointer-events-auto flex min-h-[52px] max-w-[min(100%,560px)] items-center gap-2.5 rounded-[14px] py-1.5 pr-1.5 pl-4 text-[16px] font-medium leading-[1.35]"
              style={{ background: "var(--px-ink)", color: "var(--px-surface)", boxShadow: "0 10px 30px rgba(14,22,32,.25)" }}
            >
              <IconCheck />
              <span className="min-w-0 flex-1">{toast.text}</span>
              {toast.undo && (
                <button
                  type="button"
                  onClick={async () => {
                    const undo = toast.undo;
                    setToast(null);
                    await undo?.();
                  }}
                  className="h-11 rounded-[10px] border-none bg-transparent px-3 text-[16px] font-[650] underline underline-offset-[3px]"
                  style={{ color: "var(--px-surface)" }}
                >
                  Annulla
                </button>
              )}
              <button
                type="button"
                onClick={() => setToast(null)}
                aria-label="Chiudi messaggio"
                className="grid h-11 w-11 place-items-center rounded-[10px] border-none bg-transparent"
                style={{ color: "var(--px-surface)" }}
              >
                <IconClose />
              </button>
            </div>
          )}
        </div>
      </div>
    </ToastContext>
  );
}
