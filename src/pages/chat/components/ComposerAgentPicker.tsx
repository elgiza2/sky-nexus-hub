/** @doc The agent chip that sits next to "+" in the composer.
 *
 * It shows which agent answers the next message and opens a small glass sheet
 * to switch. Switching opens that agent's own saved thread.
 */
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { AgentIcon } from "@/components/agent/AgentIcon";
import { loadWorkspace, useWorkspaceStore } from "@/lib/agentsky/store";
import type { AgentInfo } from "@/lib/agentsky/client";

export function ComposerAgentPicker({ activeAgentId }: { activeAgentId?: string | null }) {
  const navigate = useNavigate();
  const { agents, ready } = useWorkspaceStore();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void loadWorkspace();
  }, []);

  const list = useMemo(
    () => [...agents].sort((a, b) => Number(!!b.isDefault) - Number(!!a.isDefault)),
    [agents],
  );
  const active =
    list.find((agent) => agent.id === activeAgentId) ??
    list.find((agent) => agent.isDefault) ??
    list[0];

  const pick = (agent: AgentInfo) => {
    setOpen(false);
    if (agent.id !== activeAgentId) navigate(`/chat?agent=${encodeURIComponent(agent.id)}`);
  };

  return (
    <>
      <button
        type="button"
        className="composer-agent-chip"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Agent: ${active?.name ?? "Megsy"}`}
        data-agent-picker
      >
        <span className="composer-agent-chip-mark">
          {active ? <AgentIcon agent={active} size={17} /> : null}
        </span>
        <span className="composer-agent-chip-name">{active?.name ?? "Agent"}</span>
        <ChevronDown className="composer-agent-chip-chev" strokeWidth={2.2} />
      </button>

      {open
        ? createPortal(
            <>
              <div className="composer-agent-scrim" onClick={() => setOpen(false)} />
              <div className="composer-agent-sheet" role="listbox" aria-label="Choose an agent">
                <div className="composer-agent-sheet-grip" aria-hidden="true" />
                <p className="composer-agent-sheet-title">Answer with</p>
                {!ready ? (
                  <div className="composer-agent-sheet-loading">
                    <Loader2 className="animate-spin" />
                  </div>
                ) : (
                  <ul className="composer-agent-list">
                    {list.map((agent) => (
                      <li key={agent.id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={agent.id === active?.id}
                          className="composer-agent-item"
                          data-on={agent.id === active?.id ? "true" : "false"}
                          onClick={() => pick(agent)}
                        >
                          <span className="composer-agent-item-mark">
                            <AgentIcon agent={agent} size={20} />
                          </span>
                          <span className="composer-agent-item-text">
                            <span className="composer-agent-item-name">{agent.name}</span>
                            <span className="composer-agent-item-role">
                              {agent.isDefault
                                ? "Your everyday partner"
                                : agent.mediaOnly
                                  ? "Images and video"
                                  : agent.description || "Personal AI agent"}
                            </span>
                          </span>
                          {agent.id === active?.id ? (
                            <Check className="composer-agent-item-check" strokeWidth={2.4} />
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  );
}
