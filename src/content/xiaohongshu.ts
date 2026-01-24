import { reportArticlePublish, reportError } from '../utils/debug';
import { DOMHelper } from '../utils/domHelper';
// import { ImageHandler } from '../utils/imageHandler';  // 预留给未来的图片处理功能

// Xiaohongshu(小红书) Publish Content Script - 基于 Playwright 录制
// 小红书创作者平台发布页面自动化
// URL: https://creator.xiaohongshu.com/publish/publish

/**
 * 发布数据接口
 */
interface PublishData {
    title: string;
    content: string;
    htmlContent?: string;
    sourceUrl?: string;
    sourceImages?: string[];
    topics?: string[];
    declaration?: string;
    timestamp: number;
}

// ============================================
// 小红书页面元素选择器配置 - 基于 Playwright 录制
// ============================================
const SELECTORS = {
    // "新的创作"按钮 - Playwright: getByRole('button', { name: '新的创作' })
    newCreationButton: [
        'button:has-text("新的创作")',
        'button:contains("新的创作")',
        '[class*="new-creation"]'
    ],

    // 标题输入框 - 增加更具体的层级
    titleInput: [
        '.title-input input',
        '.title-wrapper input',
        '.title-wrapper [contenteditable]',
        'input[placeholder*="输入标题"]',
        'textarea[placeholder*="输入标题"]',
        '[placeholder*="请输入标题"]'
    ],

    // 正文编辑器 - 小红书核心使用的是 rich-editor 下的 slate
    editor: [
        '.rich-editor-content [data-slate-editor="true"]',
        '[data-slate-editor="true"]',
        '.rich-editor-content',
        '.ql-editor'
    ],

    // 一键排版按钮 - Playwright: getByRole('button', { name: '一键排版' })
    autoFormatButton: [
        'button:has-text("一键排版")',
        'button:contains("一键排版")',
        '.auto-format-button',
        '.rich-editor-toolbar button:has-text("排版")'
    ],

    // 模板封面图片 - Playwright: locator('div:nth-child(19) > .template-cover-container > .images-grid > img').first()
    // 注意：这里使用第一个可见的模板图片
    templateCoverImage: [
        '.template-cover-container img',
        '.images-grid img',
        '[class*="template"] img'
    ],

    // 下一步按钮 - 注意：在写长文模式下，这个按钮通常带有 css- 或特定类
    nextStepButton: [
        'button:has-text("下一步")',
        '.publish-button:has-text("下一步")',
        'button.publish-button',
        '.footer button.red:has-text("下一步")',
        '.publish-footer button:has-text("下一步")',
        '.publish-container .footer button'
    ],

    // 添加话题按钮 - Playwright: getByRole('button', { name: '话题' })
    addTopicButton: [
        'button:has-text("话题")',
        'button:contains("话题")',
        'button:has-text("添加话题")',
        'button:contains("添加话题")'
    ],

    // 话题输入框 - Playwright: getByRole('textbox').filter({ hasText: '#' })
    // 注意：这是一个 contenteditable 元素，包含 # 字符
    topicInput: [
        '[contenteditable][role="textbox"]',  // 优先使用 role 属性
        '[contenteditable]',  // 备用：任何 contenteditable 元素
        '.topic-container [contenteditable]',
        '.topic-input [contenteditable]',
        '[placeholder*="添加话题"]'
    ],

    // 话题下拉列表项 - Playwright: locator('#creator-editor-topic-container').getByText('#话题名')
    topicSuggestionItem: [
        '#creator-editor-topic-container .topic-item',
        '.topic-suggestion-list .item',
        '.topic-item',
        '[class*="topic-container"] [class*="item"]',
        '.suggestion-item'
    ],

    // 原创声明入口 - Playwright: getByText('去声明')
    originalityEntry: [
        'span:has-text("去声明")',
        'div:has-text("去声明")',
        ':has-text("去声明")',
        ':contains("去声明")',
        'span:has-text("原创声明") + span',
        '.publish-original-container [class*="link"]'
    ],

    // 原创声明勾选框 - Playwright: locator('.d-checkbox-indicator')
    originalityCheckbox: [
        '.d-checkbox-indicator',
        '.d-checkbox-input',
        '.checkbox-indicator',
        '[class*="checkbox"]'
    ],

    // 确认原创按钮 - Playwright: getByRole('button', { name: '声明原创' })
    declareOriginalButton: [
        'button:has-text("声明原创")',
        'button:contains("声明原创")',
        '.d-modal-footer button.red',
        '.modal-footer button'
    ],

    // 话题文本 - Playwright: getByText('#矛盾的对立统一')
    topicText: [
        '[class*="topic"]',
        '[class*="tag"]',
        '.tag-item',
        '.topic-container span'
    ],

    // 添加地点 - Playwright: getByText('添加地点')
    addLocationText: [
        ':has-text("添加地点")',
        ':contains("添加地点")',
        '.location-container'
    ],

    // 内容类型声明 - Playwright: getByText('虚构演绎，仅供娱乐')
    contentTypeEntry: [
        '.declaration-container',
        ':has-text("内容类型声明")',
        ':contains("内容类型声明")',
        '.publish-declaration-container'
    ],

    contentTypeOption: [
        '.d-drawer-content .item',
        '.d-modal-content .item',
        '.declaration-item',
        'div:has-text("虚构演绎，仅供娱乐")'
    ],

    // 发布按钮 - Playwright: getByRole('button', { name: '发布' })
    publishButton: [
        'button:has-text("发布")',
        'button:contains("发布")',
        '[class*="publish-button"]'
    ],

    // 抽屉遮罩层 - Playwright: locator('.d-drawer-mask')
    drawerMask: [
        '.d-drawer-mask',
        '[class*="drawer-mask"]',
        '[class*="mask"]'
    ]
};

