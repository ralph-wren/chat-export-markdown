import { reportArticlePublish, reportError } from '../utils/debug';
import { DOMHelper } from '../utils/domHelper';

// WeChat Official Account Publish Content Script
// 微信公众号发布页面自动化 - 基于 Playwright 录制

interface PublishData {
  title: string;
  content: string;
  htmlContent?: string;
  sourceUrl?: string;
  sourceImages?: string[];
  timestamp: number;
}

// ============================================
// 微信公众号页面元素选择器配置
// ============================================
const SELECTORS = {
  // 标题输入框 - Playwright: getByRole('textbox', { name: '请在这里输入标题' })
  titleInput: [
    'input[placeholder*="请在这里输入标题"]',
    'textarea[placeholder*="请在这里输入标题"]',
    '#title',
    '.title-input input',
    '.title-input textarea'
  ],
  
  // 编辑器正文 - Playwright: div:has-text("从这里开始写正文")
  editor: [
    '#ueditor_0',
    '.edui-body-container',
    '[contenteditable="true"]',
    '.rich_media_content'
  ],
  
  // 图片按钮 - Playwright: locator('#js_editor_insertimage')
  imageButton: [
    '#js_editor_insertimage',
    '.edui-for-insertimage',
    '[title="图片"]'
  ],
  
  // AI 配图按钮 - Playwright: getByText('AI 配图')
  aiImageButton: [
    // 通过文本匹配
  ],
  
  // AI 配图输入框 - Playwright: getByRole('textbox', { name: '请描述你想要创作的内容' })
  // 远程调试发现: id="ai-image-prompt", class="chat_textarea"
  aiPromptInput: [
    '#ai-image-prompt',                                    // 精确ID选择器（远程调试发现）
    'textarea.chat_textarea',                              // 精确class选择器
    'textarea[placeholder*="请描述你想要创作的内容"]',
    'input[placeholder*="请描述你想要创作的内容"]',
    'textarea[placeholder*="描述"]',
    'input[placeholder*="描述"]',
    '.ai-image-input input',
    '.ai-image-input textarea'
  ],
  
  // 开始创作按钮 - Playwright: getByRole('button', { name: '开始创作' })
  startCreateButton: [
    'button:contains("开始创作")',
    '.ai-image-create-btn'
  ],
  
  // AI 生成的图片操作按钮（插入图片）
  aiImageInsertButton: [
    '.ai-image-operation-group div:nth-child(2)',
    '.ai-image-insert'
  ],
  
  // 封面添加按钮 - Playwright: locator('.icon20_common.add_cover')
  coverAddButton: [
    '.icon20_common.add_cover',
    '.add_cover',
    '[class*="add_cover"]'
  ],
  
  // 从正文选择链接 - Playwright: getByRole('link', { name: '从正文选择' })
  selectFromContentLink: [
    'a:contains("从正文选择")',
    '.js_cover_from_article'
  ],
  
  // 封面图片选择 - Playwright: locator('.icon_card_selected_global')
  coverImageSelect: [
    '.icon_card_selected_global',
    '.card_mask_global',
    '.cover-select-item'
  ],
  
  // 下一步按钮 - Playwright: getByRole('button', { name: '下一步' })
  nextStepButton: [
    'button:contains("下一步")',
    '.weui-desktop-btn_primary:contains("下一步")'
  ],
  
  // 确认按钮 - Playwright: getByRole('button', { name: '确认' })
  confirmButton: [
    'button:contains("确认")',
    '.weui-desktop-btn_primary:contains("确认")'
  ],
  
  // 原创声明 - Playwright: getByText('未声明')
  originalDeclare: [
    // 通过文本匹配 "未声明"
  ],
  
  // 原创作者输入框 - Playwright: locator('#js_original_edit_box').getByRole('textbox', { name: '请输入作者' })
  originalAuthorInput: [
    '#js_original_edit_box input[placeholder*="请输入作者"]',
    '#js_original_edit_box textarea[placeholder*="请输入作者"]'
  ],
  
  // 确定按钮（原创声明）
  originalConfirmButton: [
    '#js_original_edit_box button:contains("确定")',
    '.js_original_confirm'
  ],
  
  // 预览按钮 - Playwright: getByRole('button', { name: '预览' })
  previewButton: [
    'button:contains("预览")',
    '#js_preview'
  ],
  
  // 取消按钮 - Playwright: getByRole('button', { name: '取消' })
  cancelButton: [
    'button:contains("取消")',
    '.weui-desktop-btn_default:contains("取消")'
  ]
};

// ============================================
// DOM 工具函数 - 使用统一工具类
// ============================================

const findElement = (selectors: string[]): HTMLElement | null => DOMHelper.findElement(selectors);
const isElementVisible = (el: HTMLElement): boolean => DOMHelper.isElementVisible(el);
const simulateClick = (element: HTMLElement) => DOMHelper.simulateClick(element);
const simulateInput = (element: HTMLElement, value: string) => DOMHelper.simulateInput(element, value);

// 微信特有的辅助函数
const findElementByText = (text: string, tagNames: string[] = ['button', 'span', 'div', 'a', 'label']): HTMLElement | null => {
  for (const tag of tagNames) {
    const elements = document.querySelectorAll(tag);
    for (const el of elements) {
      const elText = (el as HTMLElement).innerText?.trim();
      if (elText === text && isElementVisible(el as HTMLElement)) {
        return el as HTMLElement;
      }
    }
  }
  return null;
};

const findVisibleElementsByTextIncludes = (
  text: string,
  scope: ParentNode = document,
  tagNames: string[] = ['button', 'span', 'div', 'a', 'label']
): HTMLElement[] => {
  const wanted = text.trim();
  if (!wanted) return [];

  const result: HTMLElement[] = [];
  for (const tag of tagNames) {
    const elements = scope.querySelectorAll(tag);
    for (const el of elements) {
      const h = el as HTMLElement;
      const elText = h.innerText?.trim();
      if (!elText) continue;
      if (!elText.includes(wanted)) continue;
      if (!isElementVisible(h)) continue;
      result.push(h);
    }
  }
  return result;
};

const pickClosestElementToRectCenter = (elements: HTMLElement[], rect: DOMRect): HTMLElement | null => {
  if (elements.length === 0) return null;
  const targetX = rect.left + rect.width / 2;
  const targetY = rect.top + rect.height / 2;

  let best: HTMLElement | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const el of elements) {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const d = (x - targetX) * (x - targetX) + (y - targetY) * (y - targetY);
    if (d < bestDist) {
      bestDist = d;
      best = el;
    }
  }
  return best;
};

const waitForElement = (selectors: string[], timeout = 10000): Promise<HTMLElement | null> => 
  DOMHelper.waitForElement(selectors, timeout);

// ============================================
// Logger UI
// ============================================
class WeixinLogger {
  private container: HTMLDivElement;
  private logContent: HTMLDivElement;
  private stopBtn: HTMLButtonElement;
  private onStop?: () => void;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'memoraid-weixin-logger';
    this.container.style.cssText = 'position:fixed;top:20px;left:20px;width:400px;max-height:500px;background:rgba(0,0,0,0.9);color:#07c160;font-family:Consolas,Monaco,monospace;font-size:12px;border-radius:8px;padding:12px;z-index:20000;display:none;flex-direction:column;box-shadow:0 4px 20px rgba(0,0,0,0.6);border:1px solid #07c160;';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #444;padding-bottom:8px;margin-bottom:8px;';
    
    const title = document.createElement('span');
    title.innerHTML = '📱 <span style="color:#fff;font-weight:bold;">Memoraid</span> 公众号助手';
    
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
    copyBtn.style.cssText = 'background:#07c160;color:white;border:none;border-radius:4px;padding:3px 8px;cursor:pointer;font-size:11px;';
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
    if (type === 'error') { reportError(message, { type, context: 'WeixinContentScript' }); }
  }
}

const logger = new WeixinLogger();

// ============================================
// 核心功能
// ============================================

let isFlowCancelled = false;

/**
 * 填充标题
 */
const fillTitle = async (title: string): Promise<boolean> => {
  logger.log('查找标题输入框...', 'info');
  
  const titleInput = await waitForElement(SELECTORS.titleInput, 5000);
  if (!titleInput) {
    logger.log('未找到标题输入框', 'error');
    return false;
  }
  
  logger.log('填充标题', 'action');
  simulateClick(titleInput);
  await new Promise(r => setTimeout(r, 200));
  simulateInput(titleInput, title);
  
  logger.log('标题已填充', 'success');
  return true;
};

/**
 * 填充正文
 * 公众号编辑器使用富文本格式（HTML）
 */
const fillContent = async (content: string, htmlContent?: string): Promise<boolean> => {
  logger.log('查找编辑器...', 'info');
  
  // 移除封面提示词（[封面: xxx]），封面提示词会单独用于生成封面
  content = removeCoverPromptFromContent(content);
  if (htmlContent) {
    htmlContent = removeCoverPromptFromContent(htmlContent);
  }
  
  // 等待编辑器加载
  await new Promise(r => setTimeout(r, 1500));
  
  // 查找编辑器 - 微信公众号使用 contenteditable 的 div
  let editor: HTMLElement | null = null;
  
  // 方法1: 查找 contenteditable 元素
  const editables = document.querySelectorAll('[contenteditable="true"]');
  for (const el of editables) {
    if (isElementVisible(el as HTMLElement)) {
      // 排除标题输入框
      const placeholder = el.getAttribute('data-placeholder') || '';
      if (!placeholder.includes('标题')) {
        editor = el as HTMLElement;
        break;
      }
    }
  }
  
  // 方法2: 通过类名查找
  if (!editor) {
    editor = findElement(SELECTORS.editor);
  }
  
  // 方法3: 在 iframe 中查找
  if (!editor) {
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc) {
          const editorInIframe = iframeDoc.querySelector('[contenteditable="true"], .edui-body-container');
          if (editorInIframe) {
            editor = editorInIframe as HTMLElement;
            break;
          }
        }
      } catch (e) { /* 跨域限制 */ }
    }
  }
  
  // 方法4: 通过占位文本查找
  if (!editor) {
    const divs = document.querySelectorAll('div');
    for (const div of divs) {
      const text = div.textContent?.trim();
      if ((text?.includes('从这里开始写正文') || text?.includes('请输入正文')) && 
          isElementVisible(div as HTMLElement)) {
        editor = div as HTMLElement;
        break;
      }
    }
  }
  
  if (!editor) {
    logger.log('未找到编辑器', 'error');
    return false;
  }
  
  logger.log('填充正文内容（富文本格式）', 'action');
  
  // 点击编辑器获取焦点
  simulateClick(editor);
  editor.focus();
  await new Promise(r => setTimeout(r, 300));
  
  // 清空现有内容
  editor.innerHTML = '';
  
  // 插入内容 - 优先使用 HTML 格式
  if (htmlContent) {
    // 处理 HTML 内容，确保格式正确
    // 公众号编辑器需要特定的 HTML 结构
    let processedHtml = htmlContent;
    
    // 将 <p> 标签转换为带样式的段落
    processedHtml = processedHtml.replace(/<p>/g, '<p style="margin-bottom: 1em;">');
    
    // 将 <h1>, <h2>, <h3> 转换为带样式的标题
    processedHtml = processedHtml.replace(/<h1>/g, '<h1 style="font-size: 24px; font-weight: bold; margin: 1em 0;">');
    processedHtml = processedHtml.replace(/<h2>/g, '<h2 style="font-size: 20px; font-weight: bold; margin: 1em 0;">');
    processedHtml = processedHtml.replace(/<h3>/g, '<h3 style="font-size: 18px; font-weight: bold; margin: 1em 0;">');
    
    // 将 <strong> 和 <b> 保持不变
    // 将 <em> 和 <i> 保持不变
    
    // 将 <ul> 和 <ol> 添加样式
    processedHtml = processedHtml.replace(/<ul>/g, '<ul style="margin: 1em 0; padding-left: 2em;">');
    processedHtml = processedHtml.replace(/<ol>/g, '<ol style="margin: 1em 0; padding-left: 2em;">');
    
    // 将 <blockquote> 添加样式
    processedHtml = processedHtml.replace(/<blockquote>/g, '<blockquote style="border-left: 4px solid #ddd; padding-left: 1em; margin: 1em 0; color: #666;">');
    
    // 将 <code> 添加样式
    processedHtml = processedHtml.replace(/<code>/g, '<code style="background: #f5f5f5; padding: 2px 4px; border-radius: 3px; font-family: monospace;">');
    
    // 将 <pre> 添加样式
    processedHtml = processedHtml.replace(/<pre>/g, '<pre style="background: #f5f5f5; padding: 1em; border-radius: 5px; overflow-x: auto; font-family: monospace;">');
    
    try {
      document.execCommand('insertHTML', false, processedHtml);
    } catch (e) {
      // 备用方法：直接设置 innerHTML
      editor.innerHTML = processedHtml;
    }
  } else {
    // 如果没有 HTML，将 Markdown 转换为简单的 HTML
    let simpleHtml = content
      // 标题
      .replace(/^### (.+)$/gm, '<h3 style="font-size: 18px; font-weight: bold; margin: 1em 0;">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 style="font-size: 20px; font-weight: bold; margin: 1em 0;">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 style="font-size: 24px; font-weight: bold; margin: 1em 0;">$1</h1>')
      // 粗体
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // 斜体
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // 无序列表
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      // 换行转段落
      .replace(/\n\n/g, '</p><p style="margin-bottom: 1em;">')
      .replace(/\n/g, '<br>');
    
    // 包装在段落中
    simpleHtml = '<p style="margin-bottom: 1em;">' + simpleHtml + '</p>';
    
    // 处理列表
    simpleHtml = simpleHtml.replace(/(<li>.*?<\/li>)+/g, '<ul style="margin: 1em 0; padding-left: 2em;">$&</ul>');
    
    try {
      document.execCommand('insertHTML', false, simpleHtml);
    } catch (e) {
      editor.innerHTML = simpleHtml;
    }
  }
  
  // 触发输入事件，确保编辑器识别内容变化
  editor.dispatchEvent(new Event('input', { bubbles: true }));
  editor.dispatchEvent(new Event('change', { bubbles: true }));
  
  logger.log('正文已填充', 'success');
  return true;
};

/**
 * 打开图片对话框
 */
const openImageDialog = async (): Promise<boolean> => {
  logger.log('查找图片按钮...', 'info');
  
  const imageBtn = findElement(SELECTORS.imageButton);
  if (!imageBtn) {
    logger.log('未找到图片按钮', 'error');
    return false;
  }
  
  logger.log('点击图片按钮', 'action');
  simulateClick(imageBtn);
  await new Promise(r => setTimeout(r, 1000));
  
  return true;
};

/**
 * 点击 AI 配图
 */
const clickAIImage = async (): Promise<boolean> => {
  logger.log('查找 AI 配图选项...', 'info');
  
  // 等待下拉菜单出现
  await new Promise(r => setTimeout(r, 500));
  
  // 方法1: 通过文本查找 "AI 配图" 或 "AI配图"
  let aiBtn = findElementByText('AI 配图', ['div', 'span', 'a', 'li', 'button']);
  if (!aiBtn) {
    aiBtn = findElementByText('AI配图', ['div', 'span', 'a', 'li', 'button']);
  }
  
  // 方法2: 在下拉菜单中查找
  if (!aiBtn) {
    const dropdownMenus = document.querySelectorAll('.weui-desktop-dropdown__list, .dropdown-menu, [class*="dropdown"], [class*="menu"]');
    for (const menu of dropdownMenus) {
      if (isElementVisible(menu as HTMLElement)) {
        const items = menu.querySelectorAll('div, span, a, li');
        for (const item of items) {
          const text = (item as HTMLElement).innerText?.trim();
          if (text === 'AI 配图' || text === 'AI配图') {
            aiBtn = item as HTMLElement;
            break;
          }
        }
        if (aiBtn) break;
      }
    }
  }
  
  // 方法3: 在图片插入区域查找
  if (!aiBtn) {
    const imagePanel = document.querySelector('#js_editor_insertimage, .edui-for-insertimage, [class*="insertimage"]');
    if (imagePanel) {
      const items = imagePanel.querySelectorAll('div, span, a');
      for (const item of items) {
        const text = (item as HTMLElement).innerText?.trim();
        if (text === 'AI 配图' || text === 'AI配图') {
          aiBtn = item as HTMLElement;
          break;
        }
      }
    }
  }
  
  // 方法4: 全局搜索包含 AI 配图的可见元素
  if (!aiBtn) {
    const allElements = document.querySelectorAll('*');
    for (const el of allElements) {
      const htmlEl = el as HTMLElement;
      // 只检查叶子节点或文本直接匹配的元素
      if (htmlEl.childElementCount === 0 || htmlEl.children.length === 0) {
        const text = htmlEl.innerText?.trim();
        if ((text === 'AI 配图' || text === 'AI配图') && isElementVisible(htmlEl)) {
          aiBtn = htmlEl;
          break;
        }
      }
    }
  }
  
  if (!aiBtn) {
    logger.log('未找到 AI 配图按钮', 'error');
    return false;
  }
  
  logger.log('点击 AI 配图选项', 'action');
  
  // 确保元素可见并滚动到视图
  aiBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
  await new Promise(r => setTimeout(r, 200));
  
  // 模拟完整的鼠标事件序列
  simulateClick(aiBtn);
  
  // 等待 AI 配图面板打开
  await new Promise(r => setTimeout(r, 1500));
  
  // 验证是否成功打开 AI 配图面板（查找输入框）
  const aiInputSelectors = [
    'input[placeholder*="描述"]',
    'textarea[placeholder*="描述"]',
    'input[placeholder*="创作"]',
    'textarea[placeholder*="创作"]',
    '.ai-image-input',
    '[class*="ai-image"] input',
    '[class*="ai-image"] textarea'
  ];
  
  let aiPanelOpened = false;
  for (const selector of aiInputSelectors) {
    const input = document.querySelector(selector);
    if (input && isElementVisible(input as HTMLElement)) {
      aiPanelOpened = true;
      break;
    }
  }
  
  if (aiPanelOpened) {
    logger.log('AI 配图面板已打开', 'success');
    return true;
  } else {
    logger.log('AI 配图面板可能未完全打开，继续尝试...', 'warn');
    return true; // 仍然返回 true，让后续流程继续
  }
};

/**
 * 生成 AI 配图
 * 输入关键词后点击"重新创作"/"开始创作"按钮，等待 AI 生成图片
 * @param prompt 图片描述关键词
 * @param setRatio 是否设置图片尺寸（正文图片也设置为 1:1 或其他尺寸）
 */
