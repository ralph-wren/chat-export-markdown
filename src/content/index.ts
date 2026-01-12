import { ExtractionResult, ChatMessage } from '../utils/types';
import { Readability } from '@mozilla/readability';
import { showDebugPanel, startDebugSession, stopDebugSession, getDebugSessionStatus } from '../utils/remoteDebug';

console.log('Chat Export Content Script Loaded');

// ============================================
// 处理 bfcache (back/forward cache) 问题
// 当页面从缓存恢复时，扩展的消息通道会关闭
// 需要重新建立连接
// ============================================

/**
 * 检测扩展连接是否有效
 */
function isExtensionConnected(): boolean {
  try {
    // 尝试访问 chrome.runtime.id，如果扩展上下文无效会抛出异常
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

/**
 * 重新加载 content script（通过刷新页面）
 */
function reconnectExtension(): void {
  console.log('[Memoraid] 检测到扩展连接断开，正在重新连接...');
  
  // 显示提示信息
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    z-index: 2147483647;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: fadeIn 0.3s ease;
  `;
  toast.innerHTML = '🔄 Memoraid 正在重新连接...';
  document.body.appendChild(toast);
  
  // 1秒后刷新页面以重新建立连接
  setTimeout(() => {
    window.location.reload();
  }, 1000);
}

// 监听页面从 bfcache 恢复事件
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    // 页面是从 bfcache 恢复的
    console.log('[Memoraid] 页面从 bfcache 恢复');
    
    // 检查扩展连接是否有效
    if (!isExtensionConnected()) {
      reconnectExtension();
    } else {
      // 连接有效，尝试发送一个测试消息确认
      try {
        chrome.runtime.sendMessage({ type: 'PING' }, (_response) => {
          if (chrome.runtime.lastError) {
            console.warn('[Memoraid] 扩展连接已断开:', chrome.runtime.lastError.message);
            reconnectExtension();
          } else {
            console.log('[Memoraid] 扩展连接正常');
          }
        });
      } catch (e) {
        console.warn('[Memoraid] 扩展连接检测失败:', e);
        reconnectExtension();
      }
    }
  }
});

// 监听页面即将进入 bfcache 事件（用于清理）
window.addEventListener('pagehide', (event) => {
  if (event.persisted) {
    console.log('[Memoraid] 页面即将进入 bfcache');
    // 可以在这里做一些清理工作
  }
});

// ============================================
// 内容抓取进度悬浮窗 - 显示操作流程和统计信息
// 参考发布页面悬浮窗格式，支持百度搜索、头条、微博等页面
// ============================================

// 抓取统计信息接口
interface ExtractionStats {
  totalChars: number;        // 总字数
  mainContentChars: number;  // 正文字数
  linksCount: number;        // 链接数量
  imagesCount: number;       // 图片数量
  commentsCount: number;     // 评论数量
  articlesCount: number;     // 文章列表数量（如果是列表页）
  fetchedLinksCount: number; // 已获取链接内容数量
  expandedCount: number;     // 展开折叠次数
  loadedPages: number;       // 加载的评论页数
}

// 页面类型枚举
type PageType = 'article' | 'search' | 'list' | 'comment' | 'unknown';

/**
 * 内容抓取进度悬浮窗类
 * 实时显示抓取操作流程和统计信息
 */
class ExtractionProgressPanel {
  private container: HTMLDivElement;
  private logContent: HTMLDivElement;
  private statsContent: HTMLDivElement;
  private stopBtn: HTMLButtonElement;
  private onStop?: () => void;
  private stats: ExtractionStats;
  private pageType: PageType = 'unknown';
  private startTime: number = 0;
  private timerInterval: number | null = null; // 定时器ID

  constructor() {
    // 初始化统计数据
    this.stats = {
      totalChars: 0,
      mainContentChars: 0,
      linksCount: 0,
      imagesCount: 0,
      commentsCount: 0,
      articlesCount: 0,
      fetchedLinksCount: 0,
      expandedCount: 0,
      loadedPages: 0
    };

    // 创建悬浮窗容器
    this.container = document.createElement('div');
    this.container.id = 'memoraid-extraction-panel';
    // 悬浮窗放在左边，避免和右侧的文档面板重叠
    this.container.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      width: 360px;
      max-height: 520px;
      background: linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%);
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 13px;
      border-radius: 12px;
      padding: 0;
      z-index: 2147483647;
      display: none;
      flex-direction: column;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      overflow: hidden;
    `;

    // 创建头部
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: linear-gradient(90deg, rgba(59, 130, 246, 0.2) 0%, rgba(147, 51, 234, 0.2) 100%);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    `;
    
    const title = document.createElement('div');
    title.style.cssText = 'display: flex; align-items: center; gap: 8px;';
    title.innerHTML = `
      <span style="font-size: 18px;">📄</span>
      <span style="font-weight: 600; color: #fff;">Memoraid 内容抓取</span>
    `;
    
    const controls = document.createElement('div');
    controls.style.cssText = 'display: flex; gap: 8px; align-items: center;';

    // 停止按钮
    this.stopBtn = document.createElement('button');
    this.stopBtn.innerText = '停止';
    this.stopBtn.style.cssText = `
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      color: white;
      border: none;
      border-radius: 6px;
      padding: 4px 12px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      display: none;
      transition: all 0.2s;
    `;
    this.stopBtn.onmouseover = () => { this.stopBtn.style.transform = 'scale(1.05)'; };
    this.stopBtn.onmouseout = () => { this.stopBtn.style.transform = 'scale(1)'; };
    this.stopBtn.onclick = () => {
      if (this.onStop) this.onStop();
      this.log('🛑 用户停止抓取', 'error');
      this.stopBtn.style.display = 'none';
    };

    // 关闭按钮
    const closeBtn = document.createElement('span');
    closeBtn.innerText = '✕';
    closeBtn.style.cssText = `
      cursor: pointer;
      color: #94a3b8;
      font-size: 18px;
      padding: 4px;
      border-radius: 4px;
      transition: all 0.2s;
    `;
    closeBtn.onmouseover = () => { closeBtn.style.color = '#fff'; closeBtn.style.background = 'rgba(255,255,255,0.1)'; };
    closeBtn.onmouseout = () => { closeBtn.style.color = '#94a3b8'; closeBtn.style.background = 'transparent'; };
    closeBtn.onclick = () => {
      if (this.onStop) this.onStop();
      this.container.style.display = 'none';
    };

    controls.appendChild(this.stopBtn);
    controls.appendChild(closeBtn);
    header.appendChild(title);
    header.appendChild(controls);

    // 创建统计信息区域
    this.statsContent = document.createElement('div');
    this.statsContent.style.cssText = `
      padding: 12px 16px;
      background: rgba(0, 0, 0, 0.2);
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    `;
    this.updateStatsDisplay();

    // 创建日志区域
    this.logContent = document.createElement('div');
    this.logContent.style.cssText = `
      overflow-y: auto;
      flex: 1;
      min-height: 120px;
      max-height: 280px;
      padding: 12px 16px;
      font-family: 'SF Mono', Monaco, Consolas, monospace;
      font-size: 12px;
      line-height: 1.5;
    `;

    // 组装悬浮窗
    this.container.appendChild(header);
    this.container.appendChild(this.statsContent);
    this.container.appendChild(this.logContent);
    document.body.appendChild(this.container);
  }

  /**
   * 更新统计信息显示
   */
  private updateStatsDisplay(): void {
    const pageTypeLabels: Record<PageType, string> = {
      'article': '📰 文章页',
      'search': '🔍 搜索结果',
      'list': '📋 列表页',
      'comment': '💬 评论页',
      'unknown': '📄 网页'
    };

    const elapsed = this.startTime > 0 ? Math.round((Date.now() - this.startTime) / 1000) : 0;

    this.statsContent.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 10px;">
        <div style="background: rgba(59, 130, 246, 0.15); padding: 8px 10px; border-radius: 8px; text-align: center;">
          <div style="font-size: 18px; font-weight: 700; color: #60a5fa;">${this.formatNumber(this.stats.mainContentChars)}</div>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">正文字数</div>
        </div>
        <div style="background: rgba(34, 197, 94, 0.15); padding: 8px 10px; border-radius: 8px; text-align: center;">
          <div style="font-size: 18px; font-weight: 700; color: #4ade80;">${this.stats.linksCount}</div>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">链接数</div>
        </div>
        <div style="background: rgba(168, 85, 247, 0.15); padding: 8px 10px; border-radius: 8px; text-align: center;">
          <div style="font-size: 18px; font-weight: 700; color: #c084fc;">${this.stats.imagesCount}</div>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">图片数</div>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;">
        <div style="background: rgba(251, 191, 36, 0.1); padding: 6px 8px; border-radius: 6px; text-align: center;">
          <div style="font-size: 14px; font-weight: 600; color: #fbbf24;">${this.stats.commentsCount}</div>
          <div style="font-size: 10px; color: #94a3b8;">评论</div>
        </div>
        <div style="background: rgba(236, 72, 153, 0.1); padding: 6px 8px; border-radius: 6px; text-align: center;">
          <div style="font-size: 14px; font-weight: 600; color: #f472b6;">${this.stats.articlesCount}</div>
          <div style="font-size: 10px; color: #94a3b8;">文章</div>
        </div>
        <div style="background: rgba(20, 184, 166, 0.1); padding: 6px 8px; border-radius: 6px; text-align: center;">
          <div style="font-size: 14px; font-weight: 600; color: #2dd4bf;">${this.stats.fetchedLinksCount}</div>
          <div style="font-size: 10px; color: #94a3b8;">已获取</div>
        </div>
        <div style="background: rgba(99, 102, 241, 0.1); padding: 6px 8px; border-radius: 6px; text-align: center;">
          <div style="font-size: 14px; font-weight: 600; color: #818cf8;">${elapsed}s</div>
          <div style="font-size: 10px; color: #94a3b8;">耗时</div>
        </div>
      </div>
      <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center;">
        <span style="color: #64748b; font-size: 11px;">${pageTypeLabels[this.pageType]}</span>
        <span style="color: #64748b; font-size: 11px;">总计 ${this.formatNumber(this.stats.totalChars)} 字</span>
      </div>
    `;
  }

  /**
   * 格式化数字显示（添加千位分隔符）
   */
  private formatNumber(num: number): string {
    if (num >= 10000) {
      return (num / 10000).toFixed(1) + '万';
    }
    return num.toLocaleString();
  }

  /**
   * 显示悬浮窗
   */
  show(): void {
    this.container.style.display = 'flex';
    if (this.startTime === 0) {
      this.startTime = Date.now();
    }
    // 启动定时器，每秒更新耗时显示
    if (!this.timerInterval) {
      this.timerInterval = window.setInterval(() => {
        this.updateStatsDisplay();
      }, 1000);
    }
  }

  /**
   * 隐藏悬浮窗
   */
  hide(): void {
    this.container.style.display = 'none';
    // 停止定时器
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  /**
   * 停止计时器（完成时调用）
   */
  stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  /**
   * 设置停止回调
   */
  setStopCallback(cb: () => void): void {
    this.onStop = cb;
    this.stopBtn.style.display = 'block';
  }

  /**
   * 隐藏停止按钮
   */
  hideStopButton(): void {
    this.stopBtn.style.display = 'none';
  }

  /**
   * 清空日志
   */
  clear(): void {
    this.logContent.innerHTML = '';
    this.stats = {
      totalChars: 0,
      mainContentChars: 0,
      linksCount: 0,
      imagesCount: 0,
      commentsCount: 0,
      articlesCount: 0,
      fetchedLinksCount: 0,
      expandedCount: 0,
      loadedPages: 0
    };
    // 重置计时
    this.startTime = 0;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.updateStatsDisplay();
  }

  /**
   * 设置页面类型
   */
  setPageType(type: PageType): void {
    this.pageType = type;
    this.updateStatsDisplay();
  }

  /**
   * 更新统计数据
   */
  updateStats(updates: Partial<ExtractionStats>): void {
    Object.assign(this.stats, updates);
    this.updateStatsDisplay();
  }

  /**
   * 记录日志
   */
  log(message: string, type: 'info' | 'action' | 'error' | 'success' | 'warn' = 'info'): void {
    this.show();
    const line = document.createElement('div');
    line.style.cssText = 'margin-top: 6px; word-wrap: break-word; white-space: pre-wrap;';
    
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    const colors: Record<string, string> = {
      info: '#94a3b8',
      action: '#38bdf8',
      error: '#f87171',
      success: '#4ade80',
      warn: '#fbbf24'
    };
    
    const icons: Record<string, string> = {
      info: 'ℹ️',
      action: '▶️',
      error: '❌',
      success: '✅',
      warn: '⚠️'
    };
    
    const bgColors: Record<string, string> = {
      info: 'transparent',
      action: 'rgba(56, 189, 248, 0.1)',
      error: 'rgba(248, 113, 113, 0.1)',
      success: 'rgba(74, 222, 128, 0.1)',
      warn: 'rgba(251, 191, 36, 0.1)'
    };

    line.style.background = bgColors[type];
    line.style.padding = type !== 'info' ? '4px 8px' : '2px 0';
    line.style.borderRadius = '4px';
    line.style.marginLeft = type !== 'info' ? '-8px' : '0';
    line.style.marginRight = type !== 'info' ? '-8px' : '0';
    
    line.innerHTML = `
      <span style="color: #475569; font-size: 10px;">[${time}]</span>
      <span style="margin: 0 4px;">${icons[type]}</span>
      <span style="color: ${colors[type]};">${message}</span>
    `;
    
    this.logContent.appendChild(line);
    this.logContent.scrollTop = this.logContent.scrollHeight;
  }

  /**
   * 记录详细内容预览（带标题和内容的卡片样式）
   */
  logDetail(title: string, content: string): void {
    this.show();
    const line = document.createElement('div');
    line.style.cssText = `
      margin-top: 6px;
      margin-left: 16px;
      padding: 8px 10px;
      background: rgba(30, 41, 59, 0.8);
      border-left: 3px solid #6366f1;
      border-radius: 0 6px 6px 0;
      word-wrap: break-word;
      white-space: pre-wrap;
    `;
    
    // 清理内容中的换行和多余空格
    const cleanContent = content.replace(/\s+/g, ' ').trim();
    
    line.innerHTML = `
      <div style="color: #a5b4fc; font-size: 11px; font-weight: 600; margin-bottom: 4px;">${title}</div>
      <div style="color: #cbd5e1; font-size: 12px; line-height: 1.4; overflow: hidden; text-overflow: ellipsis;">${this.escapeHtml(cleanContent)}</div>
    `;
    
    this.logContent.appendChild(line);
    this.logContent.scrollTop = this.logContent.scrollHeight;
  }

  /**
   * HTML转义，防止XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 显示完成状态
   */
  showComplete(): void {
    // 立即停止计时器，确保耗时不再增加
    this.stopTimer();
    const elapsed = Math.round((Date.now() - this.startTime) / 1000);
    this.log(`抓取完成！耗时 ${elapsed} 秒`, 'success');
    this.hideStopButton();
    // 最后更新一次显示（此时计时器已停止，不会再变化）
    this.updateStatsDisplay();
    
    // 3秒后自动隐藏（可选）
    // setTimeout(() => this.hide(), 3000);
  }
}

// 创建全局悬浮窗实例
let extractionPanel: ExtractionProgressPanel | null = null;

/**
 * 获取或创建抓取进度悬浮窗
 */
function getExtractionPanel(): ExtractionProgressPanel {
  if (!extractionPanel) {
    extractionPanel = new ExtractionProgressPanel();
  }
  return extractionPanel;
}

/**
 * 检测页面类型
 * 支持百度搜索、头条热榜、微博热搜等
 */
function detectPageType(): PageType {
  const url = window.location.href;
  const hostname = window.location.hostname;
  
  // 百度搜索结果页
  if (hostname.includes('baidu.com') && url.includes('/s?')) {
    return 'search';
  }
  
  // 头条热榜/热点
  if (hostname.includes('toutiao.com') && (url.includes('trending') || url.includes('hot'))) {
    return 'list';
  }
  
  // 微博热搜
  if (hostname.includes('weibo.com') && (url.includes('weibo?q=') || url.includes('hot'))) {
    return 'list';
  }
  
  // 知乎问题/专栏
  if (hostname.includes('zhihu.com')) {
    if (url.includes('/question/')) return 'comment';
    if (url.includes('/column/') || url.includes('/p/')) return 'article';
    return 'list';
  }
  
  // 通用文章页检测
  const hasArticle = document.querySelector('article, .article, .post, .entry-content, .rich_media_content');
  if (hasArticle) return 'article';
  
  // 通用列表页检测
  const listItems = document.querySelectorAll('.list-item, .feed-item, .card-wrap, .result');
  if (listItems.length > 3) return 'list';
  
  return 'unknown';
}

// ============================================
// 远程调试功能 - 全局可用，无需开启 debug 模式
// ============================================

// 监听来自页面的调试请求（通过 CustomEvent）
window.addEventListener('memoraid-debug-request', async (event: Event) => {
  const customEvent = event as CustomEvent;
  const { action, requestId } = customEvent.detail || {};
  
  let result: any = { success: false, error: 'Unknown action' };
  
  try {
    switch (action) {
      case 'showPanel':
        showDebugPanel();
        result = { success: true };
        break;
      case 'start':
        const code = await startDebugSession();
        result = { success: true, verificationCode: code };
        break;
      case 'stop':
        await stopDebugSession();
        result = { success: true };
        break;
      case 'status':
        result = { success: true, ...getDebugSessionStatus() };
        break;
    }
  } catch (e: any) {
    result = { success: false, error: e.message };
  }
  
  // 发送响应回页面
  window.dispatchEvent(new CustomEvent('memoraid-debug-response', {
    detail: { requestId, ...result }
  }));
});

// 监听调试相关消息（来自 popup 或 background）
// 合并所有消息监听器为一个，避免多个监听器导致的通道关闭问题
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // 调试面板相关
  if (message.type === 'SHOW_DEBUG_PANEL') {
    showDebugPanel();
    sendResponse({ success: true });
    return false; // 同步响应
  }
  
  if (message.type === 'START_DEBUG_SESSION') {
    (async () => {
      try {
        const code = await startDebugSession();
        sendResponse({ success: true, verificationCode: code });
      } catch (err: any) {
        sendResponse({ success: false, error: err?.message || '未知错误' });
      }
    })();
    return true; // 异步响应
  }
  
  if (message.type === 'STOP_DEBUG_SESSION') {
    (async () => {
      try {
        await stopDebugSession();
        sendResponse({ success: true });
      } catch (err: any) {
        sendResponse({ success: false, error: err?.message || '未知错误' });
      }
    })();
    return true; // 异步响应
  }
  
  // 内容提取
  if (message.type === 'EXTRACT_CONTENT') {
    (async () => {
      try {
        const data = await extractContent();
        sendResponse({ type: 'CONTENT_EXTRACTED', payload: data });
      } catch (err: any) {
        console.error('[Memoraid] 内容提取错误:', err);
        sendResponse({ type: 'ERROR', payload: err?.message || '未知错误' });
      }
    })();
    return true; // 异步响应
  }
  
  // 不处理的消息，不返回 true
  return false;
});