// ============================================
// DOM 工具函数 - 使用统一工具类
// ============================================

const findElement = (selectors: string[]): HTMLElement | null => DOMHelper.findElement(selectors);
const isElementVisible = (el: HTMLElement): boolean => DOMHelper.isElementVisible(el);
const simulateClick = (element: HTMLElement) => DOMHelper.simulateClick(element);

// 以下工具函数预留给未来的图片处理功能使用
// const simulateInput = (element: HTMLElement, value: string) => DOMHelper.simulateInput(element, value);
// const isMediaAiEnabled = async (): Promise<boolean> => ImageHandler.isMediaAiEnabled();
// const createThumbnailDataUrl = async (dataUrl: string, maxDim = 512): Promise<string | null> => ImageHandler.createThumbnailDataUrl(dataUrl, maxDim);
// const getImageMetaFromDataUrl = async (dataUrl: string): Promise<{ width: number; height: number; aspect: number } | null> => ImageHandler.getImageMetaFromDataUrl(dataUrl);
// const dataUrlToBlob = (dataUrl: string): { blob: Blob; mimeType: string } => ImageHandler.dataUrlToBlob(dataUrl);
// const getFileExtensionByMime = (mimeType: string): string => ImageHandler.getFileExtensionByMime(mimeType);
// const setInputFiles = (input: HTMLInputElement, files: File[]) => ImageHandler.setInputFiles(input, files);

// ============================================
// Logger UI - 与其他平台保持一致
// ============================================
class XiaohongshuLogger {
    private container: HTMLDivElement;
    private logContent: HTMLDivElement;
    private stopBtn: HTMLButtonElement;
    private onStop?: () => void;

    constructor() {
        this.container = document.createElement('div');
        this.container.id = 'memoraid-xiaohongshu-logger';
        // 悬浮窗样式 - 参考知乎的样式
        this.container.style.cssText = 'position:fixed;top:20px;left:20px;width:380px;max-height:500px;background:rgba(0,0,0,0.9);color:#0af;font-family:Consolas,Monaco,monospace;font-size:12px;border-radius:8px;padding:12px;z-index:20000;display:none;flex-direction:column;box-shadow:0 4px 20px rgba(0,0,0,0.6);border:1px solid #0af;';

        const header = document.createElement('div');
        header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #444;padding-bottom:8px;margin-bottom:8px;';

        const title = document.createElement('span');
        title.innerHTML = '📕 <span style="color:#fff;font-weight:bold;">Memoraid</span> 小红书助手';

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
        if (type === 'error') { reportError(message, { type, context: 'XiaohongshuContentScript' }); }
    }
}

const logger = new XiaohongshuLogger();

// ============================================
// 流程控制变量
// ============================================

let isFlowCancelled = false;  // 是否取消流程
let isProcessing = false;     // 是否正在处理中（防止重入）
let pendingSourceUrl: string | undefined;  // 来源URL

// ============================================
// 核心功能函数
// ============================================

/**
 * 点击"新的创作"按钮
 */
const clickNewCreation = async (): Promise<boolean> => {
    logger.log('查找"新的创作"按钮...', 'info');

    const btn = findElement(SELECTORS.newCreationButton);
    if (!btn) {
        logger.log('未找到"新的创作"按钮', 'error');
        return false;
    }

    logger.log('点击"新的创作"按钮', 'action');
    simulateClick(btn);
    await new Promise(r => setTimeout(r, 1500));

    return true;
};

