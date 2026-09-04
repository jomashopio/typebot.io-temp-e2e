import { endSessionHandler } from "./handlers/endSessionHandler";
import { sendMessageHandler } from "./handlers/sendMessageHandler";
import { startSessionHandler } from "./handlers/startSessionHandler";

export { endSessionHandler, sendMessageHandler, startSessionHandler };

export default [startSessionHandler, sendMessageHandler, endSessionHandler];
