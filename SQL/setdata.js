const { connection, isOfflineMode } = require('./connection');
const { getLoggerChannel, getErrorChannel } = require('../src/log');
const remove = require('../commands/remove');

const errorChannel = getErrorChannel();

async function updateVolume(guildId, volume) {
    if (isOfflineMode()) {
        errorChannel.send('Offline mode active. Skipping database update.');
        return;
    }

    if (isNaN(volume) || volume < 0 || volume > 100) {
        console.error('Invalid volume provided');
        errorChannel.send(`Invalid volume provided: ${volume}`);
        return;
    }

    const query = `INSERT INTO guild_settings (guild_id, volume) VALUES (?, ?)
                ON DUPLICATE KEY UPDATE volume = VALUES(volume)`;
    const values = [guildId, volume];

    try {
        await connection.execute(query, values);
    } catch (error) {
        console.error('Failed to update volume:', error);
        errorChannel.send(`Failed to update volume: \n\`\`\`${error}\`\`\``);
        throw error;
    }
}

async function updateLang(guildId, lang) {
    if (isOfflineMode()) {
        errorChannel.send('Offline mode active. Skipping database update.');
        return;
    }

    if (lang !== 'en' && lang !== 'ja') {
        console.error('Invalid language provided');
        errorChannel.send(`Invalid language provided: ${lang}`);
        return;
    }

    const query = `INSERT INTO guild_settings (guild_id, lang) VALUES (?, ?)
                ON DUPLICATE KEY UPDATE lang = VALUES(lang)`;
    const values = [guildId, lang];

    try {
        await connection.execute(query, values);
    } catch (error) {
        console.error('Failed to update language:', error);
        errorChannel.send(`Failed to update language: \n\`\`\`${error}\`\`\``);
        throw error;
    }
}

async function updateRemoveWord(guildId, removeWord) {
    if (isOfflineMode()) {
        errorChannel.send('Offline mode active. Skipping database update.');
        return;
    }

    let value = 0;
    if (removeWord === "true") value = 1;

    const query = `INSERT INTO guild_settings (guild_id, removeWord) VALUES (?, ?)
                ON DUPLICATE KEY UPDATE removeWord = VALUES(removeWord)`;
    const values = [guildId, value];

    try {
        await connection.execute(query, values);
    } catch (error) {
        console.error('Failed to update removeWord:', error);
        errorChannel.send(`Failed to update removeWord: \n\`\`\`${error}\`\`\``);
        throw error;
    }
}

async function updateLogChannel(guildId, logChannel) {
    if (isOfflineMode()) {
        errorChannel.send('Offline mode active. Skipping database update.');
        return;
    }

    const query = `INSERT INTO guild_settings (guild_id, LogChannel) VALUES (?, ?)
                ON DUPLICATE KEY UPDATE LogChannel = VALUES(LogChannel)`;
    const values = [guildId, logChannel];

    try {
        await connection.execute(query, values);
    } catch (error) {
        console.error('Failed to update LogChannel:', error);
        errorChannel.send(`Failed to update LogChannel: \n\`\`\`${error}\`\`\``);
        throw error;
    }
}

module.exports = { updateVolume, updateLang, updateRemoveWord, updateLogChannel };