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

async function createTable() {
    try {
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS guild_settings (
                guild_id VARCHAR(255) NOT NULL PRIMARY KEY,
                volume INT NOT NULL DEFAULT 10 CHECK (volume >= 0 AND volume <= 100),
                lang ENUM('en', 'ja') NOT NULL DEFAULT 'en'
            )
        `;
        await connection.execute(createTableQuery);
        console.log('Database connection');
    }
    catch (error) {
        console.error('Database connection failed:', error);
        throw error;
    }
}

module.exports = { createTable, connection };