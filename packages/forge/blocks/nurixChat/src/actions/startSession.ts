import { createAction, option } from "@typebot.io/forge";
import { isDefined } from "@typebot.io/lib/utils";
import { auth } from "../auth";

export const startSession = createAction({
  auth,
  name: "Start Session",
  turnableInto: undefined,
  options: option.object({
    userId: option.string.meta({
      layout: {
        label: "User ID",
        isRequired: true,
        placeholder: "Unique customer identifier",
        moreInfoTooltip:
          "Use a stable end-user identifier so Nurix can associate conversation history with the same user.",
      },
    }),
    agentId: option.string.meta({
      layout: {
        label: "Agent ID",
        placeholder: "Optional Nurix agent ID",
      },
    }),
    inputVariablesJson: option.string.meta({
      layout: {
        label: "Input variables (JSON)",
        placeholder: '{"locale":"en-US"}',
        inputType: "textarea",
        accordion: "Advanced settings",
        moreInfoTooltip:
          "Optional JSON object used by the agent and welcome-message template.",
      },
    }),
    metadataJson: option.string.meta({
      layout: {
        label: "Metadata (JSON)",
        placeholder: '{"source":"typebot"}',
        inputType: "textarea",
        accordion: "Advanced settings",
        moreInfoTooltip:
          "Optional JSON object containing additional conversation context.",
      },
    }),
    responseMapping: option
      .saveResponseArray([
        "Session ID",
        "Conversation ID",
        "Agent ID",
        "Welcome Message",
        "Welcome Message ID",
        "Welcome Is Transfer",
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
