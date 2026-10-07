import { Schema } from "effect";

const identifierSchema = Schema.Union([Schema.NonEmptyString, Schema.Finite]);
const jsonObjectSchema = Schema.Record(Schema.String, Schema.Json);
const requiredTextSchema = Schema.String.check(Schema.isPattern(/\S/));

const connectionFields = {
  apiKey: Schema.NonEmptyString,
  baseUrl: Schema.NonEmptyString,
  accountId: Schema.NonEmptyString,
  channelName: Schema.NonEmptyString,
  origin: Schema.NonEmptyString,
};

export const startNurixSessionInputSchema = Schema.Struct({
  ...connectionFields,
  userId: Schema.NonEmptyString,
  agentId: Schema.optionalKey(Schema.NonEmptyString),
  inputVariables: Schema.optionalKey(jsonObjectSchema),
  metadata: Schema.optionalKey(jsonObjectSchema),
});

export const sendNurixChatMessageInputSchema = Schema.Struct({
  ...connectionFields,
  sessionId: Schema.NonEmptyString,
  message: requiredTextSchema,
  inputVariables: Schema.optionalKey(jsonObjectSchema),
});

export const endNurixSessionInputSchema = Schema.Struct({
  ...connectionFields,
  sessionId: Schema.NonEmptyString,
});

const messageFields = {
  content: Schema.String,
  message_id: identifierSchema,
};

const welcomeMessageSchema = Schema.Struct({
  ...messageFields,
  is_transfer: Schema.Boolean,
});

const sendMessageSchema = Schema.Struct({
  ...messageFields,
  is_transfer: Schema.optionalKey(Schema.Boolean),
});

const successEnvelopeFields = {
  success: Schema.Literal(true),
  message: Schema.optionalKey(Schema.NullOr(Schema.String)),
  error_code: Schema.Null,
};

export const startNurixSessionResponseSchema = Schema.Struct({
  ...successEnvelopeFields,
  data: Schema.Struct({
    session_id: identifierSchema,
    conversation_id: identifierSchema,
    agent_id: identifierSchema,
    welcome_message: Schema.NullOr(welcomeMessageSchema),
  }),
});

export const sendNurixChatMessageResponseSchema = Schema.Struct({
  ...successEnvelopeFields,
  data: Schema.Struct({
    session_id: identifierSchema,
    conversation_id: identifierSchema,
    status: Schema.Literals([
      "COMPLETED",
      "NO_REPLY",
      "HUMAN_TRANSFERRED",
      "ROUTED_TO_JOURNEY",
    ]),
    messages: Schema.Array(sendMessageSchema),
    human_transfer_requested: Schema.optionalKey(Schema.Boolean),
  }),
});

export const endNurixSessionResponseSchema = Schema.Struct({
  ...successEnvelopeFields,
  data: Schema.Struct({
    closed: Schema.Boolean,
  }),
});

export const nurixChatErrorResponseSchema = Schema.Struct({
  detail: Schema.String,
});
