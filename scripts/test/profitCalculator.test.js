/**
 * 利润测算模块测试脚本
 * 用于验证计算逻辑的正确性
 */

import { 
	calculateVolumeWeight, 
	calculateChargeWeight, 
	calculateFreight,
	calculateActualPrice,
	calculateCommission,
	calculateBudgetPrice,
	calculateEstimatedProfit,
	calculateBatch
} from '../core/ProfitEngine.js';

/**
 * 测试工具函数
 */
function assert(condition, message) {
	if (!condition) {
		throw new Error(`测试失败: ${message}`);
	}
	console.log(`✓ ${message}`);
}

function testVolumeWeight() {
	console.log('\n=== 测试体积重计算 ===');
	
	// 测试用例1：正常尺寸
	const result1 = calculateVolumeWeight(20, 10, 5);
	const expected1 = (20 * 10 * 5) / 6000; // 0.17
	assert(Math.abs(result1 - expected1) < 0.01, `体积重计算: 20×10×5 = ${result1}kg (期望: ${expected1.toFixed(2)}kg)`);
	
	// 测试用例2：大尺寸
	const result2 = calculateVolumeWeight(30, 20, 15);
	const expected2 = (30 * 20 * 15) / 6000; // 1.5
	assert(Math.abs(result2 - expected2) < 0.01, `体积重计算: 30×20×15 = ${result2}kg (期望: ${expected2.toFixed(2)}kg)`);
	
	// 测试用例3：零值
	const result3 = calculateVolumeWeight(0, 10, 5);
	assert(result3 === 0, `体积重计算: 零值处理 = ${result3}kg (期望: 0kg)`);
	
	console.log('体积重计算测试通过 ✓\n');
}

function testChargeWeight() {
	console.log('=== 测试计费重计算 ===');
	
	// 测试用例1：实重大于体积重
	const result1 = calculateChargeWeight(0.5, 0.17);
	assert(result1 === 0.5, `计费重计算: MAX(0.5, 0.17) = ${result1}kg (期望: 0.5kg)`);
	
	// 测试用例2：体积重大于实重
	const result2 = calculateChargeWeight(0.3, 0.5);
	assert(result2 === 0.5, `计费重计算: MAX(0.3, 0.5) = ${result2}kg (期望: 0.5kg)`);
	
	// 测试用例3：相等
	const result3 = calculateChargeWeight(0.5, 0.5);
	assert(result3 === 0.5, `计费重计算: MAX(0.5, 0.5) = ${result3}kg (期望: 0.5kg)`);
	
	console.log('计费重计算测试通过 ✓\n');
}

function testFreight() {
	console.log('=== 测试头程运费计算 ===');
	
	// 测试用例1：正常计算
	const result1 = calculateFreight(0.5, 17);
	const expected1 = 0.5 * 17; // 8.5
	assert(Math.abs(result1 - expected1) < 0.01, `头程运费计算: 0.5kg × 17元/kg = ${result1}元 (期望: ${expected1.toFixed(2)}元)`);
	
	// 测试用例2：零值
	const result2 = calculateFreight(0, 17);
	assert(result2 === 0, `头程运费计算: 零值处理 = ${result2}元 (期望: 0元)`);
	
	console.log('头程运费计算测试通过 ✓\n');
}

function testActualPrice() {
	console.log('=== 测试实际售价计算 ===');
	
	// 测试用例1：正常价格
	const result1 = calculateActualPrice(54.93);
	const expected1 = 54.93 / 1.21; // 45.40
	assert(Math.abs(result1 - expected1) < 0.01, `实际售价计算: 54.93 / 1.21 = ${result1} (期望: ${expected1.toFixed(2)})`);
	
	// 测试用例2：零值
	const result2 = calculateActualPrice(0);
	assert(result2 === 0, `实际售价计算: 零值处理 = ${result2} (期望: 0)`);
	
	console.log('实际售价计算测试通过 ✓\n');
}

function testCommission() {
	console.log('=== 测试佣金计算 ===');
	
	// 测试用例1：正常计算
	const actualPrice = 45.40;
	const result1 = calculateCommission(actualPrice);
	const expected1 = actualPrice * 0.23; // 10.44
	assert(Math.abs(result1 - expected1) < 0.01, `佣金计算: 45.40 × 23% = ${result1} (期望: ${expected1.toFixed(2)})`);
	
	// 测试用例2：零值
	const result2 = calculateCommission(0);
	assert(result2 === 0, `佣金计算: 零值处理 = ${result2} (期望: 0)`);
	
	console.log('佣金计算测试通过 ✓\n');
}

