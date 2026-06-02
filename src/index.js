// index.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
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

// Security Middlewares
app.use(helmet());

// Strictly configure CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [];
app.use(cors({
  origin: (origin, callback) => {
    // Cho phép requests không có origin (như Mobile App, Postman hoặc curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    return callback(new Error('Blocked by CORS'));
  },
  credentials: true
}));

app.use(express.json()); // parse JSON body

// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau 15 phút.'
    }
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // limit each IP to 15 auth requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Yêu cầu đăng nhập quá thường xuyên. Vui lòng thử lại sau 15 phút.'
    }
  }
});

app.use('/api/', apiLimiter);
app.use('/api/auth/', authLimiter);

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