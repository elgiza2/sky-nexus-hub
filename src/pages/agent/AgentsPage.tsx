/** @doc Agents directory. Opens exactly like the settings sub-pages: same glass
 * sheet, same frosted cards, same tinted icon tiles — only the content differs.
 * Every agent shows its real published logo; Megsy itself is the robot. */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Loader2, Lock, Plus, RotateCw, Trash2 } from "lucide-react";
import { agentApi, type AgentColor, type AgentInfo } from "@/lib/agentsky/client";
import { useWorkspaceStore, workspace, loadWorkspace } from "@/lib/agentsky/store";
import { AgentIcon, agentBrandKey } from "@/components/agent/AgentIcon";
import ProfileGlassShell, { GlassCard, GlassSection } from "@/components/profile/ProfileGlassShell";
import SEOHead from "@/components/common/SEOHead";
import { canUseAgent } from "@/lib/octoberOffer";

/* The agent's own colour drives its tile tint (brand marks keep a neutral tile). */
const TINT: Record<AgentColor, string> = {
  aurora: "var(--settings-violet)",
  ocean: "var(--settings-blue)",
  ember: "var(--settings-red)",
  mint: "var(--settings-green)",
  sun: "oklch(.6 .15 87)",
  rose: "var(--settings-pink)",
  mono: "var(--settings-muted)",
};

const AGENT_CSS = `
  .agx-list { list-style: none; margin: 0; padding: 0; }
  .agx-list .gx-row + .gx-row::before { inset-inline-start: 69px; }
  .agx-row { padding: 7px 12px 7px 16px; gap: 6px; }
  .agx-hit {
    flex: 1; min-width: 0; display: flex; align-items: center; gap: 13px;
    padding: 5px 0; border: 0; background: transparent; color: inherit;
    font: inherit; text-align: start; cursor: pointer; border-radius: 14px;
    -webkit-tap-highlight-color: transparent;
  }
  .agx-hit:active { opacity: .72; }
  .agx-tile {
    width: 40px; height: 40px; flex-shrink: 0; display: grid; place-items: center;
    border-radius: 13px; color: var(--agx);
    background: color-mix(in oklch, var(--agx) 13%, transparent);
  }
  .agx-tile-brand { background: color-mix(in oklch, var(--settings-ink) 7%, transparent); }
  .agx-tile svg { display: block; }
  .agx-title { display: flex; align-items: center; gap: 7px; min-width: 0; }
  .agx-name {
    min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    font-size: 15px; font-weight: 550; line-height: 1.35;
  }
  .agx-chip {
    flex-shrink: 0; white-space: nowrap;
    font-size: 10.5px; font-weight: 650; letter-spacing: .02em;
    padding: 2px 8px; border-radius: 999px;
    color: var(--settings-muted); background: var(--settings-line);
  }
  .agx-lock {
    flex-shrink: 0; display: inline-flex; align-items: center; gap: 4px;
    font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 999px;
    color: var(--settings-muted); background: var(--settings-line);
  }
  .agx-lock svg { width: 12px; height: 12px; }
  .agx-icon-btn {
    flex-shrink: 0; width: 32px; height: 32px; display: grid; place-items: center;
    border: 0; border-radius: 50%; background: transparent; cursor: pointer;
    color: var(--settings-muted);
    -webkit-tap-highlight-color: transparent;
    transition: background .18s, transform .18s;
  }
  .agx-icon-btn svg { width: 16px; height: 16px; }
  .agx-icon-btn:active { transform: scale(.92); background: var(--settings-line); }
  .agx-icon-btn.agx-del { color: var(--settings-red); }
  .agx-icon-btn:disabled { opacity: .45; cursor: not-allowed; }
`;

