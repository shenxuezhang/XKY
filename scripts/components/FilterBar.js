import { debounce } from '../utils/helpers.js';

/**
 * 顶部筛选栏
 */
export class FilterBar{
	/**
	 * @param {{search:HTMLInputElement,priceMin:HTMLInputElement,priceMax:HTMLInputElement,reviewsMin:HTMLInputElement,scoreMin:HTMLInputElement,rateMin:HTMLSelectElement,profitStatus:HTMLSelectElement,resetBtn:HTMLButtonElement,countEl:HTMLElement}} els 
	 */
	constructor(els){
		this.els = els;
	}
	/**
	 * 绑定筛选事件
	 * @param {(patch:any)=>void} onChange 
	 * @param {()=>void} onReset 
	 */
	bind(onChange, onReset){
		const debounced = debounce(onChange, 300);
		this.els.search.addEventListener('input', (e)=> debounced({ search: e.target.value }));
		this.els.priceMin.addEventListener('input', (e)=> debounced({ priceMin: e.target.value }));
		this.els.priceMax.addEventListener('input', (e)=> debounced({ priceMax: e.target.value }));
		this.els.reviewsMin.addEventListener('input', (e)=> debounced({ reviewsMin: e.target.value }));
		this.els.scoreMin.addEventListener('input', (e)=> debounced({ scoreMin: e.target.value }));
		this.els.rateMin.addEventListener('change', (e)=> onChange({ rateMin: e.target.value }));
		this.els.profitStatus.addEventListener('change', (e)=> onChange({ profitStatus: e.target.value }));
		this.els.resetBtn.addEventListener('click', ()=>{
			this.els.search.value = '';
			this.els.priceMin.value = '';
			this.els.priceMax.value = '';
			this.els.reviewsMin.value = '';
			this.els.scoreMin.value = '';
			this.els.rateMin.value = '0';
			this.els.profitStatus.value = 'all';
			onReset();
		});
	}
	/**
	 * 更新记录数
	 * @param {number} count 
	 */
	updateCount(count){
		this.els.countEl.textContent = count > 0 ? ` (${count}条)` : '';
	}
	/** 控制搜索框可编辑 */
	setSearchEnabled(enabled){
		this.els.search.disabled = !enabled;
	}
}


