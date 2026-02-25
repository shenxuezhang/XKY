/**
 * 列配置与通用常量
 * 保持与原始实现一致，禁止更改业务含义
 */
export const DEFAULT_COLUMNS = [
	{ key:'select', label:'', width:50, fixed:true, sortable:false },
	{ key:'img', label:'产品图片', width:80, fixed:true, sortable:false },
	{ key:'title', label:'产品标题', width:280, fixed:true, sortable:false },
	{ key:'prp', label:'PRP原价', width:100, fixed:false, sortable:true },
	{ key:'price', label:'前端价格', width:100, fixed:false, sortable:true },
	{ key:'discount', label:'前端折扣', width:90, fixed:false, sortable:true },
	{ key:'rating', label:'星级值', width:150, fixed:false, sortable:true },
	{ key:'score', label:'评论分数', width:80, fixed:false, sortable:true },
	{ key:'reviews', label:'评价数量', width:80, fixed:false, sortable:true },
	{ key:'badge', label:'链接打标', width:140, fixed:false, sortable:true },
	{ key:'pnk', label:'PNK码', width:130, fixed:false, sortable:false },
	{ key:'link', label:'产品链接', width:90, fixed:false, sortable:false }
];

export const CONFIG_KEY = 'emag_table_config_v4';
export const ROW_HEIGHT = 73;
export const VISIBLE_BUFFER = 5;

/**
 * 预定义列的映射关系（列key -> Excel表头名称）
 * 映射导入表格的表头列名
 */
export const COLUMN_MAP = {
	'img': ['产品图片'],
	'title': ['产品标题'],
	'prp': ['PRP原价'],
	'price': ['前端价格'],
	'discount': ['前端折扣'],
	'rating': ['星级值'],
	'score': ['评论分数'],
	'reviews': ['评价数量'],
	'badge': ['链接打标'],
	'pnk': ['PNK码'],
	'link': ['产品链接']
};

/**
 * 根据Excel数据自动检测并生成列配置
 * @param {any[]} rows Excel解析后的数据行
 * @param {Array<{key:string,label:string,width:number,fixed:boolean,sortable:boolean}>} existingColumns 现有列配置
 * @returns {Array<{key:string,label:string,width:number,fixed:boolean,sortable:boolean}>} 合并后的列配置
 */
export function autoDetectColumns(rows, existingColumns = DEFAULT_COLUMNS) {
	if(!rows || rows.length === 0) return existingColumns;
	
	const firstRow = rows[0];
	if(!firstRow || typeof firstRow !== 'object') return existingColumns;
	
	const excelHeaders = Object.keys(firstRow).filter(k => k !== '_uid');
	const existingColMap = new Map();
	const existingHeaderSet = new Set();
	
	existingColumns.forEach(col => {
		if(col.key !== 'select') {
			existingColMap.set(col.key, col);
			const headers = COLUMN_MAP[col.key] || [col.label || col.key];
			headers.forEach(h => existingHeaderSet.add(h));
		}
	});
	
	const mergedColumns = [];
	const processedHeaders = new Set();
	
	existingColumns.forEach(col => {
		if(col.key === 'select') {
			mergedColumns.push(col);
		} else {
			const headers = COLUMN_MAP[col.key] || [col.label || col.key];
			let found = false;
			for(const header of headers) {
				if(excelHeaders.includes(header)) {
					mergedColumns.push(col);
					processedHeaders.add(header);
					found = true;
					break;
				}
			}
			if(!found && col.key !== 'select') {
				mergedColumns.push(col);
			}
		}
	});
	
	excelHeaders.forEach(header => {
		if(!processedHeaders.has(header)) {
			const estimatedWidth = estimateColumnWidth(header);
			// 定义不可排序的列
			const nonSortableColumns = ['一级类', '二级类', '三级类', '四级类', '五级类', '详情描述', '规格详情'];
			const isSortable = !nonSortableColumns.includes(header);
			const newCol = {
				key: header,
				label: header,
				width: estimatedWidth,
				fixed: false,
				sortable: isSortable,
				hidden: false
			};
			mergedColumns.push(newCol);
		}
	});
	
	return mergedColumns;
}