async function extractContent(): Promise<ExtractionResult> {
  const url = window.location.hostname;
  
  if (url.includes('chatgpt.com') || url.includes('openai.com')) {
    return extractChatGPT();
  } else if (url.includes('gemini.google.com')) {
    return extractGemini();
  } else if (url.includes('chat.deepseek.com')) {
    return extractDeepSeek();
  } else {
    return extractGenericPage();
  }
}

// ============================================
// 增强版内容抓取配置
// ============================================
const EXTRACTION_CONFIG = {
  MAX_COMMENT_PAGES: 5,      // 最多翻5页评论
  MAX_FOLD_EXPAND: 5,        // 最多展开5次折叠
  MAX_LINKS_TO_FETCH: 10,    // 最多获取10个链接内容
  LINK_FETCH_TIMEOUT: 5000,  // 链接获取超时时间（毫秒）
  PAGE_WAIT_TIME: 1000,      // 翻页后等待时间（毫秒）
  EXPAND_WAIT_TIME: 500,     // 展开后等待时间（毫秒）
  MAX_PAGINATION_PAGES: 5,   // 最多抓取5页分页内容
};

// 评论区选择器（覆盖主流网站）
const COMMENT_SELECTORS = [
  // 通用评论区
  '#comments', '.comments', '.comment-list', '.comment-section',
  '[class*="comment"]', '[id*="comment"]',
  // 微博
  '.card-wrap[mid]', '.WB_feed_detail',
  // 知乎
  '.CommentContent', '.Comments-container', '.List-item',
  // 头条/抖音
  '.comment-item', '.comment-content',
  // B站
  '.reply-list', '.reply-item',
  // 微信公众号
  '.rich_media_comment',
  // 掘金
  '.comment-list-box',
  // CSDN
  '.comment-box', '.comment-content',
  // 贴吧
  '.l_post', '.d_post_content',
  // 豆瓣
  '.comment-item', '.review-item',
  // Twitter/X
  '[data-testid="tweet"]',
  // Facebook
  '[data-testid="UFI2Comment"]',
];

