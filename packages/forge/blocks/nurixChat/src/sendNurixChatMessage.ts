import { Effect, Schema } from "effect";
import {
  sendNurixChatMessageInputSchema,
  sendNurixChatMessageResponseSchema,
} from "./nurixChatHttpSchemas";
import { prepareNurixChatRequest } from "./prepareNurixChatRequest";
import { requestNurixChat } from "./requestNurixChat";
import {
  NurixChatError,
  type NurixChatRuntimeOptions,
  type SendNurixChatMessageInput,
  type SendNurixChatMessageResponse,
} from "./types";

export const sendNurixChatMessage = (
  input: SendNurixChatMessageInput,
  runtimeOptions: NurixChatRuntimeOptions = {},
): Promise<SendNurixChatMessageResponse> =>
  Effect.runPromise(sendNurixChatMessageEffect(input, runtimeOptions));

const sendNurixChatMessageEffect = Effect.fn("sendNurixChatMessage")(function* (
  untrustedInput: SendNurixChatMessageInput,
  runtimeOptions: NurixChatRuntimeOptions,
): Effect.fn.Return<SendNurixChatMessageResponse, NurixChatError> {
  const input = yield* Schema.decodeUnknownEffect(
    sendNurixChatMessageInputSchema,
  )(untrustedInput, { onExcessProperty: "error" }).pipe(
    Effect.mapError(
      () =>
        new NurixChatError({
          code: "INVALID_CONFIGURATION",
          httpStatus: null,
          retryable: false,
          detail: "Nurix Chat message configuration is invalid.",
        }),
    ),
  );
  const endpoint = yield* prepareNurixChatRequest(
    {
      baseUrl: input.baseUrl,
      accountId: input.accountId,
      channelName: input.channelName,
      origin: input.origin,
      operation: "send",
      sessionId: input.sessionId,
    },
    runtimeOptions,
  );
  const requestBody = {
    message: input.message,
    ...(input.inputVariables === undefined
      ? {}
      : { input_variables: input.inputVariables }),
  };
  const payload = yield* requestNurixChat(
    {
      url: endpoint.url,
      apiKey: input.apiKey,
      origin: endpoint.origin,
      method: "POST",
      expectedStatus: 200,
      body: requestBody,
    },
    runtimeOptions,
  );
  const response = yield* Schema.decodeUnknownEffect(
    sendNurixChatMessageResponseSchema,
  )(payload).pipe(
    Effect.mapError(
      () =>
        new NurixChatError({
          code: "INVALID_RESPONSE",
          httpStatus: 200,
          retryable: false,
          detail: "Nurix Chat returned an invalid message response.",
        }),
    ),
  );

  return {
    sessionId: String(response.data.session_id),
    conversationId: String(response.data.conversation_id),
    status: response.data.status,
    messages: response.data.messages.map((message) => ({
      content: message.content,
      messageId: String(message.message_id),
      isTransfer: message.is_transfer,
    })),
    humanTransferRequested: response.data.human_transfer_requested,
  };
});
