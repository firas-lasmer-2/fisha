import { describe, it, expect } from "vitest";
import {
  signupRequestSchema,
  loginRequestSchema,
  moodEntryRequestSchema,
  journalEntryRequestSchema,
  slotCreateRequestSchema,
  paymentInitiateRequestSchema,
  peerMessageRequestSchema,
  sendMessageRequestSchema,
  reviewRequestSchema,
} from "../schema";

describe("signupRequestSchema", () => {
  it("accepts valid signup", () => {
    const result = signupRequestSchema.safeParse({
      email: "test@example.com",
      password: "strongpass123",
      role: "client",
      firstName: "Ali",
    });
    expect(result.success).toBe(true);
  });

  it("rejects short password", () => {
    const result = signupRequestSchema.safeParse({
      email: "test@example.com",
      password: "short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = signupRequestSchema.safeParse({
      email: "not-an-email",
      password: "strongpass123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid role", () => {
    const result = signupRequestSchema.safeParse({
      email: "test@example.com",
      password: "strongpass123",
      role: "superadmin",
    });
    expect(result.success).toBe(false);
  });
});

describe("loginRequestSchema", () => {
  it("accepts valid login", () => {
    const result = loginRequestSchema.safeParse({
      email: "user@example.com",
      password: "anypassword",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing password", () => {
    const result = loginRequestSchema.safeParse({ email: "user@example.com" });
    expect(result.success).toBe(false);
  });
});

describe("moodEntryRequestSchema", () => {
  it("accepts valid mood entry", () => {
    const result = moodEntryRequestSchema.safeParse({
      moodScore: 4,
      emotions: ["happy", "calm"],
      notes: "Good day",
    });
    expect(result.success).toBe(true);
  });

  it("rejects out-of-range mood score", () => {
    expect(moodEntryRequestSchema.safeParse({ moodScore: 0 }).success).toBe(false);
    expect(moodEntryRequestSchema.safeParse({ moodScore: 6 }).success).toBe(false);
  });

  it("requires moodScore", () => {
    expect(moodEntryRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe("journalEntryRequestSchema", () => {
  it("accepts valid entry", () => {
    const result = journalEntryRequestSchema.safeParse({
      title: "My day",
      content: "Today was nice",
    });
    expect(result.success).toBe(true);
  });

  it("rejects title over 200 chars", () => {
    const result = journalEntryRequestSchema.safeParse({
      title: "x".repeat(201),
      content: "c",
    });
    expect(result.success).toBe(false);
  });
});

describe("slotCreateRequestSchema", () => {
  it("accepts valid slot", () => {
    const result = slotCreateRequestSchema.safeParse({
      startsAt: new Date(Date.now() + 86400000).toISOString(),
      durationMinutes: 50,
      priceDinar: 80,
    });
    expect(result.success).toBe(true);
  });

  it("accepts slot with optional meetLink", () => {
    const result = slotCreateRequestSchema.safeParse({
      startsAt: new Date(Date.now() + 86400000).toISOString(),
      durationMinutes: 50,
      priceDinar: 80,
      meetLink: "https://meet.google.com/abc-def-ghi",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid meetLink", () => {
    const result = slotCreateRequestSchema.safeParse({
      startsAt: new Date(Date.now() + 86400000).toISOString(),
      durationMinutes: 50,
      priceDinar: 80,
      meetLink: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("rejects duration under 15 minutes", () => {
    const result = slotCreateRequestSchema.safeParse({
      startsAt: new Date().toISOString(),
      durationMinutes: 10,
      priceDinar: 50,
    });
    expect(result.success).toBe(false);
  });

  it("rejects price over 1000 TND", () => {
    const result = slotCreateRequestSchema.safeParse({
      startsAt: new Date().toISOString(),
      durationMinutes: 50,
      priceDinar: 1001,
    });
    expect(result.success).toBe(false);
  });
});

describe("paymentInitiateRequestSchema", () => {
  it("accepts valid payment", () => {
    const result = paymentInitiateRequestSchema.safeParse({
      appointmentId: 1,
      therapistId: "550e8400-e29b-41d4-a716-446655440000",
      amount: 80,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid therapistId UUID", () => {
    const result = paymentInitiateRequestSchema.safeParse({
      appointmentId: 1,
      therapistId: "not-a-uuid",
      amount: 80,
    });
    expect(result.success).toBe(false);
  });
});

describe("sendMessageRequestSchema", () => {
  it("accepts valid message", () => {
    const result = sendMessageRequestSchema.safeParse({ content: "Hello" });
    expect(result.success).toBe(true);
  });

  it("rejects empty content", () => {
    const result = sendMessageRequestSchema.safeParse({ content: "" });
    expect(result.success).toBe(false);
  });
});

describe("reviewRequestSchema", () => {
  it("accepts valid review", () => {
    const result = reviewRequestSchema.safeParse({ overallRating: 5 });
    expect(result.success).toBe(true);
  });

  it("rejects rating 0", () => {
    const result = reviewRequestSchema.safeParse({ overallRating: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects rating 6", () => {
    const result = reviewRequestSchema.safeParse({ overallRating: 6 });
    expect(result.success).toBe(false);
  });
});

describe("peerMessageRequestSchema", () => {
  it("accepts valid peer message", () => {
    const result = peerMessageRequestSchema.safeParse({ content: "I need support" });
    expect(result.success).toBe(true);
  });

  it("rejects content over 5000 chars", () => {
    const result = peerMessageRequestSchema.safeParse({ content: "x".repeat(5001) });
    expect(result.success).toBe(false);
  });
});
