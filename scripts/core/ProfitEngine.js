/**
 * 利润计算引擎
 * 纯函数，无副作用，负责所有利润相关计算
 */
import { FIXED_CONSTANTS } from '../config/profitConfig.js';

/**
 * 格式化金额（保留2位小数）
 * @param {number} value - 金额值
 * @returns {number} 格式化后的金额
 */
function formatMoney(value) {
	if (typeof value !== 'number' || isNaN(value)) return 0;
	return Math.round(value * 100) / 100;
}

/**
 * 计算体积重
 * @param {number} length - 长（CM）
 * @param {number} width - 宽（CM）
 * @param {number} height - 高（CM）
 * @returns {number} 体积重（kg）
 */
export function calculateVolumeWeight(length, width, height) {
	if (!length || !width || !height) return 0;
	const volume = length * width * height;
	return formatMoney(volume / FIXED_CONSTANTS.VOLUME_DIVISOR);
}

/**
 * 计算计费重（取实重和体积重的最大值）
 * @param {number} weight - 实重（kg）
 * @param {number} volumeWeight - 体积重（kg）
 * @returns {number} 计费重（kg）
 */
export function calculateChargeWeight(weight, volumeWeight) {
	const w = weight || 0;
	const vw = volumeWeight || 0;
	return formatMoney(Math.max(w, vw));
}

/**
 * 计算头程运费
 * @param {number} chargeWeight - 计费重（kg）
 * @param {number} unitPrice - 头程单价（元/kg）
 * @returns {number} 头程运费（元）
 */
export function calculateFreight(chargeWeight, unitPrice) {
	if (!chargeWeight || !unitPrice) return 0;
	return formatMoney(chargeWeight * unitPrice);
}

/**
 * 计算实际售价
 * @param {number} frontPrice - 前端价格
 * @returns {number} 实际售价
 */
export function calculateActualPrice(frontPrice) {
	if (!frontPrice) return 0;
	return formatMoney(frontPrice / FIXED_CONSTANTS.PRICE_MULTIPLIER);
}

/**
 * 计算佣金
 * @param {number} actualPrice - 实际售价
 * @returns {number} 佣金
 */
export function calculateCommission(actualPrice) {
	if (!actualPrice) return 0;
	return formatMoney(actualPrice * FIXED_CONSTANTS.COMMISSION_RATE);
}

/**
 * 计算预估毛利
 * @param {number} actualPrice - 实际售价
 * @param {number} commission - 佣金金额（实际售价 × 23%）
 * @param {number} tailOperationFee - 尾程操作费
 * @param {number} storageFee - 仓储费
 * @param {number} exchangeRate - 汇率
 * @param {number} freight - 头程运费
 * @param {number} budgetPrice - 采购价预算上限
 * @returns {number} 预估毛利
 */
export function calculateEstimatedProfit(actualPrice, commission, tailOperationFee, storageFee, exchangeRate, freight, budgetPrice) {
	if (!actualPrice) return 0;
	// 公式：预估毛利 = (实际售价 - 佣金金额 - 尾程 - 仓储费) × 汇率 - 头程运费 - 采购价预算上限
	const baseAmount = actualPrice - commission - tailOperationFee - storageFee;
	const afterExchange = baseAmount * exchangeRate;
	const estimatedProfit = formatMoney(afterExchange - freight - budgetPrice);
	return estimatedProfit;
}

/**
 * 计算采购价预算上限
 * @param {Object} product - 产品数据对象（包含 tailOperationFee 和 storageFee 产品级参数）
 * @param {Object} config - 配置对象（包含 targetMargin、exchangeRate、freightUnitPrice）
 * @returns {Object} 计算结果对象（包含 tailFee 字段：尾程操作费 + 仓储费）
 */
export function calculateBudgetPrice(product, config) {
	const {
		price: frontPrice = 0,
		length = 0,
		width = 0,
		height = 0,
		weight = 0,
		tailOperationFee = 0,
		storageFee = 0
	} = product;

	const {
		targetMargin = 0.4,
		exchangeRate = 1.5,
		freightUnitPrice = 17
	} = config;

	// 计算实际售价
	const actualPrice = calculateActualPrice(frontPrice);

	// 计算佣金
	const commission = calculateCommission(actualPrice);

	// 计算体积重
	const volumeWeight = calculateVolumeWeight(length, width, height);

	// 计算计费重
	const chargeWeight = calculateChargeWeight(weight, volumeWeight);

	// 计算头程运费
	const freight = calculateFreight(chargeWeight, freightUnitPrice);

	// 计算采购价预算上限
	// 公式：[实际售价 × (1 - 佣金率 - 目标毛利率) - 尾程操作费 - 仓储费] × 汇率 - 头程运费
	// 注：佣金率 = 23%（固定值）
	const profitPart = actualPrice * (1 - FIXED_CONSTANTS.COMMISSION_RATE - targetMargin);
	const afterFees = profitPart - tailOperationFee - storageFee;
	const budgetPrice = formatMoney(afterFees * exchangeRate - freight);

	// 计算预估毛利
	// 公式：预估毛利 = (实际售价 - 佣金金额 - 尾程 - 仓储费) × 汇率 - 头程运费 - 采购价预算上限
	// 注：佣金金额 = 实际售价 × 23%
	const estimatedProfit = calculateEstimatedProfit(
		actualPrice,
		commission,
		tailOperationFee,
		storageFee,
		exchangeRate,
		freight,
		budgetPrice
	);

	return {
		actualPrice,
		commission,
		volumeWeight,
		chargeWeight,
		freight,
		tailFee: formatMoney(tailOperationFee + storageFee),
		budgetPrice,
		estimatedProfit
	};
}

/**
 * 批量计算所有产品的采购价预算
 * @param {Array} products - 产品数组
 * @param {Object} config - 配置对象
 * @returns {Array} 计算结果数组
 */
export function calculateBatch(products, config) {
	if (!Array.isArray(products) || products.length === 0) return [];

	return products.map(product => {
		const result = calculateBudgetPrice(product, config);
		return {
			...product,
			...result
		};
	});
}

