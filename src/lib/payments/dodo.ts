/**
 * @doc The Dodo Payments rail.
 *
 * Methods that Megsy cannot charge in-app are handed to Dodo's hosted checkout.
 * Dodo is a Merchant of Record, so it collects the money, handles tax and pays
 * us out — we only need the checkout URL.
 *
 * Switch it on with the `VITE_DODO_CHECKOUT_ENABLED=true` build variable once the
 * `dodo-checkout` edge function has its `DODO_PAYMENTS_API_KEY` secret.
 */
import { supabase } from "@/integrations/supabase/client";
import { dodoMethodTypesFor } from "./paymentMethods";

export const DODO_READY = import.meta.env.VITE_DODO_CHECKOUT_ENABLED === "true";

const ALLOWED_HOSTS = ["dodopayments.com", "www.dodopayments.com", "checkout.dodopayments.com"];

/** Sends the browser to an external checkout, escaping any embedding frame first. */
export function openExternalCheckout(url: string): boolean {
  if (typeof window === "undefined" || !url) return false;
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    console.error("Blocked invalid checkout URL");
    return false;
  }
  if (target.protocol !== "https:" || !ALLOWED_HOSTS.includes(target.hostname)) {
    console.error("Blocked non-Dodo checkout URL");
    return false;
  }

  const framed = window.top && window.top !== window;
  if (framed) {
    try {
      window.top!.location.href = target.toString();
      return true;
    } catch {
      /* cross-origin or sandboxed — fall through */
    }
    const tab = window.open(target.toString(), "_blank", "noopener,noreferrer");
    if (tab) return true;
  }
  window.location.href = target.toString();
  return true;
}

export type DodoFailureReason = "not-configured" | "unauthenticated" | "failed";

export interface DodoStartResult {
  ok: boolean;
  reason?: DodoFailureReason;
  message?: string;
}

export async function startDodoCheckout(input: {
  tier: string;
  interval: "monthly" | "yearly";
  methodId?: string;
}): Promise<DodoStartResult> {
  if (!DODO_READY) return { ok: false, reason: "not-configured" };

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return { ok: false, reason: "unauthenticated" };

    const { data, error } = await supabase.functions.invoke("dodo-checkout", {
      body: {
        tier: input.tier,
        interval: input.interval,
        methodId: input.methodId ?? null,
        methodTypes: dodoMethodTypesFor(input.methodId),
      },
    });

    if (error) return { ok: false, reason: "failed", message: error.message };

    const url = (data as { checkout_url?: string | null } | null)?.checkout_url;
    if (!url) {
      return {
        ok: false,
        reason: "failed",
        message: "The secure checkout link is missing. Please try another method.",
      };
    }

    openExternalCheckout(url);
    return { ok: true };
  } catch (cause) {
    return {
      ok: false,
      reason: "failed",
      message: cause instanceof Error ? cause.message : "Something went wrong.",
    };
  }
}
