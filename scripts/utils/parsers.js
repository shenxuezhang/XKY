/**
 * 值解析函数：维持与原实现一致的解析规则
 */

/**
 * 解析数字（折扣/数量等）
 * @param {any} val
 * @returns {number}
 */
export function parseNumber(val){
	if(!val) return -999;
	let str = String(val).replace(/lei/gi,'').replace('%','').trim();
	if(str.includes(',') && !str.includes('.')) str = str.replace(',', '.');
	const num = parseFloat(str);
	return Number.isNaN(num) ? -999 : num;
}

/**
 * 解析价格
 * @param {any} val
 * @returns {number}
 */
export function parsePrice(val){
	if(!val) return -999;
	let str = String(val).replace(/lei/gi,'').trim();
	const lastDot = str.lastIndexOf('.');
	const lastComma = str.lastIndexOf(',');
	if(lastDot > -1 && lastComma > -1){
		if(lastComma > lastDot) str = str.replace(/\./g,'').replace(',', '.');
		else str = str.replace(/,/g,'');
	}else if(lastComma > -1){
		str = str.replace(',', '.');
	}
	const num = parseFloat(str);
	return Number.isNaN(num) ? -999 : num;
}

/**
 * 解析星级（兼容百分比与 0-1、0-5）
 * @param {any} val
 * @returns {number}
 */
export function parseStars(val){
	let num = parseFloat(String(val).replace('%',''));
	if(Number.isNaN(num)) return 0;
	return (num <= 1 && num > 0) ? num * 5 : num;
}

/**
 * 值映射解析：将业务字段映射到列 key
 * @param {Record<string, any>} row
 * @param {string} key
 * @returns {any}
 */
export function parseValue(row, key){
	if(key === 'select') return row._uid;
	if(key === '_uid') return row._uid;
	
	const map = {
		'img':['产品图片'], 'title':['产品标题'], 'prp':['PRP原价'], 'price':['前端价格'],
		'discount':['前端折扣'], 'rating':['星级值'], 'score':['评论分数'], 'reviews':['评价数量'],
		'badge':['链接打标'], 'pnk':['PNK码'], 'link':['产品链接']
	};
	
	const keys = map[key] || [key];
	for(const k of keys){
		if(row[k] !== undefined) return row[k];
	}
	
	// 如果key本身就是Excel中的列名（动态列），直接返回
	if(row[key] !== undefined) return row[key];
	
	return '';
}


