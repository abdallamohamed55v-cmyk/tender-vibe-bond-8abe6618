// Premium slides quota: free users get 3 free premium slide generations per day,
// then it costs 1 credit per generation.
import { supabase } from "@/integrations/supabase/client";

const KEY_PREFIX = "megsy_premium_slides_used_";
export const FREE_PREMIUM_SLIDES_PER_DAY = 3;
export const PREMIUM_SLIDES_CREDIT_COST = 1;

function todayKey(userId: string) {
  const d = new Date();
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `${KEY_PREFIX}${userId}_${ymd}`;
}

export function getPremiumSlidesUsedToday(userId: string): number {
  try {
    const v = localStorage.getItem(todayKey(userId));
    return v ? Math.max(0, parseInt(v, 10) || 0) : 0;
  } catch { return 0; }
}

export function incrementPremiumSlidesUsedToday(userId: string) {
  try {
    const k = todayKey(userId);
    const current = getPremiumSlidesUsedToday(userId);
    localStorage.setItem(k, String(current + 1));
  } catch { /* ignore */ }
}

/**
 * Authorize one premium slide generation for the user.
 * - If they still have free uses today: allow without charging.
 * - Otherwise: deduct PREMIUM_SLIDES_CREDIT_COST credits server-side.
 * Returns { ok: true, charged: boolean } on success, or { ok: false, reason } on failure.
 */
export async function authorizePremiumSlide(
  userId: string,
): Promise<{ ok: true; charged: boolean; remainingFree: number } | { ok: false; reason: string }> {
  const used = getPremiumSlidesUsedToday(userId);
  if (used < FREE_PREMIUM_SLIDES_PER_DAY) {
    incrementPremiumSlidesUsedToday(userId);
    return { ok: true, charged: false, remainingFree: FREE_PREMIUM_SLIDES_PER_DAY - used - 1 };
  }
  // Charge 1 credit
  const { data, error } = await supabase.rpc("deduct_credits", {
    p_user_id: userId,
    p_amount: PREMIUM_SLIDES_CREDIT_COST,
    p_action_type: "premium_slides",
    p_description: "Premium slides generation (over daily free quota)",
  } as never);
  if (error) return { ok: false, reason: "Could not process credit charge" };
  const result = data as { success?: boolean; error?: string } | null;
  if (!result?.success) return { ok: false, reason: result?.error || "Insufficient credits" };
  return { ok: true, charged: true, remainingFree: 0 };
}
