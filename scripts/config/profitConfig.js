/**
 * 利润测算配置管理
 * 统一管理默认值和配置规则
 */

/**
 * 默认配置
 */
export const DEFAULT_PROFIT_CONFIG = {
	targetMargin: 0.4,        // 目标毛利率（40%）
	exchangeRate: 1.5,         // 汇率
	freightUnitPrice: 17      // 头程单价（元/kg）
};

/**
 * 固定参数
 */
export const FIXED_CONSTANTS = {
	PRICE_MULTIPLIER: 1.21,   // 实际售价 = 前端价格 / 1.21
	COMMISSION_RATE: 0.23,    // 佣金率 = 23%
	VOLUME_DIVISOR: 6000      // 体积重计算基数 = 6000
};

/**
 * localStorage存储键名
 */
export const PROFIT_CONFIG_KEY = 'emag_profit_config_v1';

/**
 * 加载保存的配置
 * @returns {Object} 配置对象
 */
export function loadProfitConfig() {
	try {
		const saved = localStorage.getItem(PROFIT_CONFIG_KEY);
		if (saved) {
			const parsed = JSON.parse(saved);
			return { ...DEFAULT_PROFIT_CONFIG, ...parsed };
		}
	} catch (e) {
		console.error('加载利润配置失败:', e);
	}
	return { ...DEFAULT_PROFIT_CONFIG };
}

/**
 * 保存配置到localStorage
 * @param {Object} config - 配置对象
 */
export function saveProfitConfig(config) {
	try {
		localStorage.setItem(PROFIT_CONFIG_KEY, JSON.stringify(config));
	} catch (e) {
		console.error('保存利润配置失败:', e);
	}
}

