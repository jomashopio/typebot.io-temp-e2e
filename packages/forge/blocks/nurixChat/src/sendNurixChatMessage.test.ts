import { describe, expect, it } from "bun:test";
import { endNurixSession } from "./endNurixSession";
import { sendNurixChatMessage } from "./sendNurixChatMessage";
import { startNurixSession } from "./startNurixSession";
import {
  NurixChatError,
  type NurixChatFetch,
  type NurixChatStatus,
} from "./types";

const connectionInput = {
  apiKey: "api-key-sentinel",
  baseUrl: "https://chat.example.test",
  accountId: "account/one",
  channelName: "CHAT WIDGET",
  origin: "https://www.jomashop.test/",
};

const allowTestHost = () => true;

describe("Nurix HTTP Chat API", () => {
  describe("Start Session", () => {
    it("constructs the exact authenticated request and normalizes numeric IDs", async () => {
      const { calls, fetcher } = createRecordingFetcher(() =>
        jsonResponse(
          successEnvelope({
            session_id: 101,
            conversation_id: 80421,
            agent_id: 9,
            welcome_message: {
              content: "Welcome to Jomashop",
              message_id: 99301,
              is_transfer: false,
              created_at: "2026-09-04T12:00:00Z",
            },
            request_id: "request-start",
          }),
          201,
        ),
      );

      const response = await startNurixSession(
        {
          ...connectionInput,
          userId: "customer/42",
          agentId: "agent one",
          inputVariables: { locale: "en-US", loyaltyTier: 3 },
          metadata: { source: "typebot" },
        },
        { fetcher, validateUrl: allowTestHost },
      );

      expect(response).toEqual({
        sessionId: "101",
        conversationId: "80421",
        agentId: "9",
        welcomeMessage: {
          content: "Welcome to Jomashop",
          messageId: "99301",
          isTransfer: false,
        },
      });

      const call = getOnlyCall(calls);
      expect(call.input.toString()).toBe(
        "https://chat.example.test/v2/chat/CHAT%20WIDGET/account%2Fone/session",
      );
      expect(call.init?.method).toBe("POST");
      expect(call.init?.redirect).toBe("manual");
      expect(readRequestBody(call.init)).toEqual({
        user_id: "customer/42",
        agent_id: "agent one",
        input_variables: { locale: "en-US", loyaltyTier: 3 },
        metadata: { source: "typebot" },
      });

      const headers = new Headers(call.init?.headers);
      expect(headers.get("X-Api-Key")).toBe(connectionInput.apiKey);
      expect(headers.get("Origin")).toBe("https://www.jomashop.test");
      expect(headers.get("Accept")).toBe("application/json");
      expect(headers.get("Content-Type")).toBe("application/json");
      expect(headers.has("Authorization")).toBe(false);
      expect(headers.has("X-Captcha-Token")).toBe(false);
      expect(call.input.toString()).not.toContain(connectionInput.apiKey);
    });

    it("accepts a null welcome message and omits absent optional fields", async () => {
      const { calls, fetcher } = createRecordingFetcher(() =>
        jsonResponse(
          successEnvelope({
            session_id: "session-1",
            conversation_id: "conversation-1",
            agent_id: "agent-1",
            welcome_message: null,
          }),
          201,
        ),
      );

      await expect(
        startNurixSession(
          { ...connectionInput, userId: "customer-42" },
          { fetcher, validateUrl: allowTestHost },
        ),
      ).resolves.toEqual({
        sessionId: "session-1",
        conversationId: "conversation-1",
        agentId: "agent-1",
        welcomeMessage: null,
      });

      expect(readRequestBody(getOnlyCall(calls).init)).toEqual({
        user_id: "customer-42",
      });
    });

    it("accepts the expected production Nurix host without a test bypass", async () => {
      const { calls, fetcher } = createRecordingFetcher(() =>
        jsonResponse(
          successEnvelope({
            session_id: "session-1",
            conversation_id: "conversation-1",
            agent_id: "agent-1",
            welcome_message: null,
          }),
          201,
        ),
      );

      await startNurixSession(
        {
          ...connectionInput,
          baseUrl: "https://chat-us.nurixlabs.tech",
          userId: "customer-42",
        },
        { fetcher },
      );

      expect(getOnlyCall(calls).input.toString()).toBe(
        "https://chat-us.nurixlabs.tech/v2/chat/CHAT%20WIDGET/account%2Fone/session",
      );
    });
  });

  describe("Send Message", () => {
    it("sends the exact request and preserves every returned message", async () => {
      const { calls, fetcher } = createRecordingFetcher(() =>
        jsonResponse(
          successEnvelope({
            session_id: "session/one",
            conversation_id: 9001,
            status: "COMPLETED",
            messages: [
              {
                content: "Transfer requested",
                message_id: 11,
                is_transfer: true,
                created_at: "2026-09-04T12:00:00Z",
              },
              {
                content: "Specialist ready",
                message_id: "12",
                is_transfer: false,
              },
            ],
            human_transfer_requested: true,
            request_id: "request-send",
          }),
        ),
      );

      const response = await sendNurixChatMessage(
        {
          ...connectionInput,
          sessionId: "session/one",
          message: "I need a specialist",
          inputVariables: { locale: "en-US" },
        },
        { fetcher, validateUrl: allowTestHost },
      );

      expect(response).toEqual({
        sessionId: "session/one",
        conversationId: "9001",
        status: "COMPLETED",
        messages: [
          {
            content: "Transfer requested",
            messageId: "11",
            isTransfer: true,
          },
          {
            content: "Specialist ready",
            messageId: "12",
            isTransfer: false,
          },
        ],
        humanTransferRequested: true,
      });

      const call = getOnlyCall(calls);
      expect(call.input.toString()).toBe(
        "https://chat.example.test/v2/chat/CHAT%20WIDGET/account%2Fone/session/session%2Fone/message",
      );
      expect(call.init?.method).toBe("POST");
      expect(call.init?.redirect).toBe("manual");
      expect(readRequestBody(call.init)).toEqual({
        message: "I need a specialist",
        input_variables: { locale: "en-US" },
      });

      const headers = new Headers(call.init?.headers);
      expect(headers.get("X-Api-Key")).toBe(connectionInput.apiKey);
      expect(headers.get("Origin")).toBe("https://www.jomashop.test");
      expect(headers.get("Content-Type")).toBe("application/json");
    });

    const emptyMessageStatuses: NurixChatStatus[] = [
      "NO_REPLY",
      "HUMAN_TRANSFERRED",
      "ROUTED_TO_JOURNEY",
    ];

    it.each(
      emptyMessageStatuses,
    )("accepts the %s status without inventing a reply", async (status) => {
      const fetcher = createRecordingFetcher(() =>
        jsonResponse(
          successEnvelope({
            session_id: "session-1",
            conversation_id: "conversation-1",
            status,
            messages: [],
            human_transfer_requested: false,
          }),
        ),
      ).fetcher;

      await expect(
        sendNurixChatMessage(
          {
            ...connectionInput,
            sessionId: "session-1",
            message: "Hello",
          },
          { fetcher, validateUrl: allowTestHost },
        ),
      ).resolves.toMatchObject({ status, messages: [] });
    });

    it("rejects non-boolean transfer fields when they are present", async () => {
      for (const data of [
        {
          session_id: "session-1",
          conversation_id: "conversation-1",
          status: "COMPLETED",
          messages: [
            {
              content: "Specialist ready",
              message_id: "message-1",
              is_transfer: "true",
            },
          ],
          human_transfer_requested: false,
        },
        {
          session_id: "session-1",
          conversation_id: "conversation-1",
          status: "COMPLETED",
          messages: [
            {
              content: "Specialist ready",
              message_id: "message-1",
              is_transfer: false,
            },
          ],
          human_transfer_requested: "true",
        },
      ]) {
        const error = await captureNurixError(
          sendNurixChatMessage(
            {
              ...connectionInput,
              sessionId: "session-1",
              message: "Hello",
            },
            {
              fetcher: async () => jsonResponse(successEnvelope(data)),
              validateUrl: allowTestHost,
            },
          ),
        );

        expect(error.code).toBe("INVALID_RESPONSE");
      }
    });
  });

  describe("End Session", () => {
    it("uses DELETE without a body and accepts closed false", async () => {
      const { calls, fetcher } = createRecordingFetcher(() =>
        jsonResponse(
          successEnvelope({
            closed: false,
            request_id: "request-end",
          }),
        ),
      );

      await expect(
        endNurixSession(
          { ...connectionInput, sessionId: "session/one" },
          { fetcher, validateUrl: allowTestHost },
        ),
      ).resolves.toEqual({ closed: false });

      const call = getOnlyCall(calls);
      expect(call.input.toString()).toBe(
        "https://chat.example.test/v2/chat/CHAT%20WIDGET/account%2Fone/session/session%2Fone",
      );
      expect(call.init?.method).toBe("DELETE");
      expect(call.init?.redirect).toBe("manual");
      expect(call.init?.body).toBeUndefined();

      const headers = new Headers(call.init?.headers);
      expect(headers.get("X-Api-Key")).toBe(connectionInput.apiKey);
      expect(headers.get("Origin")).toBe("https://www.jomashop.test");
      expect(headers.has("Content-Type")).toBe(false);
    });
  });

  describe("failures", () => {
    const httpErrorCases: Array<{
      httpStatus: number;
      code: string;
      retryable: boolean;
    }> = [
      { httpStatus: 400, code: "BAD_REQUEST", retryable: false },
      { httpStatus: 401, code: "UNAUTHORIZED", retryable: false },
      { httpStatus: 403, code: "FORBIDDEN", retryable: false },
      { httpStatus: 404, code: "SESSION_NOT_FOUND", retryable: false },
      { httpStatus: 409, code: "CONFLICT", retryable: true },
      { httpStatus: 422, code: "VALIDATION_ERROR", retryable: false },
      { httpStatus: 429, code: "RATE_LIMITED", retryable: true },
      { httpStatus: 500, code: "SERVER_ERROR", retryable: true },
      { httpStatus: 504, code: "REPLY_TIMEOUT", retryable: true },
    ];

    it.each(
      httpErrorCases,
    )("maps HTTP $httpStatus to $code without retrying", async ({
      httpStatus,
      code,
      retryable,
    }) => {
      const { calls, fetcher } = createRecordingFetcher(() =>
        jsonResponse(
          { detail: "Documented Nurix error", request_id: "request-error" },
          httpStatus,
        ),
      );

      const error = await captureNurixError(
        sendNurixChatMessage(
          {
            ...connectionInput,
            sessionId: "session-1",
            message: "Hello",
          },
          { fetcher, validateUrl: allowTestHost },
        ),
      );

      expect(error).toMatchObject({ code, httpStatus, retryable });
      expect(error.detail).toBe("Documented Nurix error");
      expect(calls).toHaveLength(1);
    });

    it("rejects dot-only path identifiers before making a request", async () => {
      const { calls, fetcher } = createRecordingFetcher(() =>
        jsonResponse(successEnvelope({})),
      );

      const error = await captureNurixError(
        sendNurixChatMessage(
          {
            ...connectionInput,
            sessionId: "..",
            message: "Hello",
          },
          { fetcher, validateUrl: allowTestHost },
        ),
      );

      expect(error.code).toBe("INVALID_CONFIGURATION");
      expect(calls).toHaveLength(0);
    });

    it("times out quickly with an injected timeout and only one attempt", async () => {
      const { calls, fetcher } = createRecordingFetcher(waitForAbort);
      const startTime = performance.now();

      const error = await captureNurixError(
        sendNurixChatMessage(
          {
            ...connectionInput,
            sessionId: "session-1",
            message: "Wait for me",
          },
          { fetcher, timeoutMs: 5, validateUrl: allowTestHost },
        ),
      );

      expect(error).toMatchObject({
        code: "TIMEOUT",
        httpStatus: null,
        retryable: true,
      });
      expect(performance.now() - startTime).toBeLessThan(500);
      expect(calls).toHaveLength(1);
    });

    it("does not advertise a post-response timeout as safe to retry", async () => {
      const { calls, fetcher } = createRecordingFetcher(
        () =>
          new Response(
            new ReadableStream<Uint8Array>({
              pull: () => new Promise<void>(() => undefined),
            }),
            {
              headers: { "Content-Type": "application/json" },
            },
          ),
      );

      const error = await captureNurixError(
        sendNurixChatMessage(
          {
            ...connectionInput,
            sessionId: "session-1",
            message: "Wait for the body",
          },
          { fetcher, timeoutMs: 5, validateUrl: allowTestHost },
        ),
      );

      expect(error).toMatchObject({
        code: "TIMEOUT",
        httpStatus: 200,
        retryable: false,
        detail: "Nurix Chat did not return a response within 5 milliseconds.",
      });
      expect(calls).toHaveLength(1);
    });

    it("does not advertise a failed success-body read as safe to retry", async () => {
      const { fetcher } = createRecordingFetcher(
        () =>
          new Response(
            new ReadableStream<Uint8Array>({
              start: (controller) => {
                controller.error(new Error("stream failed"));
              },
            }),
            {
              headers: { "Content-Type": "application/json" },
            },
          ),
      );

      const error = await captureNurixError(
        sendNurixChatMessage(
          {
            ...connectionInput,
            sessionId: "session-1",
            message: "Read the response",
          },
          { fetcher, validateUrl: allowTestHost },
        ),
      );

      expect(error).toMatchObject({
        code: "TRANSPORT_ERROR",
        httpStatus: 200,
        retryable: false,
      });
    });

    it("classifies redirects without following them", async () => {
      const { calls, fetcher } = createRecordingFetcher(
        () =>
          new Response(null, {
            status: 307,
            headers: { Location: "https://other.example.test" },
          }),
      );

      const error = await captureNurixError(
        sendNurixChatMessage(
          {
            ...connectionInput,
            sessionId: "session-1",
            message: "Do not redirect",
          },
          { fetcher, validateUrl: allowTestHost },
        ),
      );

      expect(error).toMatchObject({
        code: "REDIRECT",
        httpStatus: 307,
        retryable: false,
      });
      expect(getOnlyCall(calls).init?.redirect).toBe("manual");
    });

    it("does not retry or expose secrets after a transport failure", async () => {
      const { calls, fetcher } = createRecordingFetcher(() => {
        throw new Error(
          `${connectionInput.apiKey}:${connectionInput.origin}:private message`,
        );
      });

      const error = await captureNurixError(
        sendNurixChatMessage(
          {
            ...connectionInput,
            sessionId: "session-1",
            message: "private message",
          },
          { fetcher, validateUrl: allowTestHost },
        ),
      );

      expect(error).toMatchObject({
        code: "TRANSPORT_ERROR",
        httpStatus: null,
        retryable: true,
      });
      expect(error.detail).not.toContain(connectionInput.apiKey);
      expect(error.detail).not.toContain(connectionInput.origin);
      expect(error.detail).not.toContain("private message");
      expect(calls).toHaveLength(1);
    });

    it("rejects a declared response larger than 64 KiB", async () => {
      const { fetcher } = createRecordingFetcher(
        () =>
          new Response("{}", {
            headers: {
              "Content-Length": "65537",
              "Content-Type": "application/json",
            },
          }),
      );

      const error = await captureNurixError(
        sendNurixChatMessage(
          {
            ...connectionInput,
            sessionId: "session-1",
            message: "Hello",
          },
          { fetcher, validateUrl: allowTestHost },
        ),
      );

      expect(error.code).toBe("RESPONSE_TOO_LARGE");
    });

    it("enforces the 64 KiB limit while streaming and cancels the reader", async () => {
      const streamedResponse = createOversizedStreamingResponse();
      const { fetcher } = createRecordingFetcher(
        () => streamedResponse.response,
      );

      const error = await captureNurixError(
        sendNurixChatMessage(
          {
            ...connectionInput,
            sessionId: "session-1",
            message: "Hello",
          },
          { fetcher, validateUrl: allowTestHost },
        ),
      );

      expect(error.code).toBe("RESPONSE_TOO_LARGE");
      expect(streamedResponse.wasCancelled()).toBe(true);
    });

    it("rejects invalid JSON and malformed success envelopes", async () => {
      const invalidJsonError = await captureNurixError(
        sendNurixChatMessage(
          {
            ...connectionInput,
            sessionId: "session-1",
            message: "Hello",
          },
          {
            fetcher: async () =>
              new Response("not-json", {
                headers: { "Content-Type": "application/json" },
              }),
            validateUrl: allowTestHost,
          },
        ),
      );
      expect(invalidJsonError.code).toBe("INVALID_JSON");

      const malformedEnvelopeError = await captureNurixError(
        sendNurixChatMessage(
          {
            ...connectionInput,
            sessionId: "session-1",
            message: "Hello",
          },
          {
            fetcher: async () =>
              jsonResponse(successEnvelope({ status: "COMPLETED" })),
            validateUrl: allowTestHost,
          },
        ),
      );
      expect(malformedEnvelopeError.code).toBe("INVALID_RESPONSE");
    });
  });
});