// 评论加载更多的文字匹配（用于 loadMoreCommentsWithProgress）
// 注意：不包含"下一页"，避免误点击页面主分页链接
const COMMENT_LOAD_MORE_TEXTS = [
  '加载更多', '查看更多', '展开更多评论', '更多评论', '展开更多',
  'Load More', 'Show More', 'More Comments', 'View More',
];

// 折叠内容选择器
const FOLD_SELECTORS = [
  // 评论折叠
  '.expand-reply', '.show-replies', '.view-replies',
  '[class*="expand"]', '[class*="unfold"]',
  '.collapsed', '.folded',
  // 回复折叠
  '.reply-toggle', '.sub-comment-toggle',
  // 知乎
  '.Button--plain[type="button"]',
  // 微博
  '.WB_text_opt',
];

const FOLD_TEXTS = [
  '展开', '查看回复', '展开回复', '查看全部', '展开全文', '显示更多',
  'Expand', 'Show Replies', 'View Replies', 'Show All', 'Read More',
  '条回复', 'replies', '条评论',
];

// ============================================
// 多页内容抓取配置（用于论坛帖子等分页内容）
// ============================================

// 页面分页选择器（用于检测帖子/文章的分页）
const PAGE_PAGINATION_SELECTORS = [
  // 虎扑
  '.page-nav a', '.pagination a', '.pager a',
  // 通用分页
  '.pages a', '.page-list a', '.page-numbers a',
  '[class*="pagination"] a', '[class*="pager"] a',
  // 论坛常见
  '.pg a', '.pages a', '.pageNav a',
  // 下一页按钮
  'a.next', 'a.nextpage', '.next-page a',
  '[class*="next"]',
];

// 分页文字匹配
const PAGE_PAGINATION_TEXTS = [
  '下一页', '下页', 'Next', 'next', '»', '>', '››',
];

// 页码匹配正则（用于识别页码链接）
const PAGE_NUMBER_REGEX = /^(\d+)$/;

// 抓取取消标志
let isExtractionCancelled = false;

