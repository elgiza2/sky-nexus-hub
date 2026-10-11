/** @doc The strip above an agent thread: who you are talking to, and how to switch. */
import { ChevronDown } from "lucide-react";
import { AgentIcon } from "@/components/agent/AgentIcon";
import type { AgentInfo } from "@/lib/agentsky/client";

export function AgentChatBar({
  agents,
  team,
  onSwitch,
}: {
  agents: AgentInfo[];
  team?: boolean;
  onSwitch: () => void;
}) {
  const label = team
    ? `Team · ${agents.map((agent) => agent.name).join(" + ")}`
    : agents[0]?.name ?? "Agent";
  return (
    <div className="chat-agent-bar" data-agent-chat-bar>
      <div className="chat-agent-bar-marks">
        {agents.slice(0, 3).map((agent, index) => (
          <span
            key={agent.id}
            className="chat-agent-bar-mark"
            style={{ zIndex: 4 - index, marginInlineStart: index ? -10 : 0 }}
          >
            <AgentIcon agent={agent} size={19} />
          </span>
        ))}
      </div>
      <div className="chat-agent-bar-text">
        <div className="chat-agent-bar-name">{label}</div>
        <div className="chat-agent-bar-role">
          {team ? "Working together on this chat" : "Personal agent"}
        </div>
      </div>
      <button type="button" className="chat-agent-bar-switch" onClick={onSwitch}>
        Switch
        <ChevronDown strokeWidth={2} />
      </button>
    </div>
  );
}
