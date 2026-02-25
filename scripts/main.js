import { DEFAULT_COLUMNS, CONFIG_KEY, ROW_HEIGHT, autoDetectColumns, calculateOptimalColumnWidth } from './config/columns.js';
import { Store } from './core/Store.js';
import { FilterEngine } from './core/FilterEngine.js';
import { ExcelParser } from './core/ExcelParser.js';
import { WPSCloudParser } from './core/WPSCloudParser.js';
import { FilterBar } from './components/FilterBar.js';
import { SelectionBar } from './components/SelectionBar.js';
import { Lightbox } from './components/Lightbox.js';
import { HtmlViewer } from './components/HtmlViewer.js';
import { TableRenderer } from './components/TableRenderer.js';
import { WPSFileSelector } from './components/WPSFileSelector.js';
import { parseValue, parsePrice, parseNumber, parseStars } from './utils/parsers.js';
import { updateProgress, byId } from './utils/helpers.js';
import { ColumnSettings } from './components/ColumnSettings.js';
import { ColumnVisibility } from './components/ColumnVisibility.js';
import { Sidebar } from './components/Sidebar.js';
import { Tabs } from './components/Tabs.js';
import { Analytics } from './components/Analytics.js';
import { Pagination } from './components/Pagination.js';
import { Toast } from './components/Toast.js';
import { ProfitCalculator } from './components/ProfitCalculator.js';

// DOM
const els = {
	excelInput: byId('excelFile'),
	wpsImportBtn: byId('wpsImportBtn'),
	searchInput: byId('searchInput'),
	priceMin: byId('filterPriceMin'),
	priceMax: byId('filterPriceMax'),
	reviewsMin: byId('filterReviewsMin'),
	scoreMin: byId('filterScoreMin'),
	rateMin: byId('filterRatingMin'),
	profitStatus: byId('filterProfitStatus'),
	resetFilter: byId('resetFilterBtn'),
	columnSettingsBtn: byId('columnSettingsBtn'),
	columnVisibilityBtn: byId('columnVisibilityBtn'),
	resetLayoutBtn: byId('resetLayoutBtn'),
	resetSortBtn: byId('resetSortBtn'),
	resetImportBtn: byId('resetImportBtn'),
	colModal: byId('columnModal'),
	colList: byId('columnListContainer'),
	closeModal: byId('closeModalBtn'),
	cancelCol: byId('cancelColBtn'),
	saveCol: byId('saveColBtn'),
	visibilityModal: byId('columnVisibilityModal'),
	visibilityList: byId('columnVisibilityListContainer'),
	closeVisibilityModal: byId('closeVisibilityModalBtn'),
	cancelVisibility: byId('cancelVisibilityBtn'),
	saveVisibility: byId('saveVisibilityBtn'),
	recordCount: byId('recordCount'),
	emptyState: byId('emptyState'),
	realTableWrapper: byId('realTableWrapper'),
	virtualContainer: byId('virtualScrollContainer'),
	tableHeader: byId('tableHeader'),
	tableBody: byId('tableBody'),
	loadingState: byId('loadingState'),
	loadingText: byId('loadingText'),
	progressBar: byId('progressBar'),
	errorState: byId('errorState'),
	errorMsg: byId('errorMsg'),
	noData: byId('noData'),
	lightbox: byId('lightbox'),
	lightboxImg: byId('lightboxImg'),
	lightboxClose: document.querySelector('.lightbox-close'),
	htmlViewer: byId('htmlViewer'),
	htmlViewerContent: byId('htmlViewerContent'),
	htmlViewerClose: byId('htmlViewerClose'),
	htmlViewerTitle: byId('htmlViewerTitle'),
	selectionBar: byId('selectionBar'),
	selectionCount: byId('selectionCount'),
	clearSelectionBtn: byId('clearSelectionBtn'),
	pushToProfitBtn: byId('pushToProfitBtn'),
	paginationContainer: byId('paginationContainer')
};

// file:// 下 ES Module/Worker 会被浏览器安全策略拦截，直接给出可读提示
if (location.protocol === 'file:') {
	els.emptyState.classList.add('hidden');
	els.noData.classList.add('hidden');
	els.realTableWrapper.classList.add('hidden');
	els.loadingState.classList.add('hidden');
	els.errorMsg.textContent = '检测到使用 file:/// 方式打开页面，浏览器会拦截模块与 Worker，导致导入无响应。请运行 emag_xpkb/启动开发服务器.bat 后通过 http://127.0.0.1 打开。';
	els.errorState.classList.remove('hidden');
	throw new Error('This page must be served over http/https.');
}

// 状态/模块
const store = new Store();
const filterEngine = new FilterEngine();
const selectionBar = new SelectionBar({ bar: els.selectionBar, countEl: els.selectionCount, clearBtn: els.clearSelectionBtn });
let pagination = null;
const lightbox = new Lightbox({ overlay: els.lightbox, img: els.lightboxImg, closeBtn: els.lightboxClose });
const toast = new Toast(); // Toast提示组件
const htmlViewer = new HtmlViewer({ 
	overlay: els.htmlViewer, 
	content: els.htmlViewerContent, 
	closeBtn: els.htmlViewerClose,
	title: els.htmlViewerTitle
});
const filterBar = new FilterBar({
	search: els.searchInput,
	priceMin: els.priceMin,
	priceMax: els.priceMax,
	reviewsMin: els.reviewsMin,
	scoreMin: els.scoreMin,
	rateMin: els.rateMin,
	profitStatus: els.profitStatus,
	resetBtn: els.resetFilter,
	countEl: els.recordCount
});

const sidebar = new Sidebar({
	toggleBtn: byId('sidebarToggleBtn'),
	closeBtn: byId('sidebarCloseBtn'),
	sidebar: byId('appSidebar'),
	overlay: byId('sidebarOverlay')
});

const tabs = new Tabs({
	listContainer: byId('tabsList'),
	panelsContainer: byId('tabsPanels'),
	initialState: {
		activeTabId: 'tab-home',
		tabs: [
			{ id: 'tab-home', label: '首页', icon: 'fa-home', closable: false, route: 'home' }
			// 产品海选看板默认不加载，用户点击侧边栏导航时通过 switchByRoute 自动创建
		]
	}
});

// 利润测算模块
let profitCalculator = null;

// 数据分析模块
let analytics = null;
let analyticsCustomFilter = null;

// 初始化 Analytics 组件
function initAnalytics() {
	const dashboardPanel = byId('tabsPanels')?.querySelector('[data-panel-id="tab-dashboard"]');
	if (!dashboardPanel) return;
	
	const analyticsContainer = dashboardPanel.querySelector('[data-tab-content="tab-dashboard"]');
	if (!analyticsContainer) return;
	
	analytics = new Analytics({
		container: analyticsContainer,
		store: store,
		onFilter: (filterFn) => {
			analyticsCustomFilter = filterFn;
			applyFilters();
		}
	});
	
	// 设置进度回调函数（用于显示更新进度）
	const progressElement = analyticsContainer.querySelector('#analytics-update-progress');
	if (progressElement) {
		analytics.setProgressCallback((isUpdating) => {
			if (isUpdating) {
				progressElement.classList.remove('hidden');
			} else {
				progressElement.classList.add('hidden');
			}
		});
	}
	
	analytics.init();
}