/**
 * 填充标题
 */
const fillTitle = async (title: string): Promise<boolean> => {
    logger.log('查找标题输入框...', 'info');

    // 等待标题输入框出现
    let titleInput: HTMLElement | null = null;
    for (let i = 0; i < 10; i++) {
        titleInput = findElement(SELECTORS.titleInput);
        if (titleInput) break;
        await new Promise(r => setTimeout(r, 500));
    }

    if (!titleInput) {
        logger.log('未找到标题输入框', 'error');
        return false;
    }

    logger.log(`填充标题: ${title.slice(0, 30)}...`, 'action');
    simulateClick(titleInput);
    await new Promise(r => setTimeout(r, 300));

    // 清空并填充标题
    titleInput.focus();

    // 彻底清空当前内容
    if (titleInput instanceof HTMLInputElement || titleInput instanceof HTMLTextAreaElement) {
        titleInput.value = '';
    } else {
        titleInput.innerText = '';
    }

    // 确保标题输入框获得焦点后再执行清空指令
    titleInput.focus();
    await new Promise(r => setTimeout(r, 100));
    document.execCommand('selectAll', false);
    document.execCommand('delete', false);

    // 输入新标题
    document.execCommand('insertText', false, title);
    await new Promise(r => setTimeout(r, 500));

    // 再次确认标题是否正确（防止某些编辑器清空失败）
    const currentTitle = titleInput instanceof HTMLInputElement || titleInput instanceof HTMLTextAreaElement
        ? titleInput.value
        : titleInput.innerText;

    if (currentTitle !== title) {
        logger.log('标题填充不完整，尝试回退方法', 'warn');
        if (titleInput instanceof HTMLInputElement || titleInput instanceof HTMLTextAreaElement) {
            titleInput.value = title;
            titleInput.dispatchEvent(new Event('input', { bubbles: true }));
            titleInput.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
            titleInput.innerText = title;
        }
    }

    // 关键：失去焦点，防止后续 execCommand 仍在标题栏运行
    titleInput.blur();
    await new Promise(r => setTimeout(r, 200));

    logger.log('✅ ✅ 标题已填充', 'success');
    return true;
};

/**
 * 填充正文内容
 */