const generateAIImage = async (prompt: string, setRatio: boolean = true): Promise<boolean> => {
  logger.log(`AI 配图关键词: ${prompt}`, 'info');
  
  // 记录点击创作按钮前的 ai-image-list 数量
  const initialListCount = document.querySelectorAll('.ai-image-list').length;
  logger.log(`初始 ai-image-list 数量: ${initialListCount}`, 'info');
  
  // 查找输入框
  const promptInput = await waitForElement(SELECTORS.aiPromptInput, 5000);
  if (!promptInput) {
    // 备用方法：通过 placeholder 查找
    const inputs = document.querySelectorAll('input, textarea');
    for (const input of inputs) {
      const placeholder = input.getAttribute('placeholder') || '';
      if (placeholder.includes('描述') || placeholder.includes('创作')) {
        if (isElementVisible(input as HTMLElement)) {
          logger.log('通过 placeholder 找到输入框', 'info');
          simulateClick(input as HTMLElement);
          await new Promise(r => setTimeout(r, 200));
          simulateInput(input as HTMLElement, prompt);
          break;
        }
      }
    }
  } else {
    logger.log('输入图片关键词', 'action');
    simulateClick(promptInput);
    await new Promise(r => setTimeout(r, 200));
    simulateInput(promptInput, prompt);
  }
  
  await new Promise(r => setTimeout(r, 500));
  
  // 设置图片尺寸（正文图片设置为 1:1，保持默认即可，或者可以选择其他尺寸）
  if (setRatio) {
    logger.log('检查图片尺寸设置...', 'info');
    
    // 查找当前尺寸按钮
    let ratioBtn: HTMLElement | null = null;
    const ratioBtns = document.querySelectorAll('button, div, span');
    for (const btn of ratioBtns) {
      const text = (btn as HTMLElement).innerText?.trim();
      if ((text === '1:1' || text === '1:1 ↓' || text?.match(/^\d+:\d+/)) && isElementVisible(btn as HTMLElement)) {
        const dialog = btn.closest('.weui-desktop-dialog, [class*="dialog"], [class*="modal"]');
        if (dialog) {
          ratioBtn = btn as HTMLElement;
          break;
        }
      }
    }
    
    if (ratioBtn) {
      // 正文图片保持 1:1 即可，不需要改变
      logger.log('正文图片使用默认尺寸 1:1', 'info');
    }
  }
  
  await new Promise(r => setTimeout(r, 300));
  
  // 点击"重新创作"或"开始创作"按钮
  logger.log('查找创作按钮...', 'info');
  
  let createBtn: HTMLElement | null = null;
  
  // 方法1: 通过文本查找"重新创作"或"开始创作"
  createBtn = findElementByText('重新创作', ['button', 'div', 'span']);
  if (!createBtn) {
    createBtn = findElementByText('开始创作', ['button', 'div', 'span']);
  }
  
  // 方法2: 通过类名查找
  if (!createBtn) {
    const btns = document.querySelectorAll('button, .weui-desktop-btn_primary');
    for (const btn of btns) {
      const text = (btn as HTMLElement).innerText?.trim();
      if ((text === '重新创作' || text === '开始创作') && isElementVisible(btn as HTMLElement)) {
        createBtn = btn as HTMLElement;
        break;
      }
    }
  }
  
  if (!createBtn) {
    logger.log('未找到创作按钮', 'error');
    return false;
  }
  
  logger.log('点击创作按钮', 'action');
  simulateClick(createBtn);
  
  // 等待 AI 生成图片
  logger.log('⏳ 等待 AI 生成图片...', 'info');
  
  // 优化后的等待策略：
  // 1. 更频繁地检查（每500ms）
  // 2. 多种检测方式并行：检测图片加载完成、操作按钮出现、进度消失
  // 3. 一旦检测到任何完成信号，立即继续
  
  const maxWaitTime = 90000; // 最长等待90秒
  const startTime = Date.now();
  let generationComplete = false;
  
  // 先等待一小段时间让生成开始（减少到1.5秒）
  await new Promise(r => setTimeout(r, 1500));
  
  while (Date.now() - startTime < maxWaitTime) {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    
    // 检查1: 检测是否有正在生成的进度指示器（百分比文字如 "18%"）
    const loadingItems = Array.from(document.querySelectorAll('.ai-image-item, [class*="ai-image"]')).filter(el => {
      const text = (el as HTMLElement).innerText || '';
      // 检测是否包含百分比（如 "18%", "25%" 等，但不包括 100%）
      return /\d+%/.test(text) && !text.includes('100%');
    });
    const hasLoadingProgress = loadingItems.length > 0;
    
    // 检查2: 检测是否有加载中的动画或 loading 状态
    const hasLoadingSpinner = document.querySelector('.ai-image-item .loading, .ai-image-item [class*="loading"], .ai-image-generating, .ai-image-item .ai-image-loading');
    
    // 检查3: 检测是否有已完成的图片（有操作按钮 operation-group 且图片已加载）
    const allImageLists = document.querySelectorAll('.ai-image-list');
    let hasCompletedImages = false;
    let completedCount = 0;
    
    if (allImageLists.length > 0) {
      const lastList = allImageLists[allImageLists.length - 1];
      const items = lastList.querySelectorAll('.ai-image-item');
      
      for (const item of items) {
        const img = item.querySelector('img');
        const hasOpGroup = item.querySelector('.ai-image-operation-group');
        const itemText = (item as HTMLElement).innerText || '';
        const isNotLoading = !/\d+%/.test(itemText) || itemText.includes('100%');
        
        // 图片完成的条件：有图片且已加载，或者有操作按钮，且没有加载进度
        if (isNotLoading && (hasOpGroup || (img && img.complete && img.naturalWidth > 0))) {
          completedCount++;
        }
      }
      
      // 只要有1张图片完成就可以继续（不需要等待全部4张）
      hasCompletedImages = completedCount >= 1;
    }
    
    // 检查4: 检测"换风格"或"插入"按钮是否出现（这是图片生成完成的明确信号）
    const hasInsertButton = document.querySelector('.ai-image-operation-group') !== null;
    
    // 完成条件：没有加载中的进度 且 (有完成的图片 或 有插入按钮)
    if (!hasLoadingProgress && !hasLoadingSpinner && (hasCompletedImages || hasInsertButton)) {
      logger.log(`✅ 图片生成完成！(${completedCount} 张已完成，耗时 ${elapsed} 秒)`, 'success');
      generationComplete = true;
      break;
    }
    
    // 备用完成条件：如果已经等待超过10秒，且有插入按钮出现，直接认为完成
    if (elapsed > 10 && hasInsertButton) {
      logger.log(`✅ 检测到插入按钮，图片已生成完成 (耗时 ${elapsed} 秒)`, 'success');
      generationComplete = true;
      break;
    }
    
    // 每500ms检查一次（更频繁）
    await new Promise(r => setTimeout(r, 500));
    
    // 每5秒显示一次等待进度
    if (elapsed > 0 && elapsed % 5 === 0) {
      const progressInfo = hasLoadingProgress ? `${loadingItems.length} 张生成中` : '等待中';
      logger.log(`⏳ 已等待 ${elapsed} 秒... (${progressInfo}, ${completedCount} 张已完成)`, 'info');
    }
  }
  
  if (!generationComplete) {
    logger.log('⚠️ AI 图片生成超时，尝试继续...', 'warn');
    // 即使超时也尝试继续，可能图片已经生成了
  }
  
  // 减少额外等待时间（从2秒减少到500ms）
  await new Promise(r => setTimeout(r, 500));
  
  logger.log('AI 图片生成流程完成', 'success');
  return true;
};

/**
 * 选择并插入 AI 配图
 * AI 生成完成后，需要先悬浮在图片上让"插入"按钮显示，然后点击
 * 
 * 根据 Playwright 录制：
 * await page1.locator('div:nth-child(11) > .ai-image-list > div:nth-child(4) > .ai-image-operation-group > div:nth-child(2)').click();
 * 
 * 关键：
 * 1. 需要先悬浮在图片上，让 operation-group 显示
 * 2. 插入按钮是 .ai-image-operation-group 的第二个子 div
 * 3. 只点击一次，避免重复插入
 */
const insertAIImage = async (): Promise<boolean> => {
  logger.log('查找 AI 生成的图片...', 'info');
  
  // 等待一下确保 UI 更新
  await new Promise(r => setTimeout(r, 500));
  
  // 关键修复：首先找到当前打开的 AI 配图弹窗，然后在弹窗内查找图片
  // 而不是在整个页面中查找（页面上可能有多个历史的 ai-image-list）
  
  let activeDialog: Element | null = null;
  let imageList: Element | null = null;
  
  // 方法1：查找当前可见的 AI 配图弹窗
  const allDialogs = document.querySelectorAll('.weui-desktop-dialog');
  for (const dialog of allDialogs) {
    const style = window.getComputedStyle(dialog as HTMLElement);
    // 检查弹窗是否可见
    if (style.display !== 'none' && style.visibility !== 'hidden') {
      // 检查是否是 AI 配图弹窗（包含 ai-image-list 或 chat_textarea）
      const hasAIContent = dialog.querySelector('.ai-image-list') || dialog.querySelector('.chat_textarea');
      if (hasAIContent) {
        activeDialog = dialog;
        logger.log('找到当前打开的 AI 配图弹窗', 'info');
        break;
      }
    }
  }
  
  // 方法2：如果没找到弹窗，尝试查找 ai_image_dialog 类
  if (!activeDialog) {
    activeDialog = document.querySelector('.ai_image_dialog, .ai_image');
    if (activeDialog) {
      logger.log('通过 ai_image_dialog 类找到弹窗', 'info');
    }
  }
  
  // 在弹窗内查找图片列表
  if (activeDialog) {
    // 在弹窗内查找所有 ai-image-list，选择最后一个（新生成的图片）
    const listsInDialog = activeDialog.querySelectorAll('.ai-image-list');
    logger.log(`弹窗内找到 ${listsInDialog.length} 个 ai-image-list`, 'info');
    
    if (listsInDialog.length > 0) {
      imageList = listsInDialog[listsInDialog.length - 1];
    }
  }
  
  // 方法3：如果弹窗内没找到，尝试查找页面上最近生成的图片（有 operation-group 且可见）
  if (!imageList) {
    logger.log('在弹窗内未找到图片列表，尝试全局查找可见的图片...', 'info');
    
    // 查找所有包含可见 operation-group 的 ai-image-item
    const allItems = document.querySelectorAll('.ai-image-item');
    for (const item of allItems) {
      const opGroup = item.querySelector('.ai-image-operation-group');
      if (opGroup) {
        const style = window.getComputedStyle(opGroup as HTMLElement);
        // 检查 operation-group 是否可见（说明鼠标正悬浮在上面或刚生成）
        if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
          // 找到这个 item 所属的 list
          imageList = item.closest('.ai-image-list');
          if (imageList) {
            logger.log('通过可见的 operation-group 找到图片列表', 'info');
            break;
          }
        }
      }
    }
  }
  
  // 方法4：最后的备选方案 - 查找页面上所有 ai-image-list，选择最后一个
  if (!imageList) {
    const allImageLists = document.querySelectorAll('.ai-image-list');
    logger.log(`页面上共有 ${allImageLists.length} 个 ai-image-list`, 'info');
    
    if (allImageLists.length > 0) {
      imageList = allImageLists[allImageLists.length - 1];
      logger.log('使用页面上最后一个 ai-image-list（备选方案）', 'warn');
    }
  }
  
  if (!imageList) {
    logger.log('未找到 ai-image-list', 'error');
    return false;
  }
  
  // 查找图片列表中的图片项
  const items = imageList.querySelectorAll('.ai-image-item');
  logger.log(`图片列表中有 ${items.length} 个图片项`, 'info');
  
  if (items.length === 0) {
    logger.log('未找到图片项', 'error');
    return false;
  }
  
  // 优先选择已经有 operation-group 的图片项（说明已经生成完成）
  let targetItem: HTMLElement | null = null;
  
  for (const item of items) {
    const opGroup = item.querySelector('.ai-image-operation-group');
    const itemText = (item as HTMLElement).innerText || '';
    const isNotLoading = !/\d+%/.test(itemText) || itemText.includes('100%');
    
    if (opGroup && isNotLoading) {
      targetItem = item as HTMLElement;
      logger.log('找到已完成的图片项（有 operation-group）', 'info');
      break;
    }
  }
  
  // 如果没找到有 operation-group 的，选择第一个
  if (!targetItem) {
    targetItem = items[0] as HTMLElement;
    logger.log('选择第一个图片项', 'info');
  }
  
  // 关键步骤：模拟鼠标悬浮在图片上，让"插入"按钮显示出来
  logger.log('悬浮在图片上显示操作按钮...', 'action');
  
  // 滚动到图片位置
  targetItem.scrollIntoView({ behavior: 'instant', block: 'center' });
  await new Promise(r => setTimeout(r, 300));
  
  // 模拟鼠标悬浮事件（多次触发确保生效）
  const triggerHover = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const hoverOptions = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2
    };
    
    element.dispatchEvent(new MouseEvent('mouseenter', hoverOptions));
    element.dispatchEvent(new MouseEvent('mouseover', hoverOptions));
    element.dispatchEvent(new MouseEvent('mousemove', hoverOptions));
  };
  
  // 多次触发悬浮事件
  for (let i = 0; i < 3; i++) {
    triggerHover(targetItem);
    await new Promise(r => setTimeout(r, 200));
  }
  
  // 等待操作按钮显示
  await new Promise(r => setTimeout(r, 500));
  
  // 现在查找插入按钮
  let insertBtn: HTMLElement | null = null;
  
  // 方法1：在当前图片项中查找 operation-group 的第二个子元素
  let operationGroup = targetItem.querySelector('.ai-image-operation-group');
  if (operationGroup) {
    logger.log('找到 operation-group', 'info');
    const secondChild = operationGroup.children[1] as HTMLElement;
    if (secondChild) {
      insertBtn = secondChild;
      logger.log('找到插入按钮（operation-group 第二个子元素）', 'success');
    }
  }
  
  // 方法2：通过文本"插入/使用"查找
  if (!insertBtn) {
    const btns = targetItem.querySelectorAll('div, span, button');
    for (const btn of btns) {
      const text = (btn as HTMLElement).innerText?.trim();
      if (text === '插入' || text === '使用') {
        insertBtn = btn as HTMLElement;
        logger.log('通过文本找到按钮', 'success');
        break;
      }
    }
  }
  
  // 方法3：如果还没找到，尝试悬浮在其他图片上
  if (!insertBtn) {
    logger.log('尝试悬浮在其他图片上...', 'info');
    
    // 只尝试前4个图片（新生成的通常是前4个）
    const maxTry = Math.min(items.length, 4);
    for (let i = 0; i < maxTry; i++) {
      const item = items[i] as HTMLElement;
      
      // 悬浮
      triggerHover(item);
      await new Promise(r => setTimeout(r, 300));
      
      // 查找插入按钮
      operationGroup = item.querySelector('.ai-image-operation-group');
      if (operationGroup) {
        const btn = operationGroup.children[1] as HTMLElement;
        if (btn) {
          insertBtn = btn;
          logger.log(`在第 ${i + 1} 张图片上找到插入按钮`, 'success');
          break;
        }
        
        // 通过文本查找
        const textBtns = operationGroup.querySelectorAll('div, span, button');
        for (const textBtn of textBtns) {
          const t = (textBtn as HTMLElement).innerText?.trim();
          if (t === '插入' || t === '使用') {
            insertBtn = textBtn as HTMLElement;
            logger.log(`在第 ${i + 1} 张图片上通过文本找到插入按钮`, 'success');
            break;
          }
        }
      }
      
      if (insertBtn) break;
    }
  }
  
  // 方法4：在整个弹窗或图片列表中查找任何可见的"插入"按钮
  if (!insertBtn) {
    logger.log('在弹窗中查找任何可见的插入按钮...', 'info');
    
    const searchArea = activeDialog || imageList;
    if (searchArea) {
      const allBtns = searchArea.querySelectorAll('.ai-image-operation-group div, .ai-image-operation-group button, .ai-image-operation-group span, [class*="operation"] div, [class*="operation"] button, [class*="operation"] span');
      for (const btn of allBtns) {
        const text = (btn as HTMLElement).innerText?.trim();
        if (text === '插入' || text === '使用') {
          // 检查按钮是否可见
          const btnRect = (btn as HTMLElement).getBoundingClientRect();
          if (btnRect.width > 0 && btnRect.height > 0) {
            insertBtn = btn as HTMLElement;
            logger.log('在弹窗中找到可见的插入按钮', 'success');
            break;
          }
        }
      }
    }
  }
  
  if (!insertBtn) {
    logger.log('未找到插入按钮', 'error');
    return false;
  }
  
  logger.log('点击插入图片', 'action');
  
  // 确保按钮可见
  insertBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
  await new Promise(r => setTimeout(r, 200));
  
  // 修复2：防止重复插入 - 标记按钮已点击
  const alreadyClicked = insertBtn.getAttribute('data-memoraid-clicked');
  if (alreadyClicked === 'true') {
    logger.log('⚠️ 此插入按钮已被点击过，跳过以防止重复插入', 'warn');
    return true;
  }
  
  // 标记按钮为已点击
  insertBtn.setAttribute('data-memoraid-clicked', 'true');
  
  // 点击插入按钮
  // 修复：使用原生 click 避免重复触发事件导致插入两次
  insertBtn.click();
  
  // 等待图片插入完成
  await new Promise(r => setTimeout(r, 1000));
  
  logger.log('AI 图片已插入', 'success');
  return true;
};

/**
 * 使用 AI 生成封面图片
 * 关键：必须在封面区域悬浮后点击"AI 配图"按钮，这样生成的图片才会设置为封面
 * 而不是使用正文的图片插入方式
 * @param title 文章标题
 * @param content 文章内容（包含封面提示词）
 * 
 * 根据 Playwright 录制，封面 AI 配图的正确流程：
 * 1. 悬浮在封面区域，触发菜单显示
 * 2. 点击 getByRole('link', { name: 'AI 配图' }) - 封面区域的 AI 配图链接
 * 3. 输入提示词，设置 16:9 尺寸，点击"开始创作"
 * 4. 生成完成后，悬浮图片，点击 operation-group 的第二个子元素（使用按钮）
 * 5. 点击"确认"按钮完成封面设置
 * 
 * 注意：封面的 AI 配图链接和正文的不同！
 * - 封面：getByRole('link', { name: 'AI 配图' }) - 在封面悬浮菜单中
 * - 正文：locator('#js_editor_insertimage').getByText('AI 配图') - 在图片按钮下拉菜单中
 * 
 * 注意：目前此函数未被使用，改为使用 setCoverFromContent 从正文选择封面，更稳定
 */
