// DBからデータを消す
const { connection } = require('./connection');

async function removeData(guildId) {
    const query = 'DELETE FROM guild_settings WHERE guild_id = ?';
    try {
        const [result] = await connection.execute(query, [guildId]);
    } catch (error) {
        console.error('Failed to remove guild setting:', error);
        throw error;
    }
}

module.exports = { removeData };