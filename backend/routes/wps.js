const express = require('express');
const router = express.Router();
const axios = require('axios');
const XLSX = require('xlsx');

/**
 * WPS云文档导入路由
 * 负责处理WPS OAuth授权、文件列表获取、文件内容导入等功能
 */

// WPS API配置（从环境变量读取）
const WPS_APP_ID = process.env.WPS_APP_ID || '';
const WPS_APP_SECRET = process.env.WPS_APP_SECRET || '';
const WPS_REDIRECT_URI = process.env.WPS_REDIRECT_URI || '';
const WPS_API_BASE = 'https://open.wps.cn/api/v1';

/**
 * 获取WPS授权URL
 * GET /api/wps/auth-url
 */
router.get('/auth-url', (req, res) => {
  try {
    if (!WPS_APP_ID || !WPS_REDIRECT_URI) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'WPS_CONFIG_MISSING',
          message: 'WPS配置缺失，请检查环境变量'
        },
        timestamp: new Date().toISOString()
      });
    }

    // WPS OAuth授权URL（使用正确的端点）
    const authUrl = `https://openapi.wps.cn/oauth2/auth?client_id=${WPS_APP_ID}&redirect_uri=${encodeURIComponent(WPS_REDIRECT_URI)}&response_type=code&scope=file.read`;
    
    res.json({
      success: true,
      data: { authUrl },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('获取WPS授权URL失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_AUTH_URL_ERROR',
        message: '获取授权URL失败'
      },
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * WPS OAuth回调处理
 * GET /api/wps/callback
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, error, error_description } = req.query;

    console.log('WPS OAuth回调收到请求:', {
      code: code ? '已收到code' : '未收到code',
      error,
      error_description,
      query: req.query
    });

    if (error) {
      console.error('WPS授权回调错误:', error_description || error);
      let frontendUrl = process.env.FRONTEND_URL || 'http://127.0.0.1:5173';
      return res.redirect(`${frontendUrl}/wps-auth-success.html?error=${encodeURIComponent(error_description || error)}`);
    }

    if (!code) {
      console.error('WPS授权回调：未收到code参数');
      let frontendUrl = process.env.FRONTEND_URL || 'http://127.0.0.1:5173';
      return res.redirect(`${frontendUrl}/wps-auth-success.html?error=${encodeURIComponent('未获取到授权码')}`);
    }

    // 交换access_token（WPS要求使用form-data格式）
    const tokenResponse = await axios.post('https://openapi.wps.cn/oauth2/token', null, {
      params: {
        client_id: WPS_APP_ID,
        client_secret: WPS_APP_SECRET,
        code,
        redirect_uri: WPS_REDIRECT_URI,
        grant_type: 'authorization_code'
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    console.log('WPS Token交换成功:', {
      hasAccessToken: !!tokenResponse.data.access_token,
      hasRefreshToken: !!tokenResponse.data.refresh_token,
      expiresIn: tokenResponse.data.expires_in
    });

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    if (!access_token || !refresh_token) {
      console.error('WPS Token交换返回数据不完整:', tokenResponse.data);
      let frontendUrl = process.env.FRONTEND_URL || 'http://127.0.0.1:5173';
      return res.redirect(`${frontendUrl}/wps-auth-success.html?error=${encodeURIComponent('获取Token失败')}`);
    }

    // 重定向到前端，携带token
    // 优先使用环境变量，否则根据请求来源推断前端地址
    let frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl) {
      // 从请求头中获取来源，或使用默认值
      const referer = req.headers.referer || '';
      if (referer.includes('127.0.0.1:5173')) {
        frontendUrl = 'http://127.0.0.1:5173';
      } else if (referer.includes('localhost:5173')) {
        frontendUrl = 'http://localhost:5173';
      } else {
        frontendUrl = 'http://127.0.0.1:5173'; // 默认使用5173端口
      }
    }
    
    console.log('重定向到前端:', `${frontendUrl}/wps-auth-success.html`);
    res.redirect(`${frontendUrl}/wps-auth-success.html?token=${access_token}&refresh_token=${refresh_token}&expires_in=${expires_in}`);
  } catch (error) {
    console.error('WPS OAuth回调处理失败:', error.response?.data || error.message);
    console.error('错误详情:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    
    const errorMsg = error.response?.data?.error_description || 
                     error.response?.data?.error || 
                     error.message || 
                     '授权失败';
    
    // 重定向到前端错误页面
    let frontendUrl = process.env.FRONTEND_URL || 'http://127.0.0.1:5173';
    res.redirect(`${frontendUrl}/wps-auth-success.html?error=${encodeURIComponent(errorMsg)}`);
  }
});

/**
 * 检查授权状态
 * GET /api/wps/check-auth
 */
router.get('/check-auth', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.json({
        success: false,
        data: { authorized: false },
        timestamp: new Date().toISOString()
      });
    }

    // 验证token有效性（调用WPS API获取用户信息）
    try {
      const userResponse = await axios.get(`${WPS_API_BASE}/user/info`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      res.json({
        success: true,
        data: {
          authorized: true,
          user: userResponse.data
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      // Token无效或过期
      res.json({
        success: false,
        data: { authorized: false },
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('检查WPS授权状态失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CHECK_AUTH_ERROR',
        message: '检查授权状态失败'
      },
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 获取文件列表
 * GET /api/wps/files
 */
router.get('/files', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '未授权，请先登录WPS账号'
        },
        timestamp: new Date().toISOString()
      });
    }

    const { page = 1, pageSize = 50, fileType = 'spreadsheet' } = req.query;

    // 调用WPS API获取文件列表
    const filesResponse = await axios.get(`${WPS_API_BASE}/files`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      params: {
        page: parseInt(page),
        page_size: parseInt(pageSize),
        file_type: fileType // spreadsheet: 表格, document: 文档, presentation: 演示
      }
    });

    // 过滤出支持的文件格式（.xlsx, .xls, .csv）
    const supportedExtensions = ['.xlsx', '.xls', '.csv'];
    const files = filesResponse.data.files || filesResponse.data || [];
    const filteredFiles = files.filter(file => {
      const fileName = file.name?.toLowerCase() || '';
      return supportedExtensions.some(ext => fileName.endsWith(ext));
    });

    res.json({
      success: true,
      data: {
        files: filteredFiles,
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total: filteredFiles.length
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('获取WPS文件列表失败:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_FILES_ERROR',
        message: error.response?.data?.error_description || '获取文件列表失败'
      },
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 导入文件内容
 * GET /api/wps/import/:fileId
 */
router.get('/import/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '未授权，请先登录WPS账号'
        },
        timestamp: new Date().toISOString()
      });
    }

    // 获取文件下载链接
    const fileInfoResponse = await axios.get(`${WPS_API_BASE}/files/${fileId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const downloadUrl = fileInfoResponse.data.download_url || fileInfoResponse.data.url;

    if (!downloadUrl) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'FILE_NOT_FOUND',
          message: '文件下载链接不存在'
        },
        timestamp: new Date().toISOString()
      });
    }

    // 下载文件内容
    const fileResponse = await axios.get(downloadUrl, {
      responseType: 'arraybuffer',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const fileBuffer = Buffer.from(fileResponse.data);
    const fileName = fileInfoResponse.data.name || 'file';

    // 根据文件扩展名选择解析方式
    let rows = [];
    const fileExt = fileName.toLowerCase().split('.').pop();

    if (fileExt === 'csv') {
      // CSV格式解析
      const csvText = fileBuffer.toString('utf-8');
      const workbook = XLSX.read(csvText, { type: 'string', FS: ',' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    } else {
      // Excel格式解析（.xlsx, .xls）
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    }

    res.json({
      success: true,
      data: {
        rows,
        fileName,
        fileId,
        totalRows: rows.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('导入WPS文件失败:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'IMPORT_FILE_ERROR',
        message: error.response?.data?.error_description || '导入文件失败'
      },
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 刷新access_token
 * POST /api/wps/refresh-token
 */
router.post('/refresh-token', async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REFRESH_TOKEN',
          message: 'refresh_token不能为空'
        },
        timestamp: new Date().toISOString()
      });
    }

    const tokenResponse = await axios.post('https://open.wps.cn/oauth/token', {
      client_id: WPS_APP_ID,
      client_secret: WPS_APP_SECRET,
      refresh_token,
      grant_type: 'refresh_token'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    res.json({
      success: true,
      data: {
        access_token: tokenResponse.data.access_token,
        refresh_token: tokenResponse.data.refresh_token,
        expires_in: tokenResponse.data.expires_in
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('刷新WPS token失败:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'REFRESH_TOKEN_ERROR',
        message: '刷新token失败'
      },
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
