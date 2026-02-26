import type { Request, Response, NextFunction } from "express";
import { type ZodSchema, ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

/**
 * Express middleware factory that validates req.body against a Zod schema.
 * Returns a structured 400 response with field-level errors on failure.
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const readable = fromZodError(result.error);
      res.status(400).json({
        message: "Validation failed",
        errors: readable.details,
      });
      return;
    }
    // Replace body with parsed (coerced/stripped) data
    req.body = result.data;
    next();
  };
}
