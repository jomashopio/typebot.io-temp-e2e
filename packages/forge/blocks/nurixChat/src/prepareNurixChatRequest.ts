import { Effect } from "effect";
import { buildNurixChatUrl, normalizeNurixOrigin } from "./buildNurixChatUrl";
import { NurixChatError, type NurixChatRuntimeOptions } from "./types";

type Props = {
  readonly baseUrl: string;
  readonly accountId: string;
  readonly channelName: string;
  readonly origin: string;
} & (
  | { readonly operation: "start" }
  | { readonly operation: "send"; readonly sessionId: string }
  | { readonly operation: "end"; readonly sessionId: string }
);

export const prepareNurixChatRequest = Effect.fn("prepareNurixChatRequest")(
  function* (
    props: Props,
    runtimeOptions: Pick<NurixChatRuntimeOptions, "validateUrl">,
  ): Effect.fn.Return<PreparedNurixChatRequest, NurixChatError> {
    return yield* Effect.try({
      try: () => ({
        url: buildNurixChatUrl(props, runtimeOptions),
        origin: normalizeNurixOrigin(props.origin),
      }),
      catch: (error) =>
        error instanceof NurixChatError
          ? error
          : new NurixChatError({
              code: "INVALID_CONFIGURATION",
              httpStatus: null,
              retryable: false,
              detail: "Nurix Chat endpoint configuration is invalid.",
            }),
    });
  },
);

type PreparedNurixChatRequest = {
  readonly url: URL;
  readonly origin: string;
};
