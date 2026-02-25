/**
 * 利润测算组件
 * 负责UI渲染和交互，管理利润测算模块的完整功能
 */
import { calculateBatch, calculateBudgetPrice } from '../core/ProfitEngine.js';
import { loadProfitConfig, saveProfitConfig, DEFAULT_PROFIT_CONFIG } from '../config/profitConfig.js';

/**
 * 利润测算组件类
 */
export class ProfitCalculator {
	/**
	 * @param {HTMLElement} container - 容器元素
	 * @param {Object} store - Store实例
	 * @param {Object} toast - Toast实例
	 * @param {Object} lightbox - Lightbox实例
	 */
	constructor(container, store, toast, lightbox) {
		this.container = container;
		this.store = store;
		this.toast = toast;
		this.lightbox = lightbox;
		this.products = [];
		this.config = { ...DEFAULT_PROFIT_CONFIG };
		this.isInitialized = false;
		this.isCalculating = false;
		// 防抖定时器（用于增量更新）
		this.updateDebounceTimer = null;
		// 保存事件处理函数引用，用于移除事件监听器
		this.boundHandlers = {
			dimensionInput: null,
			dimensionBlur: null,
			deleteClick: null,
			tooltipMouseEnter: null,
			tooltipMouseMove: null,
			tooltipMouseLeave: null,
			imageClick: null
		};
	}

	/**
	 * 初始化组件
	 */
	init() {
		if (this.isInitialized) return;

		// 加载保存的配置
		this.config = loadProfitConfig();
		this.store.updateProfitConfig(this.config);

		// 订阅Store事件
		this.store.subscribe('profitData', (data) => {
			this.updateProducts(data);
		});

		this.store.subscribe('profitConfig', (config) => {
			this.config = config;
			this.recalculate();
		});

		this.isInitialized = true;
		this.render();
	}

	/**
	 * 更新产品列表
	 * @param {Array} newProducts - 新产品数组
	 */
	updateProducts(newProducts) {
		if (!Array.isArray(newProducts)) return;

		// 基于_uid去重
		// 统一使用String()转换，确保类型一致，避免类型不匹配导致的去重失败
		const existingIds = new Set(this.products.map(p => String(p._uid)));
		const uniqueNewProducts = newProducts.filter(p => p._uid !== undefined && !existingIds.has(String(p._uid)));
		
		// 确保新产品有 tailOperationFee 和 storageFee 字段（向后兼容）
		uniqueNewProducts.forEach(product => {
			if (product.tailOperationFee === undefined) {
				product.tailOperationFee = 0;
			}
			if (product.storageFee === undefined) {
				product.storageFee = 0;
			}
		});

		this.products = [...this.products, ...uniqueNewProducts];
		this.recalculate(false); // 不自动渲染，因为后面会调用render()
		this.render();
		// 重新初始化滚动容器高度
		this.initScrollContainerHeight();
	}

	/**
	 * 重新计算所有产品的利润
	 * 注意：此方法用于配置变化或批量更新场景
	 * - 如果表格已存在，使用批量增量更新（保持滚动位置，无闪烁）
	 * - 如果表格不存在，使用全量重新渲染（首次渲染）
	 * 对于单个产品的尺寸重量或费用变化，应使用 updateResultRow() 进行增量更新
	 * @param {boolean} autoRender - 是否自动渲染结果表格，默认为true
	 */
	recalculate(autoRender = true) {
		if (this.products.length === 0) return;

		this.isCalculating = true;
		this.showLoadingState();

		// 使用setTimeout模拟异步计算，避免阻塞UI
		setTimeout(() => {
			// 先批量计算所有产品（配置可能已变化，需要重新计算）
			const results = calculateBatch(this.products, this.config);
			this.products = results;
			
			// 检查表格是否已存在
			const existingTable = this.container.querySelector('.result-table');
			
			if (existingTable && autoRender) {
				// 表格已存在，使用批量增量更新（保持滚动位置，无闪烁）
				// 注意：产品数据已经包含计算结果，updateAllResultRows 中不需要再次计算
				this.updateAllResultRows(false); // 批量更新时不显示反馈动画
				this.isCalculating = false;
				this.hideLoadingState();
			} else {
				// 表格不存在，使用全量重新渲染（首次渲染）
				this.isCalculating = false;
				this.hideLoadingState();
				
				// 自动渲染结果表格和产品列表（更新显示值）
				if (autoRender) {
					// 查找右侧面板容器，如果找不到则使用默认容器
					const rightPanel = this.container?.querySelector('.profit-right-panel');
					this.renderResultSection(rightPanel || null);
					
					// 更新产品列表中的预算价格显示
					this.updateProductBudgetDisplay();
					
					// 重新初始化滚动容器高度，确保滚动条正常显示
					this.initScrollContainerHeight();
				}
			}
		}, 50);
	}

	/**
	 * 渲染组件
	 */
	render() {
		if (!this.container) return;

		// 创建左右分栏布局容器
		const layoutHtml = `
			<div class="profit-layout-container">
				<div class="profit-left-panel">
					<!-- 产品列表将渲染在这里 -->
				</div>
				<div class="profit-right-panel">
					<!-- 参数配置将渲染在这里 -->
					<!-- 计算结果将渲染在这里 -->
				</div>
			</div>
		`;

		// 清空容器并插入布局结构
		this.container.innerHTML = layoutHtml;

		// 获取左右面板容器
		const leftPanel = this.container.querySelector('.profit-left-panel');
		const rightPanel = this.container.querySelector('.profit-right-panel');

		// 渲染产品列表到左侧面板
		this.renderProductList(leftPanel);

		// 渲染参数配置到右侧面板
		this.renderConfigSection(rightPanel);

		// 渲染计算结果到右侧面板
		this.renderResultSection(rightPanel);

		// 绑定事件
		this.bindEvents();

		// 初始化滚动容器高度
		this.initScrollContainerHeight();
	}