const fillContent = async (content: string): Promise<boolean> => {
    logger.log('查找正文编辑器...', 'info');

    const editor = findElement(SELECTORS.editor);
    if (!editor) {
        logger.log('未找到正文编辑器', 'error');
        return false;
    }

    logger.log(`填充正文内容 (${content.length} 字)...`, 'action');

    // 强制先滚动到编辑器并点击
    editor.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await new Promise(r => setTimeout(r, 500));

    // 模拟点击并获取焦点
    simulateClick(editor);
    editor.focus();

    // 模拟点击并获取焦点
    simulateClick(editor);
    editor.focus();
    await new Promise(r => setTimeout(r, 200));

    // 关键改进：尝试点击编辑器内部的段落，这是基于 Playwright 录制发现的必要步骤
    const innerParagraph = editor.querySelector('p, [data-slate-node="element"], .rich-editor-content p');
    const targetElement = (innerParagraph as HTMLElement) || editor;

    if (innerParagraph) {
        logger.log('点击编辑器内层段落以激活输入状态', 'info');
        simulateClick(targetElement);
        targetElement.focus();
        await new Promise(r => setTimeout(r, 200));
    }

    // 验证当前焦点是否在编辑器内，防止误删标题
    // 注意：小红书编辑器有时候 document.activeElement 可能指向 body，所以这里放宽检查
    // 如果焦点在标题输入框，则必须移开
    const titleInput = findElement(SELECTORS.titleInput);
    if (titleInput && (titleInput === document.activeElement || titleInput.contains(document.activeElement))) {
        logger.log('⚠️ 焦点仍在标题栏，强制转移焦点到编辑器', 'warn');
        targetElement.focus();
        // 尝试模拟点击一下编辑器
        simulateClick(targetElement);
        await new Promise(r => setTimeout(r, 500));
    }

    // 清空编辑器内容 - 使用更安全的 Range 操作替代 selectAll，防止选中整个页面或标题
    // 再次检查焦点
    if (!editor.contains(document.activeElement)) {
        targetElement.focus();
    }

    // 新的清空逻辑：选中编辑器内容进行删除
    try {
        const selection = window.getSelection();
        if (selection) {
            selection.removeAllRanges();
            const range = document.createRange();
            range.selectNodeContents(targetElement);
            selection.addRange(range);
            // 确保焦点在 targetElement
            targetElement.focus();
            document.execCommand('delete', false);
            selection.removeAllRanges();
        }
    } catch (e) {
        logger.log('Range 清空失败，尝试针对性删除', 'warn');
        targetElement.innerHTML = '';
    }

    await new Promise(r => setTimeout(r, 500));

    // 再次验证焦点，防止在清空过程中丢失
    if (!editor.contains(document.activeElement)) {
        targetElement.focus();
    }

    // 使用模拟粘贴 (Paste Event) 填充，这是处理 Slate.js 多行内容最稳定的方法
    let pasteSuccess = false;
    try {
        const dataTransfer = new DataTransfer();
        dataTransfer.setData('text/plain', content);
        const pasteEvent = new ClipboardEvent('paste', {
            clipboardData: dataTransfer,
            bubbles: true,
            cancelable: true
        });

        // 尝试向目标元素分发粘贴事件
        targetElement.dispatchEvent(pasteEvent);

        // 检查是否粘贴成功（有些编辑器可能需要一点时间更新 DOM）
        await new Promise(r => setTimeout(r, 200));

        if (editor.innerText.trim().length > 0) {
            pasteSuccess = true;
            logger.log('✅ 正文已通过模拟粘贴填充', 'success');
        } else {
            logger.log('模拟粘贴似乎没有效果，尝试回退', 'warn');
        }
    } catch (e) {
        logger.log('模拟粘贴执行出错，尝试回退', 'warn');
    }

    // 如果粘贴失败，或者编辑器依然为空，尝试回退逻辑
    if (!pasteSuccess || editor.innerText.trim().length === 0) {
        logger.log('正在使用回退模式（逐行插入）...', 'info');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim()) {
                document.execCommand('insertText', false, lines[i]);
            }
            if (i < lines.length - 1) {
                document.execCommand('insertParagraph', false);
            }
        }
    }

    // 再次触发 input 事件通知 React/Slate 更新
    editor.dispatchEvent(new Event('input', { bubbles: true }));

    // 额外触发一个 keyup 事件
    editor.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter' }));

    await new Promise(r => setTimeout(r, 1000));
    return true;
};

/**
 * 点击"一键排版"按钮
 */
const clickAutoFormat = async (): Promise<boolean> => {
    logger.log('查找"一键排版"按钮...', 'info');

    const btn = findElement(SELECTORS.autoFormatButton);
    if (!btn) {
        logger.log('未找到"一键排版"按钮，跳过', 'warn');
        return false;
    }

    logger.log('点击"一键排版"按钮', 'action');
    // 再次确认是排版按钮
    if (!btn.textContent?.includes('一键排版')) {
        logger.log('检测到按钮文本不符，取消点击"一键排版"', 'warn');
        return false;
    }
    simulateClick(btn);
    await new Promise(r => setTimeout(r, 1500));

    logger.log('✅ 已应用排版', 'success');
    return true;
};

/**
 * 选择模板封面
 */
const selectTemplateCover = async (): Promise<boolean> => {
    logger.log('查找模板封面图片...', 'info');

    // 查找所有模板封面图片
    const images = Array.from(document.querySelectorAll('.template-cover-container img, .images-grid img'));
    const visibleImages = images.filter(img => isElementVisible(img as HTMLElement));

    if (visibleImages.length === 0) {
        logger.log('未找到模板封面图片，跳过', 'warn');
        return false;
    }

    // 随机选择一个可见的图片
    const randomIndex = Math.floor(Math.random() * visibleImages.length);
    logger.log(`找到 ${visibleImages.length} 个模板封面，随机选择第 ${randomIndex + 1} 个`, 'info');
    const selectedImage = visibleImages[randomIndex] as HTMLElement;

    simulateClick(selectedImage);
    await new Promise(r => setTimeout(r, 800));

    logger.log('✅ 已选择模板封面', 'success');
    return true;
};

/**
 * 点击"下一步"按钮
 */
const clickNextStep = async (): Promise<boolean> => {
    logger.log('查找"下一步"按钮...', 'info');

    // 增加重试逻辑，因为排版后 DOM 可能需要时间更新
    for (let i = 0; i < 3; i++) {
        const btn = findElement(SELECTORS.nextStepButton);
        if (btn && isElementVisible(btn)) {
            logger.log('▶️ 点击"下一步"按钮', 'action');
            simulateClick(btn);
            // 进入下一步后通常有较大的页面结构变化，等待更久一点
            await new Promise(r => setTimeout(r, 3000));
            return true;
        }
        logger.log(`第 ${i + 1} 次尝试未找到"下一步"按钮，等待中...`, 'info');
        await new Promise(r => setTimeout(r, 1000));
    }

    logger.log('❌ 未找到"下一步"按钮', 'error');
    return false;
};

