const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // bỏ kiểm tra chứng chỉ để kết nối SSL
  }
});

module.exports = pool;