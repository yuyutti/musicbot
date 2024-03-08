const { connection } = require('./connection');
const { loggerChannel, errorChannel } = require('../src/log');

async function setData(guildId, arg) {
    let query = `INSERT INTO guild_settings (guild_id`;
    let updateClause = `ON DUPLICATE KEY UPDATE `;
    let values = [guildId];

    const argAsNumber = parseInt(arg, 10);
    if (!isNaN(argAsNumber) && argAsNumber >= 0 && argAsNumber <= 100) {
        query += `, volume) VALUES (?, ?)`;
        updateClause = `ON DUPLICATE KEY UPDATE volume = VALUES(volume)`;
        values.push(argAsNumber);
    }

    else if (arg === 'en' || arg === 'ja') {
        query += `, lang) VALUES (?, ?) `;
        updateClause += `lang = VALUES(lang)`;
        values.push(arg);
    } else {
        console.error('Invalid argument provided');
        errorChannel.send(`Invalid argument provided: \n\`\`\`${arg}\`\`\``);
        return;
    }

    query += updateClause;

    try {
        const [result] = await connection.execute(query, values);
    } catch (error) {
        console.error('Failed to update guild setting:', error);
        errorChannel.send(`Failed to update guild setting: \n\`\`\`${error}\`\`\``);
        throw error;
    }
}

module.exports = { setData };