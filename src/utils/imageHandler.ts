/**
 * 通用图片处理工具类
 * 支持：
 * 1. 从URL获取图片并复制到剪贴板
 * 2. 从URL转换为DataURL
 * 3. 从URL转换为Blob/File
 * 4. AI智能选图
 * 5. 图片缩略图生成
 */

export interface ImageMeta {
  width: number;
  height: number;
  aspect: number;
}

export interface ImageCandidate {
  index: number;
  url: string;
  element?: HTMLElement;
}

export class ImageHandler {
  /**
   * 从URL获取图片的DataURL
   * @param url 图片URL
   * @param referrer 引用页（用于跨域请求）
   */
  static async fetchImageDataUrl(url: string, referrer?: string): Promise<string | null> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'FETCH_IMAGE_DATA_URL',
        payload: { url, referrer: referrer || window.location.href }
      });
      
      if (response?.success && response.dataUrl) {
        return response.dataUrl as string;
      }
      return null;
    } catch (error) {
      console.error('[ImageHandler] 获取图片DataURL失败:', error);
      return null;
    }
  }

  /**
   * 从DataURL获取图片元信息
   */
  static async getImageMetaFromDataUrl(dataUrl: string): Promise<ImageMeta | null> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth || img.width || 0;
        const h = img.naturalHeight || img.height || 0;
        if (!w || !h) {
          resolve(null);
          return;
        }
        resolve({
          width: w,
          height: h,
          aspect: Math.max(w / h, h / w)
        });
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  }

  /**
   * 创建缩略图DataURL
   * @param dataUrl 原始图片DataURL
   * @param maxDim 最大尺寸（宽或高）
   */
  static async createThumbnailDataUrl(dataUrl: string, maxDim = 512): Promise<string | null> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const w = img.naturalWidth || img.width || 0;
          const h = img.naturalHeight || img.height || 0;
          if (!w || !h) {
            resolve(null);
            return;
          }
          
          const scale = Math.min(1, maxDim / Math.max(w, h));
          const tw = Math.max(1, Math.round(w * scale));
          const th = Math.max(1, Math.round(h * scale));
          
          const canvas = document.createElement('canvas');
          canvas.width = tw;
          canvas.height = th;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          
          ctx.drawImage(img, 0, 0, tw, th);
          resolve(canvas.toDataURL('image/jpeg', 0.72));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  }

  /**
   * DataURL转Blob
   */
  static dataUrlToBlob(dataUrl: string): { blob: Blob; mimeType: string } {
    const [meta, data] = dataUrl.split(',');
    const mimeMatch = meta?.match(/data:([^;]+);base64/i);
    const mimeType = mimeMatch?.[1] || 'application/octet-stream';
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return {
      blob: new Blob([bytes], { type: mimeType }),
      mimeType
    };
  }

  /**
   * 根据MIME类型获取文件扩展名
   */
  static getFileExtensionByMime(mimeType: string): string {
    const m = (mimeType || '').toLowerCase();
    if (m.includes('png')) return 'png';
    if (m.includes('webp')) return 'webp';
    if (m.includes('gif')) return 'gif';
    if (m.includes('bmp')) return 'bmp';
    return 'jpg';
  }

  /**
   * DataURL转File对象
   */
  static dataUrlToFile(dataUrl: string, filename?: string): File {
    const { blob, mimeType } = this.dataUrlToBlob(dataUrl);
    const ext = this.getFileExtensionByMime(mimeType);
    const name = filename || `memoraid-${Date.now()}.${ext}`;
    return new File([blob], name, { type: mimeType });
  }

  /**
   * 将图片复制到剪贴板（推荐方法）
   * @param url 图片URL
   * @param referrer 引用页
   */
  static async copyImageToClipboard(url: string, referrer?: string): Promise<boolean> {
    try {
      console.log('[ImageHandler] 开始复制图片到剪贴板:', url);
      
      // 1. 获取图片DataURL
      const dataUrl = await this.fetchImageDataUrl(url, referrer);
      if (!dataUrl) {
        console.error('[ImageHandler] 无法获取图片DataURL');
        return false;
      }

      // 2. 转换为Blob
      const { blob } = this.dataUrlToBlob(dataUrl);
      
      // 3. 写入剪贴板
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob
        })
      ]);
      
      console.log('[ImageHandler] 图片已复制到剪贴板');
      return true;
    } catch (error) {
      console.error('[ImageHandler] 复制图片到剪贴板失败:', error);
      return false;
    }
  }

  /**
   * 粘贴剪贴板中的图片到编辑器
   * @param editor 编辑器元素
   */
  static async pasteImageFromClipboard(editor: HTMLElement): Promise<boolean> {
    try {
      console.log('[ImageHandler] 开始粘贴图片');
      
      // 聚焦编辑器
      editor.focus();
      
      // 模拟Ctrl+V粘贴
      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: new DataTransfer()
      });
      
      editor.dispatchEvent(pasteEvent);
      
      // 备用方法：使用document.execCommand
      document.execCommand('paste');
      
      console.log('[ImageHandler] 粘贴命令已执行');
      return true;
    } catch (error) {
      console.error('[ImageHandler] 粘贴图片失败:', error);
      return false;
    }
  }

  /**
   * 复制并粘贴图片（一步到位）
   * @param url 图片URL
   * @param editor 编辑器元素
   * @param referrer 引用页
   */
  static async copyAndPasteImage(
    url: string,
    editor: HTMLElement,
    referrer?: string
  ): Promise<boolean> {
    try {
      console.log('[ImageHandler] 开始复制并粘贴图片:', url);
      
      // 1. 复制到剪贴板
      const copied = await this.copyImageToClipboard(url, referrer);
      if (!copied) {
        console.error('[ImageHandler] 复制失败');
        return false;
      }
      
      // 2. 等待一下确保剪贴板已更新
      await new Promise(r => setTimeout(r, 300));
      
      // 3. 粘贴到编辑器
      const pasted = await this.pasteImageFromClipboard(editor);
      if (!pasted) {
        console.error('[ImageHandler] 粘贴失败');
        return false;
      }
      
      console.log('[ImageHandler] 图片复制粘贴成功');
      return true;
    } catch (error) {
      console.error('[ImageHandler] 复制粘贴图片失败:', error);
      return false;
    }
  }

  /**
   * 设置input[type=file]的文件（用于上传）
   */
  static setInputFiles(input: HTMLInputElement, files: File[]): void {
    const dt = new DataTransfer();
    for (const f of files) {
      dt.items.add(f);
    }
    
    try {
      Object.defineProperty(input, 'files', {
        value: dt.files,
        configurable: true
      });
    } catch {
      try {
        (input as any).files = dt.files;
      } catch {
        console.error('[ImageHandler] 无法设置input files');
        return;
      }
    }
    
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /**
   * 通过文件上传方式插入图片
   * @param url 图片URL
   * @param input 文件输入框
   * @param referrer 引用页
   */
  static async uploadImageViaInput(
    url: string,
    input: HTMLInputElement,
    referrer?: string
  ): Promise<boolean> {
    try {
      console.log('[ImageHandler] 通过input上传图片:', url);
      
      // 1. 获取图片DataURL
      const dataUrl = await this.fetchImageDataUrl(url, referrer);
      if (!dataUrl) {
        console.error('[ImageHandler] 无法获取图片DataURL');
        return false;
      }
      
      // 2. 转换为File对象
      const file = this.dataUrlToFile(dataUrl);
      
      // 3. 设置到input
      this.setInputFiles(input, [file]);
      
      console.log('[ImageHandler] 图片已设置到input');
      return true;
    } catch (error) {
      console.error('[ImageHandler] 上传图片失败:', error);
      return false;
    }
  }

  /**
   * 检查是否启用了AI图文增强
   * @deprecated AI图文增强功能已移除，此方法始终返回false
   */
  static async isMediaAiEnabled(): Promise<boolean> {
    return false;
  }

  /**
   * AI智能选图
   * @deprecated AI图文增强功能已移除，此方法始终返回null
   * @param keyword 搜索关键词
   * @param candidates 候选图片列表
   * @param title 文章标题
   * @param context 文章上下文
   */
  static async pickBestImageWithAI(
    _keyword: string,
    _candidates: ImageCandidate[],
    _title?: string,
    _context?: string
  ): Promise<number | null> {
    console.warn('ImageHandler: AI选图功能已移除');
    return null;
  }

  /**
   * 从元素中提取图片URL
   */
  static getImageUrlFromElement(element: HTMLElement): string {
    // 1. 尝试从img标签获取
    const img = element.querySelector('img') as HTMLImageElement | null;
    if (img) {
      const url = img.currentSrc || img.src;
      if (url && !url.startsWith('data:')) {
        return url;
      }
    }

    // 2. 尝试从背景图获取
    const bgImage = window.getComputedStyle(element).backgroundImage;
    const match = bgImage.match(/url\((['"]?)(.*?)\1\)/i);
    if (match && match[2]) {
      const url = match[2].trim();
      if (url && !url.startsWith('data:')) {
        return url;
      }
    }

    // 3. 如果元素本身是img
    if (element.tagName === 'IMG') {
      const imgEl = element as HTMLImageElement;
      const url = imgEl.currentSrc || imgEl.src;
      if (url && !url.startsWith('data:')) {
        return url;
      }
    }

    return '';
  }

  /**
   * 等待图片加载完成
   */
  static async waitForImageLoad(url: string, timeout = 10000): Promise<boolean> {
    return new Promise((resolve) => {
      const img = new Image();
      const timer = setTimeout(() => {
        img.onload = null;
        img.onerror = null;
        resolve(false);
      }, timeout);

      img.onload = () => {
        clearTimeout(timer);
        resolve(true);
      };

      img.onerror = () => {
        clearTimeout(timer);
        resolve(false);
      };

      img.src = url;
    });
  }
}
