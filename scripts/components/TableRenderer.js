import { ROW_HEIGHT, VISIBLE_BUFFER } from '../config/columns.js';
import { parseValue, parseStars, parsePrice, parseNumber } from '../utils/parsers.js';
import { extractImage, formatPriceStr, renderStars } from '../utils/formatters.js';

/**
 * 表格渲染（含虚拟滚动、表头渲染、列拖拽与宽度调整）
 */
export class TableRenderer{
	/**
	 * @param {{header:HTMLElement,body:HTMLElement,container:HTMLElement}} els 
	 * @param {{getColConfig:()=>Array,setColConfig:(cols:Array)=>void,getSelectedIds:()=>Set<number>,onSort:(key:string,toggle?:boolean)=>void,afterRender?:()=>void}} options 
	 */
	constructor(els, options){
		this.els = els;
		this.options = options;
		this.isResizing = false;
		this.currentResizeCol = null;
		this.startX = 0;
		this.startWidth = 0;
		this.startScale = 1;
		this.dragSrcColKey = null;
		this.imageObserver = null;
		this.isScrolling = false;
		this.scrollEndTimer = null;
		this.loadedImages = new Map();
		this.searchKeyword = ''; // 当前搜索关键词，用于高亮
		this.highlightCache = new Map(); // 优化：缓存高亮结果
		this.resizeAnimationFrame = null; // 优化：列宽调整动画帧ID
	}
	/**
	 * 初始化图片懒加载观察器
	 * 优化：增加rootMargin到200px提前加载，添加错误处理，添加加载占位符
	 */
	initLazyImageObserver(root){
		this.imageObserver = new IntersectionObserver((entries, observer)=>{
			entries.forEach(entry=>{
				if(entry.isIntersecting){
					const img = entry.target;
					const src = img.getAttribute('data-src');
					const uid = img.getAttribute('data-uid');
					if(src){
						// 添加加载占位符（通过CSS实现）
						img.style.opacity = '0.3';
						
						img.src = src;
						img.onload = ()=>{
							img.classList.add('loaded');
							img.style.opacity = '1';
							// 修复：图片加载完成后，给容器添加类以隐藏占位符动画
							const container = img.closest('.product-img-container');
							if(container){
								container.classList.add('img-loaded');
							}
							if(uid) this.loadedImages.set(parseInt(uid), src);
						};
						// 添加错误处理
						img.onerror = ()=>{
							img.classList.add('error');
							img.style.opacity = '0.3';
							// 修复：图片加载失败时，也给容器添加类以隐藏占位符动画
							const container = img.closest('.product-img-container');
							if(container){
								container.classList.add('img-loaded');
								container.setAttribute('title', '图片加载失败');
							}
							if(!img.getAttribute('data-error-handled')){
								img.setAttribute('data-error-handled', 'true');
							}
						};
						img.removeAttribute('data-src');
						observer.unobserve(img);
					}
				}
			});
		}, { root, rootMargin: '200px' }); // 优化：从100px增加到200px，提前加载图片
	}
	/** 获取自适应缩放比例 */
	getScale(){
		const colConfig = this.options.getColConfig();
		// 只计算可见列的宽度
		const visibleCols = colConfig.filter(c => !c.hidden);
		const totalWidth = visibleCols.reduce((sum, col) => sum + col.width, 0);
		const containerEl = this.els.container.parentElement?.parentElement || this.els.container.parentElement;
		const containerWidth = containerEl?.clientWidth || this.els.container.clientWidth || totalWidth;
		return containerWidth > totalWidth ? containerWidth / totalWidth : 1;
	}
	
