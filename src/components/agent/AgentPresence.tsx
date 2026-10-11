import { useUserLang } from "@/lib/authI18n";
import { AgentIcon } from "./AgentIcon";
import type { AgentInfo } from "@/lib/agentsky/client";
import type { Message } from "@/pages/chat/chatConstants";

/** The agent's own mark for a message: Megsy keeps the orb, every other agent
 *  shows its real logo, and the agent name always sits next to it. */
export function AgentPresence({ message }: { message: Message }) {
  const ar = useUserLang() === "ar-eg";
  const state = message.agentSkyState ?? "done";
  const labels: Record<string, string> = {
    sleeping: ar ? "نايم" : "Sleeping", hello: ar ? "أهلاً!" : "Hello!",
    awakening: ar ? "الوكيل يستيقظ" : "Agent is waking up",
    thinking: ar ? "بيفكر…" : "Thinking…",
    tool: ar ? "بينفّذ…" : "Working…",
    talking: ar ? "بيرد…" : "Responding…",
    done: "", error: ar ? "الطلب وقف" : "Request stopped", idle: ar ? "اتوقف" : "Stopped",
  };
  const agent = message.agentSkyAgent;
  const info: AgentInfo = {
    id: agent?.id ?? "megsy",
    name: agent?.name ?? "Megsy",
    description: "",
    prompt: "",
    color: (agent?.color ?? "aurora") as AgentInfo["color"],
    isDefault: !agent || agent.id === "megsy" || /megsy/i.test(agent?.name ?? ""),
    mediaOnly: agent?.id === "higgsfield" || /higgs/i.test(agent?.name ?? ""),
    createdAt: "",
  };
  return (
    <div className="agent-msg-head" data-agent-color={agent?.color ?? "aurora"}>
      <span className="agent-msg-mark">
        <AgentIcon agent={info} size={22} />
      </span>
      <div className="min-w-0">
        <div className="agent-msg-name">{info.name}</div>
        {labels[state] && <div className="agent-msg-state" role="status"><span className={state === "awakening" || state === "thinking" ? "ag-shimmer" : ""}>{labels[state]}</span></div>}
      </div>
    </div>
  );
}
