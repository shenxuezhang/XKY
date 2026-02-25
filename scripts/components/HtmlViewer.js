/**
 * HTML内容查看器组件（用于显示详情描述和规格详情的HTML内容）
 */
export class HtmlViewer {
	/**
	 * @param {{overlay:HTMLElement, content:HTMLElement, closeBtn:HTMLElement, title:HTMLElement}} els 
	 */
	constructor(els) {
		this.els = els;
	}
	
	/** 初始化事件 */
	init() {
		// 关闭按钮点击事件 - 使用捕获阶段确保优先处理
		this.els.closeBtn.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			e.stopImmediatePropagation();
			this.hide();
		}, true);
		
		// 点击遮罩层关闭
		this.els.overlay.addEventListener('click', (e) => {
			if (e.target === this.els.overlay) {
				e.preventDefault();
				e.stopPropagation();
				this.hide();
			}
		});
		
		// 防止点击容器内部时关闭
		const container = this.els.overlay.querySelector('.html-viewer-container');
		if (container) {
			container.addEventListener('click', (e) => {
				e.stopPropagation();
			});
		}
		
		// ESC键关闭
		document.addEventListener('keydown', (e) => {
			if (e.key === 'Escape' && this.els.overlay.classList.contains('active')) {
				e.preventDefault();
				this.hide();
			}
		});
		
		// 使用document级别的事件委托作为备用方案
		document.addEventListener('click', (e) => {
			if (e.target.closest('#htmlViewerClose') || e.target.closest('.html-viewer-close')) {
				e.preventDefault();
				e.stopPropagation();
				e.stopImmediatePropagation();
				this.hide();
			}
		}, true);
	}
	
	/** 显示HTML内容 */
	show(htmlContent, title = '') {
		if (!htmlContent) return;
		
		// 设置标题
		if (this.els.title) {
			this.els.title.textContent = title || '内容预览';
		}
		
		// 将HTML内容插入到iframe中，确保安全渲染
		const iframe = this.els.content.querySelector('iframe');
		if (iframe) {
			try {
				const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
				iframeDoc.open();
				// 写入完整的HTML文档结构，确保样式和脚本能正常加载
				iframeDoc.write(`
					<!DOCTYPE html>
					<html>
					<head>
						<meta charset="UTF-8">
						<meta name="viewport" content="width=device-width, initial-scale=1.0">
						<style>
							* { box-sizing: border-box; }
							html { 
								margin: 0; 
								padding: 0;
								width: 100%;
								height: 100%;
								overflow: hidden;
							}
							body { 
								margin: 0; 
								padding: 20px; 
								font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
								width: 100%;
								height: auto;
								min-height: 100%;
								overflow-y: auto;
								overflow-x: hidden;
								word-wrap: break-word;
								overflow-wrap: break-word;
								position: relative;
							}
							/* 强制所有图片自适应，覆盖内联样式 */
							img { 
								max-width: 100% !important;
								width: auto !important;
								height: auto !important;
								display: block !important;
								margin: 10px auto !important;
							}
							/* 处理带内联样式的图片 */
							img[style] {
								max-width: 100% !important;
								width: auto !important;
								height: auto !important;
							}
							/* 视频元素自适应 */
							video {
								max-width: 100% !important;
								width: auto !important;
								height: auto !important;
								display: block !important;
								margin: 10px auto !important;
							}
							/* iframe响应式容器 - 处理YouTube等嵌入视频 */
							iframe {
								max-width: 100% !important;
								width: 100% !important;
								height: auto !important;
								display: block !important;
								margin: 10px auto !important;
								border: none !important;
							}
							/* YouTube iframe特殊处理 - 保持16:9宽高比 */
							iframe[src*="youtube.com"],
							iframe[src*="youtu.be"] {
								aspect-ratio: 16 / 9;
								height: auto !important;
								max-height: none !important;
							}
							/* 处理带固定宽高的iframe - 移除固定尺寸，使用响应式 */
							iframe[width],
							iframe[height] {
								max-width: 100% !important;
								width: 100% !important;
								height: auto !important;
							}
							/* 移除iframe的scrolling属性影响 */
							iframe[scrolling] {
								overflow: auto;
							}
							/* 表格自适应 */
							table { 
								border-collapse: collapse; 
								width: 100% !important;
								max-width: 100% !important;
								margin: 10px 0;
								overflow-x: auto;
								display: block;
							}
							table td, table th { 
								border: 1px solid #ddd; 
								padding: 8px; 
								word-wrap: break-word;
							}
							/* 确保容器元素不截断内容 */
							div, section, article {
								overflow: visible !important;
								max-width: 100% !important;
								width: auto !important;
							}
							/* 处理居中对齐的div */
							div[style*="text-align"] {
								width: 100% !important;
								max-width: 100% !important;
							}
							/* 文本内容 */
							p, span, h1, h2, h3, h4, h5, h6 {
								word-wrap: break-word;
								overflow-wrap: break-word;
								max-width: 100%;
							}
						</style>
					</head>
					<body>
						${htmlContent}
					</body>
					</html>
				`);
				iframeDoc.close();
				
				// 等待内容加载后，调整iframe高度以适应内容
				setTimeout(() => {
					try {
						const iframeBody = iframe.contentDocument?.body || iframe.contentWindow?.document?.body;
						if (iframeBody) {
							// 让iframe内容自然滚动，不限制高度
							iframe.style.height = '100%';
						}
					} catch (e) {
						// 跨域限制时忽略
					}
				}, 100);
			} catch (e) {
				console.error('Failed to write to iframe:', e);
				// 如果iframe写入失败，使用div显示
				this.els.content.innerHTML = htmlContent;
			}
		} else {
			// 如果没有iframe，直接使用div显示（需要处理XSS风险）
			// 这里使用innerHTML，因为数据来源是可信的（Excel导入）
			this.els.content.innerHTML = htmlContent;
		}
		
		this.els.overlay.classList.add('active');
		document.body.style.overflow = 'hidden'; // 防止背景滚动
	}
	
	/** 隐藏 */
	hide() {
		this.els.overlay.classList.remove('active');
		document.body.style.overflow = ''; // 恢复滚动
		
		// 清空内容
		const iframe = this.els.content.querySelector('iframe');
		if (iframe) {
			const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
			iframeDoc.open();
			iframeDoc.write('');
			iframeDoc.close();
		} else {
			this.els.content.innerHTML = '';
		}
	}
}

