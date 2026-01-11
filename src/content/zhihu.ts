import { reportError } from '../utils/debug';

// Zhihu Publish Content Script - 基于 Playwright 录制
// 知乎专栏发布页面自动化

interface PublishData {
  title: string;
  content: string;
  htmlContent?: string;
  timestamp: number;
}

// ============================================
// 知乎页面元素选择器配置 - 基于 Playwright 录制
// ============================================
const SELECTORS = {
  // 标题输入框 - Playwright: getByPlaceholder('请输入标题（最多 100 个字）')
  titleInput: [
    'textarea[placeholder*="请输入标题"]',
    'textarea[placeholder*="100 个字"]',
    'input[placeholder*="请输入标题"]',
    '.WriteIndex-titleInput textarea',
    '.PostEditor-titleInput textarea'
  ],
  
  // 编辑器正文 - Playwright: div:has-text("请输入正文")
  editor: [
    '.public-DraftEditor-content',
    '[contenteditable="true"]',
    '.DraftEditor-root [contenteditable="true"]',
    '.PostEditor-content [contenteditable="true"]'
  ],
  
  // 图片按钮 - Playwright: getByRole('button', { name: '图片' })
  imageButton: [
    'button[aria-label="图片"]',
    'button:contains("图片")',
    '.Editable-toolbarButton--image',
    '[data-tooltip="图片"]'
  ],
  
  // 公共图片库按钮 - Playwright: getByRole('button', { name: '公共图片库' })
  publicLibraryButton: [
    'button:contains("公共图片库")',
    '.ImageUploader-publicButton'
  ],
  
  // 图片搜索框 - Playwright: getByRole('textbox', { name: '输入关键字查找图片' })
  imageSearchInput: [
    'input[placeholder*="输入关键字"]',
    'input[placeholder*="查找图片"]',
    '.ImageSearch-input input'
  ],
  
  // 图片列表项
  imageItem: [
    '.css-128iodx',
    '.ImageSearch-item',
    '.Image-item',
    '[class*="ImageSearch"] img'
  ],
  
  // 插入图片按钮 - Playwright: getByRole('button', { name: '插入图片' })
  insertImageButton: [
    'button:contains("插入图片")',
    '.ImageUploader-insertButton'
  ],
  
  // 添加话题按钮 - Playwright: getByRole('button', { name: '添加话题' })
  addTopicButton: [
    'button:contains("添加话题")',
    '.TopicSelector-addButton'
  ],
  
  // 话题搜索框 - Playwright: getByRole('textbox', { name: '搜索话题' })
  topicSearchInput: [
    'input[placeholder*="搜索话题"]',
    '.TopicSelector-searchInput input'
  ],
  
  // 发布按钮 - Playwright: getByRole('button', { name: '发布' })
  publishButton: [
    'button:contains("发布")',
    '.PublishPanel-button',
    '.PostEditor-publishButton'
  ]
};

// ============================================
// DOM 工具函数
// ============================================

const findElement = (selectors: string[]): HTMLElement | null => {
  for (const selector of selectors) {
    try {
      if (selector.includes(':contains(')) {
        const match = selector.match(/(.+):contains\("([^"]+)"\)/);
        if (match) {
          const [, baseSelector, text] = match;
          const elements = document.querySelectorAll(baseSelector);
          for (const el of elements) {
            if (el.textContent?.includes(text)) {
              return el as HTMLElement;
            }
          }
        }
        continue;
      }
      
      const el = document.querySelector(selector);
      if (el && isElementVisible(el as HTMLElement)) {
        return el as HTMLElement;
      }
    } catch (e) { /* ignore */ }
  }
  return null;
};

const isElementVisible = (el: HTMLElement): boolean => {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0'
  );
};

const simulateClick = (element: HTMLElement) => {
  element.scrollIntoView({ behavior: 'instant', block: 'center' });
  
  const rect = element.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  
  const eventOptions = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: centerX,
    clientY: centerY
  };
  
  element.dispatchEvent(new MouseEvent('mouseover', eventOptions));
  element.dispatchEvent(new MouseEvent('mouseenter', eventOptions));
  element.dispatchEvent(new MouseEvent('mousedown', eventOptions));
  element.dispatchEvent(new MouseEvent('mouseup', eventOptions));
  element.dispatchEvent(new MouseEvent('click', eventOptions));
  element.click();
};

const simulateInput = (element: HTMLElement, value: string) => {
  element.focus();
  
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    element.select();
    document.execCommand('delete');
  }
  
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;

  if (element instanceof HTMLInputElement && nativeInputValueSetter) {
    nativeInputValueSetter.call(element, value);
  } else if (element instanceof HTMLTextAreaElement && nativeTextAreaValueSetter) {
    nativeTextAreaValueSetter.call(element, value);
  } else {
    element.innerText = value;
  }
  
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
};

// ============================================
// Logger UI - 与头条保持一致
// ============================================
class ZhihuLogger {
  private container: HTMLDivElement;
  private logContent: HTMLDivElement;
  private stopBtn: HTMLButtonElement;
  private onStop?: () => void;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'memoraid-zhihu-logger';
    this.container.style.cssText = 'position:fixed;top:20px;left:20px;width:380px;max-height:500px;background:rgba(0,0,0,0.9);color:#0af;font-family:Consolas,Monaco,monospace;font-size:12px;border-radius:8px;padding:12px;z-index:20000;display:none;flex-direction:column;box-shadow:0 4px 20px rgba(0,0,0,0.6);border:1px solid #0af;';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #444;padding-bottom:8px;margin-bottom:8px;';
    
    const title = document.createElement('span');
    title.innerHTML = '📘 <span style="color:#fff;font-weight:bold;">Memoraid</span> 知乎助手';
    
    const controls = document.createElement('div');
    controls.style.cssText = 'display:flex;gap:6px;';

    this.stopBtn = document.createElement('button');
    this.stopBtn.innerText = '停止';
    this.stopBtn.style.cssText = 'background:#d32f2f;color:white;border:none;border-radius:4px;padding:3px 8px;cursor:pointer;font-size:11px;display:none;';
    this.stopBtn.onclick = () => {
      if (this.onStop) this.onStop();
      this.log('🛑 已停止', 'error');
      this.stopBtn.style.display = 'none';
    };

    const copyBtn = document.createElement('button');
    copyBtn.innerText = '复制';
    copyBtn.style.cssText = 'background:#1976d2;color:white;border:none;border-radius:4px;padding:3px 8px;cursor:pointer;font-size:11px;';
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(this.logContent.innerText);
      copyBtn.innerText = '已复制';
      setTimeout(() => { copyBtn.innerText = '复制'; }, 1500);
    };

    const closeBtn = document.createElement('span');
    closeBtn.innerText = '✕';
    closeBtn.style.cssText = 'cursor:pointer;color:#888;font-size:16px;margin-left:8px;';
    closeBtn.onclick = () => {
      if (this.onStop) this.onStop();
      this.container.style.display = 'none';
    };

    controls.appendChild(this.stopBtn);
    controls.appendChild(copyBtn);
    controls.appendChild(closeBtn);
    header.appendChild(title);
    header.appendChild(controls);

    this.logContent = document.createElement('div');
    this.logContent.style.cssText = 'overflow-y:auto;flex:1;min-height:100px;max-height:400px;';

    this.container.appendChild(header);
    this.container.appendChild(this.logContent);
    document.body.appendChild(this.container);
  }

  show() { this.container.style.display = 'flex'; }
  hide() { this.container.style.display = 'none'; }
  setStopCallback(cb: () => void) { this.onStop = cb; this.stopBtn.style.display = 'block'; }
  hideStopButton() { this.stopBtn.style.display = 'none'; }
  clear() { this.logContent.innerHTML = ''; }

  log(message: string, type: 'info' | 'action' | 'error' | 'success' | 'warn' = 'info') {
    this.show();
    const line = document.createElement('div');
    line.style.cssText = 'margin-top:4px;word-wrap:break-word;white-space:pre-wrap;line-height:1.4;';
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    const colors: Record<string, string> = { info: '#aaa', action: '#0ff', error: '#f55', success: '#4f4', warn: '#fb0' };
    const icons: Record<string, string> = { info: 'ℹ️', action: '▶️', error: '❌', success: '✅', warn: '⚠️' };
    line.innerHTML = `<span style="color:#555">[${time}]</span> ${icons[type]} <span style="color:${colors[type]}">${message}</span>`;
    this.logContent.appendChild(line);
    this.logContent.scrollTop = this.logContent.scrollHeight;
    if (type === 'error') { reportError(message, { type, context: 'ZhihuContentScript' }); }
  }
}

const logger = new ZhihuLogger();

// ============================================
// 图片操作功能
// ============================================

let isFlowCancelled = false;
let isFlowRunning = false; // 添加锁机制，防止多个流程同时执行

