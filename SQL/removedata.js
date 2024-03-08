// DBからデータを消す
const { connection } = require('./connection');
const { loggerChannel, errorChannel } = require('../src/log');

async function removeData(guildId) {
    const query = 'DELETE FROM guild_settings WHERE guild_id = ?';
    try {
        const [result] = await connection.execute(query, [guildId]);
    } catch (error) {
        console.error('Failed to remove guild setting:', error);
        errorChannel.send(`Failed to remove guild setting: \n\`\`\`${error}\`\`\``);
        throw error;
    }
}

module.exports = { removeData };