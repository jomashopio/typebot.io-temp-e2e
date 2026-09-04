import { Schema } from "effect";

const nurixChatErrorCodeSchema = Schema.Literals([
  "INVALID_CONFIGURATION",
  "UNSAFE_URL",
  "TRANSPORT_ERROR",
  "TIMEOUT",
  "REDIRECT",
  "RESPONSE_TOO_LARGE",
  "INVALID_JSON",
  "INVALID_RESPONSE",
  "BAD_REQUEST",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "SESSION_NOT_FOUND",
  "CONFLICT",
  "VALIDATION_ERROR",
  "RATE_LIMITED",
  "SERVER_ERROR",
  "REPLY_TIMEOUT",
  "HTTP_ERROR",
]);

export class NurixChatError extends Schema.TaggedErrorClass<NurixChatError>()(
  "@typebot/NurixChatError",
  {
    code: nurixChatErrorCodeSchema,
    httpStatus: Schema.NullOr(Schema.Number),
    retryable: Schema.Boolean,
    detail: Schema.String,
  },
) {}

export type NurixChatErrorCode = typeof nurixChatErrorCodeSchema.Type;

export type NurixChatFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type NurixChatRuntimeOptions = {
  readonly fetcher?: NurixChatFetch;
  readonly timeoutMs?: number;
  readonly validateUrl?: (url: URL) => boolean;
};

type NurixChatConnectionInput = {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly accountId: string;
  readonly channelName: string;
  readonly origin: string;
};

export type StartNurixSessionInput = NurixChatConnectionInput & {
  readonly userId: string;
  readonly agentId?: string;
  readonly inputVariables?: Schema.JsonObject;
  readonly metadata?: Schema.JsonObject;
};

export type SendNurixChatMessageInput = NurixChatConnectionInput & {
  readonly sessionId: string;
  readonly message: string;
  readonly inputVariables?: Schema.JsonObject;
};

export type EndNurixSessionInput = NurixChatConnectionInput & {
  readonly sessionId: string;
};

export type NurixChatMessage = {
  readonly content: string;
  readonly messageId: string;
  readonly isTransfer: boolean;
};

export type NurixWelcomeMessage = NurixChatMessage;

export type StartNurixSessionResponse = {
  readonly sessionId: string;
  readonly conversationId: string;
  readonly agentId: string;
  readonly welcomeMessage: NurixWelcomeMessage | null;
};

export type NurixChatStatus =
  | "COMPLETED"
  | "NO_REPLY"
  | "HUMAN_TRANSFERRED"
  | "ROUTED_TO_JOURNEY";

export type SendNurixChatMessageResponse = {
  readonly sessionId: string;
  readonly conversationId: string;
  readonly status: NurixChatStatus;
  readonly messages: ReadonlyArray<NurixChatMessage>;
  readonly humanTransferRequested: boolean;
};

export type EndNurixSessionResponse = {
  readonly closed: boolean;
};
