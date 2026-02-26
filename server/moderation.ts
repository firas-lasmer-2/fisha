/**
 * Content moderation — keyword and pattern-based flagging.
 * Goes beyond crisis detection to catch harassment, threats, spam, and solicitation.
 *
 * All functions return a ModerationResult indicating whether the content should be flagged,
 * the reason, and a severity level. Designed to be called synchronously in request handlers
 * and to never throw (returns a safe default on error).
 */

export type ModerationSeverity = "low" | "medium" | "high" | "critical";

export interface ModerationResult {
  flagged: boolean;
  reason: string | null;
  severity: ModerationSeverity;
}

const SAFE: ModerationResult = { flagged: false, reason: null, severity: "low" };

// ─── Pattern libraries ────────────────────────────────────────────────────────

// Crisis patterns (already detected elsewhere but included here for completeness)
const CRISIS_PATTERNS: Array<{ pattern: RegExp; severity: ModerationSeverity }> = [
  { pattern: /\b(suicide|suicid|me tuer|en finir)\b/i, severity: "critical" },
  { pattern: /\b(kill myself|kill my self)\b/i, severity: "critical" },
  // Arabic — no \b (word boundary doesn't work with Arabic script); no /u flag needed
  { pattern: /(انتحار|أقتل نفسي|أريد الموت)/, severity: "critical" },
  { pattern: /(نقتل روحي)/, severity: "critical" },
];

// Harassment patterns (threats, insults, bullying)
const HARASSMENT_PATTERNS: Array<{ pattern: RegExp; severity: ModerationSeverity }> = [
  { pattern: /\b(i(\'ll| will) (kill|hurt|destroy) you)\b/i, severity: "high" },
  { pattern: /\b(you('re| are) (worthless|pathetic|disgusting|stupid|idiot))\b/i, severity: "medium" },
  { pattern: /\b(go (kill|hurt) yourself)\b/i, severity: "high" },
  // Arabic harassment
  { pattern: /\b(اقتلك|سأقتلك|سأؤذيك|أنت تافه|أنت غبي)\b/i, severity: "high" },
];

// Solicitation / off-platform contact attempts
const SOLICITATION_PATTERNS: Array<{ pattern: RegExp; severity: ModerationSeverity }> = [
  // Phone / WhatsApp / Telegram sharing (trying to move off-platform)
  { pattern: /\b(\+216|\+33|\+1)[\s\-]?\d{2,}[\s\-]?\d{3,}/i, severity: "low" },
  { pattern: /\b(whatsapp|telegram|signal|viber)\b.*\d{6,}/i, severity: "medium" },
  // Email extraction
  { pattern: /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i, severity: "low" },
  // Explicit payment solicitation outside the platform
  { pattern: /\b(pay me|send money|virement|تحويل مال|ادفع لي)\b/i, severity: "medium" },
];

// Spam patterns (repeated content, promotional)
const SPAM_PATTERNS: Array<{ pattern: RegExp; severity: ModerationSeverity }> = [
  { pattern: /(.{5,})\1{3,}/i, severity: "low" },  // repeated substring 4+ times
  { pattern: /\b(buy now|click here|free offer|عرض مجاني|انقر هنا)\b/i, severity: "low" },
];

// Sexual content patterns (inappropriate for the platform)
const SEXUAL_PATTERNS: Array<{ pattern: RegExp; severity: ModerationSeverity }> = [
  { pattern: /\b(sex|porn|nude|naked|explicit)\b/i, severity: "high" },
  { pattern: /\b(جنس|إباحي|عاري)\b/i, severity: "high" },
];

type PatternGroup = {
  reason: string;
  patterns: Array<{ pattern: RegExp; severity: ModerationSeverity }>;
};

const ALL_GROUPS: PatternGroup[] = [
  { reason: "crisis_content", patterns: CRISIS_PATTERNS },
  { reason: "harassment", patterns: HARASSMENT_PATTERNS },
  { reason: "solicitation", patterns: SOLICITATION_PATTERNS },
  { reason: "spam", patterns: SPAM_PATTERNS },
  { reason: "sexual_content", patterns: SEXUAL_PATTERNS },
];

const SEVERITY_ORDER: Record<ModerationSeverity, number> = {
  low: 1, medium: 2, high: 3, critical: 4,
};

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Check text for policy violations. Returns a ModerationResult.
 * Never throws — returns SAFE on unexpected errors.
 */
export function moderateContent(text: string): ModerationResult {
  try {
    let worst: ModerationResult = SAFE;

    for (const group of ALL_GROUPS) {
      for (const { pattern, severity } of group.patterns) {
        if (pattern.test(text)) {
          if (SEVERITY_ORDER[severity] > SEVERITY_ORDER[worst.severity] || !worst.flagged) {
            worst = { flagged: true, reason: group.reason, severity };
          }
          if (severity === "critical") return worst; // short-circuit on critical
        }
      }
    }

    return worst;
  } catch {
    return SAFE;
  }
}
