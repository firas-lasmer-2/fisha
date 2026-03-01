/**
 * Wellness routes: mood, journal, resources, user profile, E2E key backup,
 * treatment goals, session summaries, and progress analytics.
 *
 * Extracted from server/routes.ts to reduce file size.
 * All route logic is unchanged — this is a pure structural move.
 */

import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated, requireRoles } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { displayNameLimiter } from "../middleware/rate-limit";
import { ensureTherapistProfile } from "./shared";
import crypto from "crypto";
import {
  moodEntryRequestSchema,
  journalEntryRequestSchema,
  insertTreatmentGoalSchema,
  updateTreatmentGoalSchema,
  upsertSessionSummarySchema,
  slotCreateRequestSchema,
} from "@shared/schema";

function generateJitsiLink() {
  return `https://meet.jit.si/shifa-${crypto.randomUUID()}`;
}

export function registerWellnessRoutes(app: Express) {
  // ---- Mood ----

  app.get("/api/mood", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 30;
      const entries = await storage.getMoodEntries(userId, limit);
      res.json(entries);
    } catch {
      res.status(500).json({ message: "Failed to fetch mood entries" });
    }
  });

  app.post("/api/mood", isAuthenticated, validateBody(moodEntryRequestSchema), async (req: any, res) => {
    try {
      const entry = await storage.createMoodEntry({ ...req.body, userId: req.user.id });
      res.status(201).json(entry);
    } catch {
      res.status(500).json({ message: "Failed to create mood entry" });
    }
  });

  // ---- Journal ----

  app.get("/api/journal", isAuthenticated, async (req: any, res) => {
    try {
      const entries = await storage.getJournalEntries(req.user.id);
      res.json(entries);
    } catch {
      res.status(500).json({ message: "Failed to fetch journal entries" });
    }
  });

  app.post("/api/journal", isAuthenticated, validateBody(journalEntryRequestSchema), async (req: any, res) => {
    try {
      const entry = await storage.createJournalEntry({ ...req.body, userId: req.user.id });
      res.status(201).json(entry);
    } catch {
      res.status(500).json({ message: "Failed to create journal entry" });
    }
  });

  app.patch("/api/journal/:id", isAuthenticated, async (req: any, res) => {
    try {
      const entryId = parseInt(req.params.id);
      const existing = await storage.getJournalEntry(entryId);
      if (!existing) return res.status(404).json({ message: "Journal entry not found" });
      if (existing.userId !== req.user.id) return res.status(403).json({ message: "Access denied" });
      const entry = await storage.updateJournalEntry(entryId, req.body);
      res.json(entry);
    } catch {
      res.status(500).json({ message: "Failed to update journal entry" });
    }
  });

  app.delete("/api/journal/:id", isAuthenticated, async (req: any, res) => {
    try {
      const entryId = parseInt(req.params.id);
      const existing = await storage.getJournalEntry(entryId);
      if (!existing) return res.status(404).json({ message: "Journal entry not found" });
      if (existing.userId !== req.user.id) return res.status(403).json({ message: "Access denied" });
      await storage.deleteJournalEntry(entryId);
      res.status(204).send();
    } catch {
      res.status(500).json({ message: "Failed to delete journal entry" });
    }
  });

  // ---- Resources ----

  app.get("/api/resources", async (req, res) => {
    try {
      const category = req.query.category as string | undefined;
      res.json(await storage.getResources(category));
    } catch {
      res.status(500).json({ message: "Failed to fetch resources" });
    }
  });

  // ---- User profile ----

  app.patch("/api/user/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { displayName, ...rest } = req.body;
      if (displayName !== undefined && displayName !== null) {
        const namePattern = /^[a-zA-Z0-9\u0600-\u06FF_]{3,30}$/;
        if (!namePattern.test(displayName)) return res.status(400).json({ message: "Invalid display name format" });
        const available = await storage.isDisplayNameAvailable(displayName, userId);
        if (!available) return res.status(409).json({ message: "Display name already taken" });
      }
      const user = await storage.updateUser(userId, { ...rest, displayName: displayName ?? undefined });
      res.json(user);
    } catch {
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.get("/api/user/display-name/check/:name", isAuthenticated, displayNameLimiter, async (req: any, res) => {
    try {
      const { name } = req.params;
      const namePattern = /^[a-zA-Z0-9\u0600-\u06FF_]{3,30}$/;
      if (!namePattern.test(name)) return res.json({ available: false, reason: "invalid_format" });
      const available = await storage.isDisplayNameAvailable(name, req.user.id);
      res.json({ available });
    } catch {
      res.status(500).json({ message: "Failed to check display name" });
    }
  });

  // ---- Treatment Goals ----

  app.get("/api/goals", isAuthenticated, async (req: any, res) => {
    try {
      res.json(await storage.getTreatmentGoals(req.user.id));
    } catch {
      res.status(500).json({ message: "Failed to fetch goals" });
    }
  });

  app.post("/api/goals", isAuthenticated, async (req: any, res) => {
    try {
      const parsed = insertTreatmentGoalSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid goal data", errors: parsed.error.issues });
      const goal = await storage.createTreatmentGoal(req.user.id, parsed.data);
      res.status(201).json(goal);
    } catch {
      res.status(500).json({ message: "Failed to create goal" });
    }
  });

  app.patch("/api/goals/:id", isAuthenticated, async (req: any, res) => {
    try {
      const parsed = updateTreatmentGoalSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid goal data", errors: parsed.error.issues });
      const goal = await storage.updateTreatmentGoal(Number(req.params.id), req.user.id, parsed.data);
      if (!goal) return res.status(404).json({ message: "Goal not found" });
      res.json(goal);
    } catch {
      res.status(500).json({ message: "Failed to update goal" });
    }
  });

  app.delete("/api/goals/:id", isAuthenticated, async (req: any, res) => {
    try {
      await storage.deleteTreatmentGoal(Number(req.params.id), req.user.id);
      res.status(204).end();
    } catch {
      res.status(500).json({ message: "Failed to delete goal" });
    }
  });

  // ---- Session Summaries ----

  app.get("/api/session-summaries/:appointmentId", isAuthenticated, async (req: any, res) => {
    try {
      const appointmentId = Number(req.params.appointmentId);
      const appointment = await storage.getAppointment(appointmentId);
      if (!appointment) return res.status(404).json({ message: "Appointment not found" });
      if (appointment.therapistId !== req.user.id && appointment.clientId !== req.user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const summary = await storage.getSessionSummary(appointmentId);
      if (!summary) return res.status(404).json({ message: "No summary yet" });
      if (appointment.clientId === req.user.id && !summary.clientVisible) {
        return res.status(404).json({ message: "No summary yet" });
      }
      res.json(summary);
    } catch {
      res.status(500).json({ message: "Failed to fetch session summary" });
    }
  });

  app.post("/api/session-summaries/:appointmentId", isAuthenticated, async (req: any, res) => {
    try {
      const parsed = upsertSessionSummarySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.issues });
      const appointmentId = Number(req.params.appointmentId);
      const appointment = await storage.getAppointment(appointmentId);
      if (!appointment) return res.status(404).json({ message: "Appointment not found" });
      if (appointment.therapistId !== req.user.id) return res.status(403).json({ message: "Only therapist can write summaries" });
      const summary = await storage.upsertSessionSummary(appointmentId, req.user.id, appointment.clientId, parsed.data);
      res.status(201).json(summary);
    } catch {
      res.status(500).json({ message: "Failed to save session summary" });
    }
  });

  // ---- Progress Analytics ----

  app.get("/api/progress/analytics", isAuthenticated, async (req: any, res) => {
    try {
      const days = Math.min(Number(req.query.days) || 30, 90);
      const moodTrend = await storage.getMoodAnalytics(req.user.id, days);
      res.json({ moodTrend });
    } catch {
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // ---- Batch Slot Creation ----

  app.post("/api/therapist/slots/batch", isAuthenticated, requireRoles(["therapist"]), async (req: any, res) => {
    try {
      await ensureTherapistProfile(req.user.id);
      const { slots } = req.body as { slots: Array<{ startsAt: string; durationMinutes: number; priceDinar: number; meetLink?: string | null }> };
      if (!Array.isArray(slots) || slots.length === 0) return res.status(400).json({ message: "slots array required" });
      if (slots.length > 50) return res.status(400).json({ message: "Max 50 slots per batch" });

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
    } catch {
      res.status(500).json({ message: "Failed to create slots" });
    }
  });
}
