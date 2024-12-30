const { connection, isOfflineMode } = require('./connection');
const { getLoggerChannel, getErrorChannel } = require('../src/log');

async function volume(guildId) {
    const errorChannel = getErrorChannel();
    
    // オフラインモードの場合、デフォルト値を返す
    if (isOfflineMode()) {
        return 10; // デフォルト値
    }

    const query = 'SELECT volume FROM guild_settings WHERE guild_id = ?';
    try {
        const [rows] = await connection.execute(query, [guildId]);
        if (rows.length > 0) {
            return rows[0].volume;
        } else {
            return 10; // デフォルト値
        }
    } catch (error) {
        console.error('Failed to get volume:', error);
        errorChannel.send(`Failed to get volume: \n\`\`\`${error}\`\`\``);
        return 10; // エラー時もデフォルト値
    }
}

async function lang(guildId) {
    const errorChannel = getErrorChannel();

    // オフラインモードの場合、デフォルト値を返す
    if (isOfflineMode()) {
        return 'en'; // デフォルト値
    }

    const query = 'SELECT lang FROM guild_settings WHERE guild_id = ?';
    try {
        const [rows] = await connection.execute(query, [guildId]);
        if (rows.length > 0) {
            return rows[0].lang;
        } else {
            return 'en'; // デフォルト値
        }
    } catch (error) {
        console.error('Failed to get lang:', error);
        errorChannel.send(`Failed to get lang: \n\`\`\`${error}\`\`\``);
        return 'en'; // エラー時もデフォルト値
    }
}

async function removeWord(guildId) {
    const errorChannel = getErrorChannel();

    // オフラインモードの場合、デフォルト値を返す
    if (isOfflineMode()) {
        return false; // デフォルト値
    }

    const query = 'SELECT removeWord FROM guild_settings WHERE guild_id = ?';
    try {
        const [rows] = await connection.execute(query, [guildId]);
        if (rows.length > 0) {
            return Boolean(rows[0].removeWord);
        } else {
            return false; // デフォルト値
        }
    } catch (error) {
        console.error('Failed to get removeWord:', error);
        errorChannel.send(`Failed to get removeWord: \n\`\`\`${error}\`\`\``);
        return false; // エラー時もデフォルト値
    }
}

// LogChannelを取得する

async function LogChannel(guildId) {
    const errorChannel = getErrorChannel();

    // オフラインモードの場合、デフォルト値を返す
    if (isOfflineMode()) {
        return null; // デフォルト値
    }

    const query = 'SELECT LogChannel FROM guild_settings WHERE guild_id = ?';

    try {
        const [rows] = await connection.execute(query, [guildId]);
        if (rows.length > 0) {
            return rows[0].LogChannel;
        } else {
            return null; // デフォルト値
        }
    } catch (error) {
        console.error('Failed to get LogChannel:', error);
        errorChannel.send(`Failed to get LogChannel: \n\`\`\`${error}\`\`\``);
        return null; // エラー時もデフォルト値
    }
}

module.exports = { volume, lang, removeWord, LogChannel };