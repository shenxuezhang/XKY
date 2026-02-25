/**
 * Tabs 组件：标准标签页系统（SPA 路由风格）
 * 功能：标签列表、内容面板、状态管理、路由同步
 */
const TABS_STATE_KEY = 'emag_tabs_state_v1';

export class Tabs {
	/**
	 * @param {{listContainer:HTMLElement, panelsContainer:HTMLElement, initialState?:Object}} config
	 */
	constructor(config) {
		this.listContainer = config.listContainer;
		this.panelsContainer = config.panelsContainer;
		this.state = {
			activeTabId: null,
			tabs: [],
			panels: []
		};
		this.initialState = config.initialState || null;
		this.routeMap = new Map(); // 路由映射：route -> tabId
		this.listeners = new Map(); // 事件监听器
		// 预定义面板ID列表（HTML中已存在的面板，关闭时不应从DOM移除）
		this.predefinedPanelIds = new Set(['tab-home', 'tab-dashboard', 'tab-profit-calculator']);
	}

	/**
	 * 初始化组件
	 */
	init() {
		if (!this.listContainer || !this.panelsContainer) {
			console.error('Tabs: 缺少必要的容器元素');
			return;
		}
		
		this.loadState();
		
		// 如果从 localStorage 恢复了状态，需要恢复面板引用
		// 注意：路由映射已在 loadState 中恢复
		if (this.state.tabs.length > 0 && this.state.panels.length === 0) {
			this.restorePanelsFromDOM();
		}
		
		// 如果状态为空，使用初始状态（只包含首页）
		if (this.state.tabs.length === 0) {
			if (this.initialState) {
				// 使用初始状态（只包含首页）
				this.state.activeTabId = this.initialState.activeTabId || null;
				this.state.tabs = this.initialState.tabs.map(tab => ({
					...tab,
					route: tab.route || (tab.id === 'tab-home' ? 'home' : tab.id === 'tab-dashboard' ? 'dashboard' : null)
				}));
				// 建立路由映射
				this.state.tabs.forEach(tab => {
					if (tab.route) {
						this.routeMap.set(tab.route, tab.id);
					}
				});
				// 从 DOM 恢复面板引用
				this.state.panels = [];
				this.state.tabs.forEach(tab => {
					const panelEl = this.panelsContainer.querySelector(`[data-panel-id="${tab.id}"]`);
					if (panelEl) {
						this.state.panels.push({
							id: tab.id,
							content: panelEl
						});
					}
				});
			} else {
				// 如果没有初始状态，只加载首页
				const homePanelEl = this.panelsContainer.querySelector(`[data-panel-id="tab-home"]`);
				if (homePanelEl) {
					this.state.tabs.push({
						id: 'tab-home',
						label: '首页',
						icon: 'fa-home',
						closable: false,
						route: 'home'
					});
					this.state.panels.push({
						id: 'tab-home',
						content: homePanelEl
					});
					this.routeMap.set('home', 'tab-home');
					if (!this.state.activeTabId) {
						this.state.activeTabId = 'tab-home';
					}
				}
			}
		}
		
		// 确保首页始终存在（如果不存在则添加）
		if (!this.state.tabs.find(t => t.id === 'tab-home')) {
			const homePanelEl = this.panelsContainer.querySelector(`[data-panel-id="tab-home"]`);
			if (homePanelEl) {
				this.state.tabs.unshift({
					id: 'tab-home',
					label: '首页',
					icon: 'fa-home',
					closable: false,
					route: 'home'
				});
				this.state.panels.unshift({
					id: 'tab-home',
					content: homePanelEl
				});
				this.routeMap.set('home', 'tab-home');
			}
		}
		
		// 确保路由映射中包含 dashboard（即使标签未创建，也要建立路由映射以便 switchByRoute 能找到）
		if (!this.routeMap.has('dashboard')) {
			const dashboardPanelEl = this.panelsContainer.querySelector(`[data-panel-id="tab-dashboard"]`);
			if (dashboardPanelEl) {
				// 建立路由映射，但不创建标签（用户点击时才创建）
				this.routeMap.set('dashboard', 'tab-dashboard');
			}
		}
		
		if (this.state.tabs.length > 0 && !this.state.activeTabId) {
			// 尝试从 URL hash 恢复路由
			const hash = window.location.hash.replace('#/', '');
			if (hash && this.routeMap.has(hash)) {
				// 如果路由存在但标签不存在，需要创建标签
				const tabId = this.routeMap.get(hash);
				if (!this.state.tabs.find(t => t.id === tabId)) {
					this.switchByRoute(hash);
				} else {
					this.state.activeTabId = tabId;
				}
			} else {
				this.state.activeTabId = this.state.tabs[0].id;
			}
		}
		
		this.updateRoute();
		this.updateSidebarNav();
		this.renderTabList();
		this.renderPanels();
		
		// 监听路由变化
		this.initRouter();
		
		// 确保路由映射已建立（延迟执行，确保DOM完全加载）
		// 使用requestAnimationFrame确保DOM渲染完成
		requestAnimationFrame(() => {
			if (!this.routeMap.has('dashboard')) {
				const dashboardPanelEl = this.panelsContainer?.querySelector(`[data-panel-id="tab-dashboard"]`);
				if (dashboardPanelEl) {
					this.routeMap.set('dashboard', 'tab-dashboard');
				}
			}
			if (!this.routeMap.has('profit-calculator')) {
				const profitCalculatorPanelEl = this.panelsContainer?.querySelector(`[data-panel-id="tab-profit-calculator"]`);
				if (profitCalculatorPanelEl) {
					this.routeMap.set('profit-calculator', 'tab-profit-calculator');
				}
			}
		});
	}
	
