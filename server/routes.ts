import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, getSession } from "./replit_integrations/auth/replitAuth";
import { registerAuthRoutes } from "./replit_integrations/auth/routes";
import OpenAI from "openai";
import type { IncomingMessage } from "http";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const wsClients = new Map<string, Set<WebSocket>>();

function broadcastToUser(userId: string, data: any) {
  const clients = wsClients.get(userId);
  if (clients) {
    const msg = JSON.stringify(data);
    clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    });
  }
}

function extractUserFromSession(req: IncomingMessage): Promise<string | null> {
  return new Promise((resolve) => {
    const sessionMiddleware = getSession();
    const mockRes = { end: () => {}, setHeader: () => {}, getHeader: () => "" } as any;
    sessionMiddleware(req as any, mockRes, () => {
      const session = (req as any).session;
      const passport = session?.passport;
      const user = passport?.user;
      if (user?.claims?.sub) {
        resolve(user.claims.sub);
      } else {
        resolve(null);
      }
    });
  });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  async function broadcastPresence(userId: string, status: "online" | "offline") {
    const user = await storage.getUser(userId);
    if (user?.role === "therapist") {
      const data = JSON.stringify({ type: "presence", userId, status });
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(data);
        }
      });
    }
  }

  wss.on("connection", async (ws, req) => {
    let userId: string | null = null;

    async function registerUser(uid: string) {
      if (!wsClients.has(uid)) {
        wsClients.set(uid, new Set());
      }
      const wasOffline = wsClients.get(uid)!.size === 0;
      wsClients.get(uid)!.add(ws);
      if (wasOffline) {
        await broadcastPresence(uid, "online");
      }
    }

    try {
      userId = await extractUserFromSession(req);
    } catch (e) {}

    if (!userId) {
      ws.on("message", async (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === "auth" && msg.userId) {
            userId = msg.userId;
            await registerUser(userId!);
          }
        } catch (e) {}
      });
    } else {
      await registerUser(userId);
      ws.send(JSON.stringify({ type: "authenticated", userId }));
    }

    ws.on("close", async () => {
      if (userId) {
        wsClients.get(userId)?.delete(ws);
        if (wsClients.get(userId)?.size === 0) {
          wsClients.delete(userId);
          await broadcastPresence(userId, "offline");
        }
      }
    });
  });

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

  app.get("/api/therapists/online", async (_req, res) => {
    try {
      const allTherapists = await storage.getTherapistProfiles();
      const therapistUserIds = new Set(allTherapists.map((t) => t.userId));
      const onlineIds = Array.from(wsClients.keys()).filter((id) => therapistUserIds.has(id));
      res.json(onlineIds);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch online therapists" });
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
      const userId = req.user.claims.sub;
      await storage.updateUser(userId, { role: "therapist" });
      const profile = await storage.createTherapistProfile({ ...req.body, userId });
      res.status(201).json(profile);
    } catch (error) {
      res.status(500).json({ message: "Failed to create therapist profile" });
    }
  });

  app.patch("/api/therapists", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.updateTherapistProfile(userId, req.body);
      res.json(profile);
    } catch (error) {
      res.status(500).json({ message: "Failed to update therapist profile" });
    }
  });

  app.get("/api/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversations = await storage.getConversationsByUser(userId);
      res.json(conversations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  app.post("/api/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { therapistId } = req.body;
      const conv = await storage.getOrCreateConversation(userId, therapistId);
      res.status(201).json(conv);
    } catch (error) {
      res.status(500).json({ message: "Failed to create conversation" });
    }
  });

  app.get("/api/conversations/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const convId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
      const msg = await storage.createMessage({
        conversationId: convId,
        senderId: userId,
        content: req.body.content,
        messageType: req.body.messageType || "text",
      });

      const conv = await storage.getConversation(convId);
      if (conv) {
        const otherId = conv.clientId === userId ? conv.therapistId : conv.clientId;
        broadcastToUser(otherId, { type: "new_message", data: msg });
      }

      res.status(201).json(msg);
    } catch (error) {
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  app.get("/api/unread-count", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const count = await storage.getUnreadCount(userId);
      res.json({ count });
    } catch (error) {
      res.status(500).json({ message: "Failed to get unread count" });
    }
  });

  app.get("/api/appointments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const apts = await storage.getAppointments(userId);
      res.json(apts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch appointments" });
    }
  });

  app.post("/api/appointments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const apt = await storage.createAppointment({ ...req.body, clientId: userId });
      broadcastToUser(req.body.therapistId, { type: "new_appointment", data: apt });
      res.status(201).json(apt);
    } catch (error) {
      res.status(500).json({ message: "Failed to create appointment" });
    }
  });

  app.patch("/api/appointments/:id/status", isAuthenticated, async (req: any, res) => {
    try {
      const apt = await storage.updateAppointmentStatus(parseInt(req.params.id), req.body.status);
      res.json(apt);
    } catch (error) {
      res.status(500).json({ message: "Failed to update appointment" });
    }
  });

  app.get("/api/mood", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 30;
      const entries = await storage.getMoodEntries(userId, limit);
      res.json(entries);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch mood entries" });
    }
  });

  app.post("/api/mood", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const entry = await storage.createMoodEntry({ ...req.body, userId });
      res.status(201).json(entry);
    } catch (error) {
      res.status(500).json({ message: "Failed to create mood entry" });
    }
  });

  app.get("/api/journal", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const entries = await storage.getJournalEntries(userId);
      res.json(entries);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch journal entries" });
    }
  });

  app.post("/api/journal", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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

  app.get("/api/resources", async (req, res) => {
    try {
      const category = req.query.category as string | undefined;
      const resourceList = await storage.getResources(category);
      res.json(resourceList);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch resources" });
    }
  });

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
      const userId = req.user.claims.sub;
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

  app.patch("/api/user/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.updateUser(userId, req.body);
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

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
      const clientId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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

  return httpServer;
}