const openImageDialog = async (): Promise<boolean> => {
  logger.log('查找图片按钮...', 'info');
  
  // 先点击编辑器获得焦点
  const editor = findElement(SELECTORS.editor);
  if (editor) {
    simulateClick(editor);
    await new Promise(r => setTimeout(r, 300));
  }
  
  // 查找图片按钮 - Playwright: getByRole('button', { name: '图片' })
  let imageBtn: HTMLElement | null = null;
  
  // 方法1: 通过 aria-label (最精确)
  imageBtn = document.querySelector('button[aria-label="图片"]') as HTMLElement;
  if (imageBtn) {
    logger.log('通过 aria-label 找到图片按钮', 'info');
  }
  
  // 方法2: 通过 data-tooltip
  if (!imageBtn) {
    imageBtn = document.querySelector('button[data-tooltip="图片"]') as HTMLElement;
    if (imageBtn) {
      logger.log('通过 data-tooltip 找到图片按钮', 'info');
    }
  }
  
  // 方法3: 通过按钮文本精确匹配
  if (!imageBtn) {
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const text = (btn as HTMLElement).innerText?.trim();
      if (text === '图片' && isElementVisible(btn as HTMLElement)) {
        imageBtn = btn as HTMLElement;
        logger.log('通过文本找到图片按钮', 'info');
        break;
      }
    }
  }
  
  // 方法4: 通过包含"图片"的按钮
  if (!imageBtn) {
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      if ((btn as HTMLElement).innerText?.includes('图片') && isElementVisible(btn as HTMLElement)) {
        imageBtn = btn as HTMLElement;
        break;
      }
    }
  }
  
  if (!imageBtn) {
    logger.log('未找到图片按钮', 'error');
    return false;
  }
  
  logger.log('点击图片按钮', 'action');
  
  // 使用更完整的点击模拟，确保下拉菜单能弹出
  imageBtn.focus();
  await new Promise(r => setTimeout(r, 100));
  
  // 先尝试直接 click
  imageBtn.click();
  await new Promise(r => setTimeout(r, 500));
  
  // 检查是否有下拉菜单出现
  let menuAppeared = false;
  const checkMenu = () => {
    // 查找可能的下拉菜单
    const menus = document.querySelectorAll('[class*="Popover"], [class*="popover"], [class*="Dropdown"], [class*="dropdown"], [class*="Menu"], [class*="menu"], [role="menu"], [role="listbox"]');
    for (const menu of menus) {
      if (isElementVisible(menu as HTMLElement)) {
        const text = (menu as HTMLElement).innerText;
        if (text?.includes('公共图片库') || text?.includes('本地上传')) {
          return true;
        }
      }
    }
    // 也检查是否有"公共图片库"文本出现
    const xpath = "//*[contains(text(), '公共图片库')]";
    const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    for (let i = 0; i < result.snapshotLength; i++) {
      const el = result.snapshotItem(i) as HTMLElement;
      if (el && isElementVisible(el)) {
        return true;
      }
    }
    return false;
  };
  
  menuAppeared = checkMenu();
  
  // 如果菜单没出现，尝试用 simulateClick
  if (!menuAppeared) {
    logger.log('下拉菜单未出现，尝试模拟点击...', 'info');
    simulateClick(imageBtn);
    await new Promise(r => setTimeout(r, 800));
    menuAppeared = checkMenu();
  }
  
  // 如果还是没出现，再试一次
  if (!menuAppeared) {
    logger.log('再次尝试点击图片按钮...', 'info');
    // 尝试 mousedown + mouseup
    const rect = imageBtn.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    imageBtn.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true, cancelable: true, view: window,
      clientX: centerX, clientY: centerY, button: 0
    }));
    await new Promise(r => setTimeout(r, 50));
    imageBtn.dispatchEvent(new MouseEvent('mouseup', {
      bubbles: true, cancelable: true, view: window,
      clientX: centerX, clientY: centerY, button: 0
    }));
    await new Promise(r => setTimeout(r, 800));
    menuAppeared = checkMenu();
  }
  
  if (menuAppeared) {
    logger.log('图片菜单已弹出', 'success');
  } else {
    logger.log('图片菜单可能未完全加载，继续尝试...', 'warn');
  }
  
  // 等待图片上传弹窗出现
  logger.log('等待图片弹窗加载...', 'info');
  await new Promise(r => setTimeout(r, 1000));
  
  return true;
};

const clickPublicLibrary = async (): Promise<boolean> => {
  logger.log('查找公共图片库按钮...', 'info');
  
  // 重试机制：最多尝试 8 次，每次间隔 500ms
  const maxAttempts = 8;
  let publicBtn: HTMLElement | null = null;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise(r => setTimeout(r, 500));
    
    // 方法1: 通过按钮文本精确匹配 (button 标签)
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const text = (btn as HTMLElement).innerText?.trim();
      if (text === '公共图片库' || text?.includes('公共图片库')) {
        if (isElementVisible(btn as HTMLElement)) {
          publicBtn = btn as HTMLElement;
          logger.log(`找到公共图片库按钮 [button] (尝试 ${attempt}/${maxAttempts})`, 'success');
          break;
        }
      }
    }
    
    if (publicBtn) break;
    
    // 方法2: 查找弹出层/模态框内的元素
    // 知乎的图片上传弹窗可能使用特定的 class
    const popups = document.querySelectorAll('[class*="Popover"], [class*="popover"], [class*="Modal"], [class*="modal"], [class*="Dropdown"], [class*="dropdown"], [class*="Menu"], [class*="menu"], [role="dialog"], [role="menu"], [role="listbox"]');
    for (const popup of popups) {
      if (!isElementVisible(popup as HTMLElement)) continue;
      
      // 在弹出层内查找包含"公共图片库"文本的元素
      const allInPopup = popup.querySelectorAll('*');
      for (const el of allInPopup) {
        const text = (el as HTMLElement).innerText?.trim();
        if (text === '公共图片库' && isElementVisible(el as HTMLElement)) {
          publicBtn = el as HTMLElement;
          logger.log(`在弹出层中找到公共图片库 (尝试 ${attempt}/${maxAttempts})`, 'success');
          break;
        }
      }
      if (publicBtn) break;
    }
    
    if (publicBtn) break;
    
    // 方法3: 全局搜索所有包含"公共图片库"文本的可见元素
    if (!publicBtn) {
      const allElements = document.querySelectorAll('div, span, a, li, p, label');
      for (const el of allElements) {
        // 只检查直接文本内容，避免匹配父容器
        const directText = Array.from(el.childNodes)
          .filter(node => node.nodeType === Node.TEXT_NODE)
          .map(node => node.textContent?.trim())
          .join('');
        
        if (directText === '公共图片库' && isElementVisible(el as HTMLElement)) {
          publicBtn = el as HTMLElement;
          logger.log(`通过直接文本找到公共图片库 (尝试 ${attempt}/${maxAttempts})`, 'success');
          break;
        }
        
        // 备用：检查 innerText 但确保是叶子节点
        const text = (el as HTMLElement).innerText?.trim();
        if (text === '公共图片库' && isElementVisible(el as HTMLElement)) {
          const children = el.querySelectorAll('*');
          let hasChildWithSameText = false;
          for (const child of children) {
            if ((child as HTMLElement).innerText?.trim() === '公共图片库') {
              hasChildWithSameText = true;
              break;
            }
          }
          if (!hasChildWithSameText) {
            publicBtn = el as HTMLElement;
            logger.log(`通过叶子节点找到公共图片库 (尝试 ${attempt}/${maxAttempts})`, 'success');
            break;
          }
        }
      }
    }
    
    if (publicBtn) break;
    
    // 方法4: 使用 XPath 查找包含"公共图片库"文本的元素
    if (!publicBtn) {
      const xpath = "//*[contains(text(), '公共图片库')]";
      const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      for (let i = 0; i < result.snapshotLength; i++) {
        const el = result.snapshotItem(i) as HTMLElement;
        if (el && isElementVisible(el)) {
          publicBtn = el;
          logger.log(`通过 XPath 找到公共图片库 (尝试 ${attempt}/${maxAttempts})`, 'success');
          break;
        }
      }
    }
    
    if (publicBtn) break;
    
    if (attempt < maxAttempts) {
      logger.log(`未找到公共图片库按钮，重试 ${attempt}/${maxAttempts}...`, 'info');
    }
  }
  
  if (!publicBtn) {
    logger.log('未找到公共图片库按钮', 'warn');
    // 打印调试信息 - 查找所有包含"图片"或"库"的元素
    logger.log('调试: 搜索包含"公共"或"图片库"的元素...', 'info');
    const allElements = document.querySelectorAll('*');
    let foundCount = 0;
    allElements.forEach((el) => {
      const text = (el as HTMLElement).innerText?.trim();
      if (text && (text.includes('公共') || text.includes('图片库')) && text.length < 20) {
        const visible = isElementVisible(el as HTMLElement);
        const tag = el.tagName.toLowerCase();
        if (visible && foundCount < 10) {
          logger.log(`  <${tag}>: "${text}"`, 'info');
          foundCount++;
        }
      }
    });
    return false;
  }
  
  logger.log('点击公共图片库', 'action');
  simulateClick(publicBtn);
  
  // 等待公共图片库界面加载
  logger.log('等待公共图片库界面加载...', 'info');
  await new Promise(r => setTimeout(r, 2000));
  
  return true;
};

