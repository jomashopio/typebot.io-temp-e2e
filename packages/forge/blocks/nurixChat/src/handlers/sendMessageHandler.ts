import { createActionHandler } from "@typebot.io/forge";
import { sendMessage } from "../actions/sendMessage";
import { sendNurixChatMessage } from "../sendNurixChatMessage";
import {
  handleNurixChatError,
  parseConnectionCredentials,
  parseOptionalJsonObject,
  parseRequiredString,
  setMappedVariables,
} from "./handlerUtils";

export const sendMessageHandler = createActionHandler(sendMessage, {
  server: async ({ credentials, options, variables, logs }) => {
    try {
      const connectionCredentials = parseConnectionCredentials(credentials);
      const sessionId = parseRequiredString(options.sessionId, "Session ID");
      const message = parseRequiredString(options.message, "Message");
      const inputVariables = parseOptionalJsonObject(
        options.inputVariablesJson,
        "Input variables",
      );
      const response = await sendNurixChatMessage({
        ...connectionCredentials,
        sessionId,
        message,
        ...(inputVariables === undefined ? {} : { inputVariables }),
      });

      setMappedVariables({
        responseMapping: options.responseMapping,
        defaultItem: "Message",
        outputValues: {
          Message: response.messages
            .map((responseMessage) => responseMessage.content)
            .join("\n\n"),
          Messages: response.messages.map(
            (responseMessage) => responseMessage.content,
          ),
          "Message IDs": response.messages.map(
            (responseMessage) => responseMessage.messageId,
          ),
          "Messages JSON": JSON.stringify(response.messages),
          "Is Transfer": response.messages.some(
            (responseMessage) => responseMessage.isTransfer,
          ),
          "Session ID": response.sessionId,
          "Conversation ID": response.conversationId,
          Status: response.status,
          "Human Transfer Requested": response.humanTransferRequested,
          "Request Succeeded": true,
          "HTTP Status": 200,
          "Error Code": null,
          "Error Detail": null,
          Retryable: false,
        },
        variables,
      });
    } catch (error) {
      handleNurixChatError({
        error,
        context: "While sending a Nurix Chat message",
        responseMapping: options.responseMapping,
        defaultItem: "Message",
        successOutputNames: [
          "Message",
          "Messages",
          "Message IDs",
          "Messages JSON",
          "Is Transfer",
          "Status",
          "Human Transfer Requested",
        ],
        variables,
        logs,
      });
    }
  },
});