	/**
	 * 确保所有DOM中存在的面板都被注册到状态中
	 */
	ensurePanelsRegistered() {
		const existingPanels = this.panelsContainer.querySelectorAll('.tabs-panel[data-panel-id]');
		existingPanels.forEach(panelEl => {
			const panelId = panelEl.getAttribute('data-panel-id');
			if (!panelId) return;
			
			// 检查是否已在状态中
			const existingTab = this.state.tabs.find(t => t.id === panelId);
			if (!existingTab) {
				// 未注册的面板，添加到状态中
				let label = '未命名';
				let icon = '';
				let closable = true;
				
				if (panelId === 'tab-home') {
					label = '首页';
					icon = 'fa-home';
					closable = false;
				} else if (panelId === 'tab-dashboard') {
					label = '产品海选看板';
					icon = 'fa-chart-line';
					closable = true;
				} else if (panelId === 'tab-profit-calculator') {
					label = '利润测算';
					icon = 'fa-calculator';
					closable = true;
				}
				
				const route = panelId === 'tab-home' ? 'home' : panelId === 'tab-dashboard' ? 'dashboard' : panelId === 'tab-profit-calculator' ? 'profit-calculator' : null;
				this.state.tabs.push({
					id: panelId,
					label: label,
					icon: icon,
					closable: closable,
					route: route
				});
				this.state.panels.push({
					id: panelId,
					content: panelEl
				});
				// 建立路由映射
				if (route) {
					this.routeMap.set(route, panelId);
				}
			} else {
				// 已存在的标签，确保路由映射正确
				if (existingTab.route && !this.routeMap.has(existingTab.route)) {
					this.routeMap.set(existingTab.route, panelId);
				}
				// 确保面板引用正确
				const existingPanel = this.state.panels.find(p => p.id === panelId);
				if (!existingPanel) {
					this.state.panels.push({
						id: panelId,
						content: panelEl
					});
				}
			}
		});
	}
	