const searchImage = async (keyword: string): Promise<boolean> => {
  logger.log(`搜索图片: ${keyword}`, 'info');
  
  // 增加等待时间，确保公共图片库界面完全加载
  // 公共图片库界面加载需要时间，搜索框可能延迟出现
  const maxSearchAttempts = 10;
  let searchInput: HTMLElement | null = null;
  
  for (let attempt = 1; attempt <= maxSearchAttempts; attempt++) {
    await new Promise(r => setTimeout(r, 800));
    
    // 首先确保我们在公共图片库界面内
    // 查找对话框/模态框
    const modal = document.querySelector('[role="dialog"], [class*="Modal"], [class*="modal"], [class*="Popover"], [class*="popover"]');
    
    // 方法1: 在模态框内查找搜索框
    if (modal && isElementVisible(modal as HTMLElement)) {
      const inputs = modal.querySelectorAll('input');
      for (const input of inputs) {
        const placeholder = input.getAttribute('placeholder') || '';
        if (placeholder.includes('关键字') || placeholder.includes('查找') || placeholder.includes('搜索')) {
          if (isElementVisible(input as HTMLElement)) {
            searchInput = input as HTMLElement;
            logger.log(`在模态框中找到搜索框 (placeholder: ${placeholder}) [尝试 ${attempt}/${maxSearchAttempts}]`, 'info');
            break;
          }
        }
      }
      
      // 如果没找到带 placeholder 的，找第一个可见的 input
      if (!searchInput) {
        for (const input of inputs) {
          if (isElementVisible(input as HTMLElement)) {
            searchInput = input as HTMLElement;
            logger.log(`在模态框中找到输入框 [尝试 ${attempt}/${maxSearchAttempts}]`, 'info');
            break;
          }
        }
      }
    }
    
    // 方法2: 全局查找 - Playwright 录制的选择器
    if (!searchInput) {
      searchInput = document.querySelector('input[placeholder*="输入关键字查找图片"]') as HTMLElement;
      if (searchInput && isElementVisible(searchInput)) {
        logger.log(`通过 placeholder 找到搜索框 [尝试 ${attempt}/${maxSearchAttempts}]`, 'info');
      } else {
        searchInput = null;
      }
    }
    
    // 方法3: 部分匹配
    if (!searchInput) {
      const selectors = [
        'input[placeholder*="输入关键字"]',
        'input[placeholder*="关键字查找"]',
        'input[placeholder*="查找图片"]'
      ];
      for (const selector of selectors) {
        const el = document.querySelector(selector) as HTMLElement;
        if (el && isElementVisible(el)) {
          searchInput = el;
          logger.log(`通过选择器 ${selector} 找到搜索框 [尝试 ${attempt}/${maxSearchAttempts}]`, 'info');
          break;
        }
      }
    }
    
    if (searchInput) break;
    
    if (attempt < maxSearchAttempts) {
      logger.log(`等待搜索框加载... (${attempt}/${maxSearchAttempts})`, 'info');
    }
  }
  
  if (!searchInput) {
    logger.log('未找到搜索框', 'error');
    // 打印页面上所有 input 的信息用于调试
    const allInputs = document.querySelectorAll('input');
    logger.log(`页面上共有 ${allInputs.length} 个 input 元素`, 'info');
    allInputs.forEach((input, i) => {
      const placeholder = input.getAttribute('placeholder') || '(无)';
      const visible = isElementVisible(input as HTMLElement);
      logger.log(`  input[${i}]: placeholder="${placeholder}", visible=${visible}`, 'info');
    });
    return false;
  }
  
  logger.log('点击搜索框', 'action');
  simulateClick(searchInput);
  await new Promise(r => setTimeout(r, 300));
  
  logger.log('输入搜索关键词', 'action');
  simulateInput(searchInput, keyword);
  await new Promise(r => setTimeout(r, 500));
  
  // ============================================
  // 关键修复：触发搜索
  // 从截图看到搜索框右边有一个放大镜图标按钮，需要点击它来触发搜索
  // ============================================
  logger.log('触发搜索...', 'info');
  
  // 重新获取模态框引用
  const currentModal = document.querySelector('[role="dialog"], [class*="Modal"], [class*="modal"], [class*="Popover"], [class*="popover"]');
  
  let searchTriggered = false;
  
  // 方法1: 查找搜索框旁边的放大镜图标按钮（最可能的方式）
  // 搜索框通常在一个容器内，放大镜图标在搜索框右边
  const searchInputParent = searchInput.parentElement;
  if (searchInputParent) {
    // 查找同级或子级的 svg/button/span 元素（放大镜图标）
    const iconElements = searchInputParent.querySelectorAll('svg, button, span, i, [class*="icon"], [class*="Icon"], [class*="search"], [class*="Search"]');
    for (const icon of iconElements) {
      if (icon !== searchInput && isElementVisible(icon as HTMLElement)) {
        const rect = (icon as HTMLElement).getBoundingClientRect();
        // 放大镜图标通常比较小，且在搜索框右边
        if (rect.width > 0 && rect.width < 50 && rect.height > 0 && rect.height < 50) {
          logger.log('找到搜索图标，点击触发搜索', 'action');
          simulateClick(icon as HTMLElement);
          searchTriggered = true;
          await new Promise(r => setTimeout(r, 500));
          break;
        }
      }
    }
  }
  
  // 方法2: 查找搜索框容器内的可点击元素
  if (!searchTriggered && searchInputParent) {
    // 有时候放大镜是 input 的兄弟元素
    const siblings = searchInputParent.children;
    for (const sibling of siblings) {
      if (sibling !== searchInput && isElementVisible(sibling as HTMLElement)) {
        const tagName = sibling.tagName.toLowerCase();
        if (tagName === 'svg' || tagName === 'button' || tagName === 'span' || tagName === 'i') {
          logger.log(`点击搜索框旁边的 ${tagName} 元素`, 'action');
          simulateClick(sibling as HTMLElement);
          searchTriggered = true;
          await new Promise(r => setTimeout(r, 500));
          break;
        }
      }
    }
  }
  
  // 方法3: 在模态框内查找 .css-13oeh20 按钮（之前的方法）
  if (!searchTriggered && currentModal && isElementVisible(currentModal as HTMLElement)) {
    const searchConfirmBtn = currentModal.querySelector('.css-13oeh20') as HTMLElement;
    if (searchConfirmBtn && isElementVisible(searchConfirmBtn)) {
      logger.log('点击搜索确认按钮 (.css-13oeh20)', 'action');
      simulateClick(searchConfirmBtn);
      searchTriggered = true;
      await new Promise(r => setTimeout(r, 500));
    }
  }
  
  // 方法4: 在模态框内查找"搜索"按钮
  if (!searchTriggered && currentModal) {
    const btns = currentModal.querySelectorAll('button');
    for (const btn of btns) {
      const text = (btn as HTMLElement).innerText?.trim();
      if (text === '搜索' || text?.includes('搜索')) {
        if (isElementVisible(btn as HTMLElement)) {
          logger.log('点击"搜索"按钮', 'action');
          simulateClick(btn as HTMLElement);
          searchTriggered = true;
          await new Promise(r => setTimeout(r, 500));
          break;
        }
      }
    }
  }
  
  // 方法5: 模拟回车键（多种方式）
  if (!searchTriggered) {
    logger.log('尝试按回车键搜索', 'action');
    
    // 确保搜索框获得焦点
    searchInput.focus();
    await new Promise(r => setTimeout(r, 100));
    
    // 方式1: 使用 KeyboardEvent
    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    });
    searchInput.dispatchEvent(enterEvent);
    
    // 方式2: 也发送 keypress 和 keyup
    searchInput.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
    searchInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
    
    // 方式3: 如果是 form 表单，尝试提交
    const form = searchInput.closest('form');
    if (form) {
      logger.log('找到表单，尝试提交', 'action');
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }
    
    searchTriggered = true;
  }
  
  logger.log('等待搜索结果...', 'info');
  await new Promise(r => setTimeout(r, 3000)); // 增加等待时间，确保搜索结果加载
  
  return true;
};