async function extractGenericPage(): Promise<ExtractionResult> {
  console.log('[Memoraid] 开始增强版内容抓取...');
  
  // 初始化悬浮窗
  const panel = getExtractionPanel();
  panel.clear();
  panel.show();
  isExtractionCancelled = false;
  
  // 设置停止回调
  panel.setStopCallback(() => {
    isExtractionCancelled = true;
  });
  
  // 检测页面类型
  const pageType = detectPageType();
  panel.setPageType(pageType);
  panel.log(`检测到页面类型: ${pageType}`, 'info');
  
  // 统计图片数量
  const images = document.querySelectorAll('img[src]');
  const validImages = Array.from(images).filter(img => {
    const src = img.getAttribute('src') || '';
    const width = (img as HTMLImageElement).naturalWidth || (img as HTMLImageElement).width;
    // 过滤掉小图标和占位图
    return src && !src.includes('data:') && width > 50;
  });
  panel.updateStats({ imagesCount: validImages.length });
  panel.log(`发现 ${validImages.length} 张图片`, 'info');

  // 如果是列表页（如百度搜索、头条热榜、微博热搜），提取文章列表
  let articleList: Array<{title: string, url: string, summary: string}> = [];
  if (pageType === 'search' || pageType === 'list') {
    panel.log('正在分析页面文章列表...', 'action');
    articleList = extractArticleList();
    panel.updateStats({ articlesCount: articleList.length });
    panel.log(`发现 ${articleList.length} 篇文章/结果`, 'success');
  }

  // 1. 先展开正文的"阅读全文"
  panel.log('正在展开正文内容...', 'action');
  await autoExpandContent();
  if (isExtractionCancelled) {
    panel.log('抓取已取消', 'warn');
    return createEmptyResult();
  }
  
  // 2. 展开评论区的折叠内容（最多5次）
  panel.log('正在展开折叠的评论/回复...', 'action');
  const expandCount = await expandFoldedContentWithProgress(panel);
  panel.updateStats({ expandedCount: expandCount });
  if (expandCount > 0) {
    panel.log(`展开了 ${expandCount} 处折叠内容`, 'success');
  }
  if (isExtractionCancelled) {
    panel.log('抓取已取消', 'warn');
    return createEmptyResult();
  }
  
  // 3. 加载更多评论页（最多5页）
  panel.log('正在加载更多评论...', 'action');
  const loadedPages = await loadMoreCommentsWithProgress(panel);
  panel.updateStats({ loadedPages });
  if (loadedPages > 0) {
    panel.log(`加载了 ${loadedPages} 页评论`, 'success');
  }
  if (isExtractionCancelled) {
    panel.log('抓取已取消', 'warn');
    return createEmptyResult();
  }

  let mainContent = '';
  let title = document.title || 'Web Page Content';
  
  // 4. 检测并抓取多页内容
  panel.log('正在检测页面分页...', 'action');
  const paginationInfo = detectPagePagination();
  
  // 存储所有页面的内容
  let allPagesContent: string[] = [];
  let currentPageContent = '';
  
  // 4.1 提取当前页正文内容
  panel.log('正在提取正文内容...', 'action');
  try {
    const documentClone = document.cloneNode(true) as Document;
    const reader = new Readability(documentClone);
    const article = reader.parse();
    title = article?.title || title;
    currentPageContent = article?.textContent || document.body.innerText;
    panel.log(`正文提取成功: ${title.substring(0, 30)}...`, 'success');
    // 显示正文开头预览
    const contentPreview = currentPageContent.trim().substring(0, 80).replace(/\s+/g, ' ');
    panel.logDetail('📝 正文预览', contentPreview + '...');
  } catch (error) {
    console.warn('[Memoraid] Readability extraction failed, falling back to body text', error);
    currentPageContent = document.body.innerText;
    panel.log('使用备用方法提取正文', 'warn');
    // 显示正文开头预览
    const contentPreview = currentPageContent.trim().substring(0, 80).replace(/\s+/g, ' ');
    panel.logDetail('📝 正文预览', contentPreview + '...');
  }
  
  allPagesContent.push(currentPageContent);
  
  // 4.2 如果检测到分页，获取其他页面内容
  if (paginationInfo.hasMorePages && paginationInfo.pageUrls.length > 0 && !isExtractionCancelled) {
    panel.log(`检测到 ${paginationInfo.totalPages} 页内容，当前第 ${paginationInfo.currentPage} 页`, 'info');
    panel.log(`正在获取其他 ${Math.min(paginationInfo.pageUrls.length, EXTRACTION_CONFIG.MAX_PAGINATION_PAGES - 1)} 页内容...`, 'action');
    
    const otherPagesContent = await fetchOtherPagesContent(paginationInfo.pageUrls, panel);
    allPagesContent.push(...otherPagesContent);
    
    if (otherPagesContent.length > 0) {
      panel.log(`成功获取 ${otherPagesContent.length} 页额外内容`, 'success');
    }
  } else if (paginationInfo.hasMorePages) {
    panel.log('检测到分页但无法获取其他页面链接', 'warn');
  } else {
    panel.log('未检测到分页，仅抓取当前页', 'info');
  }
  
  // 合并所有页面内容
  mainContent = allPagesContent.join('\n\n--- 分页 ---\n\n');
  panel.updateStats({ mainContentChars: mainContent.length });

  // 5. 提取评论内容
  panel.log('正在提取评论内容...', 'action');
  const comments = extractComments();
  panel.updateStats({ commentsCount: comments.length });
  if (comments.length > 0) {
    panel.log(`提取到 ${comments.length} 条评论`, 'success');
    // 显示第一条评论预览
    const firstComment = comments[0].trim().substring(0, 80).replace(/\s+/g, ' ');
    panel.logDetail('💬 首条评论', firstComment + '...');
  } else {
    panel.log('未发现评论内容', 'info');
  }

  // 5.5 OCR 识别图片中的文字（最多识别5张主要图片）
  // 根据设置决定是否启用，需要配置 apiyi API Key
  let ocrTexts: string[] = [];
  const mainImages = getMainImages(validImages as HTMLImageElement[], 5);
  if (mainImages.length > 0 && !isExtractionCancelled) {
    panel.log(`正在识别 ${mainImages.length} 张图片中的文字...`, 'action');
    ocrTexts = await ocrImagesWithProgress(mainImages, panel);
    // 过滤掉未启用或失败的提示信息
    ocrTexts = ocrTexts.filter(text => 
      text && 
      !text.includes('功能未启用') && 
      !text.includes('未配置') &&
      !text.includes('识别失败') &&
      text !== '无文字内容'
    );
    if (ocrTexts.length > 0) {
      panel.log(`成功识别 ${ocrTexts.length} 张图片的文字`, 'success');
    }
  }
  
  // 6. 提取正文中的链接
  panel.log('正在分析页面链接...', 'action');
  const linksWithText = extractArticleLinksWithText();
  const links = linksWithText.map(l => l.url);
  panel.updateStats({ linksCount: links.length });
  panel.log(`发现 ${links.length} 个有效链接`, 'info');
  // 显示前3个链接预览
  linksWithText.slice(0, 3).forEach((link, idx) => {
    panel.logDetail(`🔗 链接${idx + 1}`, `${link.text.substring(0, 30)} → ${link.url.substring(0, 40)}...`);
  });
  
  // 7. 获取链接内容（最多10个）
  let linkContents: Array<{url: string, content: string}> = [];
  if (links.length > 0 && !isExtractionCancelled) {
    panel.log(`正在获取 ${Math.min(links.length, EXTRACTION_CONFIG.MAX_LINKS_TO_FETCH)} 个链接内容...`, 'action');
    linkContents = await fetchLinkContentsWithProgress(links, panel);
    panel.updateStats({ fetchedLinksCount: linkContents.length });
    if (linkContents.length > 0) {
      panel.log(`成功获取 ${linkContents.length} 个链接内容`, 'success');
    }
  }

  // 8. 组装最终内容
  panel.log('正在组装最终内容...', 'action');
  let fullContent = `【正文内容】\n\n${mainContent.trim()}`;
  
  // 如果是列表页，添加文章列表信息
  if (articleList.length > 0) {
    fullContent += `\n\n【文章列表】（共${articleList.length}篇）\n\n`;
    articleList.forEach((article, idx) => {
      fullContent += `${idx + 1}. ${article.title}\n`;
      if (article.summary) {
        fullContent += `   摘要: ${article.summary.substring(0, 100)}...\n`;
      }
      fullContent += `   链接: ${article.url}\n\n`;
    });
  }
  
  // 添加 OCR 识别的图片文字
  if (ocrTexts.length > 0) {
    fullContent += `\n\n【图片文字识别】（共${ocrTexts.length}张图片）\n\n`;
    ocrTexts.forEach((text, idx) => {
      if (text && text !== '无文字内容') {
        fullContent += `--- 图片${idx + 1}的文字 ---\n${text}\n\n`;
      }
    });
  }
  
  if (comments.length > 0) {
    fullContent += `\n\n【评论区内容】（共${comments.length}条）\n\n${comments.join('\n\n---\n\n')}`;
  }
  
  if (linkContents.length > 0) {
    fullContent += `\n\n【相关链接内容】（共${linkContents.length}个）\n\n`;
    linkContents.forEach((lc, idx) => {
      fullContent += `\n--- 链接${idx + 1}: ${lc.url} ---\n${lc.content}\n`;
    });
  }

  // 更新总字数
  panel.updateStats({ totalChars: fullContent.length });
  
  // 显示完成状态
  panel.showComplete();
  console.log(`[Memoraid] 抓取完成: 正文${mainContent.length}字, ${comments.length}条评论, ${linkContents.length}个链接内容, ${ocrTexts.length}张图片OCR`);

  return {
    title,
    messages: [{
      role: 'user',
      content: fullContent
    }],
    url: window.location.href
  };
}