	/**
	 * 初始化路由监听
	 * 修复：确保侧边栏导航点击能正确触发标签切换
	 */
	initRouter() {
		// 监听 hash 变化
		window.addEventListener('hashchange', () => {
			const hash = window.location.hash.replace('#/', '');
			if (hash) {
				this.switchByRoute(hash);
			}
		});
		
		// 修复：直接在导航项上绑定事件（确保事件能触发）
		const bindNavItems = () => {
			const navItems = document.querySelectorAll('.app-sidebar__item[data-route]');
			navItems.forEach(item => {
				// 移除旧的事件监听器（如果存在）
				const oldHandler = item._navClickHandler;
				if (oldHandler) {
					item.removeEventListener('click', oldHandler);
				}
				
				// 创建新的事件处理器
				const handler = (e) => {
					e.preventDefault();
					e.stopPropagation();
					const route = item.getAttribute('data-route');
					if (route) {
						// 确保路由映射存在
						if (!this.routeMap.has(route)) {
							const panelId = route === 'home' ? 'tab-home' : route === 'dashboard' ? 'tab-dashboard' : route === 'profit-calculator' ? 'tab-profit-calculator' : null;
							if (panelId) {
								const panelEl = this.panelsContainer?.querySelector(`[data-panel-id="${panelId}"]`);
								if (panelEl) {
									this.routeMap.set(route, panelId);
								}
							}
						}
						this.switchByRoute(route);
					}
				};
				
				// 保存处理器引用，以便后续移除
				item._navClickHandler = handler;
				item.addEventListener('click', handler);
			});
		};
		
		// 立即绑定
		bindNavItems();
		
		// 延迟再次绑定（确保 DOM 完全加载）
		setTimeout(bindNavItems, 100);
		setTimeout(bindNavItems, 500);
	}

	/**
	 * 添加标签（参考模板：如果标签已存在则激活，否则添加）
	 * @param {{id:string, label:string, icon?:string, closable?:boolean, content:HTMLElement|string, route?:string}} tabConfig
	 */
	addTab(tabConfig) {
		if (!tabConfig || !tabConfig.id || !tabConfig.label) {
			console.error('Tabs: addTab 参数不完整');
			return;
		}
		
		// 参考模板逻辑：如果标签已存在，直接激活
		const existingTab = this.state.tabs.find(t => t.id === tabConfig.id);
		if (existingTab) {
			this.switchTab(tabConfig.id);
			return;
		}
		
		// 添加新标签
		this.state.tabs.push({
			id: tabConfig.id,
			label: tabConfig.label,
			icon: tabConfig.icon || '',
			closable: tabConfig.closable !== false,
			route: tabConfig.route || null
		});
		
		// 处理面板内容
		let panelContent = tabConfig.content;
		if (!panelContent) {
			// 如果没提供内容，尝试从 DOM 查找
			panelContent = this.panelsContainer.querySelector(`[data-panel-id="${tabConfig.id}"]`);
		}
		
		this.state.panels.push({
			id: tabConfig.id,
			content: panelContent
		});
		
		if (tabConfig.route) {
			this.routeMap.set(tabConfig.route, tabConfig.id);
		}
		
		this.state.activeTabId = tabConfig.id;
		this.saveState();
		this.updateRoute();
		this.updateSidebarNav();
		this.renderTabList();
		this.renderPanels();
		
		// 触发标签切换事件
		this.emit('tabSwitch', tabConfig.id);
	}

	/**
	 * 移除标签（预定义面板只隐藏，不从DOM移除）
	 * @param {string} tabId
	 */
	removeTab(tabId) {
		if (tabId === 'tab-home') {
			return;
		}
		
		if (this.state.tabs.length <= 1) {
			return;
		}
		
		const tabIndex = this.state.tabs.findIndex(t => t.id === tabId);
		if (tabIndex === -1) return;
		
		// 参考模板：如果关闭的是当前激活标签，切换到前一个标签
		const wasActive = this.state.activeTabId === tabId;
		
		// 获取要删除的标签信息（在删除前）
		const removedTab = this.state.tabs[tabIndex];
		const isPredefined = this.predefinedPanelIds.has(tabId);
		
		// 从状态中移除
		this.state.tabs.splice(tabIndex, 1);
		this.state.panels.splice(tabIndex, 1);
		
		// 更新路由映射（删除已移除标签的路由）
		if (removedTab && removedTab.route) {
			this.routeMap.delete(removedTab.route);
		}
		
		// 对于预定义面板，只隐藏，不从DOM移除
		if (isPredefined && this.panelsContainer) {
			const panelEl = this.panelsContainer.querySelector(`[data-panel-id="${tabId}"]`);
			if (panelEl) {
				panelEl.setAttribute('aria-hidden', 'true');
				panelEl.classList.remove('tabs-panel--active');
			}
		}
		
		if (wasActive) {
			// 切换到前一个标签，如果没有则切换到第一个
			const newIndex = Math.max(0, tabIndex - 1);
			this.state.activeTabId = this.state.tabs[newIndex]?.id || this.state.tabs[0]?.id || null;
		}
		
		this.saveState();
		this.updateRoute();
		this.updateSidebarNav();
		this.renderTabList();
		this.renderPanels();
	}

