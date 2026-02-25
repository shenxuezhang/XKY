-- eMAG市场海选系统数据库表结构
-- 创建时间：2026-01-16
-- 版本：1.0.0

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL COMMENT '用户名',
  password_hash VARCHAR(255) NOT NULL COMMENT '密码哈希',
  role ENUM('admin', 'user') DEFAULT 'user' COMMENT '角色：admin-管理员，user-普通用户',
  is_active BOOLEAN DEFAULT TRUE COMMENT '是否激活',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_username (username),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- 产品表
CREATE TABLE IF NOT EXISTS products (
  id INT PRIMARY KEY AUTO_INCREMENT,
  uid VARCHAR(50) UNIQUE NOT NULL COMMENT '唯一标识符',
  title TEXT COMMENT '产品标题',
  pnk VARCHAR(100) COMMENT 'PNK码',
  link TEXT COMMENT '产品链接',
  img TEXT COMMENT '产品图片',
  price DECIMAL(10,2) COMMENT '前端价格',
  prp DECIMAL(10,2) COMMENT 'PRP原价',
  discount VARCHAR(20) COMMENT '前端折扣',
  rating DECIMAL(3,2) COMMENT '星级',
  reviews INT COMMENT '评价数量',
  score DECIMAL(3,2) COMMENT '评论分数',
  badge VARCHAR(100) COMMENT '链接打标',
  category1 VARCHAR(100) COMMENT '一级类',
  category2 VARCHAR(100) COMMENT '二级类',
  category3 VARCHAR(100) COMMENT '三级类',
  category4 VARCHAR(100) COMMENT '四级类',
  category5 VARCHAR(100) COMMENT '五级类',
  brand VARCHAR(100) COMMENT '品牌',
  detail_desc TEXT COMMENT '详情描述',
  spec_desc TEXT COMMENT '规格详情',
  profit_status ENUM('none', 'pushed', 'deleted') DEFAULT 'none' COMMENT '利润测算状态：none-未推送，pushed-已推送，deleted-已删除',
  is_favorite BOOLEAN DEFAULT FALSE COMMENT '是否收藏',
  tags JSON COMMENT '标签（JSON数组）',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_uid (uid),
  INDEX idx_price (price),
  INDEX idx_rating (rating),
  INDEX idx_profit_status (profit_status),
  INDEX idx_is_favorite (is_favorite),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='产品表';

-- 利润测算表
CREATE TABLE IF NOT EXISTS profit_calculations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  product_uid VARCHAR(50) NOT NULL COMMENT '产品唯一标识符',
  length DECIMAL(10,2) COMMENT '长度（CM）',
  width DECIMAL(10,2) COMMENT '宽度（CM）',
  height DECIMAL(10,2) COMMENT '高度（CM）',
  weight DECIMAL(10,2) COMMENT '实重（kg）',
  tail_operation_fee DECIMAL(10,2) COMMENT '尾程操作费（RON）',
  storage_fee DECIMAL(10,2) COMMENT '仓储费（RON）',
  actual_price DECIMAL(10,2) COMMENT '实际售价（RON）',
  commission DECIMAL(10,2) COMMENT '佣金（RON）',
  volume_weight DECIMAL(10,2) COMMENT '体积重（kg）',
  charge_weight DECIMAL(10,2) COMMENT '计费重（kg）',
  freight DECIMAL(10,2) COMMENT '头程运费（元）',
  tail_fee DECIMAL(10,2) COMMENT '尾程费（RON）=尾程操作费+仓储费',
  budget_price DECIMAL(10,2) COMMENT '采购价预算（元）',
  estimated_profit DECIMAL(10,2) COMMENT '预估毛利（元）',
  target_margin DECIMAL(5,4) COMMENT '目标毛利率',
  exchange_rate DECIMAL(10,4) COMMENT '汇率',
  freight_unit_price DECIMAL(10,2) COMMENT '头程单价（元/kg）',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  FOREIGN KEY (product_uid) REFERENCES products(uid) ON DELETE CASCADE COMMENT '关联产品表',
  INDEX idx_product_uid (product_uid),
  INDEX idx_estimated_profit (estimated_profit),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='利润测算表';

-- 采购订单表
CREATE TABLE IF NOT EXISTS purchase_orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_no VARCHAR(50) UNIQUE NOT NULL COMMENT '订单号',
  product_uid VARCHAR(50) NOT NULL COMMENT '产品唯一标识符',
  supplier_id INT COMMENT '供应商ID',
  quantity INT DEFAULT 1 COMMENT '数量',
  unit_price DECIMAL(10,2) COMMENT '单价',
  total_price DECIMAL(10,2) COMMENT '总价',
  status ENUM('pending', 'ordered', 'received', 'cancelled') DEFAULT 'pending' COMMENT '状态：pending-待下单，ordered-已下单，received-已收货，cancelled-已取消',
  order_date DATE COMMENT '下单日期',
  delivery_date DATE COMMENT '预计交货日期',
  notes TEXT COMMENT '备注',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  FOREIGN KEY (product_uid) REFERENCES products(uid) ON DELETE CASCADE COMMENT '关联产品表',
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL COMMENT '关联供应商表',
  INDEX idx_order_no (order_no),
  INDEX idx_status (status),
  INDEX idx_product_uid (product_uid),
  INDEX idx_supplier_id (supplier_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='采购订单表';

-- 供应商表
CREATE TABLE IF NOT EXISTS suppliers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(200) NOT NULL COMMENT '供应商名称',
  contact VARCHAR(100) COMMENT '联系人',
  phone VARCHAR(50) COMMENT '电话',
  email VARCHAR(100) COMMENT '邮箱',
  address TEXT COMMENT '地址',
  notes TEXT COMMENT '备注',
  is_active BOOLEAN DEFAULT TRUE COMMENT '是否激活',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_name (name),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='供应商表';

-- 数据导入历史表
CREATE TABLE IF NOT EXISTS import_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  file_name VARCHAR(255) COMMENT '文件名',
  record_count INT COMMENT '记录数量',
  import_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '导入时间',
  user_id INT COMMENT '用户ID',
  INDEX idx_import_time (import_time),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='数据导入历史表';

-- 操作日志表
CREATE TABLE IF NOT EXISTS operation_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT COMMENT '用户ID',
  action VARCHAR(50) NOT NULL COMMENT '操作类型',
  module VARCHAR(50) COMMENT '模块名称',
  details JSON COMMENT '操作详情（JSON格式）',
  ip_address VARCHAR(50) COMMENT 'IP地址',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX idx_user_id (user_id),
  INDEX idx_action (action),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='操作日志表';

-- 筛选预设表
CREATE TABLE IF NOT EXISTS filter_presets (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL COMMENT '预设名称',
  user_id INT COMMENT '用户ID',
  filters JSON NOT NULL COMMENT '筛选条件（JSON格式）',
  is_default BOOLEAN DEFAULT FALSE COMMENT '是否默认预设',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_user_id (user_id),
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='筛选预设表';

-- 标签表
CREATE TABLE IF NOT EXISTS tags (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL COMMENT '标签名称',
  color VARCHAR(20) COMMENT '标签颜色',
  user_id INT COMMENT '用户ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX idx_user_id (user_id),
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='标签表';

-- 产品标签关联表
CREATE TABLE IF NOT EXISTS product_tags (
  id INT PRIMARY KEY AUTO_INCREMENT,
  product_uid VARCHAR(50) NOT NULL COMMENT '产品唯一标识符',
  tag_id INT NOT NULL COMMENT '标签ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  FOREIGN KEY (product_uid) REFERENCES products(uid) ON DELETE CASCADE COMMENT '关联产品表',
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE COMMENT '关联标签表',
  UNIQUE KEY uk_product_tag (product_uid, tag_id) COMMENT '产品-标签唯一约束',
  INDEX idx_product_uid (product_uid),
  INDEX idx_tag_id (tag_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='产品标签关联表';

-- 成本记录表
CREATE TABLE IF NOT EXISTS cost_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  product_uid VARCHAR(50) NOT NULL COMMENT '产品唯一标识符',
  actual_cost DECIMAL(10,2) COMMENT '实际成本',
  budget_cost DECIMAL(10,2) COMMENT '预算成本',
  difference DECIMAL(10,2) COMMENT '差异（实际成本-预算成本）',
  record_date DATE COMMENT '记录日期',
  notes TEXT COMMENT '备注',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  FOREIGN KEY (product_uid) REFERENCES products(uid) ON DELETE CASCADE COMMENT '关联产品表',
  INDEX idx_product_uid (product_uid),
  INDEX idx_record_date (record_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='成本记录表';

-- AI推荐记录表
CREATE TABLE IF NOT EXISTS ai_recommendations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  product_uid VARCHAR(50) NOT NULL COMMENT '产品唯一标识符',
  recommendation_type ENUM('profit', 'trend', 'personalized') COMMENT '推荐类型：profit-高利润，trend-趋势，personalized-个性化',
  score DECIMAL(5,2) COMMENT '推荐评分',
  reason TEXT COMMENT '推荐理由',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  FOREIGN KEY (product_uid) REFERENCES products(uid) ON DELETE CASCADE COMMENT '关联产品表',
  INDEX idx_product_uid (product_uid),
  INDEX idx_recommendation_type (recommendation_type),
  INDEX idx_score (score),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI推荐记录表';

-- 异常检测记录表
CREATE TABLE IF NOT EXISTS anomaly_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  product_uid VARCHAR(50) NOT NULL COMMENT '产品唯一标识符',
  anomaly_type ENUM('price', 'rating', 'inventory', 'data_quality') COMMENT '异常类型：price-价格，rating-评价，inventory-库存，data_quality-数据质量',
  severity ENUM('low', 'medium', 'high', 'critical') COMMENT '严重程度',
  description TEXT COMMENT '异常描述',
  detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '检测时间',
  FOREIGN KEY (product_uid) REFERENCES products(uid) ON DELETE CASCADE COMMENT '关联产品表',
  INDEX idx_product_uid (product_uid),
  INDEX idx_anomaly_type (anomaly_type),
  INDEX idx_severity (severity),
  INDEX idx_detected_at (detected_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='异常检测记录表';

SET FOREIGN_KEY_CHECKS = 1;
