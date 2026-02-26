import rateLimit from "express-rate-limit";

/**
 * Strict limiter for authentication endpoints — prevents brute-force attacks.
 * 10 attempts per 15 minutes per IP.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
  skipSuccessfulRequests: false,
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
