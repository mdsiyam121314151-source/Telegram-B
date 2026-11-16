
import fs from "fs";
import { fileURLToPath } from "url";

const AUTHOR = "𝐒𝐈𝐘𝐀𝐌 𝐇𝐀𝐒𝐀𝐍";

export async function appleLock(message, client, fileUrl) {
  let valid = false;

  try {
    const source = fs.readFileSync(
      fileURLToPath(fileUrl),
      "utf8"
    );

    valid = source.includes(
      `const AUTHOR = "${AUTHOR}";`
    );
  } catch {
    valid = false;
  }

  if (valid) return true;

  await client.sendMessage(message.key.remoteJid, {
    text: "এই কমান্ডটি বন্ধ করে দেওয়া হয়েছে, কারণ Author-এর নাম পরিবর্তন করা হয়েছে।"
  });

  return false;
}
