require('dotenv').config();
const mysql = require('mysql2/promise');

const connection = mysql.createPool({
    host: process.env.DATABASE_ADDRESS,
    port: process.env.DATABASE_PORT,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

let offlineMode = false;

async function createTable() {
    try {
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS guild_settings (
                guild_id VARCHAR(255) NOT NULL PRIMARY KEY,
                volume INT NOT NULL DEFAULT 10 CHECK (volume >= 0 AND volume <= 100),
                lang ENUM('en', 'ja') NOT NULL DEFAULT 'en',
                removeWord TINYINT NOT NULL DEFAULT 0,
                LogChannel VARCHAR(255) DEFAULT NULL
            )
        `;
        await connection.execute(createTableQuery);
        console.log('Database connection successful');
    }
    catch (error) {
        offlineMode = true;
        console.log('Switching to offline mode.');
    }
}

function PoolMonitor() {
    process.dashboardData.SQLpool = {
        connectionLimit: connection.pool.config.connectionLimit, // 最大接続数
        activeConnections: connection.pool._allConnections.length, // 使用中の接続数
        idleConnections: connection.pool._freeConnections.length,  // アイドル状態の接続数
        pendingConnections: connection.pool._connectionQueue.length // 待機中の接続数
    };
}

setInterval(PoolMonitor, 10000);

function isOfflineMode() {
    return offlineMode;
}

module.exports = { createTable, connection, isOfflineMode };
