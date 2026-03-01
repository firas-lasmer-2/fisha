import { z } from "zod";

// ---- Type definitions matching Supabase tables ----

export interface User {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  role: string;
  phone: string | null;
  publicKey: string | null;
  languagePreference: string | null;
  governorate: string | null;
  bio: string | null;
  isAnonymous: boolean | null;
  displayName: string | null;
  onboardingCompleted: boolean | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export type TherapistTier = "graduated_doctor" | "premium_doctor";

export interface TherapistProfile {
  id: number;
  userId: string;
  licenseNumber: string | null;
  specializations: string[] | null;
  languages: string[] | null;
  rateDinar: number | null;
  verified: boolean | null;
  rating: number | null;
  reviewCount: number | null;
  yearsExperience: number | null;
  education: string | null;
  approach: string | null;
  availableDays: string[] | null;
  availableHoursStart: string | null;
  availableHoursEnd: string | null;
  acceptsOnline: boolean | null;
  acceptsInPerson: boolean | null;
  officeAddress: string | null;
  gender: string | null;
  headline: string | null;
  aboutMe: string | null;
  videoIntroUrl: string | null;
  officePhotos: string[] | null;
  faqItems: any;
  socialLinks: any;
  slug: string | null;
  profileThemeColor: string | null;
  acceptingNewClients: boolean | null;
  tier: TherapistTier;
  badgeType: "verified" | "premium" | null;
  tierApprovedBy: string | null;
  tierApprovedAt: string | null;
  customBannerUrl: string | null;
  customCss: any;
  galleryImages: string[] | null;
  certifications: any;
  consultationIntro: string | null;
  landingPageEnabled: boolean | null;
  landingPageSections: any;
  landingPageCtaText: string | null;
  landingPageCtaUrl: string | null;
  createdAt: string | null;
  hasOpenSlots?: boolean;
}

export interface TherapistReview {
  id: number;
  therapistId: string;
  clientId: string;
  appointmentId: number | null;
  overallRating: number;
  helpfulnessRating: number | null;
  communicationRating: number | null;
  comment: string | null;
  therapistResponse: string | null;
  isAnonymous: boolean | null;
  createdAt: string | null;
}

export interface TherapyConversation {
  id: number;
  clientId: string;
  therapistId: string;
  status: string;
  encryptionKey: string | null;
  clientKeyEncrypted: string | null;
  therapistKeyEncrypted: string | null;
  keyVersion: number | null;
  lastMessageAt: string | null;
  createdAt: string | null;
}

export interface TherapyMessage {
  id: number;
  conversationId: number;
  senderId: string;
  content: string;
  messageType: string;
  isRead: boolean | null;
  createdAt: string | null;
}

export interface Appointment {
  id: number;
  clientId: string;
  therapistId: string;
  scheduledAt: string;
  durationMinutes: number | null;
  sessionType: string;
  status: string;
  notes: string | null;
  priceDinar: number | null;
  meetLink: string | null;
  createdAt: string | null;
}

export interface TherapistSlot {
  id: number;
  therapistId: string;
  startsAt: string;
  durationMinutes: number;
  priceDinar: number;
  status: string;
  appointmentId: number | null;
  meetLink: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface MoodEntry {
  id: number;
  userId: string;
  moodScore: number;
  emotions: string[] | null;
  notes: string | null;
  triggers: string[] | null;
  createdAt: string | null;
}

export interface JournalEntry {
  id: number;
  userId: string;
  title: string | null;
  content: string;
  promptId: number | null;
  mood: string | null;
  isSharedWithTherapist: boolean | null;
  createdAt: string | null;
}

export interface Resource {
  id: number;
  titleAr: string;
  titleFr: string;
  titleDarija: string | null;
  contentAr: string;
  contentFr: string;
  contentDarija: string | null;
  category: string;
  imageUrl: string | null;
  readTimeMinutes: number | null;
  createdAt: string | null;
}

export interface PaymentTransaction {
  id: number;
  clientId: string;
  therapistId: string;
  appointmentId: number | null;
  amountDinar: number;
  paymentMethod: string;
  status: string;
  externalRef: string | null;
  providerEventId: string | null;
  providerName: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CrisisReport {
  id: number;
  userId: string;
  severity: string;
  autoDetected: boolean | null;
  responderId: string | null;
  resolvedAt: string | null;
  createdAt: string | null;
}

export interface OnboardingResponse {
  id: number;
  userId: string;
  primaryConcerns: string[] | null;
  preferredLanguage: string | null;
  genderPreference: string | null;
  budgetRange: string | null;
  howDidYouHear: string | null;
  completedAt: string | null;
}

export interface FcmToken {
  id: number;
  userId: string;
  token: string;
  deviceType: string | null;
  createdAt: string | null;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  data: Record<string, string> | null;
  createdAt: string;
}

export function mapNotification(row: any): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body ?? null,
    read: row.read ?? false,
    data: row.data ?? null,
    createdAt: row.created_at,
  };
}

export const journeyRoleValues = ["visitor", "client", "therapist", "listener", "moderator", "admin"] as const;
export const journeyStageValues = ["discovery", "onboarding", "home", "continuation"] as const;
export const journeyStatusValues = ["draft", "active", "retired"] as const;
export const featureSurfaceValues = ["landing", "support", "welcome", "workflow", "dashboard", "nav", "settings", "other"] as const;
export const featureStatusValues = ["primary", "secondary", "experimental", "retired"] as const;
export const redirectReasonValues = ["retired", "merged", "renamed", "role-home-change"] as const;
export const redirectStatusValues = ["scheduled", "active", "disabled"] as const;
export const localizationAuditStatusValues = ["pending", "in_review", "approved", "blocked"] as const;
export const supportedEndUserLanguages = ["ar", "fr"] as const;

export type JourneyRole = (typeof journeyRoleValues)[number];
export type JourneyStage = (typeof journeyStageValues)[number];
export type JourneyStatus = (typeof journeyStatusValues)[number];
export type FeatureSurface = (typeof featureSurfaceValues)[number];
export type FeatureStatus = (typeof featureStatusValues)[number];
export type RedirectReason = (typeof redirectReasonValues)[number];
export type RedirectStatus = (typeof redirectStatusValues)[number];
export type SupportedEndUserLanguage = (typeof supportedEndUserLanguages)[number];
export type LocalizationAuditStatus = (typeof localizationAuditStatusValues)[number];

export interface JourneyPath {
  id: string;
  key: string;
  role: JourneyRole;
  stage: JourneyStage;
  labelKey: string;
  summaryKey: string | null;
  destinationPath: string;
  audienceDescription: string;
  status: JourneyStatus;
  supportsGuest: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface FeatureInventoryItem {
  id: string;
  featureKey: string;
  surface: FeatureSurface;
  routePath: string;
  destinationPath: string | null;
  goalKey: string;
  roleScope: JourneyRole[];
  status: FeatureStatus;
  labelKey: string;
  summaryKey: string | null;
  journeyPathId: string | null;
  replacementRoute: string | null;
  duplicateOfItemId: string | null;
  ownerUserId: string | null;
  userValueStatement: string;
  reviewNotes: string | null;
  lastReviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RedirectRule {
  id: string;
  sourcePath: string;
  targetPath: string;
  reason: RedirectReason;
  messageKey: string | null;
  roleScope: JourneyRole[];
  preserveQuery: boolean;
  status: RedirectStatus;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LocalizationAudit {
  id: string;
  routePath: string;
  language: SupportedEndUserLanguage;
  status: LocalizationAuditStatus;
  untranslatedCount: number;
  mixedCopyCount: number;
  fallbackCopyCount: number;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NavigationManifestEntry {
  id: string;
  featureKey: string;
  labelKey: string;
  summaryKey: string | null;
  href: string;
  goalKey: string;
  status: FeatureStatus;
}

export interface NavigationManifestResponse {
  role: JourneyRole;
  surface: FeatureSurface;
  primaryPaths: NavigationManifestEntry[];
  secondaryPaths: NavigationManifestEntry[];
  inventoryVersion: string;
}

export interface NavigationResolution {
  path: string;
  status: "direct" | "redirect" | "retired" | "missing";
  targetPath: string | null;
  reason: RedirectReason | null;
  messageKey: string | null;
}

export interface WorkflowHome {
  stage: JourneyStage;
  destinationPath: string;
  labelKey: string;
  summaryKey: string | null;
}

export interface WorkflowAction {
  id: string;
  labelKey: string;
  summaryKey: string | null;
  href: string;
  priority: "primary" | "secondary";
}

export function mapJourneyPath(row: any): JourneyPath {
  return {
    id: row.id,
    key: row.key,
    role: row.role,
    stage: row.stage,
    labelKey: row.label_key,
    summaryKey: row.summary_key ?? null,
    destinationPath: row.destination_path,
    audienceDescription: row.audience_description,
    status: row.status,
    supportsGuest: row.supports_guest ?? false,
    displayOrder: row.display_order ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapFeatureInventoryItem(row: any): FeatureInventoryItem {
  return {
    id: row.id,
    featureKey: row.feature_key,
    surface: row.surface,
    routePath: row.route_path,
    destinationPath: row.destination_path ?? null,
    goalKey: row.goal_key,
    roleScope: row.role_scope ?? [],
    status: row.status,
    labelKey: row.label_key,
    summaryKey: row.summary_key ?? null,
    journeyPathId: row.journey_path_id ?? null,
    replacementRoute: row.replacement_route ?? null,
    duplicateOfItemId: row.duplicate_of_item_id ?? null,
    ownerUserId: row.owner_user_id ?? null,
    userValueStatement: row.user_value_statement,
    reviewNotes: row.review_notes ?? null,
    lastReviewedAt: row.last_reviewed_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapRedirectRule(row: any): RedirectRule {
  return {
    id: row.id,
    sourcePath: row.source_path,
    targetPath: row.target_path,
    reason: row.reason,
    messageKey: row.message_key ?? null,
    roleScope: row.role_scope ?? [],
    preserveQuery: row.preserve_query ?? true,
    status: row.status,
    startsAt: row.starts_at ?? null,
    endsAt: row.ends_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapLocalizationAudit(row: any): LocalizationAudit {
  return {
    id: row.id,
    routePath: row.route_path,
    language: row.language,
    status: row.status,
    untranslatedCount: row.untranslated_count ?? 0,
    mixedCopyCount: row.mixed_copy_count ?? 0,
    fallbackCopyCount: row.fallback_copy_count ?? 0,
    reviewedByUserId: row.reviewed_by_user_id ?? null,
    reviewedAt: row.reviewed_at ?? null,
    notes: row.notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface ListenerProfile {
  userId: string;
  displayAlias: string | null;
  languages: string[] | null;
  topics: string[] | null;
  timezone: string | null;
  verificationStatus: string;
  activationStatus: string;
  trainingCompletedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  isAvailable: boolean;
  lastSeenAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  headline: string | null;
  aboutMe: string | null;
  avatarEmoji: string;
  totalSessions: number;
  averageRating: number | null;
}

export interface BrowsableListener {
  userId: string;
  displayAlias: string | null;
  headline: string | null;
  aboutMe: string | null;
  avatarEmoji: string;
  languages: string[] | null;
  topics: string[] | null;
  isAvailable: boolean;
  totalSessions: number;
  averageRating: number | null;
  level: number;
  trophyTier: "gold" | "silver" | "bronze" | null;
  certificationTitle: string | null;
}

export interface ListenerProgress {
  listenerId: string;
  points: number;
  level: number;
  sessionsRatedCount: number;
  currentStreak: number;
  longestStreak: number;
  endorsementsCount: number;
  lastCalculatedAt: string | null;
}

export interface ListenerPointsLedger {
  id: number;
  listenerId: string;
  sessionId: number | null;
  eventType: string;
  delta: number;
  meta: any;
  createdAt: string | null;
}

export interface ListenerBadge {
  id: number;
  listenerId: string;
  badgeKey: string;
  title: string;
  description: string | null;
  awardedAt: string;
  meta: any;
}

export interface ListenerEndorsement {
  id: number;
  listenerId: string;
  sessionId: number | null;
  quote: string;
  warmthScore: number | null;
  createdAt: string;
}

export interface ListenerWellbeingCheckIn {
  id: number;
  listenerId: string;
  sessionId: number | null;
  stressLevel: number;
  emotionalLoad: number;
  needsBreak: boolean;
  notes: string | null;
  createdAt: string;
}

export interface ListenerCooldown {
  listenerId: string;
  sourceSessionId: number | null;
  reason: string;
  startsAt: string;
  endsAt: string;
  releasedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListenerHallOfFameEntry {
  id: number;
  seasonKey: string;
  rank: number;
  listenerId: string;
  displayName: string;
  points: number;
  averageRating: number;
  ratingCount: number;
  positiveStreak: number;
  trophyTier: "gold" | "silver" | "bronze" | null;
  certificationTitle: string | null;
  archivedAt: string;
  certificateIssuedAt: string | null;
  certificateCode: string | null;
}

export interface ListenerApplication {
  id: number;
  userId: string;
  motivation: string | null;
  relevantExperience: string | null;
  languages: string[] | null;
  topics: string[] | null;
  weeklyHours: number | null;
  status: string;
  moderationNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ListenerQueueEntry {
  id: number;
  clientId: string;
  preferredLanguage: string | null;
  topicTags: string[] | null;
  status: string;
  matchedListenerId: string | null;
  sessionId: number | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface PeerSession {
  id: number;
  clientId: string;
  listenerId: string;
  queueEntryId: number | null;
  status: string;
  anonymousAliasClient: string | null;
  anonymousAliasListener: string | null;
  escalatedToCrisis: boolean | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string | null;
}

export interface PeerMessage {
  id: number;
  sessionId: number;
  senderId: string;
  content: string;
  encrypted: boolean | null;
  isFlagged: boolean | null;
  createdAt: string | null;
}

export interface PeerSessionFeedback {
  id: number;
  sessionId: number;
  clientId: string;
  listenerId: string;
  rating: number;
  tags: string[] | null;
  comment: string | null;
  createdAt: string | null;
}

export interface PeerReport {
  id: number;
  sessionId: number | null;
  reporterId: string;
  targetUserId: string | null;
  reason: string;
  details: string | null;
  severity: string;
  moderationStatus: string;
  resolvedBy: string | null;
  resolvedAt: string | null;
  penaltyApplied: boolean | null;
  createdAt: string | null;
}

// ---- Zod insert schemas for API validation ----

export const insertJourneyPathSchema = z.object({
  key: z.string().min(1),
  role: z.enum(journeyRoleValues),
  stage: z.enum(journeyStageValues),
  labelKey: z.string().min(1),
  summaryKey: z.string().optional().nullable(),
  destinationPath: z.string().min(1),
  audienceDescription: z.string().min(1),
  status: z.enum(journeyStatusValues).default("draft"),
  supportsGuest: z.boolean().default(false),
  displayOrder: z.number().int().default(0),
});

export const insertFeatureInventoryItemSchema = z.object({
  featureKey: z.string().min(1),
  surface: z.enum(featureSurfaceValues),
  routePath: z.string().min(1),
  destinationPath: z.string().min(1).optional().nullable(),
  goalKey: z.string().min(1),
  roleScope: z.array(z.enum(journeyRoleValues)).default([]),
  status: z.enum(featureStatusValues).default("secondary"),
  labelKey: z.string().min(1),
  summaryKey: z.string().optional().nullable(),
  journeyPathId: z.string().uuid().optional().nullable(),
  replacementRoute: z.string().optional().nullable(),
  duplicateOfItemId: z.string().uuid().optional().nullable(),
  ownerUserId: z.string().uuid().optional().nullable(),
  userValueStatement: z.string().min(1),
  reviewNotes: z.string().optional().nullable(),
  lastReviewedAt: z.string().optional().nullable(),
});

export const updateFeatureInventoryItemSchema = insertFeatureInventoryItemSchema.partial();

export const insertRedirectRuleSchema = z.object({
  sourcePath: z.string().min(1),
  targetPath: z.string().min(1),
  reason: z.enum(redirectReasonValues),
  messageKey: z.string().optional().nullable(),
  roleScope: z.array(z.enum(journeyRoleValues)).default([]),
  preserveQuery: z.boolean().default(true),
  status: z.enum(redirectStatusValues).default("scheduled"),
  startsAt: z.string().optional().nullable(),
  endsAt: z.string().optional().nullable(),
});

export const insertLocalizationAuditSchema = z.object({
  routePath: z.string().min(1),
  language: z.enum(supportedEndUserLanguages),
  status: z.enum(localizationAuditStatusValues).default("pending"),
  untranslatedCount: z.number().int().nonnegative().default(0),
  mixedCopyCount: z.number().int().nonnegative().default(0),
  fallbackCopyCount: z.number().int().nonnegative().default(0),
  reviewedByUserId: z.string().uuid().optional().nullable(),
  reviewedAt: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const updateLocalizationAuditSchema = insertLocalizationAuditSchema.partial();

export const localizationAuditRunSchema = z.object({
  routes: z.array(z.string().min(1)).min(1),
  languages: z.array(z.enum(supportedEndUserLanguages)).min(1),
});

export const insertUserSchema = z.object({
  email: z.string().email().optional().nullable(),
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  profileImageUrl: z.string().optional().nullable(),
  role: z.string().default("client").optional(),
  phone: z.string().optional().nullable(),
  publicKey: z.string().optional().nullable(),
  languagePreference: z.string().default("ar").optional(),
  governorate: z.string().optional().nullable(),
  bio: z.string().optional().nullable(),
  isAnonymous: z.boolean().default(false).optional(),
  displayName: z.string().min(3).max(30).regex(/^[a-zA-Z0-9\u0600-\u06FF_]+$/).optional().nullable(),
});

export const insertTherapistProfileSchema = z.object({
  userId: z.string(),
  licenseNumber: z.string().optional().nullable(),
  specializations: z.array(z.string()).optional().nullable(),
  languages: z.array(z.string()).optional().nullable(),
  rateDinar: z.number().default(80).optional(),
  verified: z.boolean().default(false).optional(),
  yearsExperience: z.number().default(0).optional(),
  education: z.string().optional().nullable(),
  approach: z.string().optional().nullable(),
  availableDays: z.array(z.string()).optional().nullable(),
  availableHoursStart: z.string().default("09:00").optional(),
  availableHoursEnd: z.string().default("17:00").optional(),
  acceptsOnline: z.boolean().default(true).optional(),
  acceptsInPerson: z.boolean().default(false).optional(),
  officeAddress: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  headline: z.string().optional().nullable(),
  aboutMe: z.string().optional().nullable(),
  videoIntroUrl: z.string().optional().nullable(),
  officePhotos: z.array(z.string()).optional().nullable(),
  faqItems: z.any().optional().nullable(),
  socialLinks: z.any().optional().nullable(),
  slug: z.string().optional().nullable(),
  profileThemeColor: z.string().optional().nullable(),
  acceptingNewClients: z.boolean().default(true).optional(),
  tier: z.enum(["graduated_doctor", "premium_doctor"]).default("premium_doctor").optional(),
  tierApprovedBy: z.string().optional().nullable(),
  tierApprovedAt: z.string().optional().nullable(),
  badgeType: z.enum(["verified", "premium"]).optional().nullable(),
  customBannerUrl: z.string().optional().nullable(),
  customCss: z.any().optional().nullable(),
  galleryImages: z.array(z.string()).optional().nullable(),
  certifications: z.any().optional().nullable(),
  consultationIntro: z.string().optional().nullable(),
  landingPageEnabled: z.boolean().default(false).optional(),
  landingPageSections: z.any().optional().nullable(),
  landingPageCtaText: z.string().max(80).optional().nullable(),
  landingPageCtaUrl: z.string().max(255).optional().nullable(),
});

export const insertAppointmentSchema = z.object({
  clientId: z.string(),
  therapistId: z.string(),
  scheduledAt: z.string(),
  durationMinutes: z.number().default(50).optional(),
  sessionType: z.string().default("chat").optional(),
  status: z.string().default("pending").optional(),
  notes: z.string().optional().nullable(),
  priceDinar: z.number().optional().nullable(),
});

export const insertTherapistSlotSchema = z.object({
  therapistId: z.string(),
  startsAt: z.string(),
  durationMinutes: z.number().int().positive(),
  priceDinar: z.number().nonnegative(),
  status: z.string().default("open").optional(),
  appointmentId: z.number().optional().nullable(),
  meetLink: z.string().optional().nullable(),
});

export const insertMoodEntrySchema = z.object({
  userId: z.string(),
  moodScore: z.number(),
  emotions: z.array(z.string()).optional().nullable(),
  notes: z.string().optional().nullable(),
  triggers: z.array(z.string()).optional().nullable(),
});

export const insertJournalEntrySchema = z.object({
  userId: z.string(),
  title: z.string().optional().nullable(),
  content: z.string(),
  promptId: z.number().optional().nullable(),
  mood: z.string().optional().nullable(),
  isSharedWithTherapist: z.boolean().default(false).optional(),
});

export const insertTherapyMessageSchema = z.object({
  conversationId: z.number(),
  senderId: z.string(),
  content: z.string(),
  messageType: z.string().default("text").optional(),
});

export const insertTherapyConversationSchema = z.object({
  clientId: z.string(),
  therapistId: z.string(),
  status: z.string().default("active").optional(),
  clientKeyEncrypted: z.string().optional().nullable(),
  therapistKeyEncrypted: z.string().optional().nullable(),
  keyVersion: z.number().default(1).optional(),
});

export const insertResourceSchema = z.object({
  titleAr: z.string(),
  titleFr: z.string(),
  titleDarija: z.string().optional().nullable(),
  contentAr: z.string(),
  contentFr: z.string(),
  contentDarija: z.string().optional().nullable(),
  category: z.string(),
  imageUrl: z.string().optional().nullable(),
  readTimeMinutes: z.number().default(5).optional(),
});

export const insertTherapistReviewSchema = z.object({
  therapistId: z.string(),
  clientId: z.string(),
  appointmentId: z.number().optional().nullable(),
  overallRating: z.number(),
  helpfulnessRating: z.number().optional().nullable(),
  communicationRating: z.number().optional().nullable(),
  comment: z.string().optional().nullable(),
  therapistResponse: z.string().optional().nullable(),
  isAnonymous: z.boolean().default(true).optional(),
});

export const insertOnboardingResponseSchema = z.object({
  userId: z.string(),
  primaryConcerns: z.array(z.string()).optional().nullable(),
  preferredLanguage: z.string().optional().nullable(),
  genderPreference: z.string().optional().nullable(),
  budgetRange: z.string().optional().nullable(),
  howDidYouHear: z.string().optional().nullable(),
});

export const insertCrisisReportSchema = z.object({
  userId: z.string(),
  severity: z.string().default("medium").optional(),
  autoDetected: z.boolean().default(false).optional(),
});

export const insertPaymentTransactionSchema = z.object({
  clientId: z.string(),
  therapistId: z.string(),
  appointmentId: z.number().optional().nullable(),
  amountDinar: z.number(),
  paymentMethod: z.string(),
  status: z.string().default("pending").optional(),
  externalRef: z.string().optional().nullable(),
  providerEventId: z.string().optional().nullable(),
  providerName: z.string().optional().nullable(),
});

export const insertListenerProfileSchema = z.object({
  userId: z.string(),
  displayAlias: z.string().optional().nullable(),
  languages: z.array(z.string()).optional().nullable(),
  topics: z.array(z.string()).optional().nullable(),
  timezone: z.string().optional().nullable(),
  verificationStatus: z.string().default("pending").optional(),
  activationStatus: z.string().default("inactive").optional(),
  trainingCompletedAt: z.string().optional().nullable(),
  approvedBy: z.string().optional().nullable(),
  approvedAt: z.string().optional().nullable(),
  isAvailable: z.boolean().default(false).optional(),
  headline: z.string().max(120).optional().nullable(),
  aboutMe: z.string().max(2000).optional().nullable(),
  avatarEmoji: z.string().max(10).optional(),
});

export const insertListenerProgressSchema = z.object({
  listenerId: z.string(),
  points: z.number().int().default(0).optional(),
  level: z.number().int().default(1).optional(),
  sessionsRatedCount: z.number().int().default(0).optional(),
  currentStreak: z.number().int().default(0).optional(),
  longestStreak: z.number().int().default(0).optional(),
  endorsementsCount: z.number().int().default(0).optional(),
  lastCalculatedAt: z.string().optional().nullable(),
});

export const insertListenerPointsLedgerSchema = z.object({
  listenerId: z.string(),
  sessionId: z.number().optional().nullable(),
  eventType: z.string(),
  delta: z.number().int(),
  meta: z.any().optional().nullable(),
});

export const insertListenerBadgeSchema = z.object({
  listenerId: z.string(),
  badgeKey: z.string().max(60),
  title: z.string().max(120),
  description: z.string().optional().nullable(),
  awardedAt: z.string().optional(),
  meta: z.any().optional().nullable(),
});

export const insertListenerEndorsementSchema = z.object({
  listenerId: z.string(),
  sessionId: z.number().optional().nullable(),
  quote: z.string().min(3).max(280),
  warmthScore: z.number().int().min(1).max(5).optional().nullable(),
});

export const insertListenerWellbeingCheckInSchema = z.object({
  listenerId: z.string(),
  sessionId: z.number().optional().nullable(),
  stressLevel: z.number().int().min(1).max(5),
  emotionalLoad: z.number().int().min(1).max(5),
  needsBreak: z.boolean().default(false).optional(),
  notes: z.string().max(1200).optional().nullable(),
});

export const insertListenerCooldownSchema = z.object({
  listenerId: z.string(),
  sourceSessionId: z.number().optional().nullable(),
  reason: z.string().max(60),
  startsAt: z.string().optional(),
  endsAt: z.string(),
  releasedAt: z.string().optional().nullable(),
});

export const insertListenerApplicationSchema = z.object({
  userId: z.string(),
  motivation: z.string().optional().nullable(),
  relevantExperience: z.string().optional().nullable(),
  languages: z.array(z.string()).optional().nullable(),
  topics: z.array(z.string()).optional().nullable(),
  weeklyHours: z.number().optional().nullable(),
  status: z.string().default("pending").optional(),
  moderationNotes: z.string().optional().nullable(),
  reviewedBy: z.string().optional().nullable(),
  reviewedAt: z.string().optional().nullable(),
});

export const insertListenerQueueEntrySchema = z.object({
  clientId: z.string(),
  preferredLanguage: z.string().optional().nullable(),
  topicTags: z.array(z.string()).optional().nullable(),
  status: z.string().default("waiting").optional(),
});

export const insertPeerSessionSchema = z.object({
  clientId: z.string(),
  listenerId: z.string(),
  queueEntryId: z.number().optional().nullable(),
  status: z.string().default("active").optional(),
  anonymousAliasClient: z.string().optional().nullable(),
  anonymousAliasListener: z.string().optional().nullable(),
  escalatedToCrisis: z.boolean().default(false).optional(),
  startedAt: z.string().optional().nullable(),
  endedAt: z.string().optional().nullable(),
});

export const insertPeerMessageSchema = z.object({
  sessionId: z.number(),
  senderId: z.string(),
  content: z.string(),
  encrypted: z.boolean().default(false).optional(),
  isFlagged: z.boolean().default(false).optional(),
});

export const insertPeerSessionFeedbackSchema = z.object({
  sessionId: z.number(),
  clientId: z.string(),
  listenerId: z.string(),
  rating: z.number().min(1).max(5),
  tags: z.array(z.string()).optional().nullable(),
  comment: z.string().optional().nullable(),
});

export const insertPeerReportSchema = z.object({
  sessionId: z.number().optional().nullable(),
  reporterId: z.string(),
  targetUserId: z.string().optional().nullable(),
  reason: z.string(),
  details: z.string().optional().nullable(),
  severity: z.string().default("medium").optional(),
  moderationStatus: z.string().default("open").optional(),
  resolvedBy: z.string().optional().nullable(),
  resolvedAt: z.string().optional().nullable(),
});

// ---- Therapist Verification ----

export interface TherapistVerification {
  id: number;
  therapistId: string;
  documentType: string;
  documentUrl: string;
  status: "pending" | "approved" | "rejected";
  reviewerId: string | null;
  reviewerNotes: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  slaDeadline: string | null;
  priority: "normal" | "urgent" | "low";
}

export const insertTherapistVerificationSchema = z.object({
  therapistId: z.string(),
  documentType: z.enum(["license", "diploma", "id_card", "cv"]),
  documentUrl: z.string().url(),
});

export type InsertTherapistVerification = z.infer<typeof insertTherapistVerificationSchema>;

export function mapTherapistVerification(row: any): TherapistVerification {
  return {
    id: row.id,
    therapistId: row.therapist_id,
    documentType: row.document_type,
    documentUrl: row.document_url,
    status: row.status,
    reviewerId: row.reviewer_id,
    reviewerNotes: row.reviewer_notes,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    slaDeadline: row.sla_deadline ?? null,
    priority: row.priority ?? "normal",
  };
}

// ---- Insert types ----

export type InsertJourneyPath = z.infer<typeof insertJourneyPathSchema>;
export type InsertFeatureInventoryItem = z.infer<typeof insertFeatureInventoryItemSchema>;
export type UpdateFeatureInventoryItem = z.infer<typeof updateFeatureInventoryItemSchema>;
export type InsertRedirectRule = z.infer<typeof insertRedirectRuleSchema>;
export type InsertLocalizationAudit = z.infer<typeof insertLocalizationAuditSchema>;
export type UpdateLocalizationAudit = z.infer<typeof updateLocalizationAuditSchema>;
export type RunLocalizationAuditRequest = z.infer<typeof localizationAuditRunSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertTherapistProfile = z.infer<typeof insertTherapistProfileSchema>;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type InsertTherapistSlot = z.infer<typeof insertTherapistSlotSchema>;
export type InsertMoodEntry = z.infer<typeof insertMoodEntrySchema>;
export type InsertJournalEntry = z.infer<typeof insertJournalEntrySchema>;
export type InsertTherapyMessage = z.infer<typeof insertTherapyMessageSchema>;
export type InsertTherapyConversation = z.infer<typeof insertTherapyConversationSchema>;
export type InsertResource = z.infer<typeof insertResourceSchema>;
export type InsertTherapistReview = z.infer<typeof insertTherapistReviewSchema>;
export type InsertOnboardingResponse = z.infer<typeof insertOnboardingResponseSchema>;
export type InsertCrisisReport = z.infer<typeof insertCrisisReportSchema>;
export type InsertPaymentTransaction = z.infer<typeof insertPaymentTransactionSchema>;
export type InsertListenerProfile = z.infer<typeof insertListenerProfileSchema>;
export type InsertListenerProgress = z.infer<typeof insertListenerProgressSchema>;
export type InsertListenerPointsLedger = z.infer<typeof insertListenerPointsLedgerSchema>;
export type InsertListenerBadge = z.infer<typeof insertListenerBadgeSchema>;
export type InsertListenerEndorsement = z.infer<typeof insertListenerEndorsementSchema>;
export type InsertListenerWellbeingCheckIn = z.infer<typeof insertListenerWellbeingCheckInSchema>;
export type InsertListenerCooldown = z.infer<typeof insertListenerCooldownSchema>;
export type InsertListenerApplication = z.infer<typeof insertListenerApplicationSchema>;
export type InsertListenerQueueEntry = z.infer<typeof insertListenerQueueEntrySchema>;
export type InsertPeerSession = z.infer<typeof insertPeerSessionSchema>;
export type InsertPeerMessage = z.infer<typeof insertPeerMessageSchema>;
export type InsertPeerSessionFeedback = z.infer<typeof insertPeerSessionFeedbackSchema>;
export type InsertPeerReport = z.infer<typeof insertPeerReportSchema>;

// ---- Progress tracking types (Phase 3.3) ----

export interface TreatmentGoal {
  id: number;
  userId: string;
  title: string;
  description: string | null;
  targetDate: string | null;
  status: "active" | "completed" | "abandoned";
  progressPct: number;
  createdAt: string;
  updatedAt: string;
}

export const insertTreatmentGoalSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  targetDate: z.string().optional().nullable(),
  progressPct: z.number().int().min(0).max(100).default(0),
});

export const updateTreatmentGoalSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  targetDate: z.string().optional().nullable(),
  status: z.enum(["active", "completed", "abandoned"]).optional(),
  progressPct: z.number().int().min(0).max(100).optional(),
});

export type InsertTreatmentGoal = z.infer<typeof insertTreatmentGoalSchema>;
export type UpdateTreatmentGoal = z.infer<typeof updateTreatmentGoalSchema>;

export function mapTreatmentGoal(row: any): TreatmentGoal {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    targetDate: row.target_date,
    status: row.status,
    progressPct: row.progress_pct,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface SessionSummary {
  id: number;
  appointmentId: number;
  therapistId: string;
  clientId: string;
  keyTopics: string[] | null;
  homework: string | null;
  therapistNotes: string | null;
  clientVisible: boolean;
  createdAt: string;
  updatedAt: string;
}

export const upsertSessionSummarySchema = z.object({
  keyTopics: z.array(z.string().max(200)).max(20).optional().nullable(),
  homework: z.string().max(2000).optional().nullable(),
  therapistNotes: z.string().max(5000).optional().nullable(),
  clientVisible: z.boolean().default(false),
});

export type UpsertSessionSummary = z.infer<typeof upsertSessionSummarySchema>;

export function mapSessionSummary(row: any): SessionSummary {
  return {
    id: row.id,
    appointmentId: row.appointment_id,
    therapistId: row.therapist_id,
    clientId: row.client_id,
    keyTopics: row.key_topics,
    homework: row.homework,
    therapistNotes: row.therapist_notes,
    clientVisible: row.client_visible,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---- Phase 6: Post-session features ----

// Session Homework
export interface SessionHomework {
  id: number;
  summaryId: number;
  description: string;
  dueDate: string | null;
  completed: boolean;
  completedAt: string | null;
  clientNotes: string | null;
  createdAt: string;
}

export const insertHomeworkSchema = z.object({
  description: z.string().min(1).max(1000),
  dueDate: z.string().optional().nullable(),
});

export const updateHomeworkSchema = z.object({
  completed: z.boolean().optional(),
  clientNotes: z.string().max(1000).optional().nullable(),
});

export type InsertHomework = z.infer<typeof insertHomeworkSchema>;
export type UpdateHomework = z.infer<typeof updateHomeworkSchema>;

export function mapSessionHomework(row: any): SessionHomework {
  return {
    id: row.id,
    summaryId: row.summary_id,
    description: row.description,
    dueDate: row.due_date,
    completed: row.completed,
    completedAt: row.completed_at,
    clientNotes: row.client_notes,
    createdAt: row.created_at,
  };
}

// Session Mood Rating
export interface SessionMoodRating {
  id: number;
  appointmentId: number;
  clientId: string;
  preSessionMood: number | null;
  postSessionMood: number | null;
  createdAt: string;
  updatedAt: string;
}

export const upsertMoodRatingSchema = z.object({
  preSessionMood: z.number().int().min(1).max(5).optional().nullable(),
  postSessionMood: z.number().int().min(1).max(5).optional().nullable(),
});

export type UpsertMoodRating = z.infer<typeof upsertMoodRatingSchema>;

export function mapSessionMoodRating(row: any): SessionMoodRating {
  return {
    id: row.id,
    appointmentId: row.appointment_id,
    clientId: row.client_id,
    preSessionMood: row.pre_session_mood,
    postSessionMood: row.post_session_mood,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Consultation Prep
export interface ConsultationPrep {
  id: number;
  appointmentId: number;
  clientId: string;
  whatsOnMind: string;
  goalsForSession: string | null;
  currentMood: number | null;
  createdAt: string;
  updatedAt: string;
}

export const upsertConsultationPrepSchema = z.object({
  whatsOnMind: z.string().min(1).max(2000),
  goalsForSession: z.string().max(1000).optional().nullable(),
  currentMood: z.number().int().min(1).max(5).optional().nullable(),
});

export type UpsertConsultationPrep = z.infer<typeof upsertConsultationPrepSchema>;

export function mapConsultationPrep(row: any): ConsultationPrep {
  return {
    id: row.id,
    appointmentId: row.appointment_id,
    clientId: row.client_id,
    whatsOnMind: row.whats_on_mind,
    goalsForSession: row.goals_for_session,
    currentMood: row.current_mood,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---- Tier Upgrade Requests (Phase 7) ----

export interface TierUpgradeRequest {
  id: number;
  doctorId: string;
  currentTier: string;
  requestedTier: string;
  portfolioUrl: string | null;
  justification: string | null;
  status: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export const createTierUpgradeRequestSchema = z.object({
  portfolioUrl: z.string().url().optional().nullable(),
  justification: z.string().max(2000).optional().nullable(),
});

export const reviewTierUpgradeRequestSchema = z.object({
  status: z.enum(["approved", "rejected"]),
});

export type CreateTierUpgradeRequest = z.infer<typeof createTierUpgradeRequestSchema>;
export type ReviewTierUpgradeRequest = z.infer<typeof reviewTierUpgradeRequestSchema>;

export function mapTierUpgradeRequest(row: any): TierUpgradeRequest {
  return {
    id: row.id,
    doctorId: row.doctor_id,
    currentTier: row.current_tier,
    requestedTier: row.requested_tier,
    portfolioUrl: row.portfolio_url ?? null,
    justification: row.justification ?? null,
    status: row.status,
    reviewedBy: row.reviewed_by ?? null,
    reviewedAt: row.reviewed_at ?? null,
    createdAt: row.created_at,
  };
}

// ---- Therapist Google Token (metadata only — never expose raw tokens) ----

export interface TherapistGoogleToken {
  therapistId: string;
  expiresAt: string | null;
  connectedAt: string | null;
}

export function mapTherapistGoogleToken(row: any): TherapistGoogleToken {
  return {
    therapistId: row.therapist_id,
    expiresAt: row.expires_at ?? null,
    connectedAt: row.connected_at ?? null,
  };
}

// ---- Listener Qualification Test ----

export interface ListenerQualificationTest {
  id: number;
  userId: string;
  score: number;
  passed: boolean;
  answers: any;
  attemptedAt: string | null;
}

export const submitQualificationTestSchema = z.object({
  answers: z.record(z.string(), z.string()),
});

export type SubmitQualificationTest = z.infer<typeof submitQualificationTestSchema>;

export function mapListenerQualificationTest(row: any): ListenerQualificationTest {
  return {
    id: row.id,
    userId: row.user_id,
    score: row.score,
    passed: row.passed,
    answers: row.answers,
    attemptedAt: row.attempted_at,
  };
}

// ---- Doctor Payout ----

export interface DoctorPayout {
  id: number;
  doctorId: string;
  periodStart: string;
  periodEnd: string;
  totalSessions: number;
  totalAmountDinar: number;
  platformFeeDinar: number;
  netAmountDinar: number;
  status: "pending" | "processing" | "paid" | "failed";
  paidAt: string | null;
  createdAt: string | null;
}

export function mapDoctorPayout(row: any): DoctorPayout {
  return {
    id: row.id,
    doctorId: row.doctor_id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    totalSessions: row.total_sessions,
    totalAmountDinar: row.total_amount_dinar,
    platformFeeDinar: row.platform_fee_dinar,
    netAmountDinar: row.net_amount_dinar,
    status: row.status,
    paidAt: row.paid_at ?? null,
    createdAt: row.created_at ?? null,
  };
}

// ---- Audit log type ----

export interface AuditLog {
  id: number;
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

export function mapAuditLog(row: any): AuditLog {
  return {
    id: row.id,
    actorId: row.actor_id,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    metadata: row.metadata,
    ipAddress: row.ip_address,
    createdAt: row.created_at,
  };
}

// ---- API request validation schemas (used by server middleware) ----

export const signupRequestSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["client", "listener"]).default("client"),
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  phone: z.string().optional(),
});

export const loginRequestSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const otpRequestSchema = z.object({
  phone: z.string().min(8, "Valid phone number required"),
});

export const verifyOtpRequestSchema = z.object({
  phone: z.string().min(8),
  token: z.string().min(4).max(10),
});

export const sendMessageRequestSchema = z.object({
  content: z.string().min(1).max(10000),
  messageType: z.string().default("text").optional(),
  crisisDetectedByClient: z.boolean().optional(),
  encrypted: z.boolean().optional(),
});

export const moodEntryRequestSchema = z.object({
  moodScore: z.number().int().min(1).max(5),
  emotions: z.array(z.string()).optional(),
  notes: z.string().max(2000).optional(),
  triggers: z.array(z.string()).optional(),
});

export const journalEntryRequestSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().min(1).max(20000),
  mood: z.string().optional(),
  isSharedWithTherapist: z.boolean().default(false).optional(),
});

export const onboardingRequestSchema = z.object({
  primaryConcerns: z.array(z.string()).optional(),
  preferredLanguage: z.string().optional(),
  genderPreference: z.string().optional(),
  budgetRange: z.string().optional(),
  howDidYouHear: z.string().optional(),
  displayName: z.string().min(3).max(30).regex(/^[a-zA-Z0-9\u0600-\u06FF_]+$/).optional(),
  starterPath: z.string().optional(),
  onboardingCompleted: z.boolean().optional(),
});

export const reviewRequestSchema = z.object({
  overallRating: z.number().int().min(1).max(5),
  helpfulnessRating: z.number().int().min(1).max(5).optional(),
  communicationRating: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(2000).optional(),
  isAnonymous: z.boolean().default(true).optional(),
  appointmentId: z.number().optional(),
});

export const slotCreateRequestSchema = z.object({
  startsAt: z.string().datetime({ message: "Must be ISO 8601 datetime" }),
  durationMinutes: z.number().int().min(15).max(180),
  priceDinar: z.number().nonnegative().max(1000),
  meetLink: z.string().url().optional().nullable(),
});

export const paymentInitiateRequestSchema = z.object({
  appointmentId: z.number().int().positive(),
  therapistId: z.string().uuid(),
  amount: z.number().positive().max(1000),
});

export const queueJoinRequestSchema = z.object({
  preferredLanguage: z.string().optional(),
  topicTags: z.array(z.string()).optional(),
});

export const peerMessageRequestSchema = z.object({
  content: z.string().min(1).max(5000),
});


// ---- Helper: map snake_case DB row to camelCase TS object ----

export function mapProfile(row: any): User {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    profileImageUrl: row.profile_image_url,
    role: row.role || "client",
    phone: row.phone,
    publicKey: row.public_key,
    languagePreference: row.language_preference,
    governorate: row.governorate,
    bio: row.bio,
    isAnonymous: row.is_anonymous,
    displayName: row.display_name ?? null,
    onboardingCompleted: row.onboarding_completed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapTherapistProfile(row: any): TherapistProfile {
  return {
    id: row.id,
    userId: row.user_id,
    licenseNumber: row.license_number,
    specializations: row.specializations,
    languages: row.languages,
    rateDinar: row.rate_dinar,
    verified: row.verified,
    rating: row.rating,
    reviewCount: row.review_count,
    yearsExperience: row.years_experience,
    education: row.education,
    approach: row.approach,
    availableDays: row.available_days,
    availableHoursStart: row.available_hours_start,
    availableHoursEnd: row.available_hours_end,
    acceptsOnline: row.accepts_online,
    acceptsInPerson: row.accepts_in_person,
    officeAddress: row.office_address,
    gender: row.gender,
    headline: row.headline,
    aboutMe: row.about_me,
    videoIntroUrl: row.video_intro_url,
    officePhotos: row.office_photos,
    faqItems: row.faq_items,
    socialLinks: row.social_links,
    slug: row.slug,
    profileThemeColor: row.profile_theme_color,
    acceptingNewClients: row.accepting_new_clients,
    tier: row.tier || "premium_doctor",
    badgeType: row.badge_type ?? null,
    tierApprovedBy: row.tier_approved_by,
    tierApprovedAt: row.tier_approved_at,
    customBannerUrl: row.custom_banner_url ?? null,
    customCss: row.custom_css ?? null,
    galleryImages: row.gallery_images ?? null,
    certifications: row.certifications ?? null,
    consultationIntro: row.consultation_intro ?? null,
    landingPageEnabled: row.landing_page_enabled ?? null,
    landingPageSections: row.landing_page_sections ?? [],
    landingPageCtaText: row.landing_page_cta_text ?? null,
    landingPageCtaUrl: row.landing_page_cta_url ?? null,
    createdAt: row.created_at,
  };
}

export function mapTherapistReview(row: any): TherapistReview {
  return {
    id: row.id,
    therapistId: row.therapist_id,
    clientId: row.client_id,
    appointmentId: row.appointment_id,
    overallRating: row.overall_rating,
    helpfulnessRating: row.helpfulness_rating,
    communicationRating: row.communication_rating,
    comment: row.comment,
    therapistResponse: row.therapist_response,
    isAnonymous: row.is_anonymous,
    createdAt: row.created_at,
  };
}

export function mapConversation(row: any): TherapyConversation {
  return {
    id: row.id,
    clientId: row.client_id,
    therapistId: row.therapist_id,
    status: row.status,
    encryptionKey: row.encryption_key,
    clientKeyEncrypted: row.client_key_encrypted,
    therapistKeyEncrypted: row.therapist_key_encrypted,
    keyVersion: row.key_version,
    lastMessageAt: row.last_message_at,
    createdAt: row.created_at,
  };
}

export function mapMessage(row: any): TherapyMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    content: row.content,
    messageType: row.message_type,
    isRead: row.is_read,
    createdAt: row.created_at,
  };
}

export function mapAppointment(row: any): Appointment {
  return {
    id: row.id,
    clientId: row.client_id,
    therapistId: row.therapist_id,
    scheduledAt: row.scheduled_at,
    durationMinutes: row.duration_minutes,
    sessionType: row.session_type,
    status: row.status,
    notes: row.notes,
    priceDinar: row.price_dinar,
    meetLink: row.meet_link ?? null,
    createdAt: row.created_at,
  };
}

export function mapTherapistSlot(row: any): TherapistSlot {
  return {
    id: row.id,
    therapistId: row.therapist_id,
    startsAt: row.starts_at,
    durationMinutes: row.duration_minutes,
    priceDinar: row.price_dinar,
    status: row.status,
    appointmentId: row.appointment_id,
    meetLink: row.meet_link ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapMoodEntry(row: any): MoodEntry {
  return {
    id: row.id,
    userId: row.user_id,
    moodScore: row.mood_score,
    emotions: row.emotions,
    notes: row.notes,
    triggers: row.triggers,
    createdAt: row.created_at,
  };
}

export function mapJournalEntry(row: any): JournalEntry {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    content: row.content,
    promptId: row.prompt_id,
    mood: row.mood,
    isSharedWithTherapist: row.is_shared_with_therapist,
    createdAt: row.created_at,
  };
}

export function mapResource(row: any): Resource {
  return {
    id: row.id,
    titleAr: row.title_ar,
    titleFr: row.title_fr,
    titleDarija: row.title_darija,
    contentAr: row.content_ar,
    contentFr: row.content_fr,
    contentDarija: row.content_darija,
    category: row.category,
    imageUrl: row.image_url,
    readTimeMinutes: row.read_time_minutes,
    createdAt: row.created_at,
  };
}

export function mapPaymentTransaction(row: any): PaymentTransaction {
  return {
    id: row.id,
    clientId: row.client_id,
    therapistId: row.therapist_id,
    appointmentId: row.appointment_id,
    amountDinar: row.amount_dinar,
    paymentMethod: row.payment_method,
    status: row.status,
    externalRef: row.external_ref,
    providerEventId: row.provider_event_id,
    providerName: row.provider_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapCrisisReport(row: any): CrisisReport {
  return {
    id: row.id,
    userId: row.user_id,
    severity: row.severity,
    autoDetected: row.auto_detected,
    responderId: row.responder_id,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
  };
}

export function mapOnboardingResponse(row: any): OnboardingResponse {
  return {
    id: row.id,
    userId: row.user_id,
    primaryConcerns: row.primary_concerns,
    preferredLanguage: row.preferred_language,
    genderPreference: row.gender_preference,
    budgetRange: row.budget_range,
    howDidYouHear: row.how_did_you_hear,
    completedAt: row.completed_at,
  };
}

export function mapListenerProfile(row: any): ListenerProfile {
  return {
    userId: row.user_id,
    displayAlias: row.display_alias,
    languages: row.languages,
    topics: row.topics,
    timezone: row.timezone,
    verificationStatus: row.verification_status,
    activationStatus: row.activation_status,
    trainingCompletedAt: row.training_completed_at,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    isAvailable: row.is_available,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    headline: row.headline ?? null,
    aboutMe: row.about_me ?? null,
    avatarEmoji: row.avatar_emoji ?? '🤝',
    totalSessions: row.total_sessions ?? 0,
    averageRating: row.average_rating ?? null,
  };
}

export function mapListenerProgress(row: any): ListenerProgress {
  return {
    listenerId: row.listener_id,
    points: row.points,
    level: row.level,
    sessionsRatedCount: row.sessions_rated_count,
    currentStreak: row.current_streak ?? 0,
    longestStreak: row.longest_streak ?? 0,
    endorsementsCount: row.endorsements_count ?? 0,
    lastCalculatedAt: row.last_calculated_at,
  };
}

export function mapListenerPointsLedger(row: any): ListenerPointsLedger {
  return {
    id: row.id,
    listenerId: row.listener_id,
    sessionId: row.session_id,
    eventType: row.event_type,
    delta: row.delta,
    meta: row.meta,
    createdAt: row.created_at,
  };
}

export function mapListenerBadge(row: any): ListenerBadge {
  return {
    id: row.id,
    listenerId: row.listener_id,
    badgeKey: row.badge_key,
    title: row.title,
    description: row.description ?? null,
    awardedAt: row.awarded_at,
    meta: row.meta ?? null,
  };
}

export function mapListenerEndorsement(row: any): ListenerEndorsement {
  return {
    id: row.id,
    listenerId: row.listener_id,
    sessionId: row.session_id ?? null,
    quote: row.quote,
    warmthScore: row.warmth_score ?? null,
    createdAt: row.created_at,
  };
}

export function mapListenerWellbeingCheckIn(row: any): ListenerWellbeingCheckIn {
  return {
    id: row.id,
    listenerId: row.listener_id,
    sessionId: row.session_id ?? null,
    stressLevel: row.stress_level,
    emotionalLoad: row.emotional_load,
    needsBreak: row.needs_break ?? false,
    notes: row.notes ?? null,
    createdAt: row.created_at,
  };
}

export function mapListenerCooldown(row: any): ListenerCooldown {
  return {
    listenerId: row.listener_id,
    sourceSessionId: row.source_session_id ?? null,
    reason: row.reason,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    releasedAt: row.released_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapListenerHallOfFameEntry(row: any): ListenerHallOfFameEntry {
  return {
    id: row.id,
    seasonKey: row.season_key,
    rank: row.rank,
    listenerId: row.listener_id,
    displayName: row.display_name,
    points: row.points ?? 0,
    averageRating: row.average_rating ?? 0,
    ratingCount: row.rating_count ?? 0,
    positiveStreak: row.positive_streak ?? 0,
    trophyTier: row.trophy_tier ?? null,
    certificationTitle: row.certification_title ?? null,
    archivedAt: row.archived_at,
    certificateIssuedAt: row.certificate_issued_at ?? null,
    certificateCode: row.certificate_code ?? null,
  };
}

export function mapListenerApplication(row: any): ListenerApplication {
  return {
    id: row.id,
    userId: row.user_id,
    motivation: row.motivation,
    relevantExperience: row.relevant_experience,
    languages: row.languages,
    topics: row.topics,
    weeklyHours: row.weekly_hours,
    status: row.status,
    moderationNotes: row.moderation_notes,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapListenerQueueEntry(row: any): ListenerQueueEntry {
  return {
    id: row.id,
    clientId: row.client_id,
    preferredLanguage: row.preferred_language,
    topicTags: row.topic_tags,
    status: row.status,
    matchedListenerId: row.matched_listener_id,
    sessionId: row.session_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapPeerSession(row: any): PeerSession {
  return {
    id: row.id,
    clientId: row.client_id,
    listenerId: row.listener_id,
    queueEntryId: row.queue_entry_id,
    status: row.status,
    anonymousAliasClient: row.anonymous_alias_client,
    anonymousAliasListener: row.anonymous_alias_listener,
    escalatedToCrisis: row.escalated_to_crisis,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    createdAt: row.created_at,
  };
}

export function mapPeerMessage(row: any): PeerMessage {
  return {
    id: row.id,
    sessionId: row.session_id,
    senderId: row.sender_id,
    content: row.content,
    encrypted: row.encrypted,
    isFlagged: row.is_flagged,
    createdAt: row.created_at,
  };
}

export function mapPeerSessionFeedback(row: any): PeerSessionFeedback {
  return {
    id: row.id,
    sessionId: row.session_id,
    clientId: row.client_id,
    listenerId: row.listener_id,
    rating: row.rating,
    tags: row.tags,
    comment: row.comment,
    createdAt: row.created_at,
  };
}

export function mapPeerReport(row: any): PeerReport {
  return {
    id: row.id,
    sessionId: row.session_id,
    reporterId: row.reporter_id,
    targetUserId: row.target_user_id,
    reason: row.reason,
    details: row.details,
    severity: row.severity,
    moderationStatus: row.moderation_status,
    resolvedBy: row.resolved_by,
    resolvedAt: row.resolved_at,
    penaltyApplied: row.penalty_applied,
    createdAt: row.created_at,
  };
}

// Helper: convert camelCase insert data to snake_case for Supabase
export function toSnakeCase(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    result[snakeKey] = value;
  }
  return result;
}

// ---- Therapist Landing Page Builder types (Phase 3.4) ----

export type LandingSection =
  | { type: "hero"; enabled: boolean }
  | { type: "about"; enabled: boolean }
  | { type: "specializations"; enabled: boolean }
  | { type: "testimonials"; enabled: boolean; maxCount?: number }
  | { type: "faq"; enabled: boolean }
  | { type: "slots"; enabled: boolean }
  | { type: "video"; enabled: boolean; videoUrl?: string }
  | { type: "office_photos"; enabled: boolean }
  | { type: "social_links"; enabled: boolean }
  | { type: "custom_text"; enabled: boolean; title: string; content: string }
  | { type: "banner"; enabled: boolean; imageUrl?: string; altText?: string }
  | { type: "gallery"; enabled: boolean }
  | { type: "certifications"; enabled: boolean }
  | { type: "pricing"; enabled: boolean }
  | { type: "contact_form"; enabled: boolean }
  | { type: "consultation_intro"; enabled: boolean };

export const DEFAULT_LANDING_SECTIONS: LandingSection[] = [
  { type: "hero", enabled: true },
  { type: "about", enabled: true },
  { type: "specializations", enabled: true },
  { type: "slots", enabled: true },
  { type: "testimonials", enabled: true, maxCount: 3 },
  { type: "faq", enabled: false },
  { type: "video", enabled: false },
  { type: "office_photos", enabled: false },
  { type: "social_links", enabled: false },
];

// ── Phase B: Subscription model ──────────────────────────────────────────────

export interface SubscriptionPlan {
  id: number;
  name: string;
  nameAr: string | null;
  nameFr: string | null;
  description: string | null;
  sessionsIncluded: number;
  priceDinar: number;
  durationDays: number;
  tierRestriction: TherapistTier | null;
  isActive: boolean;
  createdAt: string | null;
}

export interface UserSubscription {
  id: number;
  userId: string;
  planId: number;
  therapistId: string | null;
  sessionsRemaining: number;
  startsAt: string;
  expiresAt: string;
  status: "active" | "expired" | "cancelled";
  paymentTransactionId: number | null;
  createdAt: string | null;
  plan?: SubscriptionPlan;
}

export interface MatchingPreferences {
  userId: string;
  preferredSpecializations: string[] | null;
  preferredLanguages: string[] | null;
  preferredGender: string | null;
  maxBudgetDinar: number | null;
  sessionTypePreference: "online" | "in_person" | "any" | null;
  updatedAt: string | null;
}

// Mappers
export function mapSubscriptionPlan(row: any): SubscriptionPlan {
  return {
    id: row.id,
    name: row.name,
    nameAr: row.name_ar,
    nameFr: row.name_fr,
    description: row.description,
    sessionsIncluded: row.sessions_included,
    priceDinar: row.price_dinar,
    durationDays: row.duration_days,
    tierRestriction: row.tier_restriction ?? null,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

export function mapUserSubscription(row: any): UserSubscription {
  return {
    id: row.id,
    userId: row.user_id,
    planId: row.plan_id,
    therapistId: row.therapist_id ?? null,
    sessionsRemaining: row.sessions_remaining,
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    status: row.status,
    paymentTransactionId: row.payment_transaction_id ?? null,
    createdAt: row.created_at,
    plan: row.subscription_plans ? mapSubscriptionPlan(row.subscription_plans) : undefined,
  };
}

export function mapMatchingPreferences(row: any): MatchingPreferences {
  return {
    userId: row.user_id,
    preferredSpecializations: row.preferred_specializations ?? null,
    preferredLanguages: row.preferred_languages ?? null,
    preferredGender: row.preferred_gender ?? null,
    maxBudgetDinar: row.max_budget_dinar ?? null,
    sessionTypePreference: row.session_type_preference ?? null,
    updatedAt: row.updated_at,
  };
}

// Zod schemas
export const purchaseSubscriptionSchema = z.object({
  planId: z.number().int().positive(),
  therapistId: z.string().uuid().optional(),
  paymentMethod: z.enum(["flouci", "konnect"]),
});

export const matchingPreferencesSchema = z.object({
  preferredSpecializations: z.array(z.string()).optional(),
  preferredLanguages: z.array(z.string()).optional(),
  preferredGender: z.enum(["male", "female", "any"]).optional(),
  maxBudgetDinar: z.number().positive().optional(),
  sessionTypePreference: z.enum(["online", "in_person", "any"]).optional(),
});

// ---- Announcements ----

export interface Announcement {
  id: number;
  authorId: string;
  title: string;
  body: string;
  targetRoles: string[];
  priority: "info" | "warning" | "urgent";
  startsAt: string;
  expiresAt: string | null;
  createdAt: string;
}

export function mapAnnouncement(row: any): Announcement {
  return {
    id: row.id,
    authorId: row.author_id,
    title: row.title,
    body: row.body,
    targetRoles: row.target_roles ?? [],
    priority: row.priority ?? "info",
    startsAt: row.starts_at,
    expiresAt: row.expires_at ?? null,
    createdAt: row.created_at,
  };
}

export const createAnnouncementSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  targetRoles: z.array(z.string()).default([]),
  priority: z.enum(["info", "warning", "urgent"]).default("info"),
  startsAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});
