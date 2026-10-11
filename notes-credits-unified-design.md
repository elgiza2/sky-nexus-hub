# Megsy Credit System 2.0 — Unified Design (proposal)

> One credit, one price table, one server-side ledger. This document proposes the target
> design; prices ($7 / $15 / $120 / $17 / $40 / $320) stay exactly as they are today.

## 1. The anchor

**1 MC = $0.01 of platform value.** Every action is priced in whole MC, and every price is
derived from provider cost + a target gross margin, so the unit stops being an abstract number.

Published anchor line for the pricing page: *"1 credit ≈ one chat message, half a standard image,
or 1/20 of a 5-second video. Nothing on Megsy is unlimited."*

**Decision (Oct 2026): nothing is free — chat included.** Chat is metered from day one, so the
credit is the only way to use the product and the balance moves on every single action.

## 2. One table, one source of truth

Replace the three current cost locations (a TS constant in `media-video`, `video_models.credits_per_video`,
and the Anything API `credits`) with a single DB table `credit_costs`:

| column | meaning |
|---|---|
| `action_key` | `chat`, `image_standard`, `image_premium`, `video_5s_720`, `video_5s_1080`, `video_10s_1080`, `research_deep`, `agent_start`, `agent_step`, `browser_minute`, `voice_1k_chars`, `music_track`, `slides_deck`, `doc_generate`, `code_minute` |
| `mc` | whole-credit price |
| `unit` | what one charge represents |
| `provider_cost_usd` | our cost, for margin monitoring |
| `active` | kill switch per action |
| `updated_at` | audit |

Every edge function reads this table through one RPC: `spend(action_key, operation_key, meta)`.

## 3. Proposed price table (action → MC)

| Action | Unit | MC | Provider cost (est.) | Margin |
|---|---|---|---|---|
| Chat turn — standard model | per turn | **1** | ~$0.002–0.008 | ~50% |
| Chat turn — frontier/reasoning model | per turn | **3** | ~$0.01–0.02 | ~45% |
| Web search inside a turn | per turn | 0 | ~$0.005 | bundled |
| Image — standard | per image | **2** | $0.02–0.04 | ~40% |
| Image — premium / 4K | per image | **5** | $0.05–0.09 | ~40% |
| Video — 5s 720p | per clip | **20** | $0.15–0.25 | ~25% |
| Video — 5s 1080p | per clip | **35** | $0.30–0.45 | ~25% |
| Video — 10s 1080p | per clip | **60** | $0.55–0.75 | ~25% |
| Deep research run | per run | **8** | $0.05–0.10 | ~40% |
| Slides deck (premium, ≤12 slides) | per deck | **6** | $0.03–0.06 | ~40% |
| Document / spreadsheet generation | per file | **2** | $0.01–0.02 | ~50% |
| Voice — TTS | per 1,000 chars | **1** | $0.005–0.015 | ~40% |
| Voice — STT | per minute | **1** | $0.004–0.01 | ~50% |
| Music track | per track | **10** | $0.05–0.08 | ~40% |
| Agent task — start | per task | **1** | $0.005 | — |
| Agent task — per tool step | per step | **0.5**, capped 40/task | $0.003–0.01 | ~40% |
| Browser / computer use | per minute | **2** | $0.01–0.02 | ~40% |
| Code / sandbox run | per minute | **1** | $0.004–0.01 | ~50% |

Design rules baked in:

1. **Every action is metered — chat included.** There is no unlimited surface anywhere in the
   product. A message costs credits exactly like an image or a clip, and the balance visibly
   moves with every turn, so the unit is anchored to the thing users do most.
2. **One asset = one price.** No action may have two prices; the model catalogue references an
   `action_key`, it never carries its own price.
3. **Charge on success, refund automatically on failure** — keep `charge_credits_once` +
   `refund_credits_once`, make them the only write path.
4. **Fractional steps are allowed internally** (0.5 MC/step) but the customer only ever sees whole
   credits on the pricing page.

## 4. Proposed allowance per plan (the number to give a subscriber)

Recommendation — three options, with the recommended one in bold:

