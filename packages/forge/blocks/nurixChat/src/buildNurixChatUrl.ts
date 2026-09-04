import { nurixChatApiPath } from "./constants";
import { NurixChatError, type NurixChatRuntimeOptions } from "./types";

type Props = {
  readonly baseUrl: string;
  readonly accountId: string;
  readonly channelName: string;
} & (
  | { readonly operation: "start" }
  | { readonly operation: "send"; readonly sessionId: string }
  | { readonly operation: "end"; readonly sessionId: string }
);

export const buildNurixChatUrl = (
  props: Props,
  runtimeOptions: Pick<NurixChatRuntimeOptions, "validateUrl"> = {},
) => {
  const baseUrl = parseBaseUrl(props.baseUrl);
  validateBaseUrlShape(baseUrl);
  validateAllowedHost(baseUrl, runtimeOptions.validateUrl);

  const sessionPath = `${nurixChatApiPath}/${encodePathSegment(props.channelName)}/${encodePathSegment(props.accountId)}/session`;
  const pathname =
    props.operation === "start"
      ? sessionPath
      : `${sessionPath}/${encodePathSegment(props.sessionId)}${
          props.operation === "send" ? "/message" : ""
        }`;
  const url = new URL(baseUrl.origin);
  url.pathname = pathname;
  return url;
};

export const normalizeNurixOrigin = (origin: string) => {
  const parsedOrigin = parseOrigin(origin);
  if (
    parsedOrigin.protocol !== "https:" ||
    parsedOrigin.username !== "" ||
    parsedOrigin.password !== "" ||
    parsedOrigin.pathname !== "/" ||
    parsedOrigin.search !== "" ||
    parsedOrigin.hash !== ""
  )
    throw invalidConfiguration("Nurix Chat Origin must be an HTTPS origin.");

  return parsedOrigin.origin;
};

const parseBaseUrl = (baseUrl: string) => {
  try {
    return new URL(baseUrl);
  } catch {
    throw invalidConfiguration("Nurix Chat base URL is invalid.");
  }
};

const parseOrigin = (origin: string) => {
  try {
    return new URL(origin);
  } catch {
    throw invalidConfiguration("Nurix Chat Origin is invalid.");
  }
};

const validateBaseUrlShape = (baseUrl: URL) => {
  if (
    baseUrl.protocol !== "https:" ||
    baseUrl.username !== "" ||
    baseUrl.password !== "" ||
    baseUrl.port !== "" ||
    baseUrl.pathname !== "/" ||
    baseUrl.search !== "" ||
    baseUrl.hash !== ""
  )
    throw new NurixChatError({
      code: "UNSAFE_URL",
      httpStatus: null,
      retryable: false,
      detail:
        "Nurix Chat base URL must be an HTTPS origin using the default port.",
    });
};

const validateAllowedHost = (
  baseUrl: URL,
  validateUrl: NurixChatRuntimeOptions["validateUrl"],
) => {
  let isAllowed = false;
  try {
    isAllowed = (validateUrl ?? isNurixOwnedHost)(baseUrl);
  } catch {
    isAllowed = false;
  }
  if (isAllowed) return;

  throw new NurixChatError({
    code: "UNSAFE_URL",
    httpStatus: null,
    retryable: false,
    detail: "Nurix Chat base URL is not an approved Nurix API host.",
  });
};

const isNurixOwnedHost = (url: URL) => {
  const hostname = url.hostname.toLowerCase();
  return hostname === "nurixlabs.tech" || hostname.endsWith(".nurixlabs.tech");
};

const encodePathSegment = (value: string) => {
  if (value === "." || value === "..")
    throw invalidConfiguration(
      "Nurix Chat path identifiers cannot be dot segments.",
    );

  return encodeURIComponent(value).replace(
    /[!'()*.]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
};

const invalidConfiguration = (detail: string) =>
  new NurixChatError({
    code: "INVALID_CONFIGURATION",
    httpStatus: null,
    retryable: false,
    detail,
  });
