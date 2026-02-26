import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { supabaseAdmin } from "./supabase";
import crypto from "crypto";
import { sendPushToTokens } from "./notifications";
import { mapProfile, type User,
  signupRequestSchema, loginRequestSchema, otpRequestSchema, verifyOtpRequestSchema,
  sendMessageRequestSchema, moodEntryRequestSchema, journalEntryRequestSchema,
  onboardingRequestSchema, reviewRequestSchema, slotCreateRequestSchema,
  paymentInitiateRequestSchema, queueJoinRequestSchema, peerMessageRequestSchema,
} from "@shared/schema";
import { authLimiter, webhookLimiter } from "./middleware/rate-limit";
import { QUALIFICATION_QUESTIONS, scoreAnswers } from "@shared/qualification-questions";
import {
  generateGoogleAuthUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  revokeGoogleToken,
  createCalendarEvent,
  encryptToken,
  decryptToken,
  isGoogleConfigured,
} from "./google-meet";
import { validateBody } from "./middleware/validate";
import { logAudit } from "./audit";
import { createFlouciPayment } from "./payments/flouci";
import { createKonnectPayment } from "./payments/konnect";
import {
  sendAppointmentConfirmation,
  sendVerificationStatusUpdate,
  sendListenerApplicationUpdate,
  sendWelcome,
} from "./email";
import { moderateContent } from "./moderation";

// Crisis keywords for auto-detection (Arabic, French, Tunisian dialect)
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

const GRADUATED_DOCTOR_CAP_DINAR = Number(
  process.env.GRADUATED_DOCTOR_CAP_DINAR || process.env.STUDENT_THERAPIST_CAP_DINAR || "20"
);

function graduatedDoctorCapDinar(): number {
  if (!Number.isFinite(GRADUATED_DOCTOR_CAP_DINAR) || GRADUATED_DOCTOR_CAP_DINAR <= 0) {
    return 20;
  }
  return GRADUATED_DOCTOR_CAP_DINAR;
}

