const { Pool } = require('pg');
const config = require('../config');

const pool = new Pool({
    connectionString: config.database.url,
    ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
    console.error('Unexpected database pool error:', err);
});

async function query(text, params) {
    const start = Date.now();
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (config.nodeEnv === 'development' && duration > 100) {
        console.log('Slow query:', { text: text.substring(0, 80), duration, rows: result.rowCount });
    }
    return result;
}

async function getClient() {
    const client = await pool.connect();
    return client;
}

async function transaction(callback) {
    const client = await getClient();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

async function healthCheck() {
    try {
        await pool.query('SELECT 1');
        return true;
    } catch (err) {
        return false;
    }
}

module.exports = { query, getClient, transaction, healthCheck, pool };