/**
 * 根据列名估算列宽
 * @param {string} header 列头名称
 * @returns {number} 估算的列宽
 */
function estimateColumnWidth(header) {
	const baseWidth = 100;
	const nameLength = header ? header.length : 10;
	const estimated = Math.max(baseWidth, Math.min(nameLength * 12 + 40, 300));
	return estimated;
}

/**
 * 计算列的实际内容宽度（考虑表头文字和内容文字）
 * @param {string} key 列key
 * @param {string} label 列标签
 * @param {any[]} data 数据数组
 * @param {Function} parseValue 解析值的函数
 * @param {Function} formatCell 格式化单元格的函数（可选，用于获取渲染后的HTML长度）
 * @returns {number} 计算出的列宽
 */
export function calculateOptimalColumnWidth(key, label, data, parseValue, formatCell) {
	// 固定列不自动调整
	if(key === 'select' || key === 'img') {
		return null; // 返回null表示不调整
	}
	
	// 计算文字宽度（中文字符按12px/字符，英文字符按7px/字符）
	const calculateTextWidth = (text) => {
		if(!text) return 100;
		let width = 0;
		for(let i = 0; i < text.length; i++) {
			const char = text[i];
			// 中文字符、全角字符
			if(/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/.test(char)) {
				width += 12;
			} else {
				width += 7; // 英文字符和数字
			}
		}
		return width + 40; // 加上内边距
	};
	
	const headerWidth = calculateTextWidth(label);
	
	// 计算内容最大宽度
	let maxContentWidth = 0;
	const sampleSize = Math.min(200, data.length); // 采样前200条数据以提高准确性
	
	for(let i = 0; i < sampleSize; i++) {
		const row = data[i];
		if(!row) continue;
		
		const val = parseValue(row, key);
		if(val === null || val === undefined || val === '') continue;
		
		// 根据列类型计算宽度
		let contentWidth = 0;
		const strVal = String(val);
		
		if(key === 'title') {
			// 产品标题：按实际文字宽度计算
			contentWidth = calculateTextWidth(strVal);
		} else if(key === 'price' || key === 'prp') {
			// 价格：数字格式，通常较短
			contentWidth = Math.max(calculateTextWidth(strVal), 100);
		} else if(key === 'discount') {
			// 折扣：百分比格式
			contentWidth = Math.max(calculateTextWidth(strVal), 90);
		} else if(key === 'rating') {
			// 星级：星级图标宽度（5个星星 + 百分比文字）
			// 5个星星图标（每个14px）+ 间距（4px * 4）+ 百分比文字（约50px）+ 内边距（40px）
			contentWidth = Math.max(14 * 5 + 4 * 4 + 50 + 40, 150);
		} else if(key === 'score' || key === 'reviews') {
			// 评论分数、评价数量：数字格式
			contentWidth = Math.max(calculateTextWidth(strVal), 80);
		} else if(key === 'badge') {
			// 链接打标：可能较长，按实际文字宽度计算
			contentWidth = calculateTextWidth(strVal);
		} else if(key === 'pnk') {
			// PNK码：等宽字体，按字符数计算
			contentWidth = strVal.length * 9 + 30;
		} else if(key === 'link') {
			// 产品链接：链接按钮宽度
			contentWidth = 90;
		} else {
			// 其他列（如一级类、二级类等）：按实际文字宽度计算
			contentWidth = calculateTextWidth(strVal);
		}
		
		maxContentWidth = Math.max(maxContentWidth, contentWidth);
	}
	
	// 取表头宽度和内容宽度的较大值，并加上一些边距
	const optimalWidth = Math.max(headerWidth, maxContentWidth, 80);
	
	// 设置最大宽度限制，避免列过宽
	const maxWidth = key === 'title' ? 400 : (key === 'badge' ? 250 : 300);
	
	return Math.min(optimalWidth, maxWidth);
}


