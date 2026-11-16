
import fs from "fs";

import start from "../commands/start.js";
import menu from "../commands/menu.js";
import handleCheckJoin from "../utils/checkJoin.js";
import { isUserInChannel } from "../utils/checkmember.js";
import sessionCount from "../utils/sessionCount.js";
import redirect from "../utils/redirect.js";
import { OWNER_ID, LIMIT, PUB } from "../config.js";
import connect from "../utils/connect.js";
import disconnect from "../utils/disconnect.js";
import { getCreds } from "../credits.js";

const AUTHOR = "𝐒𝐈𝐘𝐀𝐌 𝐇𝐀𝐒𝐀𝐍";
const PREMIUM_FILE = "./prem.json";

function readPremiumData() {
  try {
    if (!fs.existsSync(PREMIUM_FILE)) {
      fs.writeFileSync(
        PREMIUM_FILE,
        JSON.stringify({ users: [] }, null, 2)
      );
    }

    const data = JSON.parse(fs.readFileSync(PREMIUM_FILE, "utf8"));

    if (!Array.isArray(data.users)) data.users = [];

    return data;
  } catch (error) {
    console.error("Premium data error:", error);
    return { users: [] };
  }
}

function isPremium(userId) {
  const data = readPremiumData();

  return Boolean(PUB) ||
    data.users.includes(String(userId));
}

function addPremium(userId) {
  const data = readPremiumData();
  const id = String(userId);

  if (!data.users.includes(id)) {
    data.users.push(id);
    fs.writeFileSync(PREMIUM_FILE, JSON.stringify(data, null, 2));
  }
}

function removePremium(userId) {
  const data = readPremiumData();

  data.users = data.users.filter(
    id => id !== String(userId)
  );

  fs.writeFileSync(PREMIUM_FILE, JSON.stringify(data, null, 2));
}

function encode(id, duration) {
  const expiry = Date.now() + duration * 24 * 60 * 60 * 1000;
  return Buffer.from(`${id}|${expiry}`).toString("base64");
}

async function isAllowedMember(bot, msg) {
  try {
    const allowed = await isUserInChannel(bot, msg.from.id);

    if (!allowed) {
      await start(bot, msg);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Membership check error:", error);
    await bot.sendMessage(
      msg.chat.id,
      "❌ সদস্যপদ যাচাই করা যায়নি। কিছুক্ষণ পর আবার চেষ্টা করো।"
    );
    return false;
  }
}

async function isAllowedPremium(bot, msg) {
  if (!(await isAllowedMember(bot, msg))) return false;

  if (!isPremium(msg.from.id)) {
    await bot.sendMessage(
      msg.chat.id,
      "❌ তুমি Premium ব্যবহারকারী নও। Owner-এর সঙ্গে যোগাযোগ করো।"
    );
    return false;
  }

  return true;
}

function isOwner(msg) {
  return String(msg.from.id) === String(OWNER_ID);
}

export function messageHandler(bot) {
  bot.onText(/^\/start(?:@\w+)?$/, async msg => {
    try {
      await start(bot, msg);
    } catch (error) {
      console.error("/start error:", error);
    }
  });

  bot.onText(/^\/myid(?:@\w+)?$/, async msg => {
    await bot.sendMessage(
      msg.chat.id,
      `তোমার Telegram ID: ${msg.from.id}`
    );
  });

  bot.onText(/^\/menu(?:@\w+)?$/, async msg => {
    try {
      if (!(await isAllowedPremium(bot, msg))) return;
      await menu(bot, msg);
    } catch (error) {
      console.error("/menu error:", error);
    }
  });

  bot.onText(/^\/connect(?:@\w+)?(?:\s+(.+))?$/, async (msg, match) => {
    try {
      if (!(await isAllowedPremium(bot, msg))) return;

      const count = sessionCount();

      if (count >= LIMIT) {
        await redirect(bot, msg);
        return;
      }

      await connect.connect(bot, msg, match);
    } catch (error) {
      console.error("/connect error:", error);
      await bot.sendMessage(msg.chat.id, "❌ কানেক্ট করতে সমস্যা হয়েছে।");
    }
  });

  bot.onText(/^\/disconnect(?:@\w+)?(?:\s+(.+))?$/, async (msg, match) => {
    try {
      if (!(await isAllowedPremium(bot, msg))) return;

      const count = sessionCount();

      if (count >= LIMIT) {
        await redirect(bot, msg);
        return;
      }

      await disconnect(bot, msg, match);
    } catch (error) {
      console.error("/disconnect error:", error);
      await bot.sendMessage(msg.chat.id, "❌ ডিসকানেক্ট করতে সমস্যা হয়েছে।");
    }
  });

  bot.on("callback_query", async callbackQuery => {
    try {
      if (callbackQuery.data === "check_join") {
        await handleCheckJoin(bot, callbackQuery);
      }
    } catch (error) {
      console.error("Callback error:", error);
    }
  });

  bot.onText(/^\/addprem(?:@\w+)?(?:\s+(.+))?$/, async (msg, match) => {
    if (!isOwner(msg)) {
      return bot.sendMessage(msg.chat.id, "❌ এই কমান্ড শুধু Owner ব্যবহার করতে পারবে।");
    }

    const targetId = match?.[1]?.trim();

    if (!targetId) {
      return bot.sendMessage(msg.chat.id, "ব্যবহার: /addprem USER_ID");
    }

    addPremium(targetId);

    await bot.sendMessage(
      msg.chat.id,
      `✅ ${targetId} Premium তালিকায় যোগ করা হয়েছে।`
    );
  });

  bot.onText(/^\/delprem(?:@\w+)?(?:\s+(.+))?$/, async (msg, match) => {
    if (!isOwner(msg)) {
      return bot.sendMessage(msg.chat.id, "❌ এই কমান্ড শুধু Owner ব্যবহার করতে পারবে।");
    }

    const targetId = match?.[1]?.trim();

    if (!targetId) {
      return bot.sendMessage(msg.chat.id, "ব্যবহার: /delprem USER_ID");
    }

    removePremium(targetId);

    await bot.sendMessage(
      msg.chat.id,
      `✅ ${targetId} Premium তালিকা থেকে সরানো হয়েছে।`
    );
  });

  bot.onText(/^\/keygen(?:@\w+)?(?:\s+(.+))?$/, async (msg, match) => {
    try {
      const creds = await getCreds();
      const ownerTelegramId = String(creds?.telegram_id || "");

      if (!ownerTelegramId || String(msg.from.id) !== ownerTelegramId) {
        return bot.sendMessage(
          msg.chat.id,
          "❌ এই কমান্ড ব্যবহারের অনুমতি নেই।"
        );
      }

      const args = match?.[1]?.trim().split(/\s+/) || [];
      const duration = Number(args[0]);
      const targetId = args[1];

      if (
        !targetId ||
        !Number.isInteger(duration) ||
        duration <= 0
      ) {
        return bot.sendMessage(
          msg.chat.id,
          "ব্যবহার: /keygen DAYS USER_ID"
        );
      }

      const code = encode(targetId, duration);

      await bot.sendMessage(
        msg.chat.id,
        `✅ User ID: ${targetId}\n\nকোড:\n<code>${code}</code>\n\nমেয়াদ: ${duration} দিন`,
        { parse_mode: "HTML" }
      );
    } catch (error) {
      console.error("/keygen error:", error);
      await bot.sendMessage(msg.chat.id, "❌ Key তৈরি করা যায়নি।");
    }
  });
}

export { AUTHOR };