// @ts-ignore - 保留此函数以备将来使用
const setCoverWithAI = async (title?: string, content?: string): Promise<boolean> => {
  logger.log('🎨 使用 AI 生成封面图片...', 'info');
  
  // 获取文章标题和内容
  const articleTitle = title || getArticleTitle();
  const articleContent = content || getArticleContent();
  
  if (!articleTitle) {
    logger.log('未找到文章标题，无法生成封面', 'warn');
    return false;
  }
  
  // 从内容中提取封面提示词（[封面: xxx] 格式）
  const coverPromptData = extractCoverPrompt(articleContent);
  let coverPrompt: string;
  
  if (coverPromptData) {
    // 使用 AI 生成的封面提示词
    coverPrompt = coverPromptData.prompt;
    logger.log(`使用文章中的封面提示词: ${coverPrompt.substring(0, 50)}...`, 'info');
  } else {
    // 如果没有封面提示词，使用自动生成的
    coverPrompt = generateImagePrompt(articleTitle, articleContent, undefined, true);
    logger.log(`自动生成封面提示词: ${coverPrompt.substring(0, 50)}...`, 'info');
  }
  
  // 滚动到页面底部，确保封面区域可见
  window.scrollTo(0, document.body.scrollHeight);
  await new Promise(r => setTimeout(r, 500));
  
  // 步骤1: 查找封面区域 - 关键是找到"拖拽或选择封面"文字元素
  // 悬浮在这个文字上才会显示 AI 配图菜单
  logger.log('查找封面区域...', 'info');
  
  let coverTextElement: HTMLElement | null = null;
  let coverArea: HTMLElement | null = null;
  
  // 方法1: 直接查找"拖拽或选择封面"文字元素（这是触发悬浮菜单的关键）
  const allElements = document.querySelectorAll('div, span, p');
  for (const el of allElements) {
    const text = (el as HTMLElement).innerText?.trim();
    // 精确匹配"拖拽或选择封面"文字
    if (text === '拖拽或选择封面') {
      coverTextElement = el as HTMLElement;
      logger.log('找到封面文字元素: 拖拽或选择封面', 'info');
      break;
    }
  }
  
  // 方法2: 使用精确的类名选择器
  if (!coverTextElement) {
    coverArea = document.querySelector('.select-cover__btn.js_cover_btn_area.select-cover__mask') as HTMLElement;
    if (coverArea) {
      logger.log('找到封面区域: select-cover__btn', 'info');
    }
  }
  
  // 方法3: 查找封面添加按钮区域
  if (!coverTextElement && !coverArea) {
    coverArea = findElement(SELECTORS.coverAddButton);
  }
  
  // 确定要悬浮的目标元素
  const hoverTarget = coverTextElement || coverArea;
  
  if (!hoverTarget) {
    logger.log('未找到封面区域', 'error');
    return false;
  }
  
  // 滚动到封面区域
  hoverTarget.scrollIntoView({ behavior: 'instant', block: 'center' });
  await new Promise(r => setTimeout(r, 500));
  
  // 步骤2: 关键！必须悬浮在"拖拽或选择封面"文字上，触发封面专用的弹出菜单
  logger.log('悬浮在封面文字上显示菜单...', 'action');
  
  const rect = hoverTarget.getBoundingClientRect();
  logger.log(`悬浮目标: ${(hoverTarget as HTMLElement).innerText?.substring(0, 20) || hoverTarget.className}`, 'info');
  
  const hoverOptions = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2
  };
  
  // 多次触发悬浮事件，确保弹出菜单显示
  for (let i = 0; i < 5; i++) {
    hoverTarget.dispatchEvent(new MouseEvent('mouseenter', hoverOptions));
    hoverTarget.dispatchEvent(new MouseEvent('mouseover', hoverOptions));
    hoverTarget.dispatchEvent(new MouseEvent('mousemove', hoverOptions));
    await new Promise(r => setTimeout(r, 200));
  }
  
  // 等待弹出菜单出现
  await new Promise(r => setTimeout(r, 1000));
  
  // 步骤3: 查找并点击封面区域的 "AI 配图" 链接
  // 关键：封面的 AI 配图链接在 pop-opr__group 弹出菜单中，选择器是 a.js_aiImage
  logger.log('查找封面 AI 配图链接...', 'info');
  
  let aiCoverBtn: HTMLElement | null = null;
  
  // 方法1: 使用精确的选择器 a.js_aiImage（封面专用）
  aiCoverBtn = document.querySelector('a.js_aiImage, a.pop-opr__button.js_aiImage') as HTMLElement;
  if (aiCoverBtn && isElementVisible(aiCoverBtn)) {
    logger.log('通过 a.js_aiImage 找到封面 AI 配图链接', 'success');
  } else {
    aiCoverBtn = null;
  }
  
  // 方法2: 在 pop-opr__group 弹出菜单中查找
  if (!aiCoverBtn) {
    const popOprGroup = document.querySelector('.pop-opr__group, #js_cover_null, .pop-opr__group-select-cover') as HTMLElement;
    if (popOprGroup && isElementVisible(popOprGroup)) {
      logger.log('找到封面弹出菜单 pop-opr__group', 'info');
      const links = popOprGroup.querySelectorAll('a, li');
      for (const link of links) {
        const text = (link as HTMLElement).innerText?.trim();
        if (text === 'AI 配图' || text === 'AI配图') {
          aiCoverBtn = link as HTMLElement;
          logger.log('在 pop-opr__group 中找到 AI 配图链接', 'success');
          break;
        }
      }
    }
  }
  
  // 方法3: 如果弹出菜单没显示，点击封面文字元素触发
  if (!aiCoverBtn) {
    logger.log('点击封面文字触发弹出菜单...', 'info');
    
    // 点击封面文字元素（优先）或封面区域
    const clickTarget = coverTextElement || hoverTarget;
    simulateClick(clickTarget);
    await new Promise(r => setTimeout(r, 1000));
    
    // 再次查找 a.js_aiImage
    aiCoverBtn = document.querySelector('a.js_aiImage, a.pop-opr__button.js_aiImage') as HTMLElement;
    if (aiCoverBtn && isElementVisible(aiCoverBtn)) {
      logger.log('点击后通过 a.js_aiImage 找到封面 AI 配图链接', 'success');
    } else {
      aiCoverBtn = null;
      
      // 在 pop-opr__group 中查找
      const popOprGroup = document.querySelector('.pop-opr__group, #js_cover_null') as HTMLElement;
      if (popOprGroup) {
        const links = popOprGroup.querySelectorAll('a, li');
        for (const link of links) {
          const text = (link as HTMLElement).innerText?.trim();
          if (text === 'AI 配图' || text === 'AI配图') {
            aiCoverBtn = link as HTMLElement;
            logger.log('点击后在 pop-opr__group 中找到 AI 配图链接', 'success');
            break;
          }
        }
      }
    }
  }
  
  // 方法4: 全局查找封面 AI 配图链接（排除正文区域）
  if (!aiCoverBtn) {
    logger.log('全局查找封面 AI 配图链接（排除正文区域）...', 'info');
    
    // 查找所有包含 "AI 配图" 的链接
    const allLinks = document.querySelectorAll('a');
    for (const link of allLinks) {
      const text = (link as HTMLElement).innerText?.trim();
      if ((text === 'AI 配图' || text === 'AI配图') && isElementVisible(link as HTMLElement)) {
        // 排除正文图片按钮区域的 AI 配图（在 tpl_dropdown_menu 中）
        const isInEditorDropdown = link.closest('.tpl_dropdown_menu, #js_editor_insertimage, .edui-for-insertimage');
        if (!isInEditorDropdown) {
          aiCoverBtn = link as HTMLElement;
          logger.log('全局找到封面 AI 配图链接（已排除正文区域）', 'success');
          break;
        }
      }
    }
  }
  
  if (!aiCoverBtn) {
    logger.log('未找到封面 AI 配图按钮，尝试从正文选择', 'warn');
    return await setCoverFromContent();
  }
  
  // 点击封面区域的 AI 配图按钮
  logger.log('点击封面 AI 配图按钮', 'action');
  simulateClick(aiCoverBtn);
  
  // 关键：等待 AI 配图弹窗完全加载（封面弹窗可能需要更长时间）
  logger.log('等待 AI 配图弹窗加载...', 'info');
  await new Promise(r => setTimeout(r, 3000));
  
  // 步骤5: 输入封面提示词（使用前面提取或生成的 coverPrompt）
  logger.log(`封面提示词: ${coverPrompt.substring(0, 60)}...`, 'info');
  
  // 打印当前页面上的弹窗信息，便于调试
  const debugDialogs = () => {
    const allDialogs = document.querySelectorAll('.weui-desktop-dialog');
    logger.log(`当前页面有 ${allDialogs.length} 个 weui-desktop-dialog`, 'info');
    for (let i = 0; i < allDialogs.length; i++) {
      const dialog = allDialogs[i] as HTMLElement;
      const visible = isElementVisible(dialog);
      const style = window.getComputedStyle(dialog);
      const hasAIList = !!dialog.querySelector('.ai-image-list');
      const hasTextarea = !!dialog.querySelector('textarea');
      const hasChatTextarea = !!dialog.querySelector('.chat_textarea');
      logger.log(`弹窗 ${i + 1}: visible=${visible}, display=${style.display}, hasAIList=${hasAIList}, hasTextarea=${hasTextarea}, hasChatTextarea=${hasChatTextarea}`, 'info');
    }
  };
  
  // 关键修复：不依赖弹窗的可见性，而是直接查找包含 AI 配图特征的弹窗
  // 因为弹窗可能使用了动画或特殊的显示方式，导致 isElementVisible 返回 false
  const findAIDialogAndInput = (): { dialog: HTMLElement | null; input: HTMLElement | null } => {
    // 查找所有弹窗
    const allDialogs = document.querySelectorAll('.weui-desktop-dialog');
    
    for (const dialog of allDialogs) {
      // 关键：不检查弹窗的可见性，而是检查弹窗内是否有 AI 配图的特征元素
      const hasChatTextarea = dialog.querySelector('.chat_textarea');
      const hasAIImageList = dialog.querySelector('.ai-image-list');
      
      // 如果弹窗包含 chat_textarea 或 ai-image-list，说明是 AI 配图弹窗
      if (hasChatTextarea || hasAIImageList) {
        // 在这个弹窗内查找输入框
        const inputSelectors = [
          '#ai-image-prompt',
          'textarea.chat_textarea',
          '.chat_textarea',
          'textarea[placeholder*="描述"]',
          'textarea[placeholder*="创作"]'
        ];
        
        for (const selector of inputSelectors) {
          const input = dialog.querySelector(selector) as HTMLElement;
          if (input) {
            // 检查输入框本身是否可交互（不检查弹窗的可见性）
            const inputStyle = window.getComputedStyle(input);
            if (inputStyle.display !== 'none') {
              logger.log(`在弹窗中找到 AI 配图输入框: ${selector}`, 'info');
              return { dialog: dialog as HTMLElement, input };
            }
          }
        }
        
        // 如果没找到特定输入框，查找任何 textarea
        const textarea = dialog.querySelector('textarea') as HTMLElement;
        if (textarea) {
          const textareaStyle = window.getComputedStyle(textarea);
          if (textareaStyle.display !== 'none') {
            logger.log('在弹窗中找到 textarea', 'info');
            return { dialog: dialog as HTMLElement, input: textarea };
          }
        }
      }
    }
    
    return { dialog: null, input: null };
  };
  
  // 第一次尝试查找
  let { dialog: aiDialog, input: promptInput } = findAIDialogAndInput();
  
  // 如果没找到，等待一下再试
  if (!promptInput) {
    logger.log('等待 AI 配图弹窗和输入框...', 'info');
    await new Promise(r => setTimeout(r, 2000));
    
    // 打印调试信息
    debugDialogs();
    
    // 再次尝试
    const result = findAIDialogAndInput();
    aiDialog = result.dialog;
    promptInput = result.input;
  }
  
  // 如果还没找到，再等待一次
  if (!promptInput) {
    logger.log('继续等待弹窗加载...', 'info');
    await new Promise(r => setTimeout(r, 2000));
    
    const result = findAIDialogAndInput();
    aiDialog = result.dialog;
    promptInput = result.input;
  }
  
  if (promptInput && aiDialog) {
    logger.log('✅ 找到 AI 配图弹窗和输入框', 'success');
    
    // 尝试让弹窗可见（如果它被隐藏了）
    const dialogStyle = window.getComputedStyle(aiDialog);
    if (dialogStyle.display === 'none') {
      logger.log('弹窗被隐藏，尝试显示...', 'info');
      aiDialog.style.display = 'block';
    }
    
    // 滚动到输入框并聚焦
    promptInput.scrollIntoView({ behavior: 'instant', block: 'center' });
    await new Promise(r => setTimeout(r, 200));
    
    simulateClick(promptInput);
    await new Promise(r => setTimeout(r, 200));
    simulateInput(promptInput, coverPrompt);
    logger.log('已输入封面提示词', 'success');
  } else {
    logger.log('❌ 未找到 AI 配图弹窗或输入框', 'error');
    // 打印更多调试信息
    debugDialogs();
    
    // 尝试全局查找任何可见的 textarea（最后的尝试）
    const allTextareas = document.querySelectorAll('textarea');
    logger.log(`页面上共有 ${allTextareas.length} 个 textarea`, 'info');
    for (let i = 0; i < Math.min(allTextareas.length, 5); i++) {
      const ta = allTextareas[i] as HTMLElement;
      const visible = isElementVisible(ta);
      const placeholder = ta.getAttribute('placeholder') || '';
      const className = ta.className;
      logger.log(`textarea ${i + 1}: visible=${visible}, placeholder="${placeholder.substring(0, 30)}", class="${className}"`, 'info');
    }
    
    logger.log('尝试从正文选择封面...', 'info');
    return await setCoverFromContent();
  }
  
  await new Promise(r => setTimeout(r, 500));
  
  // 步骤6: 关键！先设置图片尺寸为 16:9
  // 根据 Playwright 录制: 先点击 ':1' 展开尺寸选择，再点击 '.ratio_item_shape.ratio-16-9'
  logger.log('设置图片尺寸为 16:9...', 'action');
  
  // 查找当前尺寸按钮（显示 "1:1" 的按钮）
  let ratioBtn: HTMLElement | null = null;
  
  // 方法1: 查找包含 "1:1" 或 ":1" 文本的按钮
  const ratioBtns = document.querySelectorAll('button, div, span');
  for (const btn of ratioBtns) {
    const text = (btn as HTMLElement).innerText?.trim();
    if ((text === '1:1' || text === '1:1 ↓' || text?.includes(':1')) && isElementVisible(btn as HTMLElement)) {
      // 确保是在 AI 配图弹窗内
      const dialog = btn.closest('.weui-desktop-dialog, [class*="dialog"], [class*="modal"]');
      if (dialog) {
        ratioBtn = btn as HTMLElement;
        logger.log('找到尺寸选择按钮', 'info');
        break;
      }
    }
  }
  
  // 方法2: 查找 ratio 相关的元素
  if (!ratioBtn) {
    ratioBtn = document.querySelector('[class*="ratio"] button, [class*="ratio"] div') as HTMLElement;
  }
  
  if (ratioBtn) {
    // 点击展开尺寸选择
    simulateClick(ratioBtn);
    await new Promise(r => setTimeout(r, 500));
    
    // 查找并点击 16:9 选项
    let ratio16_9: HTMLElement | null = null;
    
    // 方法1: 使用精确的类名
    ratio16_9 = document.querySelector('.ratio_item_shape.ratio-16-9') as HTMLElement;
    
    // 方法2: 查找包含 "16:9" 文本的元素
    if (!ratio16_9) {
      const ratioItems = document.querySelectorAll('[class*="ratio"], div, span');
      for (const item of ratioItems) {
        const text = (item as HTMLElement).innerText?.trim();
        if (text === '16:9' && isElementVisible(item as HTMLElement)) {
          ratio16_9 = item as HTMLElement;
          break;
        }
      }
    }
    
    // 方法3: 查找 ratio-16-9 类
    if (!ratio16_9) {
      ratio16_9 = document.querySelector('[class*="16-9"], [class*="16_9"]') as HTMLElement;
    }
    
    if (ratio16_9) {
      logger.log('点击 16:9 尺寸', 'action');
      simulateClick(ratio16_9);
      await new Promise(r => setTimeout(r, 500));
      logger.log('已设置尺寸为 16:9', 'success');
    } else {
      logger.log('未找到 16:9 选项，使用默认尺寸', 'warn');
    }
  } else {
    logger.log('未找到尺寸选择按钮，使用默认尺寸', 'warn');
  }
  
  await new Promise(r => setTimeout(r, 300));
  
  // 步骤7: 点击"重新创作"或"开始创作"按钮
  // 关键：需要在当前可见的 AI 配图弹窗中查找，而不是全局查找
  // 注意：按钮可能在弹窗底部，需要先滚动到可见位置
  let createBtn: HTMLElement | null = null;
  
  // 先尝试滚动弹窗内容到底部，确保创作按钮可见
  const aiDialogBody = document.querySelector('.ai_image_dialog .weui-desktop-dialog__bd, .ai_image .weui-desktop-dialog__bd');
  if (aiDialogBody) {
    aiDialogBody.scrollTop = aiDialogBody.scrollHeight;
    await new Promise(r => setTimeout(r, 300));
  }
  
  // 方法1: 在 .ft_chat_area 或 .chat_combine 中查找（封面 AI 配图弹窗的底部区域）
  const chatAreas = document.querySelectorAll('.ft_chat_area, .chat_combine');
  for (const area of chatAreas) {
    // 不检查 area 的可见性，直接查找内部按钮
    const btn = area.querySelector('button.weui-desktop-btn_primary') as HTMLElement;
    if (btn) {
      // 滚动按钮到可见位置
      btn.scrollIntoView({ behavior: 'instant', block: 'center' });
      await new Promise(r => setTimeout(r, 200));
      
      // 再次检查可见性
      if (isElementVisible(btn)) {
        createBtn = btn;
        logger.log(`在 ${(area as HTMLElement).className} 中找到创作按钮: ${btn.innerText}`, 'info');
        break;
      }
    }
  }
  
  // 方法2: 在可见的 AI 配图弹窗中查找
  if (!createBtn) {
    const aiDialogs = document.querySelectorAll('.ai_image_dialog, .ai_image');
    for (const dialog of aiDialogs) {
      // 查找主要按钮（不检查 disabled 状态，因为输入提示词后应该是可用的）
      const btns = dialog.querySelectorAll('button.weui-desktop-btn_primary');
      for (const btn of btns) {
        const text = (btn as HTMLElement).innerText?.trim();
        if (text === '重新创作' || text === '开始创作') {
          // 滚动到按钮位置
          (btn as HTMLElement).scrollIntoView({ behavior: 'instant', block: 'center' });
          await new Promise(r => setTimeout(r, 200));
          
          createBtn = btn as HTMLElement;
          logger.log(`在 AI 配图弹窗中找到创作按钮: ${text}`, 'info');
          break;
        }
      }
      if (createBtn) break;
    }
  }
  
  // 方法3: 全局查找（兜底）- 先滚动再检查
  if (!createBtn) {
    const allPrimaryBtns = document.querySelectorAll('button.weui-desktop-btn_primary');
    for (const btn of allPrimaryBtns) {
      const text = (btn as HTMLElement).innerText?.trim();
      if (text === '重新创作' || text === '开始创作') {
        // 滚动到按钮位置
        (btn as HTMLElement).scrollIntoView({ behavior: 'instant', block: 'center' });
        await new Promise(r => setTimeout(r, 200));
        
        createBtn = btn as HTMLElement;
        logger.log(`全局找到创作按钮: ${text}`, 'info');
        break;
      }
    }
  }
  
  // 方法4: 使用 findElementByText（会检查可见性）
  if (!createBtn) {
    createBtn = findElementByText('重新创作', ['button', 'div', 'span']);
  }
  if (!createBtn) {
    createBtn = findElementByText('开始创作', ['button', 'div', 'span']);
  }
  
  if (!createBtn) {
    logger.log('未找到创作按钮', 'error');
    // 打印调试信息
    const allBtns = document.querySelectorAll('button.weui-desktop-btn_primary');
    logger.log(`页面上共有 ${allBtns.length} 个主要按钮`, 'info');
    for (let i = 0; i < Math.min(allBtns.length, 5); i++) {
      const btn = allBtns[i] as HTMLElement;
      const rect = btn.getBoundingClientRect();
      logger.log(`按钮 ${i + 1}: "${btn.innerText}", visible=${isElementVisible(btn)}, rect=(${Math.round(rect.top)},${Math.round(rect.left)},${Math.round(rect.width)}x${Math.round(rect.height)})`, 'info');
    }
    return false;
  }
  
  logger.log('点击创作封面', 'action');
  simulateClick(createBtn);
  
  // 步骤8: 等待生成完成
  logger.log('⏳ 等待封面生成（约30-60秒）...', 'info');
  await new Promise(r => setTimeout(r, 3000));
  
  const maxWaitTime = 90000;
  const startTime = Date.now();
  let generationComplete = false;
  
  while (Date.now() - startTime < maxWaitTime) {
    // 检查是否还有加载中的进度
    const hasLoadingProgress = Array.from(document.querySelectorAll('.ai-image-item, [class*="ai-image"]')).some(el => {
      const text = (el as HTMLElement).innerText || '';
      return /\d+%/.test(text) && !text.includes('100%');
    });
    
    if (!hasLoadingProgress) {
      // 检查是否有生成完成的图片
      const allLists = document.querySelectorAll('.ai-image-list');
      if (allLists.length > 0) {
        const lastList = allLists[allLists.length - 1];
        const items = lastList.querySelectorAll('.ai-image-item');
        if (items.length > 0) {
          const img = items[0].querySelector('img');
          if (img && img.complete && img.naturalWidth > 0) {
            logger.log('封面图片生成完成', 'success');
            generationComplete = true;
            break;
          }
        }
      }
    }
    
    await new Promise(r => setTimeout(r, 2000));
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    if (elapsed % 10 === 0) {
      logger.log(`⏳ 已等待 ${elapsed} 秒...`, 'info');
    }
  }
  
  if (!generationComplete) {
    logger.log('封面生成超时，尝试继续...', 'warn');
  }
  
  await new Promise(r => setTimeout(r, 2000));
  
  // 关键：在封面 AI 配图弹窗中，需要点击 operation-group 的第二个子元素
  // 根据 Playwright 录制：
  // await page.locator('div:nth-child(11) > .ai-image-list > div:nth-child(4) > .ai-image-operation-group > div:nth-child(2)').click();
  // await page.getByRole('button', { name: '确认' }).click();
  logger.log('选择封面图片...', 'action');
  
  const allLists = document.querySelectorAll('.ai-image-list');
  if (allLists.length > 0) {
    const lastList = allLists[allLists.length - 1];
    const items = lastList.querySelectorAll('.ai-image-item');
    
    if (items.length > 0) {
      const targetItem = items[0] as HTMLElement;
      
      // 悬浮显示操作按钮
      targetItem.scrollIntoView({ behavior: 'instant', block: 'center' });
      await new Promise(r => setTimeout(r, 300));
      
      const itemRect = targetItem.getBoundingClientRect();
      targetItem.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, clientX: itemRect.left + itemRect.width / 2, clientY: itemRect.top + itemRect.height / 2 }));
      targetItem.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      await new Promise(r => setTimeout(r, 800));
      
      // 根据 Playwright 录制，直接点击 operation-group 的第二个子元素
      // 这是封面 AI 配图弹窗中的"使用"按钮位置
      let useBtn: HTMLElement | null = null;
      
      const opGroup = targetItem.querySelector('.ai-image-operation-group');
      if (opGroup) {
        const children = opGroup.children;
        logger.log(`operation-group 有 ${children.length} 个子元素`, 'info');
        
        // 打印所有按钮的文字，便于调试
        for (let i = 0; i < children.length; i++) {
          const btn = children[i] as HTMLElement;
          const text = btn.innerText?.trim();
          logger.log(`按钮 ${i + 1}: "${text}"`, 'info');
        }
        
        // 根据 Playwright 录制，点击第二个子元素（div:nth-child(2)）
        const secondBtn = children[1] as HTMLElement;
        if (secondBtn) {
          const text = secondBtn.innerText?.trim();
          // 注意：封面 AI 配图弹窗和正文 AI 配图弹窗可能使用相同的按钮文字"插入"
          // 所以不再把"插入"按钮当作错误的弹窗标志，直接使用它
          useBtn = secondBtn;
          logger.log(`使用第二个按钮: "${text}"`, 'info');
        }
      }
      
      // 如果没找到 operation-group，尝试其他方法
      if (!useBtn) {
        // 尝试在图片项中查找任何可点击的按钮
        const btns = targetItem.querySelectorAll('div, span, button');
        for (const btn of btns) {
          const text = (btn as HTMLElement).innerText?.trim();
          // 封面弹窗可能显示"使用"、"选择"、"设为封面"或"插入"
          if (text === '使用' || text === '选择' || text === '设为封面' || text === '插入') {
            useBtn = btn as HTMLElement;
            logger.log(`通过文字找到按钮: "${text}"`, 'success');
            break;
          }
        }
      }
      
      if (useBtn) {
        logger.log('点击选择按钮', 'action');
        simulateClick(useBtn);
        await new Promise(r => setTimeout(r, 1500));
        
        // 关键：点击后需要点击"确认"按钮才能真正设置封面
        // 根据 Playwright 录制: await page.getByRole('button', { name: '确认' }).click();
        logger.log('查找确认按钮...', 'info');
        
        // 等待确认按钮出现
        await new Promise(r => setTimeout(r, 500));
        
        let confirmBtn: HTMLElement | null = null;
        
        // 方法1: 查找所有可见的"确认"按钮
        const allButtons = document.querySelectorAll('button');
        for (const btn of allButtons) {
          const text = (btn as HTMLElement).innerText?.trim();
          if (text === '确认' && isElementVisible(btn as HTMLElement)) {
            confirmBtn = btn as HTMLElement;
            logger.log('找到确认按钮', 'success');
            break;
          }
        }
        
        // 方法2: 在弹窗中查找
        if (!confirmBtn) {
          const dialogs = document.querySelectorAll('.weui-desktop-dialog, [class*="dialog"], [class*="modal"]');
          for (const dialog of dialogs) {
            if (isElementVisible(dialog as HTMLElement)) {
              const btns = dialog.querySelectorAll('button');
              for (const btn of btns) {
                const text = (btn as HTMLElement).innerText?.trim();
                if (text === '确认') {
                  confirmBtn = btn as HTMLElement;
                  logger.log('在弹窗中找到确认按钮', 'success');
                  break;
                }
              }
              if (confirmBtn) break;
            }
          }
        }
        
        // 方法3: 使用 findElementByText
        if (!confirmBtn) {
          confirmBtn = findElementByText('确认', ['button']);
        }
        
        if (confirmBtn) {
          logger.log('点击确认按钮', 'action');
          simulateClick(confirmBtn);
          await new Promise(r => setTimeout(r, 1000));
          logger.log('✅ AI 封面设置完成', 'success');
        } else {
          logger.log('未找到确认按钮，封面可能已设置或需要手动确认', 'warn');
        }
        
        return true;
      } else {
        // 如果实在找不到按钮，尝试直接点击图片
        logger.log('未找到操作按钮，尝试直接点击图片', 'warn');
        simulateClick(targetItem);
        await new Promise(r => setTimeout(r, 1500));
        
        // 检查是否有确认按钮需要点击
        const confirmBtn = findElementByText('确认', ['button']);
        if (confirmBtn) {
          logger.log('点击确认按钮', 'action');
          simulateClick(confirmBtn);
          await new Promise(r => setTimeout(r, 1000));
        }
        
        logger.log('✅ AI 封面设置完成', 'success');
        return true;
      }
    }
  }
  
  logger.log('未找到生成的封面图片', 'error');
  return false;
};

/**
 * 设置封面图片（从正文选择）- 备用方案
 * 需要先悬浮在封面区域，等菜单出现后再点击"从正文选择"
 * 
 * 根据调试发现的 DOM 结构：
 * - 封面区域: <span class="btn-text js_share_type_none_image">拖拽或选择封面</span>
 * - 弹出菜单: <div class="pop-opr__group pop-opr__group-select-cover js_cover_null_pop js_cover_opr">
 * - 从正文选择链接: <a class="pop-opr__button js_selectCoverFromContent">从正文选择</a>
 */
// 全局变量：防止封面设置重复执行
let isCoverBeingSet = false;

