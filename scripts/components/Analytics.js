/**
 * 数据可视化组件
 * 功能：价格分布柱状图、聚合数据展示、图表交互筛选
 */
import { parsePrice, parseNumber, parseValue } from '../utils/parsers.js';

export class Analytics {
	/**
	 * @param {{container:HTMLElement, store:Object, onFilter:(filterFn:Function)=>void}} config
	 */
	constructor(config) {
		this.container = config.container;
		this.store = config.store;
		this.onFilter = config.onFilter;
		this.priceChart = null;
		this.ratingChart = null;
		this.priceBins = [];
		this.ratingBins = [];
		this.currentFilter = null;
		// 价格区间层级管理
		this.priceRangeLevel = 0; // 0: 固定区间, 1+: 细分层级
		this.currentPriceRange = null; // 当前选中的价格区间 {start, end}
		
		// 联动状态管理
		this.linkageState = {
			priceFilter: null,      // 价格筛选条件 {start, end}
			ratingFilter: null,     // 星级筛选条件 {rating}
			isUpdating: false        // 是否正在更新（防止重复更新）
		};
		
		// 实时联动优化：防抖和缓存
		this.updateDebounceTimer = null;
		this.updateDebounceDelay = 300; // 防抖延迟300ms
		this.updateCache = new Map();    // 更新缓存（key: dataHash, value: {priceData, ratingData}）
		this.updateProgressCallback = null; // 进度回调函数
		this.isUpdatingProgress = false;    // 是否显示进度提示
	}
	
	/**
	 * 初始化组件
	 */
	init() {
		if (!this.container) {
			console.error('Analytics: 缺少容器元素');
			return;
		}
		
		this.initCharts();
		this.updateData();
	}
	
	/**
	 * 初始化图表
	 */
	initCharts() {
		const priceCanvas = this.container.querySelector('#priceChart');
		const ratingCanvas = this.container.querySelector('#ratingChart');
		
		if (!priceCanvas || !ratingCanvas) {
			console.error('Analytics: 找不到图表容器');
			return;
		}
		
		// 价格分布柱状图
		const priceCtx = priceCanvas.getContext('2d');
		if (typeof Chart === 'undefined') {
			console.error('Analytics: Chart.js 未加载');
			return;
		}
		this.priceChart = new Chart(priceCtx, {
			type: 'bar',
			data: {
				labels: [],
				datasets: [{
					label: '产品数量',
					data: [],
					backgroundColor: 'rgba(0, 113, 227, 0.6)',
					borderColor: 'rgba(0, 113, 227, 1)',
					borderWidth: 1
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						display: false
					},
					tooltip: {
						callbacks: {
							title: (items) => `价格区间: ${items[0].label}`,
							label: (item) => `产品数量: ${item.parsed.y}`
						}
					}
				},
				scales: {
					y: {
						beginAtZero: true,
						ticks: {
							stepSize: 1
						}
					}
				},
				onClick: (event, elements) => {
					if (elements.length > 0) {
						const index = elements[0].index;
						this.filterByPriceRange(index);
					}
				}
			}
		});
		
		// 星级分布柱状图
		const ratingCtx = ratingCanvas.getContext('2d');
		this.ratingChart = new Chart(ratingCtx, {
			type: 'bar',
			data: {
				labels: [],
				datasets: [{
					label: '产品数量',
					data: [],
					backgroundColor: 'rgba(255, 193, 7, 0.6)',
					borderColor: 'rgba(255, 193, 7, 1)',
					borderWidth: 1
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						display: false
					},
					tooltip: {
						callbacks: {
							title: (items) => `星级: ${items[0].label}`,
							label: (item) => `产品数量: ${item.parsed.y}`
						}
					}
				},
				scales: {
					y: {
						beginAtZero: true,
						ticks: {
							stepSize: 1
						}
					}
				},
				onClick: (event, elements) => {
					if (elements.length > 0) {
						const index = elements[0].index;
						this.filterByRating(index);
					}
				}
			}
		});
	}
	