const selectImage = async (index = 0): Promise<boolean> => {
  logger.log('选择图片...', 'info');
  
  // 等待搜索结果完全加载（增加等待时间）
  await new Promise(r => setTimeout(r, 1500));
  
  // 严格按照 Playwright 录制的步骤：
  // await page.locator('.css-128iodx').first().click();
  // 只点击一次 .css-128iodx 元素来选中图片
  
  // 重试机制：最多尝试 5 次
  const maxAttempts = 5;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const imageElements = document.querySelectorAll('.css-128iodx');
    logger.log(`找到 ${imageElements.length} 个 .css-128iodx 元素 (尝试 ${attempt}/${maxAttempts})`, 'info');
    
    if (imageElements.length > 0) {
      const targetIndex = Math.min(index, imageElements.length - 1);
      const targetElement = imageElements[targetIndex] as HTMLElement;
      
      if (isElementVisible(targetElement)) {
        logger.log(`点击第 ${targetIndex + 1} 个图片 (.css-128iodx)`, 'action');
        
        // 只使用一种点击方式，避免重复点击导致取消选中
        const rect = targetElement.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        const mouseEventInit = {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: centerX,
          clientY: centerY,
          button: 0,
          buttons: 1
        };
        
        targetElement.dispatchEvent(new MouseEvent('mousedown', mouseEventInit));
        await new Promise(r => setTimeout(r, 50));
        targetElement.dispatchEvent(new MouseEvent('mouseup', mouseEventInit));
        targetElement.dispatchEvent(new MouseEvent('click', mouseEventInit));
        
        await new Promise(r => setTimeout(r, 800));
        
        logger.log('图片选择完成', 'success');
        return true;
      } else {
        logger.log('.css-128iodx 元素不可见', 'warn');
      }
    }
    
    // 等待后重试
    if (attempt < maxAttempts) {
      logger.log(`等待图片加载...`, 'info');
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  // 备用方法：查找模态框内的图片
  logger.log('尝试备用方法查找图片...', 'info');
  const modal = document.querySelector('[role="dialog"], [class*="Modal"], [class*="modal"]');
  if (modal) {
    const imgs = modal.querySelectorAll('img');
    const validImgs: HTMLElement[] = [];
    
    imgs.forEach(img => {
      const rect = img.getBoundingClientRect();
      if (rect.width >= 80 && rect.height >= 80 && isElementVisible(img as HTMLElement)) {
        validImgs.push(img as HTMLElement);
      }
    });
    
    logger.log(`在模态框中找到 ${validImgs.length} 张图片`, 'info');
    
    if (validImgs.length > 0) {
      const targetImg = validImgs[Math.min(index, validImgs.length - 1)];
      logger.log('点击图片', 'action');
      targetImg.click();
      await new Promise(r => setTimeout(r, 500));
      return true;
    }
  }
  
  logger.log('未找到可选择的图片', 'error');
  return false;
};

const clickInsertImage = async (): Promise<boolean> => {
  logger.log('查找插入图片按钮...', 'info');
  await new Promise(r => setTimeout(r, 500));
  
  let insertBtn: HTMLElement | null = null;
  
  // 方法1: 查找包含"插入图片"文本的按钮
  const buttons = document.querySelectorAll('button');
  for (const btn of buttons) {
    const text = (btn as HTMLElement).innerText?.trim();
    if (text === '插入图片' || text?.includes('插入图片')) {
      if (isElementVisible(btn as HTMLElement)) {
        insertBtn = btn as HTMLElement;
        logger.log('找到插入图片按钮', 'info');
        break;
      }
    }
  }
  
  // 方法2: 查找模态框内的插入按钮
  if (!insertBtn) {
    const modal = document.querySelector('[role="dialog"], [class*="Modal"], [class*="modal"]');
    if (modal) {
      const btns = modal.querySelectorAll('button');
      for (const btn of btns) {
        const text = (btn as HTMLElement).innerText?.trim();
        if (text === '插入图片' || text?.includes('插入')) {
          if (isElementVisible(btn as HTMLElement)) {
            insertBtn = btn as HTMLElement;
            logger.log('在模态框中找到插入图片按钮', 'info');
            break;
          }
        }
      }
    }
  }
  
  if (!insertBtn) {
    logger.log('未找到插入图片按钮', 'error');
    // 调试：打印所有可见按钮
    const allBtns = document.querySelectorAll('button');
    logger.log(`页面上共有 ${allBtns.length} 个按钮`, 'info');
    allBtns.forEach((btn, i) => {
      const text = (btn as HTMLElement).innerText?.trim();
      if (text && isElementVisible(btn as HTMLElement) && text.length < 20) {
        logger.log(`  button[${i}]: "${text}"`, 'info');
      }
    });
    return false;
  }
  
  logger.log('点击插入图片按钮', 'action');
  
  // 使用与选择图片相同的点击方式
  const rect = insertBtn.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  
  const mouseEventInit = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: centerX,
    clientY: centerY,
    button: 0,
    buttons: 1
  };
  
  insertBtn.dispatchEvent(new MouseEvent('mousedown', mouseEventInit));
  await new Promise(r => setTimeout(r, 50));
  insertBtn.dispatchEvent(new MouseEvent('mouseup', mouseEventInit));
  insertBtn.dispatchEvent(new MouseEvent('click', mouseEventInit));
  
  await new Promise(r => setTimeout(r, 1500));
  
  logger.log('插入图片按钮已点击', 'success');
  return true;
};

const addTopic = async (topic: string): Promise<boolean> => {
  logger.log(`添加话题: ${topic}`, 'info');
  
  // 点击添加话题按钮
  const buttons = document.querySelectorAll('button');
  let addTopicBtn: HTMLElement | null = null;
  
  for (const btn of buttons) {
    if ((btn as HTMLElement).innerText?.includes('添加话题')) {
      addTopicBtn = btn as HTMLElement;
      break;
    }
  }
  
  if (!addTopicBtn) {
    logger.log('未找到添加话题按钮', 'warn');
    return false;
  }
  
  simulateClick(addTopicBtn);
  await new Promise(r => setTimeout(r, 500));
  
  // 搜索话题
  let topicInput = document.querySelector('input[placeholder*="搜索话题"]') as HTMLElement;
  if (!topicInput) {
    const inputs = document.querySelectorAll('input');
    for (const input of inputs) {
      if (isElementVisible(input as HTMLElement)) {
        topicInput = input as HTMLElement;
        break;
      }
    }
  }
  
  if (topicInput) {
    simulateClick(topicInput);
    simulateInput(topicInput, topic);
    await new Promise(r => setTimeout(r, 1000));
    
    // 点击第一个话题结果
    const topicResults = document.querySelectorAll('button');
    for (const btn of topicResults) {
      const text = (btn as HTMLElement).innerText?.trim();
      if (text === topic || text?.includes(topic)) {
        simulateClick(btn as HTMLElement);
        logger.log(`话题已添加: ${topic}`, 'success');
        await new Promise(r => setTimeout(r, 500));
        return true;
      }
    }
  }
  
  return false;
};

const clickPublish = async (): Promise<boolean> => {
  logger.log('查找发布按钮...', 'info');
  
  const buttons = document.querySelectorAll('button');
  let publishBtn: HTMLElement | null = null;
  
  for (const btn of buttons) {
    const text = (btn as HTMLElement).innerText?.trim();
    if (text === '发布' && isElementVisible(btn as HTMLElement)) {
      publishBtn = btn as HTMLElement;
      break;
    }
  }
  
  if (!publishBtn) {
    logger.log('未找到发布按钮', 'error');
    return false;
  }
  
  logger.log('点击发布按钮', 'action');
  simulateClick(publishBtn);
  await new Promise(r => setTimeout(r, 2000));
  
  logger.log('✅ 文章已发布！', 'success');
  return true;
};

/**
 * 投稿至问题功能
 * 根据 Playwright 录制和实际页面结构：
 * 1. 找到"投稿至问题"区域并点击（显示"未选择"的下拉框）
 * 2. 等待问题列表弹出
 * 3. 点击第一个问题的"选择"按钮
 * 4. 点击"确定"按钮确认
 * 5. 关闭弹窗
 */
