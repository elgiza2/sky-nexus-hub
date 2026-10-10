/** @doc Tiny shared store for the agent workspace: agents, plan tier, media models and recent sessions. */
import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { agentApi, type AgentInfo, type MediaModelInfo, type SessionInfo } from "./client";

type State = {
  ready: boolean;
  error: string | null;
  agents: AgentInfo[];
  tier: "free" | "pro";
  models: MediaModelInfo[];
  sessions: SessionInfo[];
};

const emptyState = (): State => ({
  ready: false,
  error: null,
  agents: [],
  tier: "free",
  models: [],
  sessions: [],
});
let state: State = emptyState();
const subs = new Set<() => void>();
const set = (p: Partial<State>) => {
  state = { ...state, ...p };
  subs.forEach((f) => f());
};

let loading: Promise<void> | null = null;
let loadGeneration = 0;
let workspaceOwner: string | null | undefined;
let authSyncStarted = false;

export function loadWorkspace(force = false) {
  if (loading && !force) return loading;
  const generation = ++loadGeneration;
  const request = (async () => {
    try {
      const [b, s] = await Promise.all([agentApi.bootstrap(), agentApi.sessions()]);
      if (generation !== loadGeneration) return;
      set({
        ready: true,
        error: null,
        agents: b.agents,
        tier: b.tier,
        models: b.models,
        sessions: s.sessions,
      });
    } catch (e: unknown) {
      if (generation === loadGeneration) {
        set({ ready: true, error: e instanceof Error ? e.message : "Could not load" });
      }
    } finally {
      // A completed request must not remain cached as `loading`; later visits
      // should refetch instead of reusing a stale, already-resolved promise.
      if (generation === loadGeneration) loading = null;
    }
  })();
  loading = request;
  return request;
}

function syncWorkspaceOwner(userId: string | null, deferLoad = false) {
  if (workspaceOwner === userId) return;
  workspaceOwner = userId;
  loadGeneration++;
  loading = null;
  set(emptyState());
  if (userId) {
    if (deferLoad) {
      // Supabase invokes auth listeners while holding its internal auth lock.
      // Agent requests call getSession() to attach a token, so start them only
      // after the listener returns and Supabase has released that lock.
      globalThis.setTimeout(() => {
        if (workspaceOwner === userId) void loadWorkspace(true);
      }, 0);
    } else {
      void loadWorkspace(true);
    }
  }
}

function startAuthSync() {
  if (authSyncStarted) return;
  authSyncStarted = true;
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    syncWorkspaceOwner(session?.user.id ?? null, true);
  });
  // Supabase also emits INITIAL_SESSION, but getSession covers clients where
  // that event fires before this listener is installed.
  void supabase.auth
    .getSession()
    .then(({ data }) => {
      if (workspaceOwner === undefined) syncWorkspaceOwner(data.session?.user.id ?? null);
    })
    .catch(() => {
      if (workspaceOwner === undefined) syncWorkspaceOwner(null);
    });
  void subscription;
}

export async function refreshSessions() {
  try {
    const s = await agentApi.sessions();
    set({ sessions: s.sessions });
  } catch {
    /* keep last list */
  }
}

export const workspace = {
  upsertSession(s: SessionInfo) {
    set({ sessions: [s, ...state.sessions.filter((x) => x.id !== s.id)] });
  },
  removeSession(id: string) {
    set({ sessions: state.sessions.filter((x) => x.id !== id) });
  },
  addAgent(a: AgentInfo) {
    set({ agents: [...state.agents.filter((x) => x.id !== a.id), a] });
  },
  removeAgent(id: string) {
    set({ agents: state.agents.filter((x) => x.id !== id) });
  },
  agent(id?: string | null) {
    return (
      state.agents.find((a) => a.id === id) ??
      state.agents.find((a) => a.isDefault) ??
      state.agents[0]
    );
  },
};

export function useWorkspaceStore(): State {
  const s = useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => state,
    () => state,
  );
  useEffect(() => {
    startAuthSync();
    if (workspaceOwner) void loadWorkspace();
  }, []);
  return s;
}
