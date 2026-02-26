import type { TherapistProfile, TherapistReview, User } from "@shared/schema";

export const SPECIALIZATION_ICONS: Record<string, string> = {
  anxiety: "😟",
  depression: "🌧️",
  trauma: "🫂",
  relationships: "🤝",
  couples: "💞",
  family: "🏠",
  grief: "🕊️",
  addiction: "🛡️",
  stress: "🔥",
  self_esteem: "🌱",
  ocd: "🔁",
  eating_disorders: "🍃",
  adhd: "⚡",
  anger: "🌊",
  career: "💼",
  child: "🧒",
  lgbtq: "🌈",
  sport: "🏃",
};

export function getSpecializationIcon(spec: string): string {
  return SPECIALIZATION_ICONS[spec.toLowerCase().replace(/\s+/g, "_")] || "🧠";
}

export function formatTherapistName(user: User | null | undefined): string {
  if (!user) return "";
  const parts = [user.firstName, user.lastName].filter(Boolean);
  return parts.length ? parts.join(" ") : user.email || "";
}

export function avgRating(reviews: TherapistReview[]): number {
  if (!reviews.length) return 0;
  return reviews.reduce((sum, r) => sum + r.overallRating, 0) / reviews.length;
}

export function formatRateDinar(rate: number | null | undefined): string {
  return rate ? `${rate} د.ت` : "—";
}

export function buildLandingPageUrl(slug: string | null | undefined): string | null {
  if (!slug) return null;
  return `/p/${slug}`;
}