/**
 * 设置原创声明
 */
const setOriginalityDeclaration = async (): Promise<boolean> => {
    logger.log('准备设置原创声明...', 'info');

    // 1. 点击"去声明"入口
    let entry: HTMLElement | null = null;
    for (let i = 0; i < 5; i++) {
        entry = findElement(SELECTORS.originalityEntry);
        if (entry) break;
        logger.log(`第 ${i + 1} 次尝试查找"去声明"入口...`, 'info');
        await new Promise(r => setTimeout(r, 800));
    }

    if (!entry) {
        logger.log('未找到"原创声明"入口（可能已设置或不支持）', 'warn');
        return false;
    }

    logger.log('点击"去声明"', 'action');
    simulateClick(entry);
    // 增加等待时间，确保弹窗完全加载
    await new Promise(r => setTimeout(r, 2000));

    // 2. 勾选原创复选框 - 增加重试逻辑
    let checkbox: HTMLElement | null = null;
    for (let i = 0; i < 5; i++) {
        checkbox = findElement(SELECTORS.originalityCheckbox);
        if (checkbox) {
            logger.log('找到原创声明勾选框', 'info');
            break;
        }
        logger.log(`第 ${i + 1} 次尝试查找原创声明勾选框...`, 'info');
        await new Promise(r => setTimeout(r, 500));
    }

    if (!checkbox) {
        logger.log('未找到原创声明勾选框', 'warn');
        // 尝试查找是否有其他可能的复选框元素
        const allCheckboxes = Array.from(document.querySelectorAll('[class*="checkbox"], [role="checkbox"], input[type="checkbox"]'));
        logger.log(`页面上共找到 ${allCheckboxes.length} 个复选框元素`, 'info');

        if (allCheckboxes.length > 0) {
            const visibleCheckbox = allCheckboxes.find(el => isElementVisible(el as HTMLElement));
            if (visibleCheckbox) {
                checkbox = visibleCheckbox as HTMLElement;
                logger.log('使用备用复选框元素', 'info');
            }
        }

        if (!checkbox) {
            return false;
        }
    }

    logger.log('勾选原创声明', 'action');
    simulateClick(checkbox);
    await new Promise(r => setTimeout(r, 1000));

    // 3. 点击"声明原创"按钮 - 增加重试逻辑
    let confirmBtn: HTMLElement | null = null;
    for (let i = 0; i < 5; i++) {
        confirmBtn = findElement(SELECTORS.declareOriginalButton);
        if (confirmBtn) {
            logger.log('找到"声明原创"按钮', 'info');
            break;
        }
        logger.log(`第 ${i + 1} 次尝试查找"声明原创"按钮...`, 'info');
        await new Promise(r => setTimeout(r, 500));
    }

    if (!confirmBtn) {
        logger.log('未找到"声明原创"按钮', 'warn');
        return false;
    }

    logger.log('点击"声明原创"确认按钮', 'action');
    simulateClick(confirmBtn);
    await new Promise(r => setTimeout(r, 1500));

    logger.log('✅ 原创声明设置成功', 'success');
    return true;
};

/**
 * 添加话题
 * @param topics 话题数组，例如 ['#天气', '#生活']
 */
