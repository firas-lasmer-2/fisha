/**
 * Hybrid therapist matching — two-stage pipeline:
 *   Stage 1: Deterministic filter + scoring (always runs, O(n))
 *   Stage 2: AI refinement with natural language reasons (optional, graceful fallback)
 */

let _openai: import("openai").default | null = null;

function getOpenAI(): import("openai").default {
  if (!_openai) {
    const OpenAI = require("openai").default;
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "no-key",
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined,
    });
  }
  return _openai!;
}

export interface TherapistCandidate {
  id: string;
  name: string;
  specializations: string[];
  languages: string[];
  rateDinar: number | null;
  rating: number | null;
  gender: string | null;
  yearsExperience: number | null;
  verified: boolean | null;
  hasAvailabilityIn48h: boolean;
  hadPriorSession: boolean;
  /** +10 bonus when the user's active subscription targets this therapist's tier */
  subscriptionTierBonus?: number;
}

export interface MatchRequest {
  concerns: string;
  language?: string;
  gender?: string;
  budgetDinar?: number;
}

export interface MatchRecommendation {
  therapistId: string;
  matchScore: number;
  reason: string;
}

/**
 * Stage 1: deterministic scoring.
 * Hard filters: language match (if specified), budget (if specified), gender (if specified).
 * Soft scores:
 *   - specialization keyword overlap:  up to +20
 *   - language match:                  +15
 *   - budget fits (rate <= budget):    +10
 *   - availability in 48 h:           +10
 *   - prior session with therapist:   +15
 *   - verified:                       +5
 *   - rating bonus:                   rating * 3  (max +15 at 5★)
 */
function deterministicScore(candidate: TherapistCandidate, req: MatchRequest): number | null {
  // Hard filter: gender
  if (req.gender && req.gender !== "any" && candidate.gender && candidate.gender !== req.gender) {
    return null;
  }

  // Hard filter: budget
  if (
    req.budgetDinar !== undefined &&
    req.budgetDinar > 0 &&
    candidate.rateDinar !== null &&
    candidate.rateDinar > req.budgetDinar
  ) {
    return null;
  }

  // Hard filter: language (at least one language in common)
  if (req.language && req.language !== "any") {
    const langs = (candidate.languages || []).map((l) => l.toLowerCase());
    if (!langs.includes(req.language.toLowerCase()) && !langs.includes("arabic") && !langs.includes("ar")) {
      // only enforce hard language filter if therapist has declared languages
      if (langs.length > 0) return null;
    }
  }

  let score = 50; // base

  // Specialization overlap — simple keyword match against concerns text
  const concernsLower = req.concerns.toLowerCase();
  const specializationMatches = (candidate.specializations || []).filter((s) =>
    concernsLower.includes(s.toLowerCase()) || s.toLowerCase().includes(concernsLower.slice(0, 8)),
  ).length;
  score += Math.min(specializationMatches * 7, 20);

  // Language match
  if (req.language) {
    const langs = (candidate.languages || []).map((l) => l.toLowerCase());
    if (langs.includes(req.language.toLowerCase())) score += 15;
  }

  // Budget fits
  if (
    req.budgetDinar !== undefined &&
    req.budgetDinar > 0 &&
    candidate.rateDinar !== null &&
    candidate.rateDinar <= req.budgetDinar
  ) {
    score += 10;
  }

  // Availability in 48h
  if (candidate.hasAvailabilityIn48h) score += 10;

  // Prior session
  if (candidate.hadPriorSession) score += 15;

  // Verified
  if (candidate.verified) score += 5;

  // Rating bonus
  if (candidate.rating) score += Math.min(Math.round(candidate.rating * 3), 15);

  // Subscription tier bonus
  if (candidate.subscriptionTierBonus) score += candidate.subscriptionTierBonus;

  return Math.min(score, 100);
}

