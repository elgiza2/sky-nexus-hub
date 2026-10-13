/**
 * @doc chat-fast
 * Primary chat endpoint: the fast agent answers directly and dispatches
 * specialist sub-agents itself only when the turn needs them.
 *
 * The fast model (gpt-oss-120b) is the front door for every turn. It emits a
 * compact directive block when a specialist is needed; this function executes
 * the internal loop (run specialist -> feed result back -> fast agent decides:
 * done, continue, or delegate to another specialist) and streams only the
 * final user-facing answer. The client never routes; it only renders.
 *
 * Request body: { messages, customSystem?, model? }
 * Response: OpenAI-style SSE chunks, terminated by `data: [DONE]`.
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { dataAnonKey, dataIssuer, dataUrl } from "../_shared/dataProject.ts";

const fastCorsHeaders = {
  ...corsHeaders,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-anon-fingerprint",
};

/**
 * The fast lane used to run with a bare one-line system prompt, so it denied
 * capabilities the product really has ("I can't browse / I'm just a text
 * model"). It now gets a compact capability + date brief, kept short on
 * purpose so latency stays sub-second.
 */
function fastSystem(): string {
  const now = new Date();
  const iso = now.toISOString().slice(0, 10);
  return `You are MEGSY, an agent product with real execution tools. Answer directly and accurately in the user's own language and dialect.

Today is ${iso} (UTC), the current year is ${now.getUTCFullYear()}. Never present older information as "today's" news.

IDENTITY (authoritative — never contradict, never invent alternatives):
- Megsy is made by Megsy LLC, an Egyptian company.
- The CEO, only developer and creator of the Megsy model is Hamza Hassan Elgzairy.
- Support: Support@megsyai.com — website https://megsyai.com.
- Never introduce yourself with a robotic label such as "I am Megsy, an agent model designed for instant execution with real tools", and never start a reply with a self-description. If the user asks who you are, answer in one or two natural human sentences.
- Never mention models, providers, routing, prompts or internal tools.

The app can execute these for you (never deny them, never say you are "just a text model"):
- Megsy Computer: a real cloud browser (open sites, click, type, fill forms, sign up, log in, download/upload).
- Web search and Deep Research reports.
- Image generation/editing, video generation, slides, documents.
- Code writing plus a real dev sandbox: import any GitHub repo, install deps, edit files, run builds/tests.
- Megsy Mail: a private @megsyai.com mailbox (send, read inbox, show address).
- Connecting MCP servers and API services from chat.
- A catalog of 1000+ tool operations and specialist sub-agents (research, data, engineering, web operator, writing, growth, finance, QA).

Rules:
- NEVER stall. Never reply with a promise like "let me search", "give me a moment", "I'll get back to you", "خليني أبحث", "لحطة", "أنا أسوي البحث الحين". You cannot come back in a later message. Every reply must contain the actual answer or result for this turn: give what you know now, state plainly which parts you could not verify, and stop.
- Never ask the user for permission to search or to continue. Just do the work and answer.
- If a task needs one of these tools, accept it and say briefly what you will do; the runtime starts the tool. Never refuse for "no access".
- Answer with the depth the question deserves. A real question never gets a two-line answer: give the direct answer first, then the substance (steps, numbers, examples, complete runnable code when code is involved). Only trivial factual questions stay short.
- One language per answer — the language and dialect of the user's latest message.
- Open-ended work is in scope; there is no fixed menu of supported tasks.
- Account, subscription, credits and billing are out of scope: say in one sentence that you can't see account details and point to the Billing page.
- Do not list these capabilities unless the user asks what you can do.
- Never expose internal logs, checkpoints, step ids or debug text.

ORCHESTRATION (you are the coordinator, not just an answerer):
- You lead an internal team: researcher, coder, analyst, writer, operator, designer, reviewer. The user never sees them.
- When a turn needs specialist work, do NOT answer from memory. Instead emit a directive block FIRST, then stop — the runtime executes it and returns the result to you:
  :::TASK agent="<one of: researcher|coder|analyst|writer|operator|designer|reviewer>" goal="<self-contained instruction, no reference to other tasks>" :::
- Rules for directives:
  - Simple chat, greetings, opinions, explanations from knowledge: answer directly, NO directive.
  - Live facts, prices, news, browsing, code, files, media, multi-step work: emit 1-3 directive blocks (parallel when independent).
  - Each goal must be self-contained: include the exact question, constraints, and what to return.
- When you receive a RESULT block, decide: DONE (write the final user-facing answer now), CONTINUE (emit another directive), or HANDOFF (emit a directive to a different specialist using the previous result).
- The final answer never mentions agents, directives, loops, or results — just the polished answer in the user's language.`;
}