	/**
	 * 初始化滚动容器高度
	 * 基于视口高度动态计算并设置产品列表和计算结果表格容器高度，确保滚动条正常显示
	 */
	initScrollContainerHeight() {
		requestAnimationFrame(() => {
			setTimeout(() => {
				const productList = this.container.querySelector('.product-list');
				const resultTableContainer = this.container.querySelector('.result-table-container');
				const productSection = this.container.querySelector('.profit-product-section');
				const resultSection = this.container.querySelector('.profit-result-section');
				const layoutContainer = this.container.querySelector('.profit-layout-container');
				const configSection = this.container.querySelector('.profit-config-section');

				if (!layoutContainer) return;

				const layoutRect = layoutContainer.getBoundingClientRect();
				const windowHeight = window.innerHeight;
				const layoutTop = layoutRect.top;
				const layoutPadding = 16;

				if (productList && productSection) {
					const headerElement = productSection.children[0];
					const headerHeight = headerElement ? headerElement.offsetHeight : 0;
					const sectionPadding = 32;
					const availableHeight = Math.max(300, windowHeight - layoutTop - layoutPadding * 2 - headerHeight - sectionPadding);

					productList.style.height = `${availableHeight}px`;
					productList.style.maxHeight = `${availableHeight}px`;
					productList.style.minHeight = `${availableHeight}px`;
					productList.style.overflowY = 'auto';
					productList.style.overflowX = 'hidden';
					productList.style.position = 'relative';
					productList.style.setProperty('overflow-y', 'auto', 'important');
				}

				if (resultTableContainer && resultSection) {
					const headerElement = resultSection.children[0];
					const headerHeight = headerElement ? headerElement.offsetHeight : 0;
					const sectionPadding = 32; // profit-result-section的padding (p-4 = 1rem = 16px * 2)
					const configHeight = configSection ? configSection.offsetHeight : 0;
					const configGap = configSection ? 16 : 0;
					// 增加底部安全边距，确保最后一行完全可见（考虑section的底部padding和其他可能的遮挡）
					const bottomSafeMargin = 24;
					const availableHeight = Math.max(300, windowHeight - layoutTop - layoutPadding * 2 - configHeight - configGap - headerHeight - sectionPadding - bottomSafeMargin);

					resultTableContainer.style.height = `${availableHeight}px`;
					resultTableContainer.style.maxHeight = `${availableHeight}px`;
					resultTableContainer.style.minHeight = `${availableHeight}px`;
					resultTableContainer.style.overflowY = 'auto';
					resultTableContainer.style.overflowX = 'auto';
					resultTableContainer.style.position = 'relative';
					resultTableContainer.style.setProperty('overflow-y', 'auto', 'important');
					// 添加底部padding，确保最后一行不被遮挡
					resultTableContainer.style.paddingBottom = '12px';
				}
			}, 150);
		});
	}

	/**
	 * 渲染参数配置区
	 * @param {HTMLElement} container - 容器元素，如果未提供则使用默认位置
	 */
	renderConfigSection(container = null) {
		const configHtml = `
			<div class="profit-config-section bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-4">
				<div class="config-header-row flex items-center gap-4">
					<h3 class="text-lg font-normal text-gray-900 flex items-center gap-2 whitespace-nowrap">
						<i class="fas fa-cog text-blue-600"></i> 参数配置
					</h3>
					<div class="config-divider">|</div>
					<div class="config-form flex-1 flex items-center gap-3">
						<div class="config-item">
							<label class="block text-sm font-medium text-gray-700 mb-1">目标毛利率（%）</label>
							<input type="number" id="targetMargin" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" value="${(this.config.targetMargin * 100).toFixed(1)}" step="0.1" min="0" max="100">
						</div>
						<div class="config-item">
							<label class="block text-sm font-medium text-gray-700 mb-1">汇率</label>
							<input type="number" id="exchangeRate" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" value="${this.config.exchangeRate}" step="0.1" min="0">
						</div>
						<div class="config-item">
							<label class="block text-sm font-medium text-gray-700 mb-1">头程单价（元/kg）</label>
							<input type="number" id="freightUnitPrice" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" value="${this.config.freightUnitPrice}" step="0.1" min="0">
						</div>
						<div class="config-item flex items-end">
							<div class="flex gap-2">
								<button id="saveConfigBtn" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md shadow-sm transition-all text-sm font-medium whitespace-nowrap">保存配置</button>
								<button id="resetConfigBtn" class="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-md transition-all text-sm font-medium whitespace-nowrap">重置</button>
							</div>
						</div>
					</div>
				</div>
			</div>
		`;

		const targetContainer = container || this.container;
		const existingConfig = targetContainer.querySelector('.profit-config-section');
		if (existingConfig) {
			existingConfig.outerHTML = configHtml;
		} else {
			targetContainer.insertAdjacentHTML('afterbegin', configHtml);
		}
	}

	/**
	 * 渲染产品列表区
	 * @param {HTMLElement} container - 容器元素，如果未提供则使用默认位置
	 */
	renderProductList(container = null) {
		const productListHtml = `
			<div class="profit-product-section bg-white p-4 rounded-xl shadow-sm border border-gray-100">
				<div class="flex items-center justify-between mb-4">
					<h3 class="text-lg font-normal text-gray-900 flex items-center gap-2">
						<i class="fas fa-box text-blue-600"></i> 产品列表（${this.products.length}）
					</h3>
					<button id="clearProductsBtn" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md shadow-sm transition-all text-sm font-medium disabled:bg-gray-300 disabled:cursor-not-allowed" ${this.products.length === 0 ? 'disabled' : ''}>清空列表</button>
				</div>
				<div class="product-list space-y-3" id="profitProductList">
					${this.products.length === 0 
						? '<div class="empty-state text-center py-8 text-gray-500"><i class="fas fa-inbox text-4xl mb-2"></i><p>暂无产品，请从数据海选看板推送产品数据</p></div>'
						: this.products.map((product, index) => this.renderProductItem(product, index)).join('')
					}
				</div>
			</div>
		`;

		const targetContainer = container || this.container;
		const existingList = targetContainer.querySelector('.profit-product-section');
		if (existingList) {
			existingList.outerHTML = productListHtml;
		} else {
			targetContainer.insertAdjacentHTML('beforeend', productListHtml);
		}
	}

