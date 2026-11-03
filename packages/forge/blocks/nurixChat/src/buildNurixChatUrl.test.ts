import { describe, expect, it } from "bun:test";
import { buildNurixChatUrl } from "./buildNurixChatUrl";

describe("buildNurixChatUrl", () => {
  it.each([
    "https://api.nuplay.live",
    "https://api.nuplay.live/agentx/v2",
    "https://api.nuplay.live/agentx/v2/",
  ])("uses the Nuplay chat prefix for %s", (baseUrl) => {
    expect(
      buildNurixChatUrl({
        baseUrl,
        accountId: "account/one",
        channelName: "CHAT WIDGET",
        operation: "start",
      }).toString(),
    ).toBe(
      "https://api.nuplay.live/agentx/v2/chat/CHAT%20WIDGET/account%2Fone/session",
    );
  });

  it.each([
    "http://api.nuplay.live/agentx/v2/",
    "https://api.nuplay.live:8443/agentx/v2/",
    "https://user:password@api.nuplay.live/agentx/v2/",
    "https://api.nuplay.live/agentx/v2/?other=1",
    "https://api.nuplay.live/agentx/v2/#fragment",
    "https://api.nuplay.live/other/",
    "https://api.nuplay.live/agentx/v2/chat/CHAT_WIDGET/account/session",
    "https://chat.nurixlabs.tech/agentx/v2/",
    "https://api.nuplay.live.example.com",
    "https://other.nuplay.live",
    "https://127.0.0.1",
  ])("rejects unsupported endpoints: %s", (baseUrl) => {
    expect(() =>
      buildNurixChatUrl({
        baseUrl,
        accountId: "account-1",
        channelName: "CHAT_WIDGET",
        operation: "start",
      }),
    ).toThrow(expect.objectContaining({ code: "UNSAFE_URL" }));
  });
});
