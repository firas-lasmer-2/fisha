import {
  users, therapistProfiles, therapyConversations, therapyMessages,
  appointments, moodEntries, journalEntries, resources, therapistReviews,
  type User, type InsertUser,
  type TherapistProfile, type InsertTherapistProfile,
  type TherapyConversation, type InsertTherapyConversation,
  type TherapyMessage, type InsertTherapyMessage,
  type Appointment, type InsertAppointment,
  type MoodEntry, type InsertMoodEntry,
  type JournalEntry, type InsertJournalEntry,
  type Resource, type InsertResource,
  type TherapistReview, type InsertTherapistReview,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, ilike, gte, lte, sql, avg, count } from "drizzle-orm";

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
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: InsertUser & { id?: string }): Promise<User> {
    if (userData.id) {
      const [user] = await db
        .insert(users)
        .values(userData as any)
        .onConflictDoUpdate({
          target: users.id,
          set: { ...userData, updatedAt: new Date() },
        })
        .returning();
      return user;
    }
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(users).set({ ...data, updatedAt: new Date() }).where(eq(users.id, id)).returning();
    return user;
  }

  async getTherapistProfile(userId: string): Promise<TherapistProfile | undefined> {
    const [profile] = await db.select().from(therapistProfiles).where(eq(therapistProfiles.userId, userId));
    return profile;
  }

  async getTherapistProfiles(filters?: { specialization?: string; language?: string; minPrice?: number; maxPrice?: number; gender?: string }): Promise<(TherapistProfile & { user: User })[]> {
    let query = db.select().from(therapistProfiles).innerJoin(users, eq(therapistProfiles.userId, users.id));

    const results = await query;
    let profiles = results.map((r) => ({ ...r.therapist_profiles, user: r.users }));

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
    const [result] = await db.insert(therapistProfiles).values(profile).returning();
    return result;
  }

  async updateTherapistProfile(userId: string, data: Partial<InsertTherapistProfile>): Promise<TherapistProfile | undefined> {
    const [result] = await db.update(therapistProfiles).set(data).where(eq(therapistProfiles.userId, userId)).returning();
    return result;
  }

  async getConversation(id: number): Promise<TherapyConversation | undefined> {
    const [conv] = await db.select().from(therapyConversations).where(eq(therapyConversations.id, id));
    return conv;
  }

  async getConversationsByUser(userId: string): Promise<(TherapyConversation & { otherUser: User })[]> {
    const convs = await db.select().from(therapyConversations)
      .where(or(eq(therapyConversations.clientId, userId), eq(therapyConversations.therapistId, userId)))
      .orderBy(desc(therapyConversations.lastMessageAt));

    const result = [];
    for (const conv of convs) {
      const otherId = conv.clientId === userId ? conv.therapistId : conv.clientId;
      const [otherUser] = await db.select().from(users).where(eq(users.id, otherId));
      if (otherUser) {
        result.push({ ...conv, otherUser });
      }
    }
    return result;
  }

  async createConversation(conv: InsertTherapyConversation): Promise<TherapyConversation> {
    const [result] = await db.insert(therapyConversations).values(conv).returning();
    return result;
  }

  async getOrCreateConversation(clientId: string, therapistId: string): Promise<TherapyConversation> {
    const [existing] = await db.select().from(therapyConversations)
      .where(and(eq(therapyConversations.clientId, clientId), eq(therapyConversations.therapistId, therapistId)));
    if (existing) return existing;
    return this.createConversation({ clientId, therapistId, status: "active" });
  }

  async getMessages(conversationId: number): Promise<TherapyMessage[]> {
    return db.select().from(therapyMessages)
      .where(eq(therapyMessages.conversationId, conversationId))
      .orderBy(therapyMessages.createdAt);
  }

  async createMessage(msg: InsertTherapyMessage): Promise<TherapyMessage> {
    const [result] = await db.insert(therapyMessages).values(msg).returning();
    await db.update(therapyConversations).set({ lastMessageAt: new Date() }).where(eq(therapyConversations.id, msg.conversationId));
    return result;
  }

  async markMessagesRead(conversationId: number, userId: string): Promise<void> {
    await db.update(therapyMessages)
      .set({ isRead: true })
      .where(and(
        eq(therapyMessages.conversationId, conversationId),
        sql`${therapyMessages.senderId} != ${userId}`
      ));
  }

  async getUnreadCount(userId: string): Promise<number> {
    const convs = await db.select().from(therapyConversations)
      .where(or(eq(therapyConversations.clientId, userId), eq(therapyConversations.therapistId, userId)));

    let count = 0;
    for (const conv of convs) {
      const msgs = await db.select().from(therapyMessages)
        .where(and(
          eq(therapyMessages.conversationId, conv.id),
          eq(therapyMessages.isRead, false),
          sql`${therapyMessages.senderId} != ${userId}`
        ));
      count += msgs.length;
    }
    return count;
  }

  async getAppointments(userId: string): Promise<(Appointment & { otherUser: User })[]> {
    const apts = await db.select().from(appointments)
      .where(or(eq(appointments.clientId, userId), eq(appointments.therapistId, userId)))
      .orderBy(desc(appointments.scheduledAt));

    const result = [];
    for (const apt of apts) {
      const otherId = apt.clientId === userId ? apt.therapistId : apt.clientId;
      const [otherUser] = await db.select().from(users).where(eq(users.id, otherId));
      if (otherUser) {
        result.push({ ...apt, otherUser });
      }
    }
    return result;
  }

  async createAppointment(apt: InsertAppointment): Promise<Appointment> {
    const [result] = await db.insert(appointments).values(apt).returning();
    return result;
  }

  async updateAppointmentStatus(id: number, status: string): Promise<Appointment | undefined> {
    const [result] = await db.update(appointments).set({ status }).where(eq(appointments.id, id)).returning();
    return result;
  }

  async getMoodEntries(userId: string, limit = 30): Promise<MoodEntry[]> {
    return db.select().from(moodEntries)
      .where(eq(moodEntries.userId, userId))
      .orderBy(desc(moodEntries.createdAt))
      .limit(limit);
  }

  async createMoodEntry(entry: InsertMoodEntry): Promise<MoodEntry> {
    const [result] = await db.insert(moodEntries).values(entry).returning();
    return result;
  }

  async getJournalEntries(userId: string): Promise<JournalEntry[]> {
    return db.select().from(journalEntries)
      .where(eq(journalEntries.userId, userId))
      .orderBy(desc(journalEntries.createdAt));
  }

  async createJournalEntry(entry: InsertJournalEntry): Promise<JournalEntry> {
    const [result] = await db.insert(journalEntries).values(entry).returning();
    return result;
  }

  async updateJournalEntry(id: number, data: Partial<InsertJournalEntry>): Promise<JournalEntry | undefined> {
    const [result] = await db.update(journalEntries).set(data).where(eq(journalEntries.id, id)).returning();
    return result;
  }

  async deleteJournalEntry(id: number): Promise<void> {
    await db.delete(journalEntries).where(eq(journalEntries.id, id));
  }

  async getResources(category?: string): Promise<Resource[]> {
    if (category) {
      return db.select().from(resources).where(eq(resources.category, category));
    }
    return db.select().from(resources);
  }

  async createResource(resource: InsertResource): Promise<Resource> {
    const [result] = await db.insert(resources).values(resource).returning();
    return result;
  }

  async getReviewsByTherapist(therapistId: string): Promise<(TherapistReview & { client?: Partial<User> })[]> {
    const reviews = await db.select().from(therapistReviews)
      .where(eq(therapistReviews.therapistId, therapistId))
      .orderBy(desc(therapistReviews.createdAt));

    const result = [];
    for (const review of reviews) {
      if (review.isAnonymous) {
        result.push({ ...review, client: undefined });
      } else {
        const [client] = await db.select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          governorate: users.governorate,
        }).from(users).where(eq(users.id, review.clientId));
        result.push({ ...review, client: client || undefined });
      }
    }
    return result;
  }

  async getReviewByAppointment(appointmentId: number): Promise<TherapistReview | undefined> {
    const [review] = await db.select().from(therapistReviews)
      .where(eq(therapistReviews.appointmentId, appointmentId));
    return review;
  }

  async createReview(data: InsertTherapistReview): Promise<TherapistReview> {
    const [result] = await db.insert(therapistReviews).values(data).returning();
    await this.updateTherapistRating(data.therapistId);
    return result;
  }

  async addTherapistResponse(reviewId: number, response: string): Promise<TherapistReview | undefined> {
    const [result] = await db.update(therapistReviews)
      .set({ therapistResponse: response })
      .where(eq(therapistReviews.id, reviewId))
      .returning();
    return result;
  }

  async getTherapistBySlug(slug: string): Promise<TherapistProfile | undefined> {
    const [profile] = await db.select().from(therapistProfiles)
      .where(eq(therapistProfiles.slug, slug));
    return profile;
  }

  async updateTherapistRating(therapistId: string): Promise<void> {
    const reviews = await db.select().from(therapistReviews)
      .where(eq(therapistReviews.therapistId, therapistId));

    if (reviews.length === 0) return;

    const avgRating = reviews.reduce((sum, r) => sum + r.overallRating, 0) / reviews.length;
    await db.update(therapistProfiles)
      .set({ rating: Math.round(avgRating * 10) / 10, reviewCount: reviews.length })
      .where(eq(therapistProfiles.userId, therapistId));
  }

  async getCompletedAppointmentCount(therapistId: string): Promise<number> {
    const result = await db.select().from(appointments)
      .where(and(eq(appointments.therapistId, therapistId), eq(appointments.status, "completed")));
    return result.length;
  }
}

export const storage = new DatabaseStorage();
