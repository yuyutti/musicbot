const { connection } = require('./connection');
const { getLoggerChannel, getErrorChannel } = require('../src/log');

async function volume(guildId) {
    const errorChannel = getErrorChannel();
    const query = 'SELECT volume FROM guild_settings WHERE guild_id = ?';
    try {
        const [rows] = await connection.execute(query, [guildId]);
        if (rows.length > 0) {
            return rows[0].volume;
        } else {
            return 10;
        }
    } catch (error) {
        console.error('Failed to get volume:', error);
        errorChannel.send(`Failed to get volume: \n\`\`\`${error}\`\`\``);
        throw error;
    }
}

async function lang(guildId) {
    const query = 'SELECT lang FROM guild_settings WHERE guild_id = ?';
    try {
        const [rows] = await connection.execute(query, [guildId]);
        if (rows.length > 0) {
            return rows[0].lang;
        } else {
            return 'en';
        }
    } catch (error) {
        console.error('Failed to get lang:', error);
        errorChannel.send(`Failed to get lang: \n\`\`\`${error}\`\`\``);
        throw error;
    }
}

async function removeWord(guildId) {
    const query = 'SELECT removeWord FROM guild_settings WHERE guild_id = ?';
    try {
        const [rows] = await connection.execute(query, [guildId]);
        if (rows.length > 0) {
            return Boolean(rows[0].removeWord);
        } else {
            return false;
        }
    } catch (error) {
        console.error('Failed to get removeWord:', error);
        errorChannel.send(`Failed to get removeWord: \n\`\`\`${error}\`\`\``);
        throw error;
    }
}

module.exports = { volume, lang, removeWord }