	/**
	 * 切换标签（参考模板的 activateTab 逻辑）
	 * 修复：确保面板正确显示
	 * @param {string} tabId
	 */
	switchTab(tabId) {
		if (!this.state.tabs.find(t => t.id === tabId)) {
			return;
		}
		this.state.activeTabId = tabId;
		this.saveState();
		this.updateRoute();
		this.updateSidebarNav();
		this.renderTabList();
		this.renderPanels();
		
		// 触发标签切换事件
		this.emit('tabSwitch', tabId);
	}
	
	/**
	 * 订阅事件
	 */
	on(event, callback) {
		if (!this.listeners) this.listeners = new Map();
		if (!this.listeners.has(event)) this.listeners.set(event, new Set());
		this.listeners.get(event).add(callback);
		return () => this.listeners.get(event)?.delete(callback);
	}
	
	/**
	 * 触发事件
	 */
	emit(event, payload) {
		if (!this.listeners) return;
		const callbacks = this.listeners.get(event);
		if (callbacks) {
			callbacks.forEach(cb => cb(payload));
		}
	}
	
	/**
	 * 根据路由切换标签（如果标签不存在则创建，用户主动打开时保存状态）
	 * 修复：确保面板正确显示
	 * @param {string} route
	 */
	switchByRoute(route) {
		
		// 检查容器是否存在
		if (!this.panelsContainer) {
			console.error('Tabs: panelsContainer 未初始化');
			this.panelsContainer = document.getElementById('tabsPanels');
			if (!this.panelsContainer) {
				console.error('Tabs: 无法找到 tabsPanels 容器');
				return;
			}
		}
		
		// 如果路由映射不存在，先尝试建立映射
		if (!this.routeMap.has(route)) {
			const panelId = route === 'home' ? 'tab-home' : route === 'dashboard' ? 'tab-dashboard' : route === 'profit-calculator' ? 'tab-profit-calculator' : null;
			if (panelId) {
				const panelEl = this.panelsContainer.querySelector(`[data-panel-id="${panelId}"]`);
				if (panelEl) {
					this.routeMap.set(route, panelId);
				}
			}
		}
		
		let tabId = this.routeMap.get(route);
		
		// 如果路由映射存在，检查标签是否已创建
		if (tabId) {
			const existingTab = this.state.tabs.find(t => t.id === tabId);
			if (existingTab) {
				// 标签已存在，直接切换
				this.switchTab(tabId);
				return;
			}
			// 路由映射存在但标签不存在，继续创建标签
		}
		
		// 如果标签不存在，尝试从 DOM 创建或恢复（用户主动打开）
		const panelId = route === 'home' ? 'tab-home' : route === 'dashboard' ? 'tab-dashboard' : route === 'profit-calculator' ? 'tab-profit-calculator' : null;
		
		if (!panelId) {
			return;
		}
		
		// 查找面板元素（querySelector 可以找到隐藏的元素）
		const panelEl = this.panelsContainer.querySelector(`[data-panel-id="${panelId}"]`);
		
		if (!panelEl) {
			console.error('Tabs: 找不到面板元素', panelId, '在容器', this.panelsContainer);
			// 如果找不到面板，尝试延迟查找（DOM可能还未完全加载）
			setTimeout(() => {
				const retryPanelEl = this.panelsContainer.querySelector(`[data-panel-id="${panelId}"]`);
				if (retryPanelEl) {
					this.routeMap.set(route, panelId);
					this.switchByRoute(route);
				} else {
					console.error('Tabs: 延迟查找仍然失败', panelId);
				}
			}, 100);
			return;
		}
		
		let label = '未命名';
		let icon = '';
		let closable = true;
		
		if (panelId === 'tab-home') {
			label = '首页';
			icon = 'fa-home';
			closable = false;
		} else if (panelId === 'tab-dashboard') {
			label = '产品海选看板';
			icon = 'fa-chart-line';
			closable = true;
		} else if (panelId === 'tab-profit-calculator') {
			label = '利润测算';
			icon = 'fa-calculator';
			closable = true;
		}
		
		// 用户主动打开标签，添加到状态并保存
		this.addTab({
			id: panelId,
			label: label,
			icon: icon,
			closable: closable,
			content: panelEl,
			route: route
		});
	}
	