// Keep old name as alias so nothing breaks during partial rollout
function studentTherapistCapDinar(): number {
  return graduatedDoctorCapDinar();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const fallbackProfile = (authUser: { id: string; email?: string }, role: string = "client"): User => ({
    id: authUser.id,
    email: authUser.email || null,
    firstName: null,
    lastName: null,
    profileImageUrl: null,
    role,
    phone: null,
    publicKey: null,
    languagePreference: "ar",
    governorate: null,
    bio: null,
    isAnonymous: false,
    displayName: null,
    onboardingCompleted: false,
    createdAt: null,
    updatedAt: null,
  });

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

  const normalizeRole = (value: unknown): "client" | "therapist" | "listener" | "moderator" | "admin" => {
    const role = String(value || "").trim();
    if (["client", "therapist", "listener", "moderator", "admin"].includes(role)) {
      return role as "client" | "therapist" | "listener" | "moderator" | "admin";
    }
    return "client";
  };

  const markOnboardingCompleted = async (userId: string, preferredLanguage?: string | null) => {
    const updatePayload: Record<string, any> = {
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    };

    if (preferredLanguage && ["ar", "fr"].includes(preferredLanguage)) {
      updatePayload.language_preference = preferredLanguage;
    }

    await supabaseAdmin
      .from("profiles")
      .update(updatePayload)
      .eq("id", userId);
  };

  const upsertProfileSafely = async (payload: {
    id: string;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    role?: string | null;
    phone?: string | null;
  }) => {
    const nowIso = new Date().toISOString();
    const profilePatch: Record<string, any> = {
      email: payload.email ?? null,
      role: normalizeRole(payload.role),
      updated_at: nowIso,
    };
    if (payload.firstName !== undefined) profilePatch.first_name = payload.firstName;
    if (payload.lastName !== undefined) profilePatch.last_name = payload.lastName;
    if (payload.phone !== undefined) profilePatch.phone = payload.phone;

    const { data: updatedRows, error: updateError } = await supabaseAdmin
      .from("profiles")
      .update(profilePatch)
      .eq("id", payload.id)
      .select("*");
    if (updateError) throw updateError;
    if (updatedRows && updatedRows.length > 0) {
      return updatedRows[0];
    }

    const insertPayload: Record<string, any> = {
      id: payload.id,
      created_at: nowIso,
      ...profilePatch,
    };

    const { data: insertedRow, error: insertError } = await supabaseAdmin
      .from("profiles")
      .insert(insertPayload)
      .select("*")
      .single();
    if (!insertError && insertedRow) {
      return insertedRow;
    }

    // If email is already associated with a legacy profile row, retry without email.
    if ((insertError as any)?.code === "23505" && String((insertError as any)?.message || "").includes("profiles_email_key")) {
      const retryPayload = { ...insertPayload, email: null };
      const { data: retryRow, error: retryError } = await supabaseAdmin
        .from("profiles")
        .insert(retryPayload)
        .select("*")
        .single();
      if (!retryError && retryRow) {
        return retryRow;
      }
    }

    if ((insertError as any)?.code === "23505") {
      const { data: existingRow, error: existingError } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("id", payload.id)
        .maybeSingle();
      if (!existingError && existingRow) {
        return existingRow;
      }
    }

    throw insertError || new Error("Profile insert failed");
  };

  const ensureProfile = async (authUser: { id: string; email?: string }) => {
    const existing = await storage.getUser(authUser.id);
    if (existing) return existing;

    try {
      const row = await upsertProfileSafely({
        id: authUser.id,
        email: authUser.email || null,
        role: "client",
      });
      return mapProfile(row);
    } catch (error: any) {
      console.error("Failed to ensure profile", {
        userId: authUser.id,
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
      });
      return fallbackProfile(authUser);
    }
  };

  app.get("/api/health", async (_req, res) => {
    try {
      const { error } = await supabaseAdmin.from("profiles").select("id", { head: true, count: "estimated" }).limit(1);
      if (error) {
        return res.status(503).json({
          ok: false,
          status: "degraded",
          service: "api",
          db: "unreachable",
          reason: error.message,
        });
      }
      res.json({
        ok: true,
        status: "healthy",
        service: "api",
        db: "reachable",
      });
    } catch (error: any) {
      res.status(503).json({
        ok: false,
        status: "degraded",
        service: "api",
        db: "unreachable",
        reason: error?.message || "unknown",
      });
    }
  });

  // ---- Auth routes ----
  app.use("/api/auth", authLimiter);

  app.post("/api/auth/signup", validateBody(signupRequestSchema), async (req, res) => {
    try {
      const { email, password, role, firstName, lastName, phone } = req.body;
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error) return res.status(400).json({ message: error.message });

      // Upsert profile so signup works even if DB auto-profile trigger is absent.
      if (data.user) {
        await upsertProfileSafely({
          id: data.user.id,
          email: data.user.email || email || null,
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

      const profile = await ensureProfile({
        id: data.user!.id,
        email: data.user?.email || email,
      });

      // Fire-and-forget welcome email
      sendWelcome(email, firstName || email.split("@")[0]);

      res.json({
        user: profile || fallbackProfile({ id: data.user!.id, email: data.user?.email || email }, normalizeRole(role)),
        session: session.session,
      });
    } catch (error) {
      console.error("Signup failed", error);
      res.status(500).json({ message: "Failed to sign up" });
    }
  });

  app.post("/api/auth/login", validateBody(loginRequestSchema), async (req, res) => {
    try {
      const { email, password } = req.body;
      const { data, error } = await supabaseAdmin.auth.signInWithPassword({
        email,
        password,
      });
      if (error) return res.status(401).json({ message: error.message });

      const profile = await ensureProfile({
        id: data.user.id,
        email: data.user.email || email,
      });
      res.json({
        user: profile || fallbackProfile({ id: data.user.id, email: data.user.email || email }),
        session: data.session,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to log in" });
    }
  });

  app.post("/api/auth/login/otp", validateBody(otpRequestSchema), async (req, res) => {
    try {
      const { phone } = req.body;
      const { error } = await supabaseAdmin.auth.signInWithOtp({ phone });
      if (error) return res.status(400).json({ message: error.message });
      res.json({ message: "OTP sent" });
    } catch (error) {
      res.status(500).json({ message: "Failed to send OTP" });
    }
  });

  app.post("/api/auth/verify-otp", validateBody(verifyOtpRequestSchema), async (req, res) => {
    try {
      const { phone, token } = req.body;
      const { data, error } = await supabaseAdmin.auth.verifyOtp({
        phone,
        token,
        type: "sms",
      });
      if (error) return res.status(400).json({ message: error.message });

      const profile = data.user
        ? await ensureProfile({ id: data.user.id, email: data.user.email || undefined })
        : null;
      res.json({
        user: profile || (data.user ? fallbackProfile({ id: data.user.id, email: data.user.email || undefined }) : null),
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
      const profile = await ensureProfile(authUser);
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
        tier:
          req.query.tier === "graduated_doctor" || req.query.tier === "premium_doctor"
            ? (req.query.tier as "graduated_doctor" | "premium_doctor")
            : undefined,
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
      const payload = { ...req.body };
      delete payload.tier;
      delete payload.tierApprovedBy;
      delete payload.tierApprovedAt;
      await storage.updateUser(userId, { role: "therapist" });
      const profile = await storage.createTherapistProfile({ ...payload, userId });
      res.status(201).json(profile);
    } catch (error) {
      res.status(500).json({ message: "Failed to create therapist profile" });
    }
  });

  app.patch("/api/therapists", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const currentProfile = await storage.getTherapistProfile(userId);
      if (!currentProfile) return res.status(404).json({ message: "Therapist profile not found" });

      const payload = { ...req.body };
      delete payload.tier;
      delete payload.tierApprovedBy;
      delete payload.tierApprovedAt;

      const nextRate =
        payload.rateDinar !== undefined && payload.rateDinar !== null
          ? Number(payload.rateDinar)
          : currentProfile.rateDinar;
      const isGraduatedDoctor = currentProfile.tier === "graduated_doctor";
      if (isGraduatedDoctor && Number.isFinite(Number(nextRate)) && Number(nextRate) > graduatedDoctorCapDinar()) {
        return res.status(400).json({
          message: `Graduated doctor rate cannot exceed ${graduatedDoctorCapDinar()} TND`,
        });
      }

      const profile = await storage.updateTherapistProfile(userId, payload);
      res.json(profile);
    } catch (error) {
      res.status(500).json({ message: "Failed to update therapist profile" });
    }
  });

  app.patch(
    "/api/admin/therapists/:id/tier",
    isAuthenticated,
    requireRoles(["moderator", "admin"]),
    async (req: any, res) => {
      try {
        const therapistUserId = req.params.id;
        const tier = String(req.body.tier || "").trim();
        if (!["graduated_doctor", "premium_doctor"].includes(tier)) {
          return res.status(400).json({ message: "tier must be graduated_doctor or premium_doctor" });
        }

        const reviewerId = req.user.id;
        const existingProfile = await storage.getTherapistProfile(therapistUserId);
        if (!existingProfile) return res.status(404).json({ message: "Therapist profile not found" });

        if (tier === "graduated_doctor" && (existingProfile.rateDinar || 0) > graduatedDoctorCapDinar()) {
          return res.status(400).json({
            message: `Current therapist rate exceeds graduated doctor cap (${graduatedDoctorCapDinar()} TND)`,
          });
        }

        const updated = await storage.updateTherapistTier(
          therapistUserId,
          tier as "graduated_doctor" | "premium_doctor",
          reviewerId,
        );
        if (!updated) return res.status(500).json({ message: "Failed to update therapist tier" });

        logAudit(reviewerId, "therapist.tier_change", "therapist_profile", therapistUserId, {
          previousTier: existingProfile.tier,
          newTier: tier,
        }, req);

        res.json(updated);
      } catch (error) {
        res.status(500).json({ message: "Failed to update therapist tier" });
      }
    },
  );

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

  app.post("/api/conversations/:id/messages", isAuthenticated, validateBody(sendMessageRequestSchema), async (req: any, res) => {
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

      // Content moderation (only on plaintext messages)
      if (req.body.encrypted !== true) {
        const modResult = moderateContent(content);
        if (modResult.flagged) {
          ;(async () => { try { await supabaseAdmin.from('content_flags').insert({ message_type: 'therapy_message', message_id: msg.id, flag_reason: modResult.reason, severity: modResult.severity, status: 'pending' }); } catch {} })();
        }
      }

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
      const therapistId = String(req.body.therapistId || "");
      const therapistProfile = await storage.getTherapistProfile(therapistId);
      if (!therapistProfile) return res.status(404).json({ message: "Therapist profile not found" });

      let priceDinar = req.body.priceDinar;
      if (priceDinar === undefined || priceDinar === null) {
        priceDinar = therapistProfile.rateDinar;
      }
      if (
        therapistProfile.tier === "graduated_doctor"
        && Number.isFinite(Number(priceDinar))
        && Number(priceDinar) > graduatedDoctorCapDinar()
      ) {
        return res.status(400).json({
          message: `Graduated doctor appointment price cannot exceed ${graduatedDoctorCapDinar()} TND`,
        });
      }

      const apt = await storage.createAppointment({
        ...req.body,
        clientId: userId,
        priceDinar: Number.isFinite(Number(priceDinar)) ? Number(priceDinar) : null,
      });
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

        // Send email confirmation when therapist confirms an appointment
        if (apt.status === "confirmed") {
          const [clientProfile, therapistProfile] = await Promise.all([
            storage.getUser(apt.clientId),
            storage.getUser(apt.therapistId),
          ]);
          if (clientProfile?.email) {
            sendAppointmentConfirmation(clientProfile.email, {
              clientName: [clientProfile.firstName, clientProfile.lastName].filter(Boolean).join(" ") || clientProfile.email,
              therapistName: [therapistProfile?.firstName, therapistProfile?.lastName].filter(Boolean).join(" ") || "Therapist",
              scheduledAt: apt.scheduledAt,
              durationMinutes: apt.durationMinutes ?? 50,
              sessionType: apt.sessionType,
              priceDinar: apt.priceDinar,
              meetLink: apt.meetLink,
            });
          }
        }
      }
      res.json(apt);
    } catch (error) {
      res.status(500).json({ message: "Failed to update appointment" });
    }
  });

  app.get("/api/therapists/:userId/slots", async (req, res) => {
    try {
      const therapistId = req.params.userId;
      const from = typeof req.query.from === "string" ? req.query.from : undefined;
      const to = typeof req.query.to === "string" ? req.query.to : undefined;
      const requestedStatuses = normalizeStringArray(req.query.status)
        || (typeof req.query.status === "string" ? normalizeStringArray(req.query.status) : null);

      const authUser = await extractUser(req);
      const authProfile = authUser ? await storage.getUser(authUser.id) : null;
      const canViewAllStatuses = !!authUser && (
        authUser.id === therapistId || !!authProfile && ["moderator", "admin"].includes(authProfile.role)
      );
      const statuses = canViewAllStatuses
        ? (requestedStatuses || ["open", "booked", "cancelled", "closed"])
        : ["open"];

      const slots = await storage.getTherapistSlots(therapistId, from, to, statuses);
      res.json(slots);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch therapist slots" });
    }
  });

  app.post("/api/therapist/slots", isAuthenticated, validateBody(slotCreateRequestSchema), async (req: any, res) => {
    try {
      const callerId = req.user.id;
      const caller = await storage.getUser(callerId);
      if (!caller) return res.status(401).json({ message: "Unauthorized" });

      const therapistId = String(req.body.therapistId || callerId);
      const callerCanManageOthers = ["moderator", "admin"].includes(caller.role);
      if (!callerCanManageOthers && therapistId !== callerId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const therapistProfile = await storage.getTherapistProfile(therapistId);
      if (!therapistProfile) return res.status(404).json({ message: "Therapist profile not found" });

      const startsAt = String(req.body.startsAt || "").trim();
      const durationMinutes = Number(req.body.durationMinutes);
      const priceDinar = Number(req.body.priceDinar);
      if (!startsAt || !Number.isFinite(durationMinutes) || durationMinutes <= 0 || !Number.isFinite(priceDinar) || priceDinar < 0) {
        return res.status(400).json({ message: "Invalid slot payload" });
      }

      if (therapistProfile.tier === "graduated_doctor" && priceDinar > graduatedDoctorCapDinar()) {
        return res.status(400).json({
          message: `Graduated doctor slot price cannot exceed ${graduatedDoctorCapDinar()} TND`,
        });
      }

      const slot = await storage.createTherapistSlot({
        therapistId,
        startsAt,
        durationMinutes,
        priceDinar,
        status: "open",
        meetLink: req.body.meetLink ?? null,
      });

      res.status(201).json(slot);
    } catch (error) {
      res.status(500).json({ message: "Failed to create therapist slot" });
    }
  });

  app.patch("/api/therapist/slots/:id", isAuthenticated, async (req: any, res) => {
    try {
      const slotId = Number(req.params.id);
      if (!Number.isInteger(slotId)) return res.status(400).json({ message: "Invalid slot id" });

      const { data: slotRow } = await supabaseAdmin
        .from("therapist_slots")
        .select("*")
        .eq("id", slotId)
        .single();
      if (!slotRow) return res.status(404).json({ message: "Slot not found" });

      const callerId = req.user.id;
      const caller = await storage.getUser(callerId);
      if (!caller) return res.status(401).json({ message: "Unauthorized" });
      const canManageSlot = slotRow.therapist_id === callerId || ["moderator", "admin"].includes(caller.role);
      if (!canManageSlot) return res.status(403).json({ message: "Forbidden" });

      const therapistProfile = await storage.getTherapistProfile(slotRow.therapist_id);
      if (!therapistProfile) return res.status(404).json({ message: "Therapist profile not found" });

      const payload: Record<string, any> = {};
      if (req.body.startsAt !== undefined) payload.startsAt = String(req.body.startsAt);
      if (req.body.durationMinutes !== undefined) payload.durationMinutes = Number(req.body.durationMinutes);
      if (req.body.priceDinar !== undefined) payload.priceDinar = Number(req.body.priceDinar);
      if (req.body.status !== undefined) payload.status = String(req.body.status);

      if (payload.priceDinar !== undefined && therapistProfile.tier === "graduated_doctor" && payload.priceDinar > graduatedDoctorCapDinar()) {
        return res.status(400).json({
          message: `Graduated doctor slot price cannot exceed ${graduatedDoctorCapDinar()} TND`,
        });
      }

      const updated = await storage.updateTherapistSlot(slotId, payload);
      if (!updated) return res.status(500).json({ message: "Failed to update therapist slot" });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update therapist slot" });
    }
  });

  app.delete("/api/therapist/slots/:id", isAuthenticated, async (req: any, res) => {
    try {
      const slotId = Number(req.params.id);
      if (!Number.isInteger(slotId)) return res.status(400).json({ message: "Invalid slot id" });

      const { data: slotRow } = await supabaseAdmin
        .from("therapist_slots")
        .select("*")
        .eq("id", slotId)
        .single();
      if (!slotRow) return res.status(404).json({ message: "Slot not found" });

      const callerId = req.user.id;
      const caller = await storage.getUser(callerId);
      if (!caller) return res.status(401).json({ message: "Unauthorized" });
      const canManageSlot = slotRow.therapist_id === callerId || ["moderator", "admin"].includes(caller.role);
      if (!canManageSlot) return res.status(403).json({ message: "Forbidden" });

      const cancelled = await storage.cancelTherapistSlot(slotId);
      if (!cancelled) return res.status(500).json({ message: "Failed to cancel slot" });
      res.json(cancelled);
    } catch (error) {
      res.status(500).json({ message: "Failed to cancel therapist slot" });
    }
  });

  app.post("/api/appointments/from-slot/:slotId", isAuthenticated, async (req: any, res) => {
    try {
      const slotId = Number(req.params.slotId);
      if (!Number.isInteger(slotId)) return res.status(400).json({ message: "Invalid slot id" });

      const clientId = req.user.id;
      const paymentMethod: string = req.body.paymentMethod || "flouci";
      const result = await storage.createAppointmentFromSlot(
        slotId,
        clientId,
        req.body.notes || null,
        req.body.sessionType || "chat",
      );
      if (!result) return res.status(409).json({ message: "Slot unavailable or booking failed" });

      await notifyUser(
        result.appointment.therapistId,
        "New appointment request",
        "A client booked one of your published slots.",
        { type: "appointment", appointmentId: String(result.appointment.id) },
      );

      // Try to create a Google Meet event (if therapist has Google connected)
      let meetLink: string | null = result.slot.meetLink ?? null;
      if (isGoogleConfigured()) {
        try {
          const accessToken = await getValidAccessToken(result.appointment.therapistId);
          if (accessToken) {
            const [clientUser, therapistUser] = await Promise.all([
              storage.getUser(clientId),
              storage.getUser(result.appointment.therapistId),
            ]);
            const attendeeEmails: string[] = [];
            if (clientUser?.email) attendeeEmails.push(clientUser.email);
            if (therapistUser?.email) attendeeEmails.push(therapistUser.email);

            const meetResult = await createCalendarEvent(accessToken, {
              title: `Shifa — ${therapistUser?.firstName ?? "Therapist"} & ${clientUser?.firstName ?? "Client"}`,
              description: `Session booked via Shifa. Appointment #${result.appointment.id}.`,
              startIso: result.appointment.scheduledAt,
              durationMinutes: result.appointment.durationMinutes ?? 50,
              attendeeEmails,
            });
            meetLink = meetResult.meetLink;
          }
        } catch (meetErr: any) {
          console.error("[google-meet] Failed to create Meet event:", meetErr?.message);
          // Non-fatal: fall through to slot meetLink fallback
        }
      }

      // Fallback: inherit meet link from slot if Google Meet wasn't created
      if (!meetLink && result.slot.meetLink) {
        meetLink = result.slot.meetLink;
      }

      if (meetLink) {
        await storage.updateAppointment(result.appointment.id, { meetLink });
        result.appointment.meetLink = meetLink;
      }

      // Auto-initiate payment if price > 0
      let paymentUrl: string | null = null;
      if (result.slot.priceDinar > 0) {
        const transaction = await storage.createPaymentTransaction({
          clientId,
          therapistId: result.appointment.therapistId,
          appointmentId: result.appointment.id,
          amountDinar: result.slot.priceDinar,
          paymentMethod,
          status: "pending",
        });

        try {
          const origin = req.headers.origin || `${req.protocol}://${req.headers.host}`;
          const successUrl = `${origin}/appointments?payment=success&txn=${transaction.id}`;
          const failUrl = `${origin}/appointments?payment=failed&txn=${transaction.id}`;
          const amountMillimes = Math.round(result.slot.priceDinar * 1000);
          if (paymentMethod === "konnect") {
            const r = await createKonnectPayment(amountMillimes, transaction.id, successUrl, failUrl);
            paymentUrl = r.redirectUrl;
          } else {
            const r = await createFlouciPayment(amountMillimes, transaction.id, successUrl, failUrl);
            paymentUrl = r.redirectUrl;
          }
        } catch (payErr) {
          console.error("[payment] Auto-initiate failed:", payErr);
          // Don't fail the booking; client can pay manually
        }
      }

      res.status(201).json({ ...result, paymentUrl });
    } catch (error) {
      res.status(500).json({ message: "Failed to create appointment from slot" });
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

  app.post("/api/mood", isAuthenticated, validateBody(moodEntryRequestSchema), async (req: any, res) => {
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

  app.post("/api/journal", isAuthenticated, validateBody(journalEntryRequestSchema), async (req: any, res) => {
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
  // ---- User profile ----

  app.patch("/api/user/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { displayName, ...rest } = req.body;

      // Validate displayName format if provided
      if (displayName !== undefined && displayName !== null) {
        const namePattern = /^[a-zA-Z0-9\u0600-\u06FF_]{3,30}$/;
        if (!namePattern.test(displayName)) {
          return res.status(400).json({ message: "Invalid display name format" });
        }
        // Check uniqueness
        const available = await storage.isDisplayNameAvailable(displayName, userId);
        if (!available) {
          return res.status(409).json({ message: "Display name already taken" });
        }
      }

      const user = await storage.updateUser(userId, { ...rest, displayName: displayName ?? undefined });
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.get("/api/user/display-name/check/:name", isAuthenticated, async (req: any, res) => {
    try {
      const { name } = req.params;
      const namePattern = /^[a-zA-Z0-9\u0600-\u06FF_]{3,30}$/;
      if (!namePattern.test(name)) {
        return res.json({ available: false, reason: "invalid_format" });
      }
      const available = await storage.isDisplayNameAvailable(name, req.user.id);
      res.json({ available });
    } catch (error) {
      res.status(500).json({ message: "Failed to check display name" });
    }
  });

  // ---- E2E Key Backup ----

  app.post("/api/user/key-backup", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { wrappedPrivateKey, salt, iterations } = req.body;
      if (!wrappedPrivateKey || !salt || !iterations) {
        return res.status(400).json({ message: "wrappedPrivateKey, salt, and iterations are required" });
      }
      if (typeof iterations !== "number" || iterations < 100_000) {
        return res.status(400).json({ message: "iterations must be a number >= 100000" });
      }
      await storage.upsertUserKeyBackup(userId, wrappedPrivateKey, salt, iterations);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to save key backup" });
    }
  });

  app.get("/api/user/key-backup", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const backup = await storage.getUserKeyBackup(userId);
      if (!backup) return res.status(404).json({ message: "No key backup found" });
      res.json(backup);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch key backup" });
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

  app.post("/api/therapists/:userId/reviews", isAuthenticated, validateBody(reviewRequestSchema), async (req: any, res) => {
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

  // ---- Public therapist landing page ----

  app.get("/api/therapist/page/:slug", async (req, res) => {
    try {
      const profile = await storage.getTherapistBySlug(req.params.slug);
      if (!profile) return res.status(404).json({ message: "Not found" });
      if (!profile.landingPageEnabled) return res.status(404).json({ message: "Landing page not enabled" });

      const [user, reviews, slots] = await Promise.all([
        storage.getUser(profile.userId),
        storage.getReviewsByTherapist(profile.userId),
        storage.getTherapistSlots(profile.userId),
      ]);

      const openSlots = slots.filter((s) => s.status === "open" && new Date(s.startsAt) > new Date());
      const publishedReviews = reviews.filter((r) => r.comment).slice(0, 6);

      res.json({ profile, user, reviews: publishedReviews, openSlots });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch landing page" });
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

  app.post("/api/payments/flouci/initiate", isAuthenticated, validateBody(paymentInitiateRequestSchema), async (req: any, res) => {
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

      const origin = req.headers.origin || `${req.protocol}://${req.headers.host}`;
      const { redirectUrl } = await createFlouciPayment(
        Math.round(amount * 1000),  // TND → millimes
        transaction.id,
        `${origin}/appointments?payment=success&txn=${transaction.id}`,
        `${origin}/appointments?payment=failed&txn=${transaction.id}`,
      );

      res.json({ transaction, redirectUrl });
    } catch (error) {
      console.error("[flouci] initiate error:", error);
      res.status(500).json({ message: "Failed to initiate payment" });
    }
  });

  app.post("/api/payments/flouci/webhook", webhookLimiter, async (req, res) => {
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

  app.post("/api/payments/konnect/initiate", isAuthenticated, validateBody(paymentInitiateRequestSchema), async (req: any, res) => {
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

      const origin = req.headers.origin || `${req.protocol}://${req.headers.host}`;
      const { redirectUrl } = await createKonnectPayment(
        Math.round(amount * 1000),  // TND → millimes
        transaction.id,
        `${origin}/appointments?payment=success&txn=${transaction.id}`,
        `${origin}/appointments?payment=failed&txn=${transaction.id}`,
      );

      res.json({ transaction, redirectUrl });
    } catch (error) {
      console.error("[konnect] initiate error:", error);
      res.status(500).json({ message: "Failed to initiate payment" });
    }
  });

  app.post("/api/payments/konnect/webhook", webhookLimiter, async (req, res) => {
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

  app.get("/api/payments/:id/receipt", isAuthenticated, async (req: any, res) => {
    try {
      const paymentId = Number(req.params.id);
      if (!Number.isInteger(paymentId)) return res.status(400).json({ message: "Invalid payment id" });

      const userId = req.user.id;
      const payments = await storage.getPaymentsByUser(userId);
      const payment = payments.find((p) => p.id === paymentId);
      if (!payment) return res.status(404).json({ message: "Payment not found" });

      // Enrich with therapist name and appointment details
      const therapist = await storage.getUser(payment.therapistId);
      const appointment = payment.appointmentId
        ? await storage.getAppointment(payment.appointmentId)
        : null;

      res.json({
        payment,
        therapistName: therapist
          ? [therapist.firstName, therapist.lastName].filter(Boolean).join(" ")
          : payment.therapistId,
        appointment,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch receipt" });
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

  app.post("/api/onboarding", isAuthenticated, validateBody(onboardingRequestSchema), async (req: any, res) => {
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
      await markOnboardingCompleted(
        userId,
        typeof req.body.preferredLanguage === "string" ? req.body.preferredLanguage : null,
      );
      res.status(201).json(response);
    } catch (error) {
      res.status(500).json({ message: "Failed to save onboarding" });
    }
  });

  app.post("/api/onboarding/quick-start", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const response = await storage.saveOnboardingResponse({
        userId,
        primaryConcerns: normalizeStringArray(req.body.primaryConcerns),
        preferredLanguage: typeof req.body.preferredLanguage === "string" ? req.body.preferredLanguage : null,
        genderPreference: null,
        budgetRange: null,
        howDidYouHear: "quick_start",
      });
      await markOnboardingCompleted(
        userId,
        typeof req.body.preferredLanguage === "string" ? req.body.preferredLanguage : null,
      );
      res.status(201).json(response);
    } catch (error) {
      res.status(500).json({ message: "Failed to save quick-start onboarding" });
    }
  });

  app.post("/api/onboarding/preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const existing = await storage.getOnboardingResponse(userId);
      const preferredLanguage =
        typeof req.body.preferredLanguage === "string"
          ? req.body.preferredLanguage
          : existing?.preferredLanguage || null;
      const response = await storage.saveOnboardingResponse({
        userId,
        primaryConcerns: existing?.primaryConcerns || null,
        preferredLanguage,
        genderPreference: req.body.genderPreference || existing?.genderPreference || null,
        budgetRange: req.body.budgetRange || existing?.budgetRange || null,
        howDidYouHear: req.body.howDidYouHear || existing?.howDidYouHear || "follow_up",
      });
      await markOnboardingCompleted(userId, preferredLanguage);
      res.status(201).json(response);
    } catch (error) {
      res.status(500).json({ message: "Failed to save onboarding preferences" });
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

  // ---- Listener Qualification Test ----

  // GET own test result
  app.get("/api/listener/qualification-test", isAuthenticated, async (req: any, res) => {
    try {
      const result = await storage.getListenerQualificationTest(req.user.id);
      res.json(result || null);
    } catch {
      res.status(500).json({ message: "Failed to fetch qualification test result" });
    }
  });

  // POST submit answers & auto-score
  app.post("/api/listener/qualification-test", isAuthenticated, async (req: any, res) => {
    try {
      const answers = req.body?.answers;
      if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
        return res.status(400).json({ message: "answers must be an object mapping question id to chosen option index" });
      }

      // Validate keys are known question ids
      const knownIds = new Set(QUALIFICATION_QUESTIONS.map((q) => q.id));
      for (const key of Object.keys(answers)) {
        if (!knownIds.has(key)) {
          return res.status(400).json({ message: `Unknown question id: ${key}` });
        }
      }

      const { score, passed, total, correct } = scoreAnswers(answers);

      const result = await storage.upsertListenerQualificationTest(
        req.user.id,
        score,
        passed,
        answers,
      );

      res.json({ ...result, total, correct });
    } catch {
      res.status(500).json({ message: "Failed to submit qualification test" });
    }
  });

  // ---- Listener (7 Cups-style) ----

  app.post("/api/listener/apply", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;

      // Must pass the qualification test first
      const testResult = await storage.getListenerQualificationTest(userId);
      if (!testResult || !testResult.passed) {
        return res.status(403).json({
          message: "You must pass the qualification test before applying.",
          code: "QUALIFICATION_TEST_REQUIRED",
        });
      }

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

  app.get("/api/listener/progress", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const progress = await storage.getListenerProgress(userId);
      if (!progress) {
        return res.json({
          listenerId: userId,
          points: 0,
          level: 1,
          sessionsRatedCount: 0,
          lastCalculatedAt: null,
        });
      }
      res.json(progress);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch listener progress" });
    }
  });

  app.get("/api/listener/progress/details", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const summary = await storage.getListenerProgressSummary(userId);
      res.json(summary);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch listener progress details" });
    }
  });

  app.get("/api/listener/leaderboard", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const limitRaw = Number(req.query.limit);
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, Math.floor(limitRaw))) : 20;
      const leaderboard = await storage.getListenerLeaderboard(limit);

      let myRank: number | null = null;
      const inTop = leaderboard.find((entry) => entry.listenerId === userId);
      if (inTop) {
        myRank = inTop.rank;
      } else {
        const { data: myProgress } = await supabaseAdmin
          .from("listener_progress")
          .select("points")
          .eq("listener_id", userId)
          .maybeSingle();
        if (myProgress) {
          const { data: allProgressRows } = await supabaseAdmin
            .from("listener_progress")
            .select("listener_id, points")
            .order("points", { ascending: false });
          if (allProgressRows) {
            const sorted = allProgressRows
              .map((row: any) => ({ listenerId: row.listener_id, points: Number(row.points || 0) }))
              .sort((a, b) => b.points - a.points);
            const index = sorted.findIndex((row) => row.listenerId === userId);
            myRank = index >= 0 ? index + 1 : null;
          }
        }
      }

      res.json({ leaderboard, myRank });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch listener leaderboard" });
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

  app.post("/api/peer/queue/join", isAuthenticated, validateBody(queueJoinRequestSchema), async (req: any, res) => {
    try {
      const clientId = req.user.id;
      const preferredLanguage = typeof req.body.preferredLanguage === "string"
        ? req.body.preferredLanguage
        : null;
      const topicTags = normalizeStringArray(req.body.topicTags);

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

  app.get("/api/peer/queue/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const [activeQueueEntry, waitingEntries, availableListeners] = await Promise.all([
        storage.getActiveQueueEntry(userId),
        storage.listWaitingQueueEntries(),
        storage.listAvailableListeners(),
      ]);

      if (!activeQueueEntry || activeQueueEntry.status !== "waiting") {
        return res.json({
          activeQueueEntry: activeQueueEntry || null,
          queuePosition: null,
          waitingCount: waitingEntries.length,
          availableListeners: availableListeners.length,
          availableForYou: availableListeners.length,
          estimatedWaitMinutes: null,
        });
      }

      const queuePositionIndex = waitingEntries.findIndex((entry) => entry.id === activeQueueEntry.id);
      const queuePosition = queuePositionIndex >= 0 ? queuePositionIndex + 1 : null;

      const matchedListeners = await storage.listAvailableListeners(
        activeQueueEntry.preferredLanguage || undefined,
        activeQueueEntry.topicTags || undefined,
      );

      const availableForYou = matchedListeners.length;
      const positionForEstimate = queuePosition || waitingEntries.length || 1;
      const estimatedWaitMinutes = availableForYou > 0
        ? Math.max(1, Math.ceil(positionForEstimate / availableForYou) * 3)
        : Math.max(3, positionForEstimate * 4);

      res.json({
        activeQueueEntry,
        queuePosition,
        waitingCount: waitingEntries.length,
        availableListeners: availableListeners.length,
        availableForYou,
        estimatedWaitMinutes,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch queue status" });
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

  app.post("/api/peer/session/:id/messages", isAuthenticated, validateBody(peerMessageRequestSchema), async (req: any, res) => {
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

      // Content moderation on plaintext peer messages
      if (!encrypted) {
        const modResult = moderateContent(content);
        if (modResult.flagged && modResult.reason !== "crisis_content") {
          // Crisis content is already handled by crisisDetected below
          ;(async () => { try { await supabaseAdmin.from('content_flags').insert({ message_type: 'peer_message', message_id: message.id, flag_reason: modResult.reason, severity: modResult.severity, status: 'pending' }); } catch {} })();
        }
      }

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
      if (session.status !== "completed") {
        return res.status(409).json({ message: "Session must be completed before rating" });
      }

      const rating = Number(req.body.rating);
      if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ message: "rating must be between 1 and 5" });
      }

      const comment = typeof req.body.comment === "string" ? req.body.comment.trim() : "";

      let feedback;
      try {
        feedback = await storage.createPeerSessionFeedback({
          sessionId,
          clientId: session.clientId,
          listenerId: session.listenerId,
          rating,
          tags: normalizeStringArray(req.body.tags),
          comment: comment || null,
        });
      } catch (error: any) {
        if (error?.code === "23505") {
          return res.status(409).json({ message: "Feedback already submitted for this session" });
        }
        throw error;
      }

      const progress = await storage.applyListenerFeedbackOutcome({
        sessionId,
        listenerId: session.listenerId,
        rating,
        hasDetailedComment: comment.length >= 40,
      });

      res.status(201).json({ feedback, listenerProgress: progress });
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

  // ---- Google Meet / Calendar integration ----

  /** Get a fresh access token, refreshing if < 5 min to expiry. */
  async function getValidAccessToken(therapistId: string): Promise<string | null> {
    const raw = await storage.getGoogleTokensRaw(therapistId);
    if (!raw) return null;

    const expiresAt = raw.expiresAt ? new Date(raw.expiresAt) : null;
    const fiveMinFromNow = new Date(Date.now() + 5 * 60_000);

    if (expiresAt && expiresAt > fiveMinFromNow) {
      return decryptToken(raw.accessTokenEncrypted);
    }

    // Need to refresh
    const refreshToken = decryptToken(raw.refreshTokenEncrypted);
    const refreshed = await refreshAccessToken(refreshToken);
    await storage.updateGoogleAccessToken(therapistId, encryptToken(refreshed.accessToken), refreshed.expiresAt);
    return refreshed.accessToken;
  }

  // GET /api/doctor/google/status — is Google connected?
  app.get("/api/doctor/google/status", isAuthenticated, requireRoles(["therapist"]), async (req: any, res) => {
    try {
      if (!isGoogleConfigured()) {
        return res.json({ connected: false, configured: false });
      }
      const meta = await storage.getGoogleTokenMeta(req.user.id);
      res.json({
        connected: Boolean(meta),
        configured: true,
        connectedAt: meta?.connectedAt ?? null,
      });
    } catch {
      res.status(500).json({ message: "Failed to get Google status" });
    }
  });

  // POST /api/doctor/google/connect — return OAuth URL
  app.post("/api/doctor/google/connect", isAuthenticated, requireRoles(["therapist"]), async (req: any, res) => {
    try {
      if (!isGoogleConfigured()) {
        return res.status(503).json({ message: "Google integration is not configured on this server." });
      }
      const authUrl = generateGoogleAuthUrl(req.user.id);
      res.json({ authUrl });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to generate Google auth URL" });
    }
  });

  // GET /api/doctor/google/callback — OAuth callback (redirect-based)
  app.get("/api/doctor/google/callback", async (req: any, res) => {
    const code = typeof req.query.code === "string" ? req.query.code : null;
    const therapistId = typeof req.query.state === "string" ? req.query.state : null;
    const origin = req.headers.origin || `${req.protocol}://${req.headers.host}`;

    if (!code || !therapistId) {
      return res.redirect(`${origin}/therapist-dashboard?google=error&msg=missing_params`);
    }

    try {
      const tokens = await exchangeCodeForTokens(code);
      await storage.upsertGoogleTokens(
        therapistId,
        encryptToken(tokens.accessToken),
        encryptToken(tokens.refreshToken),
        tokens.expiresAt,
      );
      res.redirect(`${origin}/therapist-dashboard?google=connected`);
    } catch (err: any) {
      console.error("[google/callback] token exchange failed:", err?.message);
      res.redirect(`${origin}/therapist-dashboard?google=error&msg=exchange_failed`);
    }
  });

  // DELETE /api/doctor/google/disconnect — revoke + delete tokens
  app.delete("/api/doctor/google/disconnect", isAuthenticated, requireRoles(["therapist"]), async (req: any, res) => {
    try {
      const raw = await storage.getGoogleTokensRaw(req.user.id);
      if (raw) {
        // Revoke both tokens (best-effort)
        const accessToken = decryptToken(raw.accessTokenEncrypted);
        const refreshToken = decryptToken(raw.refreshTokenEncrypted);
        await Promise.allSettled([revokeGoogleToken(accessToken), revokeGoogleToken(refreshToken)]);
        await storage.deleteGoogleTokens(req.user.id);
      }
      res.json({ disconnected: true });
    } catch {
      res.status(500).json({ message: "Failed to disconnect Google account" });
    }
  });

  // ---- Admin moderation ----

  app.get("/api/admin/listeners", isAuthenticated, requireRoles(["moderator", "admin"]), async (req, res) => {
    try {
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const [applications, reports, allTests] = await Promise.all([
        storage.listListenerApplications(status),
        storage.listOpenPeerReports(),
        storage.listAllQualificationTests(),
      ]);
      const listenerIds = Array.from(new Set([
        ...applications.map((application) => application.userId),
        ...reports.map((report) => report.targetUserId).filter((id): id is string => Boolean(id)),
      ]));
      const riskSnapshots = await storage.getListenerRiskSnapshots(listenerIds);
      // Index tests by userId for O(1) lookup on the frontend
      const qualificationTests: Record<string, typeof allTests[0]> = {};
      for (const test of allTests) {
        qualificationTests[test.userId] = test;
      }
      res.json({ applications, reports, riskSnapshots, qualificationTests });
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

      const auditAction =
        status === "approved" ? "listener.approve" :
        status === "rejected" ? "listener.reject" :
        "listener.changes_requested";
      logAudit(reviewerId, auditAction, "listener_application", applicationId, {
        status,
        activationStatus: req.body.activationStatus,
        moderationNotes: req.body.moderationNotes,
        targetUserId: application.userId,
      }, req);

      // Send email notification to the applicant
      const applicantProfile = await storage.getUser(application.userId);
      if (applicantProfile?.email) {
        const name = [applicantProfile.firstName, applicantProfile.lastName].filter(Boolean).join(" ") || applicantProfile.email;
        sendListenerApplicationUpdate(applicantProfile.email, name, status as "approved" | "rejected" | "changes_requested");
      }

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

      logAudit(reviewerId, "listener.activate_trial", "listener_profile", listenerUserId, null, req);

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

      logAudit(reviewerId, "listener.activate_live", "listener_profile", listenerUserId, null, req);

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

      let listenerProgress = null;
      if (report.targetUserId) {
        const targetUser = await storage.getUser(report.targetUserId);
        if (targetUser?.role === "listener") {
          listenerProgress = await storage.applyListenerReportPenalty(
            report.targetUserId,
            report.id,
            moderatorId,
          );
        }
      }

      res.json({ report, listenerProgress });

      logAudit(moderatorId, "report.resolve", "peer_report", reportId, {
        targetUserId: report.targetUserId,
        penaltyApplied: listenerProgress !== null,
      }, req);
    } catch (error) {
      res.status(500).json({ message: "Failed to resolve peer report" });
    }
  });

  // ---- Therapist Verification ----

  app.post("/api/therapist/verification/upload", isAuthenticated, async (req: any, res) => {
    try {
      const therapistId = req.user.id;
      const { documentType, documentUrl } = req.body;
      if (!documentType || !documentUrl) {
        return res.status(400).json({ message: "documentType and documentUrl are required" });
      }
      const valid = ["license", "diploma", "id_card", "cv"];
      if (!valid.includes(documentType)) {
        return res.status(400).json({ message: "Invalid document type" });
      }
      const verification = await storage.upsertTherapistVerification({
        therapistId,
        documentType,
        documentUrl,
      });
      res.json(verification);
    } catch (error) {
      res.status(500).json({ message: "Failed to upload verification" });
    }
  });

  app.get("/api/therapist/verification", isAuthenticated, async (req: any, res) => {
    try {
      const therapistId = req.user.id;
      const verifications = await storage.getTherapistVerifications(therapistId);
      res.json(verifications);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch verifications" });
    }
  });

  app.get("/api/admin/qualification-tests", isAuthenticated, requireRoles(["moderator", "admin"]), async (_req, res) => {
    try {
      const tests = await storage.listAllQualificationTests();
      res.json(tests);
    } catch {
      res.status(500).json({ message: "Failed to fetch qualification tests" });
    }
  });

  app.get("/api/admin/verifications", isAuthenticated, requireRoles(["moderator", "admin"]), async (req, res) => {
    try {
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const verifications = await storage.getAllVerifications(status);
      res.json(verifications);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch verifications" });
    }
  });

  app.post("/api/admin/verifications/:id/review", isAuthenticated, requireRoles(["moderator", "admin"]), async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid id" });
      const { status, notes } = req.body;
      if (!["approved", "rejected"].includes(status)) {
        return res.status(400).json({ message: "Status must be approved or rejected" });
      }
      const reviewerId = req.user.id;
      const verification = await storage.reviewTherapistVerification(id, status, reviewerId, notes);
      if (!verification) return res.status(404).json({ message: "Not found" });

      // If approved, mark therapist as verified
      if (status === "approved") {
        await storage.updateTherapistProfile(verification.therapistId, { verified: true });
      }

      logAudit(reviewerId, status === "approved" ? "verification.approve" : "verification.reject", "therapist_verification", id, {
        therapistId: verification.therapistId,
        notes,
      }, req);

      // Send email to the therapist
      const therapistUser = await storage.getUser(verification.therapistId);
      if (therapistUser?.email) {
        const name = [therapistUser.firstName, therapistUser.lastName].filter(Boolean).join(" ") || therapistUser.email;
        sendVerificationStatusUpdate(therapistUser.email, name, status as "approved" | "rejected", notes);
      }

      res.json(verification);
    } catch (error) {
      res.status(500).json({ message: "Failed to review verification" });
    }
  });

  // ---- Content Moderation Admin ----

  app.get("/api/admin/content-flags", isAuthenticated, requireRoles(["moderator", "admin"]), async (req: any, res) => {
    try {
      const status = typeof req.query.status === "string" ? req.query.status : "pending";
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const offset = Number(req.query.offset) || 0;
      const { data, error } = await supabaseAdmin
        .from("content_flags")
        .select("*")
        .eq("status", status)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) throw error;
      res.json(data ?? []);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch content flags" });
    }
  });

  app.post("/api/admin/content-flags/:id/review", isAuthenticated, requireRoles(["moderator", "admin"]), async (req: any, res) => {
    try {
      const flagId = Number(req.params.id);
      if (!Number.isInteger(flagId)) return res.status(400).json({ message: "Invalid flag id" });
      const { action } = req.body; // "dismiss" | "escalate" | "reviewed"
      if (!["dismiss", "escalate", "reviewed"].includes(action)) {
        return res.status(400).json({ message: "action must be dismiss, escalate, or reviewed" });
      }
      const reviewerId = req.user.id;
      const { data, error } = await supabaseAdmin
        .from("content_flags")
        .update({
          status: action === "dismiss" ? "dismissed" : "reviewed",
          reviewer_id: reviewerId,
          reviewed_at: new Date().toISOString(),
          severity: action === "escalate" ? "critical" : undefined,
        })
        .eq("id", flagId)
        .select()
        .single();
      if (error || !data) return res.status(404).json({ message: "Flag not found" });
      logAudit(reviewerId, "report.resolve", "content_flag", flagId, { action }, req);
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: "Failed to review content flag" });
    }
  });

  app.get("/api/admin/audit-log", isAuthenticated, requireRoles(["moderator", "admin"]), async (req: any, res) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 100, 500);
      const offset = Number(req.query.offset) || 0;
      const logs = await storage.getAuditLog(limit, offset);
      logAudit(req.user?.id ?? null, "admin.analytics_view", "audit_log", null, { limit, offset }, req);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch audit log" });
    }
  });

  app.get("/api/admin/analytics", isAuthenticated, requireRoles(["moderator", "admin"]), async (req: any, res) => {
    try {
      const analytics = await storage.getAdminAnalytics();
      logAudit(req.user?.id ?? null, "admin.analytics_view", "analytics", null, null, req);
      res.json(analytics);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // ---- Admin: User Management (Phase 3.1) ----

  app.get("/api/admin/users", isAuthenticated, requireRoles(["admin"]), async (req: any, res) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(Number(req.query.limit) || 20, 100);
      const search = req.query.search as string | undefined;
      const result = await storage.getUsersPaginated(page, limit, search);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.patch("/api/admin/users/:id", isAuthenticated, requireRoles(["admin"]), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { role } = req.body as { role?: string };
      if (!role) return res.status(400).json({ message: "role required" });
      const allowed = ["user", "client", "therapist", "moderator", "admin"];
      if (!allowed.includes(role)) return res.status(400).json({ message: "Invalid role" });
      const updated = await storage.updateUser(id, { role });
      if (!updated) return res.status(404).json({ message: "User not found" });
      logAudit(req.user.id, "admin.user_role_change", "user", id, { newRole: role }, req);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.get("/api/admin/revenue", isAuthenticated, requireRoles(["admin"]), async (req: any, res) => {
    try {
      const days = Math.min(Number(req.query.days) || 30, 365);
      const data = await storage.getRevenueAnalytics(days);
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch revenue analytics" });
    }
  });

  // ---- Treatment Goals (Phase 3.3) ----

  app.get("/api/goals", isAuthenticated, async (req: any, res) => {
    try {
      const goals = await storage.getTreatmentGoals(req.user.id);
      res.json(goals);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch goals" });
    }
  });

  app.post("/api/goals", isAuthenticated, async (req: any, res) => {
    try {
      const { insertTreatmentGoalSchema } = await import("@shared/schema");
      const parsed = insertTreatmentGoalSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid goal data", errors: parsed.error.issues });
      const goal = await storage.createTreatmentGoal(req.user.id, parsed.data);
      res.status(201).json(goal);
    } catch (error) {
      res.status(500).json({ message: "Failed to create goal" });
    }
  });

  app.patch("/api/goals/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { updateTreatmentGoalSchema } = await import("@shared/schema");
      const parsed = updateTreatmentGoalSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid goal data", errors: parsed.error.issues });
      const goal = await storage.updateTreatmentGoal(Number(req.params.id), req.user.id, parsed.data);
      if (!goal) return res.status(404).json({ message: "Goal not found" });
      res.json(goal);
    } catch (error) {
      res.status(500).json({ message: "Failed to update goal" });
    }
  });

  app.delete("/api/goals/:id", isAuthenticated, async (req: any, res) => {
    try {
      await storage.deleteTreatmentGoal(Number(req.params.id), req.user.id);
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete goal" });
    }
  });

  // ---- Session Summaries (Phase 3.3) ----

  app.get("/api/session-summaries/:appointmentId", isAuthenticated, async (req: any, res) => {
    try {
      const appointmentId = Number(req.params.appointmentId);
      const appointment = await storage.getAppointment(appointmentId);
      if (!appointment) return res.status(404).json({ message: "Appointment not found" });
      // Allow therapist or client
      if (appointment.therapistId !== req.user.id && appointment.clientId !== req.user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const summary = await storage.getSessionSummary(appointmentId);
      if (!summary) return res.status(404).json({ message: "No summary yet" });
      // Clients only see client_visible summaries
      if (appointment.clientId === req.user.id && !summary.clientVisible) {
        return res.status(404).json({ message: "No summary yet" });
      }
      res.json(summary);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch session summary" });
    }
  });

  app.post("/api/session-summaries/:appointmentId", isAuthenticated, async (req: any, res) => {
    try {
      const { upsertSessionSummarySchema } = await import("@shared/schema");
      const parsed = upsertSessionSummarySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.issues });

      const appointmentId = Number(req.params.appointmentId);
      const appointment = await storage.getAppointment(appointmentId);
      if (!appointment) return res.status(404).json({ message: "Appointment not found" });
      if (appointment.therapistId !== req.user.id) return res.status(403).json({ message: "Only therapist can write summaries" });

      const summary = await storage.upsertSessionSummary(
        appointmentId,
        req.user.id,
        appointment.clientId,
        parsed.data,
      );
      res.status(201).json(summary);
    } catch (error) {
      res.status(500).json({ message: "Failed to save session summary" });
    }
  });

  // ---- Progress Analytics (Phase 3.3) ----

  app.get("/api/progress/analytics", isAuthenticated, async (req: any, res) => {
    try {
      const days = Math.min(Number(req.query.days) || 30, 90);
      const moodTrend = await storage.getMoodAnalytics(req.user.id, days);
      res.json({ moodTrend });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // ---- Batch Slot Creation (Phase 3.2) ----

  app.post("/api/therapist/slots/batch", isAuthenticated, requireRoles(["therapist"]), async (req: any, res) => {
    try {
      const { slots } = req.body as { slots: Array<{ startsAt: string; durationMinutes: number; priceDinar: number; meetLink?: string | null }> };
      if (!Array.isArray(slots) || slots.length === 0) return res.status(400).json({ message: "slots array required" });
      if (slots.length > 50) return res.status(400).json({ message: "Max 50 slots per batch" });

      const { slotCreateRequestSchema } = await import("@shared/schema");
      const created = [];
      for (const slotData of slots) {
        const parsed = slotCreateRequestSchema.safeParse(slotData);
        if (!parsed.success) continue;
        const slot = await storage.createTherapistSlot({
          therapistId: req.user.id,
          startsAt: parsed.data.startsAt,
          durationMinutes: parsed.data.durationMinutes,
          priceDinar: parsed.data.priceDinar,
          meetLink: parsed.data.meetLink,
        });
        created.push(slot);
      }
      res.status(201).json({ created, count: created.length });
    } catch (error) {
      res.status(500).json({ message: "Failed to create slots" });
    }
  });

  // ---- Doctor Payouts (Phase 4) ----

  // GET /api/doctor/payouts — therapist views own payout history
  app.get("/api/doctor/payouts", isAuthenticated, requireRoles(["therapist"]), async (req: any, res) => {
    try {
      const payouts = await storage.getDoctorPayouts(req.user.id);
      res.json(payouts);
    } catch {
      res.status(500).json({ message: "Failed to fetch payouts" });
    }
  });

  // GET /api/admin/doctor-payouts — admin views all payouts
  app.get("/api/admin/doctor-payouts", isAuthenticated, requireRoles(["admin"]), async (_req, res) => {
    try {
      const payouts = await storage.getAllDoctorPayouts();
      res.json(payouts);
    } catch {
      res.status(500).json({ message: "Failed to fetch payouts" });
    }
  });

  // POST /api/admin/doctor-payouts/generate — admin generates a payout for a doctor
  app.post("/api/admin/doctor-payouts/generate", isAuthenticated, requireRoles(["admin"]), async (req: any, res) => {
    try {
      const { doctorId, periodStart, periodEnd, platformFeePct = 15 } = req.body;
      if (!doctorId || !periodStart || !periodEnd) {
        return res.status(400).json({ message: "doctorId, periodStart, and periodEnd required" });
      }
      // Calculate totals from completed payment transactions in that period
      const supabase = supabaseAdmin;
      const { data: txns } = await supabase
        .from("payment_transactions")
        .select("amount_dinar, appointment_id")
        .eq("therapist_id", doctorId)
        .eq("status", "paid")
        .gte("created_at", new Date(periodStart).toISOString())
        .lte("created_at", new Date(periodEnd + "T23:59:59").toISOString());

      const totalAmount = (txns ?? []).reduce((sum: number, t: any) => sum + (t.amount_dinar || 0), 0);
      const platformFee = Math.round(totalAmount * platformFeePct) / 100;
      const netAmount = Math.round((totalAmount - platformFee) * 100) / 100;

      const payout = await storage.createDoctorPayout({
        doctorId,
        periodStart,
        periodEnd,
        totalSessions: (txns ?? []).length,
        totalAmountDinar: totalAmount,
        platformFeeDinar: platformFee,
        netAmountDinar: netAmount,
      });
      res.status(201).json(payout);
    } catch {
      res.status(500).json({ message: "Failed to generate payout" });
    }
  });

  // PATCH /api/admin/doctor-payouts/:id — admin updates payout status
  app.patch("/api/admin/doctor-payouts/:id", isAuthenticated, requireRoles(["admin"]), async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid payout id" });
      const { status } = req.body;
      if (!["pending", "processing", "paid", "failed"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      const payout = await storage.updateDoctorPayoutStatus(id, status);
      if (!payout) return res.status(404).json({ message: "Payout not found" });
      res.json(payout);
    } catch {
      res.status(500).json({ message: "Failed to update payout" });
    }
  });

  return httpServer;
}
