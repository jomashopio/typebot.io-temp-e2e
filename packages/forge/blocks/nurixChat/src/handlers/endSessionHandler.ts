import { createActionHandler } from "@typebot.io/forge";
import { endSession } from "../actions/endSession";
import { endNurixSession } from "../endNurixSession";
import {
  handleNurixChatError,
  parseConnectionCredentials,
  parseRequiredString,
  setMappedVariables,
} from "./handlerUtils";

export const endSessionHandler = createActionHandler(endSession, {
  server: async ({ credentials, options, variables, logs }) => {
    try {
      const connectionCredentials = parseConnectionCredentials(credentials);
      const sessionId = parseRequiredString(options.sessionId, "Session ID");
      const response = await endNurixSession({
        ...connectionCredentials,
        sessionId,
      });

      setMappedVariables({
        responseMapping: options.responseMapping,
        defaultItem: "Closed",
        outputValues: {
          Closed: response.closed,
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
        context: "While ending a Nurix Chat session",
        responseMapping: options.responseMapping,
        defaultItem: "Closed",
        successOutputNames: ["Closed"],
        variables,
        logs,
      });
    }
  },
});