const submitToQuestion = async (): Promise<boolean> => {
  // 不清除日志，保持连续显示
  logger.show();
  logger.log('🎯 开始投稿至问题...', 'info');
  
  // ============================================
  // 步骤1: 找到"投稿至问题"区域并点击
  // 从截图看，这是一个包含"投稿至问题"标签和"未选择"下拉框的区域
  // ============================================
  let submitToggle: HTMLElement | null = null;
  
  // 方法1: 查找包含"投稿至问题"文本的区域，然后找到旁边的下拉框/按钮
  logger.log('查找"投稿至问题"区域...', 'info');
  
  // 先找到"投稿至问题"文本元素
  const allElements = document.querySelectorAll('*');
  let submitLabelElement: HTMLElement | null = null;
  
  for (const el of allElements) {
    const text = (el as HTMLElement).innerText?.trim();
    // 精确匹配或包含"投稿至问题"
    if (text === '投稿至问题' || (text?.startsWith('投稿至问题') && text.length < 20)) {
      if (isElementVisible(el as HTMLElement)) {
        submitLabelElement = el as HTMLElement;
        logger.log(`找到"投稿至问题"标签: <${el.tagName.toLowerCase()}>`, 'info');
        break;
      }
    }
  }
  
  if (submitLabelElement) {
    // 找到标签后，查找同一行/容器内的下拉框或可点击元素
    const parent = submitLabelElement.parentElement;
    const grandParent = parent?.parentElement;
    
    // 在父容器中查找可点击的元素（下拉框、按钮等）
    const containers = [parent, grandParent, grandParent?.parentElement].filter(Boolean);
    
    for (const container of containers) {
      if (!container) continue;
      
      // 查找 Popover toggle
      const toggles = container.querySelectorAll('[id*="Popover"][id*="toggle"], [class*="toggle"], [class*="Select"], [class*="select"], [role="combobox"], [role="listbox"]');
      for (const toggle of toggles) {
        if (isElementVisible(toggle as HTMLElement)) {
          submitToggle = toggle as HTMLElement;
          logger.log(`在容器中找到下拉框: ${toggle.id || toggle.className}`, 'info');
          break;
        }
      }
      if (submitToggle) break;
      
      // 查找包含"未选择"文本的元素（这是下拉框的默认值）
      const childElements = container.querySelectorAll('*');
      for (const child of childElements) {
        const childText = (child as HTMLElement).innerText?.trim();
        if (childText === '未选择' && isElementVisible(child as HTMLElement)) {
          // 找到"未选择"文本，它的父元素或自身可能是可点击的
          submitToggle = child as HTMLElement;
          // 尝试找到更合适的可点击父元素
          let clickableParent = child.parentElement;
          while (clickableParent && clickableParent !== container) {
            const tagName = clickableParent.tagName.toLowerCase();
            if (tagName === 'button' || clickableParent.getAttribute('role') === 'button' || 
                clickableParent.id?.includes('Popover') || clickableParent.className?.includes('toggle')) {
              submitToggle = clickableParent as HTMLElement;
              break;
            }
            clickableParent = clickableParent.parentElement;
          }
          logger.log('找到"未选择"下拉框', 'info');
          break;
        }
      }
      if (submitToggle) break;
    }
  }
  
  // 方法2: 直接通过 Popover ID 查找
  if (!submitToggle) {
    logger.log('尝试通过 Popover ID 查找...', 'info');
    for (let i = 1; i <= 20; i++) {
      const toggle = document.querySelector(`#Popover${i}-toggle`) as HTMLElement;
      if (toggle && isElementVisible(toggle)) {
        // 检查这个 toggle 附近是否有"投稿"相关文字
        const parent = toggle.parentElement?.parentElement;
        if (parent && parent.innerText?.includes('投稿')) {
          submitToggle = toggle;
          logger.log(`找到投稿按钮: #Popover${i}-toggle`, 'info');
          break;
        }
      }
    }
  }
  
  // 方法3: 查找所有包含"未选择"的可点击元素
  if (!submitToggle) {
    logger.log('尝试查找"未选择"元素...', 'info');
    const buttons = document.querySelectorAll('button, [role="button"], [id*="Popover"]');
    for (const btn of buttons) {
      const text = (btn as HTMLElement).innerText?.trim();
      if (text?.includes('未选择') && isElementVisible(btn as HTMLElement)) {
        submitToggle = btn as HTMLElement;
        logger.log('找到包含"未选择"的按钮', 'info');
        break;
      }
    }
  }
  
  if (!submitToggle) {
    logger.log('未找到投稿至问题的下拉框', 'error');
    // 调试：打印页面上的相关元素
    logger.log('调试: 查找包含"投稿"的元素...', 'info');
    const debugElements = document.querySelectorAll('*');
    let count = 0;
    debugElements.forEach(el => {
      const text = (el as HTMLElement).innerText?.trim();
      if (text && text.includes('投稿') && text.length < 30 && isElementVisible(el as HTMLElement) && count < 5) {
        logger.log(`  <${el.tagName.toLowerCase()}>: "${text}"`, 'info');
        count++;
      }
    });
    return false;
  }
  
  // 点击下拉框打开问题选择面板
  logger.log('点击投稿至问题下拉框', 'action');
  simulateClick(submitToggle);
  await new Promise(r => setTimeout(r, 1500));
  
  // ============================================
  // 步骤2: 等待问题列表加载，然后点击"选择"按钮
  // ============================================
  logger.log('等待问题列表加载...', 'info');
  
  // 增加等待时间，确保弹窗完全加载
  await new Promise(r => setTimeout(r, 1500));
  
  let selectBtn: HTMLElement | null = null;
  const maxSelectAttempts = 10;
  
  for (let attempt = 1; attempt <= maxSelectAttempts; attempt++) {
    // 查找"选择"按钮 - 需要在弹窗内查找
    const modal = document.querySelector('[role="dialog"], [class*="Modal"], [class*="modal"]');
    const searchScope = modal || document;
    
    const buttons = searchScope.querySelectorAll('button');
    for (const btn of buttons) {
      const text = (btn as HTMLElement).innerText?.trim();
      if (text === '选择' && isElementVisible(btn as HTMLElement)) {
        selectBtn = btn as HTMLElement;
        logger.log(`找到"选择"按钮 [尝试 ${attempt}/${maxSelectAttempts}]`, 'success');
        break;
      }
    }
    
    if (selectBtn) break;
    
    if (attempt < maxSelectAttempts) {
      logger.log(`等待问题列表... (${attempt}/${maxSelectAttempts})`, 'info');
      await new Promise(r => setTimeout(r, 800));
    }
  }
  
  if (!selectBtn) {
    logger.log('未找到"选择"按钮，可能没有推荐问题', 'warn');
    // 尝试关闭弹窗
    const closeButtons = document.querySelectorAll('button');
    for (const btn of closeButtons) {
      const text = (btn as HTMLElement).innerText?.trim();
      if (text === '关闭' && isElementVisible(btn as HTMLElement)) {
        simulateClick(btn as HTMLElement);
        break;
      }
    }
    return false;
  }
  
  // 点击"选择"按钮选择第一个问题
  // 使用更强的点击方式
  logger.log('点击"选择"按钮选择第一个问题', 'action');
  selectBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
  await new Promise(r => setTimeout(r, 500));
  
  // 使用多种点击方式确保点击成功
  const rect = selectBtn.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  
  // 先 focus
  selectBtn.focus();
  await new Promise(r => setTimeout(r, 100));
  
  // 方式1: 完整的鼠标事件序列
  selectBtn.dispatchEvent(new MouseEvent('mouseover', {
    bubbles: true, cancelable: true, view: window,
    clientX: centerX, clientY: centerY
  }));
  await new Promise(r => setTimeout(r, 50));
  
  selectBtn.dispatchEvent(new MouseEvent('mouseenter', {
    bubbles: true, cancelable: true, view: window,
    clientX: centerX, clientY: centerY
  }));
  await new Promise(r => setTimeout(r, 50));
  
  selectBtn.dispatchEvent(new MouseEvent('mousedown', {
    bubbles: true, cancelable: true, view: window,
    clientX: centerX, clientY: centerY, button: 0, buttons: 1
  }));
  await new Promise(r => setTimeout(r, 100));
  
  selectBtn.dispatchEvent(new MouseEvent('mouseup', {
    bubbles: true, cancelable: true, view: window,
    clientX: centerX, clientY: centerY, button: 0
  }));
  await new Promise(r => setTimeout(r, 50));
  
  selectBtn.dispatchEvent(new MouseEvent('click', {
    bubbles: true, cancelable: true, view: window,
    clientX: centerX, clientY: centerY, button: 0
  }));
  
  // 方式2: 直接调用 click()
  selectBtn.click();
  
  logger.log('已点击"选择"按钮', 'info');
  await new Promise(r => setTimeout(r, 2000)); // 增加等待时间
  
  // ============================================
  // 步骤3: 点击"确定"按钮确认选择
  // ============================================
  logger.log('查找"确定"按钮...', 'info');
  let confirmBtn: HTMLElement | null = null;
  
  const maxConfirmAttempts = 5;
  for (let attempt = 1; attempt <= maxConfirmAttempts; attempt++) {
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const text = (btn as HTMLElement).innerText?.trim();
      if (text === '确定' && isElementVisible(btn as HTMLElement)) {
        confirmBtn = btn as HTMLElement;
        logger.log('找到"确定"按钮', 'success');
        break;
      }
    }
    
    if (confirmBtn) break;
    
    if (attempt < maxConfirmAttempts) {
      await new Promise(r => setTimeout(r, 300));
    }
  }
  
  if (confirmBtn) {
    logger.log('点击"确定"按钮', 'action');
    simulateClick(confirmBtn);
    await new Promise(r => setTimeout(r, 1000));
  } else {
    logger.log('未找到"确定"按钮', 'warn');
  }
  
  // ============================================
  // 步骤4: 关闭弹窗（根据 Playwright 录制，需要再次点击然后关闭）
  // ============================================
  // 再次点击投稿区域
  logger.log('再次点击投稿区域', 'action');
  simulateClick(submitToggle);
  await new Promise(r => setTimeout(r, 800));
  
  // 点击"关闭"按钮
  logger.log('查找"关闭"按钮...', 'info');
  let closeBtn: HTMLElement | null = null;
  
  const buttons = document.querySelectorAll('button');
  for (const btn of buttons) {
    const text = (btn as HTMLElement).innerText?.trim();
    if (text === '关闭' && isElementVisible(btn as HTMLElement)) {
      closeBtn = btn as HTMLElement;
      logger.log('找到"关闭"按钮', 'info');
      break;
    }
  }
  
  if (closeBtn) {
    logger.log('点击"关闭"按钮', 'action');
    simulateClick(closeBtn);
    await new Promise(r => setTimeout(r, 500));
  } else {
    logger.log('未找到"关闭"按钮，尝试按 ESC 关闭', 'info');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
    await new Promise(r => setTimeout(r, 300));
  }
  
  logger.log('✅ 投稿至问题完成！', 'success');
  return true;
};

