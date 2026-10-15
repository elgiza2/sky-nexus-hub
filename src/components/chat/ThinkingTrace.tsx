import { memo, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import MegsyStar from "@/components/branding/MegsyStar";
import { useUserLang } from "@/lib/authI18n";

export interface ThinkingTraceProps {
  /** Live status line — always the real current operation, never a placeholder. */
  status?: string;
  /** Ordered narration steps (deep research, tools, slides, media…). */
  steps?: string[];
  /** Raw reasoning tokens from the model. */
  text?: string;
  /** True while the turn is still running. */
  active?: boolean;
  /**
   * True only while a tool call is really executing. Kept for API
   * compatibility — the spinner animates while `active` is true.
   */
  running?: boolean;
  /** Kept for API compatibility; no longer drives icons. */
  tool?: string | null;
  /**
   * "tools" renders the used-tools timeline after the run ends.
   */
  variant?: "default" | "tools";
  /** Start expanded (rarely needed — collapsed is the default look). */
  defaultOpen?: boolean;
  className?: string;
}

const RTL_LANGS = new Set(["ar", "ar-eg", "fa", "he"]);

/**
 * The single "AI thinking" surface used across chat, deep research, slides,
 * media and tool turns.
 *
 * Redesign goals (from user feedback):
 * - One quiet row: spinner + one live headline + step count, nothing else.
 * - No icon-per-step parade, no shimmer, no raw reasoning wall while running.
 * - The finished trace collapses to a single expandable summary line.
 * - Raw reasoning text is never shown verbatim — only clean activity steps.
 */
const ThinkingTrace = ({
  status,
  steps,
  text,
  active,
  variant = "default",
  defaultOpen,
  className = "",
}: ThinkingTraceProps) => {
  const lang = useUserLang();
  const [open, setOpen] = useState(!!defaultOpen);
  const rtl = RTL_LANGS.has(lang);
  const isAr = lang.startsWith("ar");

  // Keep every distinct line we ever saw this turn, so expanding the badge
  // always shows the real trace instead of an empty panel.
  const historyRef = useRef<string[]>([]);
  const [, forceRender] = useState(0);
  useEffect(() => {
    const incoming: string[] = [];
    for (const s of steps || []) {
      const v = String(s || "").trim();
      if (v) incoming.push(v);
    }
    const st = String(status || "").trim();
    if (st) incoming.push(st);
    let changed = false;
    for (const line of incoming) {
      const h = historyRef.current;
      if (h[h.length - 1] !== line && !h.includes(line)) {
        h.push(line);
        changed = true;
      }
    }
    if (historyRef.current.length > 60) {
      historyRef.current = historyRef.current.slice(-60);
      changed = true;
    }
    if (changed) forceRender((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps, status]);

  // Raw stream lines can carry tool markers or JSON fragments — never show
  // those. Also collapse whitespace so the trace reads as clean sentences.
  const clean = (raw: string): string => {
    let v = String(raw || "")
      .replace(/\[\[MEGSY_ESCALATE_TO_FULL_CHAT(?::[a-z0-9_-]+)?\]\]/gi, " ")
      .replace(/<\/?[a-z_]+(?:\s[^>]*)?>/gi, " ")
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/[*_`#]+/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (/^[[{]/.test(v) || /"(tool_call|function_call|arguments|parameters)"/.test(v)) return "";
    if (/^(we need to generate|i will|i am currently)/i.test(v)) return "";
    if (v.length > 160) v = `${v.slice(0, 160)}…`;
    return v;
  };

  // Reasoning tokens are folded into the step list only as a last resort:
  // while the turn runs we prefer the live status; after it settles we show
  // at most 3 short lines so the panel never becomes a reasoning wall.
  const reasoningLines = useMemo(() => {
    if (!text?.trim()) return [] as string[];
    const out: string[] = [];
    for (const p of text.trim().split(/\n{2,}|\n/)) {
      const v = clean(p);
      if (v && out[out.length - 1] !== v) out.push(v);
      if (out.length >= 3) break;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const stepLines = useMemo(() => {
    const out: string[] = [];
    for (const raw of historyRef.current) {
      const v = clean(raw);
      if (v && !out.includes(v)) out.push(v);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyRef.current.length]);

  const lines = useMemo(
    () => [...stepLines, ...(stepLines.length ? [] : reasoningLines)],
    [stepLines, reasoningLines],
  );

  const hasBody = lines.length > 0;
  if (!hasBody && !active) return null;

  // Live headline: newest real signal wins, capped at one short line.
  const headline = useMemo(() => {
    const live =
      String(status || "").trim() ||
      historyRef.current[historyRef.current.length - 1] ||
      reasoningLines[reasoningLines.length - 1] ||
      "";
    const cleaned = clean(live);
    if (cleaned) return cleaned.length > 80 ? `${cleaned.slice(0, 80)}…` : cleaned;
    return isAr ? "جارٍ التفكير…" : "Thinking…";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, status, reasoningLines, historyRef.current.length, isAr]);

  const countLabel =
    stepLines.length > 0
      ? isAr
        ? ` · ${stepLines.length} ${stepLines.length === 1 ? "خطوة" : "خطوات"}`
        : ` · ${stepLines.length} ${stepLines.length === 1 ? "step" : "steps"}`
      : "";
  const summary = active
    ? `${headline}${countLabel}`
    : isAr
      ? `التفكير${countLabel}`
      : `Thoughts${countLabel}`;

  return (
    <div
      className={`mb-2 min-w-0 overflow-hidden rounded-xl border border-border/40 bg-muted/30 px-3 py-2 ${className}`}
      dir={rtl ? "rtl" : undefined}
      data-tool-timeline={variant === "tools" ? true : undefined}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 text-start"
      >
        {active ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden />
        ) : (
          <MegsyStar className="h-3.5 w-3.5 shrink-0 opacity-70" />
        )}
        <span className="min-w-0 flex-1 truncate text-[12.5px] text-muted-foreground" aria-live="polite">
          {summary}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-muted-foreground/70 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open && lines.length > 0 && (
        <ol className="mt-2 flex min-w-0 flex-col gap-1.5 border-t border-border/40 pt-2">
          {lines.map((line, i) => (
            <li
              key={`t-${i}-${line.slice(0, 24)}`}
              className="flex min-w-0 items-start gap-2 text-[12.5px] leading-relaxed text-muted-foreground"
            >
              <span
                aria-hidden
                className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50"
              />
              <span className="min-w-0 flex-1 break-words">{line}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};

export default memo(ThinkingTrace);
