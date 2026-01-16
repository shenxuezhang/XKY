/**
 * 数据格式化与展示渲染相关的工具
 */

/**
 * 去除无关字符保留货币文本
 * @param {any} val
 * @returns {string}
 */
export function formatPriceStr(val){
	if(!val && val !== 0) return '-';
	return String(val).replace(/lei/gi,'').trim().replace(/[^\d.,]/g,'');
}

/**
 * 渲染星级（根据百分比0%-100%计算实心/半星/空心）
 * @param {any} val 原始值（可能是百分比字符串或数字）
 * @returns {string}
 */
export function renderStars(val){
	if(!val && val !== 0) return '-';
	
	// 提取百分比数值（0-100）
	let percent = 0;
	if(typeof val === 'string'){
		const num = parseFloat(val.replace('%','').trim());
		if(!Number.isNaN(num)){
			// 如果数值 <= 1，认为是0-1的小数，转换为百分比
			percent = num <= 1 && num > 0 ? num * 100 : num;
		}
	}else if(typeof val === 'number'){
		percent = val <= 1 && val > 0 ? val * 100 : val;
	}
	
	// 限制在0-100范围内
	percent = Math.min(100, Math.max(0, percent));
	
	// 转换为5星制：百分比 / 20 = 星数（0-5）
	const stars = percent / 20;
	const full = Math.floor(stars);
	const remainder = stars - full;
	
	// 半星判断：余数 >= 0.3 显示半星
	const hasHalf = remainder >= 0.3;
	
	let html = '<div class="star-rating-container">';
	for(let i=0; i<5; i++){
		if(i < full){
			html += '<div class="star-filled"></div>';
		}else if(i === full && hasHalf){
			html += '<div class="star-half"></div>';
		}else{
			html += '<div class="star-empty"></div>';
		}
	}
	return html + `<span class="star-rating-value">${percent.toFixed(1)}%</span></div>`;
}

/**
 * 从文本中提取图片链接
 * @param {any} val
 * @returns {string|null}
 */
export function extractImage(val){
	if(!val) return null;
	const m = String(val).match(/https?:\/\/[^\s",]+/);
	return m ? m[0] : val;
}


