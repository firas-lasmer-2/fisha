import { supabaseAdmin } from "./supabase";
import {
  type User, type InsertUser,
  type TherapistProfile, type TherapistSlot, type TherapistTier,
  type InsertTherapistProfile, type InsertTherapistSlot,
  type TherapyConversation, type InsertTherapyConversation,
  type TherapyMessage, type InsertTherapyMessage,
  type Appointment, type InsertAppointment,
  type MoodEntry, type InsertMoodEntry,
  type JournalEntry, type InsertJournalEntry,
  type Resource, type InsertResource,
  type TherapistReview, type InsertTherapistReview,
  type PaymentTransaction, type InsertPaymentTransaction,
  type CrisisReport, type InsertCrisisReport,
  type OnboardingResponse, type InsertOnboardingResponse,
  type ListenerProfile, type InsertListenerProfile,
  type ListenerProgress, type ListenerPointsLedger,
  type InsertListenerProgress, type InsertListenerPointsLedger,
  type ListenerApplication, type InsertListenerApplication,
  type ListenerQueueEntry, type InsertListenerQueueEntry,
  type PeerSession, type InsertPeerSession,
  type PeerMessage, type InsertPeerMessage,
  type PeerSessionFeedback, type InsertPeerSessionFeedback,
  type PeerReport, type InsertPeerReport,
  type FcmToken,
  type TherapistVerification, type InsertTherapistVerification,
  mapProfile, mapTherapistProfile, mapTherapistReview,
  mapConversation, mapMessage, mapAppointment, mapTherapistSlot,
  mapMoodEntry, mapJournalEntry, mapResource,
  mapPaymentTransaction, mapCrisisReport, mapOnboardingResponse,
  mapListenerProfile, mapListenerProgress, mapListenerPointsLedger,
  mapListenerApplication, mapListenerQueueEntry,
  mapPeerSession, mapPeerMessage, mapPeerSessionFeedback, mapPeerReport,
  mapTherapistVerification,
  toSnakeCase,
} from "@shared/schema";

const supabase = supabaseAdmin;

const LISTENER_LEVEL_THRESHOLDS = [0, 50, 150, 300, 500, 800, 1200, 1700, 2300, 3000];
const RATING_BONUS_BY_SCORE: Record<number, number> = {
  1: -10,
  2: 0,
  3: 8,
  4: 16,
  5: 24,
};
const STREAK_BONUS_BY_MILESTONE: Record<number, number> = {
  3: 15,
  7: 30,
};
const BASE_SESSION_POINTS = 8;
const LOW_RATING_PENALTY = -20;
const DETAILED_FEEDBACK_BONUS = 4;
const REPORT_SEVERITY_PENALTY: Record<string, number> = {
  low: -20,
  medium: -40,
  high: -80,
  critical: -120,
};

function listenerLevelForPoints(points: number): number {
  const safePoints = Math.max(0, points);
  let level = 1;
  for (let i = 0; i < LISTENER_LEVEL_THRESHOLDS.length; i += 1) {
    if (safePoints >= LISTENER_LEVEL_THRESHOLDS[i]) {
      level = i + 1;
    }
  }
  return level;
}

function listenerNextLevelInfo(points: number): {
  nextLevel: number | null;
  nextLevelThreshold: number | null;
  pointsToNextLevel: number;
} {
  const safePoints = Math.max(0, points);
  const currentLevel = listenerLevelForPoints(safePoints);
  const nextLevelThreshold = LISTENER_LEVEL_THRESHOLDS[currentLevel];
  if (nextLevelThreshold === undefined) {
    return { nextLevel: null, nextLevelThreshold: null, pointsToNextLevel: 0 };
  }
  return {
    nextLevel: currentLevel + 1,
    nextLevelThreshold,
    pointsToNextLevel: Math.max(0, nextLevelThreshold - safePoints),
  };
}

