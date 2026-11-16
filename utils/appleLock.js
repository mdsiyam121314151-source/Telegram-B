import fs from "fs";
import { fileURLToPath } from "url";

const AUTHOR = "𝐒𝐈𝐘𝐀𝐌 𝐇𝐀𝐒𝐀𝐍";

function checkAuthor(source) {
  const authorPattern =
    /(?:const|let|var)\s+AUTHOR\s*=\s*(['"`])(.*?)\1\s*;?/;

  const match = source.match(authorPattern);

  if (!match) return false;

  return match[2] === AUTHOR;
}

export async function appleLock(message, client, fileUrl) {
  let valid = false;

  try {
    if (!fileUrl) {
      throw new Error("File URL is missing");
    }

    const filePath = fileURLToPath(fileUrl);

    if (!fs.existsSync(filePath)) {
      throw new Error("File does not exist");
    }

    const source = fs.readFileSync(filePath, "utf8");

    valid = checkAuthor(source);
  } catch (error) {
    console.error("Author lock error:", error.message);
    valid = false;
  }

  if (valid) return true;

  try {
    await client.sendMessage(message.key.remoteJid, {
      text:
        "এই কমান্ডটি বন্ধ করে দেওয়া হয়েছে।\nকারণ ফাইলের Author-এর নাম পরিবর্তন করা হয়েছে অথবা Author যাচাই করা যায়নি।"
    });
  } catch (error) {
    console.error("Author lock message error:", error.message);
  }

  return false;
}

export { AUTHOR };
