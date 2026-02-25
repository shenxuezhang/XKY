/**
 * 利润测算模块性能测试工具
 * 用于测试大数据量下的性能表现
 */

import { calculateBatch } from '../core/ProfitEngine.js';

/**
 * 生成测试产品数据
 * @param {number} count - 产品数量
 * @returns {Array} 产品数组
 */
export function generateTestProducts(count) {
	const products = [];
	for (let i = 0; i < count; i++) {
		products.push({
			_uid: Date.now() + i,
			title: `测试产品 ${i + 1}`,
			price: 50 + Math.random() * 50,
			length: 10 + Math.random() * 20,
			width: 5 + Math.random() * 15,
			height: 3 + Math.random() * 10,
			weight: 0.1 + Math.random() * 2,
			tailOperationFee: 0,  // 产品级参数，默认值为0
			storageFee: 0,        // 产品级参数，默认值为0
			img: ''
		});
	}
	return products;
}

/**
 * 性能测试
 * @param {number} productCount - 产品数量
 * @returns {Object} 测试结果
 */
export function performanceTest(productCount) {
	const products = generateTestProducts(productCount);
	const config = {
		targetMargin: 0.4,
		exchangeRate: 1.5,
		freightUnitPrice: 17
		// 注意：tailOperationFee 和 storageFee 已从 config 中移除，改为产品级参数
	};

	const startTime = performance.now();
	const results = calculateBatch(products, config);
	const endTime = performance.now();

	return {
		productCount,
		duration: endTime - startTime,
		resultsCount: results.length,
		averageTime: (endTime - startTime) / productCount
	};
}

/**
 * 批量性能测试
 * @param {Array<number>} counts - 要测试的产品数量数组
 * @returns {Array} 测试结果数组
 */
export function batchPerformanceTest(counts = [10, 50, 100, 500, 1000]) {
	console.log('========================================');
	console.log('利润测算模块性能测试');
	console.log('========================================\n');

	const results = [];
	counts.forEach(count => {
		const result = performanceTest(count);
		results.push(result);
		console.log(`${count}个产品: ${result.duration.toFixed(2)}ms (平均: ${result.averageTime.toFixed(3)}ms/产品)`);
	});

	console.log('\n========================================');
	console.log('性能测试完成');
	console.log('========================================\n');

	return results;
}

if (typeof window !== 'undefined') {
	window.profitPerformanceTest = batchPerformanceTest;
}

