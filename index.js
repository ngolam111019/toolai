// index.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const app = express();
const db = require('./db/db');
const server = http.createServer(app);
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
const { sendDiscord } = require('./utils/discordNotify');
const { errorHandler, notFoundHandler } = require('./src/middleware/error-handler');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Routers
const authRoutes = require('./auth/auth.routes');
const toolRoutes = require('./tool/tool.routes');
const paymentRoutes = require('./payment/payment.routes');
const packageRoutes = require('./package/package.routes');
const gatewayRoutes = require('./tool/gateway.routes');
const balanceRoutes = require('./balance/balance.routes');
const usageLogsRoutes = require('./usagelogs/usagelog.routes');
const notiRoutes = require('./notification/noti.routes');
require('./notification/noti.scheduler.signupTrialUsed');
require('./notification/noti.scheduler.events');
require('./notification/noti.sender');

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

const { initSocket } = require('./socket/socket');
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