const setCoverFromContent = async (options?: { preferredIndex?: number }): Promise<boolean> => {
  logger.log('设置封面图片（从正文选择）...', 'info');
  
  // 修复4：防止封面设置流程重复执行
  if (isCoverBeingSet) {
    logger.log('⚠️ 封面设置流程正在执行中，跳过重复调用', 'warn');
    return false;
  }
  
  isCoverBeingSet = true;
  
  try {
    const preferredIndex = options?.preferredIndex;
    const targetIndex = typeof preferredIndex === 'number' && Number.isFinite(preferredIndex) && preferredIndex >= 0 ? preferredIndex : 0;

    // 滚动到页面底部，确保封面区域可见
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise(r => setTimeout(r, 500));
  
  // 查找封面区域 - 使用精确的选择器
  let coverArea: HTMLElement | null = null;
  
  // 方法1: 使用精确的类名选择器（调试发现的）
  coverArea = document.querySelector('.btn-text.js_share_type_none_image') as HTMLElement;
  if (coverArea) {
    logger.log('找到封面区域: js_share_type_none_image', 'info');
  }
  
  // 方法2: 查找 select-cover__btn 区域
  if (!coverArea) {
    coverArea = document.querySelector('.select-cover__btn.js_cover_btn_area') as HTMLElement;
    if (coverArea) {
      logger.log('找到封面区域: select-cover__btn', 'info');
    }
  }
  
  // 方法3: 查找包含"拖拽或选择封面"文本的区域
  if (!coverArea) {
    const allElements = document.querySelectorAll('div, span');
    for (const el of allElements) {
      const text = (el as HTMLElement).innerText?.trim();
      if (text === '拖拽或选择封面') {
        coverArea = el as HTMLElement;
        logger.log('找到封面区域: 拖拽或选择封面', 'info');
        break;
      }
    }
  }
  
  if (!coverArea) {
    logger.log('未找到封面区域', 'error');
    return false;
  }
  
  // 滚动到封面区域
  coverArea.scrollIntoView({ behavior: 'instant', block: 'center' });
  await new Promise(r => setTimeout(r, 500));
  
  // 关键：点击封面区域触发弹出菜单
  // 根据调试结果，弹出菜单 pop-opr__group-select-cover 在点击后会显示
  logger.log('点击封面区域触发菜单...', 'action');
  
  const rect = coverArea.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  
  const eventOptions = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: centerX,
    clientY: centerY
  };
  
  // 先触发悬浮事件
  coverArea.dispatchEvent(new MouseEvent('mouseenter', eventOptions));
  coverArea.dispatchEvent(new MouseEvent('mouseover', eventOptions));
  await new Promise(r => setTimeout(r, 300));
  
  // 再触发点击事件
  coverArea.dispatchEvent(new MouseEvent('mousedown', eventOptions));
  coverArea.dispatchEvent(new MouseEvent('mouseup', eventOptions));
  coverArea.dispatchEvent(new MouseEvent('click', eventOptions));
  
  // 等待弹出菜单出现
  await new Promise(r => setTimeout(r, 800));
  
  // 查找"从正文选择"链接 - 使用精确的选择器
  logger.log('查找"从正文选择"链接...', 'info');
  
  let selectFromContentLink: HTMLElement | null = null;
  
  // 方法1: 使用精确的类名选择器（调试发现的）
  // 关键：不检查可见性，因为菜单可能使用特殊的显示方式
  selectFromContentLink = document.querySelector('a.js_selectCoverFromContent') as HTMLElement;
  if (selectFromContentLink) {
    logger.log('通过 js_selectCoverFromContent 找到链接', 'info');
  }
  
  // 方法2: 在 pop-opr__group 中查找
  if (!selectFromContentLink) {
    const popOprGroups = document.querySelectorAll('.pop-opr__group, .pop-opr__group-select-cover, .js_cover_null_pop');
    for (const group of popOprGroups) {
      const link = group.querySelector('a.js_selectCoverFromContent, a.pop-opr__button') as HTMLElement;
      if (link) {
        const text = link.innerText?.trim();
        if (text === '从正文选择') {
          selectFromContentLink = link;
          logger.log('在 pop-opr__group 中找到链接', 'info');
          break;
        }
      }
    }
  }
  
  // 方法3: 通过文本查找（不检查可见性）
  if (!selectFromContentLink) {
    const allLinks = document.querySelectorAll('a');
    for (const link of allLinks) {
      const text = (link as HTMLElement).innerText?.trim();
      if (text === '从正文选择') {
        selectFromContentLink = link as HTMLElement;
        logger.log('通过文本找到链接', 'info');
        break;
      }
    }
  }
  
  // 如果还没找到，再次点击封面区域并等待
  if (!selectFromContentLink) {
    logger.log('第一次未找到，再次点击封面区域...', 'info');
    
    // 再次点击
    simulateClick(coverArea);
    await new Promise(r => setTimeout(r, 1000));
    
    // 再次查找
    selectFromContentLink = document.querySelector('a.js_selectCoverFromContent') as HTMLElement;
    if (!selectFromContentLink) {
      const allLinks = document.querySelectorAll('a');
      for (const link of allLinks) {
        const text = (link as HTMLElement).innerText?.trim();
        if (text === '从正文选择') {
          selectFromContentLink = link as HTMLElement;
          break;
        }
      }
    }
  }
  
  if (!selectFromContentLink) {
    logger.log('未找到"从正文选择"链接', 'error');
    
    // 打印调试信息
    const popGroups = document.querySelectorAll('.pop-opr__group');
    logger.log(`页面上有 ${popGroups.length} 个 pop-opr__group`, 'info');
    
    return false;
  }
  
  // 点击"从正文选择"链接
  logger.log('点击"从正文选择"', 'action');
  
  // 确保链接可见（强制显示）
  const linkStyle = window.getComputedStyle(selectFromContentLink);
  if (linkStyle.display === 'none' || linkStyle.visibility === 'hidden') {
    logger.log('链接被隐藏，尝试强制显示...', 'info');
    // 尝试显示父元素
    let parent = selectFromContentLink.parentElement;
    while (parent) {
      const parentStyle = window.getComputedStyle(parent);
      if (parentStyle.display === 'none') {
        (parent as HTMLElement).style.display = 'block';
      }
      if (parentStyle.visibility === 'hidden') {
        (parent as HTMLElement).style.visibility = 'visible';
      }
      parent = parent.parentElement;
    }
  }
  
  // 滚动到链接位置
  selectFromContentLink.scrollIntoView({ behavior: 'instant', block: 'center' });
  await new Promise(r => setTimeout(r, 200));
  
  // 点击链接
  simulateClick(selectFromContentLink);
  await new Promise(r => setTimeout(r, 1500));
  
  // 选择第一张图片
  logger.log('选择封面图片...', 'info');
  
  // 等待图片选择弹窗出现
  await new Promise(r => setTimeout(r, 1000));
  
  const pickImageInDialog = async (index: number): Promise<boolean> => {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      const dialogs = Array.from(document.querySelectorAll('.weui-desktop-dialog, [class*="dialog"], [class*="modal"]')) as HTMLElement[];
      const currentDialog = dialogs.find(d => (d.innerText || '').includes('选择图片')) ||
        dialogs.find(d => !!Array.from(d.querySelectorAll('button')).find(b => ((b as HTMLElement).innerText || '').trim() === '下一步')) ||
        dialogs.find(d => isElementVisible(d)) ||
        dialogs[dialogs.length - 1] ||
        null;
      if (!currentDialog) { await new Promise(r => setTimeout(r, 250)); continue; }

      // 修复1：优先查找图片容器，而不是选中图标
      // 先尝试找到所有图片容器
      const candidates: HTMLElement[] = [];

      // 1. 查找 img 标签的容器
      const imgs = Array.from(currentDialog.querySelectorAll('img')) as HTMLImageElement[];
      for (const img of imgs) {
        const imgStyle = window.getComputedStyle(img);
        if (imgStyle.display === 'none' || imgStyle.visibility === 'hidden' || imgStyle.opacity === '0') continue;
        // 查找图片的可点击容器（通常是父元素）
        // 增加 .weui-desktop-img-picker__item, .weui-desktop-card__bd 等微信特定类名
        const c = (img.closest('label, li, [role="option"], .cover-image-item, .image-item, [class*="cover"], [class*="card"], .weui-desktop-img-picker__item, .weui-desktop-card__bd') as HTMLElement | null) || img.parentElement || img;
        candidates.push(c);
      }

      // 2. 查找背景图片的容器
      const bgEls = Array.from(currentDialog.querySelectorAll('li, [role="option"], div, .weui-desktop-img-picker__item')) as HTMLElement[];
      for (const el of bgEls) {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) continue;
        const bg = (el.style.backgroundImage || '').trim();
        if (bg && bg !== 'none') candidates.push(el);
      }

      // 3. 查找选中图标的容器（作为最后的补充）
      const icons = Array.from(currentDialog.querySelectorAll('.icon_card_selected_global, .weui-desktop-icon-checkbox')) as HTMLElement[];
      if (candidates.length === 0 && icons.length > 0) {
        for (const icon of icons) {
           // 尝试找到包含此 icon 的容器
           const c = (icon.closest('label, li, [role="option"], .cover-image-item, .image-item, [class*="cover"], [class*="card"], .weui-desktop-img-picker__item, .weui-desktop-card__bd') as HTMLElement | null) || icon.parentElement;
           if (c) candidates.push(c);
        }
      }

      const uniq = Array.from(new Set(candidates));
      
      // 如果找到了图片容器，点击容器而不是图标
      if (uniq.length > 0) {
        const i = Math.max(0, Math.min(index, uniq.length - 1));
        const target = uniq[i];
        target.scrollIntoView({ behavior: 'instant', block: 'center' });
        await new Promise(r => setTimeout(r, 150));
        logger.log(`选择封面图片：点击图片容器第 ${i + 1}/${uniq.length} 张`, 'action');
        
        // 优先使用 click()
        target.click();
        await new Promise(r => setTimeout(r, 200));
        
        // 验证是否选中成功（检查是否有选中状态）
        const checkSelected = () => {
             return target.classList.contains('selected') || 
                   target.querySelector('.icon_card_selected_global') !== null ||
                   target.querySelector('.weui-desktop-icon-checkbox-checked') !== null ||
                   target.getAttribute('aria-selected') === 'true' ||
                   !!target.querySelector('.selected');
        };

        if (!checkSelected()) {
             // 如果没选中，尝试 simulateClick
             simulateClick(target);
             await new Promise(r => setTimeout(r, 800));
        } else {
             await new Promise(r => setTimeout(r, 600));
        }
        
        if (checkSelected()) {
          logger.log('图片已成功选中', 'success');
        } else {
          logger.log('图片可能未选中，尝试再次点击图标（如果存在）', 'warn');
          // 尝试点击内部的图标或 input
          const innerIcon = target.querySelector('.icon_card_selected_global, .weui-desktop-icon-checkbox, input[type="checkbox"], input[type="radio"]') as HTMLElement;
          if (innerIcon) {
              simulateClick(innerIcon);
              await new Promise(r => setTimeout(r, 500));
          } else {
              // 再次点击容器
              simulateClick(target);
              await new Promise(r => setTimeout(r, 500));
          }
        }
        
        return true;
      }

      // 备用方案：如果没找到图片容器，尝试点击选中图标
      if (icons.length > 0) {
        const i = Math.max(0, Math.min(index, icons.length - 1));
        const target = icons[i];
        target.scrollIntoView({ behavior: 'instant', block: 'center' });
        await new Promise(r => setTimeout(r, 150));
        logger.log(`选择封面图片：点击图标第 ${i + 1}/${icons.length} 张（备用方案）`, 'action');
        simulateClick(target);
        await new Promise(r => setTimeout(r, 800));
        return true;
      }

      await new Promise(r => setTimeout(r, 250));
    }
    return false;
  };

  const picked = await pickImageInDialog(targetIndex);
  if (!picked) {
    logger.log('未找到可选择的图片，将尝试默认选择', 'warn');
    await pickImageInDialog(0);
  }
  
  const findCoverDialog = (): HTMLElement | null => {
    const dialogs = Array.from(document.querySelectorAll('.weui-desktop-dialog, [class*="dialog"], [class*="modal"]')) as HTMLElement[];
    return dialogs.find(d => (d.innerText || '').includes('选择图片')) ||
      dialogs.find(d => !!Array.from(d.querySelectorAll('button')).find(b => ((b as HTMLElement).innerText || '').trim() === '下一步')) ||
      dialogs.find(d => !!Array.from(d.querySelectorAll('button')).find(b => ((b as HTMLElement).innerText || '').trim() === '确认')) ||
      dialogs.find(d => isElementVisible(d)) ||
      dialogs[dialogs.length - 1] ||
      null;
  };

  const clickDialogButton = (dialog: HTMLElement, text: string): boolean => {
    const buttons = Array.from(dialog.querySelectorAll('button')) as HTMLElement[];
    const btn = buttons.find(b => (b.innerText || '').trim() === text) || null;
    if (!btn) return false;
    const style = window.getComputedStyle(btn);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    
    // 修复3：防止重复点击按钮
    const alreadyClicked = btn.getAttribute('data-memoraid-clicked');
    if (alreadyClicked === 'true') {
      logger.log(`⚠️ "${text}"按钮已被点击过，跳过以防止重复操作`, 'warn');
      return false;
    }
    
    // 标记按钮为已点击
    btn.setAttribute('data-memoraid-clicked', 'true');
    
    simulateClick(btn);
    return true;
  };

  const dialog1 = findCoverDialog();
  if (dialog1) {
    if (clickDialogButton(dialog1, '下一步')) {
      logger.log('点击下一步', 'action');
      await new Promise(r => setTimeout(r, 1200));
    }
  }

  const cropDeadline = Date.now() + 12000;
  while (Date.now() < cropDeadline) {
    const dialog = findCoverDialog();
    if (!dialog) break;
    const tracker = dialog.querySelector('.jcrop-tracker') as HTMLElement | null;
    if (tracker) {
      const style = window.getComputedStyle(tracker);
      if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
        logger.log('点击裁剪区域', 'action');
        simulateClick(tracker);
        await new Promise(r => setTimeout(r, 500));
        break;
      }
    }
    await new Promise(r => setTimeout(r, 300));
  }

  const dialog2 = findCoverDialog();
  if (dialog2 && clickDialogButton(dialog2, '确认')) {
    logger.log('点击确认', 'action');
    await new Promise(r => setTimeout(r, 1000));
  } else {
    const finalConfirmBtn = findElementByText('确认', ['button']);
    if (finalConfirmBtn && isElementVisible(finalConfirmBtn)) {
      logger.log('点击最终确认', 'action');
      simulateClick(finalConfirmBtn);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  logger.log('封面设置流程结束', 'success');
  return true;
  
  } catch (error) {
    logger.log(`封面设置出错: ${error}`, 'error');
    return false;
  } finally {
    // 重置标志，允许下次调用
    isCoverBeingSet = false;
  }
};

/**
 * 声明原创
 * @param authorName 作者名称
 */
