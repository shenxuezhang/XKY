/**
 * 分页组件
 * 功能：显示分页信息、页码导航、每页条数选择
 */
export class Pagination {
	/**
	 * @param {HTMLElement} container - 分页容器元素
	 * @param {Object} store - Store实例
	 * @param {Function} onPageChange - 页码变化回调
	 */
	constructor(container, store, onPageChange) {
		this.container = container;
		this.store = store;
		this.onPageChange = onPageChange;
		this.init();
	}
	
	/**
	 * 初始化组件
	 */
	init() {
		this.render();
		this.bindEvents();
		
		// 订阅分页状态变化
		this.store.subscribe('pagination', () => {
			this.render();
		});
	}
	
	/**
	 * 渲染分页组件
	 */
	render() {
		const { currentPage, pageSize, totalRecords, totalPages } = this.store.pagination;
		
		if (totalRecords === 0) {
			this.container.innerHTML = '';
			return;
		}
		
		// 计算显示范围
		const start = (currentPage - 1) * pageSize + 1;
		const end = Math.min(currentPage * pageSize, totalRecords);
		
		// 计算页码按钮范围（显示当前页前后各2页）
		const maxButtons = 5;
		let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
		let endPage = Math.min(totalPages, startPage + maxButtons - 1);
		
		// 调整起始页
		if (endPage - startPage < maxButtons - 1) {
			startPage = Math.max(1, endPage - maxButtons + 1);
		}
		
		// 生成页码按钮HTML
		let pageButtons = '';
		if (startPage > 1) {
			pageButtons += `<button class="pagination-btn" data-page="1">1</button>`;
			if (startPage > 2) {
				pageButtons += `<span class="pagination-ellipsis">...</span>`;
			}
		}
		
		for (let i = startPage; i <= endPage; i++) {
			const isActive = i === currentPage;
			pageButtons += `<button class="pagination-btn ${isActive ? 'active' : ''}" data-page="${i}">${i}</button>`;
		}
		
		if (endPage < totalPages) {
			if (endPage < totalPages - 1) {
				pageButtons += `<span class="pagination-ellipsis">...</span>`;
			}
			pageButtons += `<button class="pagination-btn" data-page="${totalPages}">${totalPages}</button>`;
		}
		
		this.container.innerHTML = `
			<div class="pagination-container">
				<div class="pagination-info">
					<span class="text-sm text-gray-600">
						显示 <strong>${start}</strong> - <strong>${end}</strong> 条，共 <strong>${totalRecords}</strong> 条
					</span>
				</div>
				
				<div class="pagination-controls">
					<button class="pagination-btn" data-action="prev" ${currentPage === 1 ? 'disabled' : ''}>
						<i class="fas fa-chevron-left"></i>
					</button>
					
					<div class="pagination-pages">
						${pageButtons}
					</div>
					
					<button class="pagination-btn" data-action="next" ${currentPage === totalPages ? 'disabled' : ''}>
						<i class="fas fa-chevron-right"></i>
					</button>
				</div>
				
				<div class="pagination-size">
					<label class="text-sm text-gray-600 mr-2">每页显示：</label>
					<select class="pagination-select" data-action="change-size">
						<option value="10" ${pageSize === 10 ? 'selected' : ''}>10</option>
						<option value="20" ${pageSize === 20 ? 'selected' : ''}>20</option>
						<option value="50" ${pageSize === 50 ? 'selected' : ''}>50</option>
						<option value="100" ${pageSize === 100 ? 'selected' : ''}>100</option>
						<option value="200" ${pageSize === 200 ? 'selected' : ''}>200</option>
					</select>
				</div>
			</div>
		`;
	}
	
	/**
	 * 绑定事件
	 */
	bindEvents() {
		this.container.addEventListener('click', (e) => {
			const btn = e.target.closest('.pagination-btn');
			if (!btn || btn.disabled) return;
			
			const action = btn.getAttribute('data-action');
			const page = btn.getAttribute('data-page');
			
			if (action === 'prev') {
				this.goToPage(this.store.pagination.currentPage - 1);
			} else if (action === 'next') {
				this.goToPage(this.store.pagination.currentPage + 1);
			} else if (page) {
				this.goToPage(parseInt(page));
			}
		});
		
		this.container.addEventListener('change', (e) => {
			if (e.target.getAttribute('data-action') === 'change-size') {
				const newSize = parseInt(e.target.value);
				this.store.setPageSize(newSize);
				if (this.onPageChange) {
					this.onPageChange();
				}
			}
		});
	}
	
	/**
	 * 跳转到指定页
	 */
	goToPage(page) {
		if (page < 1 || page > this.store.pagination.totalPages) return;
		
		this.store.setCurrentPage(page);
		
		// 滚动到表格顶部
		const tableContainer = document.getElementById('virtualScrollContainer');
		if (tableContainer) {
			tableContainer.scrollTop = 0;
		}
		
		if (this.onPageChange) {
			this.onPageChange();
		}
	}
}

