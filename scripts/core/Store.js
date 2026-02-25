/**
 * 简易全局状态仓库
 * 说明：避免挂载到 window，集中管理状态并暴露订阅能力
 */
export class Store{
	constructor(){
		/** @type {any[]} */ this.allData = [];
		/** @type {any[]} */ this.filteredData = [];
		/** @type {Set<number>} */ this.selectedIds = new Set();
		/** @type {{key: string|null, direction: 'asc'|'desc'}} */ this.currentSort = { key:null, direction:'asc' };
		/** @type {{search:string, priceMin:number|null, priceMax:number|null, reviewsMin:number|null, scoreMin:number|null, rateMin:number|string, profitStatus:string}} */
		this.filterState = { search:'', priceMin:null, priceMax:null, reviewsMin:null, scoreMin:null, rateMin:'0', profitStatus:'all' };
		/** @type {Array<{key:string,label:string,width:number,fixed:boolean,sortable:boolean,hidden:boolean}>} */
		this.colConfig = [];
		/** @type {Object} 分页配置（产品海选看板） */
		this.pagination = {
			currentPage: 1,        // 当前页码（从1开始）
			pageSize: 50,          // 每页条数（默认50）
			totalRecords: 0,       // 总记录数
			totalPages: 0          // 总页数
		};
		/** @type {any[]} 当前页数据（分页后的数据） */
		this.paginatedData = [];
		/** @type {any[]} 利润测算模块的产品数据 */
		this.profitData = [];
		/** @type {Object} 利润测算配置 */
		this.profitConfig = {
			targetMargin: 0.4,        // 目标毛利率（40%）
			exchangeRate: 1.5,         // 汇率
			freightUnitPrice: 17      // 头程单价（元/kg）
		};
		this.listeners = new Map();
	}
	/** 订阅状态变化 */
	subscribe(event, cb){
		if(!this.listeners.has(event)) this.listeners.set(event, new Set());
		this.listeners.get(event).add(cb);
		return ()=>this.listeners.get(event)?.delete(cb);
	}
	emit(event, payload){
		const set = this.listeners.get(event);
		if(!set) return;
		set.forEach(cb=>cb(payload));
	}
	setAllData(arr){ this.allData = arr; this.emit('allData', arr); }
	setFilteredData(arr){ 
		this.filteredData = arr; 
		// 自动更新分页信息并分页数据
		this.updatePagination();
		this.emit('filteredData', arr); 
	}
	setColConfig(cols){ this.colConfig = cols; this.emit('colConfig', cols); }
	/**
	 * 更新分页信息并计算当前页数据
	 */
	updatePagination(){
		const total = this.filteredData.length;
		const pageSize = this.pagination.pageSize;
		const totalPages = Math.max(1, Math.ceil(total / pageSize));
		
		// 确保当前页不超过总页数
		if(this.pagination.currentPage > totalPages){
			this.pagination.currentPage = totalPages;
		}
		
		this.pagination.totalRecords = total;
		this.pagination.totalPages = totalPages;
		
		// 计算当前页数据
		const start = (this.pagination.currentPage - 1) * pageSize;
		const end = start + pageSize;
		this.paginatedData = this.filteredData.slice(start, end);
		
		this.emit('pagination', this.pagination);
	}
	/**
	 * 设置当前页码
	 */
	setCurrentPage(page){
		const targetPage = Math.max(1, Math.min(page, this.pagination.totalPages));
		if(this.pagination.currentPage !== targetPage){
			this.pagination.currentPage = targetPage;
			this.updatePagination();
		}
	}
	/**
	 * 设置每页条数
	 */
	setPageSize(size){
		const validSizes = [10, 20, 50, 100, 200];
		const targetSize = validSizes.includes(size) ? size : 50;
		if(this.pagination.pageSize !== targetSize){
			this.pagination.pageSize = targetSize;
			// 重新计算当前页（保持显示范围）
			const startIndex = (this.pagination.currentPage - 1) * this.pagination.pageSize;
			this.pagination.currentPage = Math.max(1, Math.floor(startIndex / targetSize) + 1);
			this.updatePagination();
		}
	}
	updateFilterState(patch){
		this.filterState = { ...this.filterState, ...patch };
		this.emit('filterState', this.filterState);
	}
	updateSort(key, toggle=true){
		if(!key) return;
		if(toggle){
			this.currentSort = {
				key,
				direction: (this.currentSort.key === key && this.currentSort.direction === 'asc') ? 'desc' : 'asc'
			};
		}
		this.emit('sort', this.currentSort);
	}
	toggleSelection(uid, checked){
		if(checked) this.selectedIds.add(uid); else this.selectedIds.delete(uid);
		this.emit('selection', this.selectedIds);
	}
	clearSelection(){
		this.selectedIds.clear();
		this.emit('selection', this.selectedIds);
	}
	/**
	 * 设置利润测算产品数据
	 * @param {Array} products - 产品数组
	 * @param {boolean} append - 是否追加模式（默认false，替换现有数据）
	 */
	setProfitData(products, append = false){
		if (append && Array.isArray(products)) {
			// 追加模式：合并到现有数据，基于_uid去重
			// 统一使用String()转换，确保类型一致，避免类型不匹配导致的去重失败
			const existingIds = new Set(this.profitData.map(p => String(p._uid)));
			const newProducts = products.filter(p => p._uid !== undefined && !existingIds.has(String(p._uid)));
			this.profitData = [...this.profitData, ...newProducts];
		} else {
			// 替换模式：直接设置
			this.profitData = products || [];
		}
		this.emit('profitData', this.profitData);
	}
	/**
	 * 更新利润测算配置
	 * @param {Object} patch - 配置更新对象
	 */
	updateProfitConfig(patch){
		this.profitConfig = { ...this.profitConfig, ...patch };
		this.emit('profitConfig', this.profitConfig);
	}
	/**
	 * 清空利润测算产品数据
	 */
	clearProfitData(){
		this.profitData = [];
		this.emit('profitData', this.profitData);
	}
	/**
	 * 同步利润测算状态到产品数据
	 * 根据 profitData 更新 allData 中产品的 _profitStatus 字段
	 */
	syncProfitStatus(){
		// 使用字符串类型统一比较，避免类型不一致问题
		// 确保profitData中的_uid都被转换为字符串进行比较
		const profitUids = new Set();
		this.profitData.forEach(p => {
			if (p && p._uid !== undefined && p._uid !== null) {
				profitUids.add(String(p._uid));
			}
		});
		
		// 创建 UID 到行的映射，提高查找效率
		const allDataMap = new Map();
		this.allData.forEach(row => {
			if (row && row._uid !== undefined && row._uid !== null) {
				allDataMap.set(String(row._uid), row);
			}
		});
		
		// 遍历 allData，更新状态
		this.allData.forEach(row => {
			if (!row || row._uid === undefined || row._uid === null) return;
			const uid = String(row._uid);
			const currentStatus = row._profitStatus;
			
			if (profitUids.has(uid)) {
				// 在利润测算列表中，标记为 pushed
				row._profitStatus = 'pushed';
			} else if (currentStatus === 'pushed') {
				// 之前是 pushed，但现在不在列表中，标记为 deleted
				// 这表示产品从利润测算中被删除了
				row._profitStatus = 'deleted';
			} else if (currentStatus === 'deleted') {
				// 如果已经是 deleted 状态，且不在 profitData 中，保持 deleted
				// 如果重新出现在 profitData 中，会被上面的逻辑更新为 pushed
				// 这里不需要做任何操作，保持 deleted 状态
			}
			// 如果 currentStatus 是 null 或 undefined（从未推送过），保持不变
		});
		
		// 同步到 filteredData（确保状态一致）
		this.filteredData.forEach(row => {
			if (row._uid === undefined) return;
			const uid = String(row._uid);
			const allDataRow = allDataMap.get(uid);
			if (allDataRow) {
				// 直接使用 allData 中的状态，确保一致性
				row._profitStatus = allDataRow._profitStatus;
			}
		});
		
		// 重新计算分页数据
		this.updatePagination();
		
		// 显式同步到 paginatedData（确保第一个产品的状态也能正确显示）
		this.paginatedData.forEach(row => {
			if (row._uid === undefined) return;
			const uid = String(row._uid);
			const allDataRow = allDataMap.get(uid);
			if (allDataRow) {
				// 直接使用 allData 中的状态，确保一致性
				row._profitStatus = allDataRow._profitStatus;
			}
		});
		
		this.emit('profitStatusSynced');
	}
	/**
	 * 清除所有产品的推送状态
	 */
	clearProfitStatus(){
		// 清除 allData 中所有产品的状态
		this.allData.forEach(row => {
			delete row._profitStatus;
		});
		// 清除 filteredData 中所有产品的状态
		this.filteredData.forEach(row => {
			delete row._profitStatus;
		});
		// 清除 paginatedData 中所有产品的状态
		this.paginatedData.forEach(row => {
			delete row._profitStatus;
		});
		this.emit('profitStatusCleared');
	}
}


