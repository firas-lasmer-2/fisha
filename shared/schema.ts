import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, boolean, timestamp, jsonb, index, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role", { length: 20 }).default("client").notNull(),
  phone: varchar("phone"),
  languagePreference: varchar("language_preference", { length: 10 }).default("ar"),
  governorate: varchar("governorate"),
  bio: text("bio"),
  isAnonymous: boolean("is_anonymous").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const therapistProfiles = pgTable("therapist_profiles", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  licenseNumber: varchar("license_number"),
  specializations: text("specializations").array(),
  languages: text("languages").array(),
  rateDinar: real("rate_dinar").default(80),
  verified: boolean("verified").default(false),
  rating: real("rating").default(0),
  reviewCount: integer("review_count").default(0),
  yearsExperience: integer("years_experience").default(0),
  education: text("education"),
  approach: text("approach"),
  availableDays: text("available_days").array(),
  availableHoursStart: varchar("available_hours_start", { length: 5 }).default("09:00"),
  availableHoursEnd: varchar("available_hours_end", { length: 5 }).default("17:00"),
  acceptsOnline: boolean("accepts_online").default(true),
  acceptsInPerson: boolean("accepts_in_person").default(false),
  officeAddress: text("office_address"),
  gender: varchar("gender", { length: 10 }),
  headline: text("headline"),
  aboutMe: text("about_me"),
  videoIntroUrl: varchar("video_intro_url"),
  officePhotos: text("office_photos").array(),
  faqItems: jsonb("faq_items"),
  socialLinks: jsonb("social_links"),
  slug: varchar("slug").unique(),
  profileThemeColor: varchar("profile_theme_color", { length: 20 }),
  acceptingNewClients: boolean("accepting_new_clients").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const therapistReviews = pgTable("therapist_reviews", {
  id: serial("id").primaryKey(),
  therapistId: varchar("therapist_id").notNull().references(() => users.id),
  clientId: varchar("client_id").notNull().references(() => users.id),
  appointmentId: integer("appointment_id").references(() => appointments.id),
  overallRating: integer("overall_rating").notNull(),
  helpfulnessRating: integer("helpfulness_rating"),
  communicationRating: integer("communication_rating"),
  comment: text("comment"),
  therapistResponse: text("therapist_response"),
  isAnonymous: boolean("is_anonymous").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const therapyConversations = pgTable("therapy_conversations", {
  id: serial("id").primaryKey(),
  clientId: varchar("client_id").notNull().references(() => users.id),
  therapistId: varchar("therapist_id").notNull().references(() => users.id),
  status: varchar("status", { length: 20 }).default("active").notNull(),
  lastMessageAt: timestamp("last_message_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const therapyMessages = pgTable("therapy_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => therapyConversations.id),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  messageType: varchar("message_type", { length: 20 }).default("text").notNull(),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  clientId: varchar("client_id").notNull().references(() => users.id),
  therapistId: varchar("therapist_id").notNull().references(() => users.id),
  scheduledAt: timestamp("scheduled_at").notNull(),
  durationMinutes: integer("duration_minutes").default(50),
  sessionType: varchar("session_type", { length: 20 }).default("chat").notNull(),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  notes: text("notes"),
  priceDinar: real("price_dinar"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const moodEntries = pgTable("mood_entries", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  moodScore: integer("mood_score").notNull(),
  emotions: text("emotions").array(),
  notes: text("notes"),
  triggers: text("triggers").array(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const journalEntries = pgTable("journal_entries", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  title: varchar("title"),
  content: text("content").notNull(),
  promptId: integer("prompt_id"),
  mood: varchar("mood", { length: 20 }),
  isSharedWithTherapist: boolean("is_shared_with_therapist").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const resources = pgTable("resources", {
  id: serial("id").primaryKey(),
  titleAr: text("title_ar").notNull(),
  titleFr: text("title_fr").notNull(),
  titleDarija: text("title_darija"),
  contentAr: text("content_ar").notNull(),
  contentFr: text("content_fr").notNull(),
  contentDarija: text("content_darija"),
  category: varchar("category", { length: 50 }).notNull(),
  imageUrl: varchar("image_url"),
  readTimeMinutes: integer("read_time_minutes").default(5),
  createdAt: timestamp("created_at").defaultNow(),
});

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTherapistProfileSchema = createInsertSchema(therapistProfiles).omit({ id: true, createdAt: true });
export const insertAppointmentSchema = createInsertSchema(appointments).omit({ id: true, createdAt: true });
export const insertMoodEntrySchema = createInsertSchema(moodEntries).omit({ id: true, createdAt: true });
export const insertJournalEntrySchema = createInsertSchema(journalEntries).omit({ id: true, createdAt: true });
export const insertTherapyMessageSchema = createInsertSchema(therapyMessages).omit({ id: true, createdAt: true });
export const insertTherapyConversationSchema = createInsertSchema(therapyConversations).omit({ id: true, createdAt: true, lastMessageAt: true });
export const insertResourceSchema = createInsertSchema(resources).omit({ id: true, createdAt: true });
export const insertTherapistReviewSchema = createInsertSchema(therapistReviews).omit({ id: true, createdAt: true });

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type TherapistProfile = typeof therapistProfiles.$inferSelect;
export type InsertTherapistProfile = z.infer<typeof insertTherapistProfileSchema>;
export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type MoodEntry = typeof moodEntries.$inferSelect;
export type InsertMoodEntry = z.infer<typeof insertMoodEntrySchema>;
export type JournalEntry = typeof journalEntries.$inferSelect;
export type InsertJournalEntry = z.infer<typeof insertJournalEntrySchema>;
export type TherapyConversation = typeof therapyConversations.$inferSelect;
export type InsertTherapyConversation = z.infer<typeof insertTherapyConversationSchema>;
export type TherapyMessage = typeof therapyMessages.$inferSelect;
export type InsertTherapyMessage = z.infer<typeof insertTherapyMessageSchema>;
export type Resource = typeof resources.$inferSelect;
export type InsertResource = z.infer<typeof insertResourceSchema>;
export type TherapistReview = typeof therapistReviews.$inferSelect;
export type InsertTherapistReview = z.infer<typeof insertTherapistReviewSchema>;