type FetchInput = Parameters<NurixChatFetch>[0];
type FetchInit = Parameters<NurixChatFetch>[1];
type FetchCall = { readonly input: FetchInput; readonly init: FetchInit };
type FetchHandler = (
  input: FetchInput,
  init: FetchInit,
) => Promise<Response> | Response;

const createRecordingFetcher = (handle: FetchHandler) => {
  const calls: FetchCall[] = [];
  const fetcher: NurixChatFetch = async (input, init) => {
    calls.push({ input, init });
    return handle(input, init);
  };
  return { calls, fetcher };
};

const jsonResponse = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const successEnvelope = (data: unknown) => ({
  success: true,
  message: null,
  data,
  error_code: null,
  trace_id: "ignored-test-field",
});

const getOnlyCall = (calls: ReadonlyArray<FetchCall>) => {
  expect(calls).toHaveLength(1);
  const call = calls[0];
  if (!call) throw new Error("Expected one Nurix request.");
  return call;
};

const readRequestBody = (init: FetchInit): unknown => {
  if (typeof init?.body !== "string")
    throw new Error("Expected a JSON request body.");
  return JSON.parse(init.body);
};

const waitForAbort: FetchHandler = (_input, init) => {
  const signal = init?.signal;
  if (!signal) throw new Error("Expected the request to have an AbortSignal.");

  return new Promise<Response>((_resolve, reject) => {
    const rejectForAbort = () =>
      reject(new DOMException("Aborted", "AbortError"));
    if (signal.aborted) rejectForAbort();
    else signal.addEventListener("abort", rejectForAbort, { once: true });
  });
};

const captureNurixError = async (operation: Promise<unknown>) => {
  try {
    await operation;
  } catch (error) {
    if (error instanceof NurixChatError) return error;
    throw error;
  }
  throw new Error("Expected the Nurix operation to fail.");
};

const createOversizedStreamingResponse = () => {
  const chunks = [new Uint8Array(40_000), new Uint8Array(40_000)];
  let chunkIndex = 0;
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[chunkIndex++];
      if (chunk) controller.enqueue(chunk);
    },
    cancel() {
      cancelled = true;
    },
  });

  return {
    response: new Response(body, {
      headers: { "Content-Type": "application/json" },
    }),
    wasCancelled: () => cancelled,
  };
};
