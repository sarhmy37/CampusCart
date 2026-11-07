const { Pool } = require('pg');

const useSSL = process.env.DB_SSL === 'true';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: useSSL ? { rejectUnauthorized: false } : false,
});

pool.on('connect', (client) => {
    client.query(`SET TIME ZONE 'UTC'`).catch((err) => {
        console.error('Failed to set database timezone:', err);
    });
});

module.exports = pool;
