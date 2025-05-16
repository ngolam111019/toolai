// index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const db = require('./db/db');

// Routers
const authRoutes = require('./auth/auth.routes');
const toolRoutes = require('./tool/tool.routes');
const paymentRoutes = require('./payment/payment.routes');
const packageRoutes = require('./tool/package.routes');

// Middleware chung
app.use(cors());
app.use(express.json()); // parse JSON body

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/tool', toolRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/package', packageRoutes);

// Health check
app.get('/', (req, res) => {
  res.send('Tool AI API is running 🚀');
});

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Khởi động server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  try {
    await db.query('SELECT 1'); // test DB
    console.log(`✅ DB connected`);
    console.log(`🚀 Server running at http://localhost:${PORT}`);
  } catch (err) {
    console.error('❌ Failed to connect to DB:', err);
  }
});