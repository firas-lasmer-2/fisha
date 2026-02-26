import { describe, it, expect } from "vitest";
import { matchTherapists, type TherapistCandidate } from "../matching";

// Minimal candidate factory
function makeCandidate(overrides: Partial<TherapistCandidate> = {}): TherapistCandidate {
  return {
    id: "therapist-" + Math.random().toString(36).slice(2),
    name: "Dr. Test",
    specializations: ["anxiety", "depression"],
    languages: ["arabic", "french"],
    rateDinar: 80,
    rating: 4.0,
    gender: "female",
    yearsExperience: 5,
    verified: true,
    hasAvailabilityIn48h: false,
    hadPriorSession: false,
    ...overrides,
  };
}

describe("matchTherapists — deterministic stage", () => {
  it("returns empty array when no candidates", async () => {
    const results = await matchTherapists([], { concerns: "anxiety" }, 3);
    expect(results).toHaveLength(0);
  });

  it("filters out therapists exceeding budget", async () => {
    const expensive = makeCandidate({ id: "expensive", rateDinar: 200 });
    const affordable = makeCandidate({ id: "affordable", rateDinar: 60 });
    // Use a very short timeout to force fallback (no real OpenAI in tests)
    const results = await matchTherapists(
      [expensive, affordable],
      { concerns: "stress", budgetDinar: 100 },
      3,
    );
    const ids = results.map((r) => r.therapistId);
    expect(ids).not.toContain("expensive");
    expect(ids).toContain("affordable");
  });

  it("filters out wrong gender when gender specified", async () => {
    const male = makeCandidate({ id: "male-therapist", gender: "male" });
    const female = makeCandidate({ id: "female-therapist", gender: "female" });
    const results = await matchTherapists(
      [male, female],
      { concerns: "anxiety", gender: "female" },
      3,
    );
    const ids = results.map((r) => r.therapistId);
    expect(ids).not.toContain("male-therapist");
    expect(ids).toContain("female-therapist");
  });

  it("prioritizes therapists with prior sessions", async () => {
    const newTherapist = makeCandidate({ id: "new", hadPriorSession: false });
    const priorTherapist = makeCandidate({ id: "prior", hadPriorSession: true });
    const results = await matchTherapists(
      [newTherapist, priorTherapist],
      { concerns: "anxiety" },
      2,
    );
    // Prior session therapist should rank higher
    if (results.length >= 2) {
      expect(results[0].therapistId).toBe("prior");
    }
  });

  it("returns up to topK results", async () => {
    const candidates = Array.from({ length: 10 }, (_, i) =>
      makeCandidate({ id: `t-${i}`, rateDinar: 50 + i * 5 }),
    );
    const results = await matchTherapists(candidates, { concerns: "stress" }, 3);
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it("each result has required fields", async () => {
    const candidates = [makeCandidate(), makeCandidate()];
    const results = await matchTherapists(candidates, { concerns: "depression" }, 2);
    for (const rec of results) {
      expect(rec).toHaveProperty("therapistId");
      expect(rec).toHaveProperty("matchScore");
      expect(rec).toHaveProperty("reason");
      expect(typeof rec.matchScore).toBe("number");
      expect(rec.matchScore).toBeGreaterThanOrEqual(0);
      expect(rec.matchScore).toBeLessThanOrEqual(100);
    }
  });
});
