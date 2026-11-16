
import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} from "baileys";

import handleIncomingMessage from "./messageHandler.js";
import configManager from "../utils/manageConfigs.js";
import fs from "fs";

const AUTHOR = "𝐒𝐈𝐘𝐀𝐌 𝐇𝐀𝐒𝐀𝐍";
const SESSIONS_FILE = "./sessions.json";

const sessions = new Map();
const startingSessions = new Map();

function readSessionNumbers() {
  if (!fs.existsSync(SESSIONS_FILE)) return [];

  try {
    const data = JSON.parse(fs.readFileSync(SESSIONS_FILE, "utf8"));
    return Array.isArray(data.sessions)
      ? [...new Set(data.sessions.map(String))]
      : [];
  } catch (error) {
    console.error("❌ Failed to read sessions.json:", error);
    return [];
  }
}

function writeSessionNumbers(numbers) {
  fs.writeFileSync(
    SESSIONS_FILE,
    JSON.stringify({ sessions: [...new Set(numbers)] }, null, 2)
  );
}

function removeSession(number) {
  number = String(number);

  console.log(`❌ Removing session for ${number}`);

  try {
    writeSessionNumbers(
      readSessionNumbers().filter(item => item !== number)
    );
  } catch (error) {
    console.error("❌ Failed to update sessions.json:", error);
  }

  const socket = sessions.get(number);
  sessions.delete(number);

  if (socket) {
    try {
      socket.end(undefined);
    } catch (error) {
      console.error("Socket close error:", error.message);
    }
  }

  const sessionPath = `./sessions/${number}`;

  try {
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
    }
  } catch (error) {
    console.error("❌ Failed to remove session folder:", error);
  }

  console.log(`✅ Session for ${number} removed.`);
}

async function startSession(targetNumber) {
  targetNumber = String(targetNumber);

  if (sessions.has(targetNumber)) {
    return sessions.get(targetNumber);
  }

  if (startingSessions.has(targetNumber)) {
    return startingSessions.get(targetNumber);
  }

  const startPromise = (async () => {
    const sessionPath = `./sessions/${targetNumber}`;

    fs.mkdirSync(sessionPath, { recursive: true });

    const { state, saveCreds } =
      await useMultiFileAuthState(sessionPath);

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      syncFullHistory: false
    });

    sessions.set(targetNumber, sock);

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", update => {
      const { connection, lastDisconnect } = update || {};

      if (connection === "open") {
        console.log(`✅ Session connected: ${targetNumber}`);
        return;
      }

      if (connection !== "close") return;

      if (sessions.get(targetNumber) === sock) {
        sessions.delete(targetNumber);
      }

      const statusCode = lastDisconnect?.error?.output?.statusCode;

      if (statusCode === DisconnectReason.loggedOut) {
        console.log(`🚫 Session logged out: ${targetNumber}`);
        removeSession(targetNumber);
        return;
      }

      console.log(`🔄 Session reconnecting: ${targetNumber}`);

      setTimeout(() => {
        startSession(targetNumber).catch(error => {
          console.error(
            `❌ Reconnect failed for ${targetNumber}:`,
            error
          );
        });
      }, 3000);
    });

    sock.ev.on("messages.upsert", async event => {
      try {
        await handleIncomingMessage(event, sock);
      } catch (error) {
        console.error(
          `Message handler error (${targetNumber}):`,
          error
        );
      }
    });

    console.log(`✅ Session started: ${targetNumber}`);

    return sock;
  })();

  startingSessions.set(targetNumber, startPromise);

  try {
    return await startPromise;
  } finally {
    startingSessions.delete(targetNumber);
  }
}

async function reconnect() {
  console.log("🔄 Reconnecting saved WhatsApp sessions...");

  const numbers = readSessionNumbers();
  const rootNumber =
    configManager.config?.users?.root?.primary;

  for (const number of numbers) {
    if (rootNumber && String(number) === String(rootNumber)) {
      continue;
    }

    try {
      await startSession(number);
    } catch (error) {
      console.error(`❌ Failed to start ${number}:`, error);
    }
  }
}

export { startSession, removeSession, sessions, AUTHOR };
export default reconnect;
