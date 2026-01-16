const express = require('express');
const router = express.Router();

// 导入各个路由模块
const authRoutes = require('./auth');
const productRoutes = require('./products');
const wpsRoutes = require('./wps');

// 认证路由
router.post('/auth/login', authRoutes.login);
router.post('/auth/logout', authRoutes.logout);
router.get('/auth/me', authRoutes.getMe);

// 产品路由
router.use('/products', productRoutes);

// WPS路由
router.use('/wps', wpsRoutes);

module.exports = router;