/**
 * 创建空结果（用于取消时返回）
 */
function createEmptyResult(): ExtractionResult {
  return {
    title: document.title || 'Cancelled',
    messages: [{
      role: 'user',
      content: '抓取已取消'
    }],
    url: window.location.href
  };
}

/**
 * 提取文章列表（用于搜索结果页、热榜等）
 * 支持百度搜索、头条热榜、微博热搜等
 */
function extractArticleList(): Array<{title: string, url: string, summary: string}> {
  const articles: Array<{title: string, url: string, summary: string}> = [];
  const seenUrls = new Set<string>();
  
  // 百度搜索结果选择器
  const baiduSelectors = [
    '.result.c-container',           // 百度搜索结果
    '.c-result',                     // 新版百度
    '[class*="result"]',             // 通用结果
  ];
  
  // 头条热榜选择器
  const toutiaoSelectors = [
    '.trending-item',                // 热榜项
    '.feed-card',                    // 信息流卡片
    '[class*="feed-item"]',          // 通用feed
  ];
  
  // 微博热搜选择器
  const weiboSelectors = [
    '.card-wrap',                    // 微博卡片
    '[class*="card"]',               // 通用卡片
  ];
  
  // 通用列表选择器
  const genericSelectors = [
    'article',
    '.article-item',
    '.list-item',
    '.post-item',
    '.news-item',
    '.feed-item',
  ];
  
  const allSelectors = [...baiduSelectors, ...toutiaoSelectors, ...weiboSelectors, ...genericSelectors];
  
  for (const selector of allSelectors) {
    const items = document.querySelectorAll(selector);
    items.forEach(item => {
      // 查找标题链接
      const titleLink = item.querySelector('h3 a, h2 a, .title a, a[class*="title"], a h3, a h2') as HTMLAnchorElement;
      if (!titleLink) return;
      
      const url = titleLink.href;
      if (!url || seenUrls.has(url) || url.startsWith('javascript:')) return;
      
      const title = titleLink.innerText?.trim() || '';
      if (!title || title.length < 4) return;
      
      // 查找摘要
      const summaryEl = item.querySelector('.c-abstract, .summary, .desc, .content-abstract, p');
      const summary = (summaryEl as HTMLElement)?.innerText?.trim() || '';
      
      seenUrls.add(url);
      articles.push({ title, url, summary });
    });
    
    // 如果已经找到足够的文章，停止搜索
    if (articles.length >= 20) break;
  }
  
  return articles;
}

/**
 * 展开折叠的评论/回复内容（带进度显示）
 */
async function expandFoldedContentWithProgress(_panel: ExtractionProgressPanel): Promise<number> {
  console.log('[Memoraid] 尝试展开折叠内容...');
  let expandCount = 0;
  
  for (let i = 0; i < EXTRACTION_CONFIG.MAX_FOLD_EXPAND; i++) {
    if (isExtractionCancelled) break;
    
    let expanded = false;
    
    // 1. 通过选择器查找折叠按钮
    for (const selector of FOLD_SELECTORS) {
      const elements = document.querySelectorAll(selector);
      for (const el of Array.from(elements)) {
        const htmlEl = el as HTMLElement;
        if (isElementVisible(htmlEl) && !htmlEl.dataset.memoraidExpanded) {
          const text = htmlEl.innerText?.trim() || '';
          // 检查是否是展开按钮（通过文字判断）
          // 排除太长的文字（可能是正文内容）
          if (text.length > 0 && text.length < 50 && 
              (FOLD_TEXTS.some(t => text.includes(t)) || text.match(/^\d+\s*(条回复|replies|条评论)$/))) {
            try {
              htmlEl.click();
              htmlEl.dataset.memoraidExpanded = 'true';
              expanded = true;
              expandCount++;
              console.log(`[Memoraid] 展开折叠内容: "${text.substring(0, 20)}..."`);
              await sleep(EXTRACTION_CONFIG.EXPAND_WAIT_TIME);
              break;
            } catch (e) {
              console.warn('[Memoraid] 点击展开按钮失败:', e);
            }
          }
        }
      }
      if (expanded) break;
    }
    
    // 2. 通过文字查找展开按钮
    if (!expanded) {
      const allClickables = document.querySelectorAll('button, a, span, div[role="button"], [onclick]');
      for (const el of Array.from(allClickables)) {
        const htmlEl = el as HTMLElement;
        const text = htmlEl.innerText?.trim() || '';
        // 更严格的条件：文字长度在合理范围内，且包含展开相关的关键词
        if (isElementVisible(htmlEl) && 
            !htmlEl.dataset.memoraidExpanded &&
            text.length > 0 && text.length < 30 &&
            FOLD_TEXTS.some(t => text === t || (text.includes(t) && text.length < 20))) {
          try {
            htmlEl.click();
            htmlEl.dataset.memoraidExpanded = 'true';
            expanded = true;
            expandCount++;
            console.log(`[Memoraid] 通过文字展开: "${text}"`);
            await sleep(EXTRACTION_CONFIG.EXPAND_WAIT_TIME);
            break;
          } catch (e) {
            console.warn('[Memoraid] 点击展开按钮失败:', e);
          }
        }
      }
    }
    
    if (!expanded) {
      console.log(`[Memoraid] 没有更多可展开的内容，共展开${expandCount}次`);
      break;
    }
  }
  
  return expandCount;
}

/**
 * 加载更多评论（带进度显示）
 * 注意：只点击评论区内的"加载更多"按钮，不点击页面主分页链接
 */
async function loadMoreCommentsWithProgress(_panel: ExtractionProgressPanel): Promise<number> {
  console.log('[Memoraid] 尝试加载更多评论...');
  let pageCount = 0;
  
  for (let i = 0; i < EXTRACTION_CONFIG.MAX_COMMENT_PAGES; i++) {
    if (isExtractionCancelled) break;
    
    let loaded = false;
    
    // 只查找评论区内的"加载更多"按钮
    // 严格限制：必须在评论区容器内，且不能是页面主分页链接
    const commentContainers = document.querySelectorAll('[class*="comment"], [id*="comment"], .comments, #comments, .reply-list, .reply-box');
    
    for (const container of Array.from(commentContainers)) {
      if (loaded) break;
      
      // 在评论区容器内查找加载更多按钮
      const buttons = container.querySelectorAll('button, a, span[role="button"], div[role="button"]');
      
      for (const el of Array.from(buttons)) {
        const htmlEl = el as HTMLElement;
        const text = htmlEl.innerText?.trim() || '';
        
        // 严格检查：
        // 1. 必须在评论区内
        // 2. 文字必须是"加载更多"、"查看更多"等，不能是"下一页"（避免点击页面分页）
        // 3. 不能是链接到其他页面的 <a> 标签（检查 href）
        const isLoadMoreButton = text.length > 0 && text.length < 15 && 
          COMMENT_LOAD_MORE_TEXTS.some(t => text.includes(t));
        
        // 排除页面分页链接
        const isPageLink = htmlEl.tagName === 'A' && 
          ((htmlEl as HTMLAnchorElement).href?.includes('page=') || 
           (htmlEl as HTMLAnchorElement).href?.includes('pn=') ||
           text === '下一页' || text === '下页' || text.match(/^\d+$/));
        
        if (isElementVisible(htmlEl) && 
            !htmlEl.dataset.memoraidClicked &&
            isLoadMoreButton &&
            !isPageLink) {
          try {
            // 对于 <a> 标签，阻止默认跳转行为
            if (htmlEl.tagName === 'A') {
              const event = new MouseEvent('click', { bubbles: true, cancelable: true });
              htmlEl.dispatchEvent(event);
            } else {
              htmlEl.click();
            }
            htmlEl.dataset.memoraidClicked = 'true';
            loaded = true;
            pageCount++;
            console.log(`[Memoraid] 加载更多评论: "${text}" (第${pageCount}次)`);
            await sleep(EXTRACTION_CONFIG.PAGE_WAIT_TIME);
            break;
          } catch (e) {
            console.warn('[Memoraid] 点击加载更多失败:', e);
          }
        }
      }
    }
    
    if (!loaded) {
      console.log(`[Memoraid] 没有更多评论可加载，共加载${pageCount}次`);
      break;
    }
  }
  
  return pageCount;
}

