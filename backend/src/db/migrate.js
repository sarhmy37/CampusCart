require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./pool');

async function migrate() {
    const schemaPath = path.join(__dirname, '..', '..', 'sql', 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    console.log('Running schema.sql against the database...');
    try {
        await pool.query(sql);
        console.log('✅ Migration complete — all tables are ready.');
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

migrate();
