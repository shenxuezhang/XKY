/**
 * WPS云文档解析器
 * 负责与后端通信，获取WPS云文档数据
 */
export class WPSCloudParser {
  /**
   * @param {{onProgress:(p:number)=>void,onLoading:(b:boolean,text?:string)=>void,onError:(msg:string)=>void,onSuccess:(rows:any[])=>void}} hooks 
   */
  constructor(hooks) {
    this.hooks = hooks;
    // 浏览器环境不支持process.env，使用window对象或直接使用字符串
    this.apiBaseUrl = (typeof window !== 'undefined' && window.API_BASE_URL) || 'http://localhost:3000/api';
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiresAt = null;
    
    // 从localStorage加载token（需要检查是否在浏览器环境）
    if (typeof window !== 'undefined' && window.localStorage) {
      this.loadToken();
    }
  }

  /**
   * 从localStorage加载token
   */
  loadToken() {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return;
      }
      const tokenData = localStorage.getItem('wps_token_data');
      if (tokenData) {
        const data = JSON.parse(tokenData);
        this.accessToken = data.access_token;
        this.refreshToken = data.refresh_token;
        this.tokenExpiresAt = data.expires_at;
        
        // 检查token是否过期
        if (this.tokenExpiresAt && Date.now() >= this.tokenExpiresAt) {
          this.clearToken();
        }
      }
    } catch (error) {
      console.error('加载WPS token失败:', error);
      this.clearToken();
    }
  }

  /**
   * 保存token到localStorage
   */
  saveToken(accessToken, refreshToken, expiresIn) {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return;
      }
      const expiresAt = Date.now() + (expiresIn - 300) * 1000; // 提前5分钟过期
      const tokenData = {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt
      };
      localStorage.setItem('wps_token_data', JSON.stringify(tokenData));
      this.accessToken = accessToken;
      this.refreshToken = refreshToken;
      this.tokenExpiresAt = expiresAt;
    } catch (error) {
      console.error('保存WPS token失败:', error);
    }
  }

  /**
   * 清除token
   */
  clearToken() {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem('wps_token_data');
    }
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiresAt = null;
  }

  /**
   * 检查授权状态
   */
  async checkAuthorization() {
    if (!this.accessToken) {
      return false;
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/wps/check-auth`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      });

      const result = await response.json();
      return result.success && result.data?.authorized === true;
    } catch (error) {
      console.error('检查WPS授权状态失败:', error);
      return false;
    }
  }

  /**
   * 获取授权URL
   */
  async getAuthUrl() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/wps/auth-url`);
      const result = await response.json();
      
      if (result.success) {
        return result.data.authUrl;
      } else {
        throw new Error(result.error?.message || '获取授权URL失败');
      }
    } catch (error) {
      console.error('获取WPS授权URL失败:', error);
      throw error;
    }
  }

  /**
   * 请求WPS授权
   */
  async requestAuthorization() {
    try {
      const authUrl = await this.getAuthUrl();
      // 打开新窗口进行授权
      const authWindow = window.open(
        authUrl,
        'WPS授权',
        'width=600,height=700,scrollbars=yes'
      );

      // 监听授权结果
      return new Promise((resolve, reject) => {
        const checkClosed = setInterval(() => {
          if (authWindow.closed) {
            clearInterval(checkClosed);
            window.removeEventListener('message', handleMessage);
            // 检查是否有token
            if (this.accessToken) {
              resolve(true);
            } else {
              reject(new Error('授权已取消'));
            }
          }
        }, 500);

        // 监听postMessage事件（从授权成功页面发送消息）
        const handleMessage = (e) => {
          // 安全检查：允许来自localhost和127.0.0.1的消息
          const allowedOrigins = [
            window.location.origin,
            'http://localhost:8080',
            'http://127.0.0.1:8080',
            'http://localhost:5173',
            'http://127.0.0.1:5173'
          ];
          
          if (!allowedOrigins.some(allowed => e.origin.includes(allowed.replace(/^https?:\/\//, '').split(':')[0]))) {
            return;
          }
          
          if (e.data && e.data.type === 'WPS_AUTH_SUCCESS' && e.data.tokenData) {
            clearInterval(checkClosed);
            window.removeEventListener('message', handleMessage);
            // 保存token
            this.saveToken(
              e.data.tokenData.access_token,
              e.data.tokenData.refresh_token,
              Math.floor((e.data.tokenData.expires_at - Date.now()) / 1000)
            );
            if (authWindow && !authWindow.closed) {
              authWindow.close();
            }
            resolve(true);
          }
        };
        window.addEventListener('message', handleMessage);

        // 监听storage事件（备用方案）
        const handleStorage = (e) => {
          if (e.key === 'wps_token_data' && e.newValue) {
            clearInterval(checkClosed);
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener('message', handleMessage);
            this.loadToken();
            if (authWindow && !authWindow.closed) {
              authWindow.close();
            }
            resolve(true);
          }
        };
        window.addEventListener('storage', handleStorage);

        // 超时处理
        setTimeout(() => {
          clearInterval(checkClosed);
          window.removeEventListener('message', handleMessage);
          window.removeEventListener('storage', handleStorage);
          if (!this.accessToken) {
            reject(new Error('授权超时'));
          }
        }, 300000); // 5分钟超时
      });
    } catch (error) {
      console.error('WPS授权失败:', error);
      throw error;
    }
  }

  /**
   * 刷新token
   */
  async refreshAccessToken() {
    if (!this.refreshToken) {
      throw new Error('没有refresh_token，请重新授权');
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/wps/refresh-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          refresh_token: this.refreshToken
        })
      });

      const result = await response.json();
      
      if (result.success) {
        this.saveToken(
          result.data.access_token,
          result.data.refresh_token,
          result.data.expires_in
        );
        return true;
      } else {
        throw new Error(result.error?.message || '刷新token失败');
      }
    } catch (error) {
      console.error('刷新WPS token失败:', error);
      this.clearToken();
      throw error;
    }
  }

  /**
   * 获取文件列表
   */
  async getFileList(page = 1, pageSize = 50) {
    // 检查token是否过期
    if (this.tokenExpiresAt && Date.now() >= this.tokenExpiresAt) {
      await this.refreshAccessToken();
    }

    if (!this.accessToken) {
      throw new Error('未授权，请先登录WPS账号');
    }

    try {
      const response = await fetch(
        `${this.apiBaseUrl}/wps/files?page=${page}&pageSize=${pageSize}&fileType=spreadsheet`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      );

      const result = await response.json();
      
      if (result.success) {
        return result.data.files || [];
      } else {
        if (result.error?.code === 'UNAUTHORIZED') {
          // Token失效，尝试刷新
          await this.refreshAccessToken();
          return this.getFileList(page, pageSize);
        }
        throw new Error(result.error?.message || '获取文件列表失败');
      }
    } catch (error) {
      console.error('获取WPS文件列表失败:', error);
      throw error;
    }
  }

  /**
   * 导入文件
   */
  async importFile(fileId) {
    // 检查token是否过期
    if (this.tokenExpiresAt && Date.now() >= this.tokenExpiresAt) {
      await this.refreshAccessToken();
    }

    if (!this.accessToken) {
      throw new Error('未授权，请先登录WPS账号');
    }

    this.hooks?.onLoading?.(true, '从WPS导入中...');
    this.hooks?.onProgress?.(0);

    try {
      this.hooks?.onProgress?.(30);
      
      const response = await fetch(
        `${this.apiBaseUrl}/wps/import/${fileId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      );

      this.hooks?.onProgress?.(70);

      const result = await response.json();
      
      if (result.success) {
        this.hooks?.onProgress?.(100);
        this.hooks?.onSuccess?.(result.data.rows);
        return result.data;
      } else {
        if (result.error?.code === 'UNAUTHORIZED') {
          // Token失效，尝试刷新后重试
          await this.refreshAccessToken();
          return this.importFile(fileId);
        }
        throw new Error(result.error?.message || '导入文件失败');
      }
    } catch (error) {
      console.error('导入WPS文件失败:', error);
      this.hooks?.onError?.(error.message || '导入文件失败');
      throw error;
    } finally {
      this.hooks?.onLoading?.(false);
    }
  }

  /**
   * 登出WPS账号
   */
  logout() {
    this.clearToken();
  }
}