/**
 * 获取链接内容（带进度显示）
 * 注意：通过 background script 的 fetch 获取，不会跳转页面
 */
async function fetchLinkContentsWithProgress(
  links: string[], 
  panel: ExtractionProgressPanel
): Promise<Array<{url: string, content: string}>> {
  if (links.length === 0) return [];
  
  console.log(`[Memoraid] 开始获取${links.length}个链接的内容...`);
  const results: Array<{url: string, content: string}> = [];
  const maxLinks = Math.min(links.length, EXTRACTION_CONFIG.MAX_LINKS_TO_FETCH);
  
  for (let i = 0; i < maxLinks; i++) {
    if (isExtractionCancelled) break;
    
    const url = links[i];
    const urlShort = url.length > 40 ? url.substring(0, 40) + '...' : url;
    panel.log(`正在获取链接 ${i + 1}/${maxLinks}: ${urlShort}`, 'action');
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'FETCH_LINK_CONTENT',
        payload: { url, timeout: EXTRACTION_CONFIG.LINK_FETCH_TIMEOUT }
      });
      
      if (response && response.success && response.content) {
        // 截取前2000字符，避免内容过长
        const content = response.content.substring(0, 2000);
        results.push({ url, content });
        panel.updateStats({ fetchedLinksCount: results.length });
        
        // 显示链接内容预览（更详细）
        const contentPreview = content.trim().substring(0, 80).replace(/\s+/g, ' ');
        panel.log(`✅ 链接 ${i + 1} 获取成功 (${content.length}字)`, 'success');
        panel.logDetail(`📄 内容预览`, contentPreview + '...');
        console.log(`[Memoraid] 获取链接内容成功: ${url.substring(0, 50)}... (${content.length}字)`);
      } else {
        const errorMsg = response?.error || '未知错误';
        panel.log(`❌ 链接 ${i + 1} 获取失败: ${errorMsg}`, 'warn');
        console.warn(`[Memoraid] 获取链接内容失败: ${url}`, errorMsg);
      }
    } catch (e: any) {
      const errorMsg = e?.message || '请求异常';
      panel.log(`❌ 链接 ${i + 1} 异常: ${errorMsg}`, 'error');
      console.warn(`[Memoraid] 获取链接内容异常: ${url}`, e);
    }
    
    // 每个链接获取后稍微等待，避免请求过快
    await sleep(100);
  }
  
  console.log(`[Memoraid] 成功获取${results.length}个链接内容`);
  return results;
}

// ============================================
// 多页内容抓取功能（用于论坛帖子等分页内容）
// ============================================

/**
 * 分页信息接口
 */
interface PaginationInfo {
  hasMorePages: boolean;      // 是否有更多页
  currentPage: number;        // 当前页码
  totalPages: number;         // 总页数
  pageUrls: string[];         // 其他页面的URL列表
}

/**
 * 检测页面分页信息
 * 支持虎扑、贴吧、论坛等常见分页格式
 */
function detectPagePagination(): PaginationInfo {
  console.log('[Memoraid] 开始检测页面分页...');
  
  const result: PaginationInfo = {
    hasMorePages: false,
    currentPage: 1,
    totalPages: 1,
    pageUrls: []
  };
  
  const currentUrl = window.location.href;
  const seenUrls = new Set<string>();
  seenUrls.add(currentUrl); // 排除当前页
  
  // 收集所有分页链接
  const pageLinks: Array<{url: string, pageNum: number}> = [];
  
  // 1. 通过选择器查找分页区域
  for (const selector of PAGE_PAGINATION_SELECTORS) {
    const elements = document.querySelectorAll(selector);
    
    for (const el of Array.from(elements)) {
      const anchor = el as HTMLAnchorElement;
      const href = anchor.href;
      const text = anchor.innerText?.trim() || '';
      
      // 跳过无效链接
      if (!href || href === '#' || href.startsWith('javascript:') || seenUrls.has(href)) {
        continue;
      }
      
      // 检查是否是页码链接
      let pageNum = 0;
      
      // 方式1：文字是纯数字
      if (PAGE_NUMBER_REGEX.test(text)) {
        pageNum = parseInt(text, 10);
      }
      // 方式2：URL中包含页码参数
      else {
        const pageMatch = href.match(/[?&]page=(\d+)/i) || 
                          href.match(/[?&]pn=(\d+)/i) ||
                          href.match(/[?&]p=(\d+)/i) ||
                          href.match(/-(\d+)\.html?$/i) ||
                          href.match(/\/(\d+)$/);
        if (pageMatch) {
          pageNum = parseInt(pageMatch[1], 10);
        }
      }
      // 方式3：是"下一页"链接
      if (pageNum === 0 && PAGE_PAGINATION_TEXTS.some(t => text.includes(t))) {
        // 尝试从URL推断页码
        const currentPageMatch = currentUrl.match(/[?&]page=(\d+)/i) ||
                                  currentUrl.match(/[?&]pn=(\d+)/i) ||
                                  currentUrl.match(/[?&]p=(\d+)/i) ||
                                  currentUrl.match(/-(\d+)\.html?$/i) ||
                                  currentUrl.match(/\/(\d+)$/);
        const currentPageNum = currentPageMatch ? parseInt(currentPageMatch[1], 10) : 1;
        pageNum = currentPageNum + 1;
      }
      
      if (pageNum > 0 && !seenUrls.has(href)) {
        seenUrls.add(href);
        pageLinks.push({ url: href, pageNum });
        console.log(`[Memoraid] 发现分页链接: 第${pageNum}页 -> ${href.substring(0, 60)}...`);
      }
    }
  }
  
  // 2. 分析分页信息
  if (pageLinks.length > 0) {
    result.hasMorePages = true;
    
    // 找出当前页码
    const currentPageMatch = currentUrl.match(/[?&]page=(\d+)/i) ||
                              currentUrl.match(/[?&]pn=(\d+)/i) ||
                              currentUrl.match(/[?&]p=(\d+)/i) ||
                              currentUrl.match(/-(\d+)\.html?$/i) ||
                              currentUrl.match(/\/(\d+)$/);
    result.currentPage = currentPageMatch ? parseInt(currentPageMatch[1], 10) : 1;
    
    // 计算总页数
    const allPageNums = [result.currentPage, ...pageLinks.map(p => p.pageNum)];
    result.totalPages = Math.max(...allPageNums);
    
    // 按页码排序，只获取当前页之后的页面（最多 MAX_PAGINATION_PAGES - 1 页）
    const futurePages = pageLinks
      .filter(p => p.pageNum > result.currentPage)
      .sort((a, b) => a.pageNum - b.pageNum)
      .slice(0, EXTRACTION_CONFIG.MAX_PAGINATION_PAGES - 1);
    
    result.pageUrls = futurePages.map(p => p.url);
    
    console.log(`[Memoraid] 分页检测结果: 当前第${result.currentPage}页，共${result.totalPages}页，将获取${result.pageUrls.length}页额外内容`);
  } else {
    console.log('[Memoraid] 未检测到分页');
  }
  
  return result;
}

/**
 * 获取其他页面的内容（通过 fetch，不跳转页面）
 * @param pageUrls 要获取的页面URL列表
 * @param panel 进度面板
 */
