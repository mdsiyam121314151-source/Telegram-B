import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import channelSender from "./commands/channelSender.js";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tempDir = path.join(__dirname, ".temp_bot_update");
const repoURL = "https://github.com/mdsiyam121314151-source/Telegram-B.git";

const EXCLUDED = new Set([
".git",
"node_modules",
"config.json",
"config.js",
"prem.json",
"sessions.json",
"sessions",
"auth",
"auth_info_baileys",
".env"
]);

function copyFolderContents(src, dest) {
if (!fs.existsSync(src)) return;

for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
if (EXCLUDED.has(entry.name)) continue;

const srcPath = path.join(src, entry.name);
const destPath = path.join(dest, entry.name);

if (entry.isDirectory()) {
  fs.mkdirSync(destPath, { recursive: true });
  copyFolderContents(srcPath, destPath);
} else if (entry.isFile()) {
  fs.copyFileSync(srcPath, destPath);
}

}
}

async function update(message, client) {
const remoteJid = message?.key?.remoteJid;
if (!remoteJid || !client) return;

await client.sendMessage(remoteJid, {
text: "🔄 Updating your bot... Please wait."
});

try {
fs.rmSync(tempDir, { recursive: true, force: true });

await execFileAsync("git", [
  "clone",
  "--depth",
  "1",
  repoURL,
  tempDir
]);

copyFolderContents(tempDir, __dirname);

fs.rmSync(tempDir, { recursive: true, force: true });

await channelSender(
  message,
  client,
  "✅ Update files copied successfully. Restart the bot manually to apply changes.",
  2
);

} catch (error) {
console.error("Update failed:", error);

fs.rmSync(tempDir, { recursive: true, force: true });

await client.sendMessage(remoteJid, {
  text: "❌ Update failed: " + error.message
});

}
}

export default update;