const declareOriginal = async (authorName: string): Promise<boolean> => {
  logger.log('声明原创...', 'info');
  
  // 点击"未声明"
  const undeclaredBtn = findElementByText('未声明', ['span', 'div', 'a', 'label']);
  if (!undeclaredBtn) {
    logger.log('未找到原创声明入口', 'warn');
    return false;
  }
  
  logger.log('点击未声明', 'action');
  simulateClick(undeclaredBtn);
  await new Promise(r => setTimeout(r, 1000));
  
  // 填写作者名称
  const authorInput = findElement(SELECTORS.originalAuthorInput);
  if (authorInput) {
    logger.log('填写作者名称', 'action');
    simulateClick(authorInput);
    await new Promise(r => setTimeout(r, 200));
    simulateInput(authorInput, authorName);
    await new Promise(r => setTimeout(r, 500));
  }
  
  // 重要：勾选"我已阅读并同意《微信公众平台原创声明及相关功能使用协议》"复选框
  logger.log('查找协议复选框...', 'info');
  
  // 方法1: 通过文本查找包含"我已阅读"的复选框或其标签
  let agreementCheckbox: HTMLElement | null = null;
  
  // 查找复选框 - 可能是 input[type="checkbox"] 或者自定义的复选框元素
  const checkboxes = document.querySelectorAll('input[type="checkbox"]');
  for (const cb of checkboxes) {
    const parent = cb.closest('label, div, span');
    if (parent && parent.textContent?.includes('我已阅读')) {
      agreementCheckbox = cb as HTMLElement;
      break;
    }
  }
  
  // 方法2: 查找包含"我已阅读"文本的可点击元素（微信可能用自定义复选框）
  if (!agreementCheckbox) {
    const labels = document.querySelectorAll('label, .weui-desktop-form__check, .weui-desktop-checkbox');
    for (const label of labels) {
      if (label.textContent?.includes('我已阅读') && isElementVisible(label as HTMLElement)) {
        agreementCheckbox = label as HTMLElement;
        break;
      }
    }
  }
  
  // 方法3: 在原创声明弹窗内查找复选框
  if (!agreementCheckbox) {
    const originalBox = document.querySelector('#js_original_edit_box, .original-dialog, .weui-desktop-dialog');
    if (originalBox) {
      const cbInBox = originalBox.querySelector('input[type="checkbox"]') as HTMLElement;
      if (cbInBox) {
        agreementCheckbox = cbInBox;
      } else {
        // 查找自定义复选框
        const customCb = originalBox.querySelector('.weui-desktop-form__check-content, .checkbox, [class*="check"]') as HTMLElement;
        if (customCb && customCb.textContent?.includes('我已阅读')) {
          agreementCheckbox = customCb;
        }
      }
    }
  }
  
  // 方法4: 通过协议链接附近查找
  if (!agreementCheckbox) {
    const agreementLink = document.querySelector('a[href*="原创声明"], a:contains("原创声明")');
    if (agreementLink) {
      const container = agreementLink.closest('label, div');
      if (container) {
        const cb = container.querySelector('input[type="checkbox"]') as HTMLElement;
        if (cb) {
          agreementCheckbox = cb;
        } else {
          // 点击整个容器
          agreementCheckbox = container as HTMLElement;
        }
      }
    }
  }
  
  if (agreementCheckbox) {
    logger.log('勾选协议复选框', 'action');
    
    // 如果是 input checkbox，检查是否已勾选
    if (agreementCheckbox instanceof HTMLInputElement && agreementCheckbox.type === 'checkbox') {
      if (!agreementCheckbox.checked) {
        simulateClick(agreementCheckbox);
        // 也尝试直接设置 checked 属性
        agreementCheckbox.checked = true;
        agreementCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } else {
      // 自定义复选框，直接点击
      simulateClick(agreementCheckbox);
    }
    
    await new Promise(r => setTimeout(r, 500));
    logger.log('协议已勾选', 'success');
  } else {
    logger.log('未找到协议复选框，尝试继续...', 'warn');
  }
  
  // 点击确定按钮
  logger.log('查找确定按钮...', 'info');
  
  // 查找弹窗内的确定按钮
  let confirmBtn: HTMLElement | null = null;
  
  // 方法1: 在原创声明弹窗内查找
  const originalBox = document.querySelector('#js_original_edit_box, .original-dialog, .weui-desktop-dialog');
  if (originalBox) {
    const btns = originalBox.querySelectorAll('button');
    for (const btn of btns) {
      const text = btn.textContent?.trim();
      if (text === '确定' || text === '确认') {
        confirmBtn = btn as HTMLElement;
        break;
      }
    }
  }
  
  // 方法2: 通过文本查找
  if (!confirmBtn) {
    confirmBtn = findElementByText('确定', ['button']);
  }
  
  if (confirmBtn) {
    logger.log('点击确定', 'action');
    simulateClick(confirmBtn);
    await new Promise(r => setTimeout(r, 1000));
  } else {
    logger.log('未找到确定按钮', 'error');
    return false;
  }
  
  logger.log('原创声明完成', 'success');
  return true;
};

/**
 * 点击预览
 */
const clickPreview = async (): Promise<boolean> => {
  logger.log('点击预览...', 'info');
  
  const previewBtn = findElementByText('预览', ['button']);
  if (!previewBtn) {
    logger.log('未找到预览按钮', 'error');
    return false;
  }
  
  logger.log('点击预览按钮', 'action');
  simulateClick(previewBtn);
  await new Promise(r => setTimeout(r, 2000));
  
  logger.log('预览已打开', 'success');
  return true;
};

/**
 * 取消预览
 */
const cancelPreview = async (): Promise<boolean> => {
  const cancelBtn = findElementByText('取消', ['button']);
  if (cancelBtn) {
    simulateClick(cancelBtn);
    await new Promise(r => setTimeout(r, 500));
  }
  return true;
};

/**
 * 发布文章
 * 根据 Playwright 录制：
 * await page1.getByRole('button', { name: '发表' }).click();
 * await page1.locator('#vue_app').getByRole('button', { name: '发表' }).click();
 * 
 * 流程：
 * 1. 点击页面底部的"发表"按钮
 * 2. 如果弹出"创作来源声明提醒"对话框，点击"继续发表"按钮
 * 3. 如果弹出确认对话框，再次点击"发表"按钮
 */
const publishArticle = async (): Promise<boolean> => {
  logger.log('📤 开始发布文章...', 'info');
  
  // 步骤1: 点击页面底部的"发表"按钮
  logger.log('查找发表按钮...', 'info');
  
  let publishBtn: HTMLElement | null = null;
  
  // 方法1: 通过文本查找"发表"按钮（排除"保存为草稿"等）
  const allButtons = document.querySelectorAll('button');
  for (const btn of allButtons) {
    const text = (btn as HTMLElement).innerText?.trim();
    if (text === '发表' && isElementVisible(btn as HTMLElement)) {
      publishBtn = btn as HTMLElement;
      logger.log('找到发表按钮', 'info');
      break;
    }
  }
  
  // 方法2: 在页面底部区域查找
  if (!publishBtn) {
    const footerArea = document.querySelector('.weui-desktop-btn-area, .appmsg_edit_ft, [class*="footer"]');
    if (footerArea) {
      const btns = footerArea.querySelectorAll('button');
      for (const btn of btns) {
        const text = (btn as HTMLElement).innerText?.trim();
        if (text === '发表') {
          publishBtn = btn as HTMLElement;
          logger.log('在底部区域找到发表按钮', 'info');
          break;
        }
      }
    }
  }
  
  if (!publishBtn) {
    logger.log('未找到发表按钮', 'error');
    return false;
  }
  
  logger.log('点击发表按钮（第一次）', 'action');
  simulateClick(publishBtn);
  
  // 等待弹窗出现
  await new Promise(r => setTimeout(r, 2000));
  
  // 步骤2: 处理可能出现的多个弹窗
  // 弹窗顺序可能是：
  // 1. "创作来源声明提醒" -> 点击"继续发表"
  // 2. 发表确认弹窗（群发通知、分组通知等选项）-> 点击"发表"
  
  for (let attempt = 0; attempt < 5; attempt++) {
    await new Promise(r => setTimeout(r, 1000));
    
    // 检查是否有可见的弹窗
    const visibleDialogs = Array.from(document.querySelectorAll('.weui-desktop-dialog, [class*="dialog"], [class*="modal"]'))
      .filter(d => isElementVisible(d as HTMLElement));
    
    if (visibleDialogs.length === 0) {
      logger.log('没有弹窗了，发布流程可能已完成', 'info');
      break;
    }
    
    logger.log(`检测到 ${visibleDialogs.length} 个弹窗，尝试处理...`, 'info');
    
    let clickedButton = false;
    
    // 优先查找"继续发表"按钮（创作来源声明提醒弹窗）
    const continuePublishBtn = findElementByText('继续发表', ['button']);
    if (continuePublishBtn && isElementVisible(continuePublishBtn)) {
      logger.log('点击"继续发表"按钮', 'action');
      simulateClick(continuePublishBtn);
      clickedButton = true;
      await new Promise(r => setTimeout(r, 1500));
      continue;
    }
    
    // 在所有可见弹窗中查找"发表"按钮
    for (const dialog of visibleDialogs) {
      const btns = dialog.querySelectorAll('button');
      for (const btn of btns) {
        const text = (btn as HTMLElement).innerText?.trim();
        // 优先点击绿色的"发表"按钮（主要操作按钮）
        if (text === '发表' && isElementVisible(btn as HTMLElement)) {
          // 检查是否是主要按钮（通常有 primary 类名或绿色背景）
          const classList = btn.className || '';
          const isPrimary = classList.includes('primary') || classList.includes('weui-desktop-btn_primary');
          
          logger.log(`在弹窗中点击"发表"按钮 (primary=${isPrimary})`, 'action');
          simulateClick(btn as HTMLElement);
          clickedButton = true;
          await new Promise(r => setTimeout(r, 1500));
          break;
        }
      }
      if (clickedButton) break;
    }
    
    // 如果没找到"发表"，尝试找"确认"按钮
    if (!clickedButton) {
      for (const dialog of visibleDialogs) {
        const btns = dialog.querySelectorAll('button');
        for (const btn of btns) {
          const text = (btn as HTMLElement).innerText?.trim();
          if (text === '确认' && isElementVisible(btn as HTMLElement)) {
            logger.log('在弹窗中点击"确认"按钮', 'action');
            simulateClick(btn as HTMLElement);
            clickedButton = true;
            await new Promise(r => setTimeout(r, 1500));
            break;
          }
        }
        if (clickedButton) break;
      }
    }
    
    // 特别处理：在 #vue_app 中查找发表按钮
    if (!clickedButton) {
      const vueApp = document.querySelector('#vue_app');
      if (vueApp) {
        const btns = vueApp.querySelectorAll('button');
        for (const btn of btns) {
          const text = (btn as HTMLElement).innerText?.trim();
          if (text === '发表' && isElementVisible(btn as HTMLElement)) {
            logger.log('在 #vue_app 中点击"发表"按钮', 'action');
            simulateClick(btn as HTMLElement);
            clickedButton = true;
            await new Promise(r => setTimeout(r, 1500));
            break;
          }
        }
      }
    }
    
    if (!clickedButton) {
      logger.log('未找到可点击的按钮，等待...', 'warn');
    }
  }
  
  // 最后检查一次是否还有弹窗
  await new Promise(r => setTimeout(r, 1000));
  const finalDialogs = Array.from(document.querySelectorAll('.weui-desktop-dialog'))
    .filter(d => isElementVisible(d as HTMLElement));
  
  if (finalDialogs.length > 0) {
    // 再尝试点击一次发表按钮
    for (const dialog of finalDialogs) {
      const publishBtnInDialog = Array.from(dialog.querySelectorAll('button'))
        .find(btn => (btn as HTMLElement).innerText?.trim() === '发表' && isElementVisible(btn as HTMLElement));
      
      if (publishBtnInDialog) {
        logger.log('最后一次点击弹窗中的"发表"按钮', 'action');
        simulateClick(publishBtnInDialog as HTMLElement);
        await new Promise(r => setTimeout(r, 1500));
        break;
      }
    }
  }
  
  logger.log('✅ 文章发布流程完成', 'success');
  return true;
};

/**
 * 从文章内容生成 AI 配图提示词
 * 提示词要复杂、具体，贴合文章内容
 * @param title 文章标题
 * @param content 文章内容
 * @param keyword 图片关键词（来自占位符）
 * @param isCover 是否是封面图（封面需要更吸引人）
 */
const generateImagePrompt = (title: string, content: string, keyword?: string, isCover = false): string => {
  // 清理内容，移除特殊字符
  const cleanContent = content.replace(/[#*\[\]【】：:]/g, '').substring(0, 300);
  
  // 提取文章主题关键词
  const titleKeywords = title.replace(/[，。！？、""'']/g, ' ').split(/\s+/).filter(w => w.length > 1).slice(0, 3).join('、');
  
  // 从内容中提取关键句子
  const sentences = cleanContent.split(/[。！？\n]/).filter(s => s.length > 10 && s.length < 50);
  const keySentence = sentences[0] || '';
  
  if (isCover) {
    // 封面图提示词 - 要吸引人、有视觉冲击力
    const coverPrompts = [
      `公众号封面图，主题"${title}"，画面要有强烈视觉冲击力，色彩鲜艳醒目，构图大气，能吸引读者点击，现代设计风格，高清质感，适合社交媒体传播`,
      `一张吸引眼球的封面配图，表现"${titleKeywords}"的核心概念，画面简洁有力，主体突出，色彩对比强烈，让人一眼就想点进来看，专业设计感，适合微信公众号`,
      `创意封面设计，围绕"${title}"主题，画面要有故事感和悬念感，引发读者好奇心，色彩搭配时尚，构图新颖独特，高端大气，适合自媒体文章封面`,
      `震撼的视觉封面，主题是"${keySentence.substring(0, 20) || title}"，画面要有冲击力和感染力，能引起情感共鸣，色彩饱满，细节精致，让人忍不住想了解更多`
    ];
    return coverPrompts[Math.floor(Math.random() * coverPrompts.length)];
  }
  
  if (keyword) {
    // 有具体关键词的配图 - 根据关键词和上下文生成
    const contextPrompts = [
      `一幅精美的插画，主题是"${keyword}"，与文章"${title}"相关，画面要能准确表达${keyword}的含义和情感，色彩和谐，构图精美，现代扁平化设计风格，适合公众号文章配图`,
      `创意配图，表现"${keyword}"的场景或概念，结合文章主题"${titleKeywords}"，画面生动形象，细节丰富，色彩明快，有艺术感和设计感，高清质感`,
      `一张关于"${keyword}"的概念图，要能让读者一眼理解其含义，画面简洁但有深度，色彩搭配专业，构图平衡，适合在"${title}"这篇文章中使用`,
      `插画设计，核心元素是"${keyword}"，风格要与"${keySentence.substring(0, 15) || title}"的氛围相符，画面有层次感，色彩鲜明但不刺眼，专业美观`
    ];
    return contextPrompts[Math.floor(Math.random() * contextPrompts.length)];
  }
  
  // 通用配图 - 根据文章整体内容生成
  const generalPrompts = [
    `一幅与"${title}"主题相关的精美插画，画面要能概括文章核心观点"${keySentence.substring(0, 25)}"，色彩和谐统一，构图大气，现代简约设计风格，高清质感，适合公众号文章`,
    `创意配图，围绕"${titleKeywords}"展开，画面要有故事性和感染力，能引起读者共鸣，色彩搭配时尚，细节精致，专业设计感`,
    `一张能代表文章"${title}"核心内容的概念图，画面简洁有力，主体突出，色彩明快，让读者一眼就能理解文章主旨，适合社交媒体传播`
  ];
  return generalPrompts[Math.floor(Math.random() * generalPrompts.length)];
};

/**
 * 查找图片占位符
 */
const findImagePlaceholders = (): { text: string; keyword: string }[] => {
  const editor = findElement(SELECTORS.editor);
  if (!editor) return [];
  
  const content = editor.innerText || '';
  const placeholders: { text: string; keyword: string }[] = [];
  
  const patterns = [
    /\[图片[：:]\s*([^\]]+)\]/g,
    /【图片[：:]\s*([^】]+)】/g,
    /\[配图[：:]\s*([^\]]+)\]/g,
    /【配图[：:]\s*([^】]+)】/g,
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
 * 从内容中提取封面提示词
 * 格式: [封面: xxx] 或 【封面: xxx】
 * @param content 文章内容
 * @returns 封面提示词，如果没有则返回 null
 */
const extractCoverPrompt = (content: string): { text: string; prompt: string } | null => {
  const patterns = [
    /\[封面[：:]\s*([^\]]+)\]/,
    /【封面[：:]\s*([^】]+)】/,
  ];
  
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      return {
        text: match[0],
        prompt: match[1].trim()
      };
    }
  }
  
  return null;
};

/**
 * 从内容中移除封面提示词
 * @param content 文章内容
 * @returns 移除封面提示词后的内容
 */
const removeCoverPromptFromContent = (content: string): string => {
  // 移除 [封面: xxx] 或 【封面: xxx】 格式的封面提示词
  let cleaned = content
    .replace(/\[封面[：:]\s*[^\]]+\]\s*/g, '')
    .replace(/【封面[：:]\s*[^】]+】\s*/g, '');
  
  // 移除 [摘要: xxx] 或 【摘要: xxx】 格式的摘要
  cleaned = cleaned
    .replace(/\[摘要[：:]\s*[^\]]+\]\s*/g, '')
    .replace(/【摘要[：:]\s*[^】]+】\s*/g, '');
  
  // 清理多余的空行
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
  
  return cleaned;
};

/**
 * 从内容中提取摘要
 * 格式: [摘要: xxx] 或 【摘要: xxx】
 * @param content 文章内容
 * @returns 摘要内容，如果没有则返回 null
 */
const extractSummary = (content: string): { text: string; summary: string } | null => {
  const patterns = [
    /\[摘要[：:]\s*([^\]]+)\]/,
    /【摘要[：:]\s*([^】]+)】/,
  ];
  
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      let summary = match[1].trim();
      // 确保摘要不超过120字
      if (summary.length > 120) {
        summary = summary.substring(0, 117) + '...';
      }
      return {
        text: match[0],
        summary: summary
      };
    }
  }
  
  return null;
};

/**
 * 填充封面摘要
 * 摘要输入框在封面设置区域，用于显示在文章卡片和转发预览中
 * @param summary 摘要内容（最多120字）
 */
const fillCoverSummary = async (summary: string): Promise<boolean> => {
  logger.log('📝 填充封面摘要...', 'info');
  
  // 滚动到页面底部，确保摘要输入框可见
  window.scrollTo(0, document.body.scrollHeight);
  await new Promise(r => setTimeout(r, 500));
  
  // 查找摘要输入框
  // 根据截图，摘要输入框的 placeholder 是 "选填，不填写则默认抓取正文开头部分文字，摘要会在转发卡片和公众号会话展示。"
  let summaryInput: HTMLElement | null = null;
  
  // 方法1: 通过 placeholder 查找
  const textareas = document.querySelectorAll('textarea');
  for (const textarea of textareas) {
    const placeholder = textarea.getAttribute('placeholder') || '';
    if (placeholder.includes('摘要') || placeholder.includes('正文开头') || placeholder.includes('转发卡片')) {
      summaryInput = textarea as HTMLElement;
      logger.log('通过 placeholder 找到摘要输入框', 'info');
      break;
    }
  }
  
  // 方法2: 通过类名或 ID 查找
  if (!summaryInput) {
    summaryInput = document.querySelector('#js_description, .js_description, [name="description"], textarea[name="digest"]') as HTMLElement;
    if (summaryInput) {
      logger.log('通过选择器找到摘要输入框', 'info');
    }
  }
  
  // 方法3: 在封面区域附近查找 textarea
  if (!summaryInput) {
    const coverArea = document.querySelector('.js_cover_area, .cover-area, [class*="cover"]');
    if (coverArea) {
      // 查找封面区域附近的 textarea
      const parent = coverArea.parentElement;
      if (parent) {
        const nearbyTextarea = parent.querySelector('textarea');
        if (nearbyTextarea) {
          summaryInput = nearbyTextarea as HTMLElement;
          logger.log('在封面区域附近找到摘要输入框', 'info');
        }
      }
    }
  }
  
  // 方法4: 查找所有可见的 textarea，排除正文编辑器
  if (!summaryInput) {
    const allTextareas = document.querySelectorAll('textarea');
    for (const textarea of allTextareas) {
      if (isElementVisible(textarea as HTMLElement)) {
        // 排除正文编辑器（通常有 contenteditable 或特定类名）
        const isEditor = textarea.closest('[contenteditable="true"]') || 
                        textarea.closest('.edui-body-container') ||
                        textarea.closest('#ueditor_0');
        if (!isEditor) {
          // 检查是否在页面底部区域（摘要通常在底部）
          const rect = textarea.getBoundingClientRect();
          if (rect.top > window.innerHeight * 0.5) {
            summaryInput = textarea as HTMLElement;
            logger.log('在页面底部找到 textarea', 'info');
            break;
          }
        }
      }
    }
  }
  
  if (!summaryInput) {
    logger.log('未找到摘要输入框', 'warn');
    return false;
  }
  
  // 滚动到摘要输入框
  summaryInput.scrollIntoView({ behavior: 'instant', block: 'center' });
  await new Promise(r => setTimeout(r, 300));
  
  // 填充摘要
  logger.log(`填充摘要: ${summary.substring(0, 30)}...`, 'action');
  simulateClick(summaryInput);
  await new Promise(r => setTimeout(r, 200));
  
  // 确保摘要不超过120字
  const truncatedSummary = summary.length > 120 ? summary.substring(0, 117) + '...' : summary;
  simulateInput(summaryInput, truncatedSummary);
  
  await new Promise(r => setTimeout(r, 300));
  logger.log('✅ 摘要已填充', 'success');
  return true;
};

/**
 * 在编辑器中查找并选中占位符文本
 * @param placeholderText 占位符文本，如 "[图片: 手机签到]"
 * @returns 是否成功选中
 */
const selectPlaceholderInEditor = (placeholderText: string): boolean => {
  const editor = findElement(SELECTORS.editor);
  if (!editor) return false;
  
  // 使用 TreeWalker 遍历所有文本节点
  const walker = document.createTreeWalker(
    editor,
    NodeFilter.SHOW_TEXT,
    null
  );
  
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    const text = node.textContent || '';
    const index = text.indexOf(placeholderText);
    
    if (index !== -1) {
      // 找到了占位符，创建选区
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + placeholderText.length);
      
      // 清除现有选区并设置新选区
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
        
        // 滚动到选中位置
        const rect = range.getBoundingClientRect();
        if (rect.top < 0 || rect.bottom > window.innerHeight) {
          const element = node.parentElement;
          element?.scrollIntoView({ behavior: 'instant', block: 'center' });
        }
        
        logger.log(`已选中占位符: ${placeholderText}`, 'success');
        return true;
      }
    }
  }
  
  logger.log(`未找到占位符: ${placeholderText}`, 'warn');
  return false;
};

/**
 * 关闭 AI 配图弹窗
 */
const closeAIImageDialog = async (): Promise<boolean> => {
  logger.log('关闭 AI 配图弹窗...', 'info');
  
  // 方法1: 查找关闭按钮（X）
  const closeButtons = document.querySelectorAll('.weui-desktop-dialog__close, .dialog-close, [class*="close"], .weui-desktop-icon-close');
  for (const btn of closeButtons) {
    if (isElementVisible(btn as HTMLElement)) {
      const parent = btn.closest('.weui-desktop-dialog, .dialog, [class*="dialog"]');
      if (parent) {
        logger.log('点击关闭按钮', 'action');
        simulateClick(btn as HTMLElement);
        await new Promise(r => setTimeout(r, 500));
        return true;
      }
    }
  }
  
  // 方法2: 点击弹窗外部区域（遮罩层）
  const masks = document.querySelectorAll('.weui-desktop-dialog__mask, .dialog-mask, [class*="mask"]');
  for (const mask of masks) {
    if (isElementVisible(mask as HTMLElement)) {
      logger.log('点击遮罩层关闭', 'action');
      simulateClick(mask as HTMLElement);
      await new Promise(r => setTimeout(r, 500));
      return true;
    }
  }
  
  // 方法3: 按 ESC 键
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
  await new Promise(r => setTimeout(r, 500));
  
  return true;
};

/**
 * 为单个占位符生成并插入 AI 图片
 * 关键：先选中占位符，再插入图片，这样图片会替换占位符
 * @param placeholder 占位符信息（keyword 就是 AI 提示词，直接使用不需要包装）
 * @param title 文章标题（备用）
 * @param content 文章内容（备用）
 * @returns 是否成功
 */
const generateAndInsertImageForPlaceholder = async (
  placeholder: { text: string; keyword: string },
  _title?: string,
  _content?: string
): Promise<boolean> => {
  logger.log(`处理占位符: ${placeholder.text}`, 'info');
  
  // 步骤1: 在编辑器中选中占位符
  if (!selectPlaceholderInEditor(placeholder.text)) {
    logger.log('无法选中占位符，跳过', 'warn');
    return false;
  }
  
  await new Promise(r => setTimeout(r, 300));
  
  // 步骤2: 打开图片对话框
  if (!await openImageDialog()) {
    logger.log('无法打开图片对话框', 'error');
    return false;
  }
  
  // 步骤3: 点击 AI 配图
  if (!await clickAIImage()) {
    logger.log('无法点击 AI 配图', 'error');
    await closeAIImageDialog();
    return false;
  }
  
  // 步骤4: 直接使用占位符中的关键词作为提示词，不需要额外包装
  // AI 给的是什么提示词就用什么
  const prompt = placeholder.keyword;
  
  logger.log(`AI 提示词: ${prompt}`, 'info');
  
  if (!await generateAIImage(prompt)) {
    logger.log('AI 图片生成失败', 'error');
    await closeAIImageDialog();
    return false;
  }
  
  // 步骤5: 插入图片（图片会插入到当前光标位置，即占位符位置）
  if (!await insertAIImage()) {
    logger.log('插入图片失败', 'error');
    await closeAIImageDialog();
    return false;
  }
  
  // 步骤6: 等待图片插入完成，弹窗会自动关闭
  await new Promise(r => setTimeout(r, 1000));
  
  logger.log(`占位符 "${placeholder.keyword}" 处理完成`, 'success');
  return true;
};

