import { createActionHandler } from "@typebot.io/forge";
import { startSession } from "../actions/startSession";
import { startNurixSession } from "../startNurixSession";
import {
  handleNurixChatError,
  parseConnectionCredentials,
  parseOptionalJsonObject,
  parseOptionalString,
  parseRequiredString,
  setMappedVariables,
} from "./handlerUtils";

export const startSessionHandler = createActionHandler(startSession, {
  server: async ({ credentials, options, variables, logs }) => {
    try {
      const connectionCredentials = parseConnectionCredentials(credentials);
      const userId = parseRequiredString(options.userId, "User ID");
      const agentId = parseOptionalString(options.agentId);
      const inputVariables = parseOptionalJsonObject(
        options.inputVariablesJson,
        "Input variables",
      );
      const metadata = parseOptionalJsonObject(
        options.metadataJson,
        "Metadata",
      );
      const response = await startNurixSession({
        ...connectionCredentials,
        userId,
        ...(agentId === undefined ? {} : { agentId }),
        ...(inputVariables === undefined ? {} : { inputVariables }),
        ...(metadata === undefined ? {} : { metadata }),
      });

      setMappedVariables({
        responseMapping: options.responseMapping,
        defaultItem: "Session ID",
        outputValues: {
          "Session ID": response.sessionId,
          "Conversation ID": response.conversationId,
          "Agent ID": response.agentId,
          "Welcome Message": response.welcomeMessage?.content ?? null,
          "Welcome Message ID": response.welcomeMessage?.messageId ?? null,
          "Welcome Is Transfer": response.welcomeMessage?.isTransfer ?? null,
          "Request Succeeded": true,
          "HTTP Status": 201,
          "Error Code": null,
          "Error Detail": null,
          Retryable: false,
        },
        variables,
      });
    } catch (error) {
      handleNurixChatError({
        error,
        context: "While starting a Nurix Chat session",
        responseMapping: options.responseMapping,
        defaultItem: "Session ID",
        successOutputNames: [
          "Session ID",
          "Conversation ID",
          "Agent ID",
          "Welcome Message",
          "Welcome Message ID",
          "Welcome Is Transfer",
        ],
        variables,
        logs,
      });
    }
  },
});