	/**
	 * 更新数据（带防抖和缓存优化）
	 */
	updateData() {
		// 清除之前的防抖定时器
		if (this.updateDebounceTimer) {
			clearTimeout(this.updateDebounceTimer);
		}
		
		// 防抖处理
		this.updateDebounceTimer = setTimeout(() => {
			this._updateDataInternal();
		}, this.updateDebounceDelay);
	}
	
	/**
	 * 内部更新数据方法（实际执行更新）
	 */
	_updateDataInternal() {
		const data = this.store?.filteredData || [];
		
		if (data.length === 0) {
			this.clearData();
			this.resetPriceRange();
			this.linkageState.priceFilter = null;
			this.linkageState.ratingFilter = null;
			this.updateCache.clear();
			return;
		}
		
		// 检查缓存
		const dataHash = this._getDataHash(data);
		const cached = this.updateCache.get(dataHash);
		
		if (cached && !this.linkageState.isUpdating) {
			// 使用缓存数据
			this.updateAggregateData(data);
			this._updatePriceChartWithData(data, cached.priceData);
			this._updateRatingChartWithData(data, cached.ratingData);
			return;
		}
		
		// 显示进度提示（大数据量时）
		const showProgress = data.length > 1000;
		if (showProgress && this.updateProgressCallback) {
			this.isUpdatingProgress = true;
			this.updateProgressCallback(true);
		}
		
		// 使用 requestAnimationFrame 优化更新性能
		requestAnimationFrame(() => {
			try {
				this.linkageState.isUpdating = true;
				
				// 更新聚合数据
				this.updateAggregateData(data);
				
				// 更新价格分布图表（考虑星级筛选）
				const priceData = this._calculatePriceData(data);
				this._updatePriceChartWithData(data, priceData);
				
				// 更新星级分布图表（考虑价格筛选）
				const ratingData = this._calculateRatingData(data);
				this._updateRatingChartWithData(data, ratingData);
				
				// 缓存计算结果
				this.updateCache.set(dataHash, {
					priceData,
					ratingData,
					timestamp: Date.now()
				});
				
				// 清理旧缓存（保留最近10个）
				if (this.updateCache.size > 10) {
					const oldestKey = this.updateCache.keys().next().value;
					this.updateCache.delete(oldestKey);
				}
			} finally {
				this.linkageState.isUpdating = false;
				
				// 隐藏进度提示
				if (showProgress && this.updateProgressCallback) {
					this.isUpdatingProgress = false;
					this.updateProgressCallback(false);
				}
			}
		});
	}
	
	/**
	 * 获取数据哈希（用于缓存）
	 */
	_getDataHash(data) {
		// 使用数据长度和前100条数据的哈希作为key
		const sampleSize = Math.min(100, data.length);
		const sample = data.slice(0, sampleSize);
		const sampleHash = sample.map(row => row._uid || '').join(',');
		return `${data.length}_${sampleHash.substring(0, 200)}`;
	}
	
