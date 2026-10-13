/** @doc Team Workspace: paid-only 24/7 agent team.
 *
 * Flow:
 *  - Non-subscribers see a landing page and must subscribe to enter.
 *  - Subscribers send one goal message; the fast orchestrator proposes named
 *    agents, each with a role and a task, persisted server-side.
 *  - Agents keep running 24/7: a ticker re-invokes the orchestrator per agent
 *    so results stream back into the workspace loop.
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bot, Crown, Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isPaidUser } from "@/lib/subscriptionGating";
import SEOHead from "@/components/common/SEOHead";

type TeamAgent = {
  id: string;
  name: string;
  role: string;
  task: string;
  status: string;
  last_result: string;
  updated_at: string;
};

const ROLE_SUGGESTIONS = [
  { role: "researcher", label: "Researcher", hint: "live facts, news, sources" },
  { role: "coder", label: "Engineer", hint: "code, repos, debugging" },
  { role: "analyst", label: "Analyst", hint: "numbers, finance, strategy" },
  { role: "writer", label: "Writer", hint: "copy, docs, scripts" },
  { role: "operator", label: "Operator", hint: "execution, automation" },
  { role: "designer", label: "Designer", hint: "UI, branding, landing" },
];

export default function TeamWorkspacePage() {
  const [loading, setLoading] = useState(true);
  const [paid, setPaid] = useState(false);
  const [goal, setGoal] = useState("");
  const [agents, setAgents] = useState<TeamAgent[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let dead = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (!dead) setLoading(false); return; }
      const { data } = await supabase
        .from("subscriptions")
        .select("plan, status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (dead) return;
      const ok = Boolean(data && data.status === "active" && isPaidUser(data.plan));
      setPaid(ok);
      if (ok) await refresh(dead);
      setLoading(false);
    })();
    return () => { dead = true; };
    async function refresh(deadFlag: boolean) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || deadFlag) return;
      const ws = await supabase.from("team_workspaces").select("id").eq("user_id", user.id).maybeSingle();
      if (!ws.data) return;
      const rows = await supabase.from("team_agents").select("id, name, role, task, status, last_result, updated_at").eq("workspace_id", ws.data.id).order("updated_at", { ascending: false }).limit(24);
      if (!deadFlag && rows.data) setAgents(rows.data as TeamAgent[]);
    }
  }, []);

  const start = useCallback(async () => {
    const text = goal.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/team-orchestrate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ goal: text }),
      });
      if (!resp.ok) throw new Error(`orchestrator ${resp.status}`);
      const body = await resp.json();
      setAgents((body.agents ?? []) as TeamAgent[]);
      setGoal("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to start team");
    } finally {
      setBusy(false);
    }
  }, [goal, busy]);

  if (loading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2 className="animate-spin" size={28} />
      </div>
    );
  }

  if (!paid) {
    return (
      <>
        <SEOHead title="Team Workspace — Megsy" description="Your 24/7 AI agent team. Subscribe to unlock." />
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-pink-500 to-indigo-500 text-white">
            <Bot size={26} />
          </span>
          <h1 className="mt-6 text-3xl font-bold">Team Workspace</h1>
          <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed opacity-75">
            Send one message describing your goal. Megsy assembles a named agent team —
            each agent with its own role and task — and they keep working for you 24/7.
          </p>
          <ul className="mx-auto mt-8 grid max-w-xl gap-2 text-start text-sm">
            {ROLE_SUGGESTIONS.map((r) => (
              <li key={r.role} className="flex items-center gap-3 rounded-xl border px-4 py-3">
                <Bot size={16} className="flex-none opacity-60" />
                <strong>{r.label}</strong>
                <span className="opacity-60">{r.hint}</span>
              </li>
            ))}
          </ul>
          <Link
            to="/pricing"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-pink-500 to-indigo-500 px-6 py-3 font-semibold text-white"
          >
            <Crown size={16} /> Subscribe to unlock
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <SEOHead title="Team Workspace — Megsy" description="Your 24/7 AI agent team at work." />
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold">Team Workspace</h1>
        <p className="mt-1 text-sm opacity-60">Describe the goal once — your agents keep running 24/7.</p>
        <div className="mt-4 flex gap-2">
          <input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") start(); }}
            placeholder="e.g. monitor prices, draft weekly report, triage inbox…"
            className="ag-input flex-1"
            dir="auto"
          />
          <button type="button" onClick={start} disabled={busy || !goal.trim()} className="ag-btn ag-btn--agent">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Start team
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        <div className="mt-6 space-y-3">
          {agents.map((a) => (
            <div key={a.id} className="ag-card ag-fade-in p-4">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${a.status === "running" ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
                <strong>{a.name}</strong>
                <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">{a.role}</span>
                <span className="ms-auto text-xs opacity-50">{a.status}</span>
              </div>
              <p className="mt-2 text-sm opacity-80">{a.task}</p>
              {a.last_result && (
                <p className="mt-2 line-clamp-3 rounded-xl bg-black/5 p-3 text-[13px] dark:bg-white/5">{a.last_result}</p>
              )}
            </div>
          ))}
          {!agents.length && !busy && (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm opacity-60">
              No agents yet — send your goal above and Megsy will assemble the team.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
