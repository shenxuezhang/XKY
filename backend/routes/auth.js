const db = require('../config/database');
const { verifyToken, generateToken } = require('../config/auth');
const bcrypt = require('bcryptjs');

const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: '用户名和密码不能为空'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    const [users] = await db.query(
      'SELECT * FROM users WHERE username = ? AND is_active = TRUE',
      [username]
    );
    
    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: '用户名或密码错误'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    const user = users[0];
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: '用户名或密码错误'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    const token = generateToken({
      id: user.id,
      username: user.username,
      role: user.role
    });
    
    await db.query(
      'UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [user.id]
    );
    
    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }
      },
      message: '登录成功',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LOGIN_ERROR',
        message: '登录处理失败'
      },
      timestamp: new Date().toISOString()
    });
  }
};

const logout = async (req, res) => {
  try {
    res.json({
      success: true,
      message: '登出成功',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('登出失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LOGOUT_ERROR',
        message: '登出处理失败'
      },
      timestamp: new Date().toISOString()
    });
  }
};

const getMe = async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '未认证'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    const [users] = await db.query(
      'SELECT id, username, role, is_active, created_at, updated_at FROM users WHERE id = ?',
      [userId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: '用户不存在'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      data: users[0],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_USER_ERROR',
        message: '获取用户信息失败'
      },
      timestamp: new Date().toISOString()
    });
  }
};

module.exports = {
  login,
  logout,
  getMe
};