	/**
	 * 计算价格分布数据（考虑联动筛选）
	 */
	_calculatePriceData(data) {
		const prices = data.map(row => parsePrice(parseValue(row, 'price'))).filter(v => !isNaN(v) && v >= 0);
		
		if (prices.length === 0) {
			return { labels: [], bins: [], ranges: [] };
		}
		
		let priceRanges = [];
		
		if (this.priceRangeLevel === 0) {
			priceRanges = [
				{ start: 1, end: 50, label: '1-50' },
				{ start: 51, end: 100, label: '51-100' },
				{ start: 101, end: 200, label: '101-200' },
				{ start: 201, end: 300, label: '201-300' },
				{ start: 301, end: 500, label: '301-500' },
				{ start: 501, end: 1000, label: '501-1000' }
			];
		} else if (this.currentPriceRange) {
			const { start, end } = this.currentPriceRange;
			const rangeSize = end === Infinity ? Infinity : end - start;
			const binCount = 10;
			
			if (rangeSize === Infinity) {
				const maxPrice = Math.max(...prices.filter(p => p >= start));
				const binSize = (maxPrice - start) / binCount;
				
				for (let i = 0; i < binCount; i++) {
					const binStart = start + i * binSize;
					const binEnd = i === binCount - 1 ? maxPrice : start + (i + 1) * binSize;
					priceRanges.push({
						start: Math.floor(binStart),
						end: Math.ceil(binEnd),
						label: `${Math.floor(binStart)}-${Math.ceil(binEnd)}`
					});
				}
			} else {
				const binSize = rangeSize / binCount;
				
				for (let i = 0; i < binCount; i++) {
					const binStart = start + i * binSize;
					const binEnd = i === binCount - 1 ? end : start + (i + 1) * binSize;
					priceRanges.push({
						start: Math.floor(binStart),
						end: i === binCount - 1 && end !== Infinity ? end : Math.ceil(binEnd),
						label: `${Math.floor(binStart)}-${i === binCount - 1 && end !== Infinity ? end : Math.ceil(binEnd)}`
					});
				}
			}
		}
		
		const filteredPrices = prices.filter(price => {
			if (this.priceRangeLevel === 0) {
				return true;
			} else if (this.currentPriceRange) {
				const { start, end } = this.currentPriceRange;
				if (end === Infinity) {
					return price >= start;
				} else {
					return price >= start && price <= end;
				}
			}
			return true;
		});
		
		const bins = new Array(priceRanges.length).fill(0);
		const labels = [];
		const ranges = [];
		
		priceRanges.forEach((range, index) => {
			labels.push(range.label);
			ranges.push({ start: range.start, end: range.end });
			
			filteredPrices.forEach(price => {
				if (index === priceRanges.length - 1) {
					if (price >= range.start) {
						bins[index]++;
					}
				} else {
					if (price >= range.start && price <= range.end) {
						bins[index]++;
					}
				}
			});
		});
		
		return { labels, bins, ranges };
	}
	
	/**
	 * 计算星级分布数据（考虑联动筛选）
	 */
	_calculateRatingData(data) {
		const ratingMap = new Map();
		
		data.forEach(row => {
			const ratingVal = parseValue(row, 'rating');
			let rating = 0;
			
			if (typeof ratingVal === 'string' && ratingVal.includes('%')) {
				const percent = parseFloat(ratingVal.replace('%', ''));
				rating = Math.round((percent / 100) * 5 * 10) / 10;
			} else {
				rating = parseNumber(ratingVal);
			}
			
			if (!isNaN(rating) && rating > 0) {
				const rounded = Math.round(rating);
				ratingMap.set(rounded, (ratingMap.get(rounded) || 0) + 1);
			}
		});
		
		const labels = [];
		const values = [];
		const bins = [];
		
		for (let i = 1; i <= 5; i++) {
			labels.push(`${i} 星`);
			values.push(ratingMap.get(i) || 0);
			bins.push(i);
		}
		
		return { labels, values, bins };
	}
	
	/**
	 * 使用计算好的数据更新价格图表
	 */
	_updatePriceChartWithData(data, chartData) {
		if (!chartData) {
			chartData = this._calculatePriceData(data);
		}
		
		if (chartData.labels.length === 0) {
			this.priceChart.data.labels = [];
			this.priceChart.data.datasets[0].data = [];
			this.priceChart.update();
			return;
		}
		
		this.priceBins = chartData.ranges;
		this.priceChart.data.labels = chartData.labels;
		this.priceChart.data.datasets[0].data = chartData.bins;
		this.priceChart.update();
	}
	
	/**
	 * 使用计算好的数据更新星级图表
	 */
	_updateRatingChartWithData(data, chartData) {
		if (!chartData) {
			chartData = this._calculateRatingData(data);
		}
		
		this.ratingBins = chartData.bins;
		this.ratingChart.data.labels = chartData.labels;
		this.ratingChart.data.datasets[0].data = chartData.values;
		this.ratingChart.update();
	}
	
