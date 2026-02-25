// 加载环境变量配置（必须在其他模块之前加载）
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();

const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:8080';

// CORS配置：支持多个来源（开发环境）
const allowedOrigins = [
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
];

app.use(cors({
  origin: function (origin, callback) {
    // 允许无origin的请求（如Postman、移动应用等）
    if (!origin) return callback(null, true);
    
    // 开发环境：允许所有localhost和127.0.0.1的请求（任何端口）
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    
    // 检查是否在允许列表中
    if (allowedOrigins.indexOf(origin) !== -1 || CORS_ORIGIN.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('不允许的CORS来源: ' + origin));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(express.static(path.join(__dirname, '../public')));

app.use((req, res, next) => {
  req.id = uuidv4();
  res.startTime = Date.now();
  next();
});

const apiRoutes = require('./routes');
app.use('/api', apiRoutes);

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: err.message || '服务器内部错误'
    },
    timestamp: new Date().toISOString()
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: '请求的资源不存在'
    },
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`eMAG市场海选系统后端服务已启动`);
  console.log(`端口: ${PORT}`);
  console.log(`环境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`CORS来源: ${CORS_ORIGIN}`);
});

module.exports = app;