const addTopics = async (topics: string[]): Promise<boolean> => {
    if (!topics || topics.length === 0) {
        logger.log('无话题需要添加，跳过', 'info');
        return true;
    }

    logger.log(`准备添加 ${topics.length} 个话题: ${topics.join(', ')}`, 'info');

    for (const topic of topics) {
        // 1. 点击"话题"按钮以激活输入
        const addTopicBtn = findElement(SELECTORS.addTopicButton);
        if (addTopicBtn) {
            logger.log('点击"话题"按钮', 'action');
            simulateClick(addTopicBtn);
            await new Promise(r => setTimeout(r, 1000));
        }

        // 2. 找到输入框并填入话题关键词
        // 增加重试逻辑，优先查找包含 # 的 contenteditable 元素
        let input: HTMLElement | null = null;
        for (let j = 0; j < 5; j++) {
            // 先尝试找到包含 # 的 contenteditable 元素
            const editables = Array.from(document.querySelectorAll('[contenteditable="true"], [contenteditable]'));
            input = editables.find(el => {
                const text = (el as HTMLElement).textContent || '';
                return text.includes('#') && isElementVisible(el as HTMLElement);
            }) as HTMLElement || null;

            // 如果没找到，使用备用选择器
            if (!input) {
                input = findElement(SELECTORS.topicInput);
            }

            if (input) break;
            await new Promise(r => setTimeout(r, 500));
        }

        if (!input) {
            logger.log('未找到话题输入框', 'warn');
            continue;
        }

        const keyword = topic.startsWith('#') ? topic : `#${topic}`;
        logger.log(`输入话题关键词: ${keyword}`, 'action');

        // 点击输入框以确保获得焦点
        simulateClick(input);
        input.focus();
        await new Promise(r => setTimeout(r, 300));

        // 清空当前内容（如果有的话）
        const currentText = input.textContent || '';
        if (currentText && currentText !== '#') {
            // 选中所有内容并删除
            const selection = window.getSelection();
            if (selection) {
                selection.removeAllRanges();
                const range = document.createRange();
                range.selectNodeContents(input);
                selection.addRange(range);
            }
        }

        // 输入话题关键词
        document.execCommand('insertText', false, keyword);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => setTimeout(r, 1500)); // 等待下拉列表出现

        // 3. 从下拉列表中选择匹配项
        // 根据 Playwright 代码，建议列表在 #creator-editor-topic-container 中
        const container = document.querySelector('#creator-editor-topic-container');
        if (container) {
            // 查找所有包含话题文本的元素
            const allElements = Array.from(container.querySelectorAll('*'));
            const suggestions = allElements.filter(el => {
                const text = el.textContent?.trim() || '';
                // 精确匹配话题（例如 "#奶茶"）
                return text === keyword && isElementVisible(el as HTMLElement);
            });

            if (suggestions.length > 0) {
                logger.log(`从下拉列表选择话题: ${suggestions[0].textContent?.trim()}`, 'action');
                simulateClick(suggestions[0] as HTMLElement);
                await new Promise(r => setTimeout(r, 800));
            } else {
                // 如果没有精确匹配，尝试模糊匹配
                const fuzzyMatches = allElements.filter(el => {
                    const text = el.textContent?.trim() || '';
                    return text.includes(keyword) && isElementVisible(el as HTMLElement);
                });

                if (fuzzyMatches.length > 0) {
                    logger.log(`模糊匹配话题: ${fuzzyMatches[0].textContent?.trim()}`, 'action');
                    simulateClick(fuzzyMatches[0] as HTMLElement);
                    await new Promise(r => setTimeout(r, 800));
                } else {
                    logger.log(`未找到话题建议: ${keyword}，尝试按回车确认`, 'info');
                    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
                    await new Promise(r => setTimeout(r, 500));
                }
            }
        } else {
            logger.log('未找到话题容器 #creator-editor-topic-container', 'warn');
            // 尝试使用旧的选择器作为备用
            const suggestions = Array.from(document.querySelectorAll(SELECTORS.topicSuggestionItem.join(',')));
            if (suggestions.length > 0) {
                const target = suggestions.find(el => el.textContent?.trim() === keyword) || suggestions[0];
                logger.log(`从下拉列表选择话题: ${target.textContent?.trim()}`, 'action');
                simulateClick(target as HTMLElement);
                await new Promise(r => setTimeout(r, 800));
            }
        }
    }

    logger.log('✅ 话题添加流程完成', 'success');
    return true;
};

/**
 * 设置内容类型声明
 * @param declarationType 声明类型，例如 '虚构演绎，仅供娱乐'
 */
const setContentTypeDeclaration = async (declarationType: string): Promise<boolean> => {
    logger.log(`准备设置内容类型声明: ${declarationType}`, 'info');

    // 1. 找到并点击"内容类型声明"入口
    const entry = findElement(SELECTORS.contentTypeEntry);
    if (!entry) {
        logger.log('未找到"内容类型声明"入口', 'warn');
        return false;
    }

    logger.log('点击"内容类型声明"入口', 'action');
    simulateClick(entry);
    await new Promise(r => setTimeout(r, 1500));

    // 2. 在弹出的选项中查找目标声明
    // 优先尝试精确匹配文本的选项
    const options = Array.from(document.querySelectorAll('.d-drawer-content *, .d-modal-content *, .declaration-item, body *'));
    for (const el of options) {
        if (el.textContent?.trim() === declarationType && isElementVisible(el as HTMLElement)) {
            logger.log(`点击声明选项: ${declarationType}`, 'action');
            simulateClick(el as HTMLElement);
            await new Promise(r => setTimeout(r, 800));
            logger.log(`✅ 已设置内容类型声明: ${declarationType}`, 'success');
            return true;
        }
    }

    // 如果没找到，尝试模糊匹配
    const fallbackOptions = options.filter(el => el.textContent?.includes(declarationType) && isElementVisible(el as HTMLElement));
    if (fallbackOptions.length > 0) {
        logger.log(`模糊匹配到声明选项: ${fallbackOptions[0].textContent?.trim()}`, 'action');
        simulateClick(fallbackOptions[0] as HTMLElement);
        await new Promise(r => setTimeout(r, 800));
        return true;
    }

    logger.log(`未找到声明选项: ${declarationType}`, 'warn');
    return false;
};