// 关闭图片对话框的辅助函数
const closeImageDialog = async (): Promise<void> => {
  // 尝试多种方式关闭对话框
  const closeSelectors = [
    '[aria-label="关闭"]',
    '[class*="close"]',
    'button[aria-label="Close"]',
    '.Modal-closeButton',
    '[class*="Modal"] [class*="close"]'
  ];
  
  for (const selector of closeSelectors) {
    const closeBtn = document.querySelector(selector) as HTMLElement;
    if (closeBtn && isElementVisible(closeBtn)) {
      closeBtn.click();
      await new Promise(r => setTimeout(r, 500));
      return;
    }
  }
  
  // 尝试按 ESC 键关闭
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
  await new Promise(r => setTimeout(r, 500));
  
  // 点击对话框外部关闭
  const modal = document.querySelector('[class*="Modal-mask"], [class*="modal-mask"], [class*="Overlay"]') as HTMLElement;
  if (modal && isElementVisible(modal)) {
    modal.click();
    await new Promise(r => setTimeout(r, 500));
  }
};


/**
 * 查找所有图片占位符
 */
const findImagePlaceholders = (): { text: string; keyword: string }[] => {
  const editor = findElement(SELECTORS.editor);
  if (!editor) return [];
  
  const content = editor.innerText || '';
  const placeholders: { text: string; keyword: string }[] = [];
  
  // 匹配多种格式的图片占位符
  // 注意：需要匹配中英文冒号和空格的各种组合
  const patterns = [
    /\[图片[：:]\s*([^\]]+)\]/g,




  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      placeholders.push({ 
        text: match[0], 
        keyword: match[1].trim()
      });
    }
  }
  
  return placeholders;
};

/**
 * 删除编辑器中的指定文本
 */
const deleteTextInEditor = async (searchText: string): Promise<boolean> => {
  const editor = findElement(SELECTORS.editor);
  if (!editor) return false;

  // 多次尝试删除，确保删除成功
  for (let attempt = 0; attempt < 3; attempt++) {
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
    let node: Node | null;
    let found = false;
    
    while ((node = walker.nextNode())) {
      if (node.textContent && node.textContent.includes(searchText)) {
        const range = document.createRange();
        const startIndex = node.textContent.indexOf(searchText);
        range.setStart(node, startIndex);
        range.setEnd(node, startIndex + searchText.length);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        
        // 删除选中的文本
        document.execCommand('delete');
        found = true;
        await new Promise(r => setTimeout(r, 200));
        break;
      }
    }
    
    if (!found) {
      // 文本已经不存在了，删除成功
      return true;
    }
    
    // 检查是否还存在
    const currentContent = editor.innerText || '';
    if (!currentContent.includes(searchText)) {
      return true;
    }
    
    await new Promise(r => setTimeout(r, 300));
  }
  
  // 最后检查
  const finalContent = editor.innerText || '';
  return !finalContent.includes(searchText);
};


/**
 * 只插入图片（不处理占位符）
 */
const insertImageOnly = async (keyword: string): Promise<boolean> => {
  if (isFlowCancelled) return false;
  
  // 1. 打开图片对话框
  if (!await openImageDialog()) {
    logger.log('无法打开图片对话框', 'warn');
    return false;
  }
  if (isFlowCancelled) return false;
  
  // 2. 点击公共图片库
  const publicLibrarySuccess = await clickPublicLibrary();
  if (!publicLibrarySuccess) {
    logger.log('无法打开公共图片库', 'warn');
    await closeImageDialog();
    return false;
  }
  if (isFlowCancelled) return false;
  
  // 3. 搜索图片
  if (!await searchImage(keyword)) {
    logger.log('搜索图片失败', 'warn');
    await closeImageDialog();
    return false;
  }
  if (isFlowCancelled) return false;
  
  // 4. 选择图片
  if (!await selectImage(0)) {
    logger.log('选择图片失败（可能没有搜索结果）', 'warn');
    await closeImageDialog();
    return false;
  }
  if (isFlowCancelled) return false;
  
  // 5. 插入图片
  if (!await clickInsertImage()) {
    logger.log('插入图片失败', 'warn');
    return false;
  }
  
  logger.log(`图片 "${keyword}" 插入成功`, 'success');
  return true;
};

// ============================================
// 主流程
// ============================================

