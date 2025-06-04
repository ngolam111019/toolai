const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // bỏ kiểm tra chứng chỉ để kết nối SSL
  }
});

pool.on('connect', async (client) => {
  await client.query(`SET TIME ZONE 'Asia/Ho_Chi_Minh';`);
});

module.exports = pool;