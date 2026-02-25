/**
 * 底部选择操作栏
 */
export class SelectionBar{
	/**
	 * @param {{bar:HTMLElement,countEl:HTMLElement,clearBtn:HTMLElement}} els 
	 */
	constructor(els){
		this.els = els;
		this.isVisible = false; // 记录当前显示状态
		this.forceVisible = false; // 是否强制显示（不受count影响）
	}
	/**
	 * 更新选中数量并控制显示
	 * @param {number} count 
	 * @param {boolean} forceVisible - 是否强制显示（不受count影响），默认为false
	 */
	update(count, forceVisible = false){
		this.els.countEl.textContent = count;
		this.forceVisible = forceVisible;
		
		// 如果强制显示，或者有选中项，则显示
		if(forceVisible || count > 0) {
			this.show();
		} else {
			this.hide();
		}
	}
	/**
	 * 显示选择栏
	 */
	show(){
		if(!this.els.bar.classList.contains('active')) {
			this.els.bar.classList.add('active');
			this.isVisible = true;
		}
	}
	/**
	 * 隐藏选择栏
	 */
	hide(){
		if(this.els.bar.classList.contains('active')) {
			this.els.bar.classList.remove('active');
			this.isVisible = false;
			this.forceVisible = false;
		}
	}
	/**
	 * 根据标签页ID控制显示/隐藏
	 * @param {string} tabId - 当前标签页ID
	 * @param {number} selectionCount - 当前选中数量
	 */
	updateByTab(tabId, selectionCount){
		// 先更新数量文本（无论是否显示都要更新）
		this.els.countEl.textContent = selectionCount;
		
		if(tabId === 'tab-dashboard') {
			// 产品海选看板页：根据选择状态显示/隐藏
			if(selectionCount > 0) {
				this.show();
			} else {
				this.hide();
			}
		} else {
			// 其他页面：隐藏选择栏
			this.hide();
		}
	}
	/** 绑定清空事件 */
	onClear(cb){
		this.els.clearBtn.addEventListener('click', cb);
	}
}


