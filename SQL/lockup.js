const { connection } = require('./connection');

async function volume(guildId) {
    const query = 'SELECT volume FROM guild_settings WHERE guild_id = ?';
    try {
        const [result] = await connection.execute(query, [guildId]);
        return result[0].volume || 10;
    }
    catch (error) {
        console.error('Failed to get volume:', error);
        throw error;
    }
}

async function lang(guildId) {
    const query = 'SELECT lang FROM guild_settings WHERE guild_id = ?';
    try {
        const [result] = await connection.execute(query, [guildId]);
        return result[0].lang || 'en';
    }
    catch (error) {
        console.error('Failed to get lang:', error);
        throw error;
    }
}

module.exports = { volume, lang }