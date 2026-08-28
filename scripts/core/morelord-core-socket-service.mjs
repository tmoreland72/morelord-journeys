import { MODULE_ID } from "../domain/constants.mjs";

let channel = null;

export function getMorelordSocketChannel() {
  if (channel) return channel;
  const core = game.modules.get("morelord-core")?.api ?? globalThis.MorelordCore;
  if (typeof core?.socket?.createChannel !== "function") throw new Error("Morelord Core contextual socket API is unavailable.");
  channel = core.socket.createChannel(MODULE_ID);
  return channel;
}

export const JOURNEY_STATE_SERIAL_KEY = `${MODULE_ID}:journey-state`;
