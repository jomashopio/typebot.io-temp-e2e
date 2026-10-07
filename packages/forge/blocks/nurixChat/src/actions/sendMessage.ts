import { createAction, option } from "@typebot.io/forge";
import { isDefined } from "@typebot.io/lib/utils";
import { auth } from "../auth";

export const sendMessage = createAction({
  auth,
  name: "Send Message",
  turnableInto: undefined,
  options: option.object({
    sessionId: option.string.meta({
      layout: {
        label: "Session ID",
        isRequired: true,
        placeholder: "{{Nurix Session ID}}",
        moreInfoTooltip:
          "Map the session ID returned by the Start Session action.",
      },
    }),
    message: option.string.meta({
      layout: {
        label: "Message",
        isRequired: true,
        placeholder: "How can I help?",
        inputType: "textarea",
      },
    }),
    inputVariablesJson: option.string.meta({
      layout: {
        label: "Input variables (JSON)",
        placeholder: '{"locale":"en-US"}',
        inputType: "textarea",
        accordion: "Advanced settings",
        moreInfoTooltip:
          "Optional JSON object containing per-turn input variable updates.",
      },
    }),
    responseMapping: option
      .saveResponseArray([
        "Message",
        "Messages",
        "Message IDs",
        "Messages JSON",
        "Is Transfer",
        "Session ID",
        "Conversation ID",
        "Status",
        "Human Transfer Requested",
        "Request Succeeded",
        "HTTP Status",
        "Error Code",
        "Error Detail",
        "Retryable",
      ])
      .meta({
        layout: {
          accordion: "Save response",
        },
      }),
  }),
  getSetVariableIds: ({ responseMapping }) =>
    responseMapping?.map((response) => response.variableId).filter(isDefined) ??
    [],
});
