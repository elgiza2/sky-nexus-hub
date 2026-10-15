import { afterEach, describe, expect, it, vi } from "vitest";
import { tryFastChat } from "./fastChat";

function sseResponse(contents: string[]) {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const content of contents) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`),
        );
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

function rawSseResponse(frame: string) {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(frame));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

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
      routingContext: "specialist_auto_join=none",
      onDelta: () => undefined,
    });

    expect(outcome).toBe("escalate");
    const edgeCall = fetchMock.mock.calls.find(([url]) => String(url).includes("chat-fast"));
    expect(edgeCall).toBeDefined();
    const requestBody = JSON.parse((edgeCall?.[1] as RequestInit).body as string);
    expect(requestBody).toMatchObject({
      force: true,
      maxTokens: 700,
      routingContext: "specialist_auto_join=none",
      messages: [{ role: "user", content: "تمام" }],
    });
  });

  it("intercepts a split route sentinel without showing it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(sseResponse(["[[MEGSY_ESCALATE_", "TO_FULL_CHAT]]", "\n"])),
    );
    const onDelta = vi.fn();

    const outcome = await tryFastChat({
      messages: [{ role: "user", content: "ابحث عن آخر الأخبار" }],
      authToken: "test-token",
      fingerprint: "test-fingerprint",
      onDelta,
    });

    expect(outcome).toBe("escalate");
    expect(onDelta).not.toHaveBeenCalled();
  });

  it("intercepts the research route suffix even when it arrives in separate chunks", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(sseResponse(["[[MEGSY_ESCALATE_TO_FULL_CHAT", ":research", "]]", "\n"])),
    );
    const onDelta = vi.fn();

    const outcome = await tryFastChat({
      messages: [{ role: "user", content: "ابحث عن الموضوع" }],
      authToken: "test-token",
      fingerprint: "test-fingerprint",
      onDelta,
    });

    expect(outcome).toBe("escalate");
    expect(onDelta).not.toHaveBeenCalled();
  });

  it("streams a direct answer as soon as the route prefix is not a sentinel", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sseResponse(["Hello", " there"])));
    const onDelta = vi.fn();

    const outcome = await tryFastChat({
      messages: [{ role: "user", content: "Say hello" }],
      authToken: "test-token",
      fingerprint: "test-fingerprint",
      onDelta,
    });

    expect(outcome).toBe("answered");
    expect(onDelta.mock.calls.flat().join("")).toBe("Hello there");
  });

  it("parses a final data: frame without a space or trailing newline", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          rawSseResponse(
            `data:${JSON.stringify({ choices: [{ delta: { content: "وصل الرد" } }] })}`,
          ),
        ),
    );
    const onDelta = vi.fn();

    const outcome = await tryFastChat({
      messages: [{ role: "user", content: "سؤال سريع" }],
      authToken: "test-token",
      fingerprint: "test-fingerprint",
      onDelta,
    });

    expect(outcome).toBe("answered");
    expect(onDelta.mock.calls.flat().join("")).toBe("وصل الرد");
  });

  it("delivers reasoning separately from visible answer text", async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: "تحليل" } }] })}\n\n` +
              `data: ${JSON.stringify({ choices: [{ delta: { content: "الإجابة" } }] })}\n\n` +
              "data: [DONE]\n\n",
          ),
        );
        controller.close();
      },
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(body, { headers: { "content-type": "text/event-stream" } }),
        ),
    );
    const onDelta = vi.fn();
    const onReasoning = vi.fn();

    const outcome = await tryFastChat({
      messages: [{ role: "user", content: "اشرح" }],
      authToken: "test-token",
      fingerprint: "test-fingerprint",
      onDelta,
      onReasoning,
    });

    expect(outcome).toBe("answered");
    expect(onReasoning.mock.calls.flat().join("")).toBe("تحليل");
    expect(onDelta.mock.calls.flat().join("")).toBe("الإجابة");
  });
});