	/**
	 * 更新聚合数据
	 */
	updateAggregateData(data) {
		const total = data.length;
		const prices = data.map(row => parsePrice(parseValue(row, 'price'))).filter(v => !isNaN(v) && v >= 0);
		
		// 评价数量：统计评价数量列非空值的数量（不是求和）
		const reviewsCount = data.filter(row => {
			const reviewVal = parseValue(row, 'reviews');
			return reviewVal !== null && reviewVal !== undefined && reviewVal !== '' && String(reviewVal).trim() !== '';
		}).length;
		
		// 无评价链接量：统计评价数量列空值的数量（有多少个产品没有评价数量）
		const noReviewsCount = data.filter(row => {
			const reviewVal = parseValue(row, 'reviews');
			return reviewVal === null || reviewVal === undefined || reviewVal === '' || String(reviewVal).trim() === '';
		}).length;
		
		const avgPrice = prices.length > 0 ? (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2) : '0';
		
		this.container.querySelector('#analytics-total').textContent = total.toLocaleString();
		this.container.querySelector('#analytics-avg-price').textContent = `${avgPrice} Lei`;
		this.container.querySelector('#analytics-avg-rating').textContent = reviewsCount.toLocaleString();
		this.container.querySelector('#analytics-avg-discount').textContent = noReviewsCount.toLocaleString();
	}
	
	/**
	 * 更新价格分布图表（保留兼容性，内部调用新方法）
	 */
	updatePriceChart(data) {
		const chartData = this._calculatePriceData(data);
		this._updatePriceChartWithData(data, chartData);
	}
	
	/**
	 * 更新星级分布图表（保留兼容性，内部调用新方法）
	 */
	updateRatingChart(data) {
		const chartData = this._calculateRatingData(data);
		this._updateRatingChartWithData(data, chartData);
	}
	
	/**
	 * 根据价格区间筛选（支持多图表联动）
	 * 点击固定区间时，进入细分模式；点击细分区间时，可以继续细分或应用筛选
	 */
	filterByPriceRange(binIndex) {
		if (!this.priceBins[binIndex] || !this.onFilter) return;
		
		const { start, end } = this.priceBins[binIndex];
		
		if (this.priceRangeLevel === 0) {
			// 第一级：点击固定区间，立即应用筛选并进入细分模式
			this.priceRangeLevel = 1;
			this.currentPriceRange = { start, end };
			
			// 更新联动状态
			this.linkageState.priceFilter = { start, end };
			
			// 创建组合筛选函数（价格 + 星级）
			this.currentFilter = this._createCombinedFilter();
			this.onFilter(this.currentFilter);
			
			// 交叉联动：更新星级分布图表（基于价格筛选后的数据）
			this._updateChartsWithLinkage();
		} else {
			// 第二级及以上：检查是否可以继续细分
			const rangeSize = end === Infinity ? Infinity : end - start;
			const canSubdivide = rangeSize > 10;
			
			if (canSubdivide) {
				// 可以继续细分，进入下一级细分模式
				this.priceRangeLevel++;
				this.currentPriceRange = { start, end };
				this.linkageState.priceFilter = { start, end };
				
				// 更新组合筛选
				this.currentFilter = this._createCombinedFilter();
				this.onFilter(this.currentFilter);
				
				// 交叉联动：更新星级分布图表
				this._updateChartsWithLinkage();
			} else {
				// 区间太小，直接应用筛选
				this.linkageState.priceFilter = { start, end };
				this.currentFilter = this._createCombinedFilter();
				this.onFilter(this.currentFilter);
				
				// 交叉联动：更新星级分布图表
				this._updateChartsWithLinkage();
			}
		}
	}
	
	/**
	 * 重置价格区间到第一级（固定区间）
	 */
	resetPriceRange() {
		this.priceRangeLevel = 0;
		this.currentPriceRange = null;
		this.currentFilter = null;
		if (this.store) {
			this.updatePriceChart(this.store.filteredData || []);
		}
	}
	