const runSmartImageFlow = async (keyword?: string, autoPublish = false) => {
  // 检查是否已有流程在运行，防止多个流程同时执行
  if (isFlowRunning) {
    logger.log('⚠️ 已有图片处理流程在运行，请等待完成', 'warn');
    return;
  }
  
  isFlowRunning = true; // 设置锁
  isFlowCancelled = false;
  // logger.clear();
  logger.show();
  logger.setStopCallback(() => { 
    isFlowCancelled = true; 
    isFlowRunning = false; // 取消时释放锁
  });
  logger.log('🚀 开始知乎图片处理...', 'info');
  
  try {
    // 先取消任何选中状态，避免干扰
    const selection = window.getSelection();
    selection?.removeAllRanges();
    
    // 点击编辑器外部区域，确保没有弹窗干扰
    const editor = findElement(SELECTORS.editor);
    if (editor) {
      editor.click();
      await new Promise(r => setTimeout(r, 300));
    }
    
    // 查找所有图片占位符
    const placeholders = findImagePlaceholders();
    
    if (placeholders.length === 0) {
      // 如果没有找到图片占位符，使用默认关键词在末尾插入一张图片
      const searchKeyword = keyword || extractKeywordFromTitle() || '风景';
      logger.log(`未找到图片占位符，使用关键词: ${searchKeyword}`, 'info');
      
      // 移动光标到编辑器末尾
      if (editor) {
        editor.focus();
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
      
      // 按顺序执行图片插入流程
      logger.log('步骤 1/5: 打开图片对话框', 'info');
      const dialogOpened = await openImageDialog();
      if (!dialogOpened) {
        logger.log('无法打开图片对话框，流程终止', 'error');
        return;
      }
      
      logger.log('步骤 2/5: 点击公共图片库', 'info');
      const publicLibraryOpened = await clickPublicLibrary();
      if (!publicLibraryOpened) {
        logger.log('无法打开公共图片库，流程终止', 'error');
        await closeImageDialog();
        return;
      }
      
      logger.log('步骤 3/5: 搜索图片', 'info');
      const searchSuccess = await searchImage(searchKeyword);
      if (!searchSuccess) {
        logger.log('搜索图片失败，流程终止', 'error');
        await closeImageDialog();
        return;
      }
      
      logger.log('步骤 4/5: 选择图片', 'info');
      const selectSuccess = await selectImage(0);
      if (!selectSuccess) {
        logger.log('选择图片失败，流程终止', 'error');
        await closeImageDialog();
        return;
      }
      
      logger.log('步骤 5/5: 插入图片', 'info');
      const insertSuccess = await clickInsertImage();
      if (insertSuccess) {
        logger.log('✅ 图片插入成功！', 'success');
      } else {
        logger.log('插入图片失败', 'error');
      }
    } else {
      logger.log(`找到 ${placeholders.length} 个图片占位符`, 'info');
      placeholders.forEach((p, i) => {
        logger.log(`  ${i + 1}. ${p.text}`, 'info');
      });
      
      let successCount = 0;
      
      // 先删除所有占位符，再逐个插入图片
      // 这样可以避免位置偏移问题
      logger.log('先删除所有占位符...', 'info');
      for (const placeholder of placeholders) {
        const deleted = await deleteTextInEditor(placeholder.text);
        if (deleted) {
          logger.log(`已删除: ${placeholder.text}`, 'success');
        } else {
          logger.log(`删除失败: ${placeholder.text}`, 'warn');
        }
        await new Promise(r => setTimeout(r, 300));
      }
      
      // 然后逐个插入图片（在编辑器末尾插入）
      for (let i = 0; i < placeholders.length; i++) {
        if (isFlowCancelled) {
          logger.log('用户取消操作', 'warn');
          break;
        }
        
        const placeholder = placeholders[i];
        logger.log(`\n📷 插入第 ${i + 1}/${placeholders.length} 张图片: ${placeholder.keyword}`, 'info');
        
        // 移动光标到编辑器末尾
        if (editor) {
          editor.focus();
          const sel = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(editor);
          range.collapse(false);
          sel?.removeAllRanges();
          sel?.addRange(range);
        }
        
        // 插入图片
        const success = await insertImageOnly(placeholder.keyword);
        
        if (success) {
          successCount++;
        } else {
          logger.log(`第 ${i + 1} 张图片插入失败`, 'error');
        }
        
        // 等待图片加载完成后再继续下一个
        await new Promise(r => setTimeout(r, 2000));
      }
      
      logger.log(`\n🎉 图片处理完成！成功替换 ${successCount}/${placeholders.length} 个占位符`, 'success');
    }
    
    // ============================================
    // 图片处理完成后，自动执行投稿至问题
    // ============================================
    if (!isFlowCancelled) {
      logger.log('\n📋 2秒后开始投稿至问题...', 'info');
      await new Promise(r => setTimeout(r, 2000));
      await submitToQuestion();
    }
    
    // 如果开启自动发布
    if (autoPublish && !isFlowCancelled) {
      logger.log('📤 自动发布文章...', 'info');
      await new Promise(r => setTimeout(r, 1000));
      await clickPublish();
    }
    
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    logger.log(`❌ 流程错误: ${errorMsg}`, 'error');
  } finally {
    logger.hideStopButton();
    isFlowRunning = false; // 释放锁，允许下次执行
  }
};

const extractKeywordFromTitle = (): string => {
  const titleEl = findElement(SELECTORS.titleInput);
  if (titleEl) {
    const title = (titleEl as HTMLInputElement | HTMLTextAreaElement).value || titleEl.innerText;
    if (title && title.length > 2) {
      return title.substring(0, Math.min(title.length, 10)).replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
    }
  }
  return '风景';
};

// ============================================
// 自动填充逻辑
// ============================================

/**
 * 检测并点击 Markdown 解析确认按钮
 * 当粘贴 Markdown 内容时，知乎会弹出一个 Notification 提示：
 * "识别到特殊格式，请确认是否 Markdown"，旁边有"确认并解析"按钮
 * 
 * 关键元素：
 * - 提示容器: <div class="css-vdqn4r Notification Notification--white ...">
 * - 确认按钮: <button class="Button css-1s3fe44 Button--link">确认并解析</button>
 * 
 * 注意：
 * 1. 这个提示会在几秒后自动消失，需要快速点击！
 * 2. 如果内容太短，可能不会显示提示，但底部会显示"Markdown 语法输入中"
 */
const handleMarkdownParse = async (): Promise<boolean> => {
  logger.log('🔍 检测 Markdown 格式解析提示...', 'info');
  
  // 首先检查是否已经在 Markdown 模式（底部显示"Markdown 语法输入中"）
  const markdownIndicator = document.evaluate(
    "//*[contains(text(), 'Markdown 语法输入中')]",
    document,
    null,
    XPathResult.FIRST_ORDERED_NODE_TYPE,
    null
  ).singleNodeValue;
  
  if (markdownIndicator && isElementVisible(markdownIndicator as HTMLElement)) {
    logger.log('✅ 已在 Markdown 模式（底部显示"Markdown 语法输入中"）', 'success');
    // 已经在 Markdown 模式，不需要点击确认按钮
    // 但我们仍然尝试查找并点击"确认并解析"按钮，以防有更好的渲染效果
  }
  
  // 快速检测，因为提示会自动消失
  const maxAttempts = 8;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // 第一次立即检测，之后每次等待 300ms
    if (attempt > 1) {
      await new Promise(r => setTimeout(r, 300));
    }
    
    // 方法1: 直接查找 Notification 容器内的"确认并解析"按钮（最精确）
    const notifications = document.querySelectorAll('[class*="Notification"]');
    for (const notification of notifications) {
      if (!isElementVisible(notification as HTMLElement)) continue;
      
      // 在 Notification 内查找按钮
      const btns = notification.querySelectorAll('button');
      for (const btn of btns) {
        const text = (btn as HTMLElement).innerText?.trim();
        if (text === '确认并解析') {
          logger.log('在 Notification 中找到"确认并解析"按钮', 'info');
          simulateClick(btn as HTMLElement);
          await new Promise(r => setTimeout(r, 1000));
          logger.log('✅ Markdown 格式已解析', 'success');
          return true;
        }
      }
    }
    
    // 方法2: 查找 class 包含 Button--link 的"确认并解析"按钮
    const linkButtons = document.querySelectorAll('button[class*="Button--link"]');
    for (const btn of linkButtons) {
      const text = (btn as HTMLElement).innerText?.trim();
      if (text === '确认并解析' && isElementVisible(btn as HTMLElement)) {
        logger.log('找到 Button--link 类型的"确认并解析"按钮', 'info');
        simulateClick(btn as HTMLElement);
        await new Promise(r => setTimeout(r, 1000));
        logger.log('✅ Markdown 格式已解析', 'success');
        return true;
      }
    }
    
    // 方法3: 查找所有包含"确认并解析"文本的按钮
    const allButtons = document.querySelectorAll('button');
    for (const btn of allButtons) {
      const text = (btn as HTMLElement).innerText?.trim();
      if (text === '确认并解析' && isElementVisible(btn as HTMLElement)) {
        logger.log('找到"确认并解析"按钮', 'info');
        simulateClick(btn as HTMLElement);
        await new Promise(r => setTimeout(r, 1000));
        logger.log('✅ Markdown 格式已解析', 'success');
        return true;
      }
    }
    
    if (attempt < maxAttempts) {
      logger.log(`等待 Markdown 解析提示... (${attempt}/${maxAttempts})`, 'info');
    }
  }
  
  // 如果没找到"确认并解析"按钮，但已经在 Markdown 模式，也算成功
  if (markdownIndicator) {
    logger.log('ℹ️ 未找到"确认并解析"按钮，但已在 Markdown 模式', 'info');
    return true;
  }
  
  logger.log('未检测到 Markdown 解析提示（提示可能已消失或内容不是 Markdown 格式）', 'info');
  return false;
};

/**
 * 使用 Ctrl+A 全选编辑器内容，触发 Markdown 解析
 * 根据 Playwright 录制：
 * 1. await page.getByRole('textbox').filter({ hasText: '...' }).press('ControlOrMeta+a');
 * 2. await page.locator('div').filter({ hasText: /^请输入正文$/ }).nth(1).click();
 * 3. await page.getByRole('button', { name: '确认并解析' }).nth(1).click();
 * 
 * 关键：第2步点击"请输入正文"区域可能是触发 Markdown 解析提示的关键！
 */
const selectAllAndTriggerMarkdownParse = async (editorEl: HTMLElement): Promise<void> => {
  logger.log('📝 全选内容以触发 Markdown 解析...', 'info');
  
  // 1. 先点击编辑器确保获得焦点
  editorEl.click();
  editorEl.focus();
  await new Promise(r => setTimeout(r, 300));
  
  // 2. 查找可编辑的 textbox 区域（根据 Playwright: getByRole('textbox')）
  const textboxes = document.querySelectorAll('[role="textbox"], [contenteditable="true"]');
  let targetTextbox: HTMLElement | null = null;
  
  for (const tb of textboxes) {
    if (isElementVisible(tb as HTMLElement) && (tb as HTMLElement).innerText?.length > 0) {
      targetTextbox = tb as HTMLElement;
      break;
    }
  }
  
  if (targetTextbox) {
    targetTextbox.focus();
    await new Promise(r => setTimeout(r, 200));
  }
  
  // 3. 模拟 Ctrl+A 全选 - 使用多种方式确保生效
  const target = targetTextbox || editorEl;
  
  // 方式1: 使用 Selection API 全选
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(target);
  selection?.removeAllRanges();
  selection?.addRange(range);
  
  // 方式2: 发送键盘事件
  const ctrlADown = new KeyboardEvent('keydown', {
    key: 'a',
    code: 'KeyA',
    keyCode: 65,
    which: 65,
    ctrlKey: true,
    metaKey: true, // 兼容 Mac
    bubbles: true,
    cancelable: true
  });
  target.dispatchEvent(ctrlADown);
  
  await new Promise(r => setTimeout(r, 500));
  logger.log('内容已全选', 'info');
  
  // 4. 关键步骤：点击"请输入正文"区域（根据 Playwright 录制）
  // 这可能是触发 Markdown 解析提示的关键！
  logger.log('尝试点击编辑器占位符区域触发解析提示...', 'info');
  
  // 查找包含"请输入正文"文本的 div
  const allDivs = document.querySelectorAll('div');
  for (const div of allDivs) {
    const text = (div as HTMLElement).innerText?.trim();
    if (text === '请输入正文' && isElementVisible(div as HTMLElement)) {
      logger.log('找到"请输入正文"占位符，点击触发', 'action');
      simulateClick(div as HTMLElement);
      await new Promise(r => setTimeout(r, 500));
      break;
    }
  }
  
  // 5. 也尝试点击编辑器工具栏区域，可能触发解析
  const toolbar = document.querySelector('[class*="Toolbar"], [class*="toolbar"]');
  if (toolbar && isElementVisible(toolbar as HTMLElement)) {
    // 不点击工具栏，可能会触发其他操作
  }
};

