import { Effect, Option, Schema } from "effect";
import {
  nurixChatMaxResponseBytes,
  nurixChatRequestTimeoutMs,
} from "./constants";
import { nurixChatErrorResponseSchema } from "./nurixChatHttpSchemas";
import {
  NurixChatError,
  type NurixChatErrorCode,
  type NurixChatRuntimeOptions,
} from "./types";

type Props = {
  readonly url: URL;
  readonly apiKey: string;
  readonly origin: string;
  readonly method: "POST" | "DELETE";
  readonly expectedStatus: 200 | 201;
  readonly body?: Schema.JsonObject;
};

export const requestNurixChat = Effect.fn("requestNurixChat")(function* (
  props: Props,
  runtimeOptions: NurixChatRuntimeOptions = {},
): Effect.fn.Return<unknown, NurixChatError> {
  const timeoutMs = yield* validateTimeout(
    runtimeOptions.timeoutMs ?? nurixChatRequestTimeoutMs,
  );
  const requestBody =
    props.body === undefined ? undefined : yield* serializeBody(props.body);
  let responseStatus: number | undefined;

  return yield* executeRequest(
    props,
    requestBody,
    runtimeOptions.fetcher ?? globalThis.fetch,
    (status) => {
      responseStatus = status;
    },
  ).pipe(
    Effect.timeoutOrElse({
      duration: timeoutMs,
      onTimeout: () =>
        Effect.fail(
          new NurixChatError({
            code: "TIMEOUT",
            httpStatus: responseStatus ?? null,
            retryable:
              responseStatus === undefined ||
              isSafeToRetryAfterResponse(props.method, responseStatus),
            detail: `Nurix Chat did not return a response within ${formatTimeout(timeoutMs)}.`,
          }),
        ),
    }),
  );
});

const executeRequest = Effect.fn("executeNurixChatRequest")(function* (
  props: Props,
  body: string | undefined,
  fetcher: NonNullable<NurixChatRuntimeOptions["fetcher"]>,
  onResponse: (status: number) => void,
): Effect.fn.Return<unknown, NurixChatError> {
  const response = yield* Effect.tryPromise({
    try: (signal) =>
      fetcher(
        props.url,
        body === undefined
          ? {
              method: props.method,
              headers: createHeaders(props, false),
              redirect: "manual",
              signal,
            }
          : {
              method: props.method,
              headers: createHeaders(props, true),
              redirect: "manual",
              signal,
              body,
            },
      ),
    catch: () =>
      new NurixChatError({
        code: "TRANSPORT_ERROR",
        httpStatus: null,
        retryable: true,
        detail: "Could not connect to the Nurix Chat API.",
      }),
  });
  onResponse(response.status);

  if (
    response.redirected ||
    response.type === "opaqueredirect" ||
    (response.status >= 300 && response.status < 400)
  )
    return yield* new NurixChatError({
      code: "REDIRECT",
      httpStatus: response.status === 0 ? null : response.status,
      retryable: false,
      detail: "Nurix Chat returned a redirect, which is not allowed.",
    });

  const responseText = yield* readResponseText(
    response,
    isSafeToRetryAfterResponse(props.method, response.status),
  );
  if (response.status !== props.expectedStatus)
    return yield* makeHttpError(response.status, responseText);

  if (!isJsonContentType(response.headers.get("content-type")))
    return yield* new NurixChatError({
      code: "INVALID_RESPONSE",
      httpStatus: response.status,
      retryable: false,
      detail: "Nurix Chat returned a non-JSON success response.",
    });

  return yield* parseJson(responseText, response.status);
});

const readResponseText = Effect.fn("readNurixChatResponseText")(function* (
  response: Response,
  retryable: boolean,
): Effect.fn.Return<string, NurixChatError> {
  const declaredLength = response.headers.get("content-length");
  if (
    declaredLength !== null &&
    Number.isFinite(Number(declaredLength)) &&
    Number(declaredLength) > nurixChatMaxResponseBytes
  )
    return yield* responseTooLarge(response.status);

  const readResult = yield* Effect.tryPromise({
    try: async (signal): Promise<ReadBodyResult> => {
      if (response.body === null) return { type: "complete", text: "" };

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let totalBytes = 0;
      let text = "";
      const cancelReader = () => {
        void reader.cancel().catch(() => undefined);
      };
      signal.addEventListener("abort", cancelReader, { once: true });

      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          if (chunk.value === undefined) continue;

          totalBytes += chunk.value.byteLength;
          if (totalBytes > nurixChatMaxResponseBytes) {
            await reader.cancel().catch(() => undefined);
            return { type: "too-large" };
          }
          text += decoder.decode(chunk.value, { stream: true });
        }
        return { type: "complete", text: text + decoder.decode() };
      } finally {
        signal.removeEventListener("abort", cancelReader);
      }
    },
    catch: () =>
      new NurixChatError({
        code: "TRANSPORT_ERROR",
        httpStatus: response.status,
        retryable,
        detail: "Could not read the Nurix Chat response.",
      }),
  });

  if (readResult.type === "too-large")
    return yield* responseTooLarge(response.status);
  return readResult.text;
});

