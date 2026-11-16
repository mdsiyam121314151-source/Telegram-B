
import { DisconnectReason } from "baileys";

const AUTHOR = "𝐒𝐈𝐘𝐀𝐌 𝐇𝐀𝐒𝐀𝐍";

function handleConnectionUpdate(update, reconnect) {
  const { connection, lastDisconnect } = update || {};

  if (connection === "open") {
    console.log("✅ WhatsApp connection opened.");
    return;
  }

  if (connection !== "close") return;

  const statusCode = lastDisconnect?.error?.output?.statusCode;
  const loggedOut = statusCode === DisconnectReason.loggedOut;

  if (loggedOut) {
    console.log("🚫 WhatsApp logged out. Reconnect cancelled.");
    return;
  }

  console.log("🔄 WhatsApp connection closed. Reconnecting...");

  if (typeof reconnect === "function") {
    Promise.resolve(reconnect()).catch(error => {
      console.error("❌ Reconnect failed:", error);
    });
  }
}

export default handleConnectionUpdate;
export { AUTHOR };
