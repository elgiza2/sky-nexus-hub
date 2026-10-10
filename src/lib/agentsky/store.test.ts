import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authListener: undefined as
    ((event: string, session: { user: { id: string } } | null) => void) | undefined,
  getSession: vi.fn(),
  bootstrap: vi.fn(),
  sessions: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (listener: unknown) => {
        mocks.authListener = listener as NonNullable<typeof mocks.authListener>;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
      getSession: mocks.getSession,
    },
  },
}));

vi.mock("./client", () => ({
  agentApi: {
    bootstrap: mocks.bootstrap,
    sessions: mocks.sessions,
  },
}));

describe("Agent workspace auth synchronization", () => {
  beforeEach(() => {
    mocks.authListener = undefined;
    mocks.getSession.mockReset();
    mocks.bootstrap.mockReset();
    mocks.sessions.mockReset();
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    mocks.bootstrap.mockResolvedValue({
      agents: [{ id: "agent-1", name: "Main", isDefault: true }],
      tier: "pro",
      models: [],
    });
    mocks.sessions.mockResolvedValue({ sessions: [] });
  });

  it("waits until Supabase has released its auth callback lock before loading agents", async () => {
    const { useWorkspaceStore } = await import("./store");
    const { result } = renderHook(() => useWorkspaceStore());

    await act(async () => {
      await Promise.resolve();
    });
    expect(mocks.authListener).toBeTypeOf("function");

    act(() => {
      mocks.authListener?.("SIGNED_IN", { user: { id: "user-1" } });
    });

    expect(mocks.bootstrap).not.toHaveBeenCalled();
    expect(mocks.sessions).not.toHaveBeenCalled();

    await act(async () => {
      await new Promise((resolve) => globalThis.setTimeout(resolve, 10));
    });

    expect(mocks.bootstrap).toHaveBeenCalledTimes(1);
    expect(mocks.sessions).toHaveBeenCalledTimes(1);
    expect(result.current.ready).toBe(true);
    expect(result.current.agents).toHaveLength(1);
  });
});
