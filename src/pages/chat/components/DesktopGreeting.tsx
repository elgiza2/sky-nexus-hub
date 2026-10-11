/** @doc Chat empty state: a living Megsy orb plus a line that types itself.
 *
 * The orb floats and breathes, and reacts when it is tapped — it wakes up, the
 * line changes, and the next idea starts typing. All copy is English.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { m as motion } from "framer-motion";
import { useLocation } from "react-router-dom";
import { AgentOrb, type OrbState } from "@/components/agent/AgentOrb";
import { useWorkspaceStore } from "@/lib/agentsky/store";

interface DesktopGreetingProps {
  userName: string | null | undefined;
  isFirstVisit: boolean;
  returningGreetingIdx: number;
}

/* Ideas the orb offers while it waits. */
const SUGGESTIONS = [
  "build me a landing page for my idea",
  "design a 10-slide pitch deck",
  "research any topic and cite the sources",
  "turn my photos into a short video",
  "write the code and run it for me",
  "plan my week and keep me on track",
  "write a launch post for my product",
  "compare the best options and pick one",
];

const TYPE_MS = 46;
const DELETE_MS = 22;
const HOLD_MS = 1700;

export const DesktopGreeting = ({ userName }: DesktopGreetingProps) => {
  const location = useLocation();
  const { agents, tier } = useWorkspaceStore();
  const agentId = new URLSearchParams(location.search).get("agent");
  const agent =
    (tier === "pro" ? agents.find((item) => item.id === agentId) : undefined) ??
    agents.find((item) => item.isDefault);

  const firstName = userName ? userName.split(" ")[0] : "";
  const agentName = agent?.name ?? "Megsy";

  const [presence, setPresence] = useState<OrbState>("hello");
  const [index, setIndex] = useState(() => Math.floor(Math.random() * SUGGESTIONS.length));
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<"typing" | "holding" | "deleting">("typing");
  const tappedRef = useRef(false);

  const line = useMemo(() => SUGGESTIONS[index % SUGGESTIONS.length], [index]);

  /* Wake up, settle down, then doze off — the orb is never frozen. */
  useEffect(() => {
    setPresence("hello");
    const settle = window.setTimeout(() => setPresence("idle"), 2600);
    const doze = window.setTimeout(() => setPresence("sleeping"), 20000);
    return () => {
      window.clearTimeout(settle);
      window.clearTimeout(doze);
    };
  }, [agent?.id]);

  /* Typewriter: type the idea, hold it, erase it, move to the next one. */
  useEffect(() => {
    if (phase === "typing") {
      if (typed.length >= line.length) {
        const hold = window.setTimeout(() => setPhase("holding"), 120);
        return () => window.clearTimeout(hold);
      }
      const tick = window.setTimeout(() => setTyped(line.slice(0, typed.length + 1)), TYPE_MS);
      return () => window.clearTimeout(tick);
    }
    if (phase === "holding") {
      const hold = window.setTimeout(() => setPhase("deleting"), HOLD_MS);
      return () => window.clearTimeout(hold);
    }
    if (!typed.length) {
      const next = window.setTimeout(() => {
        setIndex((value) => value + 1);
        setPhase("typing");
      }, 260);
      return () => window.clearTimeout(next);
    }
    const tick = window.setTimeout(() => setTyped((value) => value.slice(0, -1)), DELETE_MS);
    return () => window.clearTimeout(tick);
  }, [phase, typed, line]);

  /* Tapping the orb wakes it up and hands over the next idea. */
  const wake = useCallback(() => {
    tappedRef.current = true;
    setPresence("talking");
    setTyped("");
    setPhase("typing");
    setIndex((value) => value + 1);
    window.setTimeout(() => setPresence("idle"), 1500);
  }, []);

  return (
    <div className="relative z-[7] flex w-full items-center justify-center px-6 md:pb-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto flex max-w-2xl flex-col items-center text-center"
      >
        <motion.button
          type="button"
          onClick={wake}
          aria-label={`Wake ${agentName}`}
          className="relative mb-5 grid place-items-center p-4 md:mb-6"
          initial={{ opacity: 0, scale: 0.86 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          onPointerEnter={() => setPresence("hello")}
          onPointerLeave={() => setPresence(tappedRef.current ? "idle" : "hello")}
        >
          {/* Breathing aura behind the orb. */}
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute h-[132px] w-[132px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, color-mix(in oklch, var(--primary, #6d5efc) 34%, transparent) 0%, transparent 68%)",
              filter: "blur(14px)",
            }}
            animate={{ scale: [1, 1.14, 1], opacity: [0.5, 0.82, 0.5] }}
            transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.span
            className="relative block"
            animate={{ y: [0, -7, 0] }}
            transition={{ duration: 5.4, repeat: Infinity, ease: "easeInOut" }}
            whileTap={{ scale: 0.92 }}
          >
            <AgentOrb
              size={88}
              state={presence}
              color={agent?.isDefault || !agent ? "aurora" : (agent?.color ?? "aurora")}
            />
          </motion.span>
        </motion.button>

        <p className="mb-3 text-[15px] font-medium tracking-[-0.01em] text-foreground/85">
          {firstName ? `Hi ${firstName} — I'm ${agentName}.` : `Hi — I'm ${agentName}.`}
        </p>

        <p
          className="flex min-h-[1.6em] items-center justify-center gap-1.5 text-[13.5px] text-muted-foreground"
          aria-live="polite"
        >
          <span className="shrink-0">Try asking me to</span>
          <span className="font-medium text-foreground/90">{typed}</span>
          <motion.span
            aria-hidden="true"
            className="inline-block h-[1.05em] w-[2px] rounded-full bg-foreground/60"
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 1.05, repeat: Infinity, ease: "linear" }}
          />
        </p>
      </motion.div>
    </div>
  );
};

export default DesktopGreeting;
