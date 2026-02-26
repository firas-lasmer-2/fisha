import { supabaseAdmin } from "./supabase";
import type { Request } from "express";

export type AuditAction =
  | "verification.approve"
  | "verification.reject"
  | "listener.approve"
  | "listener.reject"
  | "listener.changes_requested"
  | "listener.activate_trial"
  | "listener.activate_live"
  | "listener.suspend"
  | "report.resolve"
  | "therapist.tier_change"
  | "user.role_change"
  | "user.suspend"
  | "payment.refund"
  | "admin.analytics_view";

/**
 * Write an audit log entry. Fires-and-forgets — failures are logged to stderr
 * but never thrown to the caller (audit logging must not break primary flows).
 */
export async function logAudit(
  actorId: string | null,
  action: AuditAction | string,
  resourceType: string,
  resourceId?: string | number | null,
  metadata?: Record<string, unknown> | null,
  req?: Request,
): Promise<void> {
  try {
    const ip = req
      ? (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
        req.socket?.remoteAddress ??
        null
      : null;

    await supabaseAdmin.from("audit_log").insert({
      actor_id: actorId,
      action,
      resource_type: resourceType,
      resource_id: resourceId != null ? String(resourceId) : null,
      metadata: metadata ?? null,
      ip_address: ip,
    });
  } catch (err) {
    console.error("[audit] Failed to write audit log:", err);
  }
}
