import { afterEach, describe, expect, it } from "bun:test";
import type { LogsStore, VariableStore } from "@typebot.io/forge/types";
import { sendMessageHandler } from "./sendMessageHandler";

const originalFetch = globalThis.fetch;

describe("sendMessageHandler", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("normalizes a current-message transfer into the legacy-compatible output", async () => {
    expect(
      await executeTransferMapping({
        messageTransferFlags: [undefined, true],
      }),
    ).toEqual([
      { id: "is-transfer", value: true },
      { id: "human-transfer-requested", value: true },
    ]);
  });

  it("preserves a legacy top-level transfer without marking the current messages", async () => {
    expect(
      await executeTransferMapping({
        messageTransferFlags: [undefined],
        humanTransferRequested: true,
      }),
    ).toEqual([
      { id: "is-transfer", value: false },
      { id: "human-transfer-requested", value: true },
    ]);
  });

  it("keeps both outputs false when both fields are present and false", async () => {
    expect(
      await executeTransferMapping({
        messageTransferFlags: [false],
        humanTransferRequested: false,
      }),
    ).toEqual([
      { id: "is-transfer", value: false },
      { id: "human-transfer-requested", value: false },
    ]);
  });
});

const executeTransferMapping = async ({
  messageTransferFlags,
  humanTransferRequested,
}: {
  messageTransferFlags: ReadonlyArray<boolean | undefined>;
  humanTransferRequested?: boolean;
}) => {
  globalThis.fetch = Object.assign(
    async () =>
      new Response(
        JSON.stringify({
          success: true,
          data: {
            session_id: "session-1",
            conversation_id: "conversation-1",
            status: "COMPLETED",
            messages: messageTransferFlags.map((isTransfer, index) => ({
              content: `Response ${index + 1}`,
              message_id: 99304 + index,
              ...(isTransfer === undefined ? {} : { is_transfer: isTransfer }),
            })),
            ...(humanTransferRequested === undefined
              ? {}
              : { human_transfer_requested: humanTransferRequested }),
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

  return updates;
};