// Route obvious tool/task requests before contacting the model. This keeps the
// model stream safe to paint immediately instead of buffering its first tokens.
// Kept deliberately narrow: every false positive costs the user a full-path
// round trip (seconds) on a turn the fast model could have answered instantly.
const COMPLEX_INTENT =
  /(?:https?:\/\/|ابحث|بحث (?:في|على) (?:الويب|النت)|الطقس|طقس|الأخبار|اخبار|سعر (?:اليوم|الآن)|افتح (?:موقع|رابط)|شغ[ّ]?ل (?:كود|أمر)|نف[ّ]?ذ|أنشئ (?:صورة|فيديو|ملف|عرض|جدول)|اصنع (?:صورة|فيديو)|ارسل (?:بريد|إيميل)|التقويم|اربط|تكامل|مرفق|browse|search (?:the )?web|weather|latest news|run (?:code|command)|terminal|send (?:an )?email|(?:generate|create|make|draw|render)\s+(?:an?\s+)?(?:image|video|audio|clip|picture|poster|pdf|slide)|connector|integration)/i;

function needsFullChat(messages: Msg[]): boolean {
  const lastUser = [...messages].reverse().find((message) => message.role === "user");
  return typeof lastUser?.content === "string" && COMPLEX_INTENT.test(lastUser.content);
}

/**
 * Identity in the fast lane must never rest on an *unverified* JWT payload:
 * `atob` decoding alone lets anyone forge a `sub` and impersonate a user.
 *
 * Contract:
 *  - the payload is decoded locally for claim sanity checks (exp/iss/role/sub),
 *  - the signature is confirmed against the auth server, but only via a cached
 *    result so the hot path stays free of network round trips,
 *  - an unverified token is downgraded to *guest*, never trusted as a user.
 */
type Claims = { sub?: string; exp?: number; iss?: string; role?: string };

function decodeClaims(token: string): Claims | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const claims = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/"))) as Claims;
    if (!claims.exp || claims.exp * 1000 < Date.now()) return null;
    if (typeof claims.sub !== "string" || !claims.sub) return null;
    if (claims.role && claims.role !== "authenticated") return null;
    const expectedIss = dataIssuer();
    if (claims.iss && expectedIss && claims.iss !== expectedIss) return null;
    return claims;
  } catch {
    return null;
  }
}

/** token -> { userId, until } for signature-verified tokens only. */
const verified = new Map<string, { userId: string; until: number }>();
const inflight = new Set<string>();

