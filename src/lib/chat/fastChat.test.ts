import { afterEach, describe, expect, it, vi } from "vitest";
import { tryFastChat } from "./fastChat";

describe("tryFastChat request options", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps the small output budget when forcing a safe trivial turn", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ escalate: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await tryFastChat({
      messages: [{ role: "user", content: "تمام" }],
      authToken: "test-token",
      fingerprint: "test-fingerprint",
      force: true,
      maxTokens: 700,
      onDelta: () => undefined,
    });

    expect(outcome).toBe("escalate");
    const edgeCall = fetchMock.mock.calls.find(([url]) => String(url).includes("chat-fast"));
    expect(edgeCall).toBeDefined();
    const requestBody = JSON.parse((edgeCall?.[1] as RequestInit).body as string);
    expect(requestBody).toMatchObject({
      force: true,
      maxTokens: 700,
      messages: [{ role: "user", content: "تمام" }],
    });
  });
});
