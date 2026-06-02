// index.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const app = express();
const db = require('./config/db');
const server = http.createServer(app);
const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');
const { sendDiscord } = require('./utils/discord-notify');
const { errorHandler, notFoundHandler } = require('./middleware/error-handler');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Routers
const authRoutes = require('./routes/auth-routes');
const toolRoutes = require('./routes/tool-routes');
const paymentRoutes = require('./routes/payment-routes');
const packageRoutes = require('./routes/package-routes');
const gatewayRoutes = require('./routes/gateway-routes');
const balanceRoutes = require('./routes/balance-routes');
const usageLogsRoutes = require('./routes/usagelog-routes');
const notiRoutes = require('./routes/noti-routes');
require('./services/noti-scheduler-signup-trial-used');
require('./services/noti-scheduler-events');
require('./services/noti-sender');

// Middleware chung
app.use(cors());
app.use(express.json()); // parse JSON body

// Health check
app.get('/', (req, res) => {
  res.json({ success: true, message: 'Tool AI API is running 🚀', version: '1.0.0' });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/tool', toolRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/package', packageRoutes);
app.use('/api/gateway', gatewayRoutes);
app.use('/api/balance', balanceRoutes);
app.use('/api/usagelog', usageLogsRoutes);
app.use('/api/noti', notiRoutes);

// 404 handler — phải đặt sau tất cả routes
app.use(notFoundHandler);

// Global error handler — phải đặt CUỐI CÙNG (4 params)
app.use(errorHandler);

const { initSocket } = require('./services/socket-service');
initSocket(server);

// Khởi động server
const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  try {
    await db.query('SELECT 1'); // test DB connection
    console.log(`✅ DB connected`);
    console.log(`🚀 Server + Socket running at http://localhost:${PORT}`);
  } catch (err) {
    sendDiscord('error', `🚨 Lỗi hệ thống [index]: ${err.message}\nThời gian: ${new Date().toLocaleString()}`);
    console.error('❌ Failed to connect to DB:', err);
  }
});