const db = require('../config/database');
const { verifyToken } = require('../config/auth');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '未提供认证令牌'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: '无效的认证令牌'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    req.user = decoded;
    next();
  } catch (error) {
    console.error('认证中间件错误:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: '认证处理失败'
      },
      timestamp: new Date().toISOString()
    });
  }
};

const adminMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '未提供认证令牌'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    const decoded = verifyToken(token);
    
    if (!decoded || decoded.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '需要管理员权限'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    req.user = decoded;
    next();
  } catch (error) {
    console.error('管理员权限中间件错误:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: '认证处理失败'
      },
      timestamp: new Date().toISOString()
    });
  }
};

const logMiddleware = async (req, res, next) => {
  const startTime = req.startTime || Date.now();
  
  res.on('finish', async () => {
    const duration = Date.now() - startTime;
    const userId = req.user?.id || null;
    
    if (userId) {
      try {
        await db.query(
          'INSERT INTO operation_logs (user_id, action, module, details, ip_address) VALUES (?, ?, ?, ?, ?)',
          [
            userId,
            req.method,
            req.path,
            JSON.stringify({
              method: req.method,
              path: req.path,
              query: req.query,
              duration: `${duration}ms`
            }),
            req.ip || req.connection.remoteAddress
          ]
        );
      } catch (error) {
        console.error('记录操作日志失败:', error);
      }
    }
  });
  
  next();
};

module.exports = {
  authMiddleware,
  adminMiddleware,
  logMiddleware
};