| Plan | Price (unchanged) | Today | Option A (lean) | **Option B (recommended)** | Option C (generous) |
|---|---|---|---|---|---|
| Free | $0 | 5 MC/day + 3 images/12h | 5 MC/day (150/mo) | **5 MC/day + 3 images/12h** | 8 MC/day |
| Pro monthly | $15 (first month $7) | 1,000 MC | 1,000 MC | **1,500 MC / month** | 2,000 MC |
| Pro yearly | $120 | 12,000 MC | 12,000 MC | **18,000 MC / year** (1,500/mo) | 24,000 MC |
| Max monthly | $40 (first month $17) | 600 MC (broken) | 4,000 MC | **6,000 MC / month** | 8,000 MC |
| Max yearly | $320 | 9,000 MC (broken) | 48,000 MC | **72,000 MC / year** (6,000/mo) | 96,000 MC |

Why **1,500 MC on Pro**:

- $15 ÷ 1,500 = **$0.010 per credit**, matching the published anchor exactly.
- It buys a meaningful, easy-to-say mix: **1,500 chat messages**, or **750 images**, or **75 short
  videos**, or **187 deep research runs** — or any combination.
- At a realistic 40–50% utilisation the blended provider cost lands near $6–7 on a $15 plan,
  keeping gross margin above 55%.
- 1,000 → 1,500 is a 50% headline increase that costs us nothing until the credits are actually
  spent, and it removes the main objection to the current plan ("1,000 credits sounds like a lot
  until you make a few videos").

Why **6,000 MC on Max**: today's 600 credits for $40 is 15× smaller than what the price implies;
6,000 gives $0.0067 per credit, a real reason to move up, and still sits above the yearly Pro rate.

### Top-up packs (keep the existing three, fix the ladder)

| Pack | Price | MC | $/credit | Rule |
|---|---|---|---|---|
| Starter | $9 | 500 | 0.018 | entry |
| Plus | $19 | 1,200 | 0.0158 | — |
| Pro | $39 | 3,000 | 0.013 | best value |

**Packs must never be cheaper per credit than the yearly plan** ($0.01). Keeping the ladder above
that line protects subscription value; the current 3,000-pack at $0.013 already respects it.

## 5. Rules that make credits feel fair (and stop support tickets)

1. **Purchased credits never expire.** Plan credits refresh with the subscription; daily credits
   refresh daily and do not stack (keep today's behaviour, state it plainly).
2. **Rollover:** unused plan credits roll over for one month, capped at one month's allowance.
   This is the single most requested fairness feature in credit products.
3. **Every charge is itemised** in the usage screen: action, model, credits, timestamp, and the
   operation key. Today only aggregates are shown.
4. **Failed generations refund automatically within minutes** (already implemented — surface it in
   the UI as a visible event).
5. **A pre-flight estimate before every expensive action** ("This video will cost 35 MC — you have
   1,240 MC") with a one-tap confirm above a threshold (e.g. ≥20 MC).
6. **A visible low-balance state** at 20% and 5%, with a one-tap top-up sheet.
7. **Refunds policy in credits, not percentages:** "Unused credits are refundable within 7 days"
   is easier to police and explain than "less than 10% consumed".
8. **Referral reward scales with the plan:** 20 MC for a free signup, 200 MC when the referred user
   becomes a paying subscriber — cheap acquisition, real incentive.

## 6. What has to change in the codebase

1. Create `credit_costs` and seed it with the table above; delete the three hardcoded price sources.
2. One RPC `spend_credits(action_key, operation_key, meta)` replacing direct calls in
   `media-video`, `media-video/image.ts`, `media-video/agent.ts`, `anything-api`.
3. `consume_video_quota` becomes a plan-gate only (allowed / not allowed) and stops returning a
   price; the price comes from `credit_costs`.
4. `daily_credit_allowance()` and the hardcoded `daily_allowance: 5` in `get_credit_overview()`
   become plan-aware.
5. Unify the two image paths so one action key covers both.
6. Fix the Max tier rows (`elite`) to 6,000 / 72,000 before re-activating them.
7. Usage screen: itemised history + estimate + low-balance prompts.
8. Add `provider_cost_usd` tracking so margin per action is measurable, not guessed.

## 7. Migration path (safe, no downtime)

1. Ship `credit_costs` + the unified RPC and route **one** action (video) through it; compare
   charges against the old path in `credit_transactions`.
2. Move image, slides, agent, research one at a time; keep the old code behind the same operation
   keys so no user is double-charged.
3. Switch the allowance numbers at the start of a billing cycle; grant existing Pro subscribers a
   one-time goodwill top-up equal to the difference.
4. Update the pricing page, FAQ and usage screen in the same release as the numbers.