async function confirmSignature(token: string, expectedSub: string): Promise<void> {
  if (inflight.has(token)) return;
  inflight.add(token);
  try {
    const url = dataUrl();
    const anon = dataAnonKey();
    if (!url || !anon) return;
    const r = await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, {
      headers: { apikey: anon, Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return;
    const body = (await r.json()) as { id?: string };
    if (body?.id && body.id === expectedSub) {
      if (verified.size > 2000) verified.clear();
      verified.set(token, { userId: body.id, until: Date.now() + 10 * 60 * 1000 });
    }
  } catch {
    // network blip: stay in guest mode, retry on the next turn
  } finally {
    inflight.delete(token);
  }
}

/** Returns the user id only when the token's signature was already verified. */
function verifiedUserId(token: string): string | null {
  const claims = decodeClaims(token);
  if (!claims?.sub) return null;
  const hit = verified.get(token);
  if (hit && hit.until > Date.now()) return hit.userId;
  verified.delete(token);
  void confirmSignature(token, claims.sub);
  return null;
}


/**
 * Guest budget: signed-out visitors chat freely, but within limits so the fast
 * lane can't be farmed. Sliding window per fingerprint/IP bucket.
 */
const GUEST_WINDOW_MS = 60 * 60 * 1000;
const GUEST_MAX_PER_WINDOW = 25;
const GUEST_MAX_PER_MINUTE = 6;
const guestHits = new Map<string, number[]>();

function guestAllowance(bucket: string): { ok: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  if (guestHits.size > 5000) guestHits.clear();
  const hits = (guestHits.get(bucket) || []).filter((t) => now - t < GUEST_WINDOW_MS);
  const lastMinute = hits.filter((t) => now - t < 60_000);
  if (lastMinute.length >= GUEST_MAX_PER_MINUTE) {
    guestHits.set(bucket, hits);
    return { ok: false, retryAfterSeconds: 30 };
  }
  if (hits.length >= GUEST_MAX_PER_WINDOW) {
    guestHits.set(bucket, hits);
    const oldest = hits[0] ?? now;
    return { ok: false, retryAfterSeconds: Math.max(30, Math.ceil((GUEST_WINDOW_MS - (now - oldest)) / 1000)) };
  }
  hits.push(now);
  guestHits.set(bucket, hits);
  return { ok: true, retryAfterSeconds: 0 };
}

import { AGENT_MODEL, callAgentFallback, hasAgentProvider } from "../_shared/agentFallback.ts";
import { callCerebras, CEREBRAS_MODELS } from "../_shared/cerebras.ts";
import { hasModelProvider } from "../_shared/abliteration.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/** Service-role client used only to read the rotatable model key pool. */
function admin() {
  const url = dataUrl();
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !key) return null;
  try {
    return createClient(url, key, { auth: { persistSession: false } }) as any;
  } catch {
    return null;
  }
}


type Msg = { role: string; content: unknown };

/** Specialist personas the coordinator can dispatch to. Compact on purpose. */
const SPECIALISTS: Record<string, string> = {
  researcher: "You are the Researcher. Answer only from the supplied context, cite facts [n], end with a numbered source list with URLs. Under 350 words.",
  coder: "You are the Engineer. Output complete runnable code in fenced blocks with the file path on the fence line. No pseudo-code. Under 500 words plus code.",
  analyst: "You are the Analyst. Show decisive steps compactly, state formulas, quantify with units, end with the recommendation. Under 350 words.",
  writer: "You are the Writer. Deliver publication-ready prose in the requested format and tone. No meta commentary. Match the requested length.",
  operator: "You are the Operator. Decompose the goal, sequence steps, report what ran with results. Never fabricate an outcome. Under 350 words.",
  designer: "You are the Designer. Deliver concrete specs (tokens, spacing, states) and Tailwind/React markup with semantic tokens. Under 350 words plus code.",
  reviewer: "You are the Reviewer. Output a short verdict then only concrete defects with fixes. Under 300 words.",
};

type Directive = { agent: string; goal: string };

const DIRECTIVE_RE = /:::TASK\s+agent="([a-z]+)"\s+goal="((?:[^"\\]|\\.)*)"\s*:::/g;

