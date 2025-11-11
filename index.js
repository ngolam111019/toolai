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
require('./notification/noti.scheduler.events');
require('./notification/noti.sender');

// Middleware chung
app.use(cors());
app.use(express.json()); // parse JSON body

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/tool', toolRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/package', packageRoutes);
app.use('/api/gateway', gatewayRoutes);
app.use('/api/balance', balanceRoutes);
app.use('/api/usagelog', usageLogsRoutes);
app.use('/api/noti', notiRoutes);

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

const { initSocket } = require('./socket/socket');
initSocket(server); // <-- chạy socket server
// Khởi động server
const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  try {
    await db.query('SELECT 1'); // test DB
    console.log(`✅ DB connected`);
    console.log(`🚀 Server + Socket running at http://localhost:${PORT}`);
  } catch (err) {
    sendDiscord('error', `🚨 Lỗi hệ thống [index]: ${err.message}\nThời gian: ${new Date().toLocaleString()}`);
    console.error('❌ Failed to connect to DB:', err);
  }
});