/**
 * @doc Creates a Dodo Payments checkout session for the worldwide payment methods.
 *
 * PREPARED, NOT DEPLOYED. To switch it on:
 *   1. supabase secrets set DODO_PAYMENTS_API_KEY=... DODO_MODE=live \
 *        DODO_PRODUCT_PRO_MONTHLY=pdt_xxx DODO_PRODUCT_PRO_YEARLY=pdt_yyy \
 *        DODO_PRODUCT_ULTRA_MONTHLY=... DODO_PRODUCT_ULTRA_YEARLY=...
 *   2. supabase functions deploy dodo-checkout
 *   3. Build the site with VITE_DODO_CHECKOUT_ENABLED=true
 *
 * Products are created in the Dodo dashboard (Products → New product, subscription
 * type) and their IDs passed through the env vars above.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const SITE_URL = Deno.env.get("SITE_URL") ?? "https://www.megsyai.com";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Maps a Megsy plan to the Dodo product id held in the function secrets. */
function productIdFor(tier: string, interval: string): string | null {
  const key = `DODO_PRODUCT_${tier.toUpperCase()}_${interval.toUpperCase()}`;
  return Deno.env.get(key) ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const apiKey = Deno.env.get("DODO_PAYMENTS_API_KEY");
    if (!apiKey) return json({ error: "Dodo Payments is not configured yet." }, 503);

    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const { data: userData, error: userError } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}) as Record<string, unknown>);
    const tier = String(body?.tier ?? "pro").toLowerCase();
    const interval = body?.interval === "yearly" ? "yearly" : "monthly";
    const requested = Array.isArray(body?.methodTypes)
      ? (body.methodTypes as unknown[]).map(String).filter(Boolean)
      : [];

    const productId = productIdFor(tier, interval);
    if (!productId) {
      return json({ error: `No Dodo product configured for ${tier}/${interval}.` }, 503);
    }

    // Cards stay in the list as a fallback: a session with no usable method fails.
    const methodTypes = requested.length ? [...new Set([...requested, "credit", "debit"])] : ["credit", "debit"];
    const mode = Deno.env.get("DODO_MODE") === "live" ? "live" : "test";

    const response = await fetch(`https://${mode}.dodopayments.com/checkouts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        product_cart: [{ product_id: productId, quantity: 1 }],
        allowed_payment_method_types: methodTypes,
        return_url: `${SITE_URL}/checkout/return`,
        show_saved_payment_methods: true,
        metadata: {
          user_id: user.id,
          email: user.email ?? "",
          tier,
          interval,
          source: "megsy-checkout",
        },
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.checkout_url) {
      console.error("dodo checkout failed", response.status, payload);
      return json(
        { error: "Dodo checkout could not be created.", detail: payload ?? response.status },
        502,
      );
    }

    return json({ checkout_url: payload.checkout_url, session_id: payload.session_id ?? null });
  } catch (cause) {
    console.error("dodo-checkout error", cause);
    return json({ error: cause instanceof Error ? cause.message : "Unexpected error" }, 500);
  }
});