async function fetchOtherPagesContent(
  pageUrls: string[],
  panel: ExtractionProgressPanel
): Promise<string[]> {
  const results: string[] = [];
  const maxPages = Math.min(pageUrls.length, EXTRACTION_CONFIG.MAX_PAGINATION_PAGES - 1);
  
  for (let i = 0; i < maxPages; i++) {
    if (isExtractionCancelled) break;
    
    const url = pageUrls[i];
    const urlShort = url.length > 50 ? url.substring(0, 50) + '...' : url;
    panel.log(`正在获取第 ${i + 2} 页内容: ${urlShort}`, 'action');
    
    try {
      // 通过 background script 获取页面内容
      const response = await chrome.runtime.sendMessage({
        type: 'FETCH_LINK_CONTENT',
        payload: { url, timeout: EXTRACTION_CONFIG.LINK_FETCH_TIMEOUT * 2 } // 给分页更多时间
      });
      
      if (response && response.success && response.content) {
        const content = response.content;
        
        // 清理内容：移除导航、页脚等重复元素
        const cleanedContent = cleanPageContent(content);
        
        if (cleanedContent.length > 100) {
          results.push(cleanedContent);
          panel.log(`✅ 第 ${i + 2} 页获取成功 (${cleanedContent.length}字)`, 'success');
          
          // 显示内容预览
          const preview = cleanedContent.trim().substring(0, 80).replace(/\s+/g, ' ');
          panel.logDetail(`📄 第${i + 2}页预览`, preview + '...');
          
          console.log(`[Memoraid] 获取第${i + 2}页成功: ${cleanedContent.length}字`);
        } else {
          panel.log(`⚠️ 第 ${i + 2} 页内容太少，跳过`, 'warn');
        }
      } else {
        const errorMsg = response?.error || '未知错误';
        panel.log(`❌ 第 ${i + 2} 页获取失败: ${errorMsg}`, 'warn');
        console.warn(`[Memoraid] 获取第${i + 2}页失败:`, errorMsg);
      }
    } catch (e: any) {
      const errorMsg = e?.message || '请求异常';
      panel.log(`❌ 第 ${i + 2} 页异常: ${errorMsg}`, 'error');
      console.error(`[Memoraid] 获取第${i + 2}页异常:`, e);
    }
    
    // 每页获取后等待一下，避免请求过快
    await sleep(300);
  }
  
  return results;
}

/**
 * 清理页面内容，移除重复的导航、页脚等
 */
function cleanPageContent(content: string): string {
  // 移除常见的重复内容模式
  let cleaned = content;
  
  // 移除过多的空白行
  cleaned = cleaned.replace(/\n{4,}/g, '\n\n\n');
  
  // 移除常见的页脚文字
  const footerPatterns = [
    /版权所有.*$/gm,
    /Copyright.*$/gim,
    /All Rights Reserved.*$/gim,
    /备案号.*$/gm,
    /ICP备.*$/gm,
  ];
  
  for (const pattern of footerPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }
  
  return cleaned.trim();
}

/**
 * 提取评论内容
 */
function extractComments(): string[] {
  const comments: string[] = [];
  const seenTexts = new Set<string>();
  
  for (const selector of COMMENT_SELECTORS) {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => {
      const text = (el as HTMLElement).innerText?.trim();
      if (text && text.length > 10 && text.length < 5000) {
        // 去重：使用前100个字符作为key
        const key = text.substring(0, 100);
        if (!seenTexts.has(key)) {
          seenTexts.add(key);
          comments.push(text);
        }
      }
    });
  }
  
  console.log(`[Memoraid] 提取到${comments.length}条评论`);
  return comments;
}

/**
 * 提取正文中的链接（包含链接文字）
 */
function extractArticleLinksWithText(): Array<{url: string, text: string}> {
  const links: Array<{url: string, text: string}> = [];
  const seenUrls = new Set<string>();
  
  // 查找正文区域
  const articleArea = document.querySelector('article, .article, .post-content, .entry-content, .content, main') || document.body;
  
  // 提取链接
  const anchors = articleArea.querySelectorAll('a[href]');
  anchors.forEach(a => {
    const href = (a as HTMLAnchorElement).href;
    const text = (a as HTMLElement).innerText?.trim() || '';
    
    // 过滤条件
    if (!href || 
        href.startsWith('javascript:') ||
        href.startsWith('#') ||
        href.includes('login') ||
        href.includes('signup') ||
        href.includes('share') ||
        seenUrls.has(href)) {
      return;
    }
    
    // 只获取外部链接或同域的文章链接
    try {
      const url = new URL(href);
      // 排除常见的非内容链接
      if (url.pathname === '/' || 
          url.pathname.includes('/user/') ||
          url.pathname.includes('/profile/') ||
          url.pathname.includes('/tag/') ||
          url.pathname.includes('/category/')) {
        return;
      }
      
      // 链接文字要有意义（至少4个字符）
      if (text.length >= 4 && links.length < EXTRACTION_CONFIG.MAX_LINKS_TO_FETCH) {
        seenUrls.add(href);
        links.push({ url: href, text });
        console.log(`[Memoraid] 发现链接: ${text.substring(0, 30)} -> ${href.substring(0, 50)}...`);
      }
    } catch (e) {
      // 无效URL，跳过
    }
  });
  
  console.log(`[Memoraid] 共发现${links.length}个有效链接`);
  return links.slice(0, EXTRACTION_CONFIG.MAX_LINKS_TO_FETCH);
}

/**
 * 获取页面中的主要图片（用于 OCR）
 * 过滤掉小图标、头像、广告等
 */
function getMainImages(images: HTMLImageElement[], maxCount: number = 5): HTMLImageElement[] {
  const mainImages: HTMLImageElement[] = [];
  
  console.log(`[Memoraid] 开始筛选图片，共 ${images.length} 张候选图片`);
  
  for (const img of images) {
    if (mainImages.length >= maxCount) break;
    
    const src = img.src || '';
    // 使用多种方式获取尺寸
    const width = img.naturalWidth || img.width || img.clientWidth || 0;
    const height = img.naturalHeight || img.height || img.clientHeight || 0;
    
    // 过滤条件
    // 1. 必须有有效的 src
    if (!src || src.startsWith('data:image/svg') || src.includes('blank.gif')) {
      console.log(`[Memoraid] 跳过图片(无效src): ${src.substring(0, 50)}`);
      continue;
    }
    
    // 2. 尺寸要足够大（放宽到 100x50，因为有些网站图片尺寸获取不准确）
    // 如果尺寸为0，可能是懒加载图片，也尝试处理
    if (width > 0 && height > 0 && (width < 100 || height < 50)) {
      console.log(`[Memoraid] 跳过图片(尺寸太小 ${width}x${height}): ${src.substring(0, 50)}`);
      continue;
    }
    
    // 3. 排除常见的非内容图片
    const srcLower = src.toLowerCase();
    if (srcLower.includes('avatar') || 
        srcLower.includes('icon') || 
        srcLower.includes('logo') ||
        srcLower.includes('emoji') ||
        srcLower.includes('qrcode') ||
        srcLower.includes('二维码')) {
      console.log(`[Memoraid] 跳过图片(非内容图片): ${src.substring(0, 50)}`);
      continue;
    }
    
    // 4. 排除头像类图片（通常是正方形且较小）
    if (width === height && width > 0 && width < 120) {
      console.log(`[Memoraid] 跳过图片(头像类 ${width}x${height}): ${src.substring(0, 50)}`);
      continue;
    }
    
    console.log(`[Memoraid] 选中图片 ${mainImages.length + 1}: ${width}x${height} - ${src.substring(0, 80)}`);
    mainImages.push(img);
  }
  
  console.log(`[Memoraid] 筛选出 ${mainImages.length} 张主要图片用于 OCR`);
  return mainImages;
}

/**
 * OCR 识别多张图片（带进度显示）
 * 通过 background script 调用 GPT-4o-mini 进行识别
 */