const fillContent = async () => {
  try {
    const data = await chrome.storage.local.get('pending_zhihu_publish');
    if (!data || !data.pending_zhihu_publish) return;
    
    const payload: PublishData = data.pending_zhihu_publish;
    if (Date.now() - payload.timestamp > 5 * 60 * 1000) {
      chrome.storage.local.remove('pending_zhihu_publish');
      return;
    }

    // 读取自动发布设置
    const settings = await chrome.storage.sync.get(['zhihu']);
    const autoPublish = settings.zhihu?.autoPublish || false;

    logger.log(`📄 准备填充内容: ${payload.title}`, 'info');
    if (autoPublish) {
      logger.log('🔔 自动发布已开启', 'info');
    }
    logger.log('⏳ 等待编辑器加载...', 'info');

    let attempts = 0;
    const maxAttempts = 15;
    
    const tryFill = async (): Promise<boolean> => {
      const titleEl = findElement(SELECTORS.titleInput);
      const editorEl = findElement(SELECTORS.editor);

      if (titleEl && editorEl) {
        // 填充标题
        const existingTitle = titleEl instanceof HTMLInputElement || titleEl instanceof HTMLTextAreaElement
          ? titleEl.value?.trim()
          : titleEl.innerText?.trim();
        
        if (!existingTitle || existingTitle.length === 0) {
          simulateInput(titleEl, payload.title);
          logger.log('✅ 标题已填充', 'success');
        } else {
          logger.log('ℹ️ 标题已存在，跳过填充', 'info');
        }

        // 填充正文
        editorEl.click();
        editorEl.focus();
        await new Promise(r => setTimeout(r, 300));
        
        const existingContent = editorEl.innerText?.trim();
        const hasPlaceholderOnly = existingContent === '请输入正文' || existingContent === '';
        
        if (hasPlaceholderOnly) {
          // 判断内容是否为 Markdown 格式
          const isMarkdown = payload.content && (
            payload.content.includes('##') ||
            payload.content.includes('**') ||
            payload.content.includes('- ') ||
            payload.content.includes('1. ') ||
            payload.content.includes('```') ||
            payload.content.includes('> ')
          );
          
          if (isMarkdown) {
            logger.log('📝 检测到 Markdown 格式内容', 'info');
          }
          
          if (payload.htmlContent && !isMarkdown) {
            document.execCommand('insertHTML', false, payload.htmlContent);
            logger.log('✅ 内容已填充 (HTML)', 'success');
          } else {
            // 对于 Markdown 内容，尝试模拟真实的粘贴操作来触发知乎的 Markdown 检测
            if (isMarkdown) {
              logger.log('📋 使用粘贴方式填充 Markdown 内容...', 'info');
              
              // 方法1: 尝试使用 ClipboardEvent 模拟粘贴
              try {
                const clipboardData = new DataTransfer();
                clipboardData.setData('text/plain', payload.content);
                const pasteEvent = new ClipboardEvent('paste', {
                  bubbles: true,
                  cancelable: true,
                  clipboardData: clipboardData
                });
                editorEl.dispatchEvent(pasteEvent);
                logger.log('✅ 内容已通过粘贴事件填充', 'success');
              } catch (e) {
                // 如果粘贴事件失败，回退到 insertText
                logger.log('粘贴事件失败，使用 insertText 方式', 'info');
                document.execCommand('insertText', false, payload.content);
                logger.log('✅ 内容已填充 (文本)', 'success');
              }
            } else {
              document.execCommand('insertText', false, payload.content);
              logger.log('✅ 内容已填充 (文本)', 'success');
            };
            
            // 如果是 Markdown 格式，立即检测并点击"确认并解析"按钮
            // 注意：知乎会在粘贴后显示一个 Notification 提示，几秒后会自动消失
            // 所以需要立即检测并点击，不能等待！
            if (isMarkdown) {
              logger.log('⏳ 立即检测 Markdown 解析提示...', 'info');
              // 不等待，立即开始检测
              // 使用一个快速循环来检测按钮
              let found = false;
              for (let i = 0; i < 20 && !found; i++) {
                // 每 200ms 检测一次，共 4 秒
                if (i > 0) {
                  await new Promise(r => setTimeout(r, 200));
                }
                
                // 查找 Notification 中的"确认并解析"按钮
                const notifications = document.querySelectorAll('[class*="Notification"]');
                for (const notification of notifications) {
                  if (!isElementVisible(notification as HTMLElement)) continue;
                  const btns = notification.querySelectorAll('button');
                  for (const btn of btns) {
                    const text = (btn as HTMLElement).innerText?.trim();
                    if (text === '确认并解析') {
                      logger.log('🎯 找到"确认并解析"按钮，立即点击！', 'action');
                      simulateClick(btn as HTMLElement);
                      await new Promise(r => setTimeout(r, 1000));
                      logger.log('✅ Markdown 格式已解析', 'success');
                      found = true;
                      break;
                    }
                  }
                  if (found) break;
                }
                
                // 也查找 Button--link 类型的按钮
                if (!found) {
                  const linkButtons = document.querySelectorAll('button[class*="Button--link"]');
                  for (const btn of linkButtons) {
                    const text = (btn as HTMLElement).innerText?.trim();
                    if (text === '确认并解析' && isElementVisible(btn as HTMLElement)) {
                      logger.log('🎯 找到"确认并解析"按钮，立即点击！', 'action');
                      simulateClick(btn as HTMLElement);
                      await new Promise(r => setTimeout(r, 1000));
                      logger.log('✅ Markdown 格式已解析', 'success');
                      found = true;
                      break;
                    }
                  }
                }
                
                if (!found && i < 19) {
                  logger.log(`检测中... (${i + 1}/20)`, 'info');
                }
              }
              
              if (!found) {
                logger.log('⚠️ 未找到"确认并解析"按钮，尝试全选触发...', 'warn');
                await selectAllAndTriggerMarkdownParse(editorEl);
                await new Promise(r => setTimeout(r, 500));
                // 再次快速检测
                await handleMarkdownParse();
              }
            }
          }
        } else {
          logger.log('ℹ️ 编辑器已有内容，跳过填充', 'info');
        }
        
        chrome.storage.local.remove('pending_zhihu_publish');
        return true;
      }
      return false;
    };

    const interval = setInterval(async () => {
      attempts++;
      const success = await tryFill();
      
      if (success || attempts >= maxAttempts) {
        clearInterval(interval);
        if (!success) {
          logger.log('❌ 自动填充失败：未找到编辑器', 'error');
        } else {
          // 等待 Markdown 解析完成后再开始图片处理
          // 增加等待时间，确保 Markdown 解析流程完全结束
          logger.log('⏳ 3秒后开始智能图片处理...', 'info');
          setTimeout(() => runSmartImageFlow(undefined, autoPublish), 3000);
        }
      }
    }, 1000);

  } catch (error) {
    console.error('Memoraid: 知乎填充内容错误', error);
    logger.log(`❌ 填充错误: ${error}`, 'error');
  }
};

// ============================================
// 初始化
// ============================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => fillContent());
} else {
  fillContent();
}

// 导出供外部调用
(window as any).memoraidZhihuRunImageFlow = runSmartImageFlow;
(window as any).memoraidZhihuAddTopic = addTopic;
(window as any).memoraidZhihuPublish = clickPublish;
(window as any).memoraidZhihuSubmitToQuestion = submitToQuestion; // 新增：投稿至问题

// 消息监听
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'ZHIHU_INSERT_IMAGE') {
    runSmartImageFlow(message.keyword);
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'ZHIHU_ADD_TOPIC') {
    addTopic(message.topic);
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'ZHIHU_PUBLISH') {
    clickPublish();
    sendResponse({ success: true });
    return true;
  }
  
  // 新增：投稿至问题消息处理
  if (message.type === 'ZHIHU_SUBMIT_TO_QUESTION') {
    submitToQuestion();
    sendResponse({ success: true });
    return true;
  }
});

console.log(`
📘 Memoraid 知乎助手已加载

可用命令：
  memoraidZhihuRunImageFlow("关键词")  - 插入图片
  memoraidZhihuAddTopic("话题")        - 添加话题
  memoraidZhihuSubmitToQuestion()      - 投稿至问题（新增）
  memoraidZhihuPublish()               - 发布文章
`);