/** Extracts :::TASK directives the coordinator emitted. Unknown agents map to general. */
function parseDirectives(text: string): Directive[] {
  const out: Directive[] = [];
  let match: RegExpExecArray | null;
  DIRECTIVE_RE.lastIndex = 0;
  while ((match = DIRECTIVE_RE.exec(text)) !== null && out.length < 3) {
    const agent = (match[1] || "general").toLowerCase();
    const goal = (match[2] || "").replace(/\\"/g, '"').trim().slice(0, 800);
    if (goal.length > 8) out.push({ agent: SPECIALISTS[agent] ? agent : "general", goal });
  }
  return out;
}

/** Removes directive blocks so they never leak into the user-facing answer. */
function stripDirectives(text: string): string {
  return text.replace(/:::TASK[\s\S]*?:::/g, "").trim();
}

/** Runs one specialist as a bounded non-streaming worker, returns its brief. */
async function runSpecialist(
  task: Directive,
  transcript: Msg[],
  system: string,
  db: ReturnType<typeof admin>,
): Promise<string> {
  const persona = SPECIALISTS[task.agent] ??
    "You are the Generalist. Answer directly and completely at the depth the question deserves. Under 350 words.";
  const history = transcript.filter((m) => typeof m.content === "string").slice(-6)
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${String(m.content).slice(0, 1500)}`)
    .join("\n");
  const res = await callCerebras([CEREBRAS_MODELS.fast], {
    model: CEREBRAS_MODELS.fast,
    stream: false,
    reasoning_effort: "low",
    temperature: 0.4,
    max_tokens: 1200,
    messages: [
      { role: "system", content: `${persona}\n\nYou are a worker inside an internal team. Deliver ONLY your assigned part as a dense brief. No greetings, no questions back.` },
      { role: "user", content: `${history ? `Conversation so far:\n${history}\n\n` : ""}Your assigned part: ${task.goal}` },
    ],
  }, "fast", db);
  const body = await res?.response?.json().catch(() => null) as {
    choices?: Array<{ message?: { content?: string } }>;
  } | null;
  const brief = String(body?.choices?.[0]?.message?.content ?? "").trim().slice(0, 3000);
  return brief ? `### ${task.agent} — ${task.goal}\n${brief}` : "";
}

const sseEncoder = new TextEncoder();

/** Streams an already-produced final answer as OpenAI-compatible SSE. */
function streamFinalAnswer(text: string, model: string): Response {
  const id = `chatcmpl-fast-${crypto.randomUUID()}`;
  const created = Math.floor(Date.now() / 1000);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (data: string) => controller.enqueue(sseEncoder.encode(data));
      for (let i = 0; i < text.length; i += 300) {
        send(`data: ${JSON.stringify({ id, object: "chat.completion.chunk", created, model, choices: [{ index: 0, delta: { role: "assistant", content: text.slice(i, i + 300) }, finish_reason: null }] })}\n\n`);
      }
      send(`data: ${JSON.stringify({ id, object: "chat.completion.chunk", created, model, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\n`);
      send("data: [DONE]\n\n");
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: {
      ...fastCorsHeaders,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "x-model-used": model,
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: fastCorsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...fastCorsHeaders, "Content-Type": "application/json" },
    });
  }

  // Guests may chat without signing in. Identity is best-effort: a verified
  // user id, else a guest bucket keyed by fingerprint or client IP. Guests are
  // never blocked outright — only rate limited (see `guestAllowance`).
  const anonKey = dataAnonKey();
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const isAppToken = Boolean(token) && token !== anonKey;
  const userId = isAppToken ? verifiedUserId(token) : null;

  if (!userId) {
    const bucket =
      req.headers.get("x-anon-fingerprint") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "anon";
    const allowance = guestAllowance(bucket);
    if (!allowance.ok) {
      return new Response(
        JSON.stringify({
          error: "Guest limit reached. Sign in to keep chatting.",
          code: "guest_limit",
          retryAfterSeconds: allowance.retryAfterSeconds,
        }),
        {
          status: 429,
          headers: {
            ...fastCorsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(allowance.retryAfterSeconds),
          },
        },
      );
    }
  }



  if (!hasModelProvider() && !hasAgentProvider()) {
    // No fast-lane credentials: tell the client to use the full chat path.
    return new Response(JSON.stringify({ escalate: true, reason: "fast_lane_unconfigured" }), {
      status: 503,
      headers: { ...fastCorsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: {
    messages?: Msg[];
    customSystem?: string;
    model?: string;
    force?: boolean;
    maxTokens?: number;
    thinking?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...fastCorsHeaders, "Content-Type": "application/json" },
    });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0 || messages.length > 40) {
    return new Response(JSON.stringify({ escalate: true, reason: "unsupported_message_count" }), {
      status: 200,
      headers: { ...fastCorsHeaders, "Content-Type": "application/json" },
    });
  }
  // Text-only fast lane: anything richer goes to the full chat function.
  for (const m of messages) {
    if (typeof m?.content !== "string") {
      return new Response(JSON.stringify({ escalate: true, reason: "non_text_content" }), {
        status: 200,
        headers: { ...fastCorsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  if (!body.force && needsFullChat(messages)) {
    return new Response(JSON.stringify({ escalate: true, reason: "complex_intent" }), {
      status: 200,
      headers: { ...fastCorsHeaders, "Content-Type": "application/json" },
    });
  }

  const system = [fastSystem(), typeof body.customSystem === "string" ? body.customSystem : ""]
    .filter(Boolean)
    .join("\n\n");

  // Thinking follows the user's composer toggle. Machine callers (dev agent)
  // and users with the toggle off get the fastest possible first token.
  const thinking = body.thinking === true;

  const payload = {
    model: CEREBRAS_MODELS.fast,
    // Non-streaming first pass: the coordinator may emit :::TASK directives
    // instead of a user-facing answer. Only the final answer streams.
    stream: false,
    stream_options: { include_usage: true },
    // gpt-oss-120b accepts reasoning_effort; "low" is the fastest first-token
    // setting Cerebras accepts. cerebrasPayload() forwards it only to this
    // model and drops it for ids that reject it.
    reasoning_effort: "low",
    temperature: 0.6,
    // Replies must not be clipped into three-line answers: signed-in users get
    // room for a full answer, guests a smaller but still useful budget.
    max_tokens: Math.min(Math.max(Number(body.maxTokens) || 4096, 512), userId ? 8192 : 2048),
    messages: [{ role: "system", content: system }, ...messages.slice(-16)],
  };


  // Internal orchestration loop: coordinator -> specialists -> coordinator.
  // Max 3 rounds so a turn never hangs; each round runs specialists in
  // parallel and feeds their briefs back for the DONE/CONTINUE decision.
  const db = admin();
  const transcript: Msg[] = [...messages.slice(-16)];
  let finalText: string | null = null;
  let streamModel: string = CEREBRAS_MODELS.fast;
  for (let round = 0; round < 3; round++) {
    const coord = await callCerebras(
      [CEREBRAS_MODELS.fast],
      { ...payload, messages: [{ role: "system", content: system }, ...transcript] },
      "fast",
      db,
    );
    const coordBody = await coord?.response?.json().catch(() => null) as {
      choices?: Array<{ message?: { content?: string } }>;
    } | null;
    const coordText = String(coordBody?.choices?.[0]?.message?.content ?? "").trim();
    if (!coordText) break;
    const tasks = parseDirectives(coordText);
    if (!tasks.length) {
      // No directives: this IS the user-facing answer. Stream it below.
      finalText = stripDirectives(coordText);
      streamModel = coord?.model ?? CEREBRAS_MODELS.fast;
      break;
    }
    // Run specialists in parallel, feed briefs back, let coordinator decide.
    const briefs = await Promise.all(
      tasks.slice(0, 3).map((task) => runSpecialist(task, transcript, system, db)),
    );
    const usable = briefs.filter(Boolean);
    if (!usable.length) {
      finalText = stripDirectives(coordText) || null;
      break;
    }
    transcript.push({ role: "assistant", content: coordText });
    transcript.push({
      role: "user",
      content: `RESULTS (internal — never quote as coming from agents):\n\n${usable.join("\n\n")}\n\nDecide: DONE (write the final user-facing answer now, no directives), CONTINUE (emit another :::TASK block), or HANDOFF (emit a :::TASK to a different specialist using these results).`,
    });
  }

  if (finalText) {
    return streamFinalAnswer(finalText, streamModel);
  }

  // Coordinator never produced a clean answer: stream one last direct pass so
  // the user always gets something instead of an escalation.
  const result = await callCerebras(
    [CEREBRAS_MODELS.fast],
    { ...payload, stream: true, messages: [{ role: "system", content: system }, ...messages.slice(-16)] },
    "fast",
    db,
  );
  const upstream = result?.response ?? null;

  if (!upstream || !upstream.body) {
    const fallback = await callAgentFallback(payload);
    if (fallback?.body) {
      return new Response(fallback.body, {
        status: 200,
        headers: {
          ...fastCorsHeaders,
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "x-model-used": AGENT_MODEL,
        },
      });
    }
    return new Response(JSON.stringify({ escalate: true, reason: "upstream_unavailable" }), {
      status: 200,
      headers: { ...fastCorsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      ...fastCorsHeaders,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "x-model-used": result?.model ?? CEREBRAS_MODELS.fast,
    },
  });
});
