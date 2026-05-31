/**
 * Authentication utilities for password management and audit logging
 */

import { supabase } from "@/integrations/supabase/client";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";

/**
 * Log an action to the audit trail
 * @param action - Action type (e.g., 'visitor_approved', 'resident_created')
 * @param resourceType - Resource table name
 * @param resourceId - ID of the affected record
 * @param changes - Before/after values
 * @param metadata - Additional context
 */
export async function logAudit(
  action: string,
  resourceType: string,
  resourceId?: string | null,
  changes?: Record<string, unknown> | null,
  metadata?: Record<string, unknown> | null
): Promise<void> {
  try {
    // Call the database function via Supabase
    const { error } = await supabase.rpc("log_audit", {
      p_action: action,
      p_resource_type: resourceType,
      p_resource_id: resourceId,
      p_changes: changes ? JSON.stringify(changes) : null,
      p_metadata: metadata ? JSON.stringify(metadata) : null,
    });

    if (error) {
      console.error("Audit log failed:", error);
    }
  } catch (e) {
    console.error("Audit log error:", e);
  }
}

/**
 * Check if resident must change password on next login
 * @param userId - User ID to check
 */
export async function getUserMustChangePassword(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("must_change_password")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Error checking password change requirement:", error);
    return false;
  }

  return data?.must_change_password ?? false;
}

/**
 * Mark password as changed for the current user
 */
export async function markPasswordChanged(): Promise<void> {
  try {
    const { error } = await supabase.rpc("update_password_changed_at");

    if (error) {
      throw new Error(`Failed to update password: ${error.message}`);
    }

    // Log to audit trail
    await logAudit("password_changed", "profile", undefined, null, {
      forced_change: true,
    });
  } catch (e) {
    console.error("Error marking password as changed:", e);
    throw e;
  }
}

/**
 * Generate a temporary password for a new resident
 * Format: sahjanand@{houseNumber}
 * @param houseNumber - House number
 */
export function generateTemporaryPassword(houseNumber: string): string {
  return `sahjanand@${houseNumber}`;
}

/**
 * Create a new resident account with temporary password
 * Only callable from server (admin creation)
 * @param houseNumber - House number
 * @param ownerName - Owner's full name
 * @param mobileNumber - Mobile number
 * @param houseId - House ID from database
 */
export async function createResidentAccount(
  houseNumber: string,
  ownerName: string,
  mobileNumber: string,
  houseId: string
): Promise<{
  userId?: string;
  email?: string;
  temporaryPassword?: string;
  error?: string;
}> {
  try {
    const email = `house${houseNumber}@sahjanand.local`;
    const temporaryPassword = generateTemporaryPassword(houseNumber);

    // This should only be called from server/admin context
    // The actual user creation happens via seed endpoint or admin panel

    return {
      email,
      temporaryPassword,
    };
  } catch (e) {
    return {
      error: (e as Error).message,
    };
  }
}

/**
 * Record visitor approval/rejection for audit trail
 * @param visitorId - Visitor ID
 * @param houseId - House ID
 * @param status - New status (approved, rejected, wait_at_gate)
 * @param reason - Reason for rejection/wait
 */
export async function recordVisitorApproval(
  visitorId: string,
  houseId: string,
  status: "approved" | "rejected" | "wait_at_gate",
  reason?: string | null
): Promise<void> {
  try {
    const { error } = await supabase.from("visitor_approvals").insert({
      visitor_id: visitorId,
      house_id: houseId,
      approved_by: (await supabase.auth.getUser()).data.user?.id || "",
      status,
      reason,
    });

    if (error) {
      throw error;
    }

    // Log to audit
    await logAudit(
      `visitor_${status}`,
      "visitor",
      visitorId,
      { status },
      { reason }
    );
  } catch (e) {
    console.error("Error recording visitor approval:", e);
    throw e;
  }
}

/**
 * Get recent audit logs for a user (admin only)
 * @param userId - User to get logs for (null = all)
 * @param limit - Number of records to return
 */
export async function getAuditLogs(userId?: string | null, limit: number = 50) {
  let query = supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(limit);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching audit logs:", error);
    return [];
  }

  return data ?? [];
}

/**
 * Validate Supabase environment variables
 * Should be called on app startup
 */
export function validateSupabaseConfig(): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  const clientUrl = import.meta.env.VITE_SUPABASE_URL;
  const clientKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!clientUrl) {
    errors.push("VITE_SUPABASE_URL is missing");
  }
  if (!clientKey) {
    errors.push("VITE_SUPABASE_PUBLISHABLE_KEY is missing");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
