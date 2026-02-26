import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { supabaseAdmin } from "./supabase";
import OpenAI from "openai";
import crypto from "crypto";
import { sendPushToTokens } from "./notifications";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined,
});

// Crisis keywords for auto-detection (Arabic, French, Darija)
const CRISIS_KEYWORDS = [
  // Arabic
  "انتحار", "أقتل نفسي", "أريد الموت", "لا أريد العيش", "أنهي حياتي",
  // French
  "suicide", "me tuer", "mourir", "en finir", "plus envie de vivre",
  // Darija
  "نقتل روحي", "نموت", "ما نحبش نعيش", "نكمل حياتي",
];

// ---- Auth middleware ----

async function extractUser(req: Request): Promise<{ id: string; email?: string } | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return { id: user.id, email: user.email };
}

function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  extractUser(req).then((user) => {
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    (req as any).user = user;
    next();
  }).catch(() => {
    res.status(401).json({ message: "Unauthorized" });
  });
}

function requireRoles(roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authUser = (req as any).user as { id: string } | undefined;
    if (!authUser?.id) return res.status(401).json({ message: "Unauthorized" });

    const profile = await storage.getUser(authUser.id);
    if (!profile || !roles.includes(profile.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    (req as any).profile = profile;
    next();
  };
}

function generateAnonymousAlias(prefix: "client" | "listener"): string {
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${suffix}`;
}

function normalizeStringArray(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    const cleaned = value
      .map((item) => String(item).trim())
      .filter((item) => item.length > 0);
    return cleaned.length > 0 ? cleaned : null;
  }

  if (typeof value === "string") {
    const cleaned = value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    return cleaned.length > 0 ? cleaned : null;
  }

  return null;
}

function verifyWebhookSignature(req: Request, secret: string | undefined, headerName: string): boolean {
  if (!secret) return true;

  const provided = req.header(headerName);
  if (!provided || !req.rawBody) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(req.rawBody as Buffer)
    .digest("hex");

  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const notifyUser = async (
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ) => {
    try {
      const tokens = await storage.getFcmTokensByUser(userId);
      await sendPushToTokens(tokens, { title, body, data });
    } catch {
      // Ignore push notification failures to avoid blocking API requests.
    }
  };

  const listModeratorIds = async (): Promise<string[]> => {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .in("role", ["moderator", "admin"]);
    return (data || []).map((row: any) => row.id);
  };

  // ---- Auth routes ----

  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, password, role, firstName, lastName, phone } = req.body;
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error) return res.status(400).json({ message: error.message });

      // Update profile with additional data
      if (data.user) {
        await storage.updateUser(data.user.id, {
          firstName,
          lastName,
          role: role || "client",
          phone,
        });
      }

      // Sign in immediately
      const { data: session, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) return res.status(400).json({ message: signInError.message });

      const profile = await storage.getUser(data.user!.id);
      res.json({
        user: profile,
        session: session.session,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to sign up" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      const { data, error } = await supabaseAdmin.auth.signInWithPassword({
        email,
        password,
      });
      if (error) return res.status(401).json({ message: error.message });

      const profile = await storage.getUser(data.user.id);
      res.json({
        user: profile,
        session: data.session,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to log in" });
    }
  });

  app.post("/api/auth/login/otp", async (req, res) => {
    try {
      const { phone } = req.body;
      const { error } = await supabaseAdmin.auth.signInWithOtp({ phone });
      if (error) return res.status(400).json({ message: error.message });
      res.json({ message: "OTP sent" });
    } catch (error) {
      res.status(500).json({ message: "Failed to send OTP" });
    }
  });

  app.post("/api/auth/verify-otp", async (req, res) => {
    try {
      const { phone, token } = req.body;
      const { data, error } = await supabaseAdmin.auth.verifyOtp({
        phone,
        token,
        type: "sms",
      });
      if (error) return res.status(400).json({ message: error.message });

      const profile = data.user ? await storage.getUser(data.user.id) : null;
      res.json({
        user: profile,
        session: data.session,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to verify OTP" });
    }
  });

  app.get("/api/auth/user", async (req, res) => {
    try {
      const authUser = await extractUser(req);
      if (!authUser) return res.status(401).json({ message: "Unauthorized" });
      const profile = await storage.getUser(authUser.id);
      if (!profile) return res.status(404).json({ message: "Profile not found" });
      res.json(profile);
    } catch (error) {
      res.status(500).json({ message: "Failed to get user" });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    res.json({ message: "Logged out" });
  });

  app.post("/api/auth/refresh", async (req, res) => {
    try {
      const { refreshToken } = req.body;
      const { data, error } = await supabaseAdmin.auth.refreshSession({
        refresh_token: refreshToken,
      });
      if (error) return res.status(401).json({ message: error.message });
      res.json({ session: data.session });
    } catch (error) {
      res.status(500).json({ message: "Failed to refresh session" });
    }
  });

  // ---- Therapist routes ----

  app.get("/api/therapists", async (req, res) => {
    try {
      const filters = {
        specialization: req.query.specialization as string | undefined,
        language: req.query.language as string | undefined,
        gender: req.query.gender as string | undefined,
        minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
        maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
      };
      const therapists = await storage.getTherapistProfiles(filters);
      res.json(therapists);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch therapists" });
    }
  });

  app.get("/api/therapists/:userId", async (req, res) => {
    try {
      const profile = await storage.getTherapistProfile(req.params.userId);
      if (!profile) return res.status(404).json({ message: "Not found" });
      const user = await storage.getUser(req.params.userId);
      res.json({ ...profile, user });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch therapist" });
    }
  });

  app.post("/api/therapists", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      await storage.updateUser(userId, { role: "therapist" });
      const profile = await storage.createTherapistProfile({ ...req.body, userId });
      res.status(201).json(profile);
    } catch (error) {
      res.status(500).json({ message: "Failed to create therapist profile" });
    }
  });

  app.patch("/api/therapists", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const profile = await storage.updateTherapistProfile(userId, req.body);
      res.json(profile);
    } catch (error) {
      res.status(500).json({ message: "Failed to update therapist profile" });
    }
  });

  // ---- Conversation routes ----

  app.get("/api/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const conversations = await storage.getConversationsByUser(userId);
      res.json(conversations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  app.post("/api/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { therapistId } = req.body;
      const conv = await storage.getOrCreateConversation(userId, therapistId);
      res.status(201).json(conv);
    } catch (error) {
      res.status(500).json({ message: "Failed to create conversation" });
    }
  });

  app.post("/api/conversations/:id/encryption-keys", isAuthenticated, async (req: any, res) => {
    try {
      const convId = parseInt(req.params.id, 10);
      const userId = req.user.id;
      const { clientKeyEncrypted, therapistKeyEncrypted, keyVersion } = req.body;

      if (!clientKeyEncrypted || !therapistKeyEncrypted) {
        return res.status(400).json({ message: "Missing encrypted conversation keys" });
      }

      const conversation = await storage.getConversation(convId);
      if (!conversation) return res.status(404).json({ message: "Conversation not found" });
      if (conversation.clientId !== userId && conversation.therapistId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const updated = await storage.setConversationEncryptionKeys(convId, {
        clientKeyEncrypted,
        therapistKeyEncrypted,
        keyVersion: typeof keyVersion === "number" ? keyVersion : 1,
      });

      if (!updated) return res.status(500).json({ message: "Failed to store encryption keys" });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to store encryption keys" });
    }
  });

  app.get("/api/conversations/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const convId = parseInt(req.params.id);
      const userId = req.user.id;
      await storage.markMessagesRead(convId, userId);
      const messages = await storage.getMessages(convId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post("/api/conversations/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const convId = parseInt(req.params.id);
      const userId = req.user.id;
      const content = String(req.body.content || "");
      const crisisDetectedByClient = req.body.crisisDetectedByClient === true;

      if (!content.trim()) {
        return res.status(400).json({ message: "Message content is required" });
      }

      // Crisis keyword detection
      let hasCrisisKeyword = crisisDetectedByClient;
      if (!hasCrisisKeyword && req.body.encrypted !== true) {
        const lowerContent = content.toLowerCase();
        hasCrisisKeyword = CRISIS_KEYWORDS.some((kw) => lowerContent.includes(kw));
      }

      if (hasCrisisKeyword) {
        // Auto-create crisis report
        await storage.createCrisisReport({
          userId,
          severity: "high",
          autoDetected: true,
        });
      }

      const msg = await storage.createMessage({
        conversationId: convId,
        senderId: userId,
        content,
        messageType: req.body.messageType || "text",
      });

      const conversation = await storage.getConversation(convId);
      if (conversation) {
        const recipientId = conversation.clientId === userId
          ? conversation.therapistId
          : conversation.clientId;
        await notifyUser(
          recipientId,
          "New message",
          "You received a new message on Shifa.",
          { type: "message", conversationId: String(convId) },
        );
      }

      // With Supabase Realtime, message delivery is automatic via postgres_changes
      res.status(201).json({ ...msg, crisisDetected: hasCrisisKeyword });
    } catch (error) {
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  app.get("/api/unread-count", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const count = await storage.getUnreadCount(userId);
      res.json({ count });
    } catch (error) {
      res.status(500).json({ message: "Failed to get unread count" });
    }
  });

  // ---- Appointment routes ----

  app.get("/api/appointments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const apts = await storage.getAppointments(userId);
      res.json(apts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch appointments" });
    }
  });

  app.post("/api/appointments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const apt = await storage.createAppointment({ ...req.body, clientId: userId });
      await notifyUser(
        apt.therapistId,
        "New appointment request",
        "A client requested a new appointment.",
        { type: "appointment", appointmentId: String(apt.id) },
      );
      res.status(201).json(apt);
    } catch (error) {
      res.status(500).json({ message: "Failed to create appointment" });
    }
  });

  app.patch("/api/appointments/:id/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const apt = await storage.updateAppointmentStatus(parseInt(req.params.id), req.body.status);
      if (apt) {
        const recipientId = apt.clientId === userId ? apt.therapistId : apt.clientId;
        await notifyUser(
          recipientId,
          "Appointment updated",
          `Appointment status changed to ${apt.status}.`,
          { type: "appointment", appointmentId: String(apt.id), status: apt.status },
        );
      }
      res.json(apt);
    } catch (error) {
      res.status(500).json({ message: "Failed to update appointment" });
    }
  });

  // ---- Mood routes ----

  app.get("/api/mood", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 30;
      const entries = await storage.getMoodEntries(userId, limit);
      res.json(entries);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch mood entries" });
    }
  });

  app.post("/api/mood", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const entry = await storage.createMoodEntry({ ...req.body, userId });
      res.status(201).json(entry);
    } catch (error) {
      res.status(500).json({ message: "Failed to create mood entry" });
    }
  });

  // ---- Journal routes ----

  app.get("/api/journal", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const entries = await storage.getJournalEntries(userId);
      res.json(entries);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch journal entries" });
    }
  });

  app.post("/api/journal", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const entry = await storage.createJournalEntry({ ...req.body, userId });
      res.status(201).json(entry);
    } catch (error) {
      res.status(500).json({ message: "Failed to create journal entry" });
    }
  });

  app.patch("/api/journal/:id", isAuthenticated, async (req: any, res) => {
    try {
      const entry = await storage.updateJournalEntry(parseInt(req.params.id), req.body);
      res.json(entry);
    } catch (error) {
      res.status(500).json({ message: "Failed to update journal entry" });
    }
  });

  app.delete("/api/journal/:id", isAuthenticated, async (req: any, res) => {
    try {
      await storage.deleteJournalEntry(parseInt(req.params.id));
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete journal entry" });
    }
  });

  // ---- Resources ----

  app.get("/api/resources", async (req, res) => {
    try {
      const category = req.query.category as string | undefined;
      const resourceList = await storage.getResources(category);
      res.json(resourceList);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch resources" });
    }
  });

  // ---- AI routes ----

  app.post("/api/ai/match-therapist", isAuthenticated, async (req: any, res) => {
    try {
      const { concerns, language, gender, budget } = req.body;
      const allTherapists = await storage.getTherapistProfiles({});

      if (allTherapists.length === 0) {
        return res.json({ recommendations: [], message: "No therapists available yet" });
      }

      const therapistData = allTherapists.map((t) => ({
        id: t.userId,
        name: `${t.user.firstName || ""} ${t.user.lastName || ""}`.trim(),
        specializations: t.specializations || [],
        languages: t.languages || [],
        rate: t.rateDinar,
        rating: t.rating,
        gender: t.gender,
        experience: t.yearsExperience,
      }));

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a therapist matching assistant for a Tunisian mental health platform called Shifa.
Given a user's needs and available therapists, rank the top 3 most suitable therapists with a brief explanation in the user's preferred language.
Respond in JSON format: { "recommendations": [{ "therapistId": "...", "matchScore": 0-100, "reason": "..." }] }`,
          },
          {
            role: "user",
            content: `User needs:
- Concerns: ${concerns}
- Preferred language: ${language}
- Gender preference: ${gender || "any"}
- Budget: ${budget || "any"} TND

Available therapists:
${JSON.stringify(therapistData, null, 2)}`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0]?.message?.content || "{}");
      res.json(result);
    } catch (error) {
      console.error("AI matching error:", error);
      res.status(500).json({ message: "Failed to match therapist" });
    }
  });

  app.post("/api/ai/wellness-insight", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const moods = await storage.getMoodEntries(userId, 14);
      const { language = "ar" } = req.body;

      const langMap: Record<string, string> = {
        ar: "Arabic",
        fr: "French",
        darija: "Tunisian Arabic dialect (Darija)",
      };

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a compassionate wellness assistant for a Tunisian mental health platform. Provide brief, culturally sensitive mood insights. Respond in ${langMap[language] || "Arabic"}.`,
          },
          {
            role: "user",
            content: `Analyze this mood data and provide a brief insight (2-3 sentences):
${JSON.stringify(moods.map((m) => ({ score: m.moodScore, date: m.createdAt, emotions: m.emotions, notes: m.notes })))}`,
          },
        ],
      });

      res.json({ insight: response.choices[0]?.message?.content || "" });
    } catch (error) {
      console.error("AI insight error:", error);
      res.status(500).json({ message: "Failed to generate insight" });
    }
  });

  // ---- User profile ----

  app.patch("/api/user/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.updateUser(userId, req.body);
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // ---- Reviews ----

  app.get("/api/therapists/:userId/reviews", async (req, res) => {
    try {
      const reviews = await storage.getReviewsByTherapist(req.params.userId);
      res.json(reviews);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch reviews" });
    }
  });

  app.post("/api/therapists/:userId/reviews", isAuthenticated, async (req: any, res) => {
    try {
      const clientId = req.user.id;
      const therapistId = req.params.userId;
      const { appointmentId, overallRating, helpfulnessRating, communicationRating, comment, isAnonymous } = req.body;

      if (!overallRating || overallRating < 1 || overallRating > 5) {
        return res.status(400).json({ message: "Overall rating must be between 1 and 5" });
      }

      if (appointmentId) {
        const existing = await storage.getReviewByAppointment(appointmentId);
        if (existing) {
          return res.status(409).json({ message: "Review already exists for this appointment" });
        }
      }

      const review = await storage.createReview({
        therapistId,
        clientId,
        appointmentId: appointmentId || null,
        overallRating,
        helpfulnessRating: helpfulnessRating || null,
        communicationRating: communicationRating || null,
        comment: comment || null,
        therapistResponse: null,
        isAnonymous: isAnonymous !== false,
      });

      res.status(201).json(review);
    } catch (error) {
      res.status(500).json({ message: "Failed to create review" });
    }
  });

  app.post("/api/reviews/:id/respond", isAuthenticated, async (req: any, res) => {
    try {
      const reviewId = parseInt(req.params.id);
      const { response } = req.body;
      if (!response) return res.status(400).json({ message: "Response text required" });

      const review = await storage.addTherapistResponse(reviewId, response);
      res.json(review);
    } catch (error) {
      res.status(500).json({ message: "Failed to respond to review" });
    }
  });

  app.get("/api/therapist/slug/:slug", async (req, res) => {
    try {
      const profile = await storage.getTherapistBySlug(req.params.slug);
      if (!profile) return res.status(404).json({ message: "Not found" });
      const user = await storage.getUser(profile.userId);
      res.json({ ...profile, user });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch therapist by slug" });
    }
  });

  app.get("/api/therapist/dashboard", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const profile = await storage.getTherapistProfile(userId);
      if (!profile) return res.status(404).json({ message: "Not a therapist" });

      const reviews = await storage.getReviewsByTherapist(userId);
      const completedSessions = await storage.getCompletedAppointmentCount(userId);

      res.json({
        profile,
        stats: {
          totalReviews: reviews.length,
          avgRating: profile.rating || 0,
          totalSessions: completedSessions,
        },
        recentReviews: reviews.slice(0, 10),
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch therapist dashboard" });
    }
  });

  // ---- Payment routes (MVP) ----

  app.post("/api/payments/flouci/initiate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { appointmentId, therapistId, amount } = req.body;

      const transaction = await storage.createPaymentTransaction({
        clientId: userId,
        therapistId,
        appointmentId,
        amountDinar: amount,
        paymentMethod: "flouci",
        status: "pending",
      });

      // TODO: Integrate with Flouci API to create payment session
      // For now, return the transaction with a placeholder redirect URL
      res.json({
        transaction,
        redirectUrl: `https://developers.flouci.com/pay/${transaction.id}`,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to initiate payment" });
    }
  });

  app.post("/api/payments/flouci/webhook", async (req, res) => {
    try {
      if (!verifyWebhookSignature(req, process.env.FLOUCI_WEBHOOK_SECRET, "x-flouci-signature")) {
        return res.status(401).json({ message: "Invalid webhook signature" });
      }

      const { transactionId, status, externalRef } = req.body;
      const providerEventId = req.body.eventId || req.body.event_id || req.body.id || req.body.payment_id;
      const transaction = await storage.updatePaymentStatus(
        transactionId,
        status === "success" ? "completed" : "failed",
        externalRef,
        "flouci",
        providerEventId ? String(providerEventId) : undefined,
      );
      if (!transaction) return res.status(404).json({ message: "Transaction not found" });

      if (status === "success" && transaction?.appointmentId) {
        await storage.updateAppointmentStatus(transaction.appointmentId, "confirmed");
      }

      res.json({ received: true });
    } catch (error) {
      res.status(500).json({ message: "Webhook processing failed" });
    }
  });

  app.post("/api/payments/konnect/initiate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { appointmentId, therapistId, amount } = req.body;

      const transaction = await storage.createPaymentTransaction({
        clientId: userId,
        therapistId,
        appointmentId,
        amountDinar: amount,
        paymentMethod: "konnect",
        status: "pending",
      });

      // TODO: Integrate with Konnect/D17 API
      res.json({
        transaction,
        redirectUrl: `https://api.konnect.network/pay/${transaction.id}`,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to initiate payment" });
    }
  });

  app.post("/api/payments/konnect/webhook", async (req, res) => {
    try {
      if (!verifyWebhookSignature(req, process.env.KONNECT_WEBHOOK_SECRET, "x-konnect-signature")) {
        return res.status(401).json({ message: "Invalid webhook signature" });
      }

      const { transactionId, status, externalRef } = req.body;
      const providerEventId = req.body.eventId || req.body.event_id || req.body.id || req.body.payment_id;
      const transaction = await storage.updatePaymentStatus(
        transactionId,
        status === "success" ? "completed" : "failed",
        externalRef,
        "konnect",
        providerEventId ? String(providerEventId) : undefined,
      );
      if (!transaction) return res.status(404).json({ message: "Transaction not found" });

      if (status === "success" && transaction?.appointmentId) {
        await storage.updateAppointmentStatus(transaction.appointmentId, "confirmed");
      }

      res.json({ received: true });
    } catch (error) {
      res.status(500).json({ message: "Webhook processing failed" });
    }
  });

  app.get("/api/payments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const payments = await storage.getPaymentsByUser(userId);
      res.json(payments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch payments" });
    }
  });

  // ---- Push notifications (MVP) ----

  app.post("/api/notifications/register", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { token, deviceType } = req.body;
      await storage.saveFcmToken(userId, token, deviceType);
      res.json({ message: "Token registered" });
    } catch (error) {
      res.status(500).json({ message: "Failed to register token" });
    }
  });

  app.delete("/api/notifications/unregister", isAuthenticated, async (req: any, res) => {
    try {
      const { token } = req.body;
      await storage.removeFcmToken(token);
      res.json({ message: "Token removed" });
    } catch (error) {
      res.status(500).json({ message: "Failed to unregister token" });
    }
  });

  // ---- Crisis intervention (MVP) ----

  app.post("/api/crisis/report", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const report = await storage.createCrisisReport({
        userId,
        severity: req.body.severity || "high",
        autoDetected: false,
      });
      res.status(201).json(report);
    } catch (error) {
      res.status(500).json({ message: "Failed to create crisis report" });
    }
  });

  app.post("/api/crisis/safe", isAuthenticated, async (req: any, res) => {
    try {
      const { reportId } = req.body;
      if (reportId) {
        await storage.updateCrisisReport(reportId, {
          resolvedAt: new Date().toISOString(),
        } as any);
      }
      res.json({ message: "Thank you for confirming" });
    } catch (error) {
      res.status(500).json({ message: "Failed to update report" });
    }
  });

  // ---- Onboarding (MVP) ----

  app.post("/api/onboarding", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const response = await storage.saveOnboardingResponse({
        userId,
        primaryConcerns: req.body.primaryConcerns,
        preferredLanguage: req.body.preferredLanguage,
        genderPreference: req.body.genderPreference,
        budgetRange: req.body.budgetRange,
        howDidYouHear: req.body.howDidYouHear,
      });
      res.status(201).json(response);
    } catch (error) {
      res.status(500).json({ message: "Failed to save onboarding" });
    }
  });

  app.get("/api/onboarding", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const response = await storage.getOnboardingResponse(userId);
      res.json(response || null);
    } catch (error) {
      res.status(500).json({ message: "Failed to get onboarding" });
    }
  });

  // ---- Listener (7 Cups-style) ----

  app.post("/api/listener/apply", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const languages = normalizeStringArray(req.body.languages);
      const topics = normalizeStringArray(req.body.topics);

      const application = await storage.submitListenerApplication({
        userId,
        motivation: req.body.motivation || null,
        relevantExperience: req.body.relevantExperience || null,
        languages,
        topics,
        weeklyHours: req.body.weeklyHours ? Number(req.body.weeklyHours) : null,
        status: "pending",
      });

      const existingProfile = await storage.getListenerProfile(userId);
      const profile = await storage.createOrUpdateListenerProfile({
        userId,
        displayAlias: req.body.displayAlias || existingProfile?.displayAlias || null,
        languages: languages || existingProfile?.languages || null,
        topics: topics || existingProfile?.topics || null,
        timezone: req.body.timezone || existingProfile?.timezone || null,
        verificationStatus: existingProfile?.verificationStatus || "pending",
        activationStatus: existingProfile?.activationStatus || "inactive",
        trainingCompletedAt: existingProfile?.trainingCompletedAt || null,
        approvedBy: existingProfile?.approvedBy || null,
        approvedAt: existingProfile?.approvedAt || null,
        isAvailable: existingProfile?.isAvailable || false,
      });

      res.status(201).json({ application, profile });
    } catch (error) {
      res.status(500).json({ message: "Failed to submit listener application" });
    }
  });

  app.get("/api/listener/application", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const [application, profile] = await Promise.all([
        storage.getListenerApplicationByUser(userId),
        storage.getListenerProfile(userId),
      ]);
      res.json({ application: application || null, profile: profile || null });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch listener application" });
    }
  });

  app.post("/api/listener/availability", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const desiredAvailability = req.body.isAvailable === true;

      const profile = await storage.getListenerProfile(userId);
      if (!profile) {
        return res.status(404).json({ message: "Listener profile not found" });
      }

      if (desiredAvailability && !["trial", "live"].includes(profile.activationStatus)) {
        return res.status(403).json({ message: "Listener account is not activated yet" });
      }

      const updated = await storage.setListenerAvailability(userId, desiredAvailability);
      if (!updated) return res.status(500).json({ message: "Failed to update availability" });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update listener availability" });
    }
  });

  // ---- Peer Support ----

  app.post("/api/peer/queue/join", isAuthenticated, async (req: any, res) => {
    try {
      const clientId = req.user.id;
      const preferredLanguage = typeof req.body.preferredLanguage === "string"
        ? req.body.preferredLanguage
        : null;
      const topicTags = normalizeStringArray(req.body.topicTags);

      let entitlement = await storage.getEntitlement(clientId);
      if (!entitlement) {
        const plans = await storage.getPlans();
        const freePlan = plans.find((plan) => plan.code === "free");
        if (freePlan) {
          entitlement = await storage.upsertEntitlement({
            userId: clientId,
            planCode: freePlan.code,
            peerMinutesRemaining: freePlan.peerMinutesLimit,
            priorityLevel: freePlan.priorityLevel,
            therapistDiscountPct: freePlan.therapistDiscountPct,
            renewedAt: new Date().toISOString(),
          });
        }
      }

      if (entitlement && entitlement.peerMinutesRemaining <= 0) {
        return res.status(402).json({
          message: "No peer-support minutes remaining. Please upgrade your plan.",
        });
      }

      const queueEntry = await storage.joinListenerQueue({
        clientId,
        preferredLanguage,
        topicTags,
        status: "waiting",
      });

      const availableListeners = await storage.listAvailableListeners(
        preferredLanguage || undefined,
        topicTags || undefined,
      );
      const selectedListener = availableListeners.find((listener) => listener.userId !== clientId);

      if (!selectedListener) {
        return res.status(201).json({
          queueEntry,
          matched: false,
          session: null,
        });
      }

      const session = await storage.createPeerSession({
        clientId,
        listenerId: selectedListener.userId,
        queueEntryId: queueEntry.id,
        status: "active",
        anonymousAliasClient: generateAnonymousAlias("client"),
        anonymousAliasListener: selectedListener.displayAlias || generateAnonymousAlias("listener"),
        escalatedToCrisis: false,
      });

      await storage.setListenerAvailability(selectedListener.userId, false).catch(() => undefined);

      await notifyUser(
        selectedListener.userId,
        "New peer support match",
        "You were matched with a client waiting for support.",
        { type: "peer_session", sessionId: String(session.id) },
      );
      await notifyUser(
        clientId,
        "Listener found",
        "A listener joined your peer support session.",
        { type: "peer_session", sessionId: String(session.id) },
      );

      res.status(201).json({
        queueEntry,
        matched: true,
        session,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to join listener queue" });
    }
  });

  app.delete("/api/peer/queue/leave", isAuthenticated, async (req: any, res) => {
    try {
      const clientId = req.user.id;
      await storage.leaveListenerQueue(clientId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to leave listener queue" });
    }
  });

  app.get("/api/peer/sessions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const [sessions, activeQueueEntry] = await Promise.all([
        storage.getPeerSessionsByUser(userId),
        storage.getActiveQueueEntry(userId),
      ]);
      res.json({ sessions, activeQueueEntry: activeQueueEntry || null });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch peer sessions" });
    }
  });

  app.post("/api/peer/session/start", isAuthenticated, requireRoles(["listener", "moderator", "admin"]), async (req: any, res) => {
    try {
      const listenerId = req.user.id;
      const queueEntryId = Number(req.body.queueEntryId);
      if (!Number.isInteger(queueEntryId)) {
        return res.status(400).json({ message: "queueEntryId must be a valid integer" });
      }

      const listenerProfile = await storage.getListenerProfile(listenerId);
      if (
        !listenerProfile ||
        listenerProfile.verificationStatus !== "approved" ||
        !["trial", "live"].includes(listenerProfile.activationStatus)
      ) {
        return res.status(403).json({ message: "Listener is not activated for sessions" });
      }

      const waitingEntries = await storage.listWaitingQueueEntries();
      const queueEntry = waitingEntries.find((entry) => entry.id === queueEntryId);
      if (!queueEntry) return res.status(404).json({ message: "Queue entry not found or unavailable" });
      if (queueEntry.clientId === listenerId) {
        return res.status(400).json({ message: "Cannot start a session with yourself" });
      }

      const session = await storage.createPeerSession({
        clientId: queueEntry.clientId,
        listenerId,
        queueEntryId: queueEntry.id,
        status: "active",
        anonymousAliasClient: generateAnonymousAlias("client"),
        anonymousAliasListener: listenerProfile.displayAlias || generateAnonymousAlias("listener"),
        escalatedToCrisis: false,
      });

      await storage.setListenerAvailability(listenerId, false).catch(() => undefined);

      await notifyUser(
        queueEntry.clientId,
        "Your listener is ready",
        "A listener started your peer support session.",
        { type: "peer_session", sessionId: String(session.id) },
      );

      res.status(201).json(session);
    } catch (error) {
      res.status(500).json({ message: "Failed to start peer session" });
    }
  });

  app.post("/api/peer/session/:id/end", isAuthenticated, async (req: any, res) => {
    try {
      const sessionId = Number(req.params.id);
      if (!Number.isInteger(sessionId)) return res.status(400).json({ message: "Invalid session id" });

      const userId = req.user.id;
      const session = await storage.getPeerSession(sessionId);
      if (!session) return res.status(404).json({ message: "Peer session not found" });
      if (session.clientId !== userId && session.listenerId !== userId) {
        const caller = await storage.getUser(userId);
        if (!caller || !["moderator", "admin"].includes(caller.role)) {
          return res.status(403).json({ message: "Forbidden" });
        }
      }

      const ended = await storage.endPeerSession(sessionId);
      if (!ended) return res.status(500).json({ message: "Failed to end peer session" });

      const durationMinutes = ended.startedAt
        ? Math.max(1, Math.ceil((Date.now() - new Date(ended.startedAt).getTime()) / 60000))
        : 1;

      await storage.consumePeerMinutes(ended.clientId, durationMinutes).catch(() => undefined);
      await storage.setListenerAvailability(ended.listenerId, true).catch(() => undefined);

      const otherUserId = userId === ended.clientId ? ended.listenerId : ended.clientId;
      await notifyUser(
        otherUserId,
        "Peer session ended",
        "Your peer support session has ended.",
        { type: "peer_session", sessionId: String(ended.id) },
      );

      res.json({ session: ended, durationMinutes });
    } catch (error) {
      res.status(500).json({ message: "Failed to end peer session" });
    }
  });

  app.get("/api/peer/session/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const sessionId = Number(req.params.id);
      if (!Number.isInteger(sessionId)) return res.status(400).json({ message: "Invalid session id" });

      const userId = req.user.id;
      const session = await storage.getPeerSession(sessionId);
      if (!session) return res.status(404).json({ message: "Peer session not found" });

      const caller = await storage.getUser(userId);
      const isModerator = !!caller && ["moderator", "admin"].includes(caller.role);
      const isParticipant = session.clientId === userId || session.listenerId === userId;
      if (!isParticipant && !isModerator) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const messages = await storage.getPeerMessages(sessionId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch peer messages" });
    }
  });

  app.post("/api/peer/session/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const sessionId = Number(req.params.id);
      if (!Number.isInteger(sessionId)) return res.status(400).json({ message: "Invalid session id" });

      const senderId = req.user.id;
      const session = await storage.getPeerSession(sessionId);
      if (!session) return res.status(404).json({ message: "Peer session not found" });
      if (session.clientId !== senderId && session.listenerId !== senderId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const rawContent = String(req.body.content || "");
      const content = rawContent.trim();
      if (!content) return res.status(400).json({ message: "Message content is required" });

      const encrypted = req.body.encrypted === true;
      const lowerContent = content.toLowerCase();
      const crisisDetected = !encrypted && CRISIS_KEYWORDS.some((keyword) => lowerContent.includes(keyword));

      const message = await storage.createPeerMessage({
        sessionId,
        senderId,
        content,
        encrypted,
      });

      if (crisisDetected) {
        const targetUserId = senderId === session.clientId ? session.listenerId : session.clientId;
        await storage.createPeerReport({
          sessionId,
          reporterId: senderId,
          targetUserId,
          reason: "crisis_language_detected",
          details: "Automatic crisis keyword detection in peer session message.",
          severity: "high",
          moderationStatus: "open",
        });

        await storage.createCrisisReport({
          userId: senderId,
          severity: "high",
          autoDetected: true,
        }).catch(() => undefined);

        const moderatorIds = await listModeratorIds();
        await Promise.all(
          moderatorIds.map((moderatorId) =>
            notifyUser(
              moderatorId,
              "Crisis escalation detected",
              "A peer-support message triggered crisis detection.",
              { type: "peer_crisis", sessionId: String(sessionId) },
            ),
          ),
        );
      }

      const recipientId = senderId === session.clientId ? session.listenerId : session.clientId;
      await notifyUser(
        recipientId,
        "New peer support message",
        "You received a new message in your peer support session.",
        { type: "peer_message", sessionId: String(sessionId) },
      );

      res.status(201).json({ ...message, crisisDetected });
    } catch (error) {
      res.status(500).json({ message: "Failed to send peer message" });
    }
  });

  app.post("/api/peer/session/:id/rate", isAuthenticated, async (req: any, res) => {
    try {
      const sessionId = Number(req.params.id);
      if (!Number.isInteger(sessionId)) return res.status(400).json({ message: "Invalid session id" });

      const userId = req.user.id;
      const session = await storage.getPeerSession(sessionId);
      if (!session) return res.status(404).json({ message: "Peer session not found" });
      if (session.clientId !== userId) {
        return res.status(403).json({ message: "Only clients can submit listener feedback" });
      }

      const rating = Number(req.body.rating);
      if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ message: "rating must be between 1 and 5" });
      }

      const feedback = await storage.createPeerSessionFeedback({
        sessionId,
        clientId: session.clientId,
        listenerId: session.listenerId,
        rating,
        tags: normalizeStringArray(req.body.tags),
        comment: req.body.comment || null,
      });

      res.status(201).json(feedback);
    } catch (error) {
      res.status(500).json({ message: "Failed to submit peer feedback" });
    }
  });

  app.post("/api/peer/session/:id/report", isAuthenticated, async (req: any, res) => {
    try {
      const sessionId = Number(req.params.id);
      if (!Number.isInteger(sessionId)) return res.status(400).json({ message: "Invalid session id" });

      const reporterId = req.user.id;
      const session = await storage.getPeerSession(sessionId);
      if (!session) return res.status(404).json({ message: "Peer session not found" });
      if (session.clientId !== reporterId && session.listenerId !== reporterId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const reason = String(req.body.reason || "").trim();
      if (!reason) return res.status(400).json({ message: "reason is required" });

      const defaultTarget = reporterId === session.clientId ? session.listenerId : session.clientId;
      const report = await storage.createPeerReport({
        sessionId,
        reporterId,
        targetUserId: req.body.targetUserId || defaultTarget,
        reason,
        details: req.body.details || null,
        severity: req.body.severity || "medium",
        moderationStatus: "open",
      });

      const moderatorIds = await listModeratorIds();
      await Promise.all(
        moderatorIds.map((moderatorId) =>
          notifyUser(
            moderatorId,
            "Peer report submitted",
            "A new peer-support report requires moderation.",
            { type: "peer_report", reportId: String(report.id) },
          ),
        ),
      );

      res.status(201).json(report);
    } catch (error) {
      res.status(500).json({ message: "Failed to create peer report" });
    }
  });

  // ---- Admin moderation ----

  app.get("/api/admin/listeners", isAuthenticated, requireRoles(["moderator", "admin"]), async (req, res) => {
    try {
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const [applications, reports] = await Promise.all([
        storage.listListenerApplications(status),
        storage.listOpenPeerReports(),
      ]);
      res.json({ applications, reports });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch listener moderation data" });
    }
  });

  app.post("/api/admin/listener/:id/review", isAuthenticated, requireRoles(["moderator", "admin"]), async (req: any, res) => {
    try {
      const applicationId = Number(req.params.id);
      if (!Number.isInteger(applicationId)) {
        return res.status(400).json({ message: "application id must be a valid integer" });
      }

      const reviewerId = req.user.id;
      const status = req.body.status as "approved" | "rejected" | "changes_requested";
      if (!["approved", "rejected", "changes_requested"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const application = await storage.reviewListenerApplication(
        applicationId,
        reviewerId,
        status,
        req.body.moderationNotes,
      );
      if (!application) return res.status(404).json({ message: "Listener application not found" });

      let profile = await storage.getListenerProfile(application.userId);
      if (status === "approved" && req.body.activationStatus && ["trial", "live", "inactive", "suspended"].includes(req.body.activationStatus)) {
        profile = await storage.setListenerActivation(application.userId, req.body.activationStatus, reviewerId);
      }

      await notifyUser(
        application.userId,
        "Listener application reviewed",
        `Your listener application was marked as ${status}.`,
        { type: "listener_application", status },
      );

      res.json({ application, profile: profile || null });
    } catch (error) {
      res.status(500).json({ message: "Failed to review listener application" });
    }
  });

  app.post("/api/admin/listener/:id/activate-trial", isAuthenticated, requireRoles(["moderator", "admin"]), async (req: any, res) => {
    try {
      const reviewerId = req.user.id;
      const listenerUserId = req.params.id;

      const profile = await storage.setListenerActivation(listenerUserId, "trial", reviewerId);
      if (!profile) return res.status(404).json({ message: "Listener profile not found" });

      await notifyUser(
        listenerUserId,
        "Trial activation enabled",
        "Your listener account is now active in trial mode.",
        { type: "listener_activation", activationStatus: "trial" },
      );

      res.json(profile);
    } catch (error) {
      res.status(500).json({ message: "Failed to activate listener trial mode" });
    }
  });

  app.post("/api/admin/listener/:id/activate-live", isAuthenticated, requireRoles(["moderator", "admin"]), async (req: any, res) => {
    try {
      const reviewerId = req.user.id;
      const listenerUserId = req.params.id;

      const profile = await storage.setListenerActivation(listenerUserId, "live", reviewerId);
      if (!profile) return res.status(404).json({ message: "Listener profile not found" });

      await notifyUser(
        listenerUserId,
        "Live activation enabled",
        "Your listener account is now active in live mode.",
        { type: "listener_activation", activationStatus: "live" },
      );

      res.json(profile);
    } catch (error) {
      res.status(500).json({ message: "Failed to activate listener live mode" });
    }
  });

  app.post("/api/admin/reports/:id/resolve", isAuthenticated, requireRoles(["moderator", "admin"]), async (req: any, res) => {
    try {
      const reportId = Number(req.params.id);
      if (!Number.isInteger(reportId)) return res.status(400).json({ message: "Invalid report id" });

      const moderatorId = req.user.id;
      const report = await storage.resolvePeerReport(reportId, moderatorId);
      if (!report) return res.status(404).json({ message: "Peer report not found" });
      res.json(report);
    } catch (error) {
      res.status(500).json({ message: "Failed to resolve peer report" });
    }
  });

  // ---- Billing plans and entitlements ----

  app.get("/api/billing/plans", async (_req, res) => {
    try {
      const plans = await storage.getPlans();
      res.json(plans);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch plans" });
    }
  });

  app.get("/api/billing/entitlements", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const plans = await storage.getPlans();
      const subscription = await storage.getSubscriptionByUser(userId);

      let entitlement = await storage.getEntitlement(userId);
      if (!entitlement) {
        const selectedPlan = subscription
          ? plans.find((plan) => plan.id === subscription.planId)
          : plans.find((plan) => plan.code === "free");
        if (selectedPlan) {
          entitlement = await storage.upsertEntitlement({
            userId,
            planCode: selectedPlan.code,
            peerMinutesRemaining: selectedPlan.peerMinutesLimit,
            priorityLevel: selectedPlan.priorityLevel,
            therapistDiscountPct: selectedPlan.therapistDiscountPct,
            renewedAt: new Date().toISOString(),
          });
        }
      }

      res.json({
        subscription: subscription || null,
        entitlement: entitlement || null,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch billing entitlements" });
    }
  });

  app.post("/api/billing/subscribe", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const planCode = String(req.body.planCode || "").trim();
      if (!planCode) return res.status(400).json({ message: "planCode is required" });

      const plans = await storage.getPlans();
      const selectedPlan = plans.find((plan) => plan.code === planCode);
      if (!selectedPlan) return res.status(404).json({ message: "Plan not found" });

      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      const subscription = await storage.createOrUpdateSubscription({
        userId,
        planId: selectedPlan.id,
        status: "active",
        provider: req.body.provider || "manual",
        providerRef: req.body.providerRef || `manual-${userId}-${Date.now()}`,
        currentPeriodStart: now.toISOString(),
        currentPeriodEnd: periodEnd.toISOString(),
        cancelAtPeriodEnd: false,
      });

      const entitlement = await storage.upsertEntitlement({
        userId,
        planCode: selectedPlan.code,
        peerMinutesRemaining: selectedPlan.peerMinutesLimit,
        priorityLevel: selectedPlan.priorityLevel,
        therapistDiscountPct: selectedPlan.therapistDiscountPct,
        renewedAt: now.toISOString(),
      });

      res.status(201).json({ subscription, entitlement, plan: selectedPlan });
    } catch (error) {
      res.status(500).json({ message: "Failed to subscribe to plan" });
    }
  });

  app.post("/api/billing/cancel", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const immediate = req.body.immediate === true;

      const subscription = await storage.updateSubscriptionStatus(
        userId,
        immediate ? "canceled" : "active",
        !immediate,
      );

      if (!subscription) return res.status(404).json({ message: "No active subscription found" });
      res.json(subscription);
    } catch (error) {
      res.status(500).json({ message: "Failed to cancel subscription" });
    }
  });

  return httpServer;
}
