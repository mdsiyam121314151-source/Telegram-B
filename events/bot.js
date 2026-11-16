
import TelegramBot from "node-telegram-bot-api";
import { TELEGRAM_BOT_TOKEN } from "../config.js";
import { messageHandler } from "./handler.js";
import reconnect from "./reconnection.js";

const AUTHOR = "𝐒𝐈𝐘𝐀𝐌 𝐇𝐀𝐒𝐀𝐍";

export let bot;
let started = false;

export async function startBot() {
  if (started) return bot;

  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
  }

  try {
    bot = new TelegramBot(TELEGRAM_BOT_TOKEN, {
      polling: {
        autoStart: false,
        params: { timeout: 30 }
      }
    });

    bot.on("polling_error", error => {
      console.error("Telegram polling error:", error.message);
    });

    bot.on("error", error => {
      console.error("Telegram bot error:", error.message);
    });

    messageHandler(bot);

    await bot.startPolling();
    started = true;

    console.log("🤖 Telegram bot is running...");

    reconnect().catch(error => {
      console.error("Session reconnect error:", error);
    });

    return bot;
  } catch (error) {
    started = false;
    console.error("❌ Failed to start Telegram bot:", error);
    throw error;
  }
}

export { AUTHOR };