/**
 * 点击"发布"按钮
 */
const clickPublish = async (): Promise<boolean> => {
    logger.log('查找"发布"按钮...', 'info');

    const btn = findElement(SELECTORS.publishButton);
    if (!btn) {
        logger.log('未找到"发布"按钮', 'error');
        return false;
    }

    logger.log('点击"发布"按钮', 'action');
    simulateClick(btn);
    await new Promise(r => setTimeout(r, 2000));

    logger.log('✅ 文章已发布！', 'success');

    // 上报发布成功
    try {
        await reportArticlePublish({
            platform: 'xiaohongshu',
            title: '小红书文章',  // 标题在这里不可用，使用默认值
            url: window.location.href,
            extra: {
                sourceUrl: pendingSourceUrl
            }
        });
    } catch (err) {
        console.error('上报发布失败:', err);
    }

    return true;
};

// ============================================
// 自动填充流程 - 页面加载时自动执行
// ============================================

/**
 * 自动填充流程入口
 */
const autoFillContent = async (): Promise<void> => {
    if (isProcessing) {
        console.log('[Memoraid] 正在处理中，跳过重入');
        return;
    }

    try {
        // 检查是否有待发布的数据
        const result = await chrome.storage.local.get('pending_xiaohongshu_publish');
        const pending = result.pending_xiaohongshu_publish as PublishData | undefined;

        if (!pending) {
            console.log('[Memoraid] 无待发布数据');
            return;
        }

        isProcessing = true;
        isFlowCancelled = false;

        logger.log('🚀 开始自动填充...', 'info');
        logger.log(`标题: ${pending.title}`, 'info');
        logger.log(`内容长度: ${pending.content.length} 字`, 'info');

        // 保存数据供后续使用
        pendingSourceUrl = pending.sourceUrl;

        // 设置停止回调
        logger.setStopCallback(() => {
            isFlowCancelled = true;
        });

        // 等待页面完全加载
        await new Promise(r => setTimeout(r, 2000));

        // 检查是否在发布页面
        const currentUrl = window.location.href;
        if (!currentUrl.includes('creator.xiaohongshu.com/publish')) {
            logger.log('❌ 不在小红书创作者发布页面', 'error');
            logger.hideStopButton();
            return;
        }

        // 步骤1: 点击"新的创作"（如果需要）
        // 注意：如果已经在编辑页面，则跳过此步骤
        const titleInput = findElement(SELECTORS.titleInput);
        if (!titleInput) {
            logger.log('未检测到标题输入框，尝试点击"新的创作"', 'info');
            const success = await clickNewCreation();
            if (!success && !isFlowCancelled) {
                logger.log('❌ 无法开始创作', 'error');
                logger.hideStopButton();
                return;
            }
        }

        if (isFlowCancelled) return;

        // 步骤2: 填充标题
        const titleSuccess = await fillTitle(pending.title);
        if (!titleSuccess && !isFlowCancelled) {
            logger.log('❌ 标题填充失败', 'error');
            logger.hideStopButton();
            return;
        }

        if (isFlowCancelled) return;

        // 步骤3: 填充正文
        const contentSuccess = await fillContent(pending.content);
        if (!contentSuccess && !isFlowCancelled) {
            logger.log('❌ 正文填充失败', 'error');
            logger.hideStopButton();
            return;
        }

        if (isFlowCancelled) return;

        // 关键增强：标题保护 - 检查正文填充后标题是否被意外清空
        const currentTitleInput = findElement(SELECTORS.titleInput);
        const actualTitle = currentTitleInput instanceof HTMLInputElement || currentTitleInput instanceof HTMLTextAreaElement
            ? currentTitleInput.value
            : currentTitleInput?.innerText;

        if (!actualTitle || actualTitle.trim().length === 0) {
            logger.log('⚠️ 检测到标题被意外清空，正在修复...', 'warn');
            await fillTitle(pending.title);
        }

        // 步骤4: 一键排版（可选）
        await clickAutoFormat();

        if (isFlowCancelled) return;

        // 步骤5: 选择模板封面（可选）
        await selectTemplateCover();

        if (isFlowCancelled) return;

        // 步骤6: 点击"下一步"进入发布设置
        const nextSuccess = await clickNextStep();
        if (!nextSuccess && !isFlowCancelled) {
            logger.log('❌ 无法进入发布设置页面', 'error');
            logger.hideStopButton();
            return;
        }

        if (isFlowCancelled) return;

        // 步骤7: 设置原创声明
        await setOriginalityDeclaration();

        if (isFlowCancelled) return;

        // 步骤8: 添加话题
        if (pending.topics && pending.topics.length > 0) {
            await addTopics(pending.topics);
        }

        if (isFlowCancelled) return;

        // 步骤9: 设置内容类型声明
        if (pending.declaration) {
            await setContentTypeDeclaration(pending.declaration);
        }

        // 完成填充
        logger.log('✅ 自动填充完成！请手动检查并点击发布', 'success');
        logger.log('💡 提示：你可以手动添加话题、地点、合集等信息', 'info');
        logger.hideStopButton();

        // 清除待发布数据
        await chrome.storage.local.remove('pending_xiaohongshu_publish');

    } catch (error) {
        console.error('[Memoraid] 小红书自动填充错误:', error);
        logger.log(`❌ 填充错误: ${error}`, 'error');
        logger.hideStopButton();
    } finally {
        isProcessing = false;
    }
};

