/** @doc Agent chats.
 *
 * Every agent (and every team of agents) owns exactly ONE saved conversation.
 * The key that ties a conversation to its agent(s) lives in
 * `conversations.agent_key`, so reopening an agent always lands back in the
 * same thread — on any device — instead of starting a new chat each time.
 */
import { supabase } from "@/integrations/supabase/client";
import { getCachedUser } from "@/lib/cachedUser";

export interface AgentChatTarget {
  id: string;
  name: string;
  description?: string | null;
  mediaOnly?: boolean;
  isDefault?: boolean;
}

/** `a` for a single agent, `a|b|c` for a team — one key, one conversation. */
export function agentConversationKey(ids: string[]): string {
  return ids.filter(Boolean).join("|");
}

export function agentsFromKey(key: string): string[] {
  return key.split("|").filter(Boolean);
}

async function currentUserId(): Promise<string | null> {
  const user = await getCachedUser();
  return user?.id ?? null;
}

/** The saved conversation for this agent (or team), if the user already has one. */
export async function findAgentConversation(key: string): Promise<string | null> {
  const userId = await currentUserId();
  if (!userId || !key) return null;
  const { data } = await supabase
    .from("conversations")
    .select("id")
    .eq("user_id", userId)
    .eq("agent_key" as never, key as never)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as { id?: string } | null)?.id ?? null;
}

/**
 * Opens the agent's conversation, creating it the first time.
 * `created` tells the caller whether the welcome message still has to be written.
 */
export async function ensureAgentConversation(
  key: string,
  title: string,
): Promise<{ id: string | null; created: boolean }> {
  const existing = await findAgentConversation(key);
  if (existing) return { id: existing, created: false };
  const userId = await currentUserId();
  if (!userId) return { id: null, created: false };
  const { data, error } = await supabase
    .from("conversations")
    .insert({
      user_id: userId,
      title,
      mode: "normal",
      agent_key: key,
    } as never)
    .select("id")
    .single();
  if (error) return { id: null, created: false };
  return { id: (data as { id?: string })?.id ?? null, created: true };
}

/**
 * First-run note from the agent itself: what agents are, what this one is good
 * at, and that the thread is saved. Written once per conversation.
 */
export function agentWelcomeText(agent: AgentChatTarget, opts: { team?: boolean; pro?: boolean } = {}): string {
  const name = agent.name || "your agent";
  const role = agent.isDefault
    ? "your everyday agent"
    : agent.mediaOnly
      ? "your image and video agent"
      : agent.description?.trim() || "one of your personal agents";

  if (opts.team) {
    return [
      `You just opened a team chat — ${name} is in it with you.`,
      "",
      "Every agent on Megsy is a specialist. Send one message and each agent in the team answers with its own angle, so you get several points of view in the same thread.",
      "",
      "• This thread is saved. Close it, come back later, and everything is still here.",
      "• You can add or swap agents at any time — nothing is lost.",
      "",
      "What should the team work on first?",
    ].join("\n");
  }

  return [
    `Hi, I'm ${name} — ${role}.`,
    "",
    "Agents are specialists you can call on whenever you need them: one writes code, one builds decks, one makes images and video, one researches. Each of them keeps its own thread with you, and every thread is saved — open Agents, tap me, and we carry on exactly where we stopped.",
    "",
    "• Ask me anything inside what I'm good at, and I'll do the work rather than just talk about it.",
    "• Switch to another agent whenever you want from the Agents tab.",
    opts.pro
      ? "• You can also run a team: pick more than one agent and they work on the same message together."
      : "• Want several agents on one task? That comes with a paid plan.",
    "",
    "What are we starting with?",
  ].join("\n");
}