	/**
	 * 根据星级筛选（支持多图表联动）
	 */
	filterByRating(binIndex) {
		if (!this.ratingBins[binIndex] || !this.onFilter) return;
		
		const targetRating = this.ratingBins[binIndex];
		
		// 更新联动状态
		this.linkageState.ratingFilter = { rating: targetRating };
		
		// 创建组合筛选函数（价格 + 星级）
		this.currentFilter = this._createCombinedFilter();
		this.onFilter(this.currentFilter);
		
		// 交叉联动：更新价格分布图表（基于星级筛选后的数据）
		this._updateChartsWithLinkage();
	}
	
	/**
	 * 创建组合筛选函数（价格 + 星级）
	 */
	_createCombinedFilter() {
		return (row) => {
			// 价格筛选
			if (this.linkageState.priceFilter) {
				const { start, end } = this.linkageState.priceFilter;
				const price = parsePrice(parseValue(row, 'price'));
				if (isNaN(price)) return false;
				
				if (end === Infinity) {
					if (price < start) return false;
				} else {
					if (price < start || price > end) return false;
				}
			}
			
			// 星级筛选
			if (this.linkageState.ratingFilter) {
				const { rating: targetRating } = this.linkageState.ratingFilter;
				const ratingVal = parseValue(row, 'rating');
				let rating = 0;
				
				if (typeof ratingVal === 'string' && ratingVal.includes('%')) {
					const percent = parseFloat(ratingVal.replace('%', ''));
					rating = Math.round((percent / 100) * 5 * 10) / 10;
				} else {
					rating = parseNumber(ratingVal);
				}
				
				if (isNaN(rating) || Math.round(rating) !== targetRating) {
					return false;
				}
			}
			
			return true;
		};
	}
	
	/**
	 * 更新图表（支持交叉联动）
	 */
	_updateChartsWithLinkage() {
		const data = this.store?.filteredData || [];
		
		if (data.length === 0) {
			this.clearData();
			return;
		}
		
		// 清除缓存（因为筛选条件变化）
		this.updateCache.clear();
		
		// 更新聚合数据
		this.updateAggregateData(data);
		
		// 更新价格分布图表（考虑星级筛选）
		const priceData = this._calculatePriceData(data);
		this._updatePriceChartWithData(data, priceData);
		
		// 更新星级分布图表（考虑价格筛选）
		const ratingData = this._calculateRatingData(data);
		this._updateRatingChartWithData(data, ratingData);
	}
	
	/**
	 * 清除筛选（清除所有联动状态）
	 */
	clearFilter() {
		this.currentFilter = null;
		this.linkageState.priceFilter = null;
		this.linkageState.ratingFilter = null;
		this.updateCache.clear();
		
		// 清除筛选时，重置价格区间到第一级
		this.resetPriceRange();
	}
	
	/**
	 * 设置进度回调函数（用于显示更新进度）
	 */
	setProgressCallback(callback) {
		this.updateProgressCallback = callback;
	}
	
	/**
	 * 清空数据
	 */
	clearData() {
		this.container.querySelector('#analytics-total').textContent = '0';
		this.container.querySelector('#analytics-avg-price').textContent = '0 Lei';
		this.container.querySelector('#analytics-avg-rating').textContent = '0';
		this.container.querySelector('#analytics-avg-discount').textContent = '0';
		
		if (this.priceChart) {
			this.priceChart.data.labels = [];
			this.priceChart.data.datasets[0].data = [];
			this.priceChart.update();
		}
		
		if (this.ratingChart) {
			this.ratingChart.data.labels = [];
			this.ratingChart.data.datasets[0].data = [];
			this.ratingChart.update();
		}
	}
	
	/**
	 * 销毁组件
	 */
	destroy() {
		// 清除防抖定时器
		if (this.updateDebounceTimer) {
			clearTimeout(this.updateDebounceTimer);
			this.updateDebounceTimer = null;
		}
		
		// 清除缓存
		this.updateCache.clear();
		
		// 销毁图表
		if (this.priceChart) {
			this.priceChart.destroy();
			this.priceChart = null;
		}
		if (this.ratingChart) {
			this.ratingChart.destroy();
			this.ratingChart = null;
		}
	}
}