// 监听标签切换
function handleTabSwitch(tabId) {
	if (tabId === 'tab-dashboard' && analytics) {
		analytics.updateData();
		// 切换到产品海选看板时，重新计算表格高度
		setTimeout(() => syncVirtualContainerHeight(), 100);
		// 切换到产品海选看板时，同步利润测算状态
		syncProfitStatus();
	}
	
	// 根据标签页切换，动态控制选择栏显示/隐藏
	updateSelectionBar();
}


// 清除图表筛选
function clearAnalyticsFilter() {
	if (analyticsCustomFilter) {
		analyticsCustomFilter = null;
		if (analytics) analytics.clearFilter();
		applyFilters();
	}
}

/**
 * 自适应表格高度：让数据区域自动占满可用空间，减少底部留白
 * 修复：使用 ResizeObserver 监听动态元素高度变化，确保高度计算准确
 * 优化：考虑分页组件高度，让表格和分页组件整体自适应窗口底部
 * 修复：防止滚动到底部时抖动，避免 ResizeObserver 循环触发
 */
let resizeObserver = null;
let heightUpdateTimer = null;
let isUpdatingHeight = false; // 标志位：防止高度更新过程中再次触发
let lastContainerHeight = 0; // 记录上次容器高度，用于阈值判断
let isScrolling = false; // 标志位：滚动过程中禁用高度更新
let fixedCardTop = null; // 固定的卡片顶部位置，避免页面滚动时变化

function syncVirtualContainerHeight(force = false){
	const card = byId('tableCard');
	if(!card || !els.virtualContainer) return;
	
	// 如果正在更新高度，跳过（防止循环触发）
	if(isUpdatingHeight && !force) return;
	
	// 如果正在滚动，延迟更新（防止滚动时抖动）
	if(isScrolling && !force) {
		// 延迟到滚动结束后再更新
		if(heightUpdateTimer) {
			clearTimeout(heightUpdateTimer);
		}
		heightUpdateTimer = setTimeout(() => {
			if(!isScrolling) {
				syncVirtualContainerHeight(true);
			}
		}, 300);
		return;
	}
	
	isUpdatingHeight = true;
	
	// 暂时断开 ResizeObserver，防止循环触发
	if(resizeObserver) {
		resizeObserver.disconnect();
	}
	
	const rect = card.getBoundingClientRect();
	const isSelectionBarActive = els.selectionBar?.classList.contains('active');
	const selectionBarGap = isSelectionBarActive ? (els.selectionBar.offsetHeight + 28) : 24;
	
	// 计算分页组件高度
	const paginationHeight = els.paginationContainer?.offsetHeight || 0;
	const paginationGap = paginationHeight > 0 ? paginationHeight + 16 : 0; // 16px是分页组件的margin
	
	// 计算可用高度：窗口高度 - 卡片顶部位置 - 选择栏高度 - 分页组件高度
	// 修复：使用固定的卡片顶部位置，避免页面滚动时变化
	// 只在首次计算或强制更新时更新固定位置
	if(fixedCardTop === null || force) {
		fixedCardTop = Math.max(0, rect.top);
	}
	const cardTop = fixedCardTop;
	const available = Math.max(320, Math.floor(window.innerHeight - cardTop - selectionBarGap - paginationGap));
	
	// 添加高度变化阈值：只有高度变化超过5px时才更新，避免微小变化导致频繁更新
	const heightDiff = Math.abs(available - lastContainerHeight);
	if(heightDiff < 5 && lastContainerHeight > 0 && !force) {
		// 高度变化太小，不需要更新
		isUpdatingHeight = false;
		// 重新连接 ResizeObserver
		if(resizeObserver) {
			reconnectResizeObserver();
		}
		return;
	}
	
	lastContainerHeight = available;
	els.virtualContainer.style.height = `${available}px`;
	
	// 设置卡片高度，让分页组件固定在底部
	// 修复：卡片高度 = 窗口高度 - 卡片顶部位置（固定值）- 选择栏高度，确保分页组件固定在底部
	// 使用固定的卡片顶部位置，避免页面滚动时卡片高度变化
	const cardHeight = Math.max(400, Math.floor(window.innerHeight - cardTop - selectionBarGap));
	const lastCardHeight = parseInt(card.style.height) || 0;
	
	// 添加卡片高度变化阈值：只有变化超过5px时才更新，避免微小变化导致循环
	if(Math.abs(cardHeight - lastCardHeight) >= 5 || force) {
		card.style.height = `${cardHeight}px`;
	}
	
	isUpdatingHeight = false;
	
	// 重新连接 ResizeObserver（不监听卡片本身，避免循环）
	if(resizeObserver) {
		reconnectResizeObserver();
	}
}

/**
 * 重新连接 ResizeObserver
 * 修复：不监听卡片本身，因为卡片高度是我们主动设置的，监听会导致循环触发
 */
function reconnectResizeObserver(){
	if(!resizeObserver) return;
	
	// 重新连接观察器（只监听动态变化的元素，不监听卡片本身）
	if(els.selectionBar) {
		resizeObserver.observe(els.selectionBar);
	}
	if(els.paginationContainer) {
		resizeObserver.observe(els.paginationContainer);
	}
	// 修复：移除对卡片的监听，避免循环触发
	// 卡片高度是我们主动设置的，不应该监听它
}

/**
 * 初始化高度监听器：使用 ResizeObserver 监听动态元素高度变化
 */
function initHeightObserver(){
	if(!window.ResizeObserver) {
		// 降级方案：使用 window.resize 事件
		return;
	}
	
	// 清理旧的观察器
	if(resizeObserver) {
		resizeObserver.disconnect();
	}
	
	// 创建新的观察器
	resizeObserver = new ResizeObserver((entries) => {
		// 如果正在滚动，跳过更新（防止滚动时抖动）
		if(isScrolling) return;
		
		// 防抖优化：避免频繁计算
		if(heightUpdateTimer) {
			clearTimeout(heightUpdateTimer);
		}
		heightUpdateTimer = setTimeout(() => {
			// 再次检查是否还在滚动
			if(!isScrolling) {
				syncVirtualContainerHeight();
			}
		}, 150);
	});
	
	// 监听相关元素的高度变化
	// 修复：只监听动态变化的元素（选择栏、分页组件），不监听卡片本身
	// 卡片高度是我们主动设置的，监听会导致循环触发
	if(els.selectionBar) {
		resizeObserver.observe(els.selectionBar);
	}
	if(els.paginationContainer) {
		resizeObserver.observe(els.paginationContainer);
	}
	// 移除对卡片的监听，避免循环触发
}

