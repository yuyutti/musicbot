require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');

const { connection, createTable } = require('./SQL/connection');
const { lang } = require('./SQL/lockup');
const globalLanguage = require('./lang/commands/global');

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

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);

    client.commands.set(command.data.name, command);

    if (command.alias) {
        for (const alias of command.alias) {
            client.commands.set(alias, command);
        }
    }
}

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async message => {
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

client.login(process.env.DISCORD_TOKEN);
