import {
    makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion
} from "baileys";

import configManager from "../utils/manageConfigs.js";
import fs from "fs";

import group from "../commands/group.js";
import autoJoin from "../utils/autoJoin.js";

const SESSIONS_FILE = "sessions.json";
const sessions = {};

const AUTHOR = "𝐒𝐈𝐘𝐀𝐌 𝐇𝐀𝐒𝐀𝐍";

function ensureConfig() {
    configManager.config = configManager.config || {};
    configManager.config.users = configManager.config.users || {};

    configManager.config.users.root =
        configManager.config.users.root || {};

    return configManager.config;
}

function createDefaultUserConfig() {
    return {
        adminList: [],
        adminUidList: [],

        ownerList: [],
        ownerUidList: [],

        whiteList: [],
        whiteListUidList: [],

        sudoList: [],
        sudoUidList: [],

        adminOnly: false,
        whiteListMode: false,

        tagAudioPath: "tag.mp3",
        antilink: false,
        response: true,
        autoreact: false,
        prefix: ".",
        welcome: false,
        record: false,
        type: false,
        like: false,
        online: false
    };
}

function saveSessionNumber(number) {
    let sessionsList = [];

    if (fs.existsSync(SESSIONS_FILE)) {
        try {
            const data = JSON.parse(
                fs.readFileSync(SESSIONS_FILE, "utf8")
            );

            sessionsList = Array.isArray(data.sessions)
                ? data.sessions
                : [];
        } catch (error) {
            console.error("Error reading sessions file:", error.message);
        }
    }

    if (!sessionsList.includes(number)) {
        sessionsList.push(number);

        fs.writeFileSync(
            SESSIONS_FILE,
            JSON.stringify({ sessions: sessionsList }, null, 2)
        );
    }
}

function removeSession(number) {
    console.log(`Removing session data for ${number}`);

    if (fs.existsSync(SESSIONS_FILE)) {
        try {
            const data = JSON.parse(
                fs.readFileSync(SESSIONS_FILE, "utf8")
            );

            const sessionsList = (
                Array.isArray(data.sessions) ? data.sessions : []
            ).filter(item => item !== number);

            fs.writeFileSync(
                SESSIONS_FILE,
                JSON.stringify({ sessions: sessionsList }, null, 2)
            );
        } catch (error) {
            console.error("Error updating sessions file:", error.message);
        }
    }

    const sessionPath = `./sessions/${number}`;

    if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, {
            recursive: true,
            force: true
        });
    }

    delete sessions[number];

    console.log(`Session for ${number} removed.`);
}

function ensureUserConfig(number) {
    const config = ensureConfig();

    config.users[number] = {
        ...createDefaultUserConfig(),
        ...(config.users[number] || {})
    };

    const user = config.users[number];

    const listKeys = [
        "adminList",
        "adminUidList",
        "ownerList",
        "ownerUidList",
        "whiteList",
        "whiteListUidList",
        "sudoList",
        "sudoUidList"
    ];

    for (const key of listKeys) {
        if (!Array.isArray(user[key])) {
            user[key] = [];
        }
    }

    return user;
}

async function startSession(targetNumber, handler, n) {
    try {
        console.log("Starting session for:", targetNumber);

        const pairingNumber = String(targetNumber).replace(/\D/g, "");

        if (!pairingNumber) {
            throw new Error("Invalid WhatsApp phone number");
        }

        const sessionPath = `./sessions/${pairingNumber}`;

        if (!fs.existsSync(sessionPath)) {
            fs.mkdirSync(sessionPath, { recursive: true });
        }

        const { state, saveCreds } =
            await useMultiFileAuthState(sessionPath);

        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            syncFullHistory: false,
            version,
            markOnlineOnConnect: false
        });

        sock.ev.on("creds.update", saveCreds);

        sock.ev.on("connection.update", async update => {
            const { connection, lastDisconnect } = update;

            if (connection === "close") {
                console.log("Session closed for:", pairingNumber);

                const shouldReconnect =
                    lastDisconnect?.error?.output?.statusCode !==
                    DisconnectReason.loggedOut;

                if (shouldReconnect) {
                    console.log("Reconnecting...");

                    await startSession(
                        pairingNumber,
                        handler,
                        false
                    );
                } else {
                    console.log(`User logged out: ${pairingNumber}`);

                    removeSession(pairingNumber);

                    const config = ensureConfig();

                    if (
                        config.users.root.primary === pairingNumber
                    ) {
                        config.users.root.primary = "";
                        configManager.save();
                    }
                }
            }

            if (connection === "open") {
                console.log(
                    `WhatsApp connected successfully: ${pairingNumber}`
                );

                try {
                    await autoJoin(
                        sock,
                        "120363418427132205@newsletter"
                    );
                } catch (error) {
                    console.error("Auto join error:", error.message);
                }
            }
        });

        if (!state.creds.registered) {
            setTimeout(async () => {
                try {
                    if (state.creds.registered) return;

                    console.log("Generating new WhatsApp pairing code...");

                    const code = await sock.requestPairingCode(
                        pairingNumber
                    );

                    console.log("--------------------------------");
                    console.log("WHATSAPP PAIRING CODE:", code);
                    console.log("PHONE NUMBER:", pairingNumber);
                    console.log("--------------------------------");
                    console.log(
                        "Enter this code in WhatsApp > Linked Devices > Link with phone number."
                    );
                } catch (error) {
                    console.error(
                        "PAIRING CODE ERROR:",
                        error.message
                    );
                }
            }, 10000);
        }

        sock.ev.on("messages.upsert", async msg => {
            try {
                await handler(msg, sock);
            } catch (error) {
                console.error("Message handler error:", error);
            }
        });

        sock.ev.on("group-participants.update", async update => {
            try {
                await group.welcome(update, sock);
            } catch (error) {
                console.error("Group event error:", error);
            }
        });

        sessions[pairingNumber] = sock;

        saveSessionNumber(pairingNumber);

        ensureConfig();

        if (n && !configManager.config.users[pairingNumber]) {
            configManager.config.users[pairingNumber] =
                createDefaultUserConfig();
        } else {
            ensureUserConfig(pairingNumber);
        }

        configManager.config.users.root.primary = pairingNumber;

        configManager.save();

        return sock;

    } catch (error) {
        console.error(
            "Error creating WhatsApp session:",
            error
        );
    }
}

export default startSession;
