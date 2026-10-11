/** @doc The agent button that sits next to "+" in the composer.
 *
 * Quiet pill showing who answers the next message; tapping it opens a short
 * list to switch. Switching keeps the open thread and only changes the agent.
 */
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { AgentIcon } from "@/components/agent/AgentIcon";
import { loadWorkspace, useWorkspaceStore } from "@/lib/agentsky/store";
import type { AgentInfo } from "@/lib/agentsky/client";

export function ComposerAgentPicker({ activeAgentId }: { activeAgentId?: string | null }) {
  const navigate = useNavigate();
  const location = useLocation();
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
    if (agent.id === activeAgentId) return;
    const params = new URLSearchParams(location.search);
    params.set("agent", agent.id);
    navigate(`/chat?${params.toString()}`, { replace: true });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Agent: ${active?.name ?? "Megsy"}`}
        data-agent-picker
        className="relative z-[61] flex h-9 shrink-0 items-center gap-1.5 rounded-full border-0 bg-foreground/[0.06] pl-1.5 pr-2.5 text-foreground/85 shadow-none transition-[background-color,transform] duration-150 hover:bg-foreground/[0.1] active:scale-[0.96]"
      >
        <span className="grid h-6 w-6 shrink-0 place-items-center">
          {active ? <AgentIcon agent={active} size={17} /> : null}
        </span>
        <span className="max-w-[30vw] truncate text-[12.5px] font-medium">
          {active?.name ?? "Agent"}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-foreground/40" strokeWidth={2.2} />
      </button>

      {open
        ? createPortal(
            <>
              <div className="fixed inset-0 z-[70] bg-black/20" onClick={() => setOpen(false)} />
              <div
                role="listbox"
                aria-label="Choose an agent"
                className="fixed inset-x-2 bottom-[calc(env(safe-area-inset-bottom,0px)+84px)] z-[71] max-h-[56vh] overflow-y-auto overscroll-contain rounded-[28px] bg-background p-2 shadow-[0_20px_60px_-24px_rgba(0,0,0,0.35)]"
              >
                <div className="mx-auto mb-1 h-1 w-9 rounded-full bg-foreground/15" />
                <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Answer with
                </p>
                {!ready ? (
                  <div className="grid place-items-center py-7 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : (
                  <ul className="flex flex-col">
                    {list.map((agent) => {
                      const on = agent.id === active?.id;
                      return (
                        <li key={agent.id}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={on}
                            onClick={() => pick(agent)}
                            className={`flex w-full items-center gap-3 rounded-[20px] px-3 py-2.5 text-left transition-colors duration-150 ${
                              on ? "bg-foreground/[0.07]" : "hover:bg-foreground/[0.04]"
                            }`}
                          >
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-foreground/[0.05]">
                              <AgentIcon agent={agent} size={21} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[14.5px] font-medium leading-tight text-foreground">
                                {agent.name}
                              </span>
                              <span className="mt-0.5 block truncate text-[11.5px] leading-snug text-muted-foreground">
                                {agent.isDefault
                                  ? "Your everyday partner"
                                  : agent.mediaOnly
                                    ? "Images and video"
                                    : agent.description || "Personal AI agent"}
                              </span>
                            </span>
                            {on ? (
                              <Check className="h-4 w-4 shrink-0 text-primary" strokeWidth={2.6} />
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
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
