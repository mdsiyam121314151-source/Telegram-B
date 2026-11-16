
import {
    makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion
} from 'baileys';

import configManager from '../utils/manageConfigs.js';
import fs from 'fs';

import handleIncomingMessage from '../events/messageHandler.js';
import group from '../commands/group.js';
import autoJoin from '../utils/autoJoin.js';

const SESSIONS_FILE = "sessions.json";
const sessions = {};

function saveSessionNumber(number) {
    let sessionsList = [];

    if (fs.existsSync(SESSIONS_FILE)) {
        try {
            const data = JSON.parse(
                fs.readFileSync(SESSIONS_FILE, 'utf8')
            );
            sessionsList = Array.isArray(data.sessions)
                ? data.sessions
                : [];
        } catch (err) {
            console.error("Error reading sessions file:", err);
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
                fs.readFileSync(SESSIONS_FILE, 'utf8')
            );

            const sessionsList = (
                Array.isArray(data.sessions) ? data.sessions : []
            ).filter(num => num !== number);

            fs.writeFileSync(
                SESSIONS_FILE,
                JSON.stringify({ sessions: sessionsList }, null, 2)
            );
        } catch (err) {
            console.error("Error updating sessions file:", err);
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

async function startSession(targetNumber, handler, n) {
    try {
        console.log("Starting session for:", targetNumber);

        // WhatsApp number must contain country code without +
        const pairingNumber = String(targetNumber).replace(/\D/g, '');

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

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'close') {
                console.log("Session closed for:", pairingNumber);

                const shouldReconnect =
                    lastDisconnect?.error?.output?.statusCode !==
                    DisconnectReason.loggedOut;

                if (shouldReconnect) {
                    console.log("Reconnecting...");
                    startSession(pairingNumber, handler, false);
                } else {
                    console.log(
                        `User logged out: ${pairingNumber}`
                    );

                    removeSession(pairingNumber);

                    if (
                        pairingNumber ==
                        configManager.config?.users?.root?.primary
                    ) {
                        configManager.config.users.root.primary = "";
                        configManager.save();
                    }
                }
            }

            if (connection === 'open') {
                console.log(
                    `WhatsApp connected successfully: ${pairingNumber}`
                );

                try {
                    await autoJoin(
                        sock,
                        "120363418427132205@newsletter"
                    );
                } catch (err) {
                    console.error("Auto join error:", err.message);
                }
            }
        });

        // Generate a fresh pairing code automatically
        if (!state.creds.registered) {
            setTimeout(async () => {
                try {
                    if (state.creds.registered) return;

                    console.log(
                        "Generating new WhatsApp pairing code..."
                    );

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

                } catch (err) {
                    console.error(
                        "PAIRING CODE ERROR:",
                        err.message
                    );
                }
            }, 10000);
        }

        // Do not delete session automatically after 60 seconds.
        // This allows time to enter the pairing code.

        sock.ev.on('messages.upsert', async (msg) => {
            await handler(msg, sock);
        });

        sessions[pairingNumber] = sock;

        saveSessionNumber(pairingNumber);

        if (n) {
            configManager.config.users[pairingNumber] = {
                sudoList: [],
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

            configManager.save();
        }

        configManager.config = configManager.config || {};
        configManager.config.users =
            configManager.config.users || {};

        configManager.config.users.root =
            configManager.config.users.root || {};

        configManager.config.users.root.primary = pairingNumber;

        configManager.save();

        sock.ev.on('group-participants.update', async (update) => {
            await group.welcome(update, sock);
        });

        return sock;

    } catch (err) {
        console.error("Error creating WhatsApp session:", err);
    }
}

export default startSession;