export interface ListenerProgressSummary {
  progress: ListenerProgress;
  nextLevel: number | null;
  nextLevelThreshold: number | null;
  pointsToNextLevel: number;
  averageRating: number;
  ratingCount: number;
  positiveStreak: number;
  recentLedger: ListenerPointsLedger[];
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

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: InsertUser & { id?: string }): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;
  isDisplayNameAvailable(name: string, excludeUserId?: string): Promise<boolean>;

  getTherapistProfile(userId: string): Promise<TherapistProfile | undefined>;
  getTherapistProfiles(filters?: {
    specialization?: string;
    language?: string;
    minPrice?: number;
    maxPrice?: number;
    gender?: string;
    tier?: TherapistTier;
  }): Promise<(TherapistProfile & { user: User })[]>;
  createTherapistProfile(profile: InsertTherapistProfile): Promise<TherapistProfile>;
  updateTherapistProfile(userId: string, data: Partial<InsertTherapistProfile>): Promise<TherapistProfile | undefined>;
  updateTherapistTier(
    therapistUserId: string,
    tier: TherapistTier,
    reviewerId: string,
  ): Promise<TherapistProfile | undefined>;

  getConversation(id: number): Promise<TherapyConversation | undefined>;
  getConversationsByUser(userId: string): Promise<(TherapyConversation & { otherUser: User })[]>;
  createConversation(conv: InsertTherapyConversation): Promise<TherapyConversation>;
  getOrCreateConversation(clientId: string, therapistId: string): Promise<TherapyConversation>;
  setConversationEncryptionKeys(
    conversationId: number,
    keys: { clientKeyEncrypted: string; therapistKeyEncrypted: string; keyVersion?: number },
  ): Promise<TherapyConversation | undefined>;

  getMessages(conversationId: number): Promise<TherapyMessage[]>;
  createMessage(msg: InsertTherapyMessage): Promise<TherapyMessage>;
  markMessagesRead(conversationId: number, userId: string): Promise<void>;
  getUnreadCount(userId: string): Promise<number>;

  getAppointments(userId: string): Promise<(Appointment & { otherUser: User })[]>;
  getAppointment(id: number): Promise<Appointment | undefined>;
  createAppointment(apt: InsertAppointment): Promise<Appointment>;
  createAppointmentFromSlot(
    slotId: number,
    clientId: string,
    notes?: string | null,
    sessionType?: string,
  ): Promise<{ appointment: Appointment; slot: TherapistSlot } | undefined>;
  updateAppointmentStatus(id: number, status: string): Promise<Appointment | undefined>;
  getTherapistSlots(
    therapistId: string,
    from?: string,
    to?: string,
    statuses?: string[],
  ): Promise<TherapistSlot[]>;
  createTherapistSlot(slot: InsertTherapistSlot): Promise<TherapistSlot>;
  updateTherapistSlot(id: number, data: Partial<InsertTherapistSlot>): Promise<TherapistSlot | undefined>;
  cancelTherapistSlot(id: number): Promise<TherapistSlot | undefined>;

  getMoodEntries(userId: string, limit?: number): Promise<MoodEntry[]>;
  createMoodEntry(entry: InsertMoodEntry): Promise<MoodEntry>;

  getJournalEntries(userId: string): Promise<JournalEntry[]>;
  createJournalEntry(entry: InsertJournalEntry): Promise<JournalEntry>;
  updateJournalEntry(id: number, data: Partial<InsertJournalEntry>): Promise<JournalEntry | undefined>;
  deleteJournalEntry(id: number): Promise<void>;

  getResources(category?: string): Promise<Resource[]>;
  createResource(resource: InsertResource): Promise<Resource>;

  getReviewsByTherapist(therapistId: string): Promise<(TherapistReview & { client?: Partial<User> })[]>;
  getReviewByAppointment(appointmentId: number): Promise<TherapistReview | undefined>;
  createReview(data: InsertTherapistReview): Promise<TherapistReview>;
  addTherapistResponse(reviewId: number, response: string): Promise<TherapistReview | undefined>;
  getTherapistBySlug(slug: string): Promise<TherapistProfile | undefined>;
  updateTherapistRating(therapistId: string): Promise<void>;
  getCompletedAppointmentCount(therapistId: string): Promise<number>;

  // New MVP methods
  createPaymentTransaction(data: InsertPaymentTransaction): Promise<PaymentTransaction>;
  updatePaymentStatus(
    id: number,
    status: string,
    externalRef?: string,
    providerName?: string,
    providerEventId?: string,
  ): Promise<PaymentTransaction | undefined>;
  getPaymentsByUser(userId: string): Promise<PaymentTransaction[]>;

  saveFcmToken(userId: string, token: string, deviceType?: string): Promise<void>;
  getFcmTokensByUser(userId: string): Promise<string[]>;
  removeFcmToken(token: string): Promise<void>;

  createCrisisReport(data: InsertCrisisReport): Promise<CrisisReport>;
  updateCrisisReport(id: number, data: Partial<CrisisReport>): Promise<CrisisReport | undefined>;

  saveOnboardingResponse(data: InsertOnboardingResponse): Promise<OnboardingResponse>;
  getOnboardingResponse(userId: string): Promise<OnboardingResponse | undefined>;

  // Hybrid peer-support methods
  getListenerProfile(userId: string): Promise<ListenerProfile | undefined>;
  createOrUpdateListenerProfile(data: InsertListenerProfile): Promise<ListenerProfile>;
  getListenerProgress(userId: string): Promise<ListenerProgress | undefined>;
  getListenerProgressSummary(userId: string): Promise<ListenerProgressSummary>;
  getListenerLeaderboard(limit?: number): Promise<ListenerLeaderboardEntry[]>;
  getListenerRiskSnapshots(listenerIds: string[]): Promise<ListenerRiskSnapshot[]>;
  upsertListenerProgress(data: InsertListenerProgress): Promise<ListenerProgress>;
  addListenerPointsLedgerEntry(data: InsertListenerPointsLedger): Promise<ListenerPointsLedger>;
  applyListenerFeedbackOutcome(data: {
    sessionId: number;
    listenerId: string;
    rating: number;
    hasDetailedComment?: boolean;
  }): Promise<ListenerProgress>;
  applyListenerReportPenalty(
    listenerId: string,
    reportId: number,
    moderatorId: string,
  ): Promise<ListenerProgress>;

  submitListenerApplication(data: InsertListenerApplication): Promise<ListenerApplication>;
  getListenerApplicationByUser(userId: string): Promise<ListenerApplication | undefined>;
  listListenerApplications(status?: string): Promise<ListenerApplication[]>;
  reviewListenerApplication(
    applicationId: number,
    reviewerId: string,
    status: "approved" | "rejected" | "changes_requested",
    moderationNotes?: string,
  ): Promise<ListenerApplication | undefined>;

  setListenerActivation(
    userId: string,
    activationStatus: "inactive" | "trial" | "live" | "suspended",
    reviewerId?: string,
  ): Promise<ListenerProfile | undefined>;
  setListenerAvailability(userId: string, isAvailable: boolean): Promise<ListenerProfile | undefined>;
  listAvailableListeners(language?: string, topicTags?: string[]): Promise<ListenerProfile[]>;

  joinListenerQueue(data: InsertListenerQueueEntry): Promise<ListenerQueueEntry>;
  leaveListenerQueue(clientId: string): Promise<void>;
  getActiveQueueEntry(clientId: string): Promise<ListenerQueueEntry | undefined>;
  listWaitingQueueEntries(): Promise<ListenerQueueEntry[]>;

  createPeerSession(data: InsertPeerSession): Promise<PeerSession>;
  getPeerSession(id: number): Promise<PeerSession | undefined>;
  getPeerSessionsByUser(userId: string): Promise<(PeerSession & { otherUser: User })[]>;
  endPeerSession(id: number): Promise<PeerSession | undefined>;

  createPeerMessage(data: InsertPeerMessage): Promise<PeerMessage>;
  getPeerMessages(sessionId: number): Promise<PeerMessage[]>;

  createPeerSessionFeedback(data: InsertPeerSessionFeedback): Promise<PeerSessionFeedback>;
  createPeerReport(data: InsertPeerReport): Promise<PeerReport>;
  listOpenPeerReports(): Promise<PeerReport[]>;
  resolvePeerReport(reportId: number, moderatorId: string): Promise<PeerReport | undefined>;

  // Verification
  upsertTherapistVerification(data: InsertTherapistVerification): Promise<TherapistVerification>;
  getTherapistVerifications(therapistId: string): Promise<TherapistVerification[]>;
  getAllVerifications(status?: string): Promise<(TherapistVerification & { therapistName?: string })[]>;
  reviewTherapistVerification(id: number, status: "approved" | "rejected", reviewerId: string, notes?: string): Promise<TherapistVerification | undefined>;

  // Admin analytics
  getAdminAnalytics(): Promise<{
    totalUsers: number;
    activeTherapists: number;
    sessionsThisWeek: number;
    revenueThisMonth: number;
    newUsersThisWeek: number;
    pendingVerifications: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  // ---- Users (profiles) ----

  async getUser(id: string): Promise<User | undefined> {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) return undefined;
    return mapProfile(data);
  }

  async upsertUser(userData: InsertUser & { id?: string }): Promise<User> {
    const row = toSnakeCase(userData);
    if (userData.id) {
      row.id = userData.id;
    }
    row.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("profiles")
      .upsert(row, { onConflict: "id" })
      .select()
      .single();
    if (error) throw error;
    return mapProfile(data);
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const row = toSnakeCase(data);
    row.updated_at = new Date().toISOString();

    const { data: result, error } = await supabase
      .from("profiles")
      .update(row)
      .eq("id", id)
      .select()
      .single();
    if (error) return undefined;
    return mapProfile(result);
  }

  async isDisplayNameAvailable(name: string, excludeUserId?: string): Promise<boolean> {
    let query = supabase
      .from("profiles")
      .select("id")
      .eq("display_name", name);
    if (excludeUserId) {
      query = query.neq("id", excludeUserId);
    }
    const { data, error } = await query.maybeSingle();
    if (error) return false;
    return data === null;
  }

  // ---- Therapist Profiles ----

  async getTherapistProfile(userId: string): Promise<TherapistProfile | undefined> {
    const { data, error } = await supabase
      .from("therapist_profiles")
      .select("*")
      .eq("user_id", userId)
      .single();
    if (error || !data) return undefined;
    return mapTherapistProfile(data);
  }

  async getTherapistProfiles(filters?: {
    specialization?: string;
    language?: string;
    minPrice?: number;
    maxPrice?: number;
    gender?: string;
    tier?: TherapistTier;
  }): Promise<(TherapistProfile & { user: User })[]> {
    const { data: profileRows, error } = await supabase
      .from("therapist_profiles")
      .select("*");
    if (error || !profileRows) return [];

    // Fetch all related users
    const userIds = profileRows.map((p: any) => p.user_id);
    const { data: userRows } = await supabase
      .from("profiles")
      .select("*")
      .in("id", userIds);

    const usersMap = new Map<string, User>();
    for (const u of userRows || []) {
      usersMap.set(u.id, mapProfile(u));
    }

    let profiles = profileRows.map((p: any) => ({
      ...mapTherapistProfile(p),
      user: usersMap.get(p.user_id)!,
    })).filter((p) => p.user);

    if (filters?.specialization) {
      profiles = profiles.filter((p) => p.specializations?.includes(filters.specialization!));
    }
    if (filters?.language) {
      profiles = profiles.filter((p) => p.languages?.includes(filters.language!));
    }
    if (filters?.gender) {
      profiles = profiles.filter((p) => p.gender === filters.gender);
    }
    if (filters?.tier) {
      profiles = profiles.filter((p) => p.tier === filters.tier);
    }
    if (filters?.minPrice !== undefined) {
      profiles = profiles.filter((p) => (p.rateDinar ?? 0) >= filters.minPrice!);
    }
    if (filters?.maxPrice !== undefined) {
      profiles = profiles.filter((p) => (p.rateDinar ?? 0) <= filters.maxPrice!);
    }

    return profiles;
  }

  async createTherapistProfile(profile: InsertTherapistProfile): Promise<TherapistProfile> {
    const row = toSnakeCase(profile);
    const { data, error } = await supabase
      .from("therapist_profiles")
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    return mapTherapistProfile(data);
  }

  async updateTherapistProfile(userId: string, data: Partial<InsertTherapistProfile>): Promise<TherapistProfile | undefined> {
    const row = toSnakeCase(data);
    delete row.user_id; // Don't update user_id
    const { data: result, error } = await supabase
      .from("therapist_profiles")
      .update(row)
      .eq("user_id", userId)
      .select()
      .single();
    if (error) return undefined;
    return mapTherapistProfile(result);
  }

  async updateTherapistTier(
    therapistUserId: string,
    tier: TherapistTier,
    reviewerId: string,
  ): Promise<TherapistProfile | undefined> {
    const { data, error } = await supabase
      .from("therapist_profiles")
      .update({
        tier,
        tier_approved_by: reviewerId,
        tier_approved_at: new Date().toISOString(),
      })
      .eq("user_id", therapistUserId)
      .select("*")
      .single();

    if (error || !data) return undefined;
    return mapTherapistProfile(data);
  }

  // ---- Conversations ----

  async getConversation(id: number): Promise<TherapyConversation | undefined> {
    const { data, error } = await supabase
      .from("therapy_conversations")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) return undefined;
    return mapConversation(data);
  }

  async getConversationsByUser(userId: string): Promise<(TherapyConversation & { otherUser: User })[]> {
    const { data: convs, error } = await supabase
      .from("therapy_conversations")
      .select("*")
      .or(`client_id.eq.${userId},therapist_id.eq.${userId}`)
      .order("last_message_at", { ascending: false });
    if (error || !convs) return [];

    const result: (TherapyConversation & { otherUser: User })[] = [];
    for (const conv of convs) {
      const otherId = conv.client_id === userId ? conv.therapist_id : conv.client_id;
      const otherUser = await this.getUser(otherId);
      if (otherUser) {
        result.push({ ...mapConversation(conv), otherUser });
      }
    }
    return result;
  }

  async createConversation(conv: InsertTherapyConversation): Promise<TherapyConversation> {
    const row = toSnakeCase(conv);
    const { data, error } = await supabase
      .from("therapy_conversations")
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    return mapConversation(data);
  }

  async getOrCreateConversation(clientId: string, therapistId: string): Promise<TherapyConversation> {
    const { data: existing } = await supabase
      .from("therapy_conversations")
      .select("*")
      .eq("client_id", clientId)
      .eq("therapist_id", therapistId)
      .single();
    if (existing) return mapConversation(existing);
    return this.createConversation({ clientId, therapistId, status: "active" });
  }

  async setConversationEncryptionKeys(
    conversationId: number,
    keys: { clientKeyEncrypted: string; therapistKeyEncrypted: string; keyVersion?: number },
  ): Promise<TherapyConversation | undefined> {
    const { data, error } = await supabase
      .from("therapy_conversations")
      .update({
        client_key_encrypted: keys.clientKeyEncrypted,
        therapist_key_encrypted: keys.therapistKeyEncrypted,
        key_version: keys.keyVersion ?? 1,
      })
      .eq("id", conversationId)
      .select("*")
      .single();

    if (error || !data) return undefined;
    return mapConversation(data);
  }

  // ---- Messages ----

  async getMessages(conversationId: number): Promise<TherapyMessage[]> {
    const { data, error } = await supabase
      .from("therapy_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (error || !data) return [];
    return data.map(mapMessage);
  }

  async createMessage(msg: InsertTherapyMessage): Promise<TherapyMessage> {
    const row = toSnakeCase(msg);
    const { data, error } = await supabase
      .from("therapy_messages")
      .insert(row)
      .select()
      .single();
    if (error) throw error;

    // Update conversation's last_message_at
    await supabase
      .from("therapy_conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", msg.conversationId);

    return mapMessage(data);
  }

  async markMessagesRead(conversationId: number, userId: string): Promise<void> {
    await supabase
      .from("therapy_messages")
      .update({ is_read: true })
      .eq("conversation_id", conversationId)
      .neq("sender_id", userId)
      .eq("is_read", false);
  }

  async getUnreadCount(userId: string): Promise<number> {
    // Get all conversations for this user
    const { data: convs } = await supabase
      .from("therapy_conversations")
      .select("id")
      .or(`client_id.eq.${userId},therapist_id.eq.${userId}`);
    if (!convs || convs.length === 0) return 0;

    const convIds = convs.map((c: any) => c.id);
    const { count, error } = await supabase
      .from("therapy_messages")
      .select("*", { count: "exact", head: true })
      .in("conversation_id", convIds)
      .neq("sender_id", userId)
      .eq("is_read", false);

    return count ?? 0;
  }

  // ---- Appointments ----

  async getAppointments(userId: string): Promise<(Appointment & { otherUser: User })[]> {
    const { data: apts, error } = await supabase
      .from("appointments")
      .select("*")
      .or(`client_id.eq.${userId},therapist_id.eq.${userId}`)
      .order("scheduled_at", { ascending: false });
    if (error || !apts) return [];

    const result: (Appointment & { otherUser: User })[] = [];
    for (const apt of apts) {
      const otherId = apt.client_id === userId ? apt.therapist_id : apt.client_id;
      const otherUser = await this.getUser(otherId);
      if (otherUser) {
        result.push({ ...mapAppointment(apt), otherUser });
      }
    }
    return result;
  }

  async getAppointment(id: number): Promise<Appointment | undefined> {
    const { data, error } = await supabase
      .from("appointments")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) return undefined;
    return mapAppointment(data);
  }

  async createAppointment(apt: InsertAppointment): Promise<Appointment> {
    const row = toSnakeCase(apt);
    const { data, error } = await supabase
      .from("appointments")
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    return mapAppointment(data);
  }

  async createAppointmentFromSlot(
    slotId: number,
    clientId: string,
    notes?: string | null,
    sessionType = "chat",
  ): Promise<{ appointment: Appointment; slot: TherapistSlot } | undefined> {
    const { data: slotRow, error: slotError } = await supabase
      .from("therapist_slots")
      .select("*")
      .eq("id", slotId)
      .single();
    if (slotError || !slotRow) return undefined;
    if (slotRow.status !== "open") return undefined;
    if (slotRow.therapist_id === clientId) return undefined;

    const { data: appointmentRow, error: appointmentError } = await supabase
      .from("appointments")
      .insert({
        client_id: clientId,
        therapist_id: slotRow.therapist_id,
        scheduled_at: slotRow.starts_at,
        duration_minutes: slotRow.duration_minutes,
        session_type: sessionType,
        status: "pending",
        notes: notes || null,
        price_dinar: slotRow.price_dinar,
      })
      .select("*")
      .single();
    if (appointmentError || !appointmentRow) return undefined;

    const { data: updatedSlotRow, error: updateSlotError } = await supabase
      .from("therapist_slots")
      .update({
        status: "booked",
        appointment_id: appointmentRow.id,
      })
      .eq("id", slotId)
      .eq("status", "open")
      .select("*")
      .single();

    if (updateSlotError || !updatedSlotRow) {
      await supabase.from("appointments").delete().eq("id", appointmentRow.id);
      return undefined;
    }

    return {
      appointment: mapAppointment(appointmentRow),
      slot: mapTherapistSlot(updatedSlotRow),
    };
  }

  async updateAppointmentStatus(id: number, status: string): Promise<Appointment | undefined> {
    const { data, error } = await supabase
      .from("appointments")
      .update({ status })
      .eq("id", id)
      .select()
      .single();
    if (error) return undefined;
    return mapAppointment(data);
  }

  async getTherapistSlots(
    therapistId: string,
    from?: string,
    to?: string,
    statuses?: string[],
  ): Promise<TherapistSlot[]> {
    let query = supabase
      .from("therapist_slots")
      .select("*")
      .eq("therapist_id", therapistId)
      .order("starts_at", { ascending: true });

    if (from) query = query.gte("starts_at", from);
    if (to) query = query.lte("starts_at", to);
    if (statuses && statuses.length > 0) query = query.in("status", statuses);

    const { data, error } = await query;
    if (error || !data) return [];
    return data.map(mapTherapistSlot);
  }

  async createTherapistSlot(slot: InsertTherapistSlot): Promise<TherapistSlot> {
    const row = toSnakeCase(slot);
    const { data, error } = await supabase
      .from("therapist_slots")
      .insert(row)
      .select("*")
      .single();
    if (error) throw error;
    return mapTherapistSlot(data);
  }

  async updateTherapistSlot(id: number, data: Partial<InsertTherapistSlot>): Promise<TherapistSlot | undefined> {
    const row = toSnakeCase(data);
    delete row.therapist_id;

    const { data: updated, error } = await supabase
      .from("therapist_slots")
      .update(row)
      .eq("id", id)
      .select("*")
      .single();
    if (error || !updated) return undefined;
    return mapTherapistSlot(updated);
  }

  async cancelTherapistSlot(id: number): Promise<TherapistSlot | undefined> {
    const { data, error } = await supabase
      .from("therapist_slots")
      .update({ status: "cancelled" })
      .eq("id", id)
      .select("*")
      .single();
    if (error || !data) return undefined;
    return mapTherapistSlot(data);
  }

  // ---- Mood Entries ----

  async getMoodEntries(userId: string, limit = 30): Promise<MoodEntry[]> {
    const { data, error } = await supabase
      .from("mood_entries")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data.map(mapMoodEntry);
  }

  async createMoodEntry(entry: InsertMoodEntry): Promise<MoodEntry> {
    const row = toSnakeCase(entry);
    const { data, error } = await supabase
      .from("mood_entries")
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    return mapMoodEntry(data);
  }

  // ---- Journal Entries ----

  async getJournalEntries(userId: string): Promise<JournalEntry[]> {
    const { data, error } = await supabase
      .from("journal_entries")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error || !data) return [];
    return data.map(mapJournalEntry);
  }

  async createJournalEntry(entry: InsertJournalEntry): Promise<JournalEntry> {
    const row = toSnakeCase(entry);
    const { data, error } = await supabase
      .from("journal_entries")
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    return mapJournalEntry(data);
  }

  async updateJournalEntry(id: number, data: Partial<InsertJournalEntry>): Promise<JournalEntry | undefined> {
    const row = toSnakeCase(data);
    const { data: result, error } = await supabase
      .from("journal_entries")
      .update(row)
      .eq("id", id)
      .select()
      .single();
    if (error) return undefined;
    return mapJournalEntry(result);
  }

  async deleteJournalEntry(id: number): Promise<void> {
    await supabase.from("journal_entries").delete().eq("id", id);
  }

  // ---- Resources ----

  async getResources(category?: string): Promise<Resource[]> {
    let query = supabase.from("resources").select("*");
    if (category) {
      query = query.eq("category", category);
    }
    const { data, error } = await query;
    if (error || !data) return [];
    return data.map(mapResource);
  }

  async createResource(resource: InsertResource): Promise<Resource> {
    const row = toSnakeCase(resource);
    const { data, error } = await supabase
      .from("resources")
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    return mapResource(data);
  }

  // ---- Reviews ----

  async getReviewsByTherapist(therapistId: string): Promise<(TherapistReview & { client?: Partial<User> })[]> {
    const { data: reviews, error } = await supabase
      .from("therapist_reviews")
      .select("*")
      .eq("therapist_id", therapistId)
      .order("created_at", { ascending: false });
    if (error || !reviews) return [];

    const result: (TherapistReview & { client?: Partial<User> })[] = [];
    for (const review of reviews) {
      const mapped = mapTherapistReview(review);
      if (review.is_anonymous) {
        result.push({ ...mapped, client: undefined });
      } else {
        const { data: client } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, governorate")
          .eq("id", review.client_id)
          .single();
        result.push({
          ...mapped,
          client: client ? {
            id: client.id,
            firstName: client.first_name,
            lastName: client.last_name,
            governorate: client.governorate,
          } as Partial<User> : undefined,
        });
      }
    }
    return result;
  }

  async getReviewByAppointment(appointmentId: number): Promise<TherapistReview | undefined> {
    const { data, error } = await supabase
      .from("therapist_reviews")
      .select("*")
      .eq("appointment_id", appointmentId)
      .single();
    if (error || !data) return undefined;
    return mapTherapistReview(data);
  }

  async createReview(data: InsertTherapistReview): Promise<TherapistReview> {
    const row = toSnakeCase(data);
    const { data: result, error } = await supabase
      .from("therapist_reviews")
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    await this.updateTherapistRating(data.therapistId);
    return mapTherapistReview(result);
  }

  async addTherapistResponse(reviewId: number, response: string): Promise<TherapistReview | undefined> {
    const { data, error } = await supabase
      .from("therapist_reviews")
      .update({ therapist_response: response })
      .eq("id", reviewId)
      .select()
      .single();
    if (error) return undefined;
    return mapTherapistReview(data);
  }

  async getTherapistBySlug(slug: string): Promise<TherapistProfile | undefined> {
    const { data, error } = await supabase
      .from("therapist_profiles")
      .select("*")
      .eq("slug", slug)
      .single();
    if (error || !data) return undefined;
    return mapTherapistProfile(data);
  }

  async updateTherapistRating(therapistId: string): Promise<void> {
    const { data: reviews } = await supabase
      .from("therapist_reviews")
      .select("overall_rating")
      .eq("therapist_id", therapistId);

    if (!reviews || reviews.length === 0) return;

    const avgRating = reviews.reduce((sum: number, r: any) => sum + r.overall_rating, 0) / reviews.length;
    await supabase
      .from("therapist_profiles")
      .update({
        rating: Math.round(avgRating * 10) / 10,
        review_count: reviews.length,
      })
      .eq("user_id", therapistId);
  }

  async getCompletedAppointmentCount(therapistId: string): Promise<number> {
    const { count } = await supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("therapist_id", therapistId)
      .eq("status", "completed");
    return count ?? 0;
  }

  // ---- Payments (MVP) ----

  async createPaymentTransaction(data: InsertPaymentTransaction): Promise<PaymentTransaction> {
    const row = toSnakeCase(data);
    const { data: result, error } = await supabase
      .from("payment_transactions")
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    return mapPaymentTransaction(result);
  }

  async updatePaymentStatus(
    id: number,
    status: string,
    externalRef?: string,
    providerName?: string,
    providerEventId?: string,
  ): Promise<PaymentTransaction | undefined> {
    const update: any = { status };
    if (externalRef) update.external_ref = externalRef;
    if (providerName) update.provider_name = providerName;
    if (providerEventId) update.provider_event_id = providerEventId;
    const { data, error } = await supabase
      .from("payment_transactions")
      .update(update)
      .eq("id", id)
      .select()
      .single();
    if (error) return undefined;
    return mapPaymentTransaction(data);
  }

  async getPaymentsByUser(userId: string): Promise<PaymentTransaction[]> {
    const { data, error } = await supabase
      .from("payment_transactions")
      .select("*")
      .or(`client_id.eq.${userId},therapist_id.eq.${userId}`)
      .order("created_at", { ascending: false });
    if (error || !data) return [];
    return data.map(mapPaymentTransaction);
  }

  // ---- FCM Tokens (MVP) ----

  async saveFcmToken(userId: string, token: string, deviceType?: string): Promise<void> {
    await supabase
      .from("fcm_tokens")
      .upsert(
        { user_id: userId, token, device_type: deviceType || "web" },
        { onConflict: "token" }
      );
  }

  async getFcmTokensByUser(userId: string): Promise<string[]> {
    const { data } = await supabase
      .from("fcm_tokens")
      .select("token")
      .eq("user_id", userId);
    return (data || []).map((row: any) => row.token);
  }

  async removeFcmToken(token: string): Promise<void> {
    await supabase.from("fcm_tokens").delete().eq("token", token);
  }

  // ---- Crisis Reports (MVP) ----

  async createCrisisReport(data: InsertCrisisReport): Promise<CrisisReport> {
    const row = toSnakeCase(data);
    const { data: result, error } = await supabase
      .from("crisis_reports")
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    return mapCrisisReport(result);
  }

  async updateCrisisReport(id: number, data: Partial<CrisisReport>): Promise<CrisisReport | undefined> {
    const row = toSnakeCase(data as any);
    const { data: result, error } = await supabase
      .from("crisis_reports")
      .update(row)
      .eq("id", id)
      .select()
      .single();
    if (error) return undefined;
    return mapCrisisReport(result);
  }

  // ---- Onboarding (MVP) ----

  async saveOnboardingResponse(data: InsertOnboardingResponse): Promise<OnboardingResponse> {
    const row = toSnakeCase(data);
    const { data: result, error } = await supabase
      .from("onboarding_responses")
      .upsert(row, { onConflict: "user_id" })
      .select()
      .single();
    if (error) throw error;

    // Mark user as onboarding completed
    await supabase
      .from("profiles")
      .update({ onboarding_completed: true })
      .eq("id", data.userId);

    return mapOnboardingResponse(result);
  }

  async getOnboardingResponse(userId: string): Promise<OnboardingResponse | undefined> {
    const { data, error } = await supabase
      .from("onboarding_responses")
      .select("*")
      .eq("user_id", userId)
      .single();
    if (error || !data) return undefined;
    return mapOnboardingResponse(data);
  }

  // ---- Listener profiles & applications ----

  async getListenerProfile(userId: string): Promise<ListenerProfile | undefined> {
    const { data, error } = await supabase
      .from("listener_profiles")
      .select("*")
      .eq("user_id", userId)
      .single();
    if (error || !data) return undefined;
    return mapListenerProfile(data);
  }

  async createOrUpdateListenerProfile(data: InsertListenerProfile): Promise<ListenerProfile> {
    const row = toSnakeCase(data);
    row.updated_at = new Date().toISOString();
    const { data: result, error } = await supabase
      .from("listener_profiles")
      .upsert(row, { onConflict: "user_id" })
      .select("*")
      .single();
    if (error) throw error;
    return mapListenerProfile(result);
  }

  private async getListenerPointsTotal(listenerId: string): Promise<number> {
    const { data: sumRows } = await supabase
      .from("listener_points_ledger")
      .select("delta")
      .eq("listener_id", listenerId);
    return Math.max(0, (sumRows || []).reduce((sum, row: any) => sum + Number(row.delta || 0), 0));
  }

  private async getListenerRatingSnapshot(listenerId: string): Promise<{
    averageRating: number;
    ratingCount: number;
    positiveStreak: number;
  }> {
    const { data: feedbackRows } = await supabase
      .from("peer_session_feedback")
      .select("rating")
      .eq("listener_id", listenerId)
      .order("created_at", { ascending: false });

    const ratings = (feedbackRows || [])
      .map((row: any) => Number(row.rating))
      .filter((rating) => Number.isFinite(rating) && rating >= 1 && rating <= 5);
    const ratingCount = ratings.length;
    const averageRating = ratingCount > 0
      ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratingCount) * 100) / 100
      : 0;

    let positiveStreak = 0;
    for (const rating of ratings) {
      if (rating >= 4) positiveStreak += 1;
      else break;
    }

    return { averageRating, ratingCount, positiveStreak };
  }

  private async recalculateListenerProgress(listenerId: string): Promise<ListenerProgress> {
    const totalPoints = await this.getListenerPointsTotal(listenerId);
    const nextLevel = listenerLevelForPoints(totalPoints);
    const ratingSnapshot = await this.getListenerRatingSnapshot(listenerId);

    return this.upsertListenerProgress({
      listenerId,
      points: totalPoints,
      level: nextLevel,
      sessionsRatedCount: ratingSnapshot.ratingCount,
      lastCalculatedAt: new Date().toISOString(),
    });
  }

  async getListenerProgress(userId: string): Promise<ListenerProgress | undefined> {
    const { data, error } = await supabase
      .from("listener_progress")
      .select("*")
      .eq("listener_id", userId)
      .single();
    if (error || !data) return undefined;
    return mapListenerProgress(data);
  }

  async getListenerProgressSummary(userId: string): Promise<ListenerProgressSummary> {
    const progress = await this.getListenerProgress(userId) || {
      listenerId: userId,
      points: 0,
      level: 1,
      sessionsRatedCount: 0,
      lastCalculatedAt: null,
    };

    const ratingSnapshot = await this.getListenerRatingSnapshot(userId);
    const nextLevelInfo = listenerNextLevelInfo(progress.points || 0);
    const { data: ledgerRows } = await supabase
      .from("listener_points_ledger")
      .select("*")
      .eq("listener_id", userId)
      .order("created_at", { ascending: false })
      .limit(12);

    return {
      progress,
      nextLevel: nextLevelInfo.nextLevel,
      nextLevelThreshold: nextLevelInfo.nextLevelThreshold,
      pointsToNextLevel: nextLevelInfo.pointsToNextLevel,
      averageRating: ratingSnapshot.averageRating,
      ratingCount: ratingSnapshot.ratingCount,
      positiveStreak: ratingSnapshot.positiveStreak,
      recentLedger: (ledgerRows || []).map(mapListenerPointsLedger),
    };
  }

  async getListenerLeaderboard(limit = 20): Promise<ListenerLeaderboardEntry[]> {
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
    const { data: progressRows, error: progressError } = await supabase
      .from("listener_progress")
      .select("*")
      .order("points", { ascending: false })
      .order("level", { ascending: false })
      .limit(safeLimit);
    if (progressError || !progressRows || progressRows.length === 0) return [];

    const mappedProgress = progressRows.map(mapListenerProgress);
    const listenerIds = mappedProgress.map((row) => row.listenerId);

    const [{ data: listenerProfileRows }, { data: profileRows }, { data: feedbackRows }] = await Promise.all([
      supabase
        .from("listener_profiles")
        .select("user_id, display_alias")
        .in("user_id", listenerIds),
      supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", listenerIds),
      supabase
        .from("peer_session_feedback")
        .select("listener_id, rating, created_at")
        .in("listener_id", listenerIds)
        .order("created_at", { ascending: false }),
    ]);

    const aliasByUser = new Map<string, string>();
    for (const row of listenerProfileRows || []) {
      aliasByUser.set(row.user_id, row.display_alias || "");
    }
    const nameByUser = new Map<string, string>();
    for (const row of profileRows || []) {
      const display = `${row.first_name || ""} ${row.last_name || ""}`.trim();
      nameByUser.set(row.id, display);
    }

    const ratingsByListener = new Map<string, number[]>();
    for (const row of feedbackRows || []) {
      const rating = Number(row.rating);
      if (!Number.isFinite(rating) || rating < 1 || rating > 5) continue;
      const list = ratingsByListener.get(row.listener_id) || [];
      list.push(rating);
      ratingsByListener.set(row.listener_id, list);
    }

    return mappedProgress.map((progress, index) => {
      const ratings = ratingsByListener.get(progress.listenerId) || [];
      const ratingCount = ratings.length;
      const averageRating = ratingCount > 0
        ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratingCount) * 100) / 100
        : 0;
      let positiveStreak = 0;
      for (const rating of ratings) {
        if (rating >= 4) positiveStreak += 1;
        else break;
      }

      const alias = aliasByUser.get(progress.listenerId);
      const displayName = alias
        || nameByUser.get(progress.listenerId)
        || `Listener ${progress.listenerId.slice(0, 8)}`;

      return {
        listenerId: progress.listenerId,
        rank: index + 1,
        displayName,
        level: progress.level,
        points: progress.points,
        averageRating,
        ratingCount,
        positiveStreak,
      };
    });
  }

  async getListenerRiskSnapshots(listenerIds: string[]): Promise<ListenerRiskSnapshot[]> {
    const uniqueIds = Array.from(new Set(listenerIds.filter(Boolean)));
    if (uniqueIds.length === 0) return [];

    const sinceIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [{ data: reportRows }, { data: feedbackRows }, { data: ledgerRows }] = await Promise.all([
      supabase
        .from("peer_reports")
        .select("target_user_id, severity, moderation_status")
        .in("target_user_id", uniqueIds),
      supabase
        .from("peer_session_feedback")
        .select("listener_id, rating, created_at")
        .in("listener_id", uniqueIds),
      supabase
        .from("listener_points_ledger")
        .select("listener_id, event_type, delta")
        .in("listener_id", uniqueIds)
        .in("event_type", ["report_penalty", "low_rating_penalty"]),
    ]);

    const snapshots: ListenerRiskSnapshot[] = [];

    for (const listenerId of uniqueIds) {
      const reports = (reportRows || []).filter((row: any) => row.target_user_id === listenerId);
      const openReports = reports.filter((row: any) => row.moderation_status === "open").length;
      const severeOpenReports = reports.filter((row: any) =>
        row.moderation_status === "open" && ["high", "critical"].includes(String(row.severity || "").toLowerCase()),
      ).length;

      const ratings = (feedbackRows || [])
        .filter((row: any) => row.listener_id === listenerId)
        .map((row: any) => ({ rating: Number(row.rating), createdAt: row.created_at }))
        .filter((row: any) => Number.isFinite(row.rating) && row.rating >= 1 && row.rating <= 5);

      const ratingCount = ratings.length;
      const averageRating = ratingCount > 0
        ? Math.round((ratings.reduce((sum: number, row: any) => sum + row.rating, 0) / ratingCount) * 100) / 100
        : 0;
      const recentLowRatings = ratings.filter((row: any) =>
        row.rating <= 2 && row.createdAt && new Date(row.createdAt).toISOString() >= sinceIso,
      ).length;

      const penaltyPoints = Math.abs((ledgerRows || [])
        .filter((row: any) => row.listener_id === listenerId && Number(row.delta) < 0)
        .reduce((sum: number, row: any) => sum + Number(row.delta), 0));

      const ratingRisk = ratingCount === 0 ? 12 : Math.max(0, (4 - averageRating) * 15);
      const riskScore = Math.round(
        (openReports * 35)
        + (severeOpenReports * 20)
        + (recentLowRatings * 12)
        + ratingRisk
        + Math.min(50, penaltyPoints / 2),
      );
      const riskLevel: "low" | "medium" | "high" = riskScore >= 85
        ? "high"
        : riskScore >= 45
          ? "medium"
          : "low";

      snapshots.push({
        listenerId,
        riskScore,
        riskLevel,
        openReports,
        severeOpenReports,
        recentLowRatings,
        averageRating,
        ratingCount,
        penaltyPoints,
      });
    }

    return snapshots.sort((a, b) => b.riskScore - a.riskScore);
  }

  async upsertListenerProgress(data: InsertListenerProgress): Promise<ListenerProgress> {
    const payload = toSnakeCase(data);
    payload.last_calculated_at = payload.last_calculated_at || new Date().toISOString();
    const { data: result, error } = await supabase
      .from("listener_progress")
      .upsert(payload, { onConflict: "listener_id" })
      .select("*")
      .single();
    if (error || !result) throw error;
    return mapListenerProgress(result);
  }

  async addListenerPointsLedgerEntry(data: InsertListenerPointsLedger): Promise<ListenerPointsLedger> {
    const payload = toSnakeCase(data);
    const { data: result, error } = await supabase
      .from("listener_points_ledger")
      .insert(payload)
      .select("*")
      .single();
    if (error || !result) throw error;
    return mapListenerPointsLedger(result);
  }

  async applyListenerFeedbackOutcome(data: {
    sessionId: number;
    listenerId: string;
    rating: number;
    hasDetailedComment?: boolean;
  }): Promise<ListenerProgress> {
    const bonusPoints = RATING_BONUS_BY_SCORE[data.rating] ?? 0;
    const lowRatingPenalty = data.rating <= 2 ? LOW_RATING_PENALTY : 0;

    const entries: InsertListenerPointsLedger[] = [
      {
        listenerId: data.listenerId,
        sessionId: data.sessionId,
        eventType: "session_base",
        delta: BASE_SESSION_POINTS,
        meta: { rating: data.rating },
      },
      {
        listenerId: data.listenerId,
        sessionId: data.sessionId,
        eventType: "rating_bonus",
        delta: bonusPoints,
        meta: { rating: data.rating },
      },
    ];

    if (lowRatingPenalty !== 0) {
      entries.push({
        listenerId: data.listenerId,
        sessionId: data.sessionId,
        eventType: "low_rating_penalty",
        delta: lowRatingPenalty,
        meta: { rating: data.rating },
      });
    }

    if (data.hasDetailedComment && data.rating >= 4) {
      entries.push({
        listenerId: data.listenerId,
        sessionId: data.sessionId,
        eventType: "detailed_feedback_bonus",
        delta: DETAILED_FEEDBACK_BONUS,
        meta: { rating: data.rating },
      });
    }

    for (const entry of entries) {
      try {
        await this.addListenerPointsLedgerEntry(entry);
      } catch {
        // Duplicate award attempt for same session should be ignored.
      }
    }

    const ratingSnapshot = await this.getListenerRatingSnapshot(data.listenerId);
    const streakBonus = STREAK_BONUS_BY_MILESTONE[ratingSnapshot.positiveStreak] || 0;
    if (streakBonus > 0) {
      try {
        await this.addListenerPointsLedgerEntry({
          listenerId: data.listenerId,
          sessionId: data.sessionId,
          eventType: "streak_bonus",
          delta: streakBonus,
          meta: { positiveStreak: ratingSnapshot.positiveStreak },
        });
      } catch {
        // Ignore duplicate streak bonus for same session.
      }
    }

    return this.recalculateListenerProgress(data.listenerId);
  }

  async applyListenerReportPenalty(
    listenerId: string,
    reportId: number,
    moderatorId: string,
  ): Promise<ListenerProgress> {
    const { data: report, error: reportError } = await supabase
      .from("peer_reports")
      .select("id, penalty_applied, severity")
      .eq("id", reportId)
      .single();
    if (reportError || !report) {
      return this.recalculateListenerProgress(listenerId);
    }

    if (report.penalty_applied) {
      return this.recalculateListenerProgress(listenerId);
    }

    const { data: existingPenaltyRows } = await supabase
      .from("listener_points_ledger")
      .select("id")
      .eq("listener_id", listenerId)
      .eq("event_type", "report_penalty")
      .contains("meta", { reportId })
      .limit(1);
    if ((existingPenaltyRows || []).length > 0) {
      await supabase
        .from("peer_reports")
        .update({ penalty_applied: true })
        .eq("id", reportId);
      return this.recalculateListenerProgress(listenerId);
    }

    const severity = String(report.severity || "medium").toLowerCase();
    const penaltyDelta = REPORT_SEVERITY_PENALTY[severity] ?? REPORT_SEVERITY_PENALTY.medium;
    await this.addListenerPointsLedgerEntry({
      listenerId,
      sessionId: null,
      eventType: "report_penalty",
      delta: penaltyDelta,
      meta: { reportId, moderatorId, severity },
    });

    await supabase
      .from("peer_reports")
      .update({ penalty_applied: true })
      .eq("id", reportId);

    return this.recalculateListenerProgress(listenerId);
  }

  async submitListenerApplication(data: InsertListenerApplication): Promise<ListenerApplication> {
    const row = toSnakeCase(data);
    row.updated_at = new Date().toISOString();
    const { data: result, error } = await supabase
      .from("listener_applications")
      .insert(row)
      .select("*")
      .single();
    if (error) throw error;
    return mapListenerApplication(result);
  }

  async getListenerApplicationByUser(userId: string): Promise<ListenerApplication | undefined> {
    const { data, error } = await supabase
      .from("listener_applications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error || !data || data.length === 0) return undefined;
    return mapListenerApplication(data[0]);
  }

  async listListenerApplications(status?: string): Promise<ListenerApplication[]> {
    let query = supabase
      .from("listener_applications")
      .select("*")
      .order("created_at", { ascending: false });
    if (status) {
      query = query.eq("status", status);
    }
    const { data, error } = await query;
    if (error || !data) return [];
    return data.map(mapListenerApplication);
  }

  async reviewListenerApplication(
    applicationId: number,
    reviewerId: string,
    status: "approved" | "rejected" | "changes_requested",
    moderationNotes?: string,
  ): Promise<ListenerApplication | undefined> {
    const { data, error } = await supabase
      .from("listener_applications")
      .update({
        status,
        moderation_notes: moderationNotes || null,
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", applicationId)
      .select("*")
      .single();
    if (error || !data) return undefined;

    if (status === "approved") {
      const existingProfile = await this.getListenerProfile(data.user_id);
      await this.createOrUpdateListenerProfile({
        userId: data.user_id,
        displayAlias: existingProfile?.displayAlias || null,
        languages: data.languages || null,
        topics: data.topics || null,
        timezone: existingProfile?.timezone || null,
        verificationStatus: "approved",
        activationStatus: existingProfile?.activationStatus || "inactive",
        trainingCompletedAt: existingProfile?.trainingCompletedAt || null,
        approvedBy: reviewerId,
        approvedAt: new Date().toISOString(),
        isAvailable: existingProfile?.isAvailable || false,
      });
      await this.updateUser(data.user_id, { role: "listener" });
    }

    return mapListenerApplication(data);
  }

  async setListenerActivation(
    userId: string,
    activationStatus: "inactive" | "trial" | "live" | "suspended",
    reviewerId?: string,
  ): Promise<ListenerProfile | undefined> {
    const payload: any = {
      activation_status: activationStatus,
      updated_at: new Date().toISOString(),
    };
    if (reviewerId) {
      payload.approved_by = reviewerId;
      payload.approved_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("listener_profiles")
      .update(payload)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (error || !data) return undefined;
    return mapListenerProfile(data);
  }

  async setListenerAvailability(userId: string, isAvailable: boolean): Promise<ListenerProfile | undefined> {
    const { data, error } = await supabase
      .from("listener_profiles")
      .update({
        is_available: isAvailable,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .select("*")
      .single();
    if (error || !data) return undefined;
    return mapListenerProfile(data);
  }

  async listAvailableListeners(language?: string, topicTags?: string[]): Promise<ListenerProfile[]> {
    let query = supabase
      .from("listener_profiles")
      .select("*")
      .eq("is_available", true)
      .eq("verification_status", "approved")
      .in("activation_status", ["trial", "live"])
      .order("last_seen_at", { ascending: false });

    if (language) {
      query = query.contains("languages", [language]);
    }
    if (topicTags && topicTags.length > 0) {
      query = query.overlaps("topics", topicTags);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data.map(mapListenerProfile);
  }

  // ---- Queue, peer sessions and messaging ----

  async joinListenerQueue(data: InsertListenerQueueEntry): Promise<ListenerQueueEntry> {
    const existing = await this.getActiveQueueEntry(data.clientId);
    if (existing) return existing;

    const row = toSnakeCase(data);
    row.status = row.status || "waiting";
    row.updated_at = new Date().toISOString();
    const { data: result, error } = await supabase
      .from("listener_queue")
      .insert(row)
      .select("*")
      .single();
    if (error) throw error;
    return mapListenerQueueEntry(result);
  }

  async leaveListenerQueue(clientId: string): Promise<void> {
    await supabase
      .from("listener_queue")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("client_id", clientId)
      .in("status", ["waiting", "matched"]);
  }

  async getActiveQueueEntry(clientId: string): Promise<ListenerQueueEntry | undefined> {
    const { data, error } = await supabase
      .from("listener_queue")
      .select("*")
      .eq("client_id", clientId)
      .in("status", ["waiting", "matched"])
      .order("created_at", { ascending: false })
      .limit(1);
    if (error || !data || data.length === 0) return undefined;
    return mapListenerQueueEntry(data[0]);
  }

  async listWaitingQueueEntries(): Promise<ListenerQueueEntry[]> {
    const { data, error } = await supabase
      .from("listener_queue")
      .select("*")
      .eq("status", "waiting")
      .order("created_at", { ascending: true });
    if (error || !data) return [];
    return data.map(mapListenerQueueEntry);
  }

  async createPeerSession(data: InsertPeerSession): Promise<PeerSession> {
    const row = toSnakeCase(data);
    const { data: result, error } = await supabase
      .from("peer_sessions")
      .insert(row)
      .select("*")
      .single();
    if (error) throw error;

    if (data.queueEntryId) {
      await supabase
        .from("listener_queue")
        .update({
          status: "matched",
          matched_listener_id: data.listenerId,
          session_id: result.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.queueEntryId);
    }

    return mapPeerSession(result);
  }

  async getPeerSession(id: number): Promise<PeerSession | undefined> {
    const { data, error } = await supabase
      .from("peer_sessions")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) return undefined;
    return mapPeerSession(data);
  }

  async getPeerSessionsByUser(userId: string): Promise<(PeerSession & { otherUser: User })[]> {
    const { data, error } = await supabase
      .from("peer_sessions")
      .select("*")
      .or(`client_id.eq.${userId},listener_id.eq.${userId}`)
      .order("created_at", { ascending: false });
    if (error || !data) return [];

    const sessions: (PeerSession & { otherUser: User })[] = [];
    for (const session of data) {
      const otherId = session.client_id === userId ? session.listener_id : session.client_id;
      const otherUser = await this.getUser(otherId);
      if (!otherUser) continue;
      sessions.push({ ...mapPeerSession(session), otherUser });
    }
    return sessions;
  }

  async endPeerSession(id: number): Promise<PeerSession | undefined> {
    const { data, error } = await supabase
      .from("peer_sessions")
      .update({
        status: "completed",
        ended_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error || !data) return undefined;

    if (data.queue_entry_id) {
      await supabase
        .from("listener_queue")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", data.queue_entry_id);
    }

    return mapPeerSession(data);
  }

  async createPeerMessage(data: InsertPeerMessage): Promise<PeerMessage> {
    const row = toSnakeCase(data);
    const { data: result, error } = await supabase
      .from("peer_messages")
      .insert(row)
      .select("*")
      .single();
    if (error) throw error;
    return mapPeerMessage(result);
  }

  async getPeerMessages(sessionId: number): Promise<PeerMessage[]> {
    const { data, error } = await supabase
      .from("peer_messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    if (error || !data) return [];
    return data.map(mapPeerMessage);
  }

  async createPeerSessionFeedback(data: InsertPeerSessionFeedback): Promise<PeerSessionFeedback> {
    const row = toSnakeCase(data);
    const { data: result, error } = await supabase
      .from("peer_session_feedback")
      .insert(row)
      .select("*")
      .single();
    if (error) throw error;
    return mapPeerSessionFeedback(result);
  }

  async createPeerReport(data: InsertPeerReport): Promise<PeerReport> {
    const row = toSnakeCase(data);
    const { data: result, error } = await supabase
      .from("peer_reports")
      .insert(row)
      .select("*")
      .single();
    if (error) throw error;
    return mapPeerReport(result);
  }

  async listOpenPeerReports(): Promise<PeerReport[]> {
    const { data, error } = await supabase
      .from("peer_reports")
      .select("*")
      .eq("moderation_status", "open")
      .order("created_at", { ascending: false });
    if (error || !data) return [];
    return data.map(mapPeerReport);
  }

  async resolvePeerReport(reportId: number, moderatorId: string): Promise<PeerReport | undefined> {
    const { data, error } = await supabase
      .from("peer_reports")
      .update({
        moderation_status: "resolved",
        resolved_by: moderatorId,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", reportId)
      .select("*")
      .single();
    if (error || !data) return undefined;
    return mapPeerReport(data);
  }

  // ---- Therapist Verification ----

  async upsertTherapistVerification(data: InsertTherapistVerification): Promise<TherapistVerification> {
    const row = {
      therapist_id: data.therapistId,
      document_type: data.documentType,
      document_url: data.documentUrl,
      status: "pending",
      submitted_at: new Date().toISOString(),
    };
    const { data: result, error } = await supabase
      .from("therapist_verifications")
      .upsert(row, { onConflict: "therapist_id,document_type" })
      .select("*")
      .single();
    if (error) throw error;
    return mapTherapistVerification(result);
  }

  async getTherapistVerifications(therapistId: string): Promise<TherapistVerification[]> {
    const { data, error } = await supabase
      .from("therapist_verifications")
      .select("*")
      .eq("therapist_id", therapistId)
      .order("submitted_at", { ascending: false });
    if (error || !data) return [];
    return data.map(mapTherapistVerification);
  }

  async getAllVerifications(status?: string): Promise<(TherapistVerification & { therapistName?: string })[]> {
    let query = supabase
      .from("therapist_verifications")
      .select("*")
      .order("submitted_at", { ascending: false });
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error || !data) return [];

    const verifications = data.map(mapTherapistVerification);

    // Enrich with therapist names
    const therapistIds = Array.from(new Set(verifications.map((v) => v.therapistId)));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", therapistIds);

    const nameMap = new Map<string, string>();
    if (profiles) {
      for (const p of profiles) {
        const name = [p.first_name, p.last_name].filter(Boolean).join(" ");
        nameMap.set(p.id, name || p.id.slice(0, 8));
      }
    }

    return verifications.map((v) => ({ ...v, therapistName: nameMap.get(v.therapistId) }));
  }

  async reviewTherapistVerification(
    id: number,
    status: "approved" | "rejected",
    reviewerId: string,
    notes?: string,
  ): Promise<TherapistVerification | undefined> {
    const { data, error } = await supabase
      .from("therapist_verifications")
      .update({
        status,
        reviewer_id: reviewerId,
        reviewer_notes: notes || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error || !data) return undefined;
    return mapTherapistVerification(data);
  }

  // ---- Admin Analytics ----

  async getAdminAnalytics(): Promise<{
    totalUsers: number;
    activeTherapists: number;
    sessionsThisWeek: number;
    revenueThisMonth: number;
    newUsersThisWeek: number;
    pendingVerifications: number;
  }> {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [
      { count: totalUsers },
      { count: activeTherapists },
      { count: sessionsThisWeek },
      { data: revenueData },
      { count: newUsersThisWeek },
      { count: pendingVerifications },
    ] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("therapist_profiles").select("id", { count: "exact", head: true }).eq("verified", true),
      supabase.from("appointments").select("id", { count: "exact", head: true })
        .eq("status", "completed").gte("scheduled_at", weekAgo),
      supabase.from("payment_transactions").select("amount_dinar")
        .eq("status", "paid").gte("created_at", monthAgo),
      supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
      supabase.from("therapist_verifications").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);

    const revenueThisMonth = (revenueData || []).reduce(
      (sum: number, row: any) => sum + (row.amount_dinar || 0),
      0,
    );

    return {
      totalUsers: totalUsers || 0,
      activeTherapists: activeTherapists || 0,
      sessionsThisWeek: sessionsThisWeek || 0,
      revenueThisMonth,
      newUsersThisWeek: newUsersThisWeek || 0,
      pendingVerifications: pendingVerifications || 0,
    };
  }

}

export const storage = new DatabaseStorage();
