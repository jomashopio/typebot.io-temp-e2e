import { describe, expect, it } from "bun:test";
import type { LogsStore, VariableStore } from "@typebot.io/forge/types";
import { NurixChatError } from "../types";
import {
  handleNurixChatError,
  parseConnectionCredentials,
  parseOptionalJsonObject,
  setMappedVariables,
} from "./handlerUtils";

describe("Nurix Chat handler utilities", () => {
  it("normalizes connection credentials and supplies the default channel", () => {
    expect(
      parseConnectionCredentials({
        apiKey: " test-api-key ",
        baseUrl: " https://chat.nurixlabs.tech ",
        accountId: " account-1 ",
        origin: " https://www.jomashop.com ",
      }),
    ).toEqual({
      apiKey: "test-api-key",
      baseUrl: "https://chat.nurixlabs.tech",
      accountId: "account-1",
      channelName: "CHAT_WIDGET",
      origin: "https://www.jomashop.com",
    });
  });

  it("parses only JSON objects for optional request context", () => {
    expect(
      parseOptionalJsonObject(
        '{"locale":"en-US","customer":{"tier":3}}',
        "Input variables",
      ),
    ).toEqual({ locale: "en-US", customer: { tier: 3 } });
    expect(parseOptionalJsonObject("   ", "Input variables")).toBeUndefined();

    for (const invalidJson of ["not-json", "[]", "null", '"value"']) {
      const error = captureNurixError(() =>
        parseOptionalJsonObject(invalidJson, "Input variables"),
      );
      expect(error).toMatchObject({
        code: "INVALID_CONFIGURATION",
        retryable: false,
        detail: "Input variables must be a valid JSON object.",
      });
    }
  });

  it("maps known response values and skips unavailable outputs", () => {
    const variableStore = createVariableStore();

    setMappedVariables({
      responseMapping: [
        { item: "Message", variableId: "joined" },
        { item: "Messages", variableId: "messages" },
        { item: "Message IDs", variableId: "message-ids" },
        { item: "Messages JSON", variableId: "messages-json" },
        { variableId: "default-message" },
        { item: "Unknown", variableId: "unknown" },
        { item: "Message" },
      ],
      defaultItem: "Message",
      outputValues: {
        Message: "Transfer requested\n\nSpecialist ready",
        Messages: ["Transfer requested", "Specialist ready"],
        "Message IDs": ["11", "12"],
        "Messages JSON":
          '[{"content":"Transfer requested","messageId":"11","isTransfer":true},{"content":"Specialist ready","messageId":"12","isTransfer":false}]',
      },
      variables: variableStore.store,
    });

    expect(variableStore.updates).toEqual([
      { id: "joined", value: "Transfer requested\n\nSpecialist ready" },
      {
        id: "messages",
        value: ["Transfer requested", "Specialist ready"],
      },
      { id: "message-ids", value: ["11", "12"] },
      {
        id: "messages-json",
        value:
          '[{"content":"Transfer requested","messageId":"11","isTransfer":true},{"content":"Specialist ready","messageId":"12","isTransfer":false}]',
      },
      {
        id: "default-message",
        value: "Transfer requested\n\nSpecialist ready",
      },
    ]);
  });

  it("clears success outputs and exposes safe error fields for flow branching", () => {
    const variableStore = createVariableStore();
    const logsStore = createLogsStore();
    const error = new NurixChatError({
      code: "SESSION_NOT_FOUND",
      httpStatus: 404,
      retryable: false,
      detail: "The Nurix Chat session does not exist or has expired.",
    });

    handleNurixChatError({
      error,
      context: "While sending a Nurix Chat message",
      responseMapping: [
        { item: "Message", variableId: "message" },
        { item: "Messages", variableId: "messages" },
        { item: "Conversation ID", variableId: "conversation" },
        { item: "Request Succeeded", variableId: "succeeded" },
        { item: "HTTP Status", variableId: "http-status" },
        { item: "Error Code", variableId: "error-code" },
        { item: "Error Detail", variableId: "error-detail" },
        { item: "Retryable", variableId: "retryable" },
      ],
      defaultItem: "Message",
      successOutputNames: ["Message", "Messages", "Conversation ID"],
      variables: variableStore.store,
      logs: logsStore.store,
    });

    expect(variableStore.updates).toEqual([
      { id: "message", value: null },
      { id: "messages", value: null },
      { id: "conversation", value: null },
      { id: "succeeded", value: false },
      { id: "http-status", value: 404 },
      { id: "error-code", value: "SESSION_NOT_FOUND" },
      {
        id: "error-detail",
        value: "The Nurix Chat session does not exist or has expired.",
      },
      { id: "retryable", value: false },
    ]);
    expect(logsStore.logs).toEqual([
      {
        status: "error",
        context: "While sending a Nurix Chat message",
        description:
          "Nurix Chat request failed with HTTP 404 (SESSION_NOT_FOUND).",
      },
    ]);
  });

  it("sanitizes unexpected handler errors before mapping or logging them", () => {
    const variableStore = createVariableStore();
    const logsStore = createLogsStore();

    handleNurixChatError({
      error: new Error("api-key-sentinel:private customer message"),
      context: "While sending a Nurix Chat message",
      responseMapping: [
        { item: "Error Code", variableId: "error-code" },
        { item: "Error Detail", variableId: "error-detail" },
        { item: "Retryable", variableId: "retryable" },
      ],
      defaultItem: "Message",
      successOutputNames: ["Message"],
      variables: variableStore.store,
      logs: logsStore.store,
    });

    const serializedUpdates = JSON.stringify(variableStore.updates);
    const serializedLogs = JSON.stringify(logsStore.logs);
    expect(serializedUpdates).not.toContain("api-key-sentinel");
    expect(serializedUpdates).not.toContain("private customer message");
    expect(serializedLogs).not.toContain("api-key-sentinel");
    expect(serializedLogs).not.toContain("private customer message");
    expect(variableStore.updates).toEqual([
      { id: "error-code", value: "TRANSPORT_ERROR" },
      {
        id: "error-detail",
        value: "An unexpected Nurix Chat error occurred.",
      },
      { id: "retryable", value: false },
    ]);
  });
});

const createVariableStore = () => {
  const updates: Array<{ id: string; value: unknown }> = [];
  const store = {
    get: () => undefined,
    set: (variables: Array<{ id: string; value: unknown }>) => {
      updates.push(...variables);
    },
    parse: (value: string) => value,
    list: () => [],
  } satisfies VariableStore;
  return { store, updates };
};

const createLogsStore = () => {
  const logs: Array<Parameters<LogsStore["add"]>[0]> = [];
  const store = {
    add: (log: Parameters<LogsStore["add"]>[0]) => {
      logs.push(log);
    },
  } satisfies LogsStore;
  return { store, logs };
};

const captureNurixError = (operation: () => unknown) => {
  try {
    operation();
  } catch (error) {
    if (error instanceof NurixChatError) return error;
    throw error;
  }
  throw new Error("Expected a NurixChatError.");
};
