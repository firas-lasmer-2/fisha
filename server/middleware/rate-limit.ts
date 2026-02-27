import rateLimit from "express-rate-limit";

/**
 * Strict limiter for authentication endpoints — prevents brute-force attacks.
 * 10 failed attempts per 15 minutes per IP (successful requests don't count).
 * Bypassed in non-production so dev testing isn't blocked.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
  skipSuccessfulRequests: true,
  skip: () => process.env.NODE_ENV !== "production",
});

/**
 * General API rate limiter — prevents scraping and abuse.
 * 150 requests per minute per IP.
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
  skipSuccessfulRequests: true,
});

/**
 * Payment initiation limiter — prevents duplicate charges and abuse.
 * 10 payment attempts per 15 minutes per IP.
 */
export const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many payment attempts, please try again later." },
  skipSuccessfulRequests: false,
});

/**
 * Booking limiter — prevents slot booking spam.
 * 20 booking attempts per 15 minutes per IP.
 */
export const bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many booking attempts, please try again later." },
  skipSuccessfulRequests: false,
});

/**
 * Webhook endpoints — external payment providers call these.
 * 60 requests per minute per IP.
 */
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many webhook requests." },
});

/**
 * Display name availability check — prevents enumeration of taken names.
 * 20 requests per minute per IP.
 */
export const displayNameLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many display name checks, please try again later." },
});