function testBudgetPrice() {
	console.log('=== 测试采购价预算计算 ===');
	
	// 注意：tailOperationFee 和 storageFee 现在是产品级参数，从 product 对象获取
	const product = {
		price: 54.93,
		length: 20,
		width: 10,
		height: 5,
		weight: 0.5,
		tailOperationFee: 10,  // 产品级参数
		storageFee: 5          // 产品级参数
	};
	
	const config = {
		targetMargin: 0.4,
		exchangeRate: 1.5,
		freightUnitPrice: 17
		// 注意：tailOperationFee 和 storageFee 已从 config 中移除，改为产品级参数
	};
	
	const result = calculateBudgetPrice(product, config);
	
	// 验证各个计算结果
	const expectedActualPrice = 54.93 / 1.21; // 45.40
	const expectedCommission = expectedActualPrice * 0.23; // 10.44
	const expectedVolumeWeight = (20 * 10 * 5) / 6000; // 0.17
	const expectedChargeWeight = Math.max(0.5, expectedVolumeWeight); // 0.5
	const expectedFreight = expectedChargeWeight * 17; // 8.5
	
	assert(Math.abs(result.actualPrice - expectedActualPrice) < 0.01, `实际售价: ${result.actualPrice} (期望: ${expectedActualPrice.toFixed(2)})`);
	assert(Math.abs(result.commission - expectedCommission) < 0.01, `佣金: ${result.commission} (期望: ${expectedCommission.toFixed(2)})`);
	assert(Math.abs(result.volumeWeight - expectedVolumeWeight) < 0.01, `体积重: ${result.volumeWeight} (期望: ${expectedVolumeWeight.toFixed(2)})`);
	assert(Math.abs(result.chargeWeight - expectedChargeWeight) < 0.01, `计费重: ${result.chargeWeight} (期望: ${expectedChargeWeight.toFixed(2)})`);
	assert(Math.abs(result.freight - expectedFreight) < 0.01, `头程运费: ${result.freight} (期望: ${expectedFreight.toFixed(2)})`);
	// 验证尾程费字段（尾程操作费 + 仓储费）
	const expectedTailFee = 10 + 5; // 15
	assert(Math.abs(result.tailFee - expectedTailFee) < 0.01, `尾程费: ${result.tailFee} (期望: ${expectedTailFee.toFixed(2)})`);
	assert(result.budgetPrice !== undefined, `采购价预算: ${result.budgetPrice} (已计算)`);
	
	console.log('采购价预算计算测试通过 ✓\n');
}

function testEstimatedProfit() {
	console.log('=== 测试预估毛利计算 ===');
	
	const actualPrice = 45.40;
	const commission = 10.44;
	const tailOperationFee = 10;
	const storageFee = 5;
	const exchangeRate = 1.5;
	const freight = 8.5;
	const budgetPrice = 2.70;
	
	const result = calculateEstimatedProfit(
		actualPrice,
		commission,
		tailOperationFee,
		storageFee,
		exchangeRate,
		freight,
		budgetPrice
	);
	
	// 公式：预估毛利 = (实际售价 - 佣金 - 尾程 - 仓储费) × 汇率 - 头程运费 - 采购价预算上限
	const expected = ((45.40 - 10.44 - 10 - 5) * 1.5) - 8.5 - 2.70; // 19.90
	assert(Math.abs(result - expected) < 0.01, `预估毛利: ${result} (期望: ${expected.toFixed(2)})`);
	
	console.log('预估毛利计算测试通过 ✓\n');
}

function testBatch() {
	console.log('=== 测试批量计算 ===');
	
	// 注意：tailOperationFee 和 storageFee 现在是产品级参数，从 product 对象获取
	const products = [
		{ price: 54.93, length: 20, width: 10, height: 5, weight: 0.5, tailOperationFee: 10, storageFee: 5, _uid: 1 },
		{ price: 64.49, length: 20, width: 5, height: 5, weight: 0.5, tailOperationFee: 10, storageFee: 5, _uid: 2 },
		{ price: 99.83, length: 20, width: 10, height: 5, weight: 0.5, tailOperationFee: 10, storageFee: 5, _uid: 3 }
	];
	
	const config = {
		targetMargin: 0.4,
		exchangeRate: 1.5,
		freightUnitPrice: 17
		// 注意：tailOperationFee 和 storageFee 已从 config 中移除，改为产品级参数
	};
	
	const results = calculateBatch(products, config);
	
	assert(results.length === 3, `批量计算: 返回 ${results.length} 个结果 (期望: 3)`);
	assert(results[0].actualPrice > 0, `批量计算: 第一个产品有实际售价`);
	assert(results[0].budgetPrice !== undefined, `批量计算: 第一个产品有采购价预算`);
	assert(results[0].estimatedProfit !== undefined, `批量计算: 第一个产品有预估毛利`);
	
	console.log('批量计算测试通过 ✓\n');
}

function testPerformance() {
	console.log('=== 性能测试 ===');
	
	const products = [];
	for (let i = 0; i < 100; i++) {
		products.push({
			price: 50 + Math.random() * 50,
			length: 10 + Math.random() * 20,
			width: 5 + Math.random() * 15,
			height: 3 + Math.random() * 10,
			weight: 0.1 + Math.random() * 2,
			_uid: i
		});
	}
	
	const config = {
		targetMargin: 0.4,
		exchangeRate: 1.5,
		freightUnitPrice: 17,
		tailOperationFee: 10,
		storageFee: 5
	};
	
	const startTime = performance.now();
	const results = calculateBatch(products, config);
	const endTime = performance.now();
	const duration = endTime - startTime;
	
	assert(results.length === 100, `性能测试: 100个产品计算完成`);
	assert(duration < 100, `性能测试: 100个产品计算耗时 ${duration.toFixed(2)}ms (期望: < 100ms)`);
	
	console.log(`性能测试通过 ✓ (耗时: ${duration.toFixed(2)}ms)\n`);
}

/**
 * 运行所有测试
 */
export function runAllTests() {
	console.log('========================================');
	console.log('利润测算模块测试开始');
	console.log('========================================\n');
	
	try {
		testVolumeWeight();
		testChargeWeight();
		testFreight();
		testActualPrice();
		testCommission();
		testBudgetPrice();
		testEstimatedProfit();
		testBatch();
		testPerformance();
		
		console.log('========================================');
		console.log('✓ 所有测试通过！');
		console.log('========================================');
	} catch (error) {
		console.error('\n========================================');
		console.error('✗ 测试失败:', error.message);
		console.error('========================================');
		throw error;
	}
}

if (typeof window !== 'undefined') {
	window.runProfitTests = runAllTests;
}