	/**
	 * 渲染单个产品项
	 * @param {Object} product - 产品对象
	 * @param {number} index - 索引
	 * @returns {string} HTML字符串
	 */
	renderProductItem(product, index) {
		const { _uid, title = '-', price = 0, img = '', pnk = '', link = '', length = 0, width = 0, height = 0, weight = 0, budgetPrice = 0, tailOperationFee = 0, storageFee = 0 } = product;

		// 确保price和budgetPrice是数字类型
		const priceNum = typeof price === 'number' ? price : parseFloat(price) || 0;
		const budgetPriceNum = typeof budgetPrice === 'number' ? budgetPrice : parseFloat(budgetPrice) || 0;
		const sequenceNumber = index + 1; // 序号从1开始
		
		// HTML转义处理
		const escapedTitle = String(title).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
		const escapedPnk = String(pnk || '').trim();
		const escapedLink = String(link || '').trim();

		return `
			<div class="product-item bg-gray-50 p-4 rounded-lg border border-gray-200" data-uid="${_uid}" data-index="${index}">
				<div class="flex items-start gap-4 mb-3">
					<div class="product-sequence-number">${sequenceNumber}</div>
					${img ? `<img src="${img}" alt="${escapedTitle}" class="product-img w-20 h-20 object-cover rounded border border-gray-200" onerror="this.style.display='none'">` : '<div class="w-20 h-20 bg-gray-200 rounded border border-gray-200 flex items-center justify-center"><i class="fas fa-image text-gray-400"></i></div>'}
					<div class="product-details flex-1">
						<div class="product-title font-medium text-gray-900 mb-1">${title}</div>
						<div class="product-meta-row flex items-center gap-3 flex-wrap mt-1">
							<div class="product-price text-sm text-gray-600">前端价格: <span class="price-amount font-semibold">${priceNum.toFixed(2)} Lei</span></div>
							<div class="product-pnk text-xs text-gray-500">
								<span class="font-medium">PNK:</span>
								<span class="pnk-value ml-1">${escapedPnk || '-'}</span>
							</div>
							<div class="product-link">
								<span class="text-xs text-gray-500">产品链接：</span>
								${escapedLink 
									? `<a href="${escapedLink}" target="_blank" class="action-link text-xs ml-1">
										<i class="fas fa-external-link-alt"></i> 查看
									</a>`
									: '<span class="text-xs text-gray-400 ml-1">-</span>'
								}
							</div>
						</div>
						${budgetPriceNum > 0 ? `<div class="product-budget text-sm text-blue-600 mt-1">采购价预算: <span class="font-semibold">${budgetPriceNum.toFixed(2)} 元</span></div>` : ''}
					</div>
					<button class="btn-delete text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-all" data-uid="${_uid}" title="删除"><i class="fas fa-trash-alt"></i></button>
				</div>
				<div class="product-dimensions grid grid-cols-6 gap-3">
					<div class="dimension-item">
						<label class="block text-xs text-gray-600 mb-1 whitespace-nowrap">长（CM）</label>
						<input type="number" class="dimension-input w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" data-field="length" data-uid="${_uid}" value="${length}" step="0.1" min="0" placeholder="0">
					</div>
					<div class="dimension-item">
						<label class="block text-xs text-gray-600 mb-1 whitespace-nowrap">宽（CM）</label>
						<input type="number" class="dimension-input w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" data-field="width" data-uid="${_uid}" value="${width}" step="0.1" min="0" placeholder="0">
					</div>
					<div class="dimension-item">
						<label class="block text-xs text-gray-600 mb-1 whitespace-nowrap">高（CM）</label>
						<input type="number" class="dimension-input w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" data-field="height" data-uid="${_uid}" value="${height}" step="0.1" min="0" placeholder="0">
					</div>
					<div class="dimension-item">
						<label class="block text-xs text-gray-600 mb-1 whitespace-nowrap">实重（kg）</label>
						<input type="number" class="dimension-input w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" data-field="weight" data-uid="${_uid}" value="${weight}" step="0.1" min="0" placeholder="0">
					</div>
					<div class="dimension-item">
						<label class="block text-xs text-gray-600 mb-1 whitespace-nowrap">尾程操作费(RON)</label>
						<input type="number" class="dimension-input w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" data-field="tailOperationFee" data-uid="${_uid}" value="${tailOperationFee || 0}" step="0.01" min="0" placeholder="0">
					</div>
					<div class="dimension-item">
						<label class="block text-xs text-gray-600 mb-1 whitespace-nowrap">仓储费（RON）</label>
						<input type="number" class="dimension-input w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" data-field="storageFee" data-uid="${_uid}" value="${storageFee || 0}" step="0.01" min="0" placeholder="0">
					</div>
				</div>
			</div>
		`;
	}

	/**
	 * 渲染计算结果区
	 * @param {HTMLElement} container - 容器元素，如果未提供则使用默认位置
	 */
	renderResultSection(container = null) {
		const resultHtml = `
			<div class="profit-result-section bg-white p-4 rounded-xl shadow-sm border border-gray-100">
				<div class="flex items-center justify-between mb-4">
					<h3 class="text-lg font-normal text-gray-900 flex items-center gap-2">
						<i class="fas fa-table text-blue-600"></i> 计算结果
					</h3>
					<button id="exportResultBtn" class="export-btn" ${this.products.length === 0 ? 'disabled' : ''}>
						<i class="fas fa-download"></i> 导出结果
					</button>
				</div>
				<div class="result-table-container overflow-x-auto">
					<table class="result-table w-full border-collapse">
						<thead>
							<tr class="bg-gray-50">
								<th class="result-sequence-header px-4 py-2 text-center text-xs font-semibold text-gray-700 border-b border-gray-200">序号</th>
								<th class="result-image-header px-2 py-2 text-center text-xs font-semibold text-gray-700 border-b border-gray-200">图片</th>
								<th class="result-product-title-header px-4 py-2 text-left text-xs font-semibold text-gray-700 border-b border-gray-200">链接标题</th>
								<th class="px-4 py-2 text-right text-xs font-semibold text-gray-700 border-b border-gray-200">前端价格(RON)</th>
								<th class="px-4 py-2 text-right text-xs font-semibold text-gray-700 border-b border-gray-200">实际售价(RON)</th>
								<th class="px-4 py-2 text-right text-xs font-semibold text-gray-700 border-b border-gray-200">佣金</th>
								<th class="px-4 py-2 text-right text-xs font-semibold text-gray-700 border-b border-gray-200">体积重</th>
								<th class="px-4 py-2 text-right text-xs font-semibold text-gray-700 border-b border-gray-200">计费重</th>
								<th class="px-4 py-2 text-right text-xs font-semibold text-gray-700 border-b border-gray-200">头程运费(元)</th>
								<th class="px-4 py-2 text-right text-xs font-semibold text-gray-700 border-b border-gray-200">尾程费(RON)</th>
								<th class="px-4 py-2 text-right text-xs font-semibold text-gray-700 border-b border-gray-200">采购价预算</th>
								<th class="px-4 py-2 text-right text-xs font-semibold text-gray-700 border-b border-gray-200">预估毛利</th>
							</tr>
						</thead>
						<tbody>
							${this.products.length === 0
								? '<tr><td colspan="12" class="empty-state text-center py-8 text-gray-500">暂无计算结果</td></tr>'
								: this.products.map((product, index) => this.renderResultRow(product, index)).join('')
							}
						</tbody>
					</table>
				</div>
			</div>
		`;

		const targetContainer = container || this.container;
		const existingResult = targetContainer.querySelector('.profit-result-section');
		if (existingResult) {
			existingResult.outerHTML = resultHtml;
		} else {
			targetContainer.insertAdjacentHTML('beforeend', resultHtml);
		}
	}

