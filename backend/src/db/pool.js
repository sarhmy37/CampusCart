const { Pool } = require('pg');

const useSSL = process.env.DB_SSL === 'true';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: useSSL ? { rejectUnauthorized: false } : false,
});

module.exports = pool;
