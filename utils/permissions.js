
import configManager from "./manageConfigs.js";
import { OWNER_NUM } from "../config.js";

const AUTHOR = "𝐒𝐈𝐘𝐀𝐌 𝐇𝐀𝐒𝐀𝐍";

const normalize = value =>
  String(value || "").split("@")[0].split(":")[0].replace(/\D/g, "");

export async function getPermission(message, client, botNumber, lid = []) {
  const senderJid =
    message.key?.participant || message.key?.remoteJid || "";
  const sender = normalize(senderJid);

  const userConfig =
    configManager.config.users?.[normalize(botNumber)] || {};

  const owners = [OWNER_NUM, ...(userConfig.ownerList || [])].map(normalize);
  const whitelist = (userConfig.whiteList || []).map(normalize);
  const admins = (userConfig.adminList || []).map(normalize);
  const sudo = (userConfig.sudoList || []).map(normalize);

  if (
    message.key?.fromMe ||
    owners.includes(sender) ||
    lid.includes(senderJid)
  ) return 3;

  if (whitelist.includes(sender) || sudo.includes(sender)) return 2;
  if (admins.includes(sender)) return 1;

  if (message.key?.remoteJid?.endsWith("@g.us")) {
    try {
      const metadata = await client.groupMetadata(message.key.remoteJid);
      const participant = metadata.participants.find(
        item => normalize(item.id) === sender
      );

      if (participant?.admin) return 1;
    } catch (error) {
      console.error("Permission check:", error.message);
    }
  }

  return 0;
}

export async function checkPermission(
  message,
  client,
  botNumber,
  lid = [],
  required = 0
) {
  const role = await getPermission(message, client, botNumber, lid);

  if (role >= required) return true;

  const messages = {
    1: "এই কমান্ডটি শুধু Group Admin ব্যবহার করতে পারবে।",
    2: "এই কমান্ডটি শুধু Whitelist Admin ব্যবহার করতে পারবে।",
    3: "এই কমান্ডটি শুধু Owner ব্যবহার করতে পারবে।"
  };

  await client.sendMessage(message.key.remoteJid, {
    text: messages[required] ||
      "এই কমান্ডটি ব্যবহার করার অনুমতি তোমার নেই।"
  });

  return false;
}

export { AUTHOR };