	/**
	 * 渲染结果表格行
	 * @param {Object} product - 产品对象
	 * @param {number} index - 索引
	 * @returns {string} HTML字符串
	 */
	renderResultRow(product, index) {
		const {
			title = '-',
			price = 0,
			actualPrice = 0,
			commission = 0,
			volumeWeight = 0,
			chargeWeight = 0,
			freight = 0,
			tailFee = 0,
			budgetPrice = 0,
			estimatedProfit = 0,
			img = ''
		} = product;

		// 确保所有数字字段都是数字类型
		const priceNum = typeof price === 'number' ? price : parseFloat(price) || 0;
		const actualPriceNum = typeof actualPrice === 'number' ? actualPrice : parseFloat(actualPrice) || 0;
		const commissionNum = typeof commission === 'number' ? commission : parseFloat(commission) || 0;
		const volumeWeightNum = typeof volumeWeight === 'number' ? volumeWeight : parseFloat(volumeWeight) || 0;
		const chargeWeightNum = typeof chargeWeight === 'number' ? chargeWeight : parseFloat(chargeWeight) || 0;
		const freightNum = typeof freight === 'number' ? freight : parseFloat(freight) || 0;
		const tailFeeNum = typeof tailFee === 'number' ? tailFee : parseFloat(tailFee) || 0;
		const budgetPriceNum = typeof budgetPrice === 'number' ? budgetPrice : parseFloat(budgetPrice) || 0;
		const estimatedProfitNum = typeof estimatedProfit === 'number' ? estimatedProfit : parseFloat(estimatedProfit) || 0;
		const sequenceNumber = index + 1;
		const escapedTitle = String(title).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
		const imgSrc = String(img || '').trim();
		const imageHtml = imgSrc 
			? `<img src="${imgSrc}" alt="${escapedTitle}" class="result-product-image" data-img-src="${imgSrc}" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'result-image-placeholder\\'><i class=\\'fas fa-image\\'></i></div>'">`
			: `<div class="result-image-placeholder"><i class="fas fa-image"></i></div>`;

		return `
			<tr class="result-row hover:bg-gray-50 border-b border-gray-100" data-index="${index}">
				<td class="result-sequence-cell px-4 py-2 text-sm text-center text-gray-700 font-medium">${sequenceNumber}</td>
				<td class="result-image-cell px-2 py-2 text-center">${imageHtml}</td>
				<td class="result-product-title-cell px-4 py-2 text-sm text-gray-900" data-full-text="${escapedTitle}">${title}</td>
				<td class="px-4 py-2 text-sm text-right text-gray-700">${priceNum.toFixed(2)}</td>
				<td class="px-4 py-2 text-sm text-right text-gray-700">${actualPriceNum.toFixed(2)}</td>
				<td class="px-4 py-2 text-sm text-right text-gray-700">${commissionNum.toFixed(2)}</td>
				<td class="px-4 py-2 text-sm text-right text-gray-700">${volumeWeightNum.toFixed(2)}</td>
				<td class="px-4 py-2 text-sm text-right text-gray-700">${chargeWeightNum.toFixed(2)}</td>
				<td class="px-4 py-2 text-sm text-right text-gray-700">${freightNum.toFixed(2)}</td>
				<td class="px-4 py-2 text-sm text-right text-gray-700">${tailFeeNum.toFixed(2)}</td>
				<td class="px-4 py-2 text-sm text-right font-semibold text-blue-600 budget-price">${budgetPriceNum.toFixed(2)}</td>
				<td class="px-4 py-2 text-sm text-right font-semibold ${estimatedProfitNum >= 0 ? 'text-green-600' : 'text-red-600'} estimated-profit">${estimatedProfitNum.toFixed(2)}</td>
			</tr>
		`;
	}