	/**
	 * 更新 URL hash 路由
	 */
	updateRoute() {
		const tab = this.state.tabs.find(t => t.id === this.state.activeTabId);
		if (tab && tab.route) {
			window.location.hash = `#/${tab.route}`;
		}
	}
	
	/**
	 * 更新侧边栏导航状态
	 */
	updateSidebarNav() {
		const navItems = document.querySelectorAll('.app-sidebar__item[data-route]');
		navItems.forEach(item => {
			const route = item.getAttribute('data-route');
			const tab = this.state.tabs.find(t => t.route === route);
			if (tab && tab.id === this.state.activeTabId) {
				item.classList.add('active');
			} else {
				item.classList.remove('active');
			}
		});
	}

	/**
	 * 渲染标签列表
	 */
	renderTabList() {
		if (!this.listContainer) return;
		this.listContainer.innerHTML = '';
		
		this.state.tabs.forEach(tab => {
			const item = document.createElement('button');
			item.className = 'tabs-item';
			item.setAttribute('role', 'tab');
			item.setAttribute('aria-selected', this.state.activeTabId === tab.id ? 'true' : 'false');
			item.setAttribute('data-tab-id', tab.id);
			
			if (this.state.activeTabId === tab.id) {
				item.classList.add('tabs-item--active');
			}
			
			const icon = tab.icon ? `<i class="fas ${tab.icon}"></i>` : '';
			// 参考模板：首页不可关闭，其他标签在至少有两个标签时可关闭
			const isClosable = tab.closable !== false && tab.id !== 'tab-home' && this.state.tabs.length > 1;
			const closeBtn = isClosable
				? `<button class="tabs-item__close" aria-label="关闭标签" data-tab-id="${tab.id}"><i class="fas fa-times"></i></button>`
				: '';
			
			item.innerHTML = `
				${icon}
				<span class="tabs-item__label">${tab.label}</span>
				${closeBtn}
			`;
			
			item.addEventListener('click', (e) => {
				if (e.target.closest('.tabs-item__close')) {
					e.stopPropagation();
					this.removeTab(tab.id);
				} else {
					this.switchTab(tab.id);
				}
			});
			
			this.listContainer.appendChild(item);
		});
	}

	/**
	 * 渲染内容面板
	 * 修复：确保所有预定义面板（包括HTML中已存在的）都能正确显示/隐藏
	 */
	renderPanels() {
		if (!this.panelsContainer) return;
		
		// 检查已存在的面板，避免重复创建
		const existingPanels = new Map();
		this.panelsContainer.querySelectorAll('.tabs-panel').forEach(el => {
			const panelId = el.getAttribute('data-panel-id');
			if (panelId) {
				existingPanels.set(panelId, el);
			}
		});
		
		// 修复：先处理所有预定义面板（包括HTML中已存在但不在state中的）
		// 确保预定义面板的状态正确更新，即使标签还未创建
		this.predefinedPanelIds.forEach(panelId => {
			const panelEl = existingPanels.get(panelId);
			if (panelEl) {
				// 检查该面板是否在state中（即标签是否已创建）
				const isInState = this.state.panels.find(p => p.id === panelId);
				const isActive = this.state.activeTabId === panelId;
				
				// 更新面板状态：只有激活的面板才显示
				panelEl.setAttribute('aria-hidden', isActive ? 'false' : 'true');
				if (isActive) {
					panelEl.classList.add('tabs-panel--active');
				} else {
					panelEl.classList.remove('tabs-panel--active');
				}
			}
		});
		
		// 移除不在状态中的面板（预定义面板除外，只隐藏）
		existingPanels.forEach((el, id) => {
			if (!this.state.panels.find(p => p.id === id)) {
				if (this.predefinedPanelIds.has(id)) {
					// 预定义面板只隐藏，不从DOM移除（已在上面处理）
					// 这里不需要再次处理
				} else {
					// 动态创建的面板可以移除
					el.remove();
				}
			}
		});
		
		// 处理state中的面板（确保state中的面板状态正确）
		this.state.panels.forEach(panel => {
			let panelEl = existingPanels.get(panel.id);
			
			if (!panelEl) {
				// 创建新面板
				if (panel.content instanceof HTMLElement) {
					panelEl = panel.content;
					if (!panelEl.classList.contains('tabs-panel')) {
						panelEl.classList.add('tabs-panel');
					}
				} else {
					panelEl = document.createElement('div');
					panelEl.className = 'tabs-panel';
					if (typeof panel.content === 'string') {
						panelEl.innerHTML = panel.content;
					}
				}
				panelEl.setAttribute('role', 'tabpanel');
				panelEl.setAttribute('data-panel-id', panel.id);
				this.panelsContainer.appendChild(panelEl);
			}
			
			// 更新面板状态（确保state中的面板状态正确）
			const isActive = this.state.activeTabId === panel.id;
			panelEl.setAttribute('aria-hidden', isActive ? 'false' : 'true');
			if (isActive) {
				panelEl.classList.add('tabs-panel--active');
			} else {
				panelEl.classList.remove('tabs-panel--active');
			}
		});
	}

