const { connection } = require('./connection');
const { loggerChannel, errorChannel } = require('../src/log');

async function volume(guildId) {
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

module.exports = { volume, lang }