const { BroadcastChannel } = require("worker_threads");
const fs = require("fs");
const path = require("path");

const broadcast = new BroadcastChannel("mainChannel");

console.log("[WorkerCommand] 起動中...");

// **コマンド格納オブジェクト**
const commands = new Map();

// **BOT の `ready` を受信したらコマンドを登録**
broadcast.onmessage = async (event) => {
    const data = event.data;
    const targets = data.target.split(",");
    if (!targets.includes("command")) return;

    if (data.action === "ready") {
        console.log("[WorkerCommand] Discord BOT が起動 - コマンドを読み込み");

        // **コマンド読み込み処理**
        const commandsPath = path.join(__dirname, "commands");
        const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith(".js"));

        const commandList = [];
        for (const file of commandFiles) {
            const command = require(`../commands/${file}`);

            // **エイリアス登録**
            if (command.alias) {
                for (const alias of command.alias) {
                    commands.set(alias, command);
                }
            }
            commands.set(command.data.name, command);

            if (file === "cleanup.js") continue;

            // **スラッシュコマンド登録**
            if (command.alias && Array.isArray(command.alias)) {
                for (const alias of command.alias) {
                    commandList.push({
                        ...command.data,
                        name: alias,
                        name_localizations: command.data.name_localizations
                            ? Object.fromEntries(
                                Object.entries(command.data.name_localizations).map(([key, value]) => [key, alias])
                            )
                            : undefined,
                    });
                }
            }
            commandList.push(command.data);
        }

        // **コマンドを Discord API に登録**
        broadcast.postMessage({ target: "discord", action: "registerCommands", commands: commandList });

        console.log("[WorkerCommand] コマンド登録完了");
    }

    // **プレフィックスコマンドの処理**
    if (data.action === "prefix") {
        const message = data.message;
        const args = message.content.split(" ");
        const commandName = args.shift().toLowerCase();

        if (commands.has(commandName)) {
            console.log(`[WorkerCommand] コマンド実行: ${commandName}`);
            commands.get(commandName).execute(message, args);
        }
    }

    // **スラッシュコマンドの処理**
    if (data.action === "slash") {
        const interaction = data.interaction;
        if (commands.has(interaction.commandName)) {
            console.log(`[WorkerCommand] スラッシュコマンド実行: ${interaction.commandName}`);
            commands.get(interaction.commandName).execute(interaction);
        }
    }

    if (data.action === "button") {
        const interaction = data.interaction;
        if (commands.has(interaction.customId)) {
            console.log(`[WorkerCommand] ボタンクリック: ${interaction.customId}`);
            commands.get(interaction.customId).execute(interaction);
        }
    }
};