export function AgentsPage() {
  const nav = useNavigate();
  const { agents, ready, error, sessions, tier } = useWorkspaceStore();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [now] = useState(Date.now());
  const setup = () => nav("/chat", { state: { agentCreation: true } });
  const back = () => (window.history.length > 1 ? nav(-1) : nav("/chat"));

  const personal = agents.filter((a) => !a.isTemplate);
  const catalogue = agents.filter((a) => a.isTemplate && !a.mediaOnly);
  const media = agents.filter((a) => a.mediaOnly);

  const removeAgent = async (a: AgentInfo) => {
    if (!confirm(`Delete ${a.name}? Your conversations will not be deleted.`)) return;
    setDeleting(a.id);
    setDeleteError(null);
    try {
      await agentApi.deleteAgent(a.id);
      workspace.removeAgent(a.id);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Could not delete agent");
    } finally {
      setDeleting(null);
    }
  };

  const row = (a: AgentInfo) => {
    const live = sessions.filter((s) => s.agentId === a.id && s.status === "running").length;
    const locked = !a.isDefault && !canUseAgent(tier, !!a.mediaOnly, now);
    const brand = agentBrandKey(a);
    const hint =
      a.description || (a.isDefault ? "Your everyday partner" : a.mediaOnly ? "Image and video" : "Personal AI agent");
    const open = () => nav(locked ? "/pricing" : `/agents/chat?agent=${encodeURIComponent(a.id)}`);

    return (
      <li key={a.id} className="gx-row agx-row" style={{ ["--agx" as any]: TINT[a.color] }}>
        <button type="button" className="agx-hit" onClick={open} aria-label={`Open ${a.name}`}>
          <span className={`agx-tile${brand ? " agx-tile-brand" : ""}`}>
            <AgentIcon agent={a} />
          </span>
          <span className="gx-row-body">
            <span className="agx-title">
              <span className="agx-name">{a.name}</span>
              {a.isDefault && <span className="agx-chip">Main</span>}
              {live > 0 && <span className="agx-chip">{live} live</span>}
            </span>
            <span className="gx-row-hint">{hint}</span>
          </span>
        </button>

        {!a.isDefault && !a.isTemplate && (
          <button
            type="button"
            className="agx-icon-btn agx-del"
            aria-label={`Delete ${a.name}`}
            title={`Delete ${a.name}`}
            disabled={deleting === a.id}
            onClick={() => void removeAgent(a)}
          >
            <Trash2 />
          </button>
        )}

        {locked ? (
          <span className="agx-lock">
            <Lock />
            Pro
          </span>
        ) : (
          <ChevronRight className="gx-chev" strokeWidth={1.9} aria-hidden />
        )}
      </li>
    );
  };

  const groups: { title: string; list: AgentInfo[] }[] = [
    { title: "Yours", list: personal },
    { title: "Specialists", list: catalogue },
    { title: "Images & video", list: media },
  ];

  return (
    <div data-no-translate>
      <style>{AGENT_CSS}</style>
      <SEOHead
        locale="en"
        path="/agents"
        title="Your agents"
        description="Your personal Megsy AI agents, specialist agents and conversations."
      />
      <ProfileGlassShell
        title="Agents"
        subtitle="Your personal agents, specialists and media makers — each with its own logo and chat."
        onBack={back}
        trailing={
          <button type="button" className="gx-hbtn gx-hbtn-sm" aria-label="Add agent" title="Add agent" onClick={setup}>
            <Plus className="gx-hicon" strokeWidth={2} />
          </button>
        }
      >
        {(error || deleteError) && (
          <GlassCard className="gx-card-pad">
            <p className="gx-field-hint" role="alert" style={{ color: "var(--settings-red)" }}>
              {error || deleteError}
            </p>
            <button type="button" className="gx-pill gx-pill-wide" onClick={() => void loadWorkspace(true)}>
              <RotateCw size={16} />
              Try again
            </button>
          </GlassCard>
        )}

        {!ready && (
          <GlassCard>
            <div className="gx-loading" role="status">
              <Loader2 size={17} className="animate-spin" />
              Loading your agents…
            </div>
          </GlassCard>
        )}

        {groups.map((group) =>
          group.list.length ? (
            <GlassSection key={group.title} title={group.title}>
              <GlassCard className="agx-card">
                <ul className="agx-list">{group.list.map(row)}</ul>
              </GlassCard>
            </GlassSection>
          ) : null,
        )}

        {ready && !agents.length && !error && (
          <GlassCard>
            <div className="gx-empty">
              <p>Your next agent starts with a conversation.</p>
              <button type="button" className="gx-pill" onClick={setup}>
                <Plus size={16} />
                Add agent
              </button>
            </div>
          </GlassCard>
        )}
      </ProfileGlassShell>
    </div>
  );
}

export function AgentNewPage() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/chat", { replace: true, state: { agentCreation: true } });
  }, [navigate]);
  return null;
}
