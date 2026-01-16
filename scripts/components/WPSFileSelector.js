/**
 * WPS文件选择器组件
 * 用于显示WPS云文档文件列表，供用户选择导入
 */
export class WPSFileSelector {
  /**
   * @param {{onSelect:(file:any)=>void,onClose:()=>void}} options
   */
  constructor(options) {
    this.onSelect = options.onSelect;
    this.onClose = options.onClose;
    this.container = null;
    this.files = [];
    this.currentPage = 1;
    this.pageSize = 20;
    this.isLoading = false;
  }

  /**
   * 显示文件选择器
   */
  show() {
    if (this.container) {
      this.container.classList.remove('hidden');
      return;
    }

    this.createModal();
    this.loadFiles();
  }

  /**
   * 隐藏文件选择器
   */
  hide() {
    if (this.container) {
      this.container.classList.add('hidden');
    }
  }

  /**
   * 创建模态框
   */
  createModal() {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center';
    modal.id = 'wpsFileSelectorModal';

    modal.innerHTML = `
      <div class="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        <!-- 头部 -->
        <div class="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <i class="fas fa-cloud text-blue-600"></i> 选择WPS云文档
          </h2>
          <button id="wpsFileSelectorClose" class="text-gray-400 hover:text-gray-600 transition-colors">
            <i class="fas fa-times text-xl"></i>
          </button>
        </div>

        <!-- 文件列表 -->
        <div class="flex-1 overflow-y-auto p-4">
          <div id="wpsFileList" class="space-y-2">
            <!-- 文件列表将通过JS动态加载 -->
          </div>
          <div id="wpsFileLoading" class="text-center py-8 text-gray-500">
            <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
            <p>加载文件列表中...</p>
          </div>
          <div id="wpsFileEmpty" class="hidden text-center py-8 text-gray-500">
            <i class="fas fa-folder-open text-4xl mb-2"></i>
            <p>暂无文件</p>
          </div>
          <div id="wpsFileError" class="hidden text-center py-8 text-red-500">
            <i class="fas fa-exclamation-circle text-2xl mb-2"></i>
            <p id="wpsFileErrorMsg">加载失败</p>
          </div>
        </div>

        <!-- 底部操作栏 -->
        <div class="flex items-center justify-between p-4 border-t border-gray-200">
          <div class="text-sm text-gray-500">
            共 <span id="wpsFileCount">0</span> 个文件
          </div>
          <div class="flex items-center gap-2">
            <button id="wpsFileRefresh" class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm">
              <i class="fas fa-sync-alt"></i> 刷新
            </button>
            <button id="wpsFileCancel" class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm">
              取消
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.container = modal;

    // 绑定事件
    this.bindEvents();
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    const closeBtn = this.container.querySelector('#wpsFileSelectorClose');
    const cancelBtn = this.container.querySelector('#wpsFileCancel');
    const refreshBtn = this.container.querySelector('#wpsFileRefresh');

    const handleClose = () => {
      this.hide();
      this.onClose?.();
    };

    closeBtn?.addEventListener('click', handleClose);
    cancelBtn?.addEventListener('click', handleClose);
    refreshBtn?.addEventListener('click', () => {
      this.currentPage = 1;
      this.loadFiles();
    });

    // 点击遮罩层关闭
    this.container.addEventListener('click', (e) => {
      if (e.target === this.container) {
        handleClose();
      }
    });

    // ESC键关闭
    const handleEsc = (e) => {
      if (e.key === 'Escape' && !this.container.classList.contains('hidden')) {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleEsc);
    this.container._escHandler = handleEsc;
  }

  /**
   * 加载文件列表
   */
  async loadFiles() {
    if (this.isLoading) return;

    this.isLoading = true;
    this.showLoading();

    try {
      // 这里需要传入WPSCloudParser实例来获取文件列表
      // 为了简化，我们假设通过事件或回调传递
      if (this.loadFilesCallback) {
        const files = await this.loadFilesCallback(this.currentPage, this.pageSize);
        this.files = files;
        this.renderFiles();
      }
    } catch (error) {
      console.error('加载WPS文件列表失败:', error);
      this.showError(error.message || '加载文件列表失败');
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * 设置文件加载回调
   */
  setLoadFilesCallback(callback) {
    this.loadFilesCallback = callback;
  }

  /**
   * 渲染文件列表
   */
  renderFiles() {
    const fileList = this.container.querySelector('#wpsFileList');
    const loadingEl = this.container.querySelector('#wpsFileLoading');
    const emptyEl = this.container.querySelector('#wpsFileEmpty');
    const errorEl = this.container.querySelector('#wpsFileError');
    const countEl = this.container.querySelector('#wpsFileCount');

    // 隐藏所有状态
    loadingEl.classList.add('hidden');
    emptyEl.classList.add('hidden');
    errorEl.classList.add('hidden');

    if (this.files.length === 0) {
      emptyEl.classList.remove('hidden');
      countEl.textContent = '0';
      return;
    }

    countEl.textContent = this.files.length.toString();

    fileList.innerHTML = this.files.map(file => {
      const fileIcon = this.getFileIcon(file.name);
      const fileSize = this.formatFileSize(file.size);
      const updateTime = this.formatDate(file.updated_at || file.created_at);

      return `
        <div class="wps-file-item flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors" data-file-id="${file.id || file.file_id}">
          <div class="flex-shrink-0 text-3xl text-blue-600">
            ${fileIcon}
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-medium text-gray-900 truncate">${file.name || '未命名文件'}</div>
            <div class="text-sm text-gray-500 mt-1">
              ${fileSize} • 更新于 ${updateTime}
            </div>
          </div>
          <button class="wps-file-select-btn px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm flex-shrink-0">
            选择
          </button>
        </div>
      `;
    }).join('');

    // 绑定文件选择事件
    fileList.querySelectorAll('.wps-file-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('wps-file-select-btn')) {
          const fileId = item.dataset.fileId;
          const file = this.files.find(f => (f.id || f.file_id) === fileId);
          if (file) {
            this.onSelect?.(file);
            this.hide();
          }
        }
      });
    });
  }

  /**
   * 获取文件图标
   */
  getFileIcon(fileName) {
    const ext = fileName?.toLowerCase().split('.').pop() || '';
    if (ext === 'xlsx' || ext === 'xls') {
      return '<i class="fas fa-file-excel"></i>';
    } else if (ext === 'csv') {
      return '<i class="fas fa-file-csv"></i>';
    }
    return '<i class="fas fa-file"></i>';
  }

  /**
   * 格式化文件大小
   */
  formatFileSize(bytes) {
    if (!bytes) return '未知大小';
    const kb = bytes / 1024;
    if (kb < 1024) {
      return `${kb.toFixed(1)} KB`;
    }
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  }

  /**
   * 格式化日期
   */
  formatDate(dateString) {
    if (!dateString) return '未知时间';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return '今天';
    } else if (days === 1) {
      return '昨天';
    } else if (days < 7) {
      return `${days}天前`;
    } else {
      return date.toLocaleDateString('zh-CN');
    }
  }

  /**
   * 显示加载状态
   */
  showLoading() {
    const loadingEl = this.container.querySelector('#wpsFileLoading');
    const emptyEl = this.container.querySelector('#wpsFileEmpty');
    const errorEl = this.container.querySelector('#wpsFileError');
    const fileList = this.container.querySelector('#wpsFileList');

    loadingEl.classList.remove('hidden');
    emptyEl.classList.add('hidden');
    errorEl.classList.add('hidden');
    fileList.innerHTML = '';
  }

  /**
   * 显示错误状态
   */
  showError(message) {
    const loadingEl = this.container.querySelector('#wpsFileLoading');
    const emptyEl = this.container.querySelector('#wpsFileEmpty');
    const errorEl = this.container.querySelector('#wpsFileError');
    const errorMsg = this.container.querySelector('#wpsFileErrorMsg');
    const fileList = this.container.querySelector('#wpsFileList');

    loadingEl.classList.add('hidden');
    emptyEl.classList.add('hidden');
    errorEl.classList.remove('hidden');
    errorMsg.textContent = message;
    fileList.innerHTML = '';
  }

  /**
   * 销毁组件
   */
  destroy() {
    if (this.container) {
      if (this.container._escHandler) {
        document.removeEventListener('keydown', this.container._escHandler);
      }
      this.container.remove();
      this.container = null;
    }
  }
}
