/**
 * Listener gamification constants and pure utility functions.
 * Extracted from server/storage.ts to reduce file size.
 *
 * These have no database dependencies — they are pure computational helpers
 * used by the listener section of DatabaseStorage.
 */

import type {
  ListenerProgress,
  ListenerPointsLedger,
  ListenerBadge,
  ListenerEndorsement,
  ListenerWellbeingCheckIn,
  ListenerCooldown,
} from "@shared/schema";

// ---- Gamification constants ----

export const LISTENER_LEVEL_THRESHOLDS = [0, 50, 150, 300, 500, 800, 1200, 1700, 2300, 3000];

export const RATING_BONUS_BY_SCORE: Record<number, number> = {
  1: -10,
  2: 0,
  3: 8,
  4: 16,
  5: 24,
};

export const STREAK_BONUS_BY_MILESTONE: Record<number, number> = {
  3: 15,
  7: 30,
};

export const BASE_SESSION_POINTS = 8;
export const LOW_RATING_PENALTY = -20;
export const DETAILED_FEEDBACK_BONUS = 4;

export const REPORT_SEVERITY_PENALTY: Record<string, number> = {
  low: -20,
  medium: -40,
  high: -80,
  critical: -120,
};

export const DIFFICULT_SESSION_COOLDOWN_MINUTES = 20;

export const LISTENER_BADGE_DEFS: Record<string, { title: string; description: string }> = {
  first_session: { title: "First Light", description: "Completed the first rated peer-support session." },
  streak_3: { title: "Steady Presence", description: "Maintained a positive streak for 3 sessions." },
  streak_7: { title: "Anchor Heart", description: "Maintained a positive streak for 7 sessions." },
  level_5: { title: "Community Guide", description: "Reached listener level 5." },
  empathy_star: { title: "Empathy Star", description: "Sustained exceptional ratings over multiple sessions." },
  endorsed_voice: { title: "Endorsed Voice", description: "Received at least 3 anonymous endorsements." },
};

// ---- Pure utility functions ----

export function trophyTierForRank(rank: number): "gold" | "silver" | "bronze" | null {
  if (rank === 1) return "gold";
  if (rank === 2) return "silver";
  if (rank === 3) return "bronze";
  return null;
}

export function listenerSeasonKeyForDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function isValidListenerSeasonKey(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function listenerSeasonRangeFromKey(seasonKey: string): { startIso: string; endIso: string } {
  const [yearText, monthText] = seasonKey.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1, 0, 0, 0, 0));
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

export function listenerLevelForPoints(points: number): number {
  const safePoints = Math.max(0, points);
  let level = 1;
  for (let i = 0; i < LISTENER_LEVEL_THRESHOLDS.length; i += 1) {
    if (safePoints >= LISTENER_LEVEL_THRESHOLDS[i]) level = i + 1;
  }
  return level;
}

export function listenerNextLevelInfo(points: number): {
  nextLevel: number | null;
  nextLevelThreshold: number | null;
  pointsToNextLevel: number;
} {
  const safePoints = Math.max(0, points);
  const currentLevel = listenerLevelForPoints(safePoints);
  const nextLevelThreshold = LISTENER_LEVEL_THRESHOLDS[currentLevel];
  if (nextLevelThreshold === undefined) return { nextLevel: null, nextLevelThreshold: null, pointsToNextLevel: 0 };
  return { nextLevel: currentLevel + 1, nextLevelThreshold, pointsToNextLevel: Math.max(0, nextLevelThreshold - safePoints) };
}

// ---- Exported interfaces (storage domain types) ----

export interface ListenerProgressSummary {
  progress: ListenerProgress;
  nextLevel: number | null;
  nextLevelThreshold: number | null;
  pointsToNextLevel: number;
  averageRating: number;
  ratingCount: number;
  positiveStreak: number;
  longestStreak: number;
  endorsementsCount: number;
  recentLedger: ListenerPointsLedger[];
  badges: ListenerBadge[];
  endorsements: ListenerEndorsement[];
  wellbeing: {
    latestCheckIn: ListenerWellbeingCheckIn | null;
    checkInCount: number;
    averageStressLevel: number | null;
    averageEmotionalLoad: number | null;
    suggestedCooldown: boolean;
  };
  cooldown: ListenerCooldown | null;
}

export interface ListenerLeaderboardEntry {
  listenerId: string;
  rank: number;
  displayName: string;
  level: number;
  points: number;
  averageRating: number;
  ratingCount: number;
  positiveStreak: number;
  trophyTier: "gold" | "silver" | "bronze" | null;
  certificationTitle: string | null;
}

export interface ListenerRiskSnapshot {
  listenerId: string;
  riskScore: number;
  riskLevel: "low" | "medium" | "high";
  openReports: number;
  severeOpenReports: number;
  recentLowRatings: number;
  averageRating: number;
  ratingCount: number;
  penaltyPoints: number;
}