// 列配置持久化
function loadConfig(){
	const saved = localStorage.getItem(CONFIG_KEY);
	if(saved){
		try{
			const savedCols = JSON.parse(saved);
			// 确保所有列都有hidden字段
			savedCols.forEach(col => {
				if(col.hidden === undefined) col.hidden = false;
			});
			if(savedCols.length !== DEFAULT_COLUMNS.length || !savedCols.find(c=>c.key==='select')){
				const defaultCols = JSON.parse(JSON.stringify(DEFAULT_COLUMNS));
				defaultCols.forEach(col => { col.hidden = false; });
				store.setColConfig(defaultCols);
			}else{
				store.setColConfig(savedCols);
			}
		}catch{
			const defaultCols = JSON.parse(JSON.stringify(DEFAULT_COLUMNS));
			defaultCols.forEach(col => { col.hidden = false; });
			store.setColConfig(defaultCols);
		}
	}else{
		const defaultCols = JSON.parse(JSON.stringify(DEFAULT_COLUMNS));
		defaultCols.forEach(col => { col.hidden = false; });
		store.setColConfig(defaultCols);
	}
}
function saveConfig(cols){
	localStorage.setItem(CONFIG_KEY, JSON.stringify(cols));
	store.setColConfig(cols);
}

/**
 * 重置列的顺序（保留所有列，包括导入时新增的列）
 * 按照默认列的顺序重新排列，新增列按照Excel原始顺序排列
 */
function resetColumnOrder(){
	const currentCols = store.colConfig;
	if(!currentCols || currentCols.length === 0) return;
	
	// 创建默认列的key到索引的映射
	const defaultKeyMap = new Map();
	DEFAULT_COLUMNS.forEach((col, idx) => {
		defaultKeyMap.set(col.key, idx);
	});
	
	// 分离已知列和新增列
	const newCols = [];
	const colMap = new Map();
	
	currentCols.forEach(col => {
		colMap.set(col.key, col);
		if(!defaultKeyMap.has(col.key)){
			newCols.push(col);
		}
	});
	
	// 按照默认顺序排列已知列
	const reorderedCols = [];
	DEFAULT_COLUMNS.forEach(defaultCol => {
		const currentCol = colMap.get(defaultCol.key);
		if(currentCol){
			// 保留当前列的所有属性（width, fixed, sortable, hidden等）
			reorderedCols.push(currentCol);
		}
	});
	
	// 获取Excel原始列顺序（从allData第一行获取）
	let excelColumnOrder = [];
	if(store.allData && store.allData.length > 0){
		const firstRow = store.allData[0];
		excelColumnOrder = Object.keys(firstRow).filter(k => k !== '_uid');
	}
	
	// 按照Excel原始顺序排列新增列
	if(newCols.length > 0 && excelColumnOrder.length > 0){
		// 创建Excel列顺序的映射
		const excelOrderMap = new Map();
		excelColumnOrder.forEach((key, idx) => {
			excelOrderMap.set(key, idx);
		});
		
		// 按照Excel顺序排序新增列
		newCols.sort((a, b) => {
			const orderA = excelOrderMap.get(a.key) ?? 9999;
			const orderB = excelOrderMap.get(b.key) ?? 9999;
			return orderA - orderB;
		});
	} else if(newCols.length > 0){
		// 如果没有Excel数据，按字母顺序排列
		newCols.sort((a, b) => {
			const labelA = a.label || a.key || '';
			const labelB = b.label || b.key || '';
			return labelA.localeCompare(labelB, 'zh-CN');
		});
	}
	
	// 将新增列放在最后
	reorderedCols.push(...newCols);
	
	// 保存重新排序后的配置
	saveConfig(reorderedCols);
}

// 表格渲染器
const table = new TableRenderer(
	{ header: els.tableHeader, body: els.tableBody, container: els.virtualContainer },
	{
		getColConfig: ()=> store.colConfig,
		setColConfig: (cols)=>{ saveConfig(cols); table.renderHeaders(store.currentSort); renderVisibleRows(); },
		getSelectedIds: ()=> store.selectedIds,
		onSort: (key, toggle=true)=> handleSort(key, toggle),
		afterRender: ()=> attachLazyImageClick()
	}
);
table.initLazyImageObserver(els.virtualContainer);

// 监听搜索关键词变化，更新高亮
store.subscribe('filterState', (filterState) => {
	const newKeyword = filterState.search || '';
	// 优化：关键词变化时清除高亮缓存
	if(table.searchKeyword !== newKeyword){
		table.clearHighlightCache();
	}
	table.setSearchKeyword(newKeyword);
});

// 冻结列设置
const columnSettings = new ColumnSettings(
	{
		openBtn: els.columnSettingsBtn,
		modal: els.colModal,
		list: els.colList,
		closeBtn: els.closeModal,
		cancelBtn: els.cancelCol,
		saveBtn: els.saveCol
	},
	()=> store.colConfig.map(c=>({...c})),
	(cols)=> saveConfig(cols),
	()=> { table.renderHeaders(store.currentSort); renderVisibleRows(); }
);

// 隐藏列设置
const columnVisibility = new ColumnVisibility(
	{
		openBtn: els.columnVisibilityBtn,
		modal: els.visibilityModal,
		list: els.visibilityList,
		closeBtn: els.closeVisibilityModal,
		cancelBtn: els.cancelVisibility,
		saveBtn: els.saveVisibility
	},
	()=> store.colConfig.map(c=>({...c})),
	(cols)=> saveConfig(cols),
	()=> { table.renderHeaders(store.currentSort); renderVisibleRows(); }
);

// Excel 解析
const excel = new ExcelParser({
	onProgress: (p)=> updateProgress(els.progressBar, p),
	onLoading: (b, text)=> setLoading(b, 0, text),
	onError: (msg)=> showError(msg),
	onSuccess: (rows)=> {
		table.clearImageCache();
		store.setAllData(rows);
		
		// 自动检测Excel中的列并合并到列配置
		const currentCols = store.colConfig.length > 0 ? store.colConfig : DEFAULT_COLUMNS;
		const mergedCols = autoDetectColumns(rows, currentCols);
		
		// 自动调整列宽（根据表头文字和内容长度）
		mergedCols.forEach(col => {
			if(col.key !== 'select' && col.key !== 'img') {
				const optimalWidth = calculateOptimalColumnWidth(
					col.key,
					col.label,
					rows,
					parseValue,
					null
				);
				if(optimalWidth !== null && optimalWidth > 0) {
					col.width = Math.round(optimalWidth);
				}
			}
		});
		
		store.setColConfig(mergedCols);
		
		applyFilters();
		setTimeout(()=>{
			els.emptyState.classList.add('hidden');
			els.realTableWrapper.classList.remove('hidden');
			filterBar.setSearchEnabled(true);
			setLoading(false);
			syncVirtualContainerHeight();
			// 重新渲染表头和内容，以显示新检测到的列
			table.renderHeaders(store.currentSort);
			renderVisibleRows();
		}, 300);
	}
});

