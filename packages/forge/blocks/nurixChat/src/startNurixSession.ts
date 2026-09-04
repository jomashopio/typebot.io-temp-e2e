import { Effect, Schema } from "effect";
import {
  startNurixSessionInputSchema,
  startNurixSessionResponseSchema,
} from "./nurixChatHttpSchemas";
import { prepareNurixChatRequest } from "./prepareNurixChatRequest";
import { requestNurixChat } from "./requestNurixChat";
import {
  NurixChatError,
  type NurixChatRuntimeOptions,
  type StartNurixSessionInput,
  type StartNurixSessionResponse,
} from "./types";

export const startNurixSession = (
  input: StartNurixSessionInput,
  runtimeOptions: NurixChatRuntimeOptions = {},
): Promise<StartNurixSessionResponse> =>
  Effect.runPromise(startNurixSessionEffect(input, runtimeOptions));

const startNurixSessionEffect = Effect.fn("startNurixSession")(function* (
  untrustedInput: StartNurixSessionInput,
  runtimeOptions: NurixChatRuntimeOptions,
): Effect.fn.Return<StartNurixSessionResponse, NurixChatError> {
  const input = yield* Schema.decodeUnknownEffect(startNurixSessionInputSchema)(
    untrustedInput,
    { onExcessProperty: "error" },
  ).pipe(
    Effect.mapError(
      () =>
        new NurixChatError({
          code: "INVALID_CONFIGURATION",
          httpStatus: null,
          retryable: false,
          detail: "Nurix Chat session configuration is invalid.",
        }),
    ),
  );
  const endpoint = yield* prepareNurixChatRequest(
    {
      baseUrl: input.baseUrl,
      accountId: input.accountId,
      channelName: input.channelName,
      origin: input.origin,
      operation: "start",
    },
    runtimeOptions,
  );
  const requestBody = {
    user_id: input.userId,
    ...(input.agentId === undefined ? {} : { agent_id: input.agentId }),
    ...(input.inputVariables === undefined
      ? {}
      : { input_variables: input.inputVariables }),
    ...(input.metadata === undefined ? {} : { metadata: input.metadata }),
  };
  const payload = yield* requestNurixChat(
    {
      url: endpoint.url,
      apiKey: input.apiKey,
      origin: endpoint.origin,
      method: "POST",
      expectedStatus: 201,
      body: requestBody,
    },
    runtimeOptions,
  );
  const response = yield* Schema.decodeUnknownEffect(
    startNurixSessionResponseSchema,
  )(payload).pipe(
    Effect.mapError(
      () =>
        new NurixChatError({
          code: "INVALID_RESPONSE",
          httpStatus: 201,
          retryable: false,
          detail: "Nurix Chat returned an invalid session response.",
        }),
    ),
  );

  return {
    sessionId: String(response.data.session_id),
    conversationId: String(response.data.conversation_id),
    agentId: String(response.data.agent_id),
    welcomeMessage:
      response.data.welcome_message === null
        ? null
        : {
            content: response.data.welcome_message.content,
            messageId: String(response.data.welcome_message.message_id),
            isTransfer: response.data.welcome_message.is_transfer,
          },
  };
});
