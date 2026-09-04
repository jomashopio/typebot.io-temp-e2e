import { createAction, option } from "@typebot.io/forge";
import { isDefined } from "@typebot.io/lib/utils";
import { auth } from "../auth";

export const endSession = createAction({
  auth,
  name: "End Session",
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
    responseMapping: option
      .saveResponseArray([
        "Closed",
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