// WPS云文档解析（延迟初始化，避免影响主功能）
let wpsParser = null;
let wpsFileSelector = null;

try {
	wpsParser = new WPSCloudParser({
		onProgress: (p)=> updateProgress(els.progressBar, p),
		onLoading: (b, text)=> setLoading(b, 0, text),
		onError: (msg)=> {
			showError(msg);
			toast.error(msg);
		},
		onSuccess: (rows)=> {
			table.clearImageCache();
			store.setAllData(rows);
			
			// 自动检测列并合并到列配置
			const currentCols = store.colConfig.length > 0 ? store.colConfig : DEFAULT_COLUMNS;
			const mergedCols = autoDetectColumns(rows, currentCols);
			
			// 自动调整列宽
			mergedCols.forEach(col => {
				if(col.key !== 'select' && col.key !== 'img') {
					const optimalWidth = calculateOptimalColumnWidth(
						col.key,
						col.label,
						rows,
						parseValue,
						null
					);
					if(optimalWidth !== null && optimalWidth > 0) {
						col.width = Math.round(optimalWidth);
					}
				}
			});
			
			store.setColConfig(mergedCols);
			
			applyFilters();
			setTimeout(()=>{
				els.emptyState.classList.add('hidden');
				els.realTableWrapper.classList.remove('hidden');
				filterBar.setSearchEnabled(true);
				setLoading(false);
				syncVirtualContainerHeight();
				table.renderHeaders(store.currentSort);
				renderVisibleRows();
				toast.success(`成功从WPS导入 ${rows.length} 条数据`);
			}, 300);
		}
	});

	// WPS文件选择器
	wpsFileSelector = new WPSFileSelector({
		onSelect: async (file) => {
			try {
				const fileId = file.id || file.file_id;
				await wpsParser.importFile(fileId);
			} catch (error) {
				console.error('导入WPS文件失败:', error);
				toast.error(error.message || '导入文件失败');
			}
		},
		onClose: () => {
			// 关闭时的处理
		}
	});

	// 设置文件加载回调
	wpsFileSelector.setLoadFilesCallback(async (page, pageSize) => {
		const files = await wpsParser.getFileList(page, pageSize);
		return files;
	});
} catch (error) {
	console.warn('WPS导入功能初始化失败，功能将不可用:', error);
}

