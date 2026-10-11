/** @doc The agent button that sits next to "+" in the composer.
 *
 * It shows which agent answers the next message and opens a short sheet to
 * switch. Switching keeps the current thread and just changes who replies.
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
    // Keep the open thread (`?c=`) and only change who answers.
    const params = new URLSearchParams(location.search);
    params.set("agent", agent.id);
    navigate(`/chat?${params.toString()}`, { replace: true });
  };

  return (
    <>
      <button
        type="button"
        className="composer-agent-btn relative z-[61] flex h-9 shrink-0 items-center gap-1.5 rounded-[12px] border border-foreground/[0.08] bg-foreground/[0.035] px-2.5 text-muted-foreground shadow-sm transition-[background-color,border-color,transform,color] duration-150 hover:border-primary/30 hover:bg-primary/[0.08] hover:text-foreground active:scale-[0.96]"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Agent: ${active?.name ?? "Megsy"}`}
        data-agent-picker
      >
        <span className="grid h-5 w-5 shrink-0 place-items-center">
          {active ? <AgentIcon agent={active} size={17} /> : null}
        </span>
        <span className="max-w-[32vw] truncate text-[11px] font-semibold sm:text-[12px]">
          {active?.name ?? "Agent"}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" strokeWidth={2.2} />
      </button>

      {open
        ? createPortal(
            <>
              <div
                className="fixed inset-0 z-[70] bg-black/25 backdrop-blur-[2px]"
                onClick={() => setOpen(false)}
              />
              <div
                role="listbox"
                aria-label="Choose an agent"
                className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)+88px)] z-[71] max-h-[58vh] overflow-y-auto overscroll-contain rounded-3xl border border-foreground/10 bg-background p-2 shadow-2xl"
              >
                <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-foreground/15" />
                <p className="px-2 pb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Answer with
                </p>
                {!ready ? (
                  <div className="grid place-items-center py-6 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {list.map((agent) => {
                      const on = agent.id === active?.id;
                      return (
                        <li key={agent.id}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={on}
                            onClick={() => pick(agent)}
                            className={`flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition ${
                              on ? "bg-primary/[0.09]" : "bg-transparent hover:bg-foreground/[0.05]"
                            }`}
                          >
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-foreground/[0.05]">
                              <AgentIcon agent={agent} size={20} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13.5px] font-semibold text-foreground">
                                {agent.name}
                              </span>
                              <span className="block truncate text-[11px] text-muted-foreground">
                                {agent.isDefault
                                  ? "Your everyday partner"
                                  : agent.mediaOnly
                                    ? "Images and video"
                                    : agent.description || "Personal AI agent"}
                              </span>
                            </span>
                            {on ? <Check className="h-4 w-4 shrink-0 text-primary" strokeWidth={2.4} /> : null}
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
