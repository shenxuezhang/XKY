/**
 * 通用辅助方法
 */

/**
 * 防抖函数
 * @param {Function} fn 
 * @param {number} wait 
 * @returns {Function}
 */
export function debounce(fn, wait){
	let timer = null;
	return function(...args){
		clearTimeout(timer);
		timer = setTimeout(()=>fn.apply(this,args), wait);
	};
}

/**
 * 切换元素可见性
 * @param {HTMLElement} el 
 * @param {boolean} show 
 */
export function toggleHidden(el, show){
	if(!el) return;
	el.classList.toggle('hidden', !show);
}

/**
 * 进度条更新
 * @param {HTMLElement} progressBar 
 * @param {number} percent 
 */
export function updateProgress(progressBar, percent){
	if(progressBar) progressBar.style.width = `${percent}%`;
}

/**
 * 简易选择器
 * @param {string} id 
 * @returns {HTMLElement}
 */
export function byId(id){
	return document.getElementById(id);
}

/**
 * 安全数字解析（失败返回 NaN）
 * @param {any} v 
 * @returns {number}
 */
export function toNumber(v){
	const n = parseFloat(v);
	return Number.isNaN(n) ? NaN : n;
}

/**
 * 计算数组的百分位数
 * @param {number[]} arr 已排序的数组
 * @param {number} percentile 百分位数（0-100）
 * @returns {number}
 */
export function percentile(arr, percentile){
	if(!arr || arr.length === 0) return 0;
	const sorted = [...arr].sort((a, b) => a - b);
	const index = Math.ceil((percentile / 100) * sorted.length) - 1;
	return sorted[Math.max(0, index)];
}

/**
 * 计算星级值的百分比阈值
 * @param {any[]} data 数据数组
 * @param {Function} parseRating 解析星级值的函数
 * @returns {{p25: number, p50: number, p75: number}} 返回25%、50%、75%百分位数
 */
export function calculateRatingPercentiles(data, parseRating){
	if(!data || data.length === 0) return { p25: 0, p50: 0, p75: 0 };
	
	const ratings = data.map(row => {
		const rating = parseRating(row);
		return isNaN(rating) || rating <= 0 ? 0 : rating;
	}).filter(r => r > 0);
	
	if(ratings.length === 0) return { p25: 0, p50: 0, p75: 0 };
	
	return {
		p25: percentile(ratings, 25),  // 第25百分位数（三星级以上阈值）
		p50: percentile(ratings, 50),  // 第50百分位数（四星级以上阈值）
		p75: percentile(ratings, 75)   // 第75百分位数（五星级阈值）
	};
}


