
import { TELEGRAM_GROUP } from "../config.js";

export async function isUserInChannel(bot, userId) {
  try {
    const member = await bot.getChatMember(
      TELEGRAM_GROUP,
      userId
    );

    const validStatuses = [
      "member",
      "administrator",
      "creator"
    ];

    return validStatuses.includes(member.status);
  } catch (error) {
    console.error(
      "Error checking group membership:",
      error.message
    );
    return false;
  }
}
