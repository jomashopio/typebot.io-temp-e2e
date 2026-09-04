import { Effect, Schema } from "effect";
import {
  endNurixSessionInputSchema,
  endNurixSessionResponseSchema,
} from "./nurixChatHttpSchemas";
import { prepareNurixChatRequest } from "./prepareNurixChatRequest";
import { requestNurixChat } from "./requestNurixChat";
import {
  type EndNurixSessionInput,
  type EndNurixSessionResponse,
  NurixChatError,
  type NurixChatRuntimeOptions,
} from "./types";

export const endNurixSession = (
  input: EndNurixSessionInput,
  runtimeOptions: NurixChatRuntimeOptions = {},
): Promise<EndNurixSessionResponse> =>
  Effect.runPromise(endNurixSessionEffect(input, runtimeOptions));

const endNurixSessionEffect = Effect.fn("endNurixSession")(function* (
  untrustedInput: EndNurixSessionInput,
  runtimeOptions: NurixChatRuntimeOptions,
): Effect.fn.Return<EndNurixSessionResponse, NurixChatError> {
  const input = yield* Schema.decodeUnknownEffect(endNurixSessionInputSchema)(
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
      operation: "end",
      sessionId: input.sessionId,
    },
    runtimeOptions,
  );
  const payload = yield* requestNurixChat(
    {
      url: endpoint.url,
      apiKey: input.apiKey,
      origin: endpoint.origin,
      method: "DELETE",
      expectedStatus: 200,
    },
    runtimeOptions,
  );
  const response = yield* Schema.decodeUnknownEffect(
    endNurixSessionResponseSchema,
  )(payload).pipe(
    Effect.mapError(
      () =>
        new NurixChatError({
          code: "INVALID_RESPONSE",
          httpStatus: 200,
          retryable: false,
          detail: "Nurix Chat returned an invalid session-close response.",
        }),
    ),
  );

  return { closed: response.data.closed };
});
