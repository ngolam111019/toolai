const { Pool } = require('pg');

// Tắt SSL khi kết nối local/docker, bật SSL khi kết nối cloud
const dbUrl = process.env.DATABASE_URL || '';
const isLocal = dbUrl.includes('localhost')
  || dbUrl.includes('127.0.0.1')
  || dbUrl.includes('@postgres:')  // Docker Compose service name
  || dbUrl.includes('sslmode=disable');

const pool = new Pool({
  connectionString: dbUrl,
  ssl: isLocal ? false : { rejectUnauthorized: false }
});

pool.on('connect', async (client) => {
  await client.query(`SET TIME ZONE 'Asia/Ho_Chi_Minh';`);
});

/**
 * Execute a callback within a database transaction.
 * All queries using the provided client will be part of the same transaction.
 * Automatically commits on success, rolls back on error.
 *
 * @param {Function} callback - Async function receiving the client
 * @returns {Promise<any>} Result of the callback
 */
async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  withTransaction,
};