// ============================================
// 上报发布成功
// ============================================

/**
 * 安装发布上报监听器
 */
const installPublishReporting = () => {
    // 监听 URL 变化，检测是否发布成功
    let lastUrl = window.location.href;

    const checkUrlChange = () => {
        const currentUrl = window.location.href;
        if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;

            // 检查是否跳转到发布成功页面
            // 小红书发布成功后会跳转到 ?published=true
            if (currentUrl.includes('published=true')) {
                logger.log('🎉 检测到发布成功！', 'success');

                // 上报发布成功
                reportArticlePublish({
                    platform: 'xiaohongshu',
                    title: '小红书文章',  // 标题在这里不可用，使用默认值
                    url: currentUrl,
                    extra: {
                        sourceUrl: pendingSourceUrl
                    }
                }).catch(err => {
                    console.error('上报发布失败:', err);
                });
            }
        }
    };

    // 每秒检查一次 URL 变化
    setInterval(checkUrlChange, 1000);
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
(window as any).memoraidXiaohongshuFillTitle = fillTitle;
(window as any).memoraidXiaohongshuFillContent = fillContent;
(window as any).memoraidXiaohongshuAutoFormat = clickAutoFormat;
(window as any).memoraidXiaohongshuSelectCover = selectTemplateCover;
(window as any).memoraidXiaohongshuNextStep = clickNextStep;
(window as any).memoraidXiaohongshuAddTopics = addTopics;
(window as any).memoraidXiaohongshuSetDeclaration = setContentTypeDeclaration;
(window as any).memoraidXiaohongshuPublish = clickPublish;

// 消息监听
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'XIAOHONGSHU_FILL_TITLE') {
        fillTitle(message.title);
        sendResponse({ success: true });
        return true;
    }

    if (message.type === 'XIAOHONGSHU_FILL_CONTENT') {
        fillContent(message.content);
        sendResponse({ success: true });
        return true;
    }

    if (message.type === 'XIAOHONGSHU_ADD_TOPICS') {
        addTopics(message.topics);
        sendResponse({ success: true });
        return true;
    }

    if (message.type === 'XIAOHONGSHU_PUBLISH') {
        clickPublish();
        sendResponse({ success: true });
        return true;
    }
});

console.log(`
📕 Memoraid 小红书助手已加载

可用命令：
  memoraidXiaohongshuFillTitle("标题")       - 填充标题
  memoraidXiaohongshuFillContent("内容")    - 填充正文
  memoraidXiaohongshuAutoFormat()           - 一键排版
  memoraidXiaohongshuSelectCover()          - 选择模板封面
  memoraidXiaohongshuNextStep()             - 进入发布设置
  memoraidXiaohongshuAddTopics(["#话题1"])  - 添加话题
  memoraidXiaohongshuPublish()              - 发布文章
`);
