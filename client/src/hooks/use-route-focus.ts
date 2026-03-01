import { useEffect } from "react";
import { useLocation } from "wouter";

/**
 * WCAG 2.4.3 — focus management for SPA route changes.
 * After every navigation, moves focus to #main-content so keyboard/screen-reader
 * users know the page has changed without a full reload.
 */
export function useRouteFocus() {
  const [location] = useLocation();

  useEffect(() => {
    const main = document.getElementById("main-content");
    if (!main) return;

    // Temporarily make it focusable, focus it, then clean up so it stays
    // out of the normal tab order.
    main.setAttribute("tabindex", "-1");
    main.focus({ preventScroll: true });

    const raf = requestAnimationFrame(() => {
      main.removeAttribute("tabindex");
    });

    return () => cancelAnimationFrame(raf);
  }, [location]);
}
