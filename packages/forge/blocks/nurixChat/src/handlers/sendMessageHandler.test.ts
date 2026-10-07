import { afterEach, describe, expect, it } from "bun:test";
import type { LogsStore, VariableStore } from "@typebot.io/forge/types";
import { sendMessageHandler } from "./sendMessageHandler";

const originalFetch = globalThis.fetch;

describe("sendMessageHandler", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("maps an immediate-turn transfer independently from the top-level transfer request", async () => {
    globalThis.fetch = Object.assign(
      async () =>
        new Response(
          JSON.stringify({
            success: true,
            data: {
              session_id: "session-1",
              conversation_id: "conversation-1",
              status: "COMPLETED",
              messages: [
                {
                  content: "Your order shipped yesterday.",
                  message_id: 99304,
                  is_transfer: false,
                },
                {
                  content: "A specialist will take over.",
                  message_id: 99305,
                  is_transfer: true,
                },
              ],
              human_transfer_requested: false,
            },
            error_code: null,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      { preconnect: originalFetch.preconnect },
    );
    const updates: Array<{ id: string; value: unknown }> = [];
    const variables = {
      get: () => undefined,
      set: (values: Array<{ id: string; value: unknown }>) => {
        updates.push(...values);
      },
      parse: (value: string) => value,
      list: () => [],
    } satisfies VariableStore;
    const logs = {
      add: (_log: Parameters<LogsStore["add"]>[0]) => undefined,
    } satisfies LogsStore;

    if (!sendMessageHandler.server)
      throw new Error("Expected Send Message to have a server handler.");

    await Reflect.apply(sendMessageHandler.server, undefined, [
      {
        credentials: {
          apiKey: "test-api-key",
          baseUrl: "https://chat.nurixlabs.tech",
          accountId: "account-1",
          channelName: "CHAT_WIDGET",
          origin: "https://www.example.com",
        },
        options: {
          sessionId: "session-1",
          message: "Where is my order?",
          responseMapping: [
            { item: "Is Transfer", variableId: "is-transfer" },
            {
              item: "Human Transfer Requested",
              variableId: "human-transfer-requested",
            },
          ],
        },
        variables,
        logs,
      },
    ]);

    expect(updates).toEqual([
      { id: "is-transfer", value: true },
      { id: "human-transfer-requested", value: false },
    ]);
  });
});