const extractFirstHttpUrl = (input: string): string => {
  const s = String(input || '').trim();
  if (!s) return '';
  try {
    const u = new URL(s, window.location.href);
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.toString();
  } catch {
  }
  const m = s.match(/https?:\/\/[^\s`"'（）()]+/i);
  return m?.[0] || '';
};

const normalizeWeiboImageUrl = (url: string): string => {
  try {
    const cleaned = extractFirstHttpUrl(url);
    if (!cleaned) return '';
    const u = new URL(cleaned, window.location.href);
    const host = u.hostname.toLowerCase();
    if (host.endsWith('sinajs.cn')) return '';
    if (!host.endsWith('sinaimg.cn')) return u.toString();
    if (host.startsWith('tvax')) {
      return '';
    }
    const segments = u.pathname.split('/').filter(Boolean);
    if (segments.length < 2) return u.toString();
    const size = segments[0].toLowerCase();
    const replaceable = ['thumb150', 'thumb180', 'thumb300', 'orj360', 'mw2000', 'mw1024', 'mw690', 'bmiddle', 'small', 'square'];
    if (replaceable.includes(size)) {
      segments[0] = 'large';
      u.pathname = '/' + segments.join('/');
    }
    return u.toString();
  } catch {
    return '';
  }
};

const shouldAvoidHotlinkInsert = (url: string): boolean => {
  try {
    const u = new URL(url, window.location.href);
    const host = u.hostname.toLowerCase();
    if (host.endsWith('sinaimg.cn')) return true;
    if (host.includes('weibo.com') || host.includes('weibo.cn')) return true;
    return false;
  } catch {
    return false;
  }
};

const fetchSourceImageDataUrl = async (url: string, referrer?: string): Promise<{ dataUrl: string; mimeType: string } | null> => {
  const normalizedUrl = normalizeWeiboImageUrl(url);
  if (!normalizedUrl) {
    logger.log(`图片 URL 无效: ${url}`, 'error');
    return null;
  }
  
  // 策略 1: 尝试从页面上已加载的图片中获取（最可靠）
  logger.log(`尝试从页面已加载图片中获取...`, 'info');
  try {
    const pageImages = Array.from(document.querySelectorAll('img')) as HTMLImageElement[];
    
    // 提取图片 ID 用于模糊匹配
    const extractImageId = (imgUrl: string): string => {
      try {
        const match = imgUrl.match(/\/([a-zA-Z0-9]+)\.(jpg|jpeg|png|webp|gif)/i);
        return match ? match[1] : '';
      } catch {
        return '';
      }
    };
    
    const targetId = extractImageId(normalizedUrl) || extractImageId(url);
    
    const matchingImg = pageImages.find(img => {
      const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-original') || '';
      if (!src) return false;
      
      // 精确匹配
      if (src === normalizedUrl || src === url) return true;
      
      // 模糊匹配：通过图片 ID
      if (targetId && src.includes(targetId)) return true;
      
      // 模糊匹配：检查是否包含相同的域名和部分路径
      if (src.includes('sinaimg.cn') && normalizedUrl.includes('sinaimg.cn')) {
        const srcId = extractImageId(src);
        if (srcId && srcId === targetId) return true;
      }
      
      return false;
    });
    
    if (matchingImg) {
      logger.log(`找到匹配的图片元素: ${matchingImg.src.substring(0, 60)}...`, 'info');
      
      // 等待图片加载完成
      if (!matchingImg.complete || matchingImg.naturalWidth === 0) {
        logger.log(`图片还未加载完成，等待...`, 'info');
        await new Promise<void>((resolve) => {
          if (matchingImg.complete && matchingImg.naturalWidth > 0) {
            resolve();
            return;
          }
          
          const timeout = setTimeout(() => {
            logger.log(`等待图片加载超时`, 'warn');
            resolve();
          }, 3000);
          
          matchingImg.onload = () => {
            clearTimeout(timeout);
            logger.log(`图片加载完成`, 'info');
            resolve();
          };
          
          matchingImg.onerror = () => {
            clearTimeout(timeout);
            logger.log(`图片加载失败`, 'warn');
            resolve();
          };
        });
      }
      
      if (matchingImg.complete && matchingImg.naturalWidth > 0) {
        logger.log(`尝试转换为 canvas (${matchingImg.naturalWidth}x${matchingImg.naturalHeight})...`, 'info');
        try {
          const canvas = document.createElement('canvas');
          canvas.width = matchingImg.naturalWidth;
          canvas.height = matchingImg.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(matchingImg, 0, 0);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
            const sizeKB = (dataUrl.length / 1024).toFixed(1);
            logger.log(`✅ 成功从页面图片转换: ${sizeKB} KB`, 'success');
            return { dataUrl, mimeType: 'image/jpeg' };
          }
        } catch (e) {
          logger.log(`Canvas 转换失败: ${e}`, 'warn');
        }
      } else {
        logger.log(`图片未正确加载 (complete: ${matchingImg.complete}, width: ${matchingImg.naturalWidth})`, 'warn');
      }
    } else {
      logger.log(`未找到匹配的图片元素 (页面共 ${pageImages.length} 张图片)`, 'warn');
    }
  } catch (e) {
    logger.log(`从页面获取图片失败: ${e}`, 'warn');
  }
  
  // 策略 2: 使用 Image 对象加载（浏览器可能允许）
  logger.log(`尝试使用 Image 对象加载...`, 'info');
  try {
    const result = await new Promise<{ dataUrl: string; mimeType: string } | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      const timeout = setTimeout(() => {
        logger.log(`Image 加载超时`, 'warn');
        resolve(null);
      }, 5000);
      
      img.onload = () => {
        clearTimeout(timeout);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
            const sizeKB = (dataUrl.length / 1024).toFixed(1);
            logger.log(`✅ Image 对象加载成功: ${sizeKB} KB`, 'success');
            resolve({ dataUrl, mimeType: 'image/jpeg' });
          } else {
            resolve(null);
          }
        } catch (e) {
          logger.log(`Canvas 转换失败: ${e}`, 'warn');
          resolve(null);
        }
      };
      
      img.onerror = () => {
        clearTimeout(timeout);
        logger.log(`Image 加载失败`, 'warn');
        resolve(null);
      };
      
      img.src = normalizedUrl;
    });
    
    if (result) return result;
  } catch (e) {
    logger.log(`Image 对象加载异常: ${e}`, 'warn');
  }
  
  // 策略 3: 通过后台脚本获取（使用扩展特权）
  const effectiveReferrer = (() => {
    try {
      const u = new URL(url, window.location.href);
      const host = u.hostname.toLowerCase();
      if (host.endsWith('sinaimg.cn')) {
        const r = (referrer || '').toLowerCase();
        if (!r.includes('weibo.com') && !r.includes('weibo.cn') && !r.includes('s.weibo.com')) {
          return 'https://weibo.com/';
        }
      }
    } catch {
      return referrer;
    }
    return referrer;
  })();

  const tryOnce = async (targetUrl: string, attemptNum: number) => {
    logger.log(`后台获取 (第 ${attemptNum} 次): ${targetUrl.substring(0, 60)}...`, 'info');
    const res = await chrome.runtime.sendMessage({ type: 'FETCH_IMAGE_DATA_URL', payload: { url: targetUrl, referrer: effectiveReferrer } });
    
    if (!res || !res.success || !res.dataUrl) {
      logger.log(`后台获取失败: ${res?.error || '无响应'}`, 'warn');
      return null;
    }
    
    const dataUrl = res.dataUrl as string;
    const mimeType = (res.mimeType as string) || 'image/jpeg';
    
    if (dataUrl.length < 50000) {
      logger.log(`数据太小 (${dataUrl.length} bytes)`, 'warn');
      return null;
    }
    
    logger.log(`✅ 后台获取成功: ${(dataUrl.length / 1024).toFixed(1)} KB`, 'success');
    return { dataUrl, mimeType };
  };
  
  try {
    const r1 = await tryOnce(normalizedUrl, 1);
    if (r1) return r1;
    
    await new Promise(r => setTimeout(r, 800));
    const r2 = await tryOnce(normalizedUrl, 2);
    if (r2) return r2;
    
    if (normalizedUrl !== url) {
      await new Promise(r => setTimeout(r, 800));
      const r3 = await tryOnce(url, 3);
      if (r3) return r3;
    }
    
    logger.log(`所有策略均失败，无法获取图片`, 'error');
    return null;
  } catch (e) {
    logger.log(`获取图片异常: ${e}`, 'error');
    return null;
  }
};

const fetchSourceImageFile = async (url: string, referrer?: string): Promise<File | null> => {
  try {
    logger.log(`尝试下载图片为 File 对象...`, 'info');
    
    // 使用后台脚本下载图片
    const res = await chrome.runtime.sendMessage({ 
      type: 'DOWNLOAD_IMAGE_AS_BLOB', 
      payload: { url, referrer } 
    });
    
    if (!res || !res.success) {
      logger.log(`下载失败: ${res?.error || '未知错误'}`, 'error');
      return null;
    }
    
    // 将 ArrayBuffer 转换回 Blob
    const uint8Array = new Uint8Array(res.arrayBuffer);
    const blob = new Blob([uint8Array], { type: res.mimeType });
    
    // 创建 File 对象
    const file = new File([blob], res.filename, { type: res.mimeType });
    
    logger.log(`✅ 成功下载图片: ${res.filename}, ${(res.size / 1024).toFixed(1)} KB`, 'success');
    return file;
  } catch (e) {
    logger.log(`下载图片异常: ${e}`, 'error');
    return null;
  }
};

const isMediaAiEnabled = async (): Promise<boolean> => {
  try {
    const s = await chrome.storage.sync.get(['enableMediaAi', 'enableImageOcr']);
    return s.enableMediaAi === true || s.enableImageOcr === true;
  } catch {
    return false;
  }
};

const escapeHtmlAttr = (value: string): string => {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

const markImageOriginal = (img: HTMLImageElement, originalUrl?: string) => {
  const v = (originalUrl || '').trim();
  if (!v) return;
  try {
    img.setAttribute('data-memoraid-original', v);
    (img as any).dataset && ((img as any).dataset.memoraidOriginal = v);
  } catch {
  }
};

const createThumbnailDataUrl = async (dataUrl: string, maxDim = 512): Promise<string | null> => {
  return await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width || 0;
        const h = img.naturalHeight || img.height || 0;
        if (!w || !h) { resolve(null); return; }
        const scale = Math.min(1, maxDim / Math.max(w, h));
        const tw = Math.max(1, Math.round(w * scale));
        const th = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement('canvas');
        canvas.width = tw;
        canvas.height = th;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0, tw, th);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
};

const getImageMetaFromDataUrl = async (dataUrl: string): Promise<{ width: number; height: number; aspect: number } | null> => {
  return await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || img.width || 0;
      const h = img.naturalHeight || img.height || 0;
      if (!w || !h) { resolve(null); return; }
      resolve({ width: w, height: h, aspect: Math.max(w / h, h / w) });
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
};

const analyzeSourceImagesWithAIOnce = async (options: {
  title: string;
  content: string;
  placeholders: Array<{ text: string; keyword: string }>;
  sourceImages: string[];
  sourceUrl?: string;
}): Promise<{ orderedUrls: string[]; coverUrl?: string }> => {
  const unique = Array.from(new Set(options.sourceImages));
  const normalized = unique
    .map(u => normalizeWeiboImageUrl(u))
    .filter(u => !!u) as string[];

  const candidates = normalized.slice(0, 10);
  if (candidates.length <= 1) return { orderedUrls: normalized };

  const enabled = await isMediaAiEnabled();
  if (!enabled) return { orderedUrls: normalized };

  const images: Array<{ url: string; thumbDataUrl: string; width?: number; height?: number; aspect?: number }> = [];
  for (const url of candidates) {
    const data = await fetchSourceImageDataUrl(url, options.sourceUrl);
    if (!data?.dataUrl) continue;
    const meta = await getImageMetaFromDataUrl(data.dataUrl);
    const thumb = await createThumbnailDataUrl(data.dataUrl, 512);
    if (!thumb) continue;
    images.push({ url, thumbDataUrl: thumb, width: meta?.width, height: meta?.height, aspect: meta?.aspect });
  }

  if (images.length <= 1) return { orderedUrls: normalized };

  const context = [
    normalized.length > 0 ? `封面要求：必须使用第一张图片作为封面（URL：${normalized[0]}）。` : '',
    options.placeholders.length ? `占位符：${options.placeholders.map(p => p.keyword).filter(Boolean).join('；')}` : '',
    options.content.slice(0, 800)
  ].filter(Boolean).join('\n');

  try {
    const resp = await chrome.runtime.sendMessage({
      type: 'AI_MEDIA_ENHANCE',
      payload: {
        title: options.title,
        context,
        images,
        maxPick: Math.min(options.placeholders.length || 10, images.length)
      }
    });
    const skippedCode = resp?.success ? (resp.result?.skipped?.code as string | undefined) : undefined;
    if (skippedCode) {
      if (skippedCode === 'missing_apiyi_key') {
        logger.log('AI 图文增强已开启，但未配置 apiyi API Key，本次不会调用 apiyi 选图', 'warn');
      } else if (skippedCode === 'media_ai_disabled') {
        logger.log('AI 图文增强未开启，本次不会调用 apiyi 选图', 'warn');
      } else {
        logger.log(`AI 选图已跳过：${skippedCode}`, 'warn');
      }
      return { orderedUrls: normalized };
    }
    const errorMsg = resp?.success ? (resp.result?.error as string | undefined) : undefined;
    if (errorMsg) {
      const msg = String(errorMsg);
      const isQuota = /quota|not enough|insufficient/i.test(msg);
      logger.log(
        isQuota
          ? `AI 选图调用失败：apiyi 额度不足/已用尽（${msg.slice(0, 120)}）。请充值或更换 apiyi API Key。`
          : `AI 选图调用失败，本次不会调用 apiyi 选图：${msg.slice(0, 160)}`,
        'warn'
      );
      return { orderedUrls: normalized };
    }
    const orderedUrls = resp?.success ? (resp.result?.inline?.orderedUrls as string[] | undefined) : undefined;
    const picked = resp?.success ? (resp.result?.inline?.picked as Array<{ url: string; reason?: string }> | undefined) : undefined;
    const forcedCoverUrl = normalized[0];
    if (forcedCoverUrl) {
      logger.log(`封面固定使用第一张图片：${forcedCoverUrl}`, 'info');
    }
    const cleanedOrdered = (orderedUrls || [])
      .map(u => normalizeWeiboImageUrl(u))
      .filter(u => !!u) as string[];
    const cleanedPicked = (picked || [])
      .map(p => ({
        url: normalizeWeiboImageUrl(p?.url || ''),
        reason: typeof p?.reason === 'string' ? p.reason.trim() : ''
      }))
      .filter(p => !!p.url);

    if (cleanedOrdered.length > 0) {
      if (cleanedPicked.length > 0) {
        logger.log(`AI 选图（优先 ${Math.min(options.placeholders.length || 6, images.length)} 张）:`, 'info');
        cleanedPicked.slice(0, 10).forEach((p, idx) => {
          const reason = p.reason || '';
          logger.log(`  #${idx + 1}: ${p.url}${reason ? `（理由：${reason.slice(0, 120)}）` : ''}`, 'info');
        });
      } else {
        logger.log(`AI 选图排序结果: ${cleanedOrdered.slice(0, 10).join(' , ')}`, 'info');
      }
      const ranked = cleanedOrdered.filter(u => normalized.includes(u));
      const rest = normalized.filter(u => !ranked.includes(u));
      const combined = [...ranked, ...rest];
      const coverFirst = forcedCoverUrl && combined.includes(forcedCoverUrl) ? [forcedCoverUrl, ...combined.filter(u => u !== forcedCoverUrl)] : combined;
      return { orderedUrls: coverFirst, coverUrl: forcedCoverUrl };
    }
  } catch {
  }
  return { orderedUrls: normalized };
};

const waitForImageFileInput = async (timeout = 8000): Promise<HTMLInputElement | null> => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const inputs = Array.from(document.querySelectorAll('input[type="file"]')) as HTMLInputElement[];
    const candidate = inputs.find(input => {
      if (input.disabled) return false;
      const accept = (input.getAttribute('accept') || '').toLowerCase();
      if (accept && !accept.includes('image')) return false;
      return true;
    });
    if (candidate) return candidate;
    await new Promise(r => setTimeout(r, 200));
  }
  return null;
};

const tryClickLocalUploadMenu = async (): Promise<void> => {
  const uploadTexts = ['上传图片', '本地上传', '本地图片', '上传', '本地'];
  const elements = document.querySelectorAll('div, span, a, li, button');
  for (const el of elements) {
    const text = (el as HTMLElement).innerText?.trim();
    if (!text) continue;
    if (uploadTexts.includes(text) && isElementVisible(el as HTMLElement)) {
      simulateClick(el as HTMLElement);
      await new Promise(r => setTimeout(r, 500));
      break;
    }
  }
};

const setInputFiles = (input: HTMLInputElement, files: File[]) => {
  const dt = new DataTransfer();
  for (const f of files) dt.items.add(f);
  try {
    Object.defineProperty(input, 'files', { value: dt.files, configurable: true });
  } catch {
    try {
      (input as any).files = dt.files;
    } catch {
      return;
    }
  }
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
};

const setCursorToEditorEnd = (): boolean => {
  const editor = findElement(SELECTORS.editor);
  if (!editor) return false;
  editor.focus();
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  const sel = window.getSelection();
  if (!sel) return false;
  sel.removeAllRanges();
  sel.addRange(range);
  return true;
};

const setCursorToEditorStart = (): boolean => {
  const editor = findElement(SELECTORS.editor);
  if (!editor) return false;
  editor.focus();
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(true);
  const sel = window.getSelection();
  if (!sel) return false;
  sel.removeAllRanges();
  sel.addRange(range);
  return true;
};

const getEditorFromSelection = (): HTMLElement | null => {
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const el = container instanceof Element ? container : container.parentElement;
    const editable = el?.closest?.('[contenteditable="true"], .edui-body-container') as HTMLElement | null;
    if (editable) return editable;
  }
  return findElement(SELECTORS.editor);
};

const insertRemoteImageAtSelection = async (imageUrl: string, placeholderText?: string, originalUrl?: string): Promise<boolean> => {
  const editor = getEditorFromSelection();
  if (!editor) return false;
  const beforeImgs = Array.from(editor.querySelectorAll('img')) as HTMLImageElement[];
  const beforeSet = new Set(beforeImgs);

  try {
    const original = (originalUrl || imageUrl || '').trim();
    document.execCommand(
      'insertHTML',
      false,
      `<img src="${escapeHtmlAttr(imageUrl)}" data-memoraid-original="${escapeHtmlAttr(original)}" style="max-width:100%;height:auto;"/>`
    );
  } catch {
    return false;
  }

  editor.dispatchEvent(new Event('input', { bubbles: true }));
  editor.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 900));

  const waitForNewImageOk = async (): Promise<boolean> => {
    const start = Date.now();
    while (Date.now() - start < 6000) {
      const imgs = Array.from(editor.querySelectorAll('img')) as HTMLImageElement[];
      const newImg = imgs.find(i => !beforeSet.has(i));
      if (!newImg) {
        await new Promise(r => setTimeout(r, 200));
        continue;
      }
      const w = newImg.naturalWidth || newImg.width || newImg.clientWidth || 0;
      const h = newImg.naturalHeight || newImg.height || newImg.clientHeight || 0;
      if (newImg.complete && w > 0 && h > 0) {
        markImageOriginal(newImg, originalUrl || imageUrl);
        if (w >= 200 && h >= 150) return true;
        const parent = newImg.parentNode;
        const next = newImg.nextSibling;
        newImg.remove();
        if (placeholderText && parent) parent.insertBefore(document.createTextNode(placeholderText), next);
        return false;
      }
      await new Promise(r => setTimeout(r, 200));
    }
    const imgs = Array.from(editor.querySelectorAll('img')) as HTMLImageElement[];
    const newImg = imgs.find(i => !beforeSet.has(i));
    if (newImg) {
      const parent = newImg.parentNode;
      const next = newImg.nextSibling;
      newImg.remove();
      if (placeholderText && parent) parent.insertBefore(document.createTextNode(placeholderText), next);
    }
    return false;
  };

  return await waitForNewImageOk();
};

const getClickableForToolbarItem = (el: HTMLElement): HTMLElement => {
  const isClickable = (node: HTMLElement) => {
    const tag = node.tagName.toLowerCase();
    if (tag === 'button' || tag === 'a') return true;
    const role = node.getAttribute('role') || '';
    if (role.toLowerCase() === 'button') return true;
    const tabindex = node.getAttribute('tabindex');
    if (tabindex && tabindex !== '-1') return true;
    if (typeof (node as any).onclick === 'function') return true;
    return false;
  };

  if (isClickable(el)) return el;
  let cur: HTMLElement | null = el;
  for (let i = 0; i < 4; i++) {
    cur = cur.parentElement;
    if (!cur) break;
    if (isClickable(cur)) return cur;
  }
  return el;
};

const isToolbarItemActive = (el: HTMLElement): boolean => {
  const ariaPressed = (el.getAttribute('aria-pressed') || '').toLowerCase();
  const ariaSelected = (el.getAttribute('aria-selected') || '').toLowerCase();
  if (ariaPressed === 'true' || ariaSelected === 'true') return true;
  const cls = el.classList;
  return cls.contains('active') || cls.contains('selected') || cls.contains('is-active') || cls.contains('is-selected');
};

const clickWeixinImageAdaptive = async (img: HTMLImageElement): Promise<boolean> => {
  if (!img) return false;
  if (!isElementVisible(img)) return false;

  simulateClick(img);
  await new Promise(r => setTimeout(r, 250));

  const rect = img.getBoundingClientRect();
  const preferredLabels = ['自适应', '适应宽度', '适应', '自适应宽度'];
  for (const label of preferredLabels) {
    const all = findVisibleElementsByTextIncludes(label);
    if (all.length === 0) continue;
    const exact = all.filter(el => (el.innerText || '').trim() === label);
    if (label === '适应' && exact.length === 0) continue;
    const compact = (exact.length > 0 ? exact : all).filter(el => ((el.innerText || '').trim().length || 0) <= 12);
    const candidates = compact.length > 0 ? compact : (exact.length > 0 ? exact : all);

    const picked = pickClosestElementToRectCenter(candidates, rect);
    if (!picked) continue;
    const clickable = getClickableForToolbarItem(picked);
    if (isToolbarItemActive(clickable)) return true;
    simulateClick(clickable);
    await new Promise(r => setTimeout(r, 250));
    return true;
  }

  return false;
};

const clickWeixinAdaptiveForAllImagesInEditor = async (maxImages = 30): Promise<number> => {
  const editor = getEditorFromSelection();
  if (!editor) return 0;

  const imgs = Array.from(editor.querySelectorAll('img')) as HTMLImageElement[];
  let ok = 0;
  for (const img of imgs.slice(0, Math.max(0, maxImages))) {
    const success = await clickWeixinImageAdaptive(img);
    if (success) ok += 1;
    await new Promise(r => setTimeout(r, 350));
  }
  return ok;
};

const tryConfirmImageInsert = async (): Promise<void> => {
  const candidates = ['确定', '完成', '插入', '使用'];
  const dialogs = Array.from(document.querySelectorAll('.weui-desktop-dialog, [class*="dialog"], [class*="modal"]')) as HTMLElement[];
  const visibleDialogs = dialogs.filter(d => isElementVisible(d) && d.querySelector('button, a, div, span'));
  const scopes = visibleDialogs.length > 0 ? visibleDialogs : [document.body as unknown as HTMLElement];
  for (const scope of scopes) {
    const buttons = Array.from(scope.querySelectorAll('button, a, div')) as HTMLElement[];
    for (const btn of buttons) {
      const text = btn.innerText?.trim();
      if (!text) continue;
      if (!candidates.includes(text)) continue;
      if (!isElementVisible(btn)) continue;
      simulateClick(btn);
      await new Promise(r => setTimeout(r, 500));
      return;
    }
  }
};

const pasteImageFileToEditor = async (file: File): Promise<boolean> => {
  const editor = findElement(SELECTORS.editor);
  if (!editor) return false;
  const initialImgCount = editor.querySelectorAll('img').length;

  try {
    const dt = new DataTransfer();
    dt.items.add(file);
    editor.focus();
    const pasteEvent = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
    editor.dispatchEvent(pasteEvent);
  } catch {
    return false;
  }

  const start = Date.now();
  while (Date.now() - start < 3000) {
    const currentImgCount = editor.querySelectorAll('img').length;
    if (currentImgCount > initialImgCount) return true;
    await new Promise(r => setTimeout(r, 150));
  }
  return false;
};

