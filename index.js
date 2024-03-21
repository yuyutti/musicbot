require('dotenv').config();
const { Client, GatewayIntentBits, Collection, ActionRowBuilder, ButtonBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const { createTable } = require('./SQL/connection');
const { setData } = require('./SQL/setdata');
const { removeData } = require('./SQL/removedata');
const { lang, volume } = require('./SQL/lockup');

const{ queue: musicQueue } = require('./src/musicQueue');
const globalLanguage = require('./lang/commands/global');
const updateActivity = require('./src/activity');
const updatePlayingGuild = require('./src/playingGuild');
const { fetchChannel, getLoggerChannel, getErrorChannel } = require('./src/log');

createTable();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
    ]
});

client.commands = new Collection();
const prefix = "!";

const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;
const loggerChannelId = process.env.LOGGER_CHANNEL_ID;
const errorChannelId = process.env.ERROR_CHANNEL_ID;

let loggerChannel;
let errorChannel;

let isReady = false;

client.once('ready', async() => {
    const commands = [];
    const commandsPath = path.join(__dirname, 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const command = require(`./commands/${file}`);

        client.commands.set(command.data.name, command);
        commands.push(command.data);
        if (command.alias) {
            for (const alias of command.alias) {
                client.commands.set(alias, command);
                commands.push({
                    ...command.data,
                    name: alias,
                    name_localizations: command.data.name_localizations ? 
                    Object.fromEntries(Object.entries(command.data.name_localizations).map(([key, value]) => [key, alias])) : undefined,
                });
            }
        }
    }
    // コマンド登録 テストするときはここにguildIdを指定する
    await client.application.commands.set(commands);
    await fetchChannel(client);
    loggerChannel = getLoggerChannel();
    errorChannel = getErrorChannel();
    console.log(`Logged in as ${client.user.tag}`);
    loggerChannel.send('Logged in as ' + client.user.tag);
    updateActivity(client);
    updatePlayingGuild();
    isReady = true;
});

// コマンド待ち受け
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const language = await lang(message.guildId);
    if (!isReady) return message.reply(globalLanguage.isReady[language]);
    
    if (!message.content.startsWith(prefix) || message.author.bot) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.commands.get(commandName);

    if (!command) return;

    try {
        loggerChannel.send(`**${message.guild.name}**で**!${commandName}**が実行されました`);
        await command.execute(message, args, language);
    }
    catch (error) {
        console.error(error);
        errorChannel.send(`Error: \n\`\`\`${error}\`\`\``);
        message.reply({ content: globalLanguage.error[language] , ephemeral: true });
    }
});
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const language = await lang(interaction.guildId);
    if (!isReady) return interaction.reply(globalLanguage.isReady[language]);

    if (interaction.deferred || interaction.replied) {
        console.log('このインタラクションは既に応答されています。');
        return;
    }

    const args = "いんたらくしょんだからないよ～ん"
    const command = client.commands.get(interaction.commandName);

    if (!command) return;

    try {
        loggerChannel.send(`**${interaction.guild.name}**で/**${interaction.commandName}**が実行されました`);
        await command.execute(interaction, args, language);
    }
    catch (error) {
        console.error(error);
        errorChannel.send(`Error: \n\`\`\`${error}\`\`\``);
        await interaction.reply({ content: globalLanguage.error[language], ephemeral: true });
    }
});

// 音楽再生中のボタン待ち受け
client.on('interactionCreate', async interaction => {
    if (interaction.deferred || interaction.replied) {
        console.log('このインタラクションは既に応答されています。');
        return;
    }

    if (!interaction.isButton()) return;
    const { customId } = interaction;
    if (customId === 'next' || customId === 'prev') return;

    let args = [];
    const language = await lang(interaction.guildId);
    const guildVolume = await volume(interaction.guildId);

    switch (customId) {
        case 'volumeSmall':
            args = [Math.max(0, guildVolume - 5)];
            break;
        case 'volumeDefault':
            args = [10];
            break;
        case 'volumeBig':
            args = [Math.min(100, guildVolume + 5)];
            break;
        default:
            await executeCommand(customId, interaction, [], language);
            return;
    }

    await executeCommand('volume', interaction, args, language);

    async function executeCommand(commandName, interaction, args, language) {
        const command = client.commands.get(commandName);
        if (command) await command.execute(interaction, args, language);
    }
});

// 自身への返信メッセージを削除する
client.on('messageCreate', async message => {
    if (message.author.bot && message.reference) {
        try {
            const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
            if (repliedMessage.author.id === client.user.id) {
                setTimeout(() => {
                    message.delete().catch(console.error);
                }, 3000);
            }
        }
        catch (error) {
            if (error.code === 10008) console.error('The message was not found.');
            else {
                console.error('Error fetching replied message:', error);
                errorChannel.send(`Error fetching replied message: \n\`\`\`${error}\`\`\``);
            }
        }
    }
});

client.on('voiceStateUpdate', (oldState, newState) => {
    updateActivity(client);
    updatePlayingGuild();
    const oldVoiceChannel = oldState.channel;
    const newVoiceChannel = newState.channel;

    if (oldVoiceChannel && (!newVoiceChannel || newVoiceChannel.id !== oldVoiceChannel.id)) {
        const isOnlyBotsLeft = oldVoiceChannel.members.filter(member => !member.user.bot).size === 0;

        if (oldVoiceChannel.members.size === 0 || isOnlyBotsLeft) {
            return cleanupQueue(newState.guild.id);
        }
    }
});

client.on('guildCreate', guild => {
    if (guild.preferredLocale === 'ja') {
        setData(guild.id, 'ja');
    }
    updateActivity(client);
    loggerChannel.send(`${guild.name} に参加しました。`);
});

client.on('guildDelete', guild => {
    cleanupQueue(guild.id);
    removeData(guild.id);
    updateActivity(client);
    loggerChannel.send(`${guild.name} から退出しました。`);
});

// 1分おきにアクティビティを更新
setInterval(() => {
    updateActivity(client);
    updatePlayingGuild();
}, 60000);

function wait(seconds) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

async function cleanupQueue(guildId) {
    const serverQueue = musicQueue.get(guildId);
    if (serverQueue) {
        serverQueue.autoPlay = false;
        if (serverQueue.audioPlayer) serverQueue.audioPlayer.removeAllListeners();
        if (serverQueue.connection && serverQueue.connection.state.status !== "destroyed") serverQueue.connection.destroy();

        if (serverQueue.playingMessage && serverQueue.playingMessage.components) {
            try {
                const disabledButtons = new ActionRowBuilder()
                    .addComponents(
                        serverQueue.playingMessage.components[0].components.map(button =>
                            ButtonBuilder.from(button).setDisabled(true)
                        )
                    );
                const disabledButtons2 = new ActionRowBuilder()
                    .addComponents(
                        serverQueue.playingMessage.components[1].components.map(button =>
                            ButtonBuilder.from(button).setDisabled(true)
                        )
                    );
                await serverQueue.playingMessage.edit({ components: [disabledButtons, disabledButtons2] });
            }
            catch (error) {
                console.error('Failed to disable buttons:', error);
            }
        }
        musicQueue.delete(guildId);
    }
}

process.on('uncaughtException', (err) => {
    console.error(err);
    errorChannel.send(`uncaughtException: \n\`\`\`${err}\`\`\``);
});

client.login(process.env.DISCORD_TOKEN);