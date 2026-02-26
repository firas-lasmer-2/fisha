import { describe, it, expect } from "vitest";
import { moderateContent } from "../moderation";

describe("moderateContent", () => {
  it("returns not flagged for safe content", () => {
    const result = moderateContent("I had a good day today and felt calm.");
    expect(result.flagged).toBe(false);
  });

  it("flags crisis content as critical", () => {
    const result = moderateContent("I want to commit suicide");
    expect(result.flagged).toBe(true);
    expect(result.severity).toBe("critical");
    expect(result.reason).toBe("crisis_content");
  });

  it("flags harassment as high severity", () => {
    const result = moderateContent("I will kill you if you don't listen");
    expect(result.flagged).toBe(true);
    expect(result.severity).toBe("high");
    expect(result.reason).toBe("harassment");
  });

  it("flags email as solicitation (low severity)", () => {
    const result = moderateContent("Contact me at user@example.com instead");
    expect(result.flagged).toBe(true);
    expect(result.reason).toBe("solicitation");
  });

  it("flags off-platform payment request", () => {
    const result = moderateContent("Please pay me via virement outside the app");
    expect(result.flagged).toBe(true);
    expect(result.reason).toBe("solicitation");
  });

  it("flags sexual content as high severity", () => {
    const result = moderateContent("Send me nude photos");
    expect(result.flagged).toBe(true);
    expect(result.severity).toBe("high");
    expect(result.reason).toBe("sexual_content");
  });

  it("chooses worst severity when multiple patterns match", () => {
    // "worthless" matches harassment (medium); email matches solicitation (low)
    // worst should be medium
    const result = moderateContent("You are worthless, email me at x@y.com");
    expect(result.flagged).toBe(true);
    expect(result.severity).toBe("medium");
  });

  it("never throws on unexpected input", () => {
    expect(() => moderateContent("")).not.toThrow();
    expect(() => moderateContent("   ")).not.toThrow();
    expect(() => moderateContent("\u0000\u0001\u0002")).not.toThrow();
  });

  it("handles Arabic crisis content", () => {
    const result = moderateContent("أريد الانتحار");
    expect(result.flagged).toBe(true);
    expect(result.severity).toBe("critical");
  });
});
