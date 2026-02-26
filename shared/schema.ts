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

export type TherapistTier = "student" | "professional";

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
  tierApprovedBy: string | null;
  tierApprovedAt: string | null;
  landingPageEnabled: boolean | null;
  landingPageSections: any;
  landingPageCtaText: string | null;
  landingPageCtaUrl: string | null;
  createdAt: string | null;
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
}

export interface ListenerProgress {
  listenerId: string;
  points: number;
  level: number;
  sessionsRatedCount: number;
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
  tier: z.enum(["student", "professional"]).default("professional").optional(),
  tierApprovedBy: z.string().optional().nullable(),
  tierApprovedAt: z.string().optional().nullable(),
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
});

export const insertListenerProgressSchema = z.object({
  listenerId: z.string(),
  points: z.number().int().default(0).optional(),
  level: z.number().int().default(1).optional(),
  sessionsRatedCount: z.number().int().default(0).optional(),
  lastCalculatedAt: z.string().optional().nullable(),
});

export const insertListenerPointsLedgerSchema = z.object({
  listenerId: z.string(),
  sessionId: z.number().optional().nullable(),
  eventType: z.string(),
  delta: z.number().int(),
  meta: z.any().optional().nullable(),
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
  };
}

// ---- Insert types ----

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
export type InsertListenerApplication = z.infer<typeof insertListenerApplicationSchema>;
export type InsertListenerQueueEntry = z.infer<typeof insertListenerQueueEntrySchema>;
export type InsertPeerSession = z.infer<typeof insertPeerSessionSchema>;
export type InsertPeerMessage = z.infer<typeof insertPeerMessageSchema>;
export type InsertPeerSessionFeedback = z.infer<typeof insertPeerSessionFeedbackSchema>;
export type InsertPeerReport = z.infer<typeof insertPeerReportSchema>;

// ---- Helper: map snake_case DB row to camelCase TS object ----

export function mapProfile(row: any): User {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    profileImageUrl: row.profile_image_url,
    role: row.role,
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
    tier: row.tier || "professional",
    tierApprovedBy: row.tier_approved_by,
    tierApprovedAt: row.tier_approved_at,
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
  };
}

export function mapListenerProgress(row: any): ListenerProgress {
  return {
    listenerId: row.listener_id,
    points: row.points,
    level: row.level,
    sessionsRatedCount: row.sessions_rated_count,
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
