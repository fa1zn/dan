"use client";

import { useEffect, useState } from "react";
import { Check, Phone } from "lucide-react";

/*
 * Tiny, dependency-free toast system. `toast(msg)` fires an instant, satisfying
 * confirmation; <Toaster/> (mounted once in the shell) renders the stack. Used to give
 * every action immediate feedback instead of a silent page reload.
 */

type ToastKind = "default" | "call";

export function toast(message: string, kind: ToastKind = "default") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("dan-toast", { detail: { message, kind } }));
}

/** Drop-in <form> that fires an instant toast on submit, then runs its server action. */
export function ToastForm({
  action,
  toastMsg,
  toastKind = "default",
  className,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  toastMsg?: string;
  toastKind?: ToastKind;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <form
      action={action}
      onSubmit={() => {
        if (toastMsg) toast(toastMsg, toastKind);
      }}
      className={className}
    >
      {children}
    </form>
  );
}

interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { message: string; kind: ToastKind };
      const id = Date.now() + Math.random();
      setItems((prev) => [...prev, { id, message: detail.message, kind: detail.kind }]);
      setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== id)), 3500);
    };
    window.addEventListener("dan-toast", handler);
    return () => window.removeEventListener("dan-toast", handler);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:left-auto sm:right-6 sm:items-end sm:px-0">
      {items.map((i) => (
        <div
          key={i.id}
          className="pointer-events-auto flex items-center gap-2.5 rounded-xl border bg-card px-4 py-3 text-sm shadow-lg"
          style={{ animation: "dan-toast-in 0.22s ease-out both" }}
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
            {i.kind === "call" ? <Phone className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
          </span>
          <span className="font-medium">{i.message}</span>
        </div>
      ))}
    </div>
  );
}