function genericReason(candidate: TherapistCandidate, req: MatchRequest): string {
  const parts: string[] = [];
  if (candidate.hadPriorSession) parts.push("you've worked together before");
  if (candidate.verified) parts.push("verified professional");
  if (candidate.hasAvailabilityIn48h) parts.push("available soon");
  if (candidate.rating && candidate.rating >= 4) parts.push(`highly rated (${candidate.rating}★)`);
  if ((candidate.specializations || []).length > 0) {
    parts.push(`specializes in ${candidate.specializations!.slice(0, 2).join(", ")}`);
  }
  return parts.length > 0
    ? `Good match: ${parts.join("; ")}.`
    : "Recommended based on your profile.";
}

/**
 * Stage 2: AI refinement — re-ranks top-5 and adds natural language reasons.
 * Gracefully falls back to generic reasons if OpenAI is unavailable or times out.
 */
async function aiRefine(
  candidates: Array<TherapistCandidate & { deterministicScore: number }>,
  req: MatchRequest,
  topK: number,
): Promise<MatchRecommendation[]> {
  const candidatePayload = candidates.slice(0, Math.min(10, candidates.length)).map((c) => ({
    id: c.id,
    name: c.name,
    specializations: c.specializations,
    languages: c.languages,
    rateDinar: c.rateDinar,
    rating: c.rating,
    yearsExperience: c.yearsExperience,
    verified: c.verified,
    hasAvailabilityIn48h: c.hasAvailabilityIn48h,
    hadPriorSession: c.hadPriorSession,
    deterministicScore: c.deterministicScore,
  }));

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await getOpenAI().chat.completions.create(
      {
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a therapist matching assistant for Shifa, a Tunisian mental health platform.
Rank the top ${topK} therapists for this user from the candidates provided. Use the deterministicScore as a baseline but factor in the user's specific concerns.
Return JSON: { "recommendations": [{ "therapistId": "...", "matchScore": 0-100, "reason": "1-2 sentence explanation in ${req.language === "fr" ? "French" : "Arabic"}" }] }
Only include therapist IDs from the input. Return exactly ${topK} recommendations.`,
          },
          {
            role: "user",
            content: `User needs:
- Concerns: ${req.concerns}
- Language preference: ${req.language || "Arabic"}
- Gender preference: ${req.gender || "any"}
- Budget: ${req.budgetDinar ? `${req.budgetDinar} TND` : "any"}

Candidates:
${JSON.stringify(candidatePayload, null, 2)}`,
          },
        ],
        response_format: { type: "json_object" },
      },
      { signal: controller.signal as AbortSignal },
    );

    clearTimeout(timeoutId);

    const result = JSON.parse(response.choices[0]?.message?.content || "{}") as {
      recommendations?: Array<{ therapistId: string; matchScore: number; reason: string }>;
    };

    if (Array.isArray(result?.recommendations) && result.recommendations.length > 0) {
      return result.recommendations.slice(0, topK);
    }
  } catch {
    // AI unavailable — fall through to deterministic fallback
  }

  // Fallback: use deterministic scores + generic reasons
  return candidates.slice(0, topK).map((c) => ({
    therapistId: c.id,
    matchScore: c.deterministicScore,
    reason: genericReason(c, req),
  }));
}

/**
 * Main entry point. Returns top `topK` therapist recommendations (default 3).
 */
export async function matchTherapists(
  candidates: TherapistCandidate[],
  req: MatchRequest,
  topK = 3,
): Promise<MatchRecommendation[]> {
  if (candidates.length === 0) return [];

  // Stage 1: score and filter
  const scored = candidates
    .map((c) => ({ ...c, deterministicScore: deterministicScore(c, req) }))
    .filter((c): c is typeof c & { deterministicScore: number } => c.deterministicScore !== null)
    .sort((a, b) => b.deterministicScore - a.deterministicScore);

  if (scored.length === 0) return [];

  // Stage 2: AI refinement (with fallback)
  return aiRefine(scored, req, Math.min(topK, scored.length));
}
