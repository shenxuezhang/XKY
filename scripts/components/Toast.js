/**
 * Toast 提示组件
 * 功能：显示操作成功/失败/警告等提示信息
 */
export class Toast {
	constructor() {
		this.container = null;
		this.init();
	}
	
	/**
	 * 初始化Toast容器
	 */
	init() {
		// 创建Toast容器
		this.container = document.createElement('div');
		this.container.id = 'toastContainer';
		this.container.className = 'toast-container';
		document.body.appendChild(this.container);
	}
	
	/**
	 * 显示Toast提示
	 * @param {string} message - 提示消息
	 * @param {string} type - 类型：success/error/warning/info
	 * @param {number} duration - 显示时长（毫秒），默认3000
	 */
	show(message, type = 'info', duration = 3000) {
		if (!this.container) this.init();
		
		const toast = document.createElement('div');
		toast.className = `toast toast-${type}`;
		
		// 图标映射
		const icons = {
			success: '<i class="fas fa-check-circle"></i>',
			error: '<i class="fas fa-exclamation-circle"></i>',
			warning: '<i class="fas fa-exclamation-triangle"></i>',
			info: '<i class="fas fa-info-circle"></i>'
		};
		
		toast.innerHTML = `
			<div class="toast-content">
				<span class="toast-icon">${icons[type] || icons.info}</span>
				<span class="toast-message">${this.escapeHtml(message)}</span>
			</div>
			<button class="toast-close" aria-label="关闭">
				<i class="fas fa-times"></i>
			</button>
		`;
		
		// 添加到容器
		this.container.appendChild(toast);
		
		// 触发动画
		setTimeout(() => toast.classList.add('show'), 10);
		
		// 关闭按钮事件
		const closeBtn = toast.querySelector('.toast-close');
		const closeToast = () => {
			toast.classList.remove('show');
			setTimeout(() => {
				if (toast.parentNode) {
					toast.parentNode.removeChild(toast);
				}
			}, 300);
		};
		
		closeBtn.addEventListener('click', closeToast);
		
		// 自动关闭
		if (duration > 0) {
			setTimeout(closeToast, duration);
		}
		
		return toast;
	}
	
	/**
	 * 显示成功提示
	 */
	success(message, duration = 3000) {
		return this.show(message, 'success', duration);
	}
	
	/**
	 * 显示错误提示
	 */
	error(message, duration = 4000) {
		return this.show(message, 'error', duration);
	}
	
	/**
	 * 显示警告提示
	 */
	warning(message, duration = 3000) {
		return this.show(message, 'warning', duration);
	}
	
	/**
	 * 显示信息提示
	 */
	info(message, duration = 3000) {
		return this.show(message, 'info', duration);
	}
	
	/**
	 * 转义HTML
	 */
	escapeHtml(text) {
		const div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML;
	}
}

