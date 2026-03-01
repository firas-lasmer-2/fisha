import { useEffect, useRef } from "react"
import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()
  const liveRef = useRef<HTMLDivElement>(null)

  // Mirror the latest toast into the aria-live region so screen readers
  // that don't reliably pick up Radix's built-in announcements still hear it.
  useEffect(() => {
    if (!liveRef.current) return
    const latest = toasts[0]
    if (!latest) return
    const text = [latest.title, latest.description].filter(Boolean).join(" — ")
    liveRef.current.textContent = text
    // Clear after a short delay so the same message re-triggers on repeat toasts
    const t = setTimeout(() => {
      if (liveRef.current) liveRef.current.textContent = ""
    }, 3000)
    return () => clearTimeout(t)
  }, [toasts])

  return (
    <ToastProvider>
      {/* Visually hidden live region — guaranteed screen reader announcement */}
      <div
        ref={liveRef}
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
