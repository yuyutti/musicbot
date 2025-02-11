const { BroadcastChannel } = require("worker_threads");
const broadcast = new BroadcastChannel("mainChannel");

const { Client, GatewayIntentBits } = require("discord.js");
const { channel } = require("diagnostics_channel");
require("dotenv").config();

console.log("[WorkerDiscord] 起動中...");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
    ],
});

client.once("ready", () => {
    console.log(`[WorkerDiscord] BOT起動: ${client.user.tag}`);
    broadcast.postMessage({ target: "command", action: "ready", clientId: client.user.id });
});

// **メッセージ受信イベント**
client.on("messageCreate", (message) => {
    if (message.author.bot || !message.guild) return;

    console.log(`[WorkerDiscord] メッセージ受信: ${message.content}`);

    broadcast.postMessage({ target: "command", action: "prefix", 
        message: {
            content: message.content,
            author: message.author,
            guild: message.guild,
            guildName: message.guild.name,
            channelId: message.channel.id,
            channelName: message.channel.name,
        } 
    });
});

// **スラッシュコマンドの処理**
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) return;

    console.log(`[WorkerDiscord] スラッシュコマンド受信: ${interaction.commandName}`);

    broadcast.postMessage({ target: "command", action: "slash", 
        interaction: {
            
        } 
    });
});

// **ボタンの処理**
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;

    console.log(`[WorkerDiscord] ボタンクリック: ${interaction.customId}`);

    broadcast.postMessage({ target: "command", action: "button", interaction });
});

client.login(process.env.DISCORD_TOKEN);