const parseJson = Effect.fn("parseNurixChatJson")(function* (
  responseText: string,
  httpStatus: number,
): Effect.fn.Return<unknown, NurixChatError> {
  return yield* Effect.try({
    try: (): unknown => JSON.parse(responseText),
    catch: () =>
      new NurixChatError({
        code: "INVALID_JSON",
        httpStatus,
        retryable: false,
        detail: "Nurix Chat returned invalid JSON.",
      }),
  });
});

const makeHttpError = Effect.fn("makeNurixChatHttpError")(function* (
  httpStatus: number,
  responseText: string,
): Effect.fn.Return<never, NurixChatError> {
  const documentedError = parseDocumentedError(responseText);
  const mappedError = mapHttpStatus(httpStatus);
  return yield* new NurixChatError({
    code: mappedError.code,
    httpStatus,
    retryable: mappedError.retryable,
    detail: Option.isSome(documentedError)
      ? documentedError.value.detail
      : `${mappedError.detail} The error response was not in the documented format.`,
  });
});

const serializeBody = (body: Schema.JsonObject) =>
  Effect.try({
    try: () => {
      const serializedBody = JSON.stringify(body);
      if (serializedBody === undefined)
        throw new Error("JSON serialization returned no value.");
      return serializedBody;
    },
    catch: () =>
      new NurixChatError({
        code: "INVALID_CONFIGURATION",
        httpStatus: null,
        retryable: false,
        detail: "Nurix Chat request data is not valid JSON.",
      }),
  });

const validateTimeout = (timeoutMs: number) =>
  Number.isFinite(timeoutMs) && timeoutMs > 0
    ? Effect.succeed(timeoutMs)
    : Effect.fail(
        new NurixChatError({
          code: "INVALID_CONFIGURATION",
          httpStatus: null,
          retryable: false,
          detail: "Nurix Chat timeout must be a positive number.",
        }),
      );

const responseTooLarge = (httpStatus: number) =>
  Effect.fail(
    new NurixChatError({
      code: "RESPONSE_TOO_LARGE",
      httpStatus,
      retryable: false,
      detail: "Nurix Chat returned a response larger than 64 KiB.",
    }),
  );

const parseDocumentedError = (responseText: string) => {
  let payload: unknown;
  try {
    payload = JSON.parse(responseText);
  } catch {
    return Option.none();
  }

  return Schema.decodeUnknownOption(nurixChatErrorResponseSchema)(payload);
};

const isJsonContentType = (contentType: string | null) =>
  contentType !== null &&
  /^application\/(?:[a-z0-9!#$&^_.+-]+\+)?json(?:\s*;|$)/i.test(contentType);

const createHeaders = (props: Props, hasBody: boolean) => {
  const headers = new Headers({
    Accept: "application/json",
    Origin: props.origin,
    "X-Api-Key": props.apiKey,
  });
  if (hasBody) headers.set("Content-Type", "application/json");
  return headers;
};

const mapHttpStatus = (
  httpStatus: number,
): {
  readonly code: NurixChatErrorCode;
  readonly retryable: boolean;
  readonly detail: string;
} => {
  switch (httpStatus) {
    case 400:
      return {
        code: "BAD_REQUEST",
        retryable: false,
        detail: "Nurix Chat rejected the request configuration.",
      };
    case 401:
      return {
        code: "UNAUTHORIZED",
        retryable: false,
        detail: "Nurix Chat authentication failed.",
      };
    case 403:
      return {
        code: "FORBIDDEN",
        retryable: false,
        detail: "The Nurix Chat API key cannot access this agent.",
      };
    case 404:
      return {
        code: "SESSION_NOT_FOUND",
        retryable: false,
        detail: "The Nurix Chat session does not exist or has expired.",
      };
    case 409:
      return {
        code: "CONFLICT",
        retryable: true,
        detail: "The previous Nurix Chat turn is still in progress.",
      };
    case 422:
      return {
        code: "VALIDATION_ERROR",
        retryable: false,
        detail: "Nurix Chat rejected the request data.",
      };
    case 429:
      return {
        code: "RATE_LIMITED",
        retryable: true,
        detail: "Nurix Chat rate limited the request.",
      };
    case 500:
      return {
        code: "SERVER_ERROR",
        retryable: true,
        detail: "Nurix Chat encountered a server error.",
      };
    case 504:
      return {
        code: "REPLY_TIMEOUT",
        retryable: true,
        detail: "Nurix Chat did not finish the reply within 28 seconds.",
      };
    default:
      return httpStatus >= 500
        ? {
            code: "SERVER_ERROR",
            retryable: true,
            detail: "Nurix Chat encountered a server error.",
          }
        : {
            code: "HTTP_ERROR",
            retryable: false,
            detail: "Nurix Chat rejected the request.",
          };
  }
};

const isSafeToRetryAfterResponse = (
  method: Props["method"],
  httpStatus: number,
) =>
  (method === "DELETE" && httpStatus >= 200 && httpStatus < 300) ||
  mapHttpStatus(httpStatus).retryable;

const formatTimeout = (timeoutMs: number) =>
  timeoutMs % 1_000 === 0
    ? `${timeoutMs / 1_000} seconds`
    : `${timeoutMs} milliseconds`;

type ReadBodyResult =
  | { readonly type: "complete"; readonly text: string }
  | { readonly type: "too-large" };