async function ocrImagesWithProgress(
  images: HTMLImageElement[], 
  panel: ExtractionProgressPanel
): Promise<string[]> {
  const results: string[] = [];
  
  for (let i = 0; i < images.length; i++) {
    if (isExtractionCancelled) break;
    
    const img = images[i];
    const src = img.src;
    
    panel.log(`正在识别图片 ${i + 1}/${images.length}...`, 'action');
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'OCR_IMAGE',
        payload: { imageUrl: src }
      });
      
      if (response && response.success && response.text) {
        const text = response.text.trim();
        results.push(text);
        
        // 检查是否是有效的识别结果
        if (text && 
            !text.includes('功能未启用') && 
            !text.includes('未配置') &&
            !text.includes('识别失败') &&
            text !== '无文字内容') {
          // 显示识别结果预览（显示更多内容，最多150字符）
          const preview = text.substring(0, 150).replace(/\s+/g, ' ');
          const suffix = text.length > 150 ? `... (共${text.length}字)` : '';
          panel.log(`✅ 图片 ${i + 1} 识别成功 (${text.length}字)`, 'success');
          panel.logDetail(`🔤 识别文字`, preview + suffix);
          console.log(`[Memoraid] 图片 ${i + 1} OCR 结果:\n${text}`);
        } else if (text.includes('功能未启用') || text.includes('未配置')) {
          panel.log(`ℹ️ 图片识别功能未启用或未配置 API Key`, 'info');
          // 如果功能未启用，跳过后续图片
          break;
        } else {
          panel.log(`ℹ️ 图片 ${i + 1} 无文字内容`, 'info');
        }
      } else {
        const errorMsg = response?.error || '识别失败';
        panel.log(`❌ 图片 ${i + 1} 识别失败: ${errorMsg}`, 'warn');
        console.error(`[Memoraid] 图片 ${i + 1} OCR 失败:`, errorMsg);
      }
    } catch (e: any) {
      const errorMsg = e?.message || '请求异常';
      panel.log(`❌ 图片 ${i + 1} 异常: ${errorMsg}`, 'error');
      console.error(`[Memoraid] 图片 ${i + 1} OCR 异常:`, e);
    }
    
    // 每张图片识别后稍微等待
    await sleep(200);
  }
  
  return results;
}

/**
 * 检查元素是否可见
 */
function isElementVisible(el: HTMLElement): boolean {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && 
         style.visibility !== 'hidden' && 
         style.opacity !== '0' &&
         el.offsetParent !== null;
}

/**
 * 延时函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function autoExpandContent() {
  const EXPAND_SELECTORS = [
    '.btn-readmore', // CSDN
    '.btn-read-more', // Juejin
    '.read-more-btn',
    '.expand-button',
    '#btn-readmore',
    '.show-more', // SegmentFault
    '[data-action="expand"]'
  ];

  const EXPAND_TEXTS = ['阅读全文', '展开阅读', 'Read More', 'Show More', '展开更多'];

  console.log('Attempting to auto-expand content...');
  let expanded = false;

  // 1. Try Selectors
  for (const selector of EXPAND_SELECTORS) {
    const btn = document.querySelector(selector) as HTMLElement;
    if (btn && btn.offsetParent !== null) { // Check if visible
      console.log('Found expand button by selector:', selector);
      btn.click();
      expanded = true;
    }
  }

  // 2. Try Text Content (if no selector matched)
  if (!expanded) {
    const buttons = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
    for (const btn of buttons) {
      const text = (btn as HTMLElement).innerText?.trim();
      if (text && EXPAND_TEXTS.some(t => text === t)) {
        console.log('Found expand button by text:', text);
        (btn as HTMLElement).click();
        expanded = true;
        break; // Only click one main expand button usually
      }
    }
  }

  if (expanded) {
    // Wait for content to load/expand
    await new Promise(resolve => setTimeout(resolve, 800));
  }
}


function extractDeepSeek(): ExtractionResult {
  const title = document.title || 'DeepSeek Conversation';
  const messages: ChatMessage[] = [];
  
  // DeepSeek Chat DOM Structure Analysis (as of Jan 2025)
  // Usually wrapped in a container. Let's look for standard patterns.
  // User message: often has specific classes or alignment
  // Assistant message: often has 'ds-markdown' or similar class
  
  // Attempt 1: Look for message container class (common in React apps)
  // We'll search for elements that look like message bubbles
  
  // Note: Since we can't inspect the live DOM, we'll use a robust heuristic strategy
  // 1. Find the main chat container
  // 2. Iterate through children
  // 3. Classify based on known markers (e.g., "DeepSeek" avatar, "You" label)

  // Try to find all message blocks
  const messageBlocks = document.querySelectorAll('div[class*="message"], div[class*="chat-item"]');
  
  if (messageBlocks.length > 0) {
      messageBlocks.forEach(block => {
          const text = (block as HTMLElement).innerText;
          if (!text) return;
          
          // Heuristic to determine role
          // This is a best-guess without exact class names. 
          // Often user messages are on the right or have "User"/"You"
          // Assistant messages have the logo or "DeepSeek"
          
          // For now, let's grab the text and try to deduce, or just dump it.
          // Better strategy: DeepSeek uses markdown rendering for assistant.
          // Look for 'ds-markdown' or similar class which is likely the assistant.
          
          let role: 'user' | 'assistant' = 'user';
          if (block.innerHTML.includes('ds-markdown') || block.innerHTML.includes('markdown-body')) {
              role = 'assistant';
          }
          
          messages.push({ role, content: text });
      });
  } 

  // Fallback: If no specific structure found, grab the main text content
  if (messages.length === 0) {
    const main = document.querySelector('main') || document.body;
    if (main) {
       messages.push({ 
         role: 'user', 
         content: main.innerText + '\n\n(Note: Automatic extraction could not identify individual messages for DeepSeek yet. Captured full page text.)' 
       });
    }
  }

  return {
    title,
    messages,
    url: window.location.href
  };
}

function extractChatGPT(): ExtractionResult {
  const title = document.title || 'ChatGPT Conversation';
  const messages: ChatMessage[] = [];
  
  // Strategy 1: data-message-author-role (Standard)
  let messageElements = document.querySelectorAll('[data-message-author-role]');
  
  // Strategy 2: Fallback to article tags (often used in new UI)
  if (messageElements.length === 0) {
    messageElements = document.querySelectorAll('article');
  }

  // Strategy 3: Text-based heuristic (Last resort)
  if (messageElements.length === 0) {
     console.warn('No standard chat elements found. Trying to capture visible text.');
     const main = document.querySelector('main');
     if (main) {
       return {
         title,
         messages: [{ role: 'user', content: main.innerText }],
         url: window.location.href
       };
     }
  }

  messageElements.forEach((el) => {
    let role: 'user' | 'assistant' = 'user';
    
    if (el.hasAttribute('data-message-author-role')) {
        role = el.getAttribute('data-message-author-role') as 'user' | 'assistant';
    } else if (el.tagName.toLowerCase() === 'article') {
        // In some versions, user messages have a specific class or lack 'text-token-text-primary'
        // This is tricky without specific classes. 
        // Often assistant messages have a specific avatar or icon.
        // Let's assume if it contains "ChatGPT" or has specific SVG it's assistant.
        const isAssistant = el.querySelector('.markdown') !== null;
        role = isAssistant ? 'assistant' : 'user';
    }

    // specific cleanup for ChatGPT
    // Remove "Copy code" buttons text if present in textContent
    const clone = el.cloneNode(true) as HTMLElement;
    const buttons = clone.querySelectorAll('button');
    buttons.forEach(b => b.remove()); // Remove buttons to avoid "Copy code" text
    
    const textContent = clone.textContent || '';
    
    if (textContent.trim()) {
        messages.push({
          role: role,
          content: textContent.trim()
        });
    }
  });

  return {
    title,
    messages,
    url: window.location.href
  };
}

function extractGemini(): ExtractionResult {
  const title = document.title || 'Gemini Conversation';
  const messages: ChatMessage[] = [];

  // Gemini is tricky. Look for user-query and model-response classes or similar attributes.
  // As of late 2023/early 2024:
  // User: .user-query-container or [data-test-id="user-query"]
  // Model: .model-response-container or [data-test-id="model-response"]
  
  // Let's try a generic approach iterating through the chat history container
  // The container is usually infinite-scroller or similar.
  
  const turnContainers = document.querySelectorAll('user-query, model-response');
  
  if (turnContainers.length > 0) {
     turnContainers.forEach(el => {
       const isUser = el.tagName.toLowerCase() === 'user-query';
       const text = el.textContent || '';
       messages.push({
         role: isUser ? 'user' : 'assistant',
         content: text.trim()
       });
     });
  } else {
     // Fallback for different DOM structure
     // Just grab all text for now if specific selectors fail
     const main = document.querySelector('main');
     if (main) {
       messages.push({ role: 'user', content: main.innerText }); // desperation
     }
  }

  return {
    title,
    messages,
    url: window.location.href
  };
}
