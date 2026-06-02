const { Pool } = require('pg');

// Tắt SSL khi kết nối local (localhost/127.0.0.1), bật SSL khi kết nối cloud
const dbUrl = process.env.DATABASE_URL || '';
const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');

const pool = new Pool({
  connectionString: dbUrl,
  ssl: isLocal ? false : { rejectUnauthorized: false }
});

pool.on('connect', async (client) => {
  await client.query(`SET TIME ZONE 'Asia/Ho_Chi_Minh';`);
});

module.exports = pool;