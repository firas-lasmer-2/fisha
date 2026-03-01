import { useEffect, useState } from "react";
import type { Variants, Transition } from "framer-motion";

/**
 * Shared animation system for Shifa.
 * All framer-motion variants, transition presets, and the reduced-motion hook live here.
 * Every page/component that uses motion should import from this file.
 */

// ---------------------------------------------------------------------------
// Reduced motion hook
// ---------------------------------------------------------------------------

export function usePrefersReducedMotion(): boolean {
  const query = "(prefers-reduced-motion: reduce)";

  const [prefersReduced, setPrefersReduced] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return prefersReduced;
}

// ---------------------------------------------------------------------------
// Transition presets (calming, wellness-appropriate pacing)
// ---------------------------------------------------------------------------

export const transitions = {
  gentle: { duration: 0.35, ease: "easeOut" } as Transition,
  slow: { duration: 0.5, ease: "easeOut" } as Transition,
  spring: { type: "spring", stiffness: 200, damping: 24 } as Transition,
  instant: { duration: 0 } as Transition,
} as const;

// ---------------------------------------------------------------------------
// Shared variants
// ---------------------------------------------------------------------------

/**
 * Standard page section / card entrance.
 * Usage: custom={index} initial="hidden" animate="visible" variants={fadeUp}
 */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.35, ease: "easeOut" },
  }),
};

/**
 * Staggered card grid / list entrance.
 * Usage: custom={index} initial="hidden" animate="visible" variants={cardStagger}
 */
export const cardStagger: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: "easeOut" },
  }),
};

/**
 * Container that triggers staggerChildren on children.
 * Usage: initial="hidden" animate="visible" variants={staggerContainer}
 */
export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

/**
 * Scroll-triggered reveal for landing page sections.
 * Usage: {...scrollReveal} (spread as props)
 */
export const scrollReveal = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.55, ease: "easeOut" },
} as const;

/**
 * Scroll-triggered section variant (named, for use with variants=)
 * Usage: initial="hidden" whileInView="visible" variants={scrollRevealVariants}
 */
export const scrollRevealVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" } },
};

/**
 * Filter chip / tag entrance.
 * Usage: custom={index} initial="hidden" animate="visible" variants={chipEnter}
 */
export const chipEnter: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.3 },
  }),
};

/**
 * Page header slide-down entrance.
 * Usage: initial="hidden" animate="visible" variants={headerSlideDown}
 */
export const headerSlideDown: Variants = {
  hidden: { opacity: 0, y: -10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

/**
 * Simple fade-in (no y movement) for overlays, progress bars, etc.
 * Usage: initial="hidden" animate="visible" variants={fadeIn}
 */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: (i: number = 0) => ({
    opacity: 1,
    transition: { delay: i * 0.1, duration: 0.5 },
  }),
};

/**
 * Reduced-motion safe spread props for scroll-triggered reveals.
 * Usage: <motion.div {...safeScrollReveal(reducedMotion)} />
 */
export function safeScrollReveal(reducedMotion: boolean) {
  if (!reducedMotion) return scrollReveal;
  return {
    initial: { opacity: 1, y: 0 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0 },
  };
}

// ---------------------------------------------------------------------------
// Micro-interaction variants
// ---------------------------------------------------------------------------

/**
 * Button press feedback — slight compression on tap/click.
 * Usage: whileTap={safeVariants(buttonPress, rm).pressed}
 * Or: <motion.button variants={safeVariants(buttonPress, rm)} whileTap="pressed">
 */
export const buttonPress: Variants = {
  idle: { scale: 1 },
  pressed: { scale: 0.96, transition: { duration: 0.1, ease: "easeOut" } },
};

/**
 * Card hover lift — subtle elevation on hover.
 * Usage: <motion.div variants={safeVariants(cardHover, rm)} whileHover="hovered">
 */
export const cardHover: Variants = {
  idle: { y: 0 },
  hovered: { y: -2, transition: { duration: 0.2, ease: "easeOut" } },
};

/**
 * Success checkmark pop — spring scale-in for confirmation icons.
 * Usage: initial="hidden" animate="visible" variants={safeVariants(successPop, rm)}
 */
export const successPop: Variants = {
  hidden: { scale: 0, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: { type: "spring", stiffness: 400, damping: 20 },
  },
};

/**
 * Error shake — brief horizontal oscillation to signal a failure.
 * Usage: animate={hasError ? "shake" : "idle"} variants={safeVariants(errorShake, rm)}
 */
export const errorShake: Variants = {
  idle: { x: 0 },
  shake: {
    x: [0, -8, 8, -6, 6, -4, 4, 0],
    transition: { duration: 0.45, ease: "easeInOut" },
  },
};

/**
 * Skeleton-to-content crossfade — fades loaded content in smoothly.
 * Usage: initial="loading" animate="loaded" variants={safeVariants(skeletonToContent, rm)}
 */
export const skeletonToContent: Variants = {
  loading: { opacity: 0 },
  loaded: { opacity: 1, transition: { duration: 0.35, ease: "easeOut" } },
};

/**
 * Reduced-motion safe wrapper.
 * Strips transforms and sets duration to 0 when user prefers reduced motion.
 */
export function safeVariants(variants: Variants, reducedMotion: boolean): Variants {
  if (!reducedMotion) return variants;
  return Object.fromEntries(
    Object.entries(variants).map(([key, value]) => {
      if (typeof value === "function") {
        return [
          key,
          (...args: Parameters<typeof value>) => {
            const v = value(...args) as Record<string, unknown>;
            return { ...v, y: 0, x: 0, scale: 1, transition: { duration: 0 } };
          },
        ];
      }
      const v = value as Record<string, unknown>;
      return [key, { ...v, y: 0, x: 0, scale: 1, transition: { duration: 0 } }];
    })
  );
}
