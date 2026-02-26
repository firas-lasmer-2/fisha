import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { supabaseAdmin } from "./supabase";
import OpenAI from "openai";
import crypto from "crypto";
import { sendPushToTokens } from "./notifications";
import { mapProfile, type User } from "@shared/schema";

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

const STUDENT_THERAPIST_CAP_DINAR = Number(process.env.STUDENT_THERAPIST_CAP_DINAR || "20");

function studentTherapistCapDinar(): number {
  if (!Number.isFinite(STUDENT_THERAPIST_CAP_DINAR) || STUDENT_THERAPIST_CAP_DINAR <= 0) {
    return 20;
  }
  return STUDENT_THERAPIST_CAP_DINAR;
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

    if (preferredLanguage && ["ar", "fr", "darija"].includes(preferredLanguage)) {
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

  app.post("/api/auth/signup", async (req, res) => {
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
      res.json({
        user: profile || fallbackProfile({ id: data.user!.id, email: data.user?.email || email }, normalizeRole(role)),
        session: session.session,
      });
    } catch (error) {
      console.error("Signup failed", error);
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
          req.query.tier === "student" || req.query.tier === "professional"
            ? (req.query.tier as "student" | "professional")
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
      const isStudentTier = currentProfile.tier === "student";
      if (isStudentTier && Number.isFinite(Number(nextRate)) && Number(nextRate) > studentTherapistCapDinar()) {
        return res.status(400).json({
          message: `Student therapist rate cannot exceed ${studentTherapistCapDinar()} TND`,
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
        if (!["student", "professional"].includes(tier)) {
          return res.status(400).json({ message: "tier must be student or professional" });
        }

        const reviewerId = req.user.id;
        const existingProfile = await storage.getTherapistProfile(therapistUserId);
        if (!existingProfile) return res.status(404).json({ message: "Therapist profile not found" });

        if (tier === "student" && (existingProfile.rateDinar || 0) > studentTherapistCapDinar()) {
          return res.status(400).json({
            message: `Current therapist rate exceeds student cap (${studentTherapistCapDinar()} TND)`,
          });
        }

        const updated = await storage.updateTherapistTier(
          therapistUserId,
          tier as "student" | "professional",
          reviewerId,
        );
        if (!updated) return res.status(500).json({ message: "Failed to update therapist tier" });
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
      const therapistId = String(req.body.therapistId || "");
      const therapistProfile = await storage.getTherapistProfile(therapistId);
      if (!therapistProfile) return res.status(404).json({ message: "Therapist profile not found" });

      let priceDinar = req.body.priceDinar;
      if (priceDinar === undefined || priceDinar === null) {
        priceDinar = therapistProfile.rateDinar;
      }
      if (
        therapistProfile.tier === "student"
        && Number.isFinite(Number(priceDinar))
        && Number(priceDinar) > studentTherapistCapDinar()
      ) {
        return res.status(400).json({
          message: `Student therapist appointment price cannot exceed ${studentTherapistCapDinar()} TND`,
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

  app.post("/api/therapist/slots", isAuthenticated, async (req: any, res) => {
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

      if (therapistProfile.tier === "student" && priceDinar > studentTherapistCapDinar()) {
        return res.status(400).json({
          message: `Student therapist slot price cannot exceed ${studentTherapistCapDinar()} TND`,
        });
      }

      const slot = await storage.createTherapistSlot({
        therapistId,
        startsAt,
        durationMinutes,
        priceDinar,
        status: "open",
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

      if (payload.priceDinar !== undefined && therapistProfile.tier === "student" && payload.priceDinar > studentTherapistCapDinar()) {
        return res.status(400).json({
          message: `Student therapist slot price cannot exceed ${studentTherapistCapDinar()} TND`,
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

      res.status(201).json(result);
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

  app.post("/api/peer/queue/join", isAuthenticated, async (req: any, res) => {
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

  // ---- Admin moderation ----

  app.get("/api/admin/listeners", isAuthenticated, requireRoles(["moderator", "admin"]), async (req, res) => {
    try {
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const [applications, reports] = await Promise.all([
        storage.listListenerApplications(status),
        storage.listOpenPeerReports(),
      ]);
      const listenerIds = Array.from(new Set([
        ...applications.map((application) => application.userId),
        ...reports.map((report) => report.targetUserId).filter((id): id is string => Boolean(id)),
      ]));
      const riskSnapshots = await storage.getListenerRiskSnapshots(listenerIds);
      res.json({ applications, reports, riskSnapshots });
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
    } catch (error) {
      res.status(500).json({ message: "Failed to resolve peer report" });
    }
  });

  return httpServer;
}
