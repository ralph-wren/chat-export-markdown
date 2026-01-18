/**
 * 内容填充工具类
 * 提供统一的自动填充逻辑
 */

import { DOMHelper } from './domHelper';
import { EditorHelper } from './editorHelper';
import { Logger } from './logger';

export interface PublishData {
  title: string;
  content: string;
  htmlContent?: string;
  sourceUrl?: string;
  sourceImages?: string[];
  timestamp: number;
}

export interface FillContentOptions {
  platform: 'toutiao' | 'zhihu' | 'weixin';
  storageKey: string;
  titleSelectors: string[];
  editorSelectors: string[];
  logger: Logger;
  onFillComplete?: (data: PublishData, autoPublish: boolean) => void;
  maxAttempts?: number;
}

export class ContentFiller {
  private options: FillContentOptions;
  private attempts = 0;
  private intervalId?: number;

  constructor(options: FillContentOptions) {
    this.options = options;
  }

  /**
   * 开始填充流程
   */
  async start(): Promise<void> {
    try {
      const data = await chrome.storage.local.get(this.options.storageKey);
      if (!data || !data[this.options.storageKey]) {
        return;
      }
      
      const payload: PublishData = data[this.options.storageKey];
      
      // 检查数据是否过期（5分钟）
      if (Date.now() - payload.timestamp > 5 * 60 * 1000) {
        chrome.storage.local.remove(this.options.storageKey);
        return;
      }

      // 获取自动发布设置
      const settings = await chrome.storage.sync.get([
        'autoPublishAll',
        this.options.platform
      ]);
      
      const autoPublish = settings.autoPublishAll === true
        ? true
        : settings.autoPublishAll === false
        ? false
        : settings[this.options.platform]?.autoPublish !== false;

      this.options.logger.log(`📄 准备填充内容: ${payload.title}`, 'info');
      if (autoPublish) {
        this.options.logger.log('🔔 自动发布已开启', 'info');
      }
      this.options.logger.log('⏳ 等待编辑器加载...', 'info');

      // 开始轮询检查编辑器
      this.intervalId = window.setInterval(async () => {
        this.attempts++;
        const success = await this.tryFill(payload);
        
        const maxAttempts = this.options.maxAttempts || 15;
        if (success || this.attempts >= maxAttempts) {
          if (this.intervalId) {
            clearInterval(this.intervalId);
          }
          
          if (!success) {
            this.options.logger.log('❌ 自动填充失败：未找到编辑器', 'error');
          } else {
            // 填充成功，调用回调
            if (this.options.onFillComplete) {
              this.options.onFillComplete(payload, autoPublish);
            }
          }
        }
      }, 1000);

    } catch (error) {
      console.error(`Memoraid: ${this.options.platform} 填充内容错误`, error);
      this.options.logger.log(`❌ 填充错误: ${error}`, 'error');
    }
  }

  /**
   * 尝试填充内容
   */
  private async tryFill(payload: PublishData): Promise<boolean> {
    const titleEl = DOMHelper.findElement(this.options.titleSelectors);
    const editorEl = DOMHelper.findElement(this.options.editorSelectors);

    if (!titleEl || !editorEl) {
      return false;
    }

    // 填充标题
    await this.fillTitle(titleEl, payload.title);

    // 填充正文
    await this.fillContent(editorEl, payload);

    // 清除storage
    chrome.storage.local.remove(this.options.storageKey);
    
    return true;
  }

  /**
   * 填充标题
   */
  private async fillTitle(titleEl: HTMLElement, title: string): Promise<void> {
    // 检查标题是否已存在
    const existingTitle = titleEl instanceof HTMLInputElement || 
                          titleEl instanceof HTMLTextAreaElement
      ? titleEl.value?.trim()
      : titleEl.innerText?.trim();
    
    if (!existingTitle || existingTitle.length === 0) {
      DOMHelper.simulateInput(titleEl, title);
      this.options.logger.log('✅ 标题已填充', 'success');
    } else {
      this.options.logger.log(`ℹ️ 标题已存在: "${existingTitle}"，跳过填充`, 'info');
    }
  }

  /**
   * 填充正文
   */
  private async fillContent(editorEl: HTMLElement, payload: PublishData): Promise<void> {
    editorEl.click();
    editorEl.focus();
    await DOMHelper.sleep(300);
    
    // 检查编辑器是否已有内容
    if (!EditorHelper.isEmpty(editorEl)) {
      this.options.logger.log('ℹ️ 编辑器已有内容，跳过填充', 'info');
      return;
    }

    // 判断内容格式
    const isMarkdown = this.isMarkdownContent(payload.content);
    
    if (isMarkdown) {
      this.options.logger.log('📝 检测到 Markdown 格式内容', 'info');
    }

    // 填充内容
    if (payload.htmlContent && !isMarkdown) {
      EditorHelper.insertHTML(editorEl, payload.htmlContent);
      this.options.logger.log('✅ 内容已填充 (HTML)', 'success');
    } else {
      EditorHelper.insertText(editorEl, payload.content);
      this.options.logger.log('✅ 内容已填充 (文本)', 'success');
    }
  }

  /**
   * 判断是否为Markdown格式
   */
  private isMarkdownContent(content: string): boolean {
    if (!content) return false;
    
    return (
      content.includes('##') ||
      content.includes('**') ||
      content.includes('- ') ||
      content.includes('1. ') ||
      content.includes('```') ||
      content.includes('> ')
    );
  }

  /**
   * 停止填充流程
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }
}