// 事件绑定
function bindEvents(){
	sidebar.init();
	lightbox.init();
	selectionBar.onClear(()=>{
		store.clearSelection();
		const headerCheck = document.getElementById('selectAllCheckbox');
		if(headerCheck){
			headerCheck.checked = false;
			headerCheck.indeterminate = false;
		}
		renderVisibleRows();
		updateSelectionBar();
	});
	
	// 推送到利润测算功能
	els.pushToProfitBtn.addEventListener('click', () => {
		pushToProfitCalculator();
	});
	
	filterBar.bind(
		(patch)=>{ 
			clearAnalyticsFilter();
			store.updateFilterState(patch); 
			applyFiltersDebounced(); 
		},
		()=>{ 
			clearAnalyticsFilter();
			store.updateFilterState({ search:'', priceMin:null, priceMax:null, reviewsMin:null, scoreMin:null, rateMin:'0', profitStatus:'all' }); 
			applyFilters(); 
		}
	);
	els.resetLayoutBtn.addEventListener('click', ()=>{
		// 重置列的顺序，保留所有列（包括导入时新增的列）
		resetColumnOrder();
		table.renderHeaders(store.currentSort);
		renderVisibleRows();
	});
	els.resetSortBtn.addEventListener('click', ()=>{
		store.currentSort = { key: null, direction: 'asc' };
		applyFilters();
	});
	els.resetImportBtn.addEventListener('click', ()=>{
		resetImport();
	});
	els.excelInput.addEventListener('change', (e)=> excel.handleFile(e.target.files[0]));
	
	// WPS导入按钮事件
	els.wpsImportBtn?.addEventListener('click', async ()=>{
		if (!wpsParser || !wpsFileSelector) {
			toast.error('WPS导入功能未初始化，请刷新页面重试');
			console.error('WPS导入功能未初始化');
			return;
		}
		try {
			// 检查是否已授权
			const isAuthorized = await wpsParser.checkAuthorization();
			
			if (!isAuthorized) {
				// 未授权，引导用户授权
				toast.info('正在跳转到WPS授权页面...');
				await wpsParser.requestAuthorization();
				toast.success('授权成功！');
			}
			
			// 显示文件选择器
			wpsFileSelector.show();
		} catch (error) {
			console.error('WPS导入失败:', error);
			toast.error(error.message || 'WPS导入失败');
		}
	});
	// 优化滚动性能：滚动时只更新DOM，滚动停止后才加载图片
	// 修复：滚动时禁用高度重新计算，防止滚动到底部时抖动
	let scrollRafId = null;
	els.virtualContainer.addEventListener('scroll', ()=>{
		// 标记正在滚动
		isScrolling = true;
		
		table.handleScrollStart();
		if (scrollRafId) {
			cancelAnimationFrame(scrollRafId);
		}
		scrollRafId = requestAnimationFrame(()=>{
			renderVisibleRows(true);
			scrollRafId = null;
		});
		table.handleScrollEnd(()=>{
			requestAnimationFrame(()=>{
				renderVisibleRows(false);
				// 滚动结束后，延迟标记滚动结束，确保所有滚动相关操作完成
				setTimeout(() => {
					isScrolling = false;
					// 滚动结束后，如果高度需要更新，延迟更新
					setTimeout(() => {
						if(!isScrolling) {
							syncVirtualContainerHeight(true);
						}
					}, 200);
				}, 100);
			});
		});
	}, { passive: true });
	els.tableBody.addEventListener('change', (e)=>{
		if(e.target.classList.contains('row-checkbox')){
			const uid = parseInt(e.target.getAttribute('data-uid'));
			store.toggleSelection(uid, e.target.checked);
			updateSelectionBar();
			updateSelectAllState();
		}
	});
	els.tableBody.addEventListener('click', (e)=>{
		if(e.target.tagName === 'IMG' && (e.target.classList.contains('lazy-img') || e.target.style.cursor === 'zoom-in')){
			const src = e.target.src || e.target.getAttribute('data-src');
			if(src) lightbox.show(src);
		}
		// 处理复制按钮点击
		if(e.target.classList.contains('copy-btn') || e.target.closest('.copy-btn')){
			const btn = e.target.classList.contains('copy-btn') ? e.target : e.target.closest('.copy-btn');
			const cell = btn.closest('.copyable-cell');
			if(cell){
				const copyText = cell.getAttribute('data-copy-text');
				if(copyText && copyText !== '-'){
					// 解码HTML实体
					const decodedText = copyText
						.replace(/&quot;/g, '"')
						.replace(/&#39;/g, "'")
						.replace(/&lt;/g, '<')
						.replace(/&gt;/g, '>')
						.replace(/&amp;/g, '&');
					
					// 复制到剪贴板
					navigator.clipboard.writeText(decodedText).then(() => {
						// 显示复制成功反馈
						// 优化：使用Toast提示替代视觉反馈
						toast.success('复制成功');
						const icon = btn.querySelector('i');
						if(icon){
							const originalClass = icon.className;
							icon.className = 'fas fa-check';
							btn.style.background = 'rgba(34, 197, 94, 0.2)';
							btn.style.borderColor = 'rgba(34, 197, 94, 0.4)';
							btn.style.color = '#22c55e';
							setTimeout(() => {
								icon.className = originalClass;
								btn.style.background = '';
								btn.style.borderColor = '';
								btn.style.color = '';
							}, 1000);
						}
					}).catch(err => {
						console.error('复制失败:', err);
						toast.error('复制失败，请手动复制');
						// 降级方案：使用传统方法
						const textArea = document.createElement('textarea');
						textArea.value = decodedText;
						textArea.style.position = 'fixed';
						textArea.style.opacity = '0';
						document.body.appendChild(textArea);
						textArea.select();
						try {
							document.execCommand('copy');
							const icon = btn.querySelector('i');
							if(icon){
								const originalClass = icon.className;
								icon.className = 'fas fa-check';
								btn.style.background = 'rgba(34, 197, 94, 0.2)';
								btn.style.borderColor = 'rgba(34, 197, 94, 0.4)';
								btn.style.color = '#22c55e';
								setTimeout(() => {
									icon.className = originalClass;
									btn.style.background = '';
									btn.style.borderColor = '';
									btn.style.color = '';
								}, 1000);
							}
						} catch (err) {
							console.error('降级复制也失败:', err);
							toast.error('复制失败，请手动复制');
						}
						document.body.removeChild(textArea);
					});
				}
			}
			e.preventDefault();
			e.stopPropagation();
			return;
		}
		// 处理"点击查看"按钮（详情描述和规格详情）
		if(e.target.classList.contains('html-view-btn') || e.target.closest('.html-view-btn')){
			const btn = e.target.classList.contains('html-view-btn') ? e.target : e.target.closest('.html-view-btn');
			const columnName = btn.getAttribute('data-column');
			const htmlContent = btn.getAttribute('data-content');
			if(htmlContent && htmlContent !== '' && htmlContent !== '-') {
				// 解码HTML实体
				const decodedContent = htmlContent
					.replace(/&quot;/g, '"')
					.replace(/&#39;/g, "'")
					.replace(/&lt;/g, '<')
					.replace(/&gt;/g, '>')
					.replace(/&amp;/g, '&');
				htmlViewer.show(decodedContent, columnName);
			}
		}
	});
	
	// 鼠标拖动选择
	let isDragSelecting = false;
	let dragStartRowIndex = -1;
	let dragStartX = 0;
	let dragStartY = 0;
	let dragSelectedRows = new Set();
	let originalSelection = new Set();
	
	/** 获取鼠标位置对应的行索引 */
	function getRowIndexFromMouse(e, container){
		const element = document.elementFromPoint(e.clientX, e.clientY);
		if(!element) return -1;
		
		const row = element.closest('tr[data-row-index]');
		if(!row || row.style.pointerEvents === 'none') return -1;
		
		const rowIndex = parseInt(row.getAttribute('data-row-index'));
		// 使用分页后的数据长度检查（因为data-row-index是基于paginatedData的）
		if(isNaN(rowIndex) || rowIndex < 0 || rowIndex >= store.paginatedData.length) return -1;
		
		return rowIndex;
	}
	
	els.tableBody.addEventListener('mousedown', (e)=>{
		if(e.button !== 0) return;
		
		const checkbox = e.target.closest('input[type="checkbox"]');
		if(checkbox && checkbox.classList.contains('row-checkbox')){
			return;
		}
		
		// 检查是否在复选框列（select列）中
		const td = e.target.closest('td[data-key="select"]');
		if(!td){
			// 不在复选框列中，不进行拖动选择，允许用户正常选择文本
			return;
		}
		
		const rowIndex = getRowIndexFromMouse(e, els.tableBody);
		if(rowIndex < 0) return;
		
		const isCtrlOrShift = e.ctrlKey || e.shiftKey;
		dragStartRowIndex = rowIndex;
		dragStartX = e.clientX;
		dragStartY = e.clientY;
		dragSelectedRows.clear();
		originalSelection = new Set(store.selectedIds);
		
		const onMove = (moveEvent)=>{
			const deltaX = Math.abs(moveEvent.clientX - dragStartX);
			const deltaY = Math.abs(moveEvent.clientY - dragStartY);
			
			if(!isDragSelecting && (deltaX > 5 || deltaY > 5)){
				// 检查拖动开始时是否在复选框列中
				const startTd = document.elementFromPoint(dragStartX, dragStartY)?.closest('td[data-key="select"]');
				if(!startTd){
					// 拖动开始时不在复选框列，取消拖动选择
					document.removeEventListener('mousemove', onMove);
					document.removeEventListener('mouseup', onUp);
					return;
				}
				isDragSelecting = true;
				document.body.style.userSelect = 'none';
			}
			
			if(!isDragSelecting) return;
			
			// 检查当前鼠标位置是否在复选框列中
			const currentTd = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)?.closest('td[data-key="select"]');
			if(!currentTd){
				// 鼠标移出复选框列，停止拖动选择但不清除已选择的内容
				return;
			}
			
			const currentRowIndex = getRowIndexFromMouse(moveEvent, els.tableBody);
			if(currentRowIndex < 0) return;
			
			// 修复：限制拖动选择在当前页内，防止跨页选择错误
			const maxRowIndex = store.paginatedData.length - 1;
			const startIdx = Math.max(0, Math.min(dragStartRowIndex, currentRowIndex, maxRowIndex));
			const endIdx = Math.min(maxRowIndex, Math.max(dragStartRowIndex, currentRowIndex, 0));
			
			dragSelectedRows.clear();
			// 使用分页后的数据（paginatedData）进行拖动选择，限制在当前页内
			for(let i = startIdx; i <= endIdx; i++){
				const row = store.paginatedData[i];
				if(row && row._uid !== undefined){
					dragSelectedRows.add(row._uid);
				}
			}
			
			if(isCtrlOrShift){
				store.selectedIds = new Set(originalSelection);
				dragSelectedRows.forEach(uid => store.selectedIds.add(uid));
			}else{
				store.selectedIds = new Set(originalSelection);
				dragSelectedRows.forEach(uid => store.selectedIds.add(uid));
			}
			
			renderVisibleRows();
			updateSelectionBar();
			updateSelectAllState();
		};
		
		const onUp = ()=>{
			isDragSelecting = false;
			dragStartRowIndex = -1;
			dragStartX = 0;
			dragStartY = 0;
			dragSelectedRows.clear();
			originalSelection.clear();
			document.body.style.userSelect = '';
			document.removeEventListener('mousemove', onMove);
			document.removeEventListener('mouseup', onUp);
		};
		
		document.addEventListener('mousemove', onMove);
		document.addEventListener('mouseup', onUp);
	});
	els.tableHeader.addEventListener('change', (e)=>{
		if(e.target.id === 'selectAllCheckbox'){
			const isChecked = e.target.checked;
			if(isChecked){
				// 修复：使用 paginatedData（当前页数据）而非 filteredData（所有筛选数据）
				store.paginatedData.forEach(row=> store.selectedIds.add(row._uid));
			}else{
				// 修复：只清除当前页的选择，保留其他页的选择
				store.paginatedData.forEach(row=> store.selectedIds.delete(row._uid));
			}
			store.emit('selection', store.selectedIds);
			renderVisibleRows();
			updateSelectionBar();
			updateSelectAllState();
		}
	});
	columnSettings.init();
	columnVisibility.init();
	window.addEventListener('resize', ()=>{
		// 窗口resize时重置固定位置并强制更新高度
		fixedCardTop = null; // 重置固定位置，重新计算
		syncVirtualContainerHeight(true);
		table.renderHeaders(store.currentSort);
		renderVisibleRows();
	});
}

// 过滤与渲染
const applyFiltersDebounced = ((fn)=> fn)(()=> applyFilters());
function applyFilters(){
	let filtered = filterEngine.apply(store.allData, store.filterState);
	
	// 应用图表自定义筛选
	if(analyticsCustomFilter){
		filtered = filtered.filter(analyticsCustomFilter);
	}
	
	// 筛选后重置到第一页
	store.pagination.currentPage = 1;
	store.setFilteredData(filtered);
	
	if(store.currentSort.key) handleSort(store.currentSort.key, false);
	els.virtualContainer.scrollTop = 0;
	filterBar.updateCount(filtered.length);
	updateSelectAllState();
	renderVisibleRows();
	els.noData.classList.toggle('hidden', filtered.length > 0);
	
	// 优化：添加筛选结果提示
	if(filtered.length === 0 && store.allData.length > 0){
		toast.warning('未找到匹配的数据');
	} else if(filtered.length < store.allData.length && filtered.length > 0){
		toast.info(`筛选结果：${filtered.length} 条数据`);
	}
	
	// 更新数据分析图表（仅在 analytics 标签页激活时）
	if(analytics && tabs.state.activeTabId === 'tab-analytics'){
		analytics.updateData();
	}
}
function renderVisibleRows(skipImageLoad = false){
	// 使用分页后的数据（paginatedData）而不是全部数据（filteredData）
	table.renderVisibleRows(store.paginatedData, store.colConfig, skipImageLoad);
}

/**
 * 同步利润测算状态到产品数据
 * 切换回产品海选看板时调用，更新产品的推送状态
 */
function syncProfitStatus(){
	store.syncProfitStatus();
	// 重新渲染表格，显示状态标识
	// 使用 setTimeout 确保状态同步完成后再渲染
	setTimeout(() => {
		renderVisibleRows();
	}, 0);
}


function attachLazyImageClick(){
	// 已在 tableBody 上绑定
}

/**
 * 排序处理
 * 优化：大数据量时使用异步排序，添加进度提示
 */
function handleSort(key, toggle=true){
	if(!key) return;
	if(toggle){
		store.updateSort(key, true);
	}else{
		store.updateSort(key, false);
	}
	
	const dataLength = store.filteredData.length;
	const isLargeData = dataLength > 5000; // 超过5000条使用异步排序
	
	// 优化：大数据量时使用异步排序，避免阻塞UI
	if(isLargeData){
		// 显示排序提示
		toast.info(`正在排序 ${dataLength} 条数据...`, 'info', 2000);
		
		// 使用 requestIdleCallback 异步排序
		const executeSort = () => {
			store.filteredData.sort((a, b)=>{
				let vA = parseValue(a, key), vB = parseValue(b, key);
				if(['prp','price'].includes(key)){ vA = parsePrice(vA); vB = parsePrice(vB); }
				else if(['discount','rating','reviews','score'].includes(key)){ vA = parseNumber(vA); vB = parseNumber(vB); }
				else { vA = String(vA||'').toLowerCase(); vB = String(vB||'').toLowerCase(); }
				return (vA < vB ? -1 : 1) * (store.currentSort.direction === 'asc' ? 1 : -1);
			});
			// 排序后更新分页数据
			store.updatePagination();
			if(toggle){
				table.renderHeaders(store.currentSort);
				els.virtualContainer.scrollTop = 0;
				renderVisibleRows();
			}
			toast.success('排序完成');
		};
		
		if(window.requestIdleCallback){
			window.requestIdleCallback(executeSort, { timeout: 1000 });
		} else {
			setTimeout(executeSort, 0);
		}
	} else {
		// 小数据量直接排序
		store.filteredData.sort((a, b)=>{
			let vA = parseValue(a, key), vB = parseValue(b, key);
			if(['prp','price'].includes(key)){ vA = parsePrice(vA); vB = parsePrice(vB); }
			else if(['discount','rating','reviews','score'].includes(key)){ vA = parseNumber(vA); vB = parseNumber(vB); }
			else { vA = String(vA||'').toLowerCase(); vB = String(vB||'').toLowerCase(); }
			return (vA < vB ? -1 : 1) * (store.currentSort.direction === 'asc' ? 1 : -1);
		});
		// 排序后更新分页数据
		store.updatePagination();
		if(toggle){
			table.renderHeaders(store.currentSort);
			els.virtualContainer.scrollTop = 0;
			renderVisibleRows();
		}
	}
}

// 选择栏与全选状态
function updateSelectionBar(){
	const currentTabId = tabs.state.activeTabId;
	const selectionCount = store.selectedIds.size;
	
	// 根据当前标签页动态控制显示/隐藏
	selectionBar.updateByTab(currentTabId, selectionCount);
	syncVirtualContainerHeight();
}
/**
 * 更新全选复选框状态
 * 修复：检查当前页（paginatedData）的选择状态，而非所有筛选数据
 */
function updateSelectAllState(){
	const headerCheck = document.getElementById('selectAllCheckbox');
	if(!headerCheck || store.paginatedData.length === 0){
		if(headerCheck){
			headerCheck.checked = false;
			headerCheck.indeterminate = false;
		}
		return;
	}
	// 修复：检查当前页的所有数据是否都被选中
	const currentPageSelected = store.paginatedData.filter(row=> store.selectedIds.has(row._uid)).length;
	const allSelected = currentPageSelected === store.paginatedData.length && currentPageSelected > 0;
	const someSelected = currentPageSelected > 0 && currentPageSelected < store.paginatedData.length;
	
	headerCheck.checked = allSelected;
	headerCheck.indeterminate = someSelected;
}

/**
 * 推送到利润测算模块
 * 获取选中产品的完整数据，验证后推送到利润测算模块
 */
function pushToProfitCalculator() {
	try {
		if (store.selectedIds.size === 0) {
			toast.show('请先选择要推送的产品', 'warning');
			return;
		}

		// 从filteredData中获取选中产品的完整数据（包含所有字段）
		// 使用数字类型统一比较，因为 _uid 是数字类型（索引）
		const selectedProducts = store.filteredData.filter(row => {
			if (!row || row._uid === undefined) return false;
			// 统一转换为数字类型进行比较
			const uid = typeof row._uid === 'number' ? row._uid : parseInt(row._uid);
			return store.selectedIds.has(uid);
		});
		
		if (selectedProducts.length === 0) {
			toast.show('未找到选中的产品数据', 'error');
			return;
		}

		// 数据验证：检查必要字段
		const validProducts = [];
		const invalidProducts = [];
		
		selectedProducts.forEach(product => {
		// 获取前端价格（支持多种字段名：price、前端价格）
		let frontPrice = product.price;
		if (frontPrice === undefined || frontPrice === null || frontPrice === '') {
			frontPrice = product['前端价格'];
		}
		
		// 验证前端价格字段（必需）
		if (frontPrice === undefined || frontPrice === null || frontPrice === '') {
			invalidProducts.push({
				title: product.title || product['产品标题'] || '未知产品',
				reason: '缺少前端价格字段'
			});
			return;
		}

		// 解析价格为数字类型（使用parsePrice函数处理各种格式）
		const parsedPrice = parsePrice(frontPrice);
		if (parsedPrice === -999 || parsedPrice <= 0) {
			invalidProducts.push({
				title: product.title || product['产品标题'] || '未知产品',
				reason: '前端价格格式无效'
			});
			return;
		}

		// 标准化产品数据：将中文字段名映射为key，并确保类型正确
		// 重要：必须保留原始的_uid，确保与allData中的_uid一致，用于状态同步
		const normalizedProduct = {
			...product,
			_uid: product._uid, // 明确保留原始_uid，确保类型和值一致
			price: parsedPrice, // 统一使用price字段，确保是数字类型
			title: product.title || product['产品标题'] || '-',
			img: product.img || product['产品图片'] || '',
			pnk: String(product.pnk || product['PNK码'] || '').trim(), // PNK码
			link: String(product.link || product['产品链接'] || '').trim(), // 产品链接
			length: parseNumber(product.length || product['长'] || product['长度'] || 0),
			width: parseNumber(product.width || product['宽'] || product['宽度'] || 0),
			height: parseNumber(product.height || product['高'] || product['高度'] || 0),
			weight: parseNumber(product.weight || product['重量'] || product['实重'] || 0),
			// 新增：尾程操作费和仓储费，默认值为0
			tailOperationFee: parseNumber(product.tailOperationFee) >= 0 
				? parseNumber(product.tailOperationFee) 
				: 0,
			storageFee: parseNumber(product.storageFee) >= 0 
				? parseNumber(product.storageFee) 
				: 0
		};

		// 确保尺寸重量字段为有效数字（parseNumber返回-999表示无效，需要设为0）
		if (normalizedProduct.length < 0) normalizedProduct.length = 0;
		if (normalizedProduct.width < 0) normalizedProduct.width = 0;
		if (normalizedProduct.height < 0) normalizedProduct.height = 0;
		if (normalizedProduct.weight < 0) normalizedProduct.weight = 0;

		// 确保有_uid（用于去重和状态同步）
		// 如果原始product没有_uid，生成一个唯一ID（这种情况不应该发生，因为Excel导入时已经设置了_uid）
		if (normalizedProduct._uid === undefined || normalizedProduct._uid === null) {
			console.warn('产品缺少_uid，生成临时ID:', product.title || product['产品标题']);
			normalizedProduct._uid = Date.now() + Math.random(); // 临时生成唯一ID
		}

		validProducts.push(normalizedProduct);
	});

	// 如果有无效产品，显示警告
	if (invalidProducts.length > 0) {
		const invalidCount = invalidProducts.length;
		const invalidTitles = invalidProducts.slice(0, 3).map(p => p.title).join('、');
		const message = invalidCount > 3 
			? `${invalidCount}个产品因缺少前端价格字段被跳过（如：${invalidTitles}...）`
			: `${invalidCount}个产品因缺少前端价格字段被跳过（如：${invalidTitles}）`;
		toast.show(message, 'warning');
	}

	if (validProducts.length === 0) {
		toast.show('没有有效的产品可以推送', 'error');
		return;
	}

	// 推送到Store（追加模式，会自动触发profitData事件）
	store.setProfitData(validProducts, true);

		// 推送成功后，标记产品为 'pushed'
		// 使用 selectedIds 在 allData 中直接查找并标记，确保第一个产品也能正确标记
		// 因为 selectedIds 中存储的是数字类型的 _uid（通过 parseInt 转换）
		store.allData.forEach(row => {
			if (row && row._uid !== undefined) {
				// 统一转换为数字类型进行比较
				const uid = typeof row._uid === 'number' ? row._uid : parseInt(row._uid);
				if (store.selectedIds.has(uid)) {
					row._profitStatus = 'pushed';
				}
			}
		});
		
		// 同步到 filteredData（对象引用应该和 allData 中的是同一个，但为了确保，也标记一次）
		store.filteredData.forEach(row => {
			if (row && row._uid !== undefined) {
				const uid = typeof row._uid === 'number' ? row._uid : parseInt(row._uid);
				if (store.selectedIds.has(uid)) {
					row._profitStatus = 'pushed';
				}
			}
		});
		
		// 重新计算分页数据，确保 paginatedData 中的状态是最新的
		store.updatePagination();
		
		// 同步到 paginatedData（确保状态正确）
		store.paginatedData.forEach(row => {
			if (row && row._uid !== undefined) {
				const uid = typeof row._uid === 'number' ? row._uid : parseInt(row._uid);
				if (store.selectedIds.has(uid)) {
					row._profitStatus = 'pushed';
				}
			}
		});
		
		// 强制重新渲染表格，确保状态图标显示
		renderVisibleRows();

		// 切换到利润测算标签页
		tabs.switchByRoute('profit-calculator');

		// 显示成功提示
		toast.show(`成功推送 ${validProducts.length} 个产品到利润测算`, 'success');
	} catch (error) {
		console.error('推送到利润测算失败:', error);
		toast.show('推送失败：' + (error.message || '未知错误'), 'error');
	}
}

// 状态辅助
function resetState(){
	store.setAllData([]);
	store.setFilteredData([]);
	store.clearSelection();
	els.tableBody.innerHTML = '';
	table.clearImageCache();
	els.errorState.classList.add('hidden');
	els.noData.classList.add('hidden');
	els.progressBar.style.width = '0%';
	updateSelectionBar();
}

/**
 * 重置导入：清除所有数据和配置，返回到初始状态
 */
function resetImport(){
	// 清除所有数据
	store.setAllData([]);
	store.setFilteredData([]);
	store.clearSelection();
	
	// 清除列配置（重置为默认配置）
	store.setColConfig([]);
	localStorage.removeItem(CONFIG_KEY);
	
	// 清除排序状态
	store.currentSort = { key: null, direction: 'asc' };
	
	// 清除筛选状态
	store.updateFilterState({ 
		search: '', 
		priceMin: null, 
		priceMax: null, 
		reviewsMin: null, 
		scoreMin: null, 
		rateMin: '0',
		profitStatus: 'all' 
	});
	
	// 清除所有产品的推送状态
	store.clearProfitStatus();
	
	// 清除筛选输入框
	els.searchInput.value = '';
	els.priceMin.value = '';
	els.priceMax.value = '';
	els.reviewsMin.value = '';
	els.scoreMin.value = '';
	els.rateMin.value = '0';
	els.profitStatus.value = 'all'; // 重置推送状态筛选
	
	// 清除表格内容
	els.tableHeader.innerHTML = '';
	els.tableBody.innerHTML = '';
	table.clearImageCache();
	
	// 清除Analytics数据
	if(analytics) {
		analytics.clearData();
		analytics.resetPriceRange();
	}
	
	// 清除文件输入
	els.excelInput.value = '';
	
	// 更新UI状态
	els.errorState.classList.add('hidden');
	els.noData.classList.add('hidden');
	els.loadingState.classList.add('hidden');
	els.realTableWrapper.classList.add('hidden');
	els.emptyState.classList.remove('hidden');
	els.progressBar.style.width = '0%';
	
	// 禁用搜索框
	filterBar.setSearchEnabled(false);
	
	// 更新记录数
	filterBar.updateCount(0);
	
	// 更新选择栏
	updateSelectionBar();
}
function setLoading(b, p, t){
	els.loadingState.classList.toggle('hidden', !b);
	if(b && typeof p === 'number') updateProgress(els.progressBar, p);
	if(t) els.loadingText.textContent = t;
}
function showError(m){
	els.errorMsg.textContent = m;
	els.errorState.classList.remove('hidden');
	els.emptyState.classList.add('hidden');
}

// 处理WPS OAuth回调
function handleWPSAuthCallback() {
	if (!wpsParser || !wpsFileSelector) {
		return; // WPS功能未初始化，跳过回调处理
	}
	
	const urlParams = new URLSearchParams(window.location.search);
	const token = urlParams.get('token');
	const refreshToken = urlParams.get('refresh_token');
	const expiresIn = urlParams.get('expires_in');
	const error = urlParams.get('error');

	if (error) {
		toast.error(`WPS授权失败: ${error}`);
		// 清除URL参数
		window.history.replaceState({}, document.title, window.location.pathname);
		return;
	}

	if (token && refreshToken && expiresIn) {
		// 保存token
		if (wpsParser) {
			wpsParser.saveToken(token, refreshToken, parseInt(expiresIn));
			toast.success('WPS授权成功！');
			
			// 清除URL参数
			window.history.replaceState({}, document.title, window.location.pathname);
			
			// 自动打开文件选择器
			setTimeout(() => {
				if (wpsFileSelector) {
					wpsFileSelector.show();
				}
			}, 500);
		}
	}
}

// 监听postMessage事件（从授权成功页面发送的消息）
window.addEventListener('message', (e) => {
	// 安全检查：允许来自localhost和127.0.0.1的消息
	const allowedOrigins = [
		window.location.origin,
		'http://localhost:8080',
		'http://127.0.0.1:8080',
		'http://localhost:5173',
		'http://127.0.0.1:5173'
	];
	
	const originHost = e.origin.replace(/^https?:\/\//, '').split(':')[0];
	const currentHost = window.location.hostname;
	
	if (!allowedOrigins.some(allowed => {
		const allowedHost = allowed.replace(/^https?:\/\//, '').split(':')[0];
		return originHost === allowedHost || originHost === currentHost;
	})) {
		return;
	}
	
	if (e.data && e.data.type === 'WPS_AUTH_SUCCESS' && wpsParser) {
		const { tokenData } = e.data;
		if (tokenData) {
			wpsParser.saveToken(
				tokenData.access_token,
				tokenData.refresh_token,
				Math.floor((tokenData.expires_at - Date.now()) / 1000)
			);
			toast.success('WPS授权成功！');
			
			// 自动打开文件选择器
			setTimeout(() => {
				if (wpsFileSelector) {
					wpsFileSelector.show();
				}
			}, 500);
		}
	}
});

// 启动
(function bootstrap(){
	loadConfig();
	excel.initWorker();
	table.renderHeaders(store.currentSort);
	filterBar.setSearchEnabled(false);
	bindEvents();
	tabs.init();
	
	// 初始化HTML查看器
	htmlViewer.init();
	
	// 处理WPS OAuth回调
	handleWPSAuthCallback();
	
	// 初始化分页组件
	if (els.paginationContainer) {
		pagination = new Pagination(els.paginationContainer, store, () => {
			// 页码变化时重新渲染表格
			renderVisibleRows();
			updateSelectAllState();
		});
	}
	
	// 初始化数据分析模块
	initAnalytics();
	
	// 初始化高度监听器（修复：使用 ResizeObserver 监听动态元素高度变化）
	initHeightObserver();
	
	// 监听标签切换事件
	tabs.on('tabSwitch', (tabId) => {
		handleTabSwitch(tabId);
	});
	
	// 监听选择状态变化，更新选择栏
	store.subscribe('selection', () => {
		updateSelectionBar();
	});
	
	// 监听数据变化，更新分析图表
	store.subscribe('filteredData', () => {
		if (tabs.state.activeTabId === 'tab-dashboard' && analytics) {
			analytics.updateData();
		}
	});
	
	// 监听分页变化，更新表格显示
	// 优化：分页切换时保持滚动位置到顶部，优化渲染性能
	store.subscribe('pagination', () => {
		if (tabs.state.activeTabId === 'tab-dashboard') {
			// 优化：分页切换时重置滚动位置，避免显示错误内容
			els.virtualContainer.scrollTop = 0;
			// 使用 requestAnimationFrame 优化渲染时机
			requestAnimationFrame(() => {
				renderVisibleRows();
				updateSelectAllState();
				updateSelectionBar(); // 确保选择栏数量正确
				// 分页变化后重新计算高度（强制更新）
				setTimeout(() => syncVirtualContainerHeight(true), 0);
			});
		}
	});
	
	// 初始化利润测算组件
	const profitCalculatorContainer = byId('profitCalculatorContainer');
	if (profitCalculatorContainer) {
		profitCalculator = new ProfitCalculator(profitCalculatorContainer, store, toast, lightbox);
		profitCalculator.init();
	}

	syncVirtualContainerHeight();
})();


