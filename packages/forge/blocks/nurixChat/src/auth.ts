import { createAuth, option } from "@typebot.io/forge";

export const auth = createAuth({
  type: "encryptedCredentials",
  name: "Nurix Chat account",
  schema: option.object({
    apiKey: option.string.meta({
      layout: {
        label: "API key",
        isRequired: true,
        helperText:
          "Enter the authorized API key supplied by Nurix Labs. This server integration requires CAPTCHA to be disabled.",
        inputType: "password",
        withVariableButton: false,
        isDebounceDisabled: true,
      },
    }),
    baseUrl: option.string.meta({
      layout: {
        label: "Base URL",
        isRequired: true,
        helperText:
          "Enter the HTTPS nurixlabs.tech API origin supplied by Nurix Labs.",
        placeholder: "https://chat-us.nurixlabs.tech",
        withVariableButton: false,
        isDebounceDisabled: true,
      },
    }),
    accountId: option.string.meta({
      layout: {
        label: "Account ID",
        isRequired: true,
        helperText: "Enter the Nurix account ID used in the HTTP Chat API URL.",
        withVariableButton: false,
        isDebounceDisabled: true,
      },
    }),
    channelName: option.string.meta({
      layout: {
        label: "Channel name",
        isRequired: true,
        defaultValue: "CHAT_WIDGET",
        helperText: "Use the channel name configured by Nurix Labs.",
        withVariableButton: false,
        isDebounceDisabled: true,
      },
    }),
    origin: option.string.meta({
      layout: {
        label: "Origin",
        isRequired: true,
        helperText:
          "Enter the exact server-to-server Origin allowlisted by Nurix Labs.",
        placeholder: "https://www.example.com",
        withVariableButton: false,
        isDebounceDisabled: true,
      },
    }),
  }),
});