	/**
	 * 增量更新单个结果表格行（不重新渲染整个表格）
	 * @param {number} productIndex - 产品索引
	 * @param {boolean} showFeedback - 是否显示轻量级反馈动画，默认为true
	 * @param {boolean} forceRecalculate - 是否强制重新计算，默认为false（单个更新时设为true）
	 */
	updateResultRow(productIndex, showFeedback = true, forceRecalculate = false) {
		if (productIndex < 0 || productIndex >= this.products.length) return;
		
		// 查找对应的表格行
		const row = this.container.querySelector(`.result-row[data-index="${productIndex}"]`);
		if (!row) return;
		
		const product = this.products[productIndex];
		let result;
		
		// 如果强制重新计算（单个更新场景），或者产品数据不包含计算结果，则重新计算
		if (forceRecalculate || product.actualPrice === undefined || product.commission === undefined) {
			// 需要重新计算（单个更新场景或首次计算）
			result = calculateBudgetPrice(product, this.config);
			// 更新产品数据
			Object.assign(product, result);
		} else {
			// 产品数据已经包含计算结果（批量更新场景），直接使用
			result = {
				actualPrice: product.actualPrice,
				commission: product.commission,
				volumeWeight: product.volumeWeight,
				chargeWeight: product.chargeWeight,
				freight: product.freight,
				tailFee: product.tailFee,
				budgetPrice: product.budgetPrice,
				estimatedProfit: product.estimatedProfit
			};
		}
		
		// 确保所有数字字段都是数字类型
		const actualPriceNum = typeof result.actualPrice === 'number' ? result.actualPrice : parseFloat(result.actualPrice) || 0;
		const commissionNum = typeof result.commission === 'number' ? result.commission : parseFloat(result.commission) || 0;
		const volumeWeightNum = typeof result.volumeWeight === 'number' ? result.volumeWeight : parseFloat(result.volumeWeight) || 0;
		const chargeWeightNum = typeof result.chargeWeight === 'number' ? result.chargeWeight : parseFloat(result.chargeWeight) || 0;
		const freightNum = typeof result.freight === 'number' ? result.freight : parseFloat(result.freight) || 0;
		const tailFeeNum = typeof result.tailFee === 'number' ? result.tailFee : parseFloat(result.tailFee) || 0;
		const budgetPriceNum = typeof result.budgetPrice === 'number' ? result.budgetPrice : parseFloat(result.budgetPrice) || 0;
		const estimatedProfitNum = typeof result.estimatedProfit === 'number' ? result.estimatedProfit : parseFloat(result.estimatedProfit) || 0;
		
		// 更新表格单元格内容
		const cells = row.querySelectorAll('td');
		if (cells.length >= 12) {
			// 序号列（不变）
			// cells[0] - 序号
			// cells[1] - 图片
			// cells[2] - 链接标题
			// cells[3] - 前端价格（不变）
			// cells[4] - 实际售价
			cells[4].textContent = actualPriceNum.toFixed(2);
			// cells[5] - 佣金
			cells[5].textContent = commissionNum.toFixed(2);
			// cells[6] - 体积重
			cells[6].textContent = volumeWeightNum.toFixed(2);
			// cells[7] - 计费重
			cells[7].textContent = chargeWeightNum.toFixed(2);
			// cells[8] - 头程运费
			cells[8].textContent = freightNum.toFixed(2);
			// cells[9] - 尾程费（新增）
			const tailFeeCell = cells[9];
			tailFeeCell.textContent = tailFeeNum.toFixed(2);
			// cells[10] - 采购价预算
			const budgetCell = cells[10];
			budgetCell.textContent = budgetPriceNum.toFixed(2);
			// cells[11] - 预估毛利
			const profitCell = cells[11];
			profitCell.textContent = estimatedProfitNum.toFixed(2);
			// 更新预估毛利颜色
			profitCell.className = `px-4 py-2 text-sm text-right font-semibold ${estimatedProfitNum >= 0 ? 'text-green-600' : 'text-red-600'} estimated-profit`;
			
			// 轻量级反馈：短暂高亮更新的单元格（仅在单个更新时显示）
			if (showFeedback) {
				const updatedCells = [cells[4], cells[5], cells[6], cells[7], cells[8], tailFeeCell, budgetCell, profitCell];
				updatedCells.forEach(cell => {
					cell.classList.add('cell-updated');
					setTimeout(() => {
						cell.classList.remove('cell-updated');
					}, 200);
				});
			}
		}
		
		// 更新产品列表中的预算价格显示
		this.updateProductBudgetDisplay(productIndex);
	}

	/**
	 * 批量增量更新所有结果表格行（不重新渲染整个表格）
	 * 用于配置变化场景，保持滚动位置，无闪烁
	 * @param {boolean} showFeedback - 是否显示轻量级反馈动画，默认为false（批量更新时不显示，避免视觉干扰）
	 */
	updateAllResultRows(showFeedback = false) {
		if (this.products.length === 0) return;
		
		// 检查表格是否存在
		const firstRow = this.container.querySelector('.result-row');
		if (!firstRow) {
			// 如果表格不存在，需要先渲染
			const rightPanel = this.container?.querySelector('.profit-right-panel');
			this.renderResultSection(rightPanel || null);
			return;
		}
		
		// 注意：如果是从 recalculate() 调用，产品数据已经包含计算结果
		// 如果直接调用此方法，需要先批量计算
		// 为了安全，检查第一个产品是否包含计算结果
		if (this.products.length > 0 && (this.products[0].actualPrice === undefined || this.products[0].commission === undefined)) {
			// 产品数据不包含计算结果，需要批量计算
			const results = calculateBatch(this.products, this.config);
			this.products = results;
		}
		
		// 分批更新，避免阻塞UI（每批更新20行）
		const batchSize = 20;
		const totalProducts = this.products.length;
		let currentIndex = 0;
		
		const updateBatch = () => {
			const endIndex = Math.min(currentIndex + batchSize, totalProducts);
			
			// 更新当前批次
			for (let i = currentIndex; i < endIndex; i++) {
				this.updateResultRow(i, showFeedback);
			}
			
			currentIndex = endIndex;
			
			// 如果还有剩余，继续下一批
			if (currentIndex < totalProducts) {
				requestAnimationFrame(updateBatch);
			} else {
				// 所有更新完成，更新产品列表中的预算价格显示
				this.updateProductBudgetDisplay();
			}
		};
		
		// 开始第一批更新
		requestAnimationFrame(updateBatch);
	}

	/**
	 * 绑定事件
	 */
	bindEvents() {
		// 配置输入变化（实时验证和更新）
		const configInputs = this.container.querySelectorAll('#targetMargin, #exchangeRate, #freightUnitPrice');
		configInputs.forEach(input => {
			input.addEventListener('input', (e) => {
				this.validateConfigInput(e.target);
				this.handleConfigChange();
			});
			input.addEventListener('blur', (e) => {
				this.validateConfigInput(e.target);
			});
		});

		// 保存配置
		const saveBtn = this.container.querySelector('#saveConfigBtn');
		if (saveBtn) {
			saveBtn.addEventListener('click', () => {
				if (this.validateAllConfig()) {
					this.handleSaveConfig();
					if (this.toast) {
						this.toast.show('配置已保存！', 'success');
					}
				}
			});
		}

		// 重置配置
		const resetBtn = this.container.querySelector('#resetConfigBtn');
		if (resetBtn) {
			resetBtn.addEventListener('click', () => {
				this.handleResetConfig();
				if (this.toast) {
					this.toast.show('配置已重置为默认值！', 'info');
				}
			});
		}

		// 清空产品列表
		const clearBtn = this.container.querySelector('#clearProductsBtn');
		if (clearBtn) {
			clearBtn.addEventListener('click', () => {
				if (confirm('确定要清空所有产品吗？')) {
					this.handleClearProducts();
					if (this.toast) {
						this.toast.show('产品列表已清空！', 'info');
					}
				}
			});
		}

		// 产品尺寸重量和费用输入变化（使用事件委托，支持动态添加的元素）
		// 支持字段：length, width, height, weight, tailOperationFee, storageFee
		// 先移除旧的事件监听器（如果存在）
		if (this.boundHandlers.dimensionInput) {
			this.container.removeEventListener('input', this.boundHandlers.dimensionInput);
		}
		this.boundHandlers.dimensionInput = (e) => {
			// 确保事件目标存在且有正确的类名
			const target = e.target;
			if (target && target.classList && target.classList.contains('dimension-input')) {
				this.validateDimensionInput(target);
				this.handleDimensionChange(e);
			}
		};
		// 使用捕获阶段确保能捕获所有事件，包括动态添加的元素
		this.container.addEventListener('input', this.boundHandlers.dimensionInput, true);

		if (this.boundHandlers.dimensionBlur) {
			this.container.removeEventListener('blur', this.boundHandlers.dimensionBlur, true);
		}
		this.boundHandlers.dimensionBlur = (e) => {
			if (e.target.classList.contains('dimension-input')) {
				this.validateDimensionInput(e.target);
			}
		};
		this.container.addEventListener('blur', this.boundHandlers.dimensionBlur, true); // 使用捕获阶段确保事件能触发

		// 删除产品（使用事件委托）
		if (this.boundHandlers.deleteClick) {
			this.container.removeEventListener('click', this.boundHandlers.deleteClick);
		}
		this.boundHandlers.deleteClick = (e) => {
			const deleteBtn = e.target.closest('.btn-delete');
			if (deleteBtn) {
				e.stopPropagation(); // 阻止事件冒泡，避免重复触发
				this.handleDeleteProduct(e);
			}
		};
		this.container.addEventListener('click', this.boundHandlers.deleteClick, true);

		// 产品列表项点击高亮（使用事件委托）
		if (!this.boundHandlers.productItemClick) {
			this.boundHandlers.productItemClick = (e) => {
				const productItem = e.target.closest('.product-item');
				if (productItem && !e.target.closest('.btn-delete')) {
					const index = parseInt(productItem.dataset.index);
					this.highlightResultRow(index);
				}
			};
		}
		this.container.addEventListener('click', this.boundHandlers.productItemClick, true);

		// 导出结果
		const exportBtn = this.container.querySelector('#exportResultBtn');
		if (exportBtn) {
			exportBtn.addEventListener('click', () => {
				this.handleExportResults();
			});
		}

		// 初始化自定义Tooltip
		this.initCustomTooltip();

		// 初始化图片点击事件
		this.initImageClickEvents();
	}

