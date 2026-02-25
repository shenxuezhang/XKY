const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { page = 1, pageSize = 50, search = '', profitStatus = 'all' } = req.query;
    const userId = req.user.id;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (search) {
      whereClause += ' AND (title LIKE ? OR pnk LIKE ? OR badge LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    if (profitStatus && profitStatus !== 'all') {
      whereClause += ' AND profit_status = ?';
      params.push(profitStatus);
    }
    
    const offset = (page - 1) * pageSize;
    
    const [products] = await db.query(
      `SELECT * FROM products ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    
    const [countResult] = await db.query(
      `SELECT COUNT(*) as total FROM products ${whereClause}`,
      params
    );
    
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / pageSize);
    
    res.json({
      success: true,
      data: {
        products,
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total,
          totalPages
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('获取产品列表失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_PRODUCTS_ERROR',
        message: '获取产品列表失败'
      },
      timestamp: new Date().toISOString()
    });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const product = req.body;
    const userId = req.user.id;
    
    if (!product.uid || !product.title) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: '缺少必填字段'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    await db.query(
      `INSERT INTO products (uid, title, pnk, link, img, price, prp, discount, rating, reviews, score, badge, category1, category2, category3, category4, category5, brand, detail_desc, spec_desc, profit_status, is_favorite, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        product.uid,
        product.title,
        product.pnk || null,
        product.link || null,
        product.img || null,
        product.price || 0,
        product.prp || 0,
        product.discount || null,
        product.rating || 0,
        product.reviews || 0,
        product.score || 0,
        product.badge || null,
        product.category1 || null,
        product.category2 || null,
        product.category3 || null,
        product.category4 || null,
        product.category5 || null,
        product.brand || null,
        product.detail_desc || null,
        product.spec_desc || null,
        product.profit_status || 'none',
        product.is_favorite || false,
        JSON.stringify(product.tags || [])
      ]
    );
    
    res.status(201).json({
      success: true,
      data: { uid: product.uid },
      message: '产品创建成功',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('创建产品失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CREATE_PRODUCT_ERROR',
        message: '创建产品失败'
      },
      timestamp: new Date().toISOString()
    });
  }
});

router.put('/:uid', authMiddleware, async (req, res) => {
  try {
    const { uid } = req.params;
    const updates = req.body;
    const userId = req.user.id;
    
    if (!uid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_UID',
          message: '缺少产品UID'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    const allowedFields = ['title', 'pnk', 'link', 'img', 'price', 'prp', 'discount', 'rating', 'reviews', 'score', 'badge', 'category1', 'category2', 'category3', 'category4', 'category5', 'brand', 'detail_desc', 'spec_desc', 'profit_status', 'is_favorite', 'tags'];
    const updateFields = [];
    const updateValues = [];
    
    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        updateValues.push(updates[field]);
      }
    });
    
    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_UPDATES',
          message: '没有要更新的字段'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    await db.query(
      `UPDATE products SET ${updateFields.join(', ')} WHERE uid = ?`,
      [...updateValues, uid]
    );
    
    res.json({
      success: true,
      message: '产品更新成功',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('更新产品失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_PRODUCT_ERROR',
        message: '更新产品失败'
      },
      timestamp: new Date().toISOString()
    });
  }
});

router.delete('/:uid', authMiddleware, async (req, res) => {
  try {
    const { uid } = req.params;
    const userId = req.user.id;
    
    if (!uid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_UID',
          message: '缺少产品UID'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    await db.query('DELETE FROM products WHERE uid = ?', [uid]);
    
    res.json({
      success: true,
      message: '产品删除成功',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('删除产品失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DELETE_PRODUCT_ERROR',
        message: '删除产品失败'
      },
      timestamp: new Date().toISOString()
    });
  }
});

router.post('/batch', authMiddleware, async (req, res) => {
  try {
    const { action, uids } = req.body;
    const userId = req.user.id;
    
    if (!action || !Array.isArray(uids) || uids.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: '缺少必填字段'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    switch (action) {
      case 'delete':
        await db.query('DELETE FROM products WHERE uid IN (?)', [uids]);
        res.json({
          success: true,
          message: `成功删除 ${uids.length} 个产品`,
          timestamp: new Date().toISOString()
        });
        break;
      case 'update':
        const { updates } = req.body;
        if (!updates) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'MISSING_UPDATES',
              message: '缺少更新数据'
            },
            timestamp: new Date().toISOString()
          });
        }
        
        const allowedFields = ['title', 'pnk', 'link', 'img', 'price', 'prp', 'discount', 'rating', 'reviews', 'score', 'badge', 'category1', 'category2', 'category3', 'category4', 'category5', 'brand', 'detail_desc', 'spec_desc', 'profit_status', 'is_favorite', 'tags'];
        const updateFields = [];
        const updateValues = [];
        
        allowedFields.forEach(field => {
          if (updates[field] !== undefined) {
            updateFields.push(`${field} = ?`);
            updateValues.push(updates[field]);
          }
        });
        
        if (updateFields.length > 0) {
          await db.query(
            `UPDATE products SET ${updateFields.join(', ')} WHERE uid IN (?)`,
            [...updateValues, uids]
          );
        }
        
        res.json({
          success: true,
          message: `成功更新 ${uids.length} 个产品`,
          timestamp: new Date().toISOString()
        });
        break;
      default:
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_ACTION',
            message: '无效的操作类型'
          },
          timestamp: new Date().toISOString()
        });
    }
  } catch (error) {
    console.error('批量操作失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'BATCH_OPERATION_ERROR',
        message: '批量操作失败'
      },
      timestamp: new Date().toISOString()
    });
  }
});

router.post('/:uid/favorite', authMiddleware, async (req, res) => {
  try {
    const { uid } = req.params;
    const userId = req.user.id;
    
    if (!uid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_UID',
          message: '缺少产品UID'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    await db.query('UPDATE products SET is_favorite = NOT is_favorite WHERE uid = ?', [uid]);
    
    res.json({
      success: true,
      message: '收藏状态切换成功',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('切换收藏状态失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'TOGGLE_FAVORITE_ERROR',
        message: '切换收藏状态失败'
      },
      timestamp: new Date().toISOString()
    });
  }
});

router.post('/:uid/tags', authMiddleware, async (req, res) => {
  try {
    const { uid } = req.params;
    const { tagIds } = req.body;
    const userId = req.user.id;
    
    if (!uid || !Array.isArray(tagIds)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: '缺少必填字段'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    await db.query('DELETE FROM product_tags WHERE product_uid = ?', [uid]);
    
    if (tagIds.length > 0) {
      const values = tagIds.map(tagId => `('${uid}', ${tagId}, NOW())`).join('), (');
      await db.query(`INSERT INTO product_tags (product_uid, tag_id, created_at) VALUES ${values}`);
    }
    
    res.json({
      success: true,
      message: '标签更新成功',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('更新产品标签失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_TAGS_ERROR',
        message: '更新产品标签失败'
      },
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
