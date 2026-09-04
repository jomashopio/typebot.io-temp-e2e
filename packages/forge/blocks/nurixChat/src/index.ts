import { createBlock } from "@typebot.io/forge";
import { endSession } from "./actions/endSession";
import { sendMessage } from "./actions/sendMessage";
import { startSession } from "./actions/startSession";
import { auth } from "./auth";
import { NurixChatLogo } from "./logo";

export const nurixChatBlock = createBlock({
  id: "nurix-chat",
  name: "Nurix Chat",
  tags: ["ai", "chat", "http", "nurix"],
  LightLogo: NurixChatLogo,
  auth,
  actions: [startSession, sendMessage, endSession],
});
