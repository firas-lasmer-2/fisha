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
  purchaseSubscriptionSchema, matchingPreferencesSchema,
} from "@shared/schema";
import { authLimiter, webhookLimiter, paymentLimiter, bookingLimiter, displayNameLimiter } from "./middleware/rate-limit";
import { QUALIFICATION_QUESTIONS, scoreAnswers } from "@shared/qualification-questions";
import { validateBody } from "./middleware/validate";
import { logAudit } from "./audit";
import { createFlouciPayment } from "./payments/flouci";
import { createKonnectPayment } from "./payments/konnect";
import {
  sendAppointmentConfirmation,
  sendAppointmentBooked,
  sendVerificationStatusUpdate,
  sendListenerApplicationUpdate,
  sendWelcome,
} from "./email";
import { moderateContent } from "./moderation";
import { matchTherapists, type TherapistCandidate } from "./matching";

// Crisis keywords for auto-detection (Arabic, French, Tunisian dialect)
const CRISIS_KEYWORDS = [
  // Arabic
  "انتحار", "أقتل نفسي", "أريد الموت", "لا أريد العيش", "أنهي حياتي",
  // French
  "suicide", "me tuer", "mourir", "en finir", "plus envie de vivre",
  // Darija
  "نقتل روحي", "نموت", "ما نحبش نعيش", "نكمل حياتي",
];
const LISTENER_DIFFICULT_SESSION_COOLDOWN_MINUTES = 20;
const LISTENER_HIGH_LOAD_COOLDOWN_MINUTES = 45;
const PLATFORM_ROLES = ["client", "therapist", "listener", "moderator", "admin"] as const;

type PlatformRole = (typeof PLATFORM_ROLES)[number];

function normalizePlatformRole(value: unknown): PlatformRole {
  const role = String(value || "").trim();
  if ((PLATFORM_ROLES as readonly string[]).includes(role)) {
    return role as PlatformRole;
  }
  return "client";
}

function listenerSeasonKeyForDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function previousListenerSeasonKey(baseDate: Date = new Date()): string {
  return listenerSeasonKeyForDate(new Date(Date.UTC(
    baseDate.getUTCFullYear(),
    baseDate.getUTCMonth() - 1,
    1,
  )));
}