	/**
	 * 保存状态到 localStorage（只保存用户主动打开的标签，排除预定义面板的自动加载）
	 */
	saveState() {
		try {
			// 过滤标签：只保存用户主动打开的标签
			// 首页始终保存，其他预定义面板只有在用户主动打开时才保存
			const tabsToSave = this.state.tabs.filter(tab => {
				// 首页始终保存
				if (tab.id === 'tab-home') {
					return true;
				}
				// 其他预定义面板：只有在状态中存在且不是自动加载的才保存
				// 这里我们保存所有非首页的标签，因为如果它们在状态中，说明用户已经打开过
				return true;
			}).map(t => ({
				id: t.id,
				label: t.label,
				icon: t.icon,
				closable: t.closable,
				route: t.route // 保存路由信息以便恢复
			}));
			
			const stateToSave = {
				activeTabId: this.state.activeTabId,
				tabs: tabsToSave
			};
			localStorage.setItem(TABS_STATE_KEY, JSON.stringify(stateToSave));
		} catch (e) {
			console.error('Tabs: 保存状态失败', e);
		}
	}

	/**
	 * 从 localStorage 恢复状态（只恢复用户主动打开过的标签）
	 */
	loadState() {
		try {
			const saved = localStorage.getItem(TABS_STATE_KEY);
			if (saved) {
				const parsed = JSON.parse(saved);
				// 恢复标签列表（只恢复用户主动打开过的）
				if (parsed.tabs && Array.isArray(parsed.tabs)) {
					this.state.tabs = parsed.tabs.map(tab => ({
						...tab,
						// 确保路由信息正确
						route: tab.route || (tab.id === 'tab-home' ? 'home' : tab.id === 'tab-dashboard' ? 'dashboard' : null)
					}));
					// 恢复路由映射
					this.state.tabs.forEach(tab => {
						if (tab.route) {
							this.routeMap.set(tab.route, tab.id);
						}
					});
					// 恢复激活标签ID
					this.state.activeTabId = parsed.activeTabId || null;
					// 确保首页始终存在
					if (!this.state.tabs.find(t => t.id === 'tab-home')) {
						this.state.tabs.unshift({
							id: 'tab-home',
							label: '首页',
							icon: 'fa-home',
							closable: false,
							route: 'home'
						});
						this.routeMap.set('home', 'tab-home');
					}
					// 如果没有激活标签，默认激活首页
					if (!this.state.activeTabId) {
						this.state.activeTabId = 'tab-home';
					}
				}
				// 注意：panels 需要从 DOM 中恢复，因为 content 是 HTMLElement
			}
		} catch (e) {
			console.error('Tabs: 恢复状态失败', e);
		}
	}
	
	/**
	 * 从 DOM 恢复面板引用
	 */
	restorePanelsFromDOM() {
		if (!this.panelsContainer) return;
		this.state.panels = [];
		this.state.tabs.forEach(tab => {
			const panelEl = this.panelsContainer.querySelector(`[data-panel-id="${tab.id}"]`);
			if (panelEl) {
				this.state.panels.push({
					id: tab.id,
					content: panelEl
				});
			}
		});
	}
}