const uploadImageFileToEditor = async (file: File, placeholderText?: string, originalUrl?: string): Promise<boolean> => {
  const editor = findElement(SELECTORS.editor);
  if (!editor) return false;
  const initialImgs = Array.from(editor.querySelectorAll('img')) as HTMLImageElement[];
  const initialSet = new Set(initialImgs);

  const pasted = await pasteImageFileToEditor(file);
  if (pasted) {
    const start = Date.now();
    while (Date.now() - start < 8000) {
      const imgs = Array.from(editor.querySelectorAll('img')) as HTMLImageElement[];
      const img = imgs.find(i => !initialSet.has(i));
      if (!img) {
        await new Promise(r => setTimeout(r, 200));
        continue;
      }
      const w = img.naturalWidth || img.width || img.clientWidth || 0;
      const h = img.naturalHeight || img.height || img.clientHeight || 0;
      if (img.complete && w > 0 && h > 0) {
        markImageOriginal(img, originalUrl);
        if (w >= 200 && h >= 150) return true;
        const parent = img.parentNode;
        const next = img.nextSibling;
        img.remove();
        if (placeholderText && parent) {
          parent.insertBefore(document.createTextNode(placeholderText), next);
        }
        return false;
      }
      await new Promise(r => setTimeout(r, 200));
    }

    const imgs = Array.from(editor.querySelectorAll('img')) as HTMLImageElement[];
    const img = imgs.find(i => !initialSet.has(i));
    if (img) {
      const parent = img.parentNode;
      const next = img.nextSibling;
      img.remove();
      if (placeholderText && parent) parent.insertBefore(document.createTextNode(placeholderText), next);
    }
    return false;
  }

  if (!await openImageDialog()) return false;
  await tryClickLocalUploadMenu();

  const input = await waitForImageFileInput(8000);
  if (!input) return false;
  setInputFiles(input, [file]);
  await new Promise(r => setTimeout(r, 800));
  await tryConfirmImageInsert();

  const start = Date.now();
  while (Date.now() - start < 20000) {
    const currentImgCount = editor.querySelectorAll('img').length;
    if (currentImgCount > initialImgs.length) {
      const imgs = Array.from(editor.querySelectorAll('img')) as HTMLImageElement[];
      const img = imgs.find(i => !initialSet.has(i)) || imgs[imgs.length - 1];
      const waitStart = Date.now();
      while (Date.now() - waitStart < 8000) {
        const w = img.naturalWidth || img.width || img.clientWidth || 0;
        const h = img.naturalHeight || img.height || img.clientHeight || 0;
        if (img.complete && w > 0 && h > 0) {
          markImageOriginal(img, originalUrl);
          if (w >= 200 && h >= 150) return true;
          const parent = img.parentNode;
          const next = img.nextSibling;
          img.remove();
          if (placeholderText && parent) {
            parent.insertBefore(document.createTextNode(placeholderText), next);
          }
          return false;
        }
        await new Promise(r => setTimeout(r, 200));
      }

      const parent = img.parentNode;
      const next = img.nextSibling;
      img.remove();
      if (placeholderText && parent) {
        parent.insertBefore(document.createTextNode(placeholderText), next);
      }
      return false;
    }
    if (Date.now() - start > 6000 && Date.now() - start < 7000) {
      await tryConfirmImageInsert();
    }
    await new Promise(r => setTimeout(r, 300));
  }
  return false;
};

const insertSourceImageForPlaceholder = async (
  placeholderText: string,
  imageUrl: string,
  referrer?: string
): Promise<boolean> => {
  if (!selectPlaceholderInEditor(placeholderText)) return false;
  await new Promise(r => setTimeout(r, 200));

  const normalizedUrl = normalizeWeiboImageUrl(imageUrl);
  if (!normalizedUrl) return false;
  const avoidHotlink = shouldAvoidHotlinkInsert(normalizedUrl);
  logger.log(`来源图片URL: ${imageUrl}`, 'info');
  if (normalizedUrl !== imageUrl) logger.log(`来源图片URL(规格提升): ${normalizedUrl}`, 'info');

  // 对于微博图片，直接使用 File 上传方式（绕过防盗链）
  if (avoidHotlink) {
    logger.log('检测到防盗链图片，直接使用 File 上传方式', 'info');
    const file = await fetchSourceImageFile(normalizedUrl, referrer);
    if (!file) return false;
    logger.log(`来源图片File已获取: name=${file.name}, size=${file.size}, type=${file.type}`, 'info');
    const ok = await uploadImageFileToEditor(file, placeholderText, normalizedUrl);
    await new Promise(r => setTimeout(r, 800));
    return ok;
  }

  // 对于非防盗链图片，尝试直接插入链接
  logger.log('尝试直接插入来源图片链接', 'info');
  const insertedByHtml = await insertRemoteImageAtSelection(normalizedUrl, placeholderText, normalizedUrl);
  if (insertedByHtml) {
    logger.log('来源图片链接插入成功', 'success');
    await new Promise(r => setTimeout(r, 1000));
    return true;
  }
  
  logger.log('来源图片链接插入失败，尝试插入 base64 图片', 'warn');
  const dataUrlResult = await fetchSourceImageDataUrl(normalizedUrl, referrer);
  if (dataUrlResult?.dataUrl) {
    logger.log(`来源图片base64已获取: mime=${dataUrlResult.mimeType}, len=${dataUrlResult.dataUrl.length}`, 'info');
    const insertedByDataUrl = await insertRemoteImageAtSelection(dataUrlResult.dataUrl, placeholderText, normalizedUrl);
    if (insertedByDataUrl) {
      logger.log('base64 图片插入成功', 'success');
      await new Promise(r => setTimeout(r, 1200));
      return true;
    }
  }

  logger.log('base64 插入失败，尝试上传图片', 'warn');
  const file = await fetchSourceImageFile(normalizedUrl, referrer);
  if (!file) return false;
  logger.log(`来源图片File已获取: name=${file.name}, size=${file.size}, type=${file.type}`, 'info');

  const ok = await uploadImageFileToEditor(file, placeholderText, normalizedUrl);
  await new Promise(r => setTimeout(r, 800));
  return ok;
};

const insertSourceImagesAtEnd = async (imageUrls: string[], maxInsert = 3, referrer?: string): Promise<number> => {
  if (!setCursorToEditorEnd()) return 0;
  let inserted = 0;
  for (const url of imageUrls.slice(0, maxInsert)) {
    const normalizedUrl = normalizeWeiboImageUrl(url);
    const avoidHotlink = shouldAvoidHotlinkInsert(normalizedUrl);
    logger.log(`来源图片URL: ${url}`, 'info');
    if (normalizedUrl !== url) logger.log(`来源图片URL(规格提升): ${normalizedUrl}`, 'info');

    // 对于防盗链图片，使用 R2 中转
    if (avoidHotlink) {
      logger.log(`检测到防盗链图片，尝试通过 R2 中转`, "info");
      try {
        const r2Url = await fetchImageViaR2(normalizedUrl, referrer);
        if (r2Url) {
          logger.log(`✅ R2 中转成功: ${r2Url}`, "info");
          const insertedByR2 = await insertRemoteImageAtSelection(r2Url, undefined, normalizedUrl);
          if (insertedByR2) {
            inserted += 1;
            await new Promise(r => setTimeout(r, 1000));
            continue;
          }
        }
      } catch (e: any) {
        logger.log(`R2 中转失败: ${e.message}`, "error");
      }
      
      // R2 失败后，回退到 File 上传
      const file = await fetchSourceImageFile(normalizedUrl, referrer);
      if (!file) continue;
      logger.log(`来源图片File已获取: name=${file.name}, size=${file.size}, type=${file.type}`, 'info');
      const ok = await uploadImageFileToEditor(file, undefined, normalizedUrl);
      if (ok) inserted += 1;
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }

    // 对于非防盗链图片，尝试直接插入
    const insertedByHtml = await insertRemoteImageAtSelection(normalizedUrl, undefined, normalizedUrl);
    if (insertedByHtml) {
      inserted += 1;
      await new Promise(r => setTimeout(r, 1000));
      continue;
    }

    // 尝试 base64 方式
    const dataUrlResult = await fetchSourceImageDataUrl(normalizedUrl, referrer);
    if (dataUrlResult?.dataUrl) {
      logger.log(`来源图片base64已获取: mime=${dataUrlResult.mimeType}, len=${dataUrlResult.dataUrl.length}`, 'info');
      const insertedByDataUrl = await insertRemoteImageAtSelection(dataUrlResult.dataUrl, undefined, normalizedUrl);
      if (insertedByDataUrl) {
        inserted += 1;
        await new Promise(r => setTimeout(r, 1200));
        continue;
      }
    }

    // 最后尝试 File 上传
    const file = await fetchSourceImageFile(normalizedUrl, referrer);
    if (!file) continue;
    logger.log(`来源图片File已获取: name=${file.name}, size=${file.size}, type=${file.type}`, 'info');
    const ok = await uploadImageFileToEditor(file, undefined, normalizedUrl);
    if (ok) inserted += 1;
    await new Promise(r => setTimeout(r, 2000));
  }
  return inserted;
};

const insertSourceImageAtEditorStart = async (imageUrl: string, referrer?: string): Promise<boolean> => {
  if (!setCursorToEditorStart()) return false;
  const normalizedUrl = normalizeWeiboImageUrl(imageUrl);
  const avoidHotlink = shouldAvoidHotlinkInsert(normalizedUrl);
  logger.log(`来源图片URL: ${imageUrl}`, 'info');
  if (normalizedUrl !== imageUrl) logger.log(`来源图片URL(规格提升): ${normalizedUrl}`, 'info');

  // 对于防盗链图片，使用 R2 中转
  if (avoidHotlink) {
    logger.log(`检测到防盗链图片，尝试通过 R2 中转`, "info");
    try {
      const r2Url = await fetchImageViaR2(normalizedUrl, referrer);
      if (r2Url) {
        logger.log(`✅ R2 中转成功: ${r2Url}`, "info");
        const insertedByR2 = await insertRemoteImageAtSelection(r2Url, undefined, normalizedUrl);
        if (insertedByR2) {
          await new Promise(r => setTimeout(r, 1000));
          return true;
        }
      }
    } catch (e: any) {
      logger.log(`R2 中转失败: ${e.message}`, "error");
    }
    
    // R2 失败后，回退到 File 上传
    const file = await fetchSourceImageFile(normalizedUrl, referrer);
    if (!file) return false;
    logger.log(`来源图片File已获取: name=${file.name}, size=${file.size}, type=${file.type}`, 'info');
    const ok = await uploadImageFileToEditor(file, undefined, normalizedUrl);
    await new Promise(r => setTimeout(r, 800));
    return ok;
  }

  // 对于非防盗链图片，尝试直接插入
  const insertedByHtml = await insertRemoteImageAtSelection(normalizedUrl, undefined, normalizedUrl);
  if (insertedByHtml) {
    await new Promise(r => setTimeout(r, 1000));
    return true;
  }

  // 尝试 base64 方式
  const dataUrlResult = await fetchSourceImageDataUrl(normalizedUrl, referrer);
  if (dataUrlResult?.dataUrl) {
    logger.log(`来源图片base64已获取: mime=${dataUrlResult.mimeType}, len=${dataUrlResult.dataUrl.length}`, 'info');
    const insertedByDataUrl = await insertRemoteImageAtSelection(dataUrlResult.dataUrl, undefined, normalizedUrl);
    if (insertedByDataUrl) {
      await new Promise(r => setTimeout(r, 1200));
      return true;
    }
  }

  // 最后尝试 File 上传
  const file = await fetchSourceImageFile(normalizedUrl, referrer);
  if (!file) return false;
  if (!file) return false;
  logger.log(`来源图片File已获取: name=${file.name}, size=${file.size}, type=${file.type}`, 'info');
  const ok = await uploadImageFileToEditor(file, undefined, normalizedUrl);
  await new Promise(r => setTimeout(r, 800));
  return ok;
};

/**
 * 获取当前文章标题
 */
const getArticleTitle = (): string => {
  const titleEl = findElement(SELECTORS.titleInput);
  if (titleEl instanceof HTMLInputElement) {
    return titleEl.value || '';
  }
  return titleEl?.innerText || '';
};

/**
 * 获取当前文章内容
 */
const getArticleContent = (): string => {
  const editor = findElement(SELECTORS.editor);
  return editor?.innerText || '';
};

const waitForEditorCoverCandidatesReady = async (minCount: number, timeout = 25000): Promise<boolean> => {
  const start = Date.now();
  const required = Math.max(1, Math.floor(minCount || 1));
  while (Date.now() - start < timeout) {
    const editor = findElement(SELECTORS.editor);
    const scope = editor || document.body;
    const imgs = Array.from(scope.querySelectorAll('img')) as HTMLImageElement[];
    const ready = imgs.filter(img => {
      const src = (img.getAttribute('src') || '').trim();
      const dataSrc = (img.getAttribute('data-src') || img.getAttribute('data-original') || '').trim();
      const u = src || dataSrc;
      if (!u) return false;
      if (u.startsWith('data:')) return false;
      if (u.startsWith('blob:')) return false;
      if (u === 'about:blank') return false;
      return true;
    });
    if (ready.length >= required) return true;
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
};

// ============================================
// 主流程 - 基于 Playwright 录制
// ============================================

/**
 * 完整的发布流程
 * 基于 Playwright 录制的操作步骤
 */
const runPublishFlow = async (options: {
  title: string;
  content: string;
  htmlContent?: string;
  authorName?: string;
  generateAI?: boolean;
  aiPrompt?: string;
  imageSource?: 'source' | 'platform';
  sourceImages?: string[];
  sourceUrl?: string;
  autoPreview?: boolean;
  autoPublish?: boolean;  // 是否自动发布
}) => {
  isFlowCancelled = false;
  // logger.clear();
  logger.show();
  logger.setStopCallback(() => { isFlowCancelled = true; });
  logger.log('🚀 开始微信公众号发布流程...', 'info');
  
  try {
    // 1. 填充标题
    // Playwright: await page1.getByRole('textbox', { name: '请在这里输入标题' }).click();
    // Playwright: await page1.getByRole('textbox', { name: '请在这里输入标题' }).fill('这里是标题，最多64字');
    logger.log('📝 步骤1: 填充标题', 'info');
    if (!await fillTitle(options.title)) {
      logger.log('标题填充失败', 'error');
      return;
    }
    if (isFlowCancelled) return;
    
    await new Promise(r => setTimeout(r, 500));
    
    // 2. 填充正文
    // Playwright: await page1.locator('div').filter({ hasText: /^从这里开始写正文$/ }).nth(5).click();
    // Playwright: await page1.locator('div').filter({ hasText: /^从这里开始写正文$/ }).nth(5).fill('从这里开始写正文\nv');
    logger.log('📝 步骤2: 填充正文', 'info');
    if (!await fillContent(options.content, options.htmlContent)) {
      logger.log('正文填充失败', 'error');
      return;
    }
    if (isFlowCancelled) return;
    
    await new Promise(r => setTimeout(r, 1000));
    
    // 3. 插入配图
    let shouldFallbackToAI = false;
    if (options.imageSource === 'source') {
      logger.log('🖼️ 步骤3: 插入素材来源页面图片', 'info');
      
      // 查找文章中的图片占位符
      const placeholders = findImagePlaceholders();
      let sourceImages = (options.sourceImages || []).map(u => normalizeWeiboImageUrl(u)).filter(u => !!u) as string[];
      
      if (sourceImages.length === 0) {
        logger.log('未找到可用的来源图片，将回退到 AI 配图', 'warn');
        shouldFallbackToAI = true;
      } else if (placeholders.length > 0) {
        const analyzed = await analyzeSourceImagesWithAIOnce({
          title: options.title,
          content: options.content,
          placeholders,
          sourceImages,
          sourceUrl: options.sourceUrl
        });
        sourceImages = analyzed.orderedUrls;
        if (sourceImages.length > 0) {
          const coverCandidate = sourceImages[0];
          const coverInserted = await insertSourceImageAtEditorStart(coverCandidate, options.sourceUrl);
          if (coverInserted) {
            sourceImages = sourceImages.slice(1);
          }
        }
        logger.log(`找到 ${placeholders.length} 个图片占位符，开始逐个处理...`, 'info');
        let insertedAny = false;
        let sourceIndex = 0;
        const failedPlaceholders = new Set<string>();
        if (sourceImages.length < placeholders.length) {
          logger.log(`来源图片数量不足（${sourceImages.length} 张），剩余占位符将回退 AI 配图`, 'warn');
          shouldFallbackToAI = true;
        }
        
        for (let i = 0; i < placeholders.length; i++) {
          if (isFlowCancelled) return;
          
          const currentPlaceholders = findImagePlaceholders();
          const placeholder = currentPlaceholders.find(p => !failedPlaceholders.has(p.text)) || currentPlaceholders[0];
          if (!placeholder) break;
          logger.log(`📷 处理第 ${i + 1}/${placeholders.length} 张来源图片`, 'info');

          let success = false;
          for (let attempt = 0; attempt < 2; attempt++) {
            const imgUrl = sourceImages[sourceIndex];
            if (!imgUrl) {
              logger.log('来源图片已用尽，剩余占位符将回退 AI 配图', 'warn');
              shouldFallbackToAI = true;
              break;
            }
            logger.log(`使用来源图片 ${sourceIndex + 1}/${sourceImages.length}`, 'info');
            success = await insertSourceImageForPlaceholder(placeholder.text, imgUrl, options.sourceUrl);
            sourceIndex += 1;
            if (success) break;
            await new Promise(r => setTimeout(r, 1200));
          }
          
          if (success) {
            logger.log(`✅ 第 ${i + 1} 张图片插入成功`, 'success');
            insertedAny = true;
          } else {
            logger.log(`⚠️ 第 ${i + 1} 张图片处理失败，继续下一个`, 'warn');
            failedPlaceholders.add(placeholder.text);
          }
          
          // 等待一段时间再处理下一个，避免操作过快
          if (i < placeholders.length - 1) {
            await new Promise(r => setTimeout(r, success ? 3500 : 2500));
          }
        }
        
        logger.log(`图片处理完成，共处理 ${placeholders.length} 个占位符，消耗 ${Math.min(sourceIndex, sourceImages.length)} 张来源图片`, 'success');
        const remaining = findImagePlaceholders();
        if (remaining.length > 0) {
          logger.log(`仍有 ${remaining.length} 个占位符未填充，将回退 AI 配图`, 'warn');
          shouldFallbackToAI = true;
        }
        if (!insertedAny) {
          logger.log('未成功插入任何来源图片，将回退到 AI 配图', 'warn');
          shouldFallbackToAI = true;
        }
      } else {
        if (sourceImages.length > 0) {
          const coverCandidate = sourceImages[0];
          const coverInserted = await insertSourceImageAtEditorStart(coverCandidate, options.sourceUrl);
          const rest = coverInserted ? sourceImages.slice(1) : sourceImages;
          const inserted = await insertSourceImagesAtEnd(rest, 2, options.sourceUrl);
          if (inserted > 0) {
            logger.log(`✅ 已在文章末尾插入 ${inserted} 张来源图片`, 'success');
          } else if (coverInserted) {
            logger.log('✅ 已插入封面来源图片到正文开头', 'success');
          } else {
            logger.log('⚠️ 插入来源图片失败，将回退到 AI 配图', 'warn');
            shouldFallbackToAI = true;
          }
        }
      }
    } 

    // 3. 生成 AI 配图（如果启用）
    // 支持多个图片占位符，为每个占位符生成不同的 AI 图片
    if (options.generateAI !== false && (options.imageSource !== 'source' || shouldFallbackToAI)) {
      logger.log('🎨 步骤3: 生成 AI 配图', 'info');
      
      // 查找文章中的图片占位符
      const placeholders = findImagePlaceholders();
      
      if (placeholders.length > 0) {
        logger.log(`找到 ${placeholders.length} 个图片占位符，开始逐个处理...`, 'info');
        
        for (let i = 0; i < placeholders.length; i++) {
          if (isFlowCancelled) return;
          
          const placeholder = placeholders[i];
          logger.log(`📷 处理第 ${i + 1}/${placeholders.length} 个图片: ${placeholder.keyword}`, 'info');
          
          const success = await generateAndInsertImageForPlaceholder(placeholder, options.title, options.content);
          
          if (success) {
            logger.log(`✅ 第 ${i + 1} 张图片插入成功`, 'success');
          } else {
            logger.log(`⚠️ 第 ${i + 1} 张图片处理失败，继续下一个`, 'warn');
          }
          
          if (i < placeholders.length - 1) {
            await new Promise(r => setTimeout(r, 2000));
          }
        }
        
        logger.log(`图片处理完成，共处理 ${placeholders.length} 个占位符`, 'success');
      } else {
        logger.log('未找到图片占位符，生成一张通用配图', 'info');
        
        if (!await openImageDialog()) {
          logger.log('无法打开图片对话框，跳过 AI 配图', 'warn');
        } else {
          if (isFlowCancelled) return;
          
          if (!await clickAIImage()) {
            logger.log('无法点击 AI 配图，跳过', 'warn');
          } else {
            if (isFlowCancelled) return;
            
            const aiPrompt = options.aiPrompt || generateImagePrompt(options.title, options.content);
            logger.log(`AI 提示词: ${aiPrompt}`, 'info');
            
            if (await generateAIImage(aiPrompt)) {
              if (isFlowCancelled) return;
              await insertAIImage();
            }
          }
        }
      }
    }
    if (isFlowCancelled) return;
    
    await new Promise(r => setTimeout(r, 1000));

    logger.log('🧭 步骤3.5: 尝试对正文图片点击“自适应”', 'info');
    const adaptTriggered = await clickWeixinAdaptiveForAllImagesInEditor();
    if (adaptTriggered > 0) {
      logger.log(`已触发“自适应”操作 ${adaptTriggered} 次`, 'success');
    } else {
      logger.log('未找到可用的“自适应”按钮或无需处理', 'warn');
    }
    
    // 4. 设置封面（直接从正文选择，更可靠）
    // 因为正文已经有 AI 生成的图片了，直接从正文选择作为封面更稳定
    const coverReady = await waitForEditorCoverCandidatesReady(1, 25000);
    if (!coverReady) {
      logger.log('⚠️ 正文图片可能仍在上传，封面弹窗可能无法显示刚插入的图片', 'warn');
    }
    logger.log('🖼️ 步骤4: 设置封面图片（从正文选择）', 'info');
    await setCoverFromContent({ preferredIndex: 0 });
    if (isFlowCancelled) return;
    
    await new Promise(r => setTimeout(r, 1000));
    
    // 4.5 填充封面摘要（如果有）
    // 从文章内容中提取 [摘要: xxx] 格式的摘要
    const summaryData = extractSummary(options.content);
    if (summaryData) {
      logger.log('📝 步骤4.5: 填充封面摘要', 'info');
      await fillCoverSummary(summaryData.summary);
    }
    if (isFlowCancelled) return;
    
    await new Promise(r => setTimeout(r, 500));
    
    // 5. 声明原创
    // Playwright: await page1.getByText('未声明').click();
    // Playwright: await page1.locator('#js_original_edit_box').getByRole('textbox', { name: '请输入作者' }).click();
    // Playwright: await page1.locator('#js_original_edit_box').getByRole('textbox', { name: '请输入作者' }).fill('黄刚');
    // Playwright: await page1.getByRole('button', { name: '确定' }).click();
    if (options.authorName) {
      logger.log('✍️ 步骤5: 声明原创', 'info');
      await declareOriginal(options.authorName);
    }
    if (isFlowCancelled) return;
    
    await new Promise(r => setTimeout(r, 1000));
    
    // 6. 预览（可选）
    // Playwright: await page1.getByRole('button', { name: '预览' }).click();
    // Playwright: await page1.getByRole('button', { name: '取消' }).click();
    if (options.autoPreview) {
      logger.log('👁️ 步骤6: 预览文章', 'info');
      await clickPreview();
      await new Promise(r => setTimeout(r, 3000));
      await cancelPreview();
    }
    if (isFlowCancelled) return;
    
    // 7. 自动发布（可选）
    // Playwright: await page1.getByRole('button', { name: '发表' }).click();
    // Playwright: await page1.locator('#vue_app').getByRole('button', { name: '发表' }).click();
    if (options.autoPublish) {
      logger.log('📤 步骤7: 自动发布文章', 'info');
      const published = await publishArticle();
      if (published) {
        logger.log('🎉 文章已发布！', 'success');
      } else {
        logger.log('自动发布失败：未检测到发布成功', 'error');
      }
    } else {
      logger.log('✅ 公众号文章准备完成！请检查后手动发布', 'success');
    }
    
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    logger.log(`❌ 流程错误: ${errorMsg}`, 'error');
  } finally {
    logger.hideStopButton();
  }
};

/**
 * 智能图片处理流程
 * 处理文章中的图片占位符，使用 AI 生成配图
 * 图片会插入到占位符的位置，替换占位符文本
 */
const runSmartImageFlow = async (_autoPublish = false) => {
  isFlowCancelled = false;
  // logger.clear();
  logger.show();
  logger.setStopCallback(() => { isFlowCancelled = true; });
  logger.log('🚀 开始智能图片处理...', 'info');
  
  try {
    // 查找图片占位符
    const placeholders = findImagePlaceholders();
    
    if (placeholders.length === 0) {
      logger.log('未找到图片占位符，尝试生成一张配图', 'info');
      
      // 获取标题作为提示词
      const titleEl = findElement(SELECTORS.titleInput);
      const title = titleEl instanceof HTMLInputElement ? titleEl.value : (titleEl?.innerText || '');
      
      if (title) {
        const prompt = generateImagePrompt(title, '');
        
        if (await openImageDialog()) {
          if (await clickAIImage()) {
            if (await generateAIImage(prompt)) {
              await insertAIImage();
              logger.log('✅ AI 配图插入成功', 'success');
            }
          }
        }
      }
    } else {
      logger.log(`找到 ${placeholders.length} 个图片占位符`, 'info');
      
      let successCount = 0;
      
      for (let i = 0; i < placeholders.length; i++) {
        if (isFlowCancelled) break;
        
        const placeholder = placeholders[i];
        logger.log(`📷 处理第 ${i + 1}/${placeholders.length} 个: ${placeholder.keyword}`, 'info');
        
        // 使用新的函数处理每个占位符
        const success = await generateAndInsertImageForPlaceholder(placeholder);
        
        if (success) {
          successCount++;
          logger.log(`✅ 第 ${i + 1} 张图片插入成功`, 'success');
        } else {
          logger.log(`⚠️ 第 ${i + 1} 张图片处理失败`, 'warn');
        }
        
        // 等待一段时间再处理下一个
        if (i < placeholders.length - 1) {
          await new Promise(r => setTimeout(r, 2000));
        }
      }
      
      logger.log(`图片处理完成: ${successCount}/${placeholders.length} 成功`, 'info');
    }
    
    // 设置封面（直接从正文选择，更可靠）
    logger.log('🖼️ 设置封面图片（从正文选择）...', 'info');
    await setCoverFromContent({ preferredIndex: 0 });
    
    logger.log('✅ 图片处理完成！', 'success');
    
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    logger.log(`❌ 流程错误: ${errorMsg}`, 'error');
  } finally {
    logger.hideStopButton();
  }
};

// ============================================
// 页面导航和登录检测
// ============================================

/**
 * 检测当前页面状态
 * @returns 'login' | 'home' | 'editor' | 'unknown'
 */
const detectPageState = (): 'login' | 'home' | 'editor' | 'unknown' => {
  const url = window.location.href;
  
  // 检测是否在登录页面或需要登录
  const loginIndicators = [
    document.querySelector('#jumpUrl'), // 登录跳转链接
    document.querySelector('a[href*="登录"]'),
    document.querySelector('.page_error_msg'), // 错误页面
  ];
  
  const needsLogin = loginIndicators.some(el => el !== null) || 
    document.body.innerText?.includes('请重新登录') ||
    document.body.innerText?.includes('请先登录');
  
  if (needsLogin) {
    return 'login';
  }
  
  // 检测是否在编辑页面
  if (url.includes('appmsg_edit') || url.includes('appmsg?t=media/appmsg_edit')) {
    return 'editor';
  }
  
  // 检测是否在首页（有"新的创作"区域）
  const homeIndicators = [
    document.querySelector('.new-creation_menu'),
    document.querySelector('.new-creation__menu-item'),
    document.querySelector('.new-creation_menuitem'),
    findElementByText('新的创作'),
    findElementByText('文章'),  // 首页有"文章"按钮
  ];
  
  if (homeIndicators.some(el => el !== null)) {
    return 'home';
  }
  
  return 'unknown';
};

/**
 * 点击"文章"按钮进入编辑页面
 */
const clickArticleButton = async (): Promise<boolean> => {
  logger.log('查找"文章"按钮...', 'info');
  
  // 方法1: 通过文本查找 "文章"
  let articleBtn = findElementByText('文章', ['div', 'span', 'a', 'button']);
  
  // 方法2: 通过类名查找（新的创作区域的第一个菜单项是"文章"）
  if (!articleBtn) {
    const menuItems = document.querySelectorAll('.new-creation__menu-item, .new-creation_menu-item, .new-creation_menuitem');
    if (menuItems.length > 0) {
      // 第一个通常是"文章"
      for (const item of menuItems) {
        const text = (item as HTMLElement).innerText?.trim();
        if (text === '文章' || text?.includes('文章')) {
          articleBtn = item as HTMLElement;
          break;
        }
      }
      // 如果没找到包含"文章"的，就用第一个
      if (!articleBtn && menuItems.length > 0) {
        articleBtn = menuItems[0] as HTMLElement;
      }
    }
  }
  
  // 方法3: 查找包含"文章"文本的可点击元素
  if (!articleBtn) {
    const allElements = document.querySelectorAll('div, span, a');
    for (const el of allElements) {
      const text = (el as HTMLElement).innerText?.trim();
      if (text === '文章' && isElementVisible(el as HTMLElement)) {
        // 检查是否在"新的创作"区域内
        const parent = el.closest('.new-creation_menu, .weui-desktop-panel');
        if (parent) {
          articleBtn = el as HTMLElement;
          break;
        }
      }
    }
  }
  
  if (!articleBtn) {
    logger.log('未找到"文章"按钮', 'error');
    return false;
  }
  
  logger.log('点击"文章"按钮', 'action');
  simulateClick(articleBtn);
  
  // 等待页面跳转
  await new Promise(r => setTimeout(r, 3000));
  
  return true;
};

/**
 * 等待页面加载完成并检测状态
 */
const waitForPageReady = async (maxWait = 10000): Promise<'login' | 'home' | 'editor' | 'unknown'> => {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWait) {
    const state = detectPageState();
    if (state !== 'unknown') {
      return state;
    }
    await new Promise(r => setTimeout(r, 500));
  }
  
  return 'unknown';
};

