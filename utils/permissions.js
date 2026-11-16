import configManager from "./manageConfigs.js";
import { OWNER_NUM } from "../config.js";

const AUTHOR = "𝐒𝐈𝐘𝐀𝐌 𝐇𝐀𝐒𝐀𝐍";

const normalizePhone = value =>
  String(value || "")
    .replace(/@.*$/, "")
    .replace(/:.*$/, "")
    .replace(/\D/g, "");

const normalizeUid = value =>
  String(value || "").trim().toLowerCase();

function getUserConfig(botNumber) {
  const users = configManager.config?.users || {};
  const number = normalizePhone(botNumber);

  return users[number] || {};
}

function getSenderIds(message) {
  const key = message?.key || {};

  return [
    key.participant,
    key.remoteJid,
    key.participantAlt,
    key.remoteJidAlt,
    message?.participant,
    message?.sender
  ].filter(Boolean).map(String);
}

function matchesPhone(senderIds, phoneList = []) {
  const senderPhones = senderIds
    .map(normalizePhone)
    .filter(Boolean);

  return phoneList.some(number => {
    const phone = normalizePhone(number);
    return phone && senderPhones.includes(phone);
  });
}

function matchesUid(senderIds, uidList = [], lid = []) {
  const allIds = [...senderIds, ...lid]
    .map(normalizeUid)
    .filter(Boolean);

  return uidList.some(uid => {
    const normalized = normalizeUid(uid);
    return normalized && allIds.includes(normalized);
  });
}

function hasRole(senderIds, config, phoneKey, uidKey, lid) {
  return (
    matchesPhone(senderIds, config[phoneKey] || []) ||
    matchesUid(senderIds, config[uidKey] || [], lid)
  );
}

export async function getPermission(message, client, botNumber, lid = []) {
  const config = getUserConfig(botNumber);
  const senderIds = getSenderIds(message);

  if (message?.key?.fromMe) return 3;

  if (
    normalizePhone(OWNER_NUM) &&
    matchesPhone(senderIds, [OWNER_NUM])
  ) {
    return 3;
  }

  if (
    hasRole(senderIds, config, "ownerList", "ownerUidList", lid)
  ) {
    return 3;
  }

  if (
    hasRole(senderIds, config, "whiteList", "whiteListUidList", lid) ||
    hasRole(senderIds, config, "sudoList", "sudoUidList", lid)
  ) {
    return 2;
  }

  if (
    hasRole(senderIds, config, "adminList", "adminUidList", lid)
  ) {
    return 1;
  }

  const remoteJid = message?.key?.remoteJid || "";

  if (remoteJid.endsWith("@g.us") && client?.groupMetadata) {
    try {
      const metadata = await client.groupMetadata(remoteJid);

      const participant = metadata.participants?.find(item => {
        const participantIds = [
          item.id,
          item.jid,
          item.lid,
          item.phoneNumber
        ].filter(Boolean).map(String);

        return participantIds.some(id =>
          senderIds.some(sender =>
            normalizeUid(sender) === normalizeUid(id) ||
            (
              normalizePhone(sender) &&
              normalizePhone(sender) === normalizePhone(id)
            )
          ) ||
          lid.some(lidId =>
            participantIds.some(id =>
              normalizeUid(lidId) === normalizeUid(id)
            )
          )
        );
      });

      if (participant?.admin || participant?.isAdmin || participant?.isSuperAdmin) {
        return 1;
      }
    } catch (error) {
      console.error("Permission check error:", error.message);
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
