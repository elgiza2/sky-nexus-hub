/** @doc The agents half of the chat page.
 *
 * Agents are personal specialists you talk to one-to-one — every one of them
 * owns a saved thread. Paid plans can also run several agents on the same
 * message (a team chat).
 */
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, Loader2, Search, Users } from "lucide-react";
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

function agentRole(agent: AgentInfo): string {
  if (agent.isDefault) return "Your everyday partner";
  if (agent.mediaOnly) return "Images and video";
  return agent.description || "Personal AI agent";
}

export function ChatAgentsPanel({
  activeAgentId,
  onPick,
  onPickTeam,
  onManage,
  isPro = false,
}: {
  activeAgentId?: string | null;
  onPick: (agent: AgentInfo) => void;
  onPickTeam?: (agents: AgentInfo[]) => void;
  onManage: () => void;
  isPro?: boolean;
}) {
  const { agents, ready } = useWorkspaceStore();
  const [query, setQuery] = useState("");
  const [teamMode, setTeamMode] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    void loadWorkspace();
  }, []);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...agents].sort((a, b) => Number(!!b.isDefault) - Number(!!a.isDefault));
    if (!q) return sorted;
    return sorted.filter((a) => `${a.name} ${a.description ?? ""}`.toLowerCase().includes(q));
  }, [agents, query]);

  const team = list.filter((agent) => picked.includes(agent.id));

  const toggle = (id: string) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <section className="cap-panel md:hidden" data-testid="chat-agents-panel">
      <style>{PANEL_CSS}</style>
      <div className="cap-inner">
        <header className="cap-hero">
          <span className="cap-hero-orb">
            <AgentOrb size={44} />
          </span>
          <div className="cap-hero-text">
            <h1 className="cap-title">Agents</h1>
            <p className="cap-sub">Personal agents you talk to</p>
          </div>
          {onPickTeam ? (
            <button
              type="button"
              className="cap-team-toggle"
              data-on={teamMode ? "true" : "false"}
              onClick={() => {
                setTeamMode((value) => !value);
                setPicked([]);
              }}
            >
              <Users strokeWidth={1.9} />
              Team
            </button>
          ) : null}
        </header>

        <div className="cap-note">
          <p>
            {teamMode
              ? "Pick two or more agents. They all answer the same message, each from its own angle."
              : "Every agent is a specialist. Tap one to start — your chat with it is saved, so you always pick up where you left off."}
          </p>
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
          <div className="cap-rows">
            {list.map((agent) => {
              const active = agent.id === activeAgentId;
              const tint = TINT[agent.color] ?? TINT.mono;
              const isPicked = picked.includes(agent.id);
              return (
                <button
                  key={agent.id}
                  type="button"
                  className="cap-row"
                  data-active={active ? "true" : "false"}
                  data-picked={isPicked ? "true" : "false"}
                  onClick={() => (teamMode ? toggle(agent.id) : onPick(agent))}
                  aria-label={teamMode ? `Add ${agent.name} to the team` : `Chat with ${agent.name}`}
                >
                  <span
                    className="cap-row-icon"
                    style={{
                      background: `color-mix(in oklch, ${tint} 13%, transparent)`,
                      boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${tint} 22%, transparent)`,
                    }}
                  >
                    <AgentIcon agent={agent} size={24} />
                  </span>
                  <span className="cap-row-text">
                    <span className="cap-row-name">{agent.name}</span>
                    <span className="cap-row-role">{agentRole(agent)}</span>
                  </span>
                  {teamMode ? (
                    <span className="cap-check" data-on={isPicked ? "true" : "false"}>
                      {isPicked ? <Check strokeWidth={2.6} /> : null}
                    </span>
                  ) : (
                    <ChevronRight className="cap-row-go" strokeWidth={2} />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {teamMode && onPickTeam ? (
          <button
            type="button"
            className="cap-team-start"
            disabled={team.length < 2}
            onClick={() => onPickTeam(team)}
          >
            {team.length < 2 ? "Pick at least two agents" : `Start team chat · ${team.length}`}
          </button>
        ) : (
          <button type="button" className="cap-manage" onClick={onManage}>
            Manage agents
            <ChevronRight strokeWidth={2} />
          </button>
        )}
      </div>
    </section>
  );
}

/** Glass panel in the shared settings language (tokens come from settings-home.css). */
const PANEL_CSS = `
.cap-panel {
  position: absolute; inset: 0; z-index: 35; overflow-y: auto; overscroll-behavior: contain;
  background-color: var(--settings-canvas);
  background-image: var(--settings-backdrop);
  background-repeat: no-repeat; background-size: cover; background-attachment: fixed;
  color: var(--settings-ink);
  padding: calc(env(safe-area-inset-top) + 66px) 16px calc(env(safe-area-inset-bottom) + 28px);
}
.cap-inner { max-width: 640px; margin: 0 auto; }

.cap-hero { display: flex; align-items: center; gap: 12px; margin: 2px 0 14px; }
.cap-hero-orb {
  width: 50px; height: 50px; flex: none; display: grid; place-items: center; border-radius: 18px;
  background: var(--settings-surface); box-shadow: var(--settings-shadow);
  -webkit-backdrop-filter: var(--settings-frost); backdrop-filter: var(--settings-frost);
}
.cap-hero-text { min-width: 0; flex: 1; }
.cap-title { margin: 0; font-size: 24px; font-weight: 680; letter-spacing: -.025em; color: var(--settings-ink); }
.cap-sub { margin: 2px 0 0; font-size: 13px; color: var(--settings-muted); }
.cap-team-toggle {
  display: inline-flex; align-items: center; gap: 6px; flex: none;
  height: 34px; padding: 0 12px; border: 0; border-radius: 17px; cursor: pointer;
  background: var(--settings-surface); color: var(--settings-muted);
  font: inherit; font-size: 12.5px; font-weight: 580;
  box-shadow: var(--settings-shadow);
  -webkit-backdrop-filter: var(--settings-frost); backdrop-filter: var(--settings-frost);
}
.cap-team-toggle svg { width: 15px; height: 15px; }
.cap-team-toggle[data-on="true"] { background: var(--settings-violet); color: #fff; }

.cap-note {
  border-radius: 20px; padding: 12px 14px; margin-bottom: 12px;
  background: var(--settings-surface); box-shadow: var(--settings-shadow);
  -webkit-backdrop-filter: var(--settings-frost); backdrop-filter: var(--settings-frost);
}
.cap-note p { margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--settings-muted); }

.cap-search { position: relative; display: flex; align-items: center; margin-bottom: 12px; }
.cap-search > svg {
  position: absolute; inset-inline-start: 14px; width: 16px; height: 16px;
  color: var(--settings-muted); pointer-events: none;
}
.cap-search > input {
  width: 100%; height: 44px; padding: 0 14px 0 38px; border-radius: 999px;
  border: 1px solid var(--settings-line); background: var(--settings-surface);
  color: var(--settings-ink); font: inherit; font-size: 14.5px; outline: none;
  -webkit-backdrop-filter: var(--settings-frost); backdrop-filter: var(--settings-frost);
}
.cap-search > input::placeholder { color: var(--settings-muted); }

.cap-rows { display: flex; flex-direction: column; gap: 8px; }
.cap-row {
  display: flex; align-items: center; gap: 12px; width: 100%;
  padding: 10px 12px; border: 0; cursor: pointer; font: inherit; text-align: start;
  border-radius: 20px; background: var(--settings-surface); color: var(--settings-ink);
  box-shadow: var(--settings-shadow);
  -webkit-backdrop-filter: var(--settings-frost); backdrop-filter: var(--settings-frost);
  transition: transform .16s ease;
  -webkit-tap-highlight-color: transparent;
}
.cap-row:active { transform: scale(.985); }
.cap-row[data-active="true"], .cap-row[data-picked="true"] {
  box-shadow: inset 0 0 0 1.5px var(--settings-violet), var(--settings-shadow);
}
.cap-row-icon {
  width: 42px; height: 42px; flex: none; display: grid; place-items: center; border-radius: 14px;
}
.cap-row-text { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 1px; }
.cap-row-name {
  font-size: 14px; font-weight: 620; letter-spacing: -.012em; color: var(--settings-ink);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.cap-row-role {
  font-size: 11.5px; color: var(--settings-muted);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.cap-row-go { width: 18px; height: 18px; flex: none; color: var(--settings-muted); }
.cap-check {
  width: 24px; height: 24px; flex: none; display: grid; place-items: center; border-radius: 50%;
  box-shadow: inset 0 0 0 1.5px var(--settings-line); color: #fff;
}
.cap-check[data-on="true"] { background: var(--settings-violet); box-shadow: none; }
.cap-check svg { width: 14px; height: 14px; }

.cap-loading { display: grid; place-items: center; padding: 40px 0; }
.cap-spin { width: 18px; height: 18px; color: var(--settings-muted); animation: cap-spin 1s linear infinite; }
@keyframes cap-spin { to { transform: rotate(360deg); } }
.cap-empty { text-align: center; font-size: 13.5px; color: var(--settings-muted); padding: 30px 0; }

.cap-manage, .cap-team-start {
  margin: 16px auto 0; display: flex; align-items: center; justify-content: center; gap: 6px;
  width: 100%; height: 48px; border: 0; border-radius: 999px; cursor: pointer; font: inherit;
  font-size: 13.5px; font-weight: 620; color: var(--settings-ink);
  background: var(--settings-surface); box-shadow: var(--settings-shadow);
  -webkit-backdrop-filter: var(--settings-frost); backdrop-filter: var(--settings-frost);
}
.cap-manage > svg { width: 16px; height: 16px; opacity: .6; }
.cap-manage:active, .cap-team-start:active { transform: scale(.985); }
.cap-team-start { background: var(--settings-violet); color: #fff; }
.cap-team-start:disabled { opacity: .55; }
`;