	/**
	 * 初始化图片点击事件
	 * 为计算结果表格中的产品图片添加点击放大功能
	 */
	initImageClickEvents() {
		if (!this.lightbox) return;

		// 使用事件委托，支持动态添加的元素
		if (!this.boundHandlers.imageClick) {
			this.boundHandlers.imageClick = (e) => {
				const img = e.target.closest('.result-product-image');
				if (img) {
					const imgSrc = img.getAttribute('data-img-src') || img.src;
					if (imgSrc && this.lightbox) {
						this.lightbox.show(imgSrc);
					}
				}
			};
		}

		this.container.addEventListener('click', this.boundHandlers.imageClick, true);
	}

	/**
	 * 初始化自定义Tooltip
	 * 为产品标题单元格添加鼠标悬停显示完整标题的功能
	 */
	initCustomTooltip() {
		const tooltip = document.getElementById('custom-tooltip');
		if (!tooltip) return;

		// 移除旧的事件监听器
		if (this.boundHandlers.tooltipMouseEnter) {
			this.container.removeEventListener('mouseenter', this.boundHandlers.tooltipMouseEnter, true);
		}
		if (this.boundHandlers.tooltipMouseMove) {
			this.container.removeEventListener('mousemove', this.boundHandlers.tooltipMouseMove, true);
		}
		if (this.boundHandlers.tooltipMouseLeave) {
			this.container.removeEventListener('mouseleave', this.boundHandlers.tooltipMouseLeave, true);
		}

		// 鼠标移入事件
		this.boundHandlers.tooltipMouseEnter = (e) => {
			const cell = e.target.closest('.result-product-title-cell');
			if (cell) {
				const fullText = cell.getAttribute('data-full-text');
				if (fullText) {
					// 检查文本是否被截断（支持单行和多行）
					const isTruncated = cell.scrollHeight > cell.clientHeight || cell.scrollWidth > cell.clientWidth;
					if (isTruncated) {
						const decodedText = fullText.replace(/&quot;/g, '"').replace(/&#39;/g, "'");
						tooltip.textContent = decodedText;
						tooltip.classList.add('visible');
					}
				}
			}
		};

		// 鼠标移动事件
		this.boundHandlers.tooltipMouseMove = (e) => {
			const cell = e.target.closest('.result-product-title-cell');
			if (cell && tooltip.classList.contains('visible')) {
				const xOffset = 15;
				const yOffset = 15;
				let left = e.pageX + xOffset;
				if (left + tooltip.offsetWidth > window.innerWidth) {
					left = e.pageX - tooltip.offsetWidth - xOffset;
				}
				tooltip.style.left = `${left}px`;
				tooltip.style.top = `${e.pageY + yOffset}px`;
			}
		};

		// 鼠标移出事件
		this.boundHandlers.tooltipMouseLeave = (e) => {
			const cell = e.target.closest('.result-product-title-cell');
			if (cell) {
				tooltip.classList.remove('visible');
			}
		};

		this.container.addEventListener('mouseenter', this.boundHandlers.tooltipMouseEnter, true);
		this.container.addEventListener('mousemove', this.boundHandlers.tooltipMouseMove, true);
		this.container.addEventListener('mouseleave', this.boundHandlers.tooltipMouseLeave, true);
	}

	/**
	 * 处理配置变化
	 */
	handleConfigChange() {
		const targetMarginInput = this.container.querySelector('#targetMargin');
		const exchangeRateInput = this.container.querySelector('#exchangeRate');
		const freightUnitPriceInput = this.container.querySelector('#freightUnitPrice');

		if (!targetMarginInput || !exchangeRateInput || !freightUnitPriceInput) {
			return;
		}

		// 读取输入值（即使无效也读取，用于实时计算）
		const targetMargin = parseFloat(targetMarginInput.value) / 100 || 0;
		const exchangeRate = parseFloat(exchangeRateInput.value) || 0;
		const freightUnitPrice = parseFloat(freightUnitPriceInput.value) || 0;

		// 更新配置（即使值无效也更新，确保实时计算）
		this.config = {
			targetMargin: isNaN(targetMargin) ? 0 : targetMargin,
			exchangeRate: isNaN(exchangeRate) ? 0 : exchangeRate,
			freightUnitPrice: isNaN(freightUnitPrice) ? 0 : freightUnitPrice
		};

		// 实时重新计算（只要有产品数据就计算）
		if (this.products.length > 0) {
			this.recalculate(); // recalculate会自动渲染结果表格
		}
	}

	/**
	 * 处理保存配置
	 */
	handleSaveConfig() {
		saveProfitConfig(this.config);
		this.store.updateProfitConfig(this.config);
	}

	/**
	 * 处理重置配置
	 */
	handleResetConfig() {
		this.config = { ...DEFAULT_PROFIT_CONFIG };
		this.store.updateProfitConfig(this.config);
		this.renderConfigSection();
		this.bindEvents();
		this.recalculate(); // recalculate会自动渲染结果表格
	}

	/**
	 * 处理清空产品列表
	 */
	handleClearProducts() {
		this.products = [];
		this.store.clearProfitData();
		// 清除所有产品的推送状态
		this.store.clearProfitStatus();
		this.render();
		// 重新初始化滚动容器高度
		this.initScrollContainerHeight();
		// 清空列表时，滚动位置会自动回到顶部，无需恢复
	}

	/**
	 * 处理尺寸重量和费用变化（使用增量更新）
	 * 支持字段：length, width, height, weight, tailOperationFee, storageFee
	 * @param {Event} e - 事件对象
	 */
	handleDimensionChange(e) {
		const input = e.target;
		if (!input.dataset.uid || !input.dataset.field) return;
		
		// 使用更可靠的uid匹配方式（支持数字和字符串）
		const uidStr = String(input.dataset.uid);
		const field = input.dataset.field;
		const value = parseFloat(input.value) || 0;

		// 查找匹配的产品（支持数字和字符串类型的_uid）
		const productIndex = this.products.findIndex(p => {
			const productUid = String(p._uid);
			return productUid === uidStr;
		});
		
		if (productIndex === -1) return;
		
		const product = this.products[productIndex];
		product[field] = value;
		
		// 清除之前的防抖定时器
		if (this.updateDebounceTimer) {
			clearTimeout(this.updateDebounceTimer);
		}
		
		// 使用防抖处理，避免快速连续输入时频繁更新
		this.updateDebounceTimer = setTimeout(() => {
			// 增量更新：只更新变化的数据行，不重新渲染整个表格
			// 注意：单个更新时必须强制重新计算，因为尺寸重量或费用已变化
			this.updateResultRow(productIndex, true, true); // showFeedback=true, forceRecalculate=true
			this.updateDebounceTimer = null;
		}, 300); // 300ms防抖延迟
	}

	/**
	 * 处理删除产品
	 * @param {Event} e - 事件对象
	 */
	handleDeleteProduct(e) {
		const btn = e.target.closest('.btn-delete');
		if (!btn) return;
		const uidStr = String(btn.dataset.uid);
		
		// 保存当前滚动位置（删除前）
		const productList = this.container.querySelector('.product-list');
		const resultTableContainer = this.container.querySelector('.result-table-container');
		const savedProductScrollTop = productList ? productList.scrollTop : 0;
		const savedResultScrollTop = resultTableContainer ? resultTableContainer.scrollTop : 0;
		
		// 支持数字和字符串类型的_uid
		const beforeCount = this.products.length;
		this.products = this.products.filter(p => String(p._uid) !== uidStr);
		const afterCount = this.products.length;
		
		// 只有真正删除了产品时才显示提示和更新
		if (beforeCount > afterCount) {
			this.store.setProfitData(this.products);
			this.render(); // 重新渲染后序号会自动更新
			
			// 重新初始化滚动容器高度
			this.initScrollContainerHeight();
			
			// 恢复滚动位置（在DOM更新完成后）
			requestAnimationFrame(() => {
				setTimeout(() => {
					// 恢复产品列表滚动位置
					const newProductList = this.container.querySelector('.product-list');
					if (newProductList && savedProductScrollTop > 0) {
						// 保持滚动位置不变，让内容自然向上移动
						// 这样可以避免跳回顶部，用户可以看到删除后的效果
						newProductList.scrollTop = savedProductScrollTop;
					}
					
					// 恢复结果表格滚动位置
					const newResultTableContainer = this.container.querySelector('.result-table-container');
					if (newResultTableContainer && savedResultScrollTop > 0) {
						newResultTableContainer.scrollTop = savedResultScrollTop;
					}
				}, 200); // 等待滚动容器高度初始化完成
			});
			
			// Toast提示移到方法内部，确保只显示一次
			if (this.toast) {
				this.toast.show('产品已从列表移除！', 'info');
			}
		}
	}

	/**
	 * 验证配置输入
	 * @param {HTMLInputElement} input - 输入元素
	 */
	validateConfigInput(input) {
		const value = parseFloat(input.value);
		const min = parseFloat(input.min) || 0;
		const max = parseFloat(input.max);

		if (isNaN(value) || value < min || (max !== undefined && value > max)) {
			input.classList.add('border-red-500');
			return false;
		} else {
			input.classList.remove('border-red-500');
			return true;
		}
	}

	/**
	 * 验证所有配置输入
	 * @returns {boolean} 是否全部有效
	 */
	validateAllConfig() {
		const inputs = this.container.querySelectorAll('#targetMargin, #exchangeRate, #freightUnitPrice');
		let allValid = true;

		inputs.forEach(input => {
			if (!this.validateConfigInput(input)) {
				allValid = false;
			}
		});

		if (!allValid && this.toast) {
			this.toast.show('请检查配置参数，确保所有值都在有效范围内', 'warning');
		}

		return allValid;
	}

	/**
	 * 验证尺寸重量和费用输入
	 * 支持字段：length, width, height, weight, tailOperationFee, storageFee
	 * @param {HTMLInputElement} input - 输入元素
	 */
	validateDimensionInput(input) {
		const value = parseFloat(input.value);
		const min = parseFloat(input.min) || 0;

		if (isNaN(value) || value < min) {
			input.classList.add('border-red-500');
			return false;
		} else {
			input.classList.remove('border-red-500');
			return true;
		}
	}

	/**
	 * 高亮显示对应的计算结果表格行
	 * @param {number} index - 产品索引
	 */
	highlightResultRow(index) {
		// 移除所有高亮
		const allRows = this.container.querySelectorAll('.result-row');
		allRows.forEach(row => {
			row.classList.remove('result-row-highlight');
		});

		// 高亮指定行
		const targetRow = this.container.querySelector(`.result-row[data-index="${index}"]`);
		if (targetRow) {
			targetRow.classList.add('result-row-highlight');
			// 滚动到可见区域
			targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
			// 3秒后移除高亮
			setTimeout(() => {
				targetRow.classList.remove('result-row-highlight');
			}, 3000);
		}
	}

	/**
	 * 显示加载状态
	 */
	showLoadingState() {
		const resultSection = this.container.querySelector('.profit-result-section');
		if (resultSection && !resultSection.classList.contains('profit-loading')) {
			resultSection.classList.add('profit-loading');
		}
	}

	/**
	 * 隐藏加载状态
	 */
	hideLoadingState() {
		const resultSection = this.container.querySelector('.profit-result-section');
		if (resultSection) {
			resultSection.classList.remove('profit-loading');
		}
	}

	/**
	 * 更新产品列表中的预算价格显示
	 * @param {number|null} productIndex - 产品索引，如果提供则只更新该产品，否则更新所有产品
	 */
	updateProductBudgetDisplay(productIndex = null) {
		const productsToUpdate = productIndex !== null 
			? [this.products[productIndex]].filter(Boolean)
			: this.products;
		
		productsToUpdate.forEach(product => {
			const uidStr = String(product._uid);
			const productItem = this.container.querySelector(`.product-item[data-uid="${uidStr}"]`);
			if (productItem) {
				const budgetDisplay = productItem.querySelector('.product-budget');
				const budgetPrice = typeof product.budgetPrice === 'number' ? product.budgetPrice : parseFloat(product.budgetPrice) || 0;
				
				if (budgetPrice > 0) {
					// 预算价格大于0，更新或创建显示元素
					if (budgetDisplay) {
						// 元素存在，更新内容
						budgetDisplay.innerHTML = `采购价预算: <span class="font-semibold">${budgetPrice.toFixed(2)} 元</span>`;
					} else {
						// 元素不存在，创建新元素
						const productDetails = productItem.querySelector('.product-details');
						if (productDetails) {
							const productMetaRow = productDetails.querySelector('.product-meta-row');
							if (productMetaRow) {
								const budgetHtml = `<div class="product-budget text-sm text-blue-600 mt-1">采购价预算: <span class="font-semibold">${budgetPrice.toFixed(2)} 元</span></div>`;
								if (!productDetails.querySelector('.product-budget')) {
									productMetaRow.insertAdjacentHTML('afterend', budgetHtml);
								}
							}
						}
					}
				} else {
					// 预算价格小于等于0，删除显示元素
					if (budgetDisplay) {
						budgetDisplay.remove();
					}
				}
			}
		});
	}

	/**
	 * 导出计算结果（XLSX格式）
	 */
	handleExportResults() {
		if (this.products.length === 0) {
			if (this.toast) {
				this.toast.show('没有可导出的数据', 'warning');
			}
			return;
		}

		// 检查是否加载了SheetJS库
		if (typeof XLSX === 'undefined') {
			if (this.toast) {
				this.toast.show('导出功能需要加载SheetJS库，请刷新页面重试', 'error');
			}
			console.error('SheetJS库未加载，无法导出XLSX文件');
			return;
		}

		try {
			// 准备数据
			const headers = ['序号', '图片URL', '产品标题', '前端价格(RON)', '实际售价(RON)', '佣金', '体积重(kg)', '计费重(kg)', '头程运费(元)', '尾程费(RON)', '采购价预算(元)', '预估毛利(元)'];
			const rows = this.products.map((product, index) => {
				const priceNum = typeof product.price === 'number' ? product.price : parseFloat(product.price) || 0;
				const actualPriceNum = typeof product.actualPrice === 'number' ? product.actualPrice : parseFloat(product.actualPrice) || 0;
				const commissionNum = typeof product.commission === 'number' ? product.commission : parseFloat(product.commission) || 0;
				const volumeWeightNum = typeof product.volumeWeight === 'number' ? product.volumeWeight : parseFloat(product.volumeWeight) || 0;
				const chargeWeightNum = typeof product.chargeWeight === 'number' ? product.chargeWeight : parseFloat(product.chargeWeight) || 0;
				const freightNum = typeof product.freight === 'number' ? product.freight : parseFloat(product.freight) || 0;
				const tailFeeNum = typeof product.tailFee === 'number' ? product.tailFee : parseFloat(product.tailFee) || 0;
				const budgetPriceNum = typeof product.budgetPrice === 'number' ? product.budgetPrice : parseFloat(product.budgetPrice) || 0;
				const estimatedProfitNum = typeof product.estimatedProfit === 'number' ? product.estimatedProfit : parseFloat(product.estimatedProfit) || 0;

				return [
					index + 1, // 序号
					product.img || '', // 图片URL
					product.title || '-',
					priceNum,
					actualPriceNum,
					commissionNum,
					volumeWeightNum,
					chargeWeightNum,
					freightNum,
					tailFeeNum,
					budgetPriceNum,
					estimatedProfitNum
				];
			});

			// 创建工作簿
			const wb = XLSX.utils.book_new();
			
			// 创建工作表数据（包含表头）
			const wsData = [headers, ...rows];
			const ws = XLSX.utils.aoa_to_sheet(wsData);

			// 设置列宽（SheetJS免费版支持列宽设置）
			const colWidths = [
				{ wch: 8 },  // 序号
				{ wch: 40 }, // 图片URL
				{ wch: 30 }, // 产品标题
				{ wch: 12 }, // 前端价格
				{ wch: 12 }, // 实际售价
				{ wch: 12 }, // 佣金
				{ wch: 12 }, // 体积重
				{ wch: 12 }, // 计费重
				{ wch: 12 }, // 头程运费
				{ wch: 15 }, // 采购价预算
				{ wch: 15 }  // 预估毛利
			];
			ws['!cols'] = colWidths;

			// 注意：SheetJS免费版不支持样式设置（如字体、颜色、边框等）
			// 如需样式支持，需要使用Pro版本或使用其他库（如ExcelJS）
			// 当前版本会导出基本的数据和列宽设置，数据格式正确

			// 将工作表添加到工作簿
			XLSX.utils.book_append_sheet(wb, ws, '利润测算结果');

			// 生成文件名（包含时间戳）
			const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
			const filename = `利润测算结果_${timestamp}.xlsx`;

			// 导出文件
			XLSX.writeFile(wb, filename);

			if (this.toast) {
				this.toast.show(`已导出 ${this.products.length} 条计算结果`, 'success');
			}
		} catch (error) {
			console.error('导出XLSX文件失败:', error);
			if (this.toast) {
				this.toast.show('导出失败：' + (error.message || '未知错误'), 'error');
			}
		}
	}
}

