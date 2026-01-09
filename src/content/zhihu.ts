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
// Logger UI
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

    const closeBtn = document.createElement('span');
    closeBtn.innerText = '✕';
    closeBtn.style.cssText = 'cursor:pointer;color:#888;font-size:16px;margin-left:8px;';
    closeBtn.onclick = () => {
      if (this.onStop) this.onStop();
      this.container.style.display = 'none';
    };

    controls.appendChild(this.stopBtn);
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

const openImageDialog = async (): Promise<boolean> => {
  logger.log('查找图片按钮...', 'info');
  
  // 先点击编辑器获得焦点
  const editor = findElement(SELECTORS.editor);
  if (editor) {
    simulateClick(editor);
    await new Promise(r => setTimeout(r, 300));
  }
  
  // 查找图片按钮
  let imageBtn = document.querySelector('button[aria-label="图片"]') as HTMLElement;
  
  if (!imageBtn) {
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      if ((btn as HTMLElement).innerText?.includes('图片') || 
          btn.getAttribute('data-tooltip')?.includes('图片')) {
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
  simulateClick(imageBtn);
  await new Promise(r => setTimeout(r, 500));
  
  return true;
};

const clickPublicLibrary = async (): Promise<boolean> => {
  logger.log('查找公共图片库按钮...', 'info');
  await new Promise(r => setTimeout(r, 500));
  
  const buttons = document.querySelectorAll('button');
  let publicBtn: HTMLElement | null = null;
  
  for (const btn of buttons) {
    if ((btn as HTMLElement).innerText?.includes('公共图片库')) {
      publicBtn = btn as HTMLElement;
      break;
    }
  }
  
  if (!publicBtn) {
    logger.log('未找到公共图片库按钮', 'warn');
    return false;
  }
  
  logger.log('点击公共图片库', 'action');
  simulateClick(publicBtn);
  await new Promise(r => setTimeout(r, 1000));
  
  return true;
};

const searchImage = async (keyword: string): Promise<boolean> => {
  logger.log(`搜索图片: ${keyword}`, 'info');
  
  let searchInput = document.querySelector('input[placeholder*="输入关键字"]') as HTMLElement;
  if (!searchInput) {
    searchInput = document.querySelector('input[placeholder*="查找图片"]') as HTMLElement;
  }
  
  if (!searchInput) {
    logger.log('未找到搜索框', 'error');
    return false;
  }
  
  simulateClick(searchInput);
  await new Promise(r => setTimeout(r, 200));
  simulateInput(searchInput, keyword);
  
  // 按回车搜索
  searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
  searchInput.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
  searchInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
  
  logger.log('等待搜索结果...', 'info');
  await new Promise(r => setTimeout(r, 2000));
  
  return true;
};

const selectImage = async (index = 0): Promise<boolean> => {
  logger.log('选择图片...', 'info');
  await new Promise(r => setTimeout(r, 500));
  
  // 查找图片列表
  let images = document.querySelectorAll('.css-128iodx, [class*="ImageSearch"] img, .Image-item img');
  
  if (images.length === 0) {
    // 备用：查找所有可点击的图片
    images = document.querySelectorAll('[role="link"] img, .ImageSearch img');
  }
  
  logger.log(`找到 ${images.length} 张图片`, 'info');
  
  if (images.length === 0) {
    logger.log('未找到可选择的图片', 'error');
    return false;
  }
  
  const targetIndex = Math.min(index, images.length - 1);
  const targetImage = images[targetIndex] as HTMLElement;
  
  logger.log(`点击第 ${targetIndex + 1} 张图片`, 'action');
  simulateClick(targetImage);
  await new Promise(r => setTimeout(r, 1000));
  
  return true;
};

const clickInsertImage = async (): Promise<boolean> => {
  logger.log('查找插入图片按钮...', 'info');
  await new Promise(r => setTimeout(r, 500));
  
  const buttons = document.querySelectorAll('button');
  let insertBtn: HTMLElement | null = null;
  
  for (const btn of buttons) {
    if ((btn as HTMLElement).innerText?.includes('插入图片')) {
      insertBtn = btn as HTMLElement;
      break;
    }
  }
  
  if (!insertBtn) {
    logger.log('未找到插入图片按钮', 'error');
    return false;
  }
  
  logger.log('点击插入图片', 'action');
  simulateClick(insertBtn);
  await new Promise(r => setTimeout(r, 1000));
  
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

// ============================================
// 主流程
// ============================================

const runSmartImageFlow = async (keyword?: string, autoPublish = false) => {
  isFlowCancelled = false;
  logger.clear();
  logger.show();
  logger.setStopCallback(() => { isFlowCancelled = true; });
  logger.log('🚀 开始知乎图片处理...', 'info');
  
  try {
    const searchKeyword = keyword || extractKeywordFromTitle() || '风景';
    
    // 1. 打开图片对话框
    if (!await openImageDialog()) return;
    if (isFlowCancelled) return;
    
    // 2. 点击公共图片库
    if (!await clickPublicLibrary()) {
      logger.log('跳过公共图片库，尝试直接搜索', 'warn');
    }
    if (isFlowCancelled) return;
    
    // 3. 搜索图片
    if (!await searchImage(searchKeyword)) return;
    if (isFlowCancelled) return;
    
    // 4. 选择图片
    if (!await selectImage(0)) return;
    if (isFlowCancelled) return;
    
    // 5. 插入图片
    if (!await clickInsertImage()) return;
    
    logger.log('✅ 图片插入完成！', 'success');
    
    // 6. 如果开启自动发布
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
          if (payload.htmlContent) {
            document.execCommand('insertHTML', false, payload.htmlContent);
            logger.log('✅ 内容已填充 (HTML)', 'success');
          } else {
            document.execCommand('insertText', false, payload.content);
            logger.log('✅ 内容已填充 (文本)', 'success');
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
          logger.log('⏳ 2秒后开始智能图片处理...', 'info');
          setTimeout(() => runSmartImageFlow(undefined, autoPublish), 2000);
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
});

console.log(`
📘 Memoraid 知乎助手已加载

可用命令：
  memoraidZhihuRunImageFlow("关键词")  - 插入图片
  memoraidZhihuAddTopic("话题")        - 添加话题
  memoraidZhihuPublish()               - 发布文章
`);