	/** 渲染表头 */
	renderHeaders(currentSort){
		const colConfig = this.options.getColConfig();
		const tr = document.createElement('tr');
		let accumulatedLeft = 0;
		const scale = this.getScale();
		
		colConfig.forEach((col)=>{
			// 跳过隐藏的列
			if(col.hidden) return;
			const th = document.createElement('th');
			const scaledWidth = Math.round(col.width * scale);
			th.style.width = `${scaledWidth}px`;
			th.setAttribute('data-key', col.key);
			if(col.fixed){
				th.classList.add('sticky-left');
				th.style.left = `${accumulatedLeft}px`;
				accumulatedLeft += scaledWidth;
			}
			th.draggable = true;
			th.addEventListener('dragstart', this.handleDragStart.bind(this));
			th.addEventListener('dragover', this.handleDragOver.bind(this));
			th.addEventListener('drop', this.handleDrop.bind(this));
			th.addEventListener('dragend', this.handleDragEnd.bind(this));

			const contentDiv = document.createElement('div');
			contentDiv.className = 'th-content';
			if(col.key === 'select'){
				contentDiv.innerHTML = `<input type="checkbox" id="selectAllCheckbox" class="row-checkbox cursor-pointer">`;
			}else{
				const labelText = col.label;
				const sortIcon = col.sortable ? '<i class="fas fa-sort sort-icon text-gray-300 ml-1 text-xs"></i>' : '';
				contentDiv.innerHTML = `<span>${labelText}${sortIcon}</span>`;
				if(col.sortable){
					contentDiv.addEventListener('click', (e)=>{
						if(e.target.tagName !== 'INPUT'){
							this.options.onSort(col.key, true);
						}
					});
					if(currentSort.key === col.key){
						const icon = contentDiv.querySelector('.sort-icon');
						if(icon) icon.className = currentSort.direction === 'asc'
							? 'fas fa-sort-up sort-icon text-blue-600 ml-1 text-xs'
							: 'fas fa-sort-down sort-icon text-blue-600 ml-1 text-xs';
					}
				}
			}
			th.appendChild(contentDiv);
			const resizer = document.createElement('div');
			resizer.className = 'resizer';
			resizer.addEventListener('mousedown', (e)=> this.handleResizeStart(e, col.key));
			th.appendChild(resizer);
			tr.appendChild(th);
		});
		this.els.header.innerHTML = '';
		this.els.header.appendChild(tr);
	}
	/** 渲染可见行 */
	renderVisibleRows(filteredData, colConfig, skipImageLoad = false){
		const top = this.els.container.scrollTop;
		const h = this.els.container.clientHeight;
		let s = Math.floor(top/ROW_HEIGHT) - VISIBLE_BUFFER;
		let e = Math.ceil((top+h)/ROW_HEIGHT) + VISIBLE_BUFFER;
		s = Math.max(0, s);
		e = Math.min(filteredData.length, e);
		
		const scale = this.getScale();
		
		// 过滤掉隐藏的列
		const visibleCols = colConfig.filter(c => !c.hidden);
		
		let html = '';
		if(s > 0) html += `<tr style="height:${s*ROW_HEIGHT}px;border:none;pointer-events:none;"><td colspan="${visibleCols.length}"></td></tr>`;
		let offsets = []; let acc = 0;
		visibleCols.forEach(c=>{ 
			const scaledWidth = Math.round(c.width * scale);
			offsets.push(acc); 
			if(c.fixed) acc += scaledWidth; 
		});
		for(let i=s;i<e;i++){
			const row = filteredData[i];
			let tr = `<tr class="hover:bg-blue-50 transition-colors" data-row-index="${i}">`;
			visibleCols.forEach((col, idx)=>{
				const val = this.formatCell(col.key, parseValue(row, col.key), row);
				const scaledWidth = Math.round(col.width * scale);
				let sty = `width:${scaledWidth}px;`; let cls = '';
				if(col.fixed){ cls = 'sticky-left'; sty += `left:${offsets[idx]}px;`; }
				tr += `<td class="${cls}" style="${sty}" data-key="${col.key}">${val}</td>`;
			});
			html += tr + `</tr>`;
		}
		if(e < filteredData.length) html += `<tr style="height:${(filteredData.length-e)*ROW_HEIGHT}px;border:none;pointer-events:none;"><td colspan="${visibleCols.length}"></td></tr>`;
		this.els.body.innerHTML = html;
		
		if(!skipImageLoad && this.imageObserver){
			this.loadVisibleImages();
		}
		
		this.options.afterRender?.();
	}
	
	/** 加载可见区域的图片 */
	loadVisibleImages(){
		if(!this.imageObserver) return;
		const imgs = this.els.body.querySelectorAll('img[data-src]');
		imgs.forEach(img=>{
			const uid = img.getAttribute('data-uid');
			const cachedSrc = uid ? this.loadedImages.get(parseInt(uid)) : null;
			if(cachedSrc){
				img.src = cachedSrc;
				img.classList.add('loaded');
				img.style.opacity = '1';
				// 修复：图片加载完成后，给容器添加类以隐藏占位符动画
				const container = img.closest('.product-img-container');
				if(container){
					container.classList.add('img-loaded');
				}
				img.removeAttribute('data-src');
			}else{
				this.imageObserver.observe(img);
			}
		});
	}
	
