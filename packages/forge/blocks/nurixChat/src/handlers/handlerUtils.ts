import type { LogsStore, VariableStore } from "@typebot.io/forge/types";
import { Schema } from "effect";
import { NurixChatError } from "../types";

type ConnectionCredentials = {
  readonly apiKey?: string;
  readonly baseUrl?: string;
  readonly accountId?: string;
  readonly channelName?: string;
  readonly origin?: string;
};

type ResponseMapping = ReadonlyArray<{
  readonly item?: string;
  readonly variableId?: string;
}>;

const nonBlankStringSchema = Schema.String.check(Schema.isPattern(/\S/));
const jsonObjectFromStringSchema = Schema.fromJsonString(
  Schema.Record(Schema.String, Schema.Json),
);

export const parseConnectionCredentials = (
  credentials: ConnectionCredentials,
) => ({
  apiKey: parseRequiredString(credentials.apiKey, "API key"),
  baseUrl: parseRequiredString(credentials.baseUrl, "Base URL"),
  accountId: parseRequiredString(credentials.accountId, "Account ID"),
  channelName: parseRequiredString(
    credentials.channelName?.trim() || "CHAT_WIDGET",
    "Channel name",
  ),
  origin: parseRequiredString(credentials.origin, "Origin"),
});

export const parseRequiredString = (
  value: string | undefined,
  label: string,
) => {
  try {
    return Schema.decodeUnknownSync(nonBlankStringSchema)(value).trim();
  } catch {
    throw invalidConfiguration(`${label} is required.`);
  }
};

export const parseOptionalString = (value: string | undefined) => {
  const normalizedValue = value?.trim();
  return normalizedValue ? normalizedValue : undefined;
};

export const parseOptionalJsonObject = (
  value: string | undefined,
  label: string,
) => {
  const normalizedValue = value?.trim();
  if (!normalizedValue) return undefined;

  try {
    return Schema.decodeUnknownSync(jsonObjectFromStringSchema)(
      normalizedValue,
    );
  } catch {
    throw invalidConfiguration(`${label} must be a valid JSON object.`);
  }
};

export const setMappedVariables = ({
  responseMapping,
  defaultItem,
  outputValues,
  variables,
}: {
  responseMapping: ResponseMapping | undefined;
  defaultItem: string;
  outputValues: Readonly<Record<string, unknown>>;
  variables: VariableStore;
}) => {
  const variableUpdates =
    responseMapping?.flatMap((mapping) => {
      if (!mapping.variableId) return [];
      const outputName = mapping.item ?? defaultItem;
      if (!Object.hasOwn(outputValues, outputName)) return [];

      return [
        {
          id: mapping.variableId,
          value: outputValues[outputName] ?? null,
        },
      ];
    }) ?? [];

  if (variableUpdates.length > 0) variables.set(variableUpdates);
};

export const createErrorOutputValues = (
  successOutputNames: ReadonlyArray<string>,
  error: NurixChatError,
) => {
  const outputValues: Record<string, unknown> = {
    "Request Succeeded": false,
    "HTTP Status": error.httpStatus,
    "Error Code": error.code,
    "Error Detail": error.detail,
    Retryable: error.retryable,
  };

  for (const outputName of successOutputNames) outputValues[outputName] = null;

  return outputValues;
};

export const handleNurixChatError = ({
  error,
  context,
  responseMapping,
  defaultItem,
  successOutputNames,
  variables,
  logs,
}: {
  error: unknown;
  context: string;
  responseMapping: ResponseMapping | undefined;
  defaultItem: string;
  successOutputNames: ReadonlyArray<string>;
  variables: VariableStore;
  logs: LogsStore;
}) => {
  const normalizedError =
    error instanceof NurixChatError
      ? error
      : new NurixChatError({
          code: "TRANSPORT_ERROR",
          httpStatus: null,
          retryable: false,
          detail: "An unexpected Nurix Chat error occurred.",
        });

  setMappedVariables({
    responseMapping,
    defaultItem,
    outputValues: createErrorOutputValues(successOutputNames, normalizedError),
    variables,
  });
  logs.add({
    status: "error",
    context,
    description:
      normalizedError.code === "INVALID_CONFIGURATION"
        ? normalizedError.detail
        : normalizedError.httpStatus === null
          ? `Nurix Chat request failed (${normalizedError.code}).`
          : `Nurix Chat request failed with HTTP ${normalizedError.httpStatus} (${normalizedError.code}).`,
  });
};

const invalidConfiguration = (detail: string) =>
  new NurixChatError({
    code: "INVALID_CONFIGURATION",
    httpStatus: null,
    retryable: false,
    detail,
  });