// ============================================
// 自动填充逻辑
// ============================================

const autoFillContent = async () => {
  try {
    const data = await chrome.storage.local.get('pending_weixin_publish');
    if (!data || !data.pending_weixin_publish) return;
    
    const payload: PublishData = data.pending_weixin_publish;
    if (Date.now() - payload.timestamp > 5 * 60 * 1000) {
      chrome.storage.local.remove('pending_weixin_publish');
      return;
    }

    const settings = await chrome.storage.sync.get(['autoPublishAll', 'weixin']);
    const authorName = settings.weixin?.authorName || '';
    const autoPublish = settings.autoPublishAll === true
      ? true
      : settings.autoPublishAll === false
      ? false
      : settings.weixin?.autoPublish !== false;
    // 默认不优先使用素材来源图片，使用平台图片
    const imageSource: 'source' | 'platform' = 'platform';

    logger.log(`📄 准备填充内容: ${payload.title}`, 'info');
    logger.log('⏳ 检测页面状态...', 'info');

    // 等待页面加载
    await new Promise(r => setTimeout(r, 2000));
    
    // 检测页面状态
    let pageState = await waitForPageReady(15000);
    logger.log(`页面状态: ${pageState}`, 'info');
    
    // 如果需要登录，提示用户
    if (pageState === 'login') {
      logger.log('⚠️ 请先登录微信公众平台', 'warn');
      logger.log('登录后页面会自动刷新，届时将继续填充内容', 'info');
      // 不清除 pending 数据，等用户登录后刷新页面再继续
      return;
    }
    
    // 如果在首页，点击"文章"按钮
    if (pageState === 'home') {
      logger.log('📍 当前在首页，正在进入文章编辑页面...', 'info');
      
      if (await clickArticleButton()) {
        // 等待页面跳转
        await new Promise(r => setTimeout(r, 3000));
        
        // 重新检测状态
        pageState = await waitForPageReady(10000);
        logger.log(`跳转后页面状态: ${pageState}`, 'info');
      } else {
        logger.log('❌ 无法进入编辑页面，请手动点击"文章"按钮', 'error');
        return;
      }
    }
    
    // 如果还不是编辑页面，等待更长时间
    if (pageState !== 'editor') {
      logger.log('⏳ 等待编辑器加载...', 'info');
      
      let attempts = 0;
      const maxAttempts = 20;
      
      const waitForEditor = async (): Promise<boolean> => {
        const titleEl = findElement(SELECTORS.titleInput);
        const editorEl = findElement(SELECTORS.editor);
        return !!(titleEl || editorEl);
      };
      
      while (attempts < maxAttempts) {
        if (await waitForEditor()) {
          break;
        }
        attempts++;
        await new Promise(r => setTimeout(r, 1500));
      }
      
      if (attempts >= maxAttempts) {
        logger.log('❌ 等待编辑器超时', 'error');
        return;
      }
    }
    
    // 等待编辑器完全加载
    await new Promise(r => setTimeout(r, 2000));
    
    // 运行完整发布流程
    await runPublishFlow({
      title: payload.title,
      content: payload.content,
      htmlContent: payload.htmlContent,
      authorName: authorName,
      generateAI: true,
      imageSource,
      sourceImages: payload.sourceImages,
      sourceUrl: payload.sourceUrl,
      autoPublish: autoPublish,
      autoPreview: false
    });
    
    chrome.storage.local.remove('pending_weixin_publish');

  } catch (error) {
    console.error('Memoraid: 微信公众号填充内容错误', error);
    logger.log(`❌ 填充错误: ${error}`, 'error');
  }
};

const installPublishReporting = () => {
  let hasReported = false;
  const armKey = 'memoraid_weixin_publish_armed_v1';

  const getCurrentTitle = (): string => {
    const titleEl = findElement(SELECTORS.titleInput);
    if (!titleEl) return '';
    return titleEl instanceof HTMLInputElement || titleEl instanceof HTMLTextAreaElement
      ? (titleEl.value || '').trim()
      : (titleEl.innerText || '').trim();
  };

  const reportOnce = (status: string, trigger: string, publishedUrl: string, titleText?: string) => {
    if (hasReported) return;
    hasReported = true;
    reportArticlePublish({
      platform: 'weixin',
      title: (titleText || getCurrentTitle() || document.title || '未命名文章').trim(),
      url: publishedUrl,
      status,
      extra: { trigger }
    });
  };

  const normalizeUrl = (href: string): string => {
    try {
      return new URL(href, window.location.href).toString();
    } catch {
      return href;
    }
  };

  const findPublishedUrl = (): string | null => {
    const links = Array.from(document.querySelectorAll('a[href]')) as HTMLAnchorElement[];
    for (const a of links) {
      const href = a.getAttribute('href') || '';
      if (!href) continue;
      const abs = normalizeUrl(href);
      if (abs.includes('mp.weixin.qq.com/s?') || abs.includes('mp.weixin.qq.com/s/')) {
        return abs;
      }
    }

    const anyText = document.body?.innerText || '';
    const match = anyText.match(/https?:\/\/mp\.weixin\.qq\.com\/s(?:\?|\/)[^\s"']+/);
    if (match?.[0]) {
      const url = match[0].split(/\s/)[0];
      return url;
    }
    return null;
  };

  const getArmedInfo = (): { ts: number; trigger?: string; title?: string } | null => {
    try {
      const raw = sessionStorage.getItem(armKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { ts?: number; trigger?: string; title?: string } | null;
      if (!parsed?.ts) return null;
      return { ts: parsed.ts, trigger: parsed.trigger, title: parsed.title };
    } catch {
      return null;
    }
  };

  const isArmed = (): boolean => {
    const info = getArmedInfo();
    if (!info) return false;
    return Date.now() - info.ts < 10 * 60 * 1000;
  };

  const arm = (trigger: string) => {
    try {
      sessionStorage.setItem(armKey, JSON.stringify({ ts: Date.now(), trigger, title: getCurrentTitle() }));
    } catch {
    }
  };

  const disarm = () => {
    try {
      sessionStorage.removeItem(armKey);
    } catch {
    }
  };

  const maybeReport = (trigger: string) => {
    if (!isArmed() || hasReported) return;
    const publishedUrl = findPublishedUrl();
    if (publishedUrl) {
      reportOnce('published', trigger, publishedUrl);
      disarm();
    }
  };

  const pageUrl = normalizeUrl(window.location.href);
  const isPublishedArticlePage =
    pageUrl.includes('mp.weixin.qq.com/s?') || pageUrl.includes('mp.weixin.qq.com/s/');
  if (isPublishedArticlePage) {
    if (isArmed()) {
      reportOnce('published', 'page:published_url', pageUrl);
      disarm();
    }
    return;
  }

  const findRecentPublishedInfo = (): { url: string; title: string } | null => {
    const armed = getArmedInfo();
    const expectedTitle = (armed?.title || '').trim();

    const links = Array.from(document.querySelectorAll('a[href]')) as HTMLAnchorElement[];
    const candidates: HTMLAnchorElement[] = [];
    for (const a of links) {
      const href = a.getAttribute('href') || '';
      if (!href) continue;
      const abs = normalizeUrl(href);
      if (!abs.includes('mp.weixin.qq.com/s?') && !abs.includes('mp.weixin.qq.com/s/')) continue;
      if (!(a as any).offsetParent && !(a.getClientRects?.().length)) continue;
      let cur: HTMLElement | null = a;
      let withinRecent = false;
      for (let i = 0; i < 6 && cur; i++) {
        const text = (cur.innerText || cur.textContent || '').trim();
        if (text.includes('近期发表')) {
          withinRecent = true;
          break;
        }
        cur = cur.parentElement;
      }
      if (withinRecent) candidates.push(a);
    }

    const pickTitle = (a: HTMLAnchorElement): string => {
      const t1 = (a.getAttribute('title') || '').trim();
      if (t1) return t1;
      const t2 = (a.innerText || '').trim();
      if (t2) return t2;
      const item = a.closest('li, [class*="list"], [class*="item"], [class*="card"], [class*="publish"], [class*="recent"]') as HTMLElement | null;
      if (item) {
        const titleEl = item.querySelector('[class*="title"], [data-title], h1, h2, h3') as HTMLElement | null;
        const t3 = (titleEl?.innerText || '').trim();
        if (t3) return t3;
        const t4 = (item.innerText || '').trim();
        if (t4) return t4.split('\n')[0].trim();
      }
      return '';
    };

    const isGood = (t: string) => t && t.length >= 2 && !t.includes('已发表') && !t.includes('今日');

    if (expectedTitle) {
      const hit = candidates.find((a) => {
        const t = pickTitle(a);
        return t.includes(expectedTitle) || expectedTitle.includes(t);
      });
      if (hit) {
        const abs = normalizeUrl(hit.getAttribute('href') || '');
        const title = pickTitle(hit) || expectedTitle;
        return { url: abs, title };
      }
    }

    if (candidates.length) {
      const first = candidates[0];
      const abs = normalizeUrl(first.getAttribute('href') || '');
      const title = pickTitle(first);
      if (abs && isGood(title)) return { url: abs, title };
      if (abs) return { url: abs, title: title || expectedTitle || document.title || '未命名文章' };
    }

    return null;
  };

  const maybeReportFromHome = (trigger: string) => {
    if (!isArmed() || hasReported) return;
    const info = findRecentPublishedInfo();
    if (!info?.url) return;
    reportOnce('published', trigger, info.url, info.title);
    disarm();
  };

  if (detectPageState() === 'home' && isArmed()) {
    setTimeout(() => maybeReportFromHome('home:recent_initial'), 1200);
  }

  if (detectPageState() === 'editor') {
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null;
      const btn = target?.closest?.('button') as HTMLElement | null;
      if (!btn) return;
      const text = (btn.innerText || '').trim();
      if (!text) return;
      if (text === '发表' || text.includes('发表')) {
        arm('click:publish');
        setTimeout(() => maybeReport('click:publish'), 1500);
        return;
      }
      if (text.includes('继续发表')) {
        arm('click:continue_publish');
        setTimeout(() => maybeReport('click:continue_publish'), 1500);
      }
    }, true);
  }

  const observer = new MutationObserver((mutations) => {
    if (hasReported) return;
    if (!isArmed()) return;
    for (const m of mutations) {
      if (m.addedNodes.length) {
        maybeReport('dom:mutation');
        maybeReportFromHome('home:dom_mutation');
        if (hasReported) return;
      }
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });

  setTimeout(() => {
    if (hasReported) return;
    maybeReport('page:initial_scan');
  }, 1500);
};

// ============================================
// 初始化
// ============================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => autoFillContent());
} else {
  autoFillContent();
}

installPublishReporting();

// 导出供外部调用
(window as any).memoraidWeixinRunFlow = runPublishFlow;
(window as any).memoraidWeixinRunImageFlow = runSmartImageFlow;
(window as any).memoraidWeixinFillTitle = fillTitle;
(window as any).memoraidWeixinFillContent = fillContent;
(window as any).memoraidWeixinGenerateAI = generateAIImage;
(window as any).memoraidWeixinSetCover = setCoverFromContent;
(window as any).memoraidWeixinDeclareOriginal = declareOriginal;
(window as any).memoraidWeixinPreview = clickPreview;
(window as any).memoraidWeixinPublish = publishArticle;

// 消息监听
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'WEIXIN_RUN_FLOW') {
    runPublishFlow(message.payload);
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'WEIXIN_RUN_IMAGE_FLOW') {
    runSmartImageFlow();
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'WEIXIN_GENERATE_AI_IMAGE') {
    (async () => {
      if (await openImageDialog()) {
        if (await clickAIImage()) {
          await generateAIImage(message.prompt);
          await insertAIImage();  // 选择最后一张（最新生成的）
        }
      }
    })();
    sendResponse({ success: true });
    return true;
  }
});

// ============================================
// 远程调试功能
// ============================================
import { showDebugPanel, startDebugSession, stopDebugSession, getDebugSessionStatus } from '../utils/remoteDebug';

// 导出远程调试功能到全局
(window as any).memoraidDebug = {
  showPanel: showDebugPanel,
  start: startDebugSession,
  stop: stopDebugSession,
  status: getDebugSessionStatus
};

// 监听调试消息
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SHOW_DEBUG_PANEL') {
    showDebugPanel();
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'START_DEBUG_SESSION') {
    startDebugSession().then(code => {
      sendResponse({ success: true, verificationCode: code });
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }
  
  if (message.type === 'STOP_DEBUG_SESSION') {
    stopDebugSession().then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
});

console.log(`
📱 Memoraid 微信公众号助手已加载

可用命令：
  memoraidWeixinRunFlow({title, content, authorName, generateAI, autoPublish})  - 运行完整发布流程
  memoraidWeixinRunImageFlow()           - 运行智能图片处理
  memoraidWeixinFillTitle('标题')         - 填充标题
  memoraidWeixinFillContent('内容')       - 填充正文
  memoraidWeixinGenerateAI('提示词')      - 生成 AI 配图
  memoraidWeixinSetCover()               - 设置封面（从正文选择）
  memoraidWeixinDeclareOriginal('作者')   - 声明原创
  memoraidWeixinPreview()                - 预览文章
  memoraidWeixinPublish()                - 发布文章

🔧 远程调试命令：
  memoraidDebug.showPanel()              - 显示调试面板
  memoraidDebug.start()                  - 启动调试会话（返回验证码）
  memoraidDebug.stop()                   - 停止调试会话
  memoraidDebug.status()                 - 获取调试状态

注意：AI 配图生成需要 30-60 秒，请耐心等待
`)


/**
 * 通过 R2 中转获取图片 URL（绕过防盗链）
 */
const fetchImageViaR2 = async (url: string, referrer?: string): Promise<string | null> => {
  try {
    logger.log(`尝试通过 R2 中转图片...`, "info");

    // 使用后台脚本通过 R2 中转
    const res = await chrome.runtime.sendMessage({
      type: "DOWNLOAD_IMAGE_VIA_R2",
      payload: { url, referrer }
    });

    if (!res || !res.success) {
      logger.log(`R2 中转失败: ${res?.error || "未知错误"}`, "error");
      return null;
    }

    logger.log(`✅ R2 中转成功: ${res.r2Url}`, "success");
    return res.r2Url;
  } catch (e) {
    logger.log(`R2 中转异常: ${e}`, "error");
    return null;
  }
};