	/** 清理图片缓存 */
	clearImageCache(){
		this.loadedImages.clear();
	}
	
	/** 处理滚动开始 */
	handleScrollStart(){
		this.isScrolling = true;
		if(this.scrollEndTimer) clearTimeout(this.scrollEndTimer);
	}
	
	/** 处理滚动结束 */
	handleScrollEnd(callback){
		if(this.scrollEndTimer) clearTimeout(this.scrollEndTimer);
		this.scrollEndTimer = setTimeout(()=>{
			this.isScrolling = false;
			if(callback) callback();
		}, 150);
	}
	/** 更新冻结列位置 */
	updateStickyPositions(){
		let acc = 0;
		const colConfig = this.options.getColConfig();
		const ths = this.els.header.querySelectorAll('th');
		colConfig.forEach((col, idx)=>{
			if(col.fixed){
				if(ths[idx]) ths[idx].style.left = `${acc}px`;
				this.els.body.querySelectorAll(`td[data-key="${col.key}"]`).forEach(td=> td.style.left = `${acc}px`);
				acc += col.width;
			}
		});
	}
	/** 开始列宽拖拽 */
	handleResizeStart(e, key){
		e.preventDefault(); 
		e.stopPropagation();
		this.isResizing = true;
		this.currentResizeCol = key;
		this.startX = e.pageX;
		const col = this.options.getColConfig().find(c=>c.key===key);
		this.startWidth = col.width;
		this.startScale = this.getScale();
		document.body.style.cursor = 'col-resize';
		document.body.style.userSelect = 'none';
		const onMove = (ev)=> this.handleResizeMove(ev);
		const onUp = ()=>{ 
			document.removeEventListener('mousemove', onMove);
			document.removeEventListener('mouseup', onUp);
			this.handleResizeUp();
		};
		document.addEventListener('mousemove', onMove);
		document.addEventListener('mouseup', onUp);
	}
	/**
	 * 列宽调整移动处理
	 * 优化：使用 requestAnimationFrame 节流，只更新样式不重新渲染
	 */
	handleResizeMove(e){
		if(!this.isResizing) return;
		e.preventDefault();
		
		// 使用 requestAnimationFrame 节流
		if(this.resizeAnimationFrame){
			cancelAnimationFrame(this.resizeAnimationFrame);
		}
		
		this.resizeAnimationFrame = requestAnimationFrame(() => {
			const diff = e.pageX - this.startX;
			const scale = this.getScale();
			const diffInBaseWidth = diff / scale;
			const newWidth = Math.max(30, this.startWidth + diffInBaseWidth);
			const cols = this.options.getColConfig();
			const col = cols.find(c=>c.key === this.currentResizeCol);
			if(col){
				col.width = Math.round(newWidth);
				const scaledWidth = Math.round(col.width * scale);
				const th = this.els.header.querySelector(`th[data-key="${this.currentResizeCol}"]`);
				if(th) th.style.width = `${scaledWidth}px`;
				if(col.fixed) this.updateStickyPositions();
				// 优化：只更新样式，不重新渲染整个表格
				this.els.body.querySelectorAll(`td[data-key="${this.currentResizeCol}"]`).forEach(td=> {
					td.style.width = `${scaledWidth}px`;
				});
			}
		});
	}
	handleResizeUp(){
		if(!this.isResizing) return;
		this.isResizing = false;
		this.currentResizeCol = null;
		this.startX = 0;
		this.startWidth = 0;
		this.startScale = 1;
		document.body.style.cursor = 'default';
		document.body.style.userSelect = '';
		this.options.setColConfig(this.options.getColConfig());
	}
	handleDragStart(e){
		this.dragSrcColKey = e.currentTarget.getAttribute('data-key');
		e.currentTarget.classList.add('dragging-col');
		e.dataTransfer.effectAllowed = 'move';
	}
	handleDragOver(e){
		e.preventDefault();
		e.dataTransfer.dropEffect = 'move';
		e.currentTarget.classList.add('drag-over');
		return false;
	}
	handleDragEnd(e){
		e.currentTarget.classList.remove('dragging-col');
		this.els.header.querySelectorAll('th').forEach(c=> c.classList.remove('drag-over'));
	}
	handleDrop(e){
		e.stopPropagation();
		const targetKey = e.currentTarget.getAttribute('data-key');
		if(this.dragSrcColKey && this.dragSrcColKey !== targetKey){
			const cols = this.options.getColConfig();
			const sIdx = cols.findIndex(c=>c.key===this.dragSrcColKey);
			const tIdx = cols.findIndex(c=>c.key===targetKey);
			cols.splice(tIdx, 0, cols.splice(sIdx, 1)[0]);
			this.options.setColConfig(cols);
		}
		return false;
	}
	/**
	 * 高亮搜索关键词
	 * 优化：使用缓存减少重复计算，提升性能
	 * @param {string} text 原始文本
	 * @param {string} keyword 搜索关键词
	 * @returns {string} 高亮后的HTML
	 */
	highlightKeyword(text, keyword){
		if(!keyword || !text) return text || '';
		const textStr = String(text);
		const keywordStr = keyword.trim();
		if(!keywordStr) return textStr;
		
		// 检查缓存
		const cacheKey = `${textStr}-${keywordStr}`;
		if(this.highlightCache.has(cacheKey)){
			return this.highlightCache.get(cacheKey);
		}
		
		// 转义HTML特殊字符
		const escapeHtml = (str) => {
			const div = document.createElement('div');
			div.textContent = str;
			return div.innerHTML;
		};
		
		const escapedText = escapeHtml(textStr);
		const escapedKeyword = escapeHtml(keywordStr);
		
		// 不区分大小写匹配
		const regex = new RegExp(`(${escapedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
		const result = escapedText.replace(regex, '<mark class="search-highlight">$1</mark>');
		
		// 缓存结果（限制缓存大小，避免内存泄漏）
		if(this.highlightCache.size > 1000){
			const firstKey = this.highlightCache.keys().next().value;
			this.highlightCache.delete(firstKey);
		}
		this.highlightCache.set(cacheKey, result);
		
		return result;
	}
	
	/**
	 * 清除高亮缓存（搜索关键词变化时调用）
	 */
	clearHighlightCache(){
		this.highlightCache.clear();
	}
	
	/** 单元格渲染 */
	formatCell(key, val, row){
		if(key === 'select'){
			const isChecked = this.options.getSelectedIds().has(val);
			// 获取产品推送状态
			// 确保 row 对象存在，并且状态字段存在
			const profitStatus = (row && row._profitStatus !== undefined) ? row._profitStatus : null;
			let statusIcon = '';
			if (profitStatus === 'pushed') {
				statusIcon = '<i class="fas fa-check-circle profit-status-icon profit-status-pushed" title="已推送到利润测算"></i>';
			} else if (profitStatus === 'deleted') {
				statusIcon = '<i class="fas fa-times-circle profit-status-icon profit-status-deleted" title="已从利润测算删除"></i>';
			}
			return `<div class="flex items-center justify-center gap-2 h-full">
				<input type="checkbox" class="row-checkbox" data-uid="${val}" ${isChecked ? 'checked' : ''}>
				${statusIcon}
			</div>`;
		}
		
		// 需要高亮的列（文本列）
		const highlightableKeys = ['title', 'badge', 'pnk'];
		const shouldHighlight = highlightableKeys.includes(key) && this.searchKeyword;
		
		if(key==='title') {
			const highlighted = shouldHighlight ? this.highlightKeyword(val, this.searchKeyword) : (val||'-');
			const escapedVal = (val || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
			return `<div class="product-title-cell copyable-cell" title="${escapedVal}" data-copy-text="${escapedVal}">
				<span class="cell-content">${highlighted}</span>
				<button class="copy-btn" type="button" aria-label="复制" title="复制">
					<i class="fas fa-copy"></i>
				</button>
			</div>`;
		}
		
		// 除title外的所有列都需要居中
		const centerWrapper = (content) => `<div class="flex items-center justify-center h-full">${content}</div>`;
		
		if(key==='img'){
			if(!val) return centerWrapper('-');
			const uid = typeof row._uid === 'number' ? row._uid : parseInt(row._uid);
			const imgSrc = extractImage(val);
			const cachedSrc = this.loadedImages.get(uid);
			if(cachedSrc){
				// 修复：已缓存的图片直接显示，容器添加img-loaded类以隐藏占位符动画
				return centerWrapper(`<div class="product-img-container img-loaded w-12 h-12 bg-gray-100 rounded border border-gray-200 mx-auto"><img src="${cachedSrc}" class="w-full h-full object-cover loaded" data-uid="${uid}" style="opacity:1;cursor:zoom-in;"></div>`);
			}
			return centerWrapper(`<div class="product-img-container w-12 h-12 bg-gray-100 rounded border border-gray-200 mx-auto"><img data-src="${imgSrc}" class="lazy-img w-full h-full object-cover" data-uid="${uid}"></div>`);
		}
		if(key==='prp') return centerWrapper(`<span class="text-gray-900">${formatPriceStr(val)}</span>`);
		if(key==='price') return centerWrapper(`<span class="text-red-600 font-semibold">${formatPriceStr(val)}</span>`);
		if(key==='discount') return centerWrapper(val ? `<span class="discount-badge">${val}</span>` : '-');
		if(key==='rating') return centerWrapper(renderStars(val));
		if(key==='score'||key==='reviews') return centerWrapper(`<span class="text-gray-900" style="font-size:.875rem">${val||'-'}</span>`);
		if(key==='badge') {
			if(!val) return centerWrapper('');
			// 如果搜索高亮，先对原始文本进行高亮，然后再应用badge样式
			if(shouldHighlight && this.searchKeyword) {
				const highlightedText = this.highlightKeyword(String(val), this.searchKeyword);
				// 如果高亮后文本包含mark标签，说明匹配到了关键词
				if(highlightedText.includes('<mark')) {
					// 提取高亮后的文本内容（去除mark标签，保留高亮标记）
					const tempDiv = document.createElement('div');
					tempDiv.innerHTML = highlightedText;
					const textContent = tempDiv.textContent || tempDiv.innerText || '';
					// 重新构建badge，但保留高亮标记
					return centerWrapper(this.formatBadgeWithHighlight(textContent, highlightedText));
				}
			}
			const badgeVal = this.formatBadge(val);
			return centerWrapper(badgeVal);
		}
		if(key==='link') return centerWrapper(val ? `<a href="${val}" target="_blank" class="action-link text-xs"><i class="fas fa-external-link-alt"></i> 查看</a>`:'-');
		if(key==='pnk') {
			const pnkText = val || '-';
			const highlightedText = shouldHighlight ? this.highlightKeyword(pnkText, this.searchKeyword) : pnkText;
			const escapedVal = (val || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
			return `<div class="flex items-center justify-center h-full copyable-cell" data-copy-text="${escapedVal}">
				<span class="text-gray-900 font-mono cell-content" style="font-size:.900rem;font-weight:900">${highlightedText}</span>
				<button class="copy-btn" type="button" aria-label="复制" title="复制">
					<i class="fas fa-copy"></i>
				</button>
			</div>`;
		}
		// 详情描述和规格详情：显示"点击查看"按钮
		if(key === '详情描述' || key === '规格详情') {
			if(!val || val === '' || String(val).trim() === '') {
				return centerWrapper('-');
			}
			const columnName = key === '详情描述' ? '详情描述' : '规格详情';
			// 转义HTML以避免XSS，但这里数据来自Excel，相对安全
			const safeVal = String(val).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
			return centerWrapper(`<button class="html-view-btn text-xs px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors" data-column="${columnName}" data-content="${safeVal}" type="button"><i class="fas fa-eye"></i> 点击查看</button>`);
		}
		return centerWrapper(`<span class="text-gray-900" style="font-size:.875rem">${val||'-'}</span>`);
	}
	
	/**
	 * 设置搜索关键词（用于高亮）
	 * @param {string} keyword 
	 */
	/**
	 * 设置搜索关键词（用于高亮）
	 * 优化：关键词变化时清除缓存
	 */
	setSearchKeyword(keyword){
		const oldKeyword = this.searchKeyword;
		this.searchKeyword = keyword || '';
		// 关键词变化时清除缓存
		if(oldKeyword !== this.searchKeyword){
			this.clearHighlightCache();
		}
	}
	
	/**
	 * 格式化链接打标，根据内容生成不同的背景色样式
	 * @param {any} val 原始值
	 * @returns {string} 格式化后的HTML
	 */
	formatBadge(val){
		if(!val) return '';
		const strVal = String(val).trim();
		if(!strVal) return '';
		
		// 特殊标记：Top Favorite 和 Super Pret
		if(strVal.includes('Top') || strVal.toLowerCase().includes('top favorite')){
			return `<span class="badge-top">Top Favorite</span>`;
		}
		if(strVal.includes('Super') || strVal.toLowerCase().includes('super pret')){
			return `<span class="badge-super">Super Pret</span>`;
		}
		
		// 根据内容生成不同的背景色（使用哈希函数确保相同内容有相同颜色）
		const hash = this.hashString(strVal);
		const colors = [
			{ bg: '#EFF6FF', text: '#1E40AF', border: '#3B82F6' }, // 蓝色
			{ bg: '#F0FDF4', text: '#166534', border: '#22C55E' }, // 绿色
			{ bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' }, // 黄色
			{ bg: '#FCE7F3', text: '#9F1239', border: '#EC4899' }, // 粉色
			{ bg: '#E0E7FF', text: '#3730A3', border: '#6366F1' }, // 紫色
			{ bg: '#FEE2E2', text: '#991B1B', border: '#EF4444' }, // 红色
			{ bg: '#D1FAE5', text: '#065F46', border: '#10B981' }, // 青色
			{ bg: '#FED7AA', text: '#9A3412', border: '#F97316' }  // 橙色
		];
		const color = colors[hash % colors.length];
		
		return `<span class="badge-custom text-xs px-2 py-0.5 rounded" style="background-color:${color.bg};color:${color.text};border:1px solid ${color.border};display:inline-block;">${strVal}</span>`;
	}
	
	/**
	 * 简单的字符串哈希函数（用于生成稳定的颜色索引）
	 * @param {string} str 
	 * @returns {number}
	 */
	hashString(str){
		let hash = 0;
		for(let i = 0; i < str.length; i++){
			const char = str.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash; // 转换为32位整数
		}
		return Math.abs(hash);
	}
	
	/**
	 * 格式化带高亮的badge（在badge样式中保留搜索高亮）
	 * @param {string} originalText 原始文本内容
	 * @param {string} highlightedHtml 已高亮的HTML内容（包含mark标签）
	 * @returns {string} 格式化后的HTML
	 */
	formatBadgeWithHighlight(originalText, highlightedHtml){
		const strVal = originalText.trim();
		if(!strVal) return '';
		
		// 提取高亮标记内容（mark标签内的文本）
		const markRegex = /<mark[^>]*>([^<]*)<\/mark>/gi;
		const markMatches = [];
		let match;
		while((match = markRegex.exec(highlightedHtml)) !== null){
			markMatches.push(match[1]); // 提取mark标签内的文本
		}
		
		// 特殊标记：Top Favorite 和 Super Pret
		if(strVal.includes('Top') || strVal.toLowerCase().includes('top favorite')){
			let content = 'Top Favorite';
			// 如果有高亮匹配，在内容中应用高亮
			if(markMatches.length > 0){
				markMatches.forEach(matchedText => {
					const regex = new RegExp(`(${matchedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
					content = content.replace(regex, `<mark class="search-highlight">$1</mark>`);
				});
			}
			return `<span class="badge-top">${content}</span>`;
		}
		if(strVal.includes('Super') || strVal.toLowerCase().includes('super pret')){
			let content = 'Super Pret';
			if(markMatches.length > 0){
				markMatches.forEach(matchedText => {
					const regex = new RegExp(`(${matchedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
					content = content.replace(regex, `<mark class="search-highlight">$1</mark>`);
				});
			}
			return `<span class="badge-super">${content}</span>`;
		}
		
		// 根据内容生成不同的背景色
		const hash = this.hashString(strVal);
		const colors = [
			{ bg: '#EFF6FF', text: '#1E40AF', border: '#3B82F6' }, // 蓝色
			{ bg: '#F0FDF4', text: '#166534', border: '#22C55E' }, // 绿色
			{ bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' }, // 黄色
			{ bg: '#FCE7F3', text: '#9F1239', border: '#EC4899' }, // 粉色
			{ bg: '#E0E7FF', text: '#3730A3', border: '#6366F1' }, // 紫色
			{ bg: '#FEE2E2', text: '#991B1B', border: '#EF4444' }, // 红色
			{ bg: '#D1FAE5', text: '#065F46', border: '#10B981' }, // 青色
			{ bg: '#FED7AA', text: '#9A3412', border: '#F97316' }  // 橙色
		];
		const color = colors[hash % colors.length];
		
		// 在原始文本中应用高亮标记
		let badgeContent = strVal;
		if(markMatches.length > 0){
			markMatches.forEach(matchedText => {
				const regex = new RegExp(`(${matchedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
				badgeContent = badgeContent.replace(regex, `<mark class="search-highlight">$1</mark>`);
			});
		}
		
		return `<span class="badge-custom text-xs px-2 py-0.5 rounded" style="background-color:${color.bg};color:${color.text};border:1px solid ${color.border};display:inline-block;">${badgeContent}</span>`;
	}
}