function isValidListenerSeasonKey(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function escapePdfText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildListenerCertificatePdf(input: {
  seasonKey: string;
  listenerName: string;
  certificationTitle: string;
  issueDate: string;
  certificateCode: string;
}): Buffer {
  const title = "Shifa Listener Recognition Certificate";
  const lines = [
    title,
    "",
    "Awarded to:",
    input.listenerName,
    "",
    `Achievement: ${input.certificationTitle}`,
    `Season: ${input.seasonKey}`,
    `Issued: ${input.issueDate}`,
    `Certificate code: ${input.certificateCode}`,
  ];

  const streamLines: string[] = ["BT", "/F1 24 Tf 72 740 Td"];
  lines.forEach((line, index) => {
    const fontSize = index === 0 ? 24 : index === 3 ? 22 : 14;
    if (index > 0) {
      streamLines.push("0 -30 Td");
    }
    streamLines.push(`/F1 ${fontSize} Tf (${escapePdfText(line)}) Tj`);
  });
  streamLines.push("ET");
  const content = streamLines.join("\n");

  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj",
    `4 0 obj << /Length ${Buffer.byteLength(content, "utf8")} >> stream\n${content}\nendstream endobj`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${object}\n`;
  }

  const xrefStart = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}

// ---- Auth middleware ----

/** Generate a Jitsi Meet link for a session. No auth required. */
function generateJitsiLink(): string {
  return `https://meet.jit.si/shifa-${crypto.randomUUID()}`;
}

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
    if (!profile) return res.status(403).json({ message: "Forbidden" });

    const userRole = normalizePlatformRole(profile.role);
    const allowedRoles = roles
      .map((role) => String(role || "").trim())
      .flatMap((role) => {
        if (["therapist", "doctor", "graduated_doctor", "premium_doctor"].includes(role)) return ["therapist" as PlatformRole];
        if ((PLATFORM_ROLES as readonly string[]).includes(role)) return [role as PlatformRole];
        return [];
      });

    if (allowedRoles.length === 0 || !allowedRoles.includes(userRole)) {
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
    role: normalizePlatformRole(role),
    id: authUser.id,
    email: authUser.email || null,
    firstName: null,
    lastName: null,
    profileImageUrl: null,
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
      // Write in-app notification (fire-and-forget)
      storage.createNotification(userId, data?.type ?? "general", title, body, data).catch(() => undefined);
      // FCM push notification
      const tokens = await storage.getFcmTokensByUser(userId);
      await sendPushToTokens(tokens, { title, body, data });
    } catch {
      // Ignore push notification failures to avoid blocking API requests.
    }
  };

  const listModeratorIds = async (): Promise<string[]> => {
    const { data: rows } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .in("role", ["moderator", "admin"]);
    return (rows || []).map((row) => String((row as any).id));
  };

  const normalizeRole = (value: unknown): PlatformRole => normalizePlatformRole(value);

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
    const upsertPayload: Record<string, any> = {
      id: payload.id,
      email: payload.email ?? null,
      role: normalizeRole(payload.role),
      updated_at: nowIso,
      created_at: nowIso,
    };
    if (payload.firstName !== undefined) upsertPayload.first_name = payload.firstName;
    if (payload.lastName !== undefined) upsertPayload.last_name = payload.lastName;
    if (payload.phone !== undefined) upsertPayload.phone = payload.phone;

    const { data: upsertedRow, error: upsertError } = await supabaseAdmin
      .from("profiles")
      .upsert(upsertPayload, { onConflict: "id", ignoreDuplicates: false })
      .select("*")
      .single();

    if (!upsertError && upsertedRow) {
      return upsertedRow;
    }

    // If email unique constraint fires, retry without email.
    if ((upsertError as any)?.code === "23505" && String((upsertError as any)?.message || "").includes("profiles_email_key")) {
      const { data: retryRow, error: retryError } = await supabaseAdmin
        .from("profiles")
        .upsert({ ...upsertPayload, email: null }, { onConflict: "id", ignoreDuplicates: false })
        .select("*")
        .single();
      if (!retryError && retryRow) return retryRow;
    }

    // If we still have an error but the row exists (e.g. RLS edge case), return existing row.
    if (upsertError) {
      const { data: existingRow } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("id", payload.id)
        .maybeSingle();
      if (existingRow) return existingRow;
    }

    throw upsertError || new Error("Profile upsert failed");
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

  const ensureTherapistProfile = async (userId: string): Promise<void> => {
    const user = await storage.getUser(userId);
    if (!user) return;
    if (normalizePlatformRole(user.role) !== "therapist") return;

    const existing = await storage.getTherapistProfile(userId);
    if (existing) return;

    try {
      await storage.createTherapistProfile({ userId });
    } catch (error) {
      // Handle concurrent first-login/profile-creation races.
      const recovered = await storage.getTherapistProfile(userId);
      if (recovered) return;
      throw error;
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
      const requestedRole = normalizeRole(role || "client");
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error) return res.status(400).json({ message: error.message });

      let profile: User | undefined;

      // Upsert profile so signup works even if DB auto-profile trigger is absent.
      if (data.user) {
        const row = await upsertProfileSafely({
          id: data.user.id,
          email: data.user.email || email || null,
          firstName,
          lastName,
          role: requestedRole,
          phone,
        });
        profile = mapProfile(row);
      }

      // Sign in immediately
      const { data: session, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) return res.status(400).json({ message: signInError.message });

      if (!profile && data.user) {
        profile = await ensureProfile({
          id: data.user.id,
          email: data.user.email || email,
        });
      }

      const profileWithRoles = profile
        ?? fallbackProfile({ id: data.user!.id, email: data.user?.email || email }, requestedRole);

      if (normalizePlatformRole(profileWithRoles.role) === "therapist") {
        await ensureTherapistProfile(profileWithRoles.id);
      }

      // Fire-and-forget welcome email
      sendWelcome(email, firstName || email.split("@")[0]);

      res.json({
        user: profileWithRoles,
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
      const profileWithRoles = profile ?? fallbackProfile({ id: data.user.id, email: data.user.email || email });
      if (normalizePlatformRole(profileWithRoles.role) === "therapist") {
        await ensureTherapistProfile(profileWithRoles.id);
      }
      res.json({
        user: profileWithRoles,
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
      const profileWithRoles = profile
        ?? (data.user ? fallbackProfile({ id: data.user.id, email: data.user.email || undefined }) : null);

      if (profileWithRoles && normalizePlatformRole(profileWithRoles.role) === "therapist") {
        await ensureTherapistProfile(profileWithRoles.id);
      }
      res.json({
        user: profileWithRoles,
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
      const profileOut = profile ?? fallbackProfile(authUser);
      if (normalizePlatformRole(profileOut.role) === "therapist") {
        await ensureTherapistProfile(profileOut.id);
      }
      res.json(profileOut);
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

  app.get("/api/workflow/overview", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id as string;
      const profile = await ensureProfile({ id: userId, email: req.user.email });
      const hydratedProfile = profile ?? fallbackProfile({ id: userId, email: req.user.email });
      const activeRole = normalizePlatformRole(hydratedProfile.role);

      const [appointments, peerSessions, unreadCount] = await Promise.all([
        storage.getAppointments(userId),
        storage.getPeerSessionsByUser(userId),
        storage.getUnreadCount(userId),
      ]);

      const upcomingAppointments = (appointments || []).filter((apt) => {
        const scheduled = Date.parse(apt.scheduledAt);
        return Number.isFinite(scheduled) && scheduled > Date.now() && !["cancelled", "completed"].includes(apt.status);
      }).length;

      const activePeerSessions = (peerSessions || []).filter((session) => session.status === "active").length;
      const completedPeerSessions = (peerSessions || []).filter((session) => ["completed", "ended"].includes(session.status)).length;

      let listenerApplication: any = null;
      let listenerProfile: any = null;
      let activeCooldown: any = null;
      if (activeRole === "listener") {
        [listenerApplication, listenerProfile, activeCooldown] = await Promise.all([
          storage.getListenerApplicationByUser(userId),
          storage.getListenerProfile(userId),
          storage.getActiveListenerCooldown(userId),
        ]);
      }

      let pendingListenerApplications = 0;
      let openPeerReports = 0;
      if (activeRole === "moderator" || activeRole === "admin") {
        const [applications, reports] = await Promise.all([
          storage.listListenerApplications(),
          storage.listOpenPeerReports(),
        ]);
        pendingListenerApplications = (applications || []).filter((app) => ["pending", "changes_requested"].includes(app.status)).length;
        openPeerReports = (reports || []).length;
      }

      const recommendations: Array<{ id: string; title: string; description: string; href: string }> = [];
      if (activeRole === "client") {
        if (activePeerSessions > 0) {
          recommendations.push({
            id: "continue_peer_session",
            title: "Continue active peer support",
            description: "You already have an active chat session with a listener.",
            href: "/peer-support",
          });
        } else {
          recommendations.push({
            id: "choose_support_path",
            title: "Choose support path",
            description: "Use the guided triage to pick listener, therapist, or self-care.",
            href: "/support",
          });
        }
        recommendations.push({
          id: "review_appointments",
          title: "Check upcoming appointments",
          description: "Confirm schedule and prepare notes before your next session.",
          href: "/appointments",
        });
      } else if (activeRole === "listener") {
        if (activeCooldown) {
          recommendations.push({
            id: "listener_recovery",
            title: "Complete wellbeing check-in",
            description: "Cooldown is active. Submit your check-in to resume safely.",
            href: "/peer-support",
          });
        } else if (!listenerProfile || !["trial", "live"].includes(listenerProfile.activationStatus)) {
          recommendations.push({
            id: "listener_readiness",
            title: "Complete listener readiness",
            description: "Finish your listener profile and activation workflow.",
            href: "/listener/dashboard",
          });
        } else {
          recommendations.push({
            id: "go_online_listener",
            title: "Go online for clients",
            description: "Set availability and accept sessions from clients.",
            href: "/listener/dashboard",
          });
        }
        recommendations.push({
          id: "peer_support_workspace",
          title: "Open peer support workspace",
          description: "Browse, connect, and manage active peer sessions.",
          href: "/peer-support",
        });
      } else if (activeRole === "therapist") {
        recommendations.push({
          id: "therapist_schedule",
          title: "Manage therapist schedule",
          description: "Review slots, appointments, and client messages.",
          href: "/therapist-dashboard",
        });
      } else if (activeRole === "moderator" || activeRole === "admin") {
        if (openPeerReports > 0 || pendingListenerApplications > 0) {
          recommendations.push({
            id: "moderation_queue",
            title: "Review moderation queue",
            description: "Resolve open reports and pending listener applications.",
            href: "/admin/listeners",
          });
        }
        recommendations.push({
          id: "admin_overview",
          title: "Open admin dashboard",
          description: "Track platform health, growth, and operations.",
          href: "/admin/dashboard",
        });
      }

      res.json({
        user: {
          id: hydratedProfile.id,
          role: activeRole,
        },
        counts: {
          unreadMessages: unreadCount,
          upcomingAppointments,
          activePeerSessions,
          completedPeerSessions,
        },
        listener: {
          applicationStatus: listenerApplication?.status || null,
          verificationStatus: listenerProfile?.verificationStatus || null,
          activationStatus: listenerProfile?.activationStatus || null,
          isAvailable: typeof listenerProfile?.isAvailable === "boolean" ? listenerProfile.isAvailable : null,
          cooldownEndsAt: activeCooldown?.endsAt || null,
        },
        moderation: {
          pendingListenerApplications,
          openPeerReports,
        },
        recommendations,
      });
    } catch {
      res.status(500).json({ message: "Failed to build workflow overview" });
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

      // Therapists are also listeners by default — auto-approve their listener profile
      // so they can appear in the peer support directory immediately.
      await storage.createOrUpdateListenerProfile({
        userId,
        verificationStatus: "approved",
        activationStatus: "live",
        isAvailable: true,
        approvedAt: new Date().toISOString(),
      });

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

      // Sanitize custom_css: only allow structured theme tokens (JSONB object).
      // Rejects arbitrary CSS strings to prevent XSS / style injection.
      // Allowed keys: primaryColor, accentColor, fontFamily, borderRadius.
      if (payload.customCss !== undefined && payload.customCss !== null) {
        const ALLOWED_KEYS = ["primaryColor", "accentColor", "fontFamily", "borderRadius"] as const;
        const COLOR_RE = /^#[0-9a-fA-F]{3,8}$|^(rgb|hsl)a?\([^)]{0,80}\)$/;
        const FONT_RE = /^[a-zA-Z0-9 ,'\-]{1,80}$/;
        const RADIUS_RE = /^(\d+(\.\d+)?(px|rem|em|%)?\s*){1,4}$/;

        if (typeof payload.customCss !== "object" || Array.isArray(payload.customCss)) {
          delete payload.customCss;
        } else {
          const raw = payload.customCss as Record<string, unknown>;
          const sanitized: Record<string, string> = {};
          if (typeof raw.primaryColor === "string" && COLOR_RE.test(raw.primaryColor)) {
            sanitized.primaryColor = raw.primaryColor;
          }
          if (typeof raw.accentColor === "string" && COLOR_RE.test(raw.accentColor)) {
            sanitized.accentColor = raw.accentColor;
          }
          if (typeof raw.fontFamily === "string" && FONT_RE.test(raw.fontFamily)) {
            sanitized.fontFamily = raw.fontFamily;
          }
          if (typeof raw.borderRadius === "string" && RADIUS_RE.test(raw.borderRadius)) {
            sanitized.borderRadius = raw.borderRadius;
          }
          payload.customCss = Object.keys(sanitized).length > 0 ? sanitized : null;
          void ALLOWED_KEYS; // consumed above
        }
      }

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

      // Ensure therapist also has a listener profile (idempotent upsert)
      storage.createOrUpdateListenerProfile({
        userId,
        verificationStatus: "approved",
        activationStatus: "live",
        isAvailable: true,
        approvedAt: new Date().toISOString(),
      }).catch(() => {});

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

      if (!updated) {
        console.error("[encryption-keys] setConversationEncryptionKeys returned undefined for convId:", convId);
        return res.status(500).json({ message: "Failed to store encryption keys" });
      }
      res.json(updated);
    } catch (error) {
      console.error("[encryption-keys] caught error:", error);
      res.status(500).json({ message: "Failed to store encryption keys" });
    }
  });

  app.get("/api/conversations/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const convId = parseInt(req.params.id);
      const userId = req.user.id;
      // Ownership check: user must be a participant in the conversation
      const conv = await storage.getConversation(convId);
      if (!conv) return res.status(404).json({ message: "Conversation not found" });
      if (conv.clientId !== userId && conv.therapistId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
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

      // Ownership check: user must be a participant
      const conv = await storage.getConversation(convId);
      if (!conv) return res.status(404).json({ message: "Conversation not found" });
      if (conv.clientId !== userId && conv.therapistId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

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
      console.error("[send message] error:", error);
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
      const aptId = parseInt(req.params.id);

      // Ownership check: only participants can change status
      const existing = await storage.getAppointment(aptId);
      if (!existing) return res.status(404).json({ message: "Appointment not found" });
      if (existing.clientId !== userId && existing.therapistId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const apt = await storage.updateAppointmentStatus(aptId, req.body.status);
      if (apt) {
        // Ensure the appointment has a meet link — generate one if missing
        if (!apt.meetLink) {
          const link = generateJitsiLink();
          await storage.updateAppointment(aptId, { meetLink: link });
          apt.meetLink = link;
        }

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

  // Cancel appointment with 24h policy check
  app.post("/api/appointments/:id/cancel", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const aptId = parseInt(req.params.id);
      if (!Number.isInteger(aptId)) return res.status(400).json({ message: "Invalid appointment id" });

      const existing = await storage.getAppointment(aptId);
      if (!existing) return res.status(404).json({ message: "Appointment not found" });
      if (existing.clientId !== userId && existing.therapistId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      if (existing.status === "cancelled" || existing.status === "completed") {
        return res.status(400).json({ message: "Appointment cannot be cancelled in its current state" });
      }

      // 24h policy: clients cannot cancel within 24h of session
      if (existing.clientId === userId) {
        const hoursUntil = (new Date(existing.scheduledAt).getTime() - Date.now()) / 3_600_000;
        if (hoursUntil < 24) {
          return res.status(400).json({ message: "Cancellations must be made at least 24 hours before the session" });
        }
      }

      const reason = typeof req.body.reason === "string" ? req.body.reason.trim() : undefined;
      const apt = await storage.cancelAppointment(aptId, userId, reason);
      if (!apt) return res.status(500).json({ message: "Failed to cancel appointment" });

      // Notify the other party
      const recipientId = apt.clientId === userId ? apt.therapistId : apt.clientId;
      await notifyUser(
        recipientId,
        "Appointment cancelled",
        `Your appointment has been cancelled${reason ? `: ${reason}` : "."}`,
        { type: "appointment_cancelled", appointmentId: String(apt.id) },
      );

      res.json(apt);
    } catch (error) {
      res.status(500).json({ message: "Failed to cancel appointment" });
    }
  });

  // Reschedule appointment — cancels old, books a new slot
  app.post("/api/appointments/:id/reschedule", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const aptId = parseInt(req.params.id);
      const newSlotId = Number(req.body.slotId);
      if (!Number.isInteger(aptId) || !Number.isInteger(newSlotId)) {
        return res.status(400).json({ message: "Invalid appointment or slot id" });
      }

      const existing = await storage.getAppointment(aptId);
      if (!existing) return res.status(404).json({ message: "Appointment not found" });
      if (existing.clientId !== userId) return res.status(403).json({ message: "Only the client can reschedule" });
      if (existing.status === "cancelled" || existing.status === "completed") {
        return res.status(400).json({ message: "Appointment cannot be rescheduled" });
      }

      const result = await storage.rescheduleAppointment(aptId, newSlotId, userId);
      if (!result) return res.status(409).json({ message: "The selected slot is no longer available" });

      // Notify therapist
      await notifyUser(
        existing.therapistId,
        "Appointment rescheduled",
        `A client has rescheduled their appointment.`,
        { type: "appointment_rescheduled", appointmentId: String(result.appointment.id) },
      );

      res.json(result.appointment);
    } catch (error) {
      res.status(500).json({ message: "Failed to reschedule appointment" });
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

      await ensureTherapistProfile(therapistId);
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

      // Overlap guard: reject if therapist already has an open/booked slot in this time range
      const slotStart = new Date(startsAt);
      const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60_000);
      const overlaps = await storage.hasOverlappingSlot(therapistId, slotStart, slotEnd);
      if (overlaps) {
        return res.status(409).json({ message: "This time slot overlaps with an existing slot" });
      }

      const slot = await storage.createTherapistSlot({
        therapistId,
        startsAt,
        durationMinutes,
        priceDinar,
        status: "open",
        meetLink: generateJitsiLink(),
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

  app.post("/api/appointments/from-slot/:slotId", isAuthenticated, bookingLimiter, async (req: any, res) => {
    try {
      const slotId = Number(req.params.slotId);
      if (!Number.isInteger(slotId)) return res.status(400).json({ message: "Invalid slot id" });

      const clientId = req.user.id;
      const paymentMethod: string = req.body.paymentMethod || "flouci";
      const useSubscription = paymentMethod === "subscription";
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

      // Use the Jitsi link already on the slot (auto-generated at slot creation)
      const meetLink: string | null = result.slot.meetLink ?? generateJitsiLink();
      if (meetLink) {
        await storage.updateAppointment(result.appointment.id, { meetLink });
        result.appointment.meetLink = meetLink;
      }

      // Send booking notification emails to both client and therapist (fire-and-forget)
      (async () => {
        try {
          const [clientUser, therapistUser] = await Promise.all([
            storage.getUser(clientId),
            storage.getUser(result.appointment.therapistId),
          ]);
          const emailDetails = {
            clientName: [clientUser?.firstName, clientUser?.lastName].filter(Boolean).join(" ") || clientUser?.email || "Client",
            therapistName: [therapistUser?.firstName, therapistUser?.lastName].filter(Boolean).join(" ") || therapistUser?.email || "Therapist",
            scheduledAt: result.appointment.scheduledAt,
            durationMinutes: result.appointment.durationMinutes ?? 50,
            sessionType: result.appointment.sessionType,
            priceDinar: result.slot.priceDinar,
            meetLink,
          };
          if (clientUser?.email) {
            sendAppointmentBooked(clientUser.email, { ...emailDetails, recipientRole: "client" });
          }
          if (therapistUser?.email) {
            sendAppointmentBooked(therapistUser.email, { ...emailDetails, recipientRole: "therapist" });
          }
        } catch {}
      })();

      // Auto-initiate payment if price > 0
      let paymentUrl: string | null = null;
      if (result.slot.priceDinar > 0) {
        if (useSubscription) {
          // Deduct one session credit from an active subscription
          const activeSub = await storage.getActiveSubscription(clientId, result.appointment.therapistId);
          if (!activeSub) {
            return res.status(400).json({ message: "No active subscription with sessions remaining" });
          }
          await storage.deductSubscriptionSession(activeSub.id);
          // No payment URL needed — credit already applied
        } else {
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
      }

      res.status(201).json({ ...result, paymentUrl });
    } catch (error) {
      res.status(500).json({ message: "Failed to create appointment from slot" });
    }
  });

  // ── Subscription plans ──────────────────────────────────────────────────

  app.get("/api/subscription-plans", async (_req, res) => {
    try {
      const plans = await storage.getSubscriptionPlans(true);
      res.json(plans);
    } catch {
      res.status(500).json({ message: "Failed to fetch subscription plans" });
    }
  });

  // ── User subscriptions ───────────────────────────────────────────────────

  app.get("/api/subscriptions/mine", isAuthenticated, async (req: any, res) => {
    try {
      const subs = await storage.getUserSubscriptions(req.user.id);
      res.json(subs);
    } catch {
      res.status(500).json({ message: "Failed to fetch subscriptions" });
    }
  });

  app.post(
    "/api/subscriptions",
    isAuthenticated,
    paymentLimiter,
    validateBody(purchaseSubscriptionSchema),
    async (req: any, res) => {
      try {
        const { planId, therapistId, paymentMethod } = req.body as {
          planId: number;
          therapistId?: string;
          paymentMethod: "flouci" | "konnect";
        };
        const plan = await storage.getSubscriptionPlan(planId);
        if (!plan || !plan.isActive) {
          return res.status(404).json({ message: "Subscription plan not found or inactive" });
        }

        // Create pending payment transaction for the plan price
        const txn = await storage.createPaymentTransaction({
          clientId: req.user.id,
          therapistId: therapistId ?? req.user.id, // use self as placeholder if platform-wide
          amountDinar: plan.priceDinar,
          paymentMethod,
          status: "pending",
        });

        // Initiate payment with provider
        let paymentUrl: string | null = null;
        try {
          const origin = req.headers.origin || `${req.protocol}://${req.headers.host}`;
          const successUrl = `${origin}/dashboard?sub=success&txn=${txn.id}&plan=${planId}`;
          const failUrl = `${origin}/dashboard?sub=failed&txn=${txn.id}`;
          const amountMillimes = Math.round(plan.priceDinar * 1000);
          if (paymentMethod === "konnect") {
            const r = await createKonnectPayment(amountMillimes, txn.id, successUrl, failUrl);
            paymentUrl = r.redirectUrl;
          } else {
            const r = await createFlouciPayment(amountMillimes, txn.id, successUrl, failUrl);
            paymentUrl = r.redirectUrl;
          }
        } catch (err) {
          console.error("[subscription] Payment init failed:", err);
        }

        res.status(201).json({ transactionId: txn.id, paymentUrl, plan });
      } catch {
        res.status(500).json({ message: "Failed to initiate subscription purchase" });
      }
    },
  );

  // Called by webhook handlers after payment confirmed — activates subscription
  app.post("/api/subscriptions/activate", isAuthenticated, async (req: any, res) => {
    try {
      const { planId, paymentTransactionId, therapistId } = req.body as {
        planId: number;
        paymentTransactionId?: number;
        therapistId?: string;
      };
      const plan = await storage.getSubscriptionPlan(planId);
      if (!plan) return res.status(404).json({ message: "Plan not found" });
      const sub = await storage.createUserSubscription({
        userId: req.user.id,
        planId,
        sessionsIncluded: plan.sessionsIncluded,
        durationDays: plan.durationDays,
        therapistId,
        paymentTransactionId,
      });
      res.status(201).json(sub);
    } catch {
      res.status(500).json({ message: "Failed to activate subscription" });
    }
  });

  app.post("/api/subscriptions/:id/cancel", isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid id" });
      const updated = await storage.cancelUserSubscription(id, req.user.id);
      if (!updated) return res.status(404).json({ message: "Subscription not found" });
      res.json(updated);
    } catch {
      res.status(500).json({ message: "Failed to cancel subscription" });
    }
  });

  // ── Matching preferences ─────────────────────────────────────────────────

  app.get("/api/matching/preferences", isAuthenticated, async (req: any, res) => {
    try {
      const prefs = await storage.getMatchingPreferences(req.user.id);
      res.json(prefs ?? null);
    } catch {
      res.status(500).json({ message: "Failed to fetch matching preferences" });
    }
  });

  app.put(
    "/api/matching/preferences",
    isAuthenticated,
    validateBody(matchingPreferencesSchema),
    async (req: any, res) => {
      try {
        const prefs = await storage.upsertMatchingPreferences(req.user.id, {
          preferredSpecializations: req.body.preferredSpecializations,
          preferredLanguages: req.body.preferredLanguages,
          preferredGender: req.body.preferredGender,
          maxBudgetDinar: req.body.maxBudgetDinar,
          sessionTypePreference: req.body.sessionTypePreference,
        });
        res.json(prefs);
      } catch {
        res.status(500).json({ message: "Failed to update matching preferences" });
      }
    },
  );

  // AI-powered therapist recommendations using saved preferences + onboarding
  app.post("/api/matching/recommend", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;

      // Fetch saved matching preferences and onboarding data in parallel
      const [prefs, onboarding] = await Promise.all([
        storage.getMatchingPreferences(userId),
        storage.getOnboardingResponse(userId),
      ]);

      // Build match request from saved prefs + onboarding + optional body overrides
      const concerns =
        req.body.concerns ||
        (prefs?.preferredSpecializations?.join(", ")) ||
        (onboarding?.primaryConcerns?.join(", ")) ||
        "general wellness";

      const matchReq = {
        concerns,
        language: req.body.language || prefs?.preferredLanguages?.[0] || onboarding?.preferredLanguage || undefined,
        gender: req.body.gender || prefs?.preferredGender || onboarding?.genderPreference || undefined,
        budgetDinar: req.body.budgetDinar || prefs?.maxBudgetDinar || undefined,
      };

      // Fetch all active therapists and convert to candidates
      const therapists = await storage.getTherapistProfiles({});

      // Check if user has an active subscription (to apply tier bonus)
      const activeSub = await storage.getActiveSubscription(userId);
      const subTierRestriction = activeSub?.plan?.tierRestriction ?? null;

      const now = new Date();
      const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

      // Check which therapists have upcoming slots and which have had prior sessions
      const priorAppointments = await storage.getAppointments(userId);
      const priorTherapistIds = new Set(
        (priorAppointments || []).map((a: any) => a.therapistId as string)
      );

      const candidates: TherapistCandidate[] = therapists.map((tp: any) => {
        const user = tp.user as any;
        const name = user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Therapist" : "Therapist";
        return {
          id: tp.userId,
          name,
          specializations: tp.specializations || [],
          languages: tp.languages || [],
          rateDinar: tp.rateDinar ?? null,
          rating: tp.rating ?? null,
          gender: user?.gender ?? null,
          yearsExperience: tp.yearsExperience ?? null,
          verified: tp.verified ?? false,
          hasAvailabilityIn48h: false, // simplified — would require slot query per therapist
          hadPriorSession: priorTherapistIds.has(tp.userId),
          // Subscription tier bonus: +10 when the user's plan targets this therapist's tier
          subscriptionTierBonus: subTierRestriction && tp.tier === subTierRestriction ? 10 : 0,
        };
      });

      const topK = Number(req.body.topK) || 3;
      const results = await matchTherapists(candidates, matchReq, topK);
      res.json(results);
    } catch (err) {
      console.error("[matching/recommend]", err);
      res.status(500).json({ message: "Failed to generate recommendations" });
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
      const userId = req.user.id;
      const entryId = parseInt(req.params.id);
      const existing = await storage.getJournalEntry(entryId);
      if (!existing) return res.status(404).json({ message: "Journal entry not found" });
      if (existing.userId !== userId) return res.status(403).json({ message: "Access denied" });
      const entry = await storage.updateJournalEntry(entryId, req.body);
      res.json(entry);
    } catch (error) {
      res.status(500).json({ message: "Failed to update journal entry" });
    }
  });

  app.delete("/api/journal/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const entryId = parseInt(req.params.id);
      const existing = await storage.getJournalEntry(entryId);
      if (!existing) return res.status(404).json({ message: "Journal entry not found" });
      if (existing.userId !== userId) return res.status(403).json({ message: "Access denied" });
      await storage.deleteJournalEntry(entryId);
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

  app.get("/api/user/display-name/check/:name", isAuthenticated, displayNameLimiter, async (req: any, res) => {
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

  // GDPR-style data export — returns all user data as JSON
  app.get("/api/user/data-export", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const [user, appointments, moods, journalEntries, onboarding, matchPrefs, subscriptions] = await Promise.all([
        storage.getUser(userId),
        storage.getAppointments(userId),
        storage.getMoodEntries(userId, 365),
        storage.getJournalEntries(userId),
        storage.getOnboardingResponse(userId),
        storage.getMatchingPreferences(userId),
        storage.getUserSubscriptions(userId),
      ]);

      const exportData = {
        exportedAt: new Date().toISOString(),
        profile: user,
        onboarding,
        appointments: appointments.map((a) => ({
          id: a.id,
          scheduledAt: a.scheduledAt,
          status: a.status,
          sessionType: a.sessionType,
          durationMinutes: a.durationMinutes,
          therapistId: a.therapistId,
        })),
        moods,
        journalEntries,
        matchingPreferences: matchPrefs,
        subscriptions,
      };

      res.setHeader("Content-Disposition", `attachment; filename="shifa-data-export-${userId.slice(0, 8)}.json"`);
      res.setHeader("Content-Type", "application/json");
      res.json(exportData);
    } catch (err) {
      res.status(500).json({ message: "Failed to export data" });
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

  app.post("/api/reviews/:id/respond", isAuthenticated, requireRoles(["therapist", "doctor", "graduated_doctor", "premium_doctor"]), async (req: any, res) => {
    try {
      const reviewId = parseInt(req.params.id);
      const { response } = req.body;
      if (!response) return res.status(400).json({ message: "Response text required" });

      // Ownership: only the therapist the review is about can respond
      const review = await storage.getReviewById(reviewId);
      if (!review) return res.status(404).json({ message: "Review not found" });
      if (review.therapistId !== req.user.id) return res.status(403).json({ message: "Access denied" });

      const updated = await storage.addTherapistResponse(reviewId, response);
      res.json(updated);
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
      await ensureTherapistProfile(userId);
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

  app.post("/api/payments/flouci/initiate", isAuthenticated, paymentLimiter, validateBody(paymentInitiateRequestSchema), async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { appointmentId, therapistId, amount } = req.body;

      // Verify the appointment belongs to this client
      const apt = await storage.getAppointment(appointmentId);
      if (!apt || apt.clientId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Double-charge prevention: block if a pending or completed transaction exists
      const existingPayments = await storage.getPaymentsByUser(userId);
      const duplicate = existingPayments.find(
        (p) => p.appointmentId === appointmentId && (p.status === "pending" || p.status === "completed" || p.status === "paid"),
      );
      if (duplicate) {
        return res.status(409).json({ message: "Payment already initiated or completed for this appointment" });
      }

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

      // Idempotency: skip if we've already processed this event
      if (providerEventId) {
        const isNew = await storage.recordWebhookEvent(String(providerEventId), "flouci", req.body);
        if (!isNew) return res.json({ received: true, duplicate: true });
      }

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

  app.post("/api/payments/konnect/initiate", isAuthenticated, paymentLimiter, validateBody(paymentInitiateRequestSchema), async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { appointmentId, therapistId, amount } = req.body;

      // Verify the appointment belongs to this client
      const apt = await storage.getAppointment(appointmentId);
      if (!apt || apt.clientId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Double-charge prevention: block if a pending or completed transaction exists
      const existingPayments = await storage.getPaymentsByUser(userId);
      const duplicate = existingPayments.find(
        (p) => p.appointmentId === appointmentId && (p.status === "pending" || p.status === "completed" || p.status === "paid"),
      );
      if (duplicate) {
        return res.status(409).json({ message: "Payment already initiated or completed for this appointment" });
      }

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

      // Idempotency: skip if we've already processed this event
      if (providerEventId) {
        const isNew = await storage.recordWebhookEvent(String(providerEventId), "konnect", req.body);
        if (!isNew) return res.json({ received: true, duplicate: true });
      }

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

  // ---- In-app Notifications ----

  app.get("/api/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const limit = Math.min(Number(req.query.limit) || 20, 50);
      const offset = Number(req.query.offset) || 0;
      const notifications = await storage.getNotifications(userId, limit, offset);
      res.json(notifications);
    } catch {
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.patch("/api/notifications/:id/read", isAuthenticated, async (req: any, res) => {
    try {
      await storage.markNotificationRead(req.params.id);
      res.json({ ok: true });
    } catch {
      res.status(500).json({ message: "Failed to mark notification read" });
    }
  });

  app.get("/api/notifications/unread-count", isAuthenticated, async (req: any, res) => {
    try {
      const count = await storage.getUnreadNotificationCount(req.user.id);
      res.json({ count });
    } catch {
      res.status(500).json({ message: "Failed to fetch unread count" });
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
      const preferredLanguage = typeof req.body.preferredLanguage === "string" ? req.body.preferredLanguage : null;
      const genderPreference = typeof req.body.genderPreference === "string" ? req.body.genderPreference : null;
      const response = await storage.saveOnboardingResponse({
        userId,
        primaryConcerns: normalizeStringArray(req.body.primaryConcerns),
        preferredLanguage,
        genderPreference,
        budgetRange: null,
        howDidYouHear: "quick_start",
      });
      await markOnboardingCompleted(userId, preferredLanguage);
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

      // 24h cooldown: reject if the last (failed) attempt was less than 24h ago
      const existingTest = await storage.getListenerQualificationTest(req.user.id);
      if (existingTest && !existingTest.passed && existingTest.attemptedAt) {
        const hoursSince = (Date.now() - new Date(existingTest.attemptedAt).getTime()) / 3_600_000;
        if (hoursSince < 24) {
          const hoursRemaining = Math.ceil(24 - hoursSince);
          return res.status(429).json({
            message: `You must wait ${hoursRemaining} more hour${hoursRemaining !== 1 ? "s" : ""} before retaking the test.`,
          });
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
          currentStreak: 0,
          longestStreak: 0,
          endorsementsCount: 0,
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

  app.post("/api/listener/wellbeing/checkin", isAuthenticated, async (req: any, res) => {
    try {
      const listenerId = req.user.id;
      const profile = await storage.getListenerProfile(listenerId);
      if (!profile) return res.status(403).json({ message: "Not a listener" });

      const stressLevel = Number(req.body.stressLevel);
      const emotionalLoad = Number(req.body.emotionalLoad);
      if (!Number.isInteger(stressLevel) || stressLevel < 1 || stressLevel > 5) {
        return res.status(400).json({ message: "stressLevel must be an integer between 1 and 5" });
      }
      if (!Number.isInteger(emotionalLoad) || emotionalLoad < 1 || emotionalLoad > 5) {
        return res.status(400).json({ message: "emotionalLoad must be an integer between 1 and 5" });
      }

      const needsBreak = req.body.needsBreak === true;
      const sessionId = Number.isInteger(Number(req.body.sessionId)) ? Number(req.body.sessionId) : null;
      const notes = typeof req.body.notes === "string" ? req.body.notes.trim().slice(0, 1200) : null;

      const checkIn = await storage.createListenerWellbeingCheckIn({
        listenerId,
        sessionId,
        stressLevel,
        emotionalLoad,
        needsBreak,
        notes: notes || null,
      });

      let cooldown = await storage.getActiveListenerCooldown(listenerId);
      if (needsBreak || stressLevel >= 5 || emotionalLoad >= 5) {
        const duration = needsBreak
          ? LISTENER_HIGH_LOAD_COOLDOWN_MINUTES
          : LISTENER_DIFFICULT_SESSION_COOLDOWN_MINUTES;
        cooldown = await storage.upsertListenerCooldown(
          listenerId,
          sessionId,
          needsBreak ? "self_requested_break" : "high_load_checkin",
          duration,
        );
      }

      res.status(201).json({ checkIn, cooldown: cooldown || null });
    } catch (error) {
      res.status(500).json({ message: "Failed to save wellbeing check-in" });
    }
  });

  app.get("/api/listener/leaderboard", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const limitRaw = Number(req.query.limit);
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, Math.floor(limitRaw))) : 20;
      const requestedSeasonKey = typeof req.query.season === "string" ? req.query.season : "";
      const seasonKey = isValidListenerSeasonKey(requestedSeasonKey)
        ? requestedSeasonKey
        : listenerSeasonKeyForDate(new Date());

      // Lazy monthly archive finalization for previous season.
      storage.finalizeListenerSeason(previousListenerSeasonKey(), 3).catch(() => undefined);

      const [leaderboard, allSeasonRows, hallOfFame] = await Promise.all([
        storage.getListenerLeaderboard(limit, seasonKey),
        storage.getListenerLeaderboard(5000, seasonKey),
        storage.getListenerHallOfFame(6, 3),
      ]);
      const myEntry = allSeasonRows.find((entry) => entry.listenerId === userId) || null;
      const myRank = myEntry?.rank ?? null;

      res.json({
        seasonKey,
        leaderboard,
        myRank,
        myCertificationTitle: myEntry?.certificationTitle ?? null,
        hallOfFame,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch listener leaderboard" });
    }
  });

  app.get("/api/listener/hall-of-fame", isAuthenticated, async (_req: any, res) => {
    try {
      const hallOfFame = await storage.getListenerHallOfFame(12, 3);
      res.json(hallOfFame);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch Hall of Fame" });
    }
  });

  app.post("/api/admin/listener/season/finalize", isAuthenticated, requireRoles(["admin", "moderator"]), async (req: any, res) => {
    try {
      const rawSeasonKey = typeof req.body?.seasonKey === "string" ? req.body.seasonKey : "";
      const seasonKey = isValidListenerSeasonKey(rawSeasonKey)
        ? rawSeasonKey
        : previousListenerSeasonKey();
      const archived = await storage.finalizeListenerSeason(seasonKey, 3);
      res.json({ seasonKey, archivedCount: archived.length, archived });
    } catch (error) {
      res.status(500).json({ message: "Failed to finalize listener season" });
    }
  });

  app.get("/api/listener/leaderboard/certificate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id as string;
      const now = new Date();
      const currentSeasonKey = listenerSeasonKeyForDate(now);
      const requestedSeasonKey = typeof req.query.season === "string" ? req.query.season : "";
      const seasonKey = isValidListenerSeasonKey(requestedSeasonKey) ? requestedSeasonKey : currentSeasonKey;

      let certificationTitle: string | null = null;
      let certificateCode: string | null = null;
      let issueDate = now.toISOString();

      if (seasonKey === currentSeasonKey) {
        const currentSeasonRows = await storage.getListenerLeaderboard(5000, seasonKey);
        const mine = currentSeasonRows.find((entry) => entry.listenerId === userId) || null;
        certificationTitle = mine?.certificationTitle ?? null;
      }

      const { data: hallRows } = await supabaseAdmin
        .from("listener_hall_of_fame")
        .select("id, certification_title, certificate_code, certificate_issued_at")
        .eq("listener_id", userId)
        .eq("season_key", seasonKey)
        .not("certification_title", "is", null)
        .order("rank", { ascending: true })
        .limit(1);
      const hallRow = (hallRows || [])[0];
      if (!certificationTitle && hallRow?.certification_title) {
        certificationTitle = String(hallRow.certification_title);
      }
      if (!certificationTitle) {
        return res.status(403).json({ message: "Certificate is available only for certified top listeners." });
      }

      if (hallRow) {
        certificateCode = hallRow.certificate_code || null;
        issueDate = hallRow.certificate_issued_at || issueDate;
        if (!certificateCode) {
          certificateCode = `SHIFA-${seasonKey}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
          issueDate = new Date().toISOString();
          await supabaseAdmin
            .from("listener_hall_of_fame")
            .update({
              certificate_code: certificateCode,
              certificate_issued_at: issueDate,
            })
            .eq("id", hallRow.id);
        }
      } else {
        certificateCode = `SHIFA-${seasonKey}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
      }

      const profile = await storage.getUser(userId);
      const listenerName = [
        profile?.firstName || "",
        profile?.lastName || "",
      ].join(" ").trim() || profile?.displayName || "Listener";
      const issueDateText = new Date(issueDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const pdf = buildListenerCertificatePdf({
        seasonKey,
        listenerName,
        certificationTitle,
        issueDate: issueDateText,
        certificateCode,
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=\"shifa-listener-certificate-${seasonKey}.pdf\"`);
      res.send(pdf);
    } catch (error) {
      res.status(500).json({ message: "Failed to generate listener certificate" });
    }
  });

  app.get("/api/public/listener/leaderboard", async (req, res) => {
    try {
      const limitRaw = Number(req.query.limit);
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, Math.floor(limitRaw))) : 20;
      const requestedSeasonKey = typeof req.query.season === "string" ? req.query.season : "";
      const seasonKey = isValidListenerSeasonKey(requestedSeasonKey)
        ? requestedSeasonKey
        : listenerSeasonKeyForDate(new Date());

      // Keep archive updated passively.
      storage.finalizeListenerSeason(previousListenerSeasonKey(), 3).catch(() => undefined);

      const [leaderboard, hallOfFame] = await Promise.all([
        storage.getListenerLeaderboard(limit, seasonKey),
        storage.getListenerHallOfFame(12, 3),
      ]);

      res.json({
        seasonKey,
        leaderboard,
        hallOfFame,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch public listener leaderboard" });
    }
  });

  app.get("/api/public/listener/hall-of-fame", async (_req, res) => {
    try {
      const hallOfFame = await storage.getListenerHallOfFame(12, 3);
      res.json(hallOfFame);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch public Hall of Fame" });
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

      if (desiredAvailability) {
        const activeCooldown = await storage.getActiveListenerCooldown(userId);
        if (activeCooldown) {
          return res.status(423).json({
            message: "Cooldown active. Complete your recovery window before going online.",
            cooldown: activeCooldown,
          });
        }
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

      const activeCooldown = await storage.getActiveListenerCooldown(listenerId);
      if (activeCooldown) {
        return res.status(423).json({
          message: "Listener cooldown active",
          cooldown: activeCooldown,
        });
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

      const { data: reportSignals } = await supabaseAdmin
        .from("peer_reports")
        .select("severity")
        .eq("session_id", ended.id);
      const hasAnyReport = (reportSignals || []).length > 0;
      const hasSevereReport = (reportSignals || []).some((row: any) =>
        ["high", "critical"].includes(String(row.severity || "").toLowerCase()),
      );
      const difficultSession = Boolean(ended.escalatedToCrisis || hasAnyReport);
      const cooldownMinutes = ended.escalatedToCrisis || hasSevereReport
        ? LISTENER_HIGH_LOAD_COOLDOWN_MINUTES
        : LISTENER_DIFFICULT_SESSION_COOLDOWN_MINUTES;
      const cooldownReason = ended.escalatedToCrisis
        ? "crisis_session"
        : hasSevereReport
          ? "severe_reported_session"
          : hasAnyReport
            ? "reported_session"
            : "difficult_session";

      let cooldown = null;
      if (difficultSession) {
        cooldown = await storage.upsertListenerCooldown(
          ended.listenerId,
          ended.id,
          cooldownReason,
          cooldownMinutes,
        );
      } else {
        await storage.setListenerAvailability(ended.listenerId, true).catch(() => undefined);
      }

      const otherUserId = userId === ended.clientId ? ended.listenerId : ended.clientId;
      await notifyUser(
        otherUserId,
        "Peer session ended",
        "Your peer support session has ended.",
        { type: "peer_session", sessionId: String(ended.id) },
      );
      if (cooldown) {
        await notifyUser(
          ended.listenerId,
          "Cooldown started",
          "Take a short recovery pause and complete your listener wellbeing check-in.",
          { type: "listener_cooldown", sessionId: String(ended.id) },
        );
      }

      res.json({ session: ended, durationMinutes, difficultSession, cooldown });
      // Fire-and-forget stat sync
      storage.syncListenerBrowseStats(ended.listenerId).catch(() => {});
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

      let endorsement = null;
      if (rating >= 4 && comment.length >= 24) {
        endorsement = await storage.createListenerEndorsement({
          listenerId: session.listenerId,
          sessionId,
          quote: comment,
          warmthScore: Math.max(1, Math.min(5, Math.round(rating))),
        });
      }

      res.status(201).json({ feedback, listenerProgress: progress, endorsement });
      // Fire-and-forget stat sync
      storage.syncListenerBrowseStats(session.listenerId).catch(() => {});
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

  // One-shot: provision listener profiles for all existing therapists
  app.post("/api/admin/sync-therapist-listeners", isAuthenticated, requireRoles(["admin"]), async (req: any, res) => {
    try {
      const { data: therapists } = await supabaseAdmin
        .from("therapist_profiles")
        .select("user_id");
      const results = { synced: 0, errors: 0 };
      for (const t of (therapists || [])) {
        try {
          await storage.createOrUpdateListenerProfile({
            userId: t.user_id,
            verificationStatus: "approved",
            activationStatus: "live",
            isAvailable: true,
            approvedAt: new Date().toISOString(),
          });
          results.synced++;
        } catch {
          results.errors++;
        }
      }
      res.json(results);
    } catch {
      res.status(500).json({ message: "Sync failed" });
    }
  });

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
      if (status === "approved") {
        await storage.updateUser(application.userId, { role: "listener" });
      } else if (status === "rejected") {
        await storage.updateUser(application.userId, { role: "client" });
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
      await storage.updateUser(listenerUserId, { role: "listener" });

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
      await storage.updateUser(listenerUserId, { role: "listener" });

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
      const roleInput = String(role).trim();
      const allowed = ["user", "client", "listener", "therapist", "moderator", "admin"];
      if (!allowed.includes(roleInput)) return res.status(400).json({ message: "Invalid role" });
      const normalizedRole = roleInput === "user" ? "client" : normalizeRole(roleInput);
      const updated = await storage.updateUser(id, { role: normalizedRole });
      if (!updated) return res.status(404).json({ message: "User not found" });

      logAudit(req.user.id, "admin.user_role_change", "user", id, { newRole: normalizedRole }, req);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.post("/api/admin/roles/grant", isAuthenticated, requireRoles(["admin", "moderator"]), async (req: any, res) => {
    try {
      const actorId = req.user.id as string;
      const userId = String(req.body?.userId || "");
      const rawRole = String(req.body?.role || "").trim();

      if (!userId) return res.status(400).json({ message: "userId is required" });
      if (!(PLATFORM_ROLES as readonly string[]).includes(rawRole)) {
        return res.status(400).json({ message: "Invalid role" });
      }
      const role = normalizeRole(rawRole);

      const target = await storage.getUser(userId);
      if (!target) return res.status(404).json({ message: "User not found" });

      const updated = await storage.updateUser(userId, { role });
      if (role === "therapist") {
        await ensureTherapistProfile(userId);
      }

      logAudit(actorId, "admin.role_grant", "user", userId, { role }, req);
      res.status(201).json({ user: updated, role, status: "active" });
    } catch {
      res.status(500).json({ message: "Failed to grant role" });
    }
  });

  app.post("/api/admin/roles/revoke", isAuthenticated, requireRoles(["admin", "moderator"]), async (req: any, res) => {
    try {
      const actorId = req.user.id as string;
      const userId = String(req.body?.userId || "");
      if (!userId) return res.status(400).json({ message: "userId is required" });

      const updated = await storage.updateUser(userId, { role: "client" });

      logAudit(actorId, "admin.role_revoke", "user", userId, { newRole: "client" }, req);
      res.json({ user: updated, revokedRole: req.body?.role, role: "client" });
    } catch {
      res.status(500).json({ message: "Failed to revoke role" });
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

  // Admin: all subscriptions
  app.get("/api/admin/subscriptions", isAuthenticated, requireRoles(["admin"]), async (_req: any, res) => {
    try {
      const subs = await storage.getAllSubscriptions(200);
      res.json(subs);
    } catch {
      res.status(500).json({ message: "Failed to fetch subscriptions" });
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
      await ensureTherapistProfile(req.user.id);
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
          meetLink: generateJitsiLink(),
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

      // Enforce valid state transitions
      const allPayouts = await storage.getAllDoctorPayouts();
      const current = allPayouts.find((p) => p.id === id);
      if (!current) return res.status(404).json({ message: "Payout not found" });

      const validTransitions: Record<string, string[]> = {
        pending: ["processing", "failed"],
        processing: ["paid", "failed"],
        paid: [],
        failed: ["pending"],
      };
      const allowed = validTransitions[current.status] ?? [];
      if (!allowed.includes(status)) {
        return res.status(400).json({
          message: `Cannot transition payout from '${current.status}' to '${status}'`,
        });
      }

      const payout = await storage.updateDoctorPayoutStatus(id, status);
      if (!payout) return res.status(404).json({ message: "Payout not found" });
      res.json(payout);
    } catch {
      res.status(500).json({ message: "Failed to update payout" });
    }
  });

  // ---- Phase 6: Post-session features ----

  // --- Homework ---

  // GET /api/session-summaries/:summaryId/homework — doctor or client reads homework for a summary
  app.get("/api/session-summaries/:summaryId/homework", isAuthenticated, async (req: any, res) => {
    try {
      const summaryId = Number(req.params.summaryId);
      if (!Number.isFinite(summaryId)) return res.status(400).json({ message: "Invalid summaryId" });
      const homework = await storage.getHomeworkBySummary(summaryId);
      res.json(homework);
    } catch {
      res.status(500).json({ message: "Failed to fetch homework" });
    }
  });

  // GET /api/homework — client fetches all their homework items
  app.get("/api/homework", isAuthenticated, async (req: any, res) => {
    try {
      const homework = await storage.getHomeworkByClient(req.user.id);
      res.json(homework);
    } catch {
      res.status(500).json({ message: "Failed to fetch homework" });
    }
  });

  // POST /api/session-summaries/:summaryId/homework — therapist creates a homework item
  app.post("/api/session-summaries/:summaryId/homework", isAuthenticated, requireRoles(["therapist"]), async (req: any, res) => {
    try {
      const summaryId = Number(req.params.summaryId);
      if (!Number.isFinite(summaryId)) return res.status(400).json({ message: "Invalid summaryId" });
      const { insertHomeworkSchema } = await import("@shared/schema");
      const parsed = insertHomeworkSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
      const item = await storage.createHomework(summaryId, parsed.data);
      res.status(201).json(item);
    } catch {
      res.status(500).json({ message: "Failed to create homework" });
    }
  });

  // PATCH /api/homework/:id — client marks homework complete / adds notes; therapist can also update
  app.patch("/api/homework/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
      const { updateHomeworkSchema } = await import("@shared/schema");
      const parsed = updateHomeworkSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
      const item = await storage.updateHomework(id, parsed.data);
      if (!item) return res.status(404).json({ message: "Homework not found" });
      res.json(item);
    } catch {
      res.status(500).json({ message: "Failed to update homework" });
    }
  });

  // DELETE /api/homework/:id — therapist deletes a homework item
  app.delete("/api/homework/:id", isAuthenticated, requireRoles(["therapist"]), async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
      await storage.deleteHomework(id);
      res.json({ ok: true });
    } catch {
      res.status(500).json({ message: "Failed to delete homework" });
    }
  });

  // --- Session Mood Ratings ---

  // GET /api/appointments/:id/mood-rating — client or therapist reads mood rating
  app.get("/api/appointments/:id/mood-rating", isAuthenticated, async (req: any, res) => {
    try {
      const appointmentId = Number(req.params.id);
      if (!Number.isFinite(appointmentId)) return res.status(400).json({ message: "Invalid id" });
      const apt = await storage.getAppointment(appointmentId);
      if (!apt) return res.status(404).json({ message: "Appointment not found" });
      if (apt.clientId !== req.user.id && apt.therapistId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      const rating = await storage.getMoodRating(appointmentId);
      res.json(rating ?? null);
    } catch {
      res.status(500).json({ message: "Failed to fetch mood rating" });
    }
  });

  // POST /api/appointments/:id/mood-rating — client upserts mood rating
  app.post("/api/appointments/:id/mood-rating", isAuthenticated, requireRoles(["client"]), async (req: any, res) => {
    try {
      const appointmentId = Number(req.params.id);
      if (!Number.isFinite(appointmentId)) return res.status(400).json({ message: "Invalid id" });
      const { upsertMoodRatingSchema } = await import("@shared/schema");
      const parsed = upsertMoodRatingSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
      const rating = await storage.upsertMoodRating(appointmentId, req.user.id, parsed.data);
      res.status(201).json(rating);
    } catch {
      res.status(500).json({ message: "Failed to save mood rating" });
    }
  });

  // --- Consultation Prep ---

  // GET /api/appointments/:id/prep — client or therapist reads prep
  app.get("/api/appointments/:id/prep", isAuthenticated, async (req: any, res) => {
    try {
      const appointmentId = Number(req.params.id);
      if (!Number.isFinite(appointmentId)) return res.status(400).json({ message: "Invalid id" });
      const apt = await storage.getAppointment(appointmentId);
      if (!apt) return res.status(404).json({ message: "Appointment not found" });
      if (apt.clientId !== req.user.id && apt.therapistId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      const prep = await storage.getConsultationPrep(appointmentId);
      res.json(prep ?? null);
    } catch {
      res.status(500).json({ message: "Failed to fetch consultation prep" });
    }
  });

  // POST /api/appointments/:id/prep — client submits/updates consultation prep
  app.post("/api/appointments/:id/prep", isAuthenticated, requireRoles(["client"]), async (req: any, res) => {
    try {
      const appointmentId = Number(req.params.id);
      if (!Number.isFinite(appointmentId)) return res.status(400).json({ message: "Invalid id" });
      const { upsertConsultationPrepSchema } = await import("@shared/schema");
      const parsed = upsertConsultationPrepSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
      const prep = await storage.upsertConsultationPrep(appointmentId, req.user.id, parsed.data);
      res.status(201).json(prep);
    } catch {
      res.status(500).json({ message: "Failed to save consultation prep" });
    }
  });

  // ---- Phase 7: Tier Upgrade Requests ----

  // POST /api/doctor/tier-upgrade — graduated_doctor requests premium upgrade
  app.post("/api/doctor/tier-upgrade", isAuthenticated, requireRoles(["therapist"]), async (req: any, res) => {
    try {
      const { createTierUpgradeRequestSchema } = await import("@shared/schema");
      const parsed = createTierUpgradeRequestSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });

      // Get the doctor's current tier
      const profile = await storage.getTherapistProfile(req.user.id);
      if (!profile) return res.status(404).json({ message: "Therapist profile not found" });
      if (profile.tier !== "graduated_doctor") {
        return res.status(400).json({ message: "Only graduated doctors can request a tier upgrade" });
      }

      // Check for existing pending request
      const existing = await storage.getTierUpgradeRequestsByDoctor(req.user.id);
      if (existing.some((r) => r.status === "pending")) {
        return res.status(409).json({ message: "You already have a pending upgrade request" });
      }

      const request = await storage.createTierUpgradeRequest(req.user.id, profile.tier, parsed.data);
      res.status(201).json(request);
    } catch {
      res.status(500).json({ message: "Failed to create tier upgrade request" });
    }
  });

  // GET /api/doctor/tier-upgrade — doctor views their own requests
  app.get("/api/doctor/tier-upgrade", isAuthenticated, requireRoles(["therapist"]), async (req: any, res) => {
    try {
      const requests = await storage.getTierUpgradeRequestsByDoctor(req.user.id);
      res.json(requests);
    } catch {
      res.status(500).json({ message: "Failed to fetch tier upgrade requests" });
    }
  });

  // GET /api/admin/tier-upgrades — admin views all tier upgrade requests
  app.get("/api/admin/tier-upgrades", isAuthenticated, requireRoles(["admin"]), async (req: any, res) => {
    try {
      const status = req.query.status as string | undefined;
      const requests = await storage.getAllTierUpgradeRequests(status);
      res.json(requests);
    } catch {
      res.status(500).json({ message: "Failed to fetch tier upgrade requests" });
    }
  });

  // PATCH /api/admin/tier-upgrades/:id — admin approves or rejects
  app.patch("/api/admin/tier-upgrades/:id", isAuthenticated, requireRoles(["admin"]), async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });

      const { reviewTierUpgradeRequestSchema } = await import("@shared/schema");
      const parsed = reviewTierUpgradeRequestSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });

      const updated = await storage.reviewTierUpgradeRequest(id, parsed.data.status, req.user.id);
      if (!updated) return res.status(404).json({ message: "Request not found" });

      // If approved, upgrade the doctor's tier
      if (parsed.data.status === "approved") {
        await storage.updateTherapistProfile(updated.doctorId, { tier: "premium_doctor" } as any);
      }

      res.json(updated);
    } catch {
      res.status(500).json({ message: "Failed to review tier upgrade request" });
    }
  });

  // ---- Listener Directory ----

  // Public browse — no auth required
  app.get("/api/listeners/browse", async (req, res) => {
    try {
      const language = typeof req.query.language === "string" ? req.query.language : undefined;
      const topic = typeof req.query.topic === "string" ? req.query.topic : undefined;
      const availableOnly = req.query.available === "1" || req.query.available === "true";
      const listeners = await storage.getBrowsableListeners({ language, topic, availableOnly });
      res.json(listeners);
    } catch {
      res.status(500).json({ message: "Failed to fetch listeners" });
    }
  });

  // Start a session directly with a specific listener
  app.post("/api/peer/session/direct", isAuthenticated, async (req: any, res) => {
    try {
      const clientId = req.user.id;
      const { listenerId } = req.body;
      if (!listenerId || typeof listenerId !== "string") {
        return res.status(400).json({ message: "listenerId is required" });
      }

      // Validate listener exists and is available
      const profile = await storage.getListenerProfile(listenerId);
      if (!profile) return res.status(404).json({ message: "Listener not found" });
      if (profile.verificationStatus !== "approved") {
        return res.status(403).json({ message: "Listener is not approved" });
      }
      if (!["trial", "live"].includes(profile.activationStatus)) {
        return res.status(403).json({ message: "Listener is not active" });
      }
      const activeCooldown = await storage.getActiveListenerCooldown(listenerId);
      if (activeCooldown) {
        return res.status(409).json({
          message: "Listener is in cooldown after a difficult session",
          cooldown: activeCooldown,
        });
      }
      if (!profile.isAvailable) {
        return res.status(409).json({ message: "Listener is currently busy" });
      }

      // Mark listener unavailable and create session
      await storage.setListenerAvailability(listenerId, false);
      const session = await storage.createPeerSession({ clientId, listenerId });
      res.status(201).json(session);
    } catch {
      res.status(500).json({ message: "Failed to start session" });
    }
  });

  // Listener updates their own public profile fields
  app.patch("/api/listener/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const profile = await storage.getListenerProfile(userId);
      if (!profile) return res.status(403).json({ message: "Not a listener" });

      const { headline, aboutMe, avatarEmoji } = req.body;
      const updates: Record<string, unknown> = {};
      if (headline !== undefined) {
        if (typeof headline !== "string" || headline.length > 120) {
          return res.status(400).json({ message: "headline must be a string ≤ 120 chars" });
        }
        updates.headline = headline;
      }
      if (aboutMe !== undefined) {
        if (typeof aboutMe !== "string" || aboutMe.length > 2000) {
          return res.status(400).json({ message: "aboutMe must be a string ≤ 2000 chars" });
        }
        updates.about_me = aboutMe;
      }
      if (avatarEmoji !== undefined) {
        if (typeof avatarEmoji !== "string" || avatarEmoji.length > 10) {
          return res.status(400).json({ message: "avatarEmoji must be a string ≤ 10 chars" });
        }
        updates.avatar_emoji = avatarEmoji;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }

      const { data, error } = await (await import("./supabase")).supabaseAdmin
        .from("listener_profiles")
        .update(updates)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) throw error;
      res.json(data);
    } catch {
      res.status(500).json({ message: "Failed to update listener profile" });
    }
  });

  // ---- Admin: CSV export endpoint (W8) ----
  app.get("/api/admin/export/:type", isAuthenticated, requireRoles(["admin"]), async (req: any, res) => {
    const { type } = req.params;
    const allowed = ["users", "therapists", "appointments"];
    if (!allowed.includes(type)) {
      return res.status(400).json({ message: `type must be one of: ${allowed.join(", ")}` });
    }

    try {
      let rows: Record<string, unknown>[] = [];
      let filename = "";

      if (type === "users") {
        const result = await storage.getUsersPaginated(1, 10000);
        rows = (result.users || []).map((u: any) => ({
          id: u.id,
          email: u.email,
          first_name: u.firstName,
          last_name: u.lastName,
          role: u.role,
          created_at: u.createdAt ?? "",
        }));
        filename = "shifa-users.csv";

      } else if (type === "therapists") {
        const therapists = await storage.getTherapistProfiles({});
        rows = therapists.map((tp: any) => ({
          user_id: tp.userId,
          name: `${tp.user?.firstName ?? ""} ${tp.user?.lastName ?? ""}`.trim(),
          email: tp.user?.email ?? "",
          tier: tp.tier ?? "",
          verified: tp.verified,
          rating: tp.rating ?? "",
          review_count: tp.reviewCount ?? 0,
          rate_dinar: tp.rateDinar ?? "",
          specializations: (tp.specializations || []).join("|"),
          languages: (tp.languages || []).join("|"),
        }));
        filename = "shifa-therapists.csv";

      } else if (type === "appointments") {
        const { data } = await (await import("./supabase")).supabaseAdmin
          .from("appointments")
          .select("id, client_id, therapist_id, scheduled_at, session_type, status, price_dinar, duration_minutes, created_at")
          .order("scheduled_at", { ascending: false })
          .limit(10000);
        rows = (data || []).map((a: any) => ({
          id: a.id,
          client_id: a.client_id,
          therapist_id: a.therapist_id,
          scheduled_at: a.scheduled_at,
          session_type: a.session_type,
          status: a.status,
          price_dinar: a.price_dinar ?? "",
          duration_minutes: a.duration_minutes,
          created_at: a.created_at,
        }));
        filename = "shifa-appointments.csv";
      }

      if (rows.length === 0) {
        return res.status(200).send("");
      }

      const headers = Object.keys(rows[0]);
      const csvLines = [
        headers.join(","),
        ...rows.map((row) =>
          headers.map((h) => {
            const val = String(row[h] ?? "").replace(/"/g, '""');
            return val.includes(",") || val.includes('"') || val.includes("\n") ? `"${val}"` : val;
          }).join(",")
        ),
      ];

      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.send(csvLines.join("\r\n"));
    } catch (err) {
      console.error("[admin/export]", err);
      res.status(500).json({ message: "Export failed" });
    }
  });

  return httpServer;
}
