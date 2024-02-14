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
const updateActivity = require('./src/activity')

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
    await client.application.commands.set(commands, guildId);

    console.log(`Logged in as ${client.user.tag}`);
    updateActivity(client)
});

// コマンド待ち受け
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (!message.content.startsWith(prefix) || message.author.bot) return;

    const language = await lang(message.guildId);

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.commands.get(commandName);

    if (!command) return;

    try {
        await command.execute(message, args, language);
    }
    catch (error) {
        console.error(error);
        message.reply({ content: globalLanguage.error[language] , ephemeral: true });
    }
});
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    if (interaction.deferred || interaction.replied) {
        console.log('このインタラクションは既に応答されています。');
        return;
    }

    const language = await lang(interaction.guildId);
    const args = "いんたらくしょんだからないよ～ん"
    const command = client.commands.get(interaction.commandName);

    if (!command) return;

    try {
        await command.execute(interaction, args, language);
    }
    catch (error) {
        console.error(error);
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
        if (command) {
            await command.execute(interaction, args, language);
        }
        else {
            console.error(`Command not found: ${commandName}`);
        }
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
        } catch (error) {
            console.error('Error fetching replied message:', error);
        }
    }
});

client.on('voiceStateUpdate', (oldState, newState) => {
    updateActivity(client);
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
});

client.on('guildDelete', guild => {
    removeData(guild.id);
    cleanupQueue(guild.id);
    updateActivity(client);
});

// 1分おきにアクティビティを更新
setInterval(() => {
    updateActivity(client);
}, 60000);

function cleanupQueue(guildId) {
    const serverQueue = musicQueue.get(guildId);
    if (serverQueue) {
        serverQueue.autoPlay = false;
        serverQueue.audioPlayer.removeAllListeners();
        serverQueue.connection.destroy();

        if (serverQueue.playingMessage) {
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
            serverQueue.playingMessage.edit({ components: [ disabledButtons, disabledButtons2 ] }).catch(console.error);
        }
        musicQueue.delete(guildId);
    }
}

process.on('uncaughtException', (err) => {
    console.error(err);
});

client.login(process.env.DISCORD_TOKEN);