/** @doc The agents half of the chat page — a clean grid of agent marks and names.
 * Tapping one hands the next message to that agent and returns to the conversation. */
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Loader2, Search } from "lucide-react";
import { AgentIcon } from "@/components/agent/AgentIcon";
import { AgentOrb } from "@/components/agent/AgentOrb";
import { loadWorkspace, useWorkspaceStore } from "@/lib/agentsky/store";
import type { AgentColor, AgentInfo } from "@/lib/agentsky/client";

/* Each agent carries its own hue, exactly like the agents directory. */
const TINT: Record<AgentColor, string> = {
  aurora: "var(--settings-violet)",
  ocean: "var(--settings-blue)",
  ember: "var(--settings-red)",
  mint: "var(--settings-green)",
  sun: "var(--settings-yellow)",
  rose: "var(--settings-pink)",
  mono: "var(--settings-muted)",
};

export function ChatAgentsPanel({
  activeAgentId,
  onPick,
  onManage,
}: {
  activeAgentId?: string | null;
  onPick: (agent: AgentInfo) => void;
  onManage: () => void;
}) {
  const { agents, ready } = useWorkspaceStore();
  const [query, setQuery] = useState("");

  useEffect(() => {
    void loadWorkspace();
  }, []);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...agents].sort((a, b) => Number(!!b.isDefault) - Number(!!a.isDefault));
    if (!q) return sorted;
    return sorted.filter((a) =>
      `${a.name} ${a.description ?? ""}`.toLowerCase().includes(q),
    );
  }, [agents, query]);

  return (
    <section className="cap-panel md:hidden" data-testid="chat-agents-panel">
      <style>{PANEL_CSS}</style>
      <div className="cap-inner">
        <div className="cap-hero">
          <span className="cap-hero-orb">
            <AgentOrb size={46} />
          </span>
          <div className="cap-hero-text">
            <h1 className="cap-title">Agents</h1>
            <p className="cap-sub">Pick an agent and Megsy hands the work to it.</p>
          </div>
        </div>

        <div className="cap-search">
          <Search aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search agents"
            aria-label="Search agents"
          />
        </div>

        {!ready ? (
          <div className="cap-loading">
            <Loader2 className="cap-spin" />
          </div>
        ) : list.length === 0 ? (
          <p className="cap-empty">No agents found.</p>
        ) : (
          <div className="cap-grid">
            {list.map((agent) => {
              const active = agent.id === activeAgentId;
              const tint = TINT[agent.color] ?? TINT.mono;
              const hint = agent.isDefault
                ? "Your everyday partner"
                : agent.mediaOnly
                  ? "Image and video creation"
                  : agent.description || "Personal AI agent";
              return (
                <button
                  key={agent.id}
                  type="button"
                  className="cap-tile"
                  data-active={active ? "true" : "false"}
                  onClick={() => onPick(agent)}
                  aria-label={`Chat with ${agent.name}`}
                >
                  <span
                    className="cap-tile-icon"
                    style={{
                      background: `color-mix(in oklch, ${tint} 14%, transparent)`,
                      boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${tint} 24%, transparent)`,
                    }}
                  >
                    <AgentIcon agent={agent} size={26} />
                  </span>
                  <span className="cap-tile-name">{agent.name}</span>
                  <span className="cap-tile-hint">{hint}</span>
                </button>
              );
            })}
          </div>
        )}

        <button type="button" className="cap-manage" onClick={onManage}>
          Manage agents
          <ChevronRight strokeWidth={2} />
        </button>
      </div>
    </section>
  );
}

const PANEL_CSS = `
.cap-panel {
  position: absolute; inset: 0; z-index: 35; overflow-y: auto; overscroll-behavior: contain;
  background: hsl(var(--background)); color: hsl(var(--foreground));
  padding: calc(env(safe-area-inset-top) + 66px) 16px calc(env(safe-area-inset-bottom) + 28px);
}
.cap-inner { max-width: 640px; margin: 0 auto; }
.cap-title { margin: 6px 0 0; font-size: 26px; font-weight: 700; letter-spacing: -.02em; }
.cap-sub { margin: 4px 0 16px; font-size: 13.5px; color: hsl(var(--foreground) / 0.55); }

.cap-search { position: relative; display: flex; align-items: center; margin-bottom: 16px; }
.cap-search > svg {
  position: absolute; inset-inline-start: 14px; width: 16px; height: 16px;
  color: hsl(var(--foreground) / 0.45); pointer-events: none;
}
.cap-search > input {
  width: 100%; height: 44px; padding: 0 14px 0 38px; border-radius: 999px;
  border: 1px solid hsl(var(--foreground) / 0.1); background: hsl(var(--foreground) / 0.04);
  color: hsl(var(--foreground)); font: inherit; font-size: 14.5px; outline: none;
}
.cap-search > input::placeholder { color: hsl(var(--foreground) / 0.45); }
.cap-search > input:focus-visible { border-color: hsl(var(--foreground) / 0.25); }

.cap-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.cap-tile {
  position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: 2px;
  padding: 14px 13px 13px; border: 0; cursor: pointer; font: inherit; color: inherit;
  text-align: start; border-radius: 20px; background: hsl(var(--foreground) / 0.045);
  box-shadow: inset 0 0 0 1px hsl(var(--foreground) / 0.07);
  transition: transform .16s ease, background .2s ease, box-shadow .2s ease;
  -webkit-tap-highlight-color: transparent;
}
.cap-tile:active { transform: scale(.975); }
.cap-tile[data-active="true"] {
  background: hsl(var(--foreground) / 0.08);
  box-shadow: inset 0 0 0 1.5px hsl(var(--foreground) / 0.3);
}
.cap-hero { display: flex; align-items: center; gap: 13px; margin: 2px 0 16px; }
.cap-hero-orb {
  width: 52px; height: 52px; flex: none; display: grid; place-items: center;
  border-radius: 18px; background: hsl(var(--foreground) / 0.05);
  box-shadow: inset 0 0 0 1px hsl(var(--foreground) / 0.07);
}
.cap-hero-text { min-width: 0; }
.cap-hero-text .cap-title { margin: 0; }
.cap-tile-icon {
  width: 42px; height: 42px; display: grid; place-items: center; margin-bottom: 8px;
  border-radius: 14px;
}
.cap-tile-name {
  font-size: 14px; font-weight: 620; letter-spacing: -.01em; line-height: 1.3;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%;
}
.cap-tile-hint {
  font-size: 11.5px; line-height: 1.35; color: hsl(var(--foreground) / 0.5);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}

.cap-loading { display: grid; place-items: center; padding: 40px 0; }
.cap-spin { width: 18px; height: 18px; animation: cap-spin 1s linear infinite; }
@keyframes cap-spin { to { transform: rotate(360deg); } }
.cap-empty { text-align: center; font-size: 13.5px; color: hsl(var(--foreground) / 0.5); padding: 30px 0; }

.cap-manage {
  margin: 18px auto 0; display: flex; align-items: center; justify-content: center; gap: 6px;
  width: 100%; height: 46px; border: 0; border-radius: 999px; cursor: pointer;
  background: hsl(var(--foreground) / 0.05); color: hsl(var(--foreground));
  font: inherit; font-size: 13.5px; font-weight: 600;
  box-shadow: inset 0 0 0 1px hsl(var(--foreground) / 0.08);
}
.cap-manage > svg { width: 16px; height: 16px; opacity: .6; }
.cap-manage:active { transform: scale(.98); }
`;
