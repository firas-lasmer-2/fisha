import { supabaseAdmin } from "./supabase";
import {
  type User, type InsertUser,
  type TherapistProfile, type InsertTherapistProfile,
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
  type ListenerApplication, type InsertListenerApplication,
  type ListenerQueueEntry, type InsertListenerQueueEntry,
  type PeerSession, type InsertPeerSession,
  type PeerMessage, type InsertPeerMessage,
  type PeerSessionFeedback, type InsertPeerSessionFeedback,
  type PeerReport, type InsertPeerReport,
  type Plan, type InsertPlan,
  type Subscription, type InsertSubscription,
  type Entitlement, type InsertEntitlement,
  type FcmToken,
  mapProfile, mapTherapistProfile, mapTherapistReview,
  mapConversation, mapMessage, mapAppointment,
  mapMoodEntry, mapJournalEntry, mapResource,
  mapPaymentTransaction, mapCrisisReport, mapOnboardingResponse,
  mapListenerProfile, mapListenerApplication, mapListenerQueueEntry,
  mapPeerSession, mapPeerMessage, mapPeerSessionFeedback, mapPeerReport,
  mapPlan, mapSubscription, mapEntitlement,
  toSnakeCase,
} from "@shared/schema";

const supabase = supabaseAdmin;

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: InsertUser & { id?: string }): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;

  getTherapistProfile(userId: string): Promise<TherapistProfile | undefined>;
  getTherapistProfiles(filters?: { specialization?: string; language?: string; minPrice?: number; maxPrice?: number; gender?: string }): Promise<(TherapistProfile & { user: User })[]>;
  createTherapistProfile(profile: InsertTherapistProfile): Promise<TherapistProfile>;
  updateTherapistProfile(userId: string, data: Partial<InsertTherapistProfile>): Promise<TherapistProfile | undefined>;

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
  createAppointment(apt: InsertAppointment): Promise<Appointment>;
  updateAppointmentStatus(id: number, status: string): Promise<Appointment | undefined>;

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

  getPlans(): Promise<Plan[]>;
  getSubscriptionByUser(userId: string): Promise<Subscription | undefined>;
  createOrUpdateSubscription(data: InsertSubscription): Promise<Subscription>;
  updateSubscriptionStatus(
    userId: string,
    status: string,
    cancelAtPeriodEnd?: boolean,
  ): Promise<Subscription | undefined>;
  getEntitlement(userId: string): Promise<Entitlement | undefined>;
  upsertEntitlement(data: InsertEntitlement): Promise<Entitlement>;
  consumePeerMinutes(userId: string, minutes: number): Promise<Entitlement | undefined>;
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

  // ---- Billing and entitlements ----

  async getPlans(): Promise<Plan[]> {
    const { data, error } = await supabase
      .from("plans")
      .select("*")
      .order("priority_level", { ascending: true });
    if (error || !data) return [];
    return data.map(mapPlan);
  }

  async getSubscriptionByUser(userId: string): Promise<Subscription | undefined> {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["active", "trialing"])
      .order("created_at", { ascending: false })
      .limit(1);
    if (error || !data || data.length === 0) return undefined;
    return mapSubscription(data[0]);
  }

  async createOrUpdateSubscription(data: InsertSubscription): Promise<Subscription> {
    const existing = await this.getSubscriptionByUser(data.userId);
    const row = toSnakeCase(data);
    row.updated_at = new Date().toISOString();

    if (existing) {
      const { data: result, error } = await supabase
        .from("subscriptions")
        .update(row)
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) throw error;
      return mapSubscription(result);
    }

    const { data: result, error } = await supabase
      .from("subscriptions")
      .insert(row)
      .select("*")
      .single();
    if (error) throw error;
    return mapSubscription(result);
  }

  async updateSubscriptionStatus(
    userId: string,
    status: string,
    cancelAtPeriodEnd = false,
  ): Promise<Subscription | undefined> {
    const { data: currentRows, error: readError } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (readError || !currentRows || currentRows.length === 0) return undefined;

    const { data, error } = await supabase
      .from("subscriptions")
      .update({
        status,
        cancel_at_period_end: cancelAtPeriodEnd,
        updated_at: new Date().toISOString(),
      })
      .eq("id", currentRows[0].id)
      .select("*")
      .single();
    if (error || !data) return undefined;
    return mapSubscription(data);
  }

  async getEntitlement(userId: string): Promise<Entitlement | undefined> {
    const { data, error } = await supabase
      .from("entitlements")
      .select("*")
      .eq("user_id", userId)
      .single();
    if (error || !data) return undefined;
    return mapEntitlement(data);
  }

  async upsertEntitlement(data: InsertEntitlement): Promise<Entitlement> {
    const row = toSnakeCase(data);
    row.updated_at = new Date().toISOString();
    const { data: result, error } = await supabase
      .from("entitlements")
      .upsert(row, { onConflict: "user_id" })
      .select("*")
      .single();
    if (error) throw error;
    return mapEntitlement(result);
  }

  async consumePeerMinutes(userId: string, minutes: number): Promise<Entitlement | undefined> {
    const entitlement = await this.getEntitlement(userId);
    if (!entitlement) return undefined;

    const next = Math.max(0, entitlement.peerMinutesRemaining - Math.max(0, minutes));
    return this.upsertEntitlement({
      userId,
      planCode: entitlement.planCode,
      peerMinutesRemaining: next,
      priorityLevel: entitlement.priorityLevel,
      therapistDiscountPct: entitlement.therapistDiscountPct,
      renewedAt: entitlement.renewedAt || new Date().toISOString(),
    });
  }
}

export const storage = new DatabaseStorage();
