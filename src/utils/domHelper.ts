/**
 * DOM操作工具类
 * 提供统一的DOM查找、操作、事件模拟等功能
 */

export class DOMHelper {
  /**
   * 查找元素 - 支持多种选择器和:contains()伪选择器
   */
  static findElement(selectors: string[]): HTMLElement | null {
    for (const selector of selectors) {
      try {
        // 处理 :contains() 伪选择器（jQuery 风格）
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
        if (el && this.isElementVisible(el as HTMLElement)) {
          return el as HTMLElement;
        }
      } catch (e) {
        // 选择器语法错误，跳过
      }
    }
    return null;
  }

  /**
   * 查找所有匹配的元素
   */
  static findAllElements(selectors: string[]): HTMLElement[] {
    const results: HTMLElement[] = [];
    const seen = new Set<HTMLElement>();
    
    for (const selector of selectors) {
      try {
        if (selector.includes(':contains(')) {
          const match = selector.match(/(.+):contains\("([^"]+)"\)/);
          if (match) {
            const [, baseSelector, text] = match;
            const elements = document.querySelectorAll(baseSelector);
            for (const el of elements) {
              if (el.textContent?.includes(text) && !seen.has(el as HTMLElement)) {
                seen.add(el as HTMLElement);
                results.push(el as HTMLElement);
              }
            }
          }
          continue;
        }
        
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          if (!seen.has(el as HTMLElement) && this.isElementVisible(el as HTMLElement)) {
            seen.add(el as HTMLElement);
            results.push(el as HTMLElement);
          }
        }
      } catch (e) {
        // ignore
      }
    }
    return results;
  }

  /**
   * 通过文本内容查找元素
   */
  static findElementByText(
    text: string,
    tagNames: string[] = ['button', 'span', 'div', 'a', 'label']
  ): HTMLElement | null {
    for (const tag of tagNames) {
      const elements = document.querySelectorAll(tag);
      for (const el of elements) {
        const elText = (el as HTMLElement).innerText?.trim();
        if (elText === text && this.isElementVisible(el as HTMLElement)) {
          return el as HTMLElement;
        }
      }
    }
    return null;
  }

  /**
   * 查找包含指定文本的所有可见元素
   */
  static findVisibleElementsByTextIncludes(
    text: string,
    scope: ParentNode = document,
    tagNames: string[] = ['button', 'span', 'div', 'a', 'label']
  ): HTMLElement[] {
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
        if (!this.isElementVisible(h)) continue;
        result.push(h);
      }
    }
    return result;
  }

  /**
   * 检查元素是否可见
   */
  static isElementVisible(el: HTMLElement): boolean {
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
  }

  /**
   * 等待元素出现
   */
  static waitForElement(
    selectors: string[],
    timeout = 5000
  ): Promise<HTMLElement | null> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const check = () => {
        const el = this.findElement(selectors);
        if (el) {
          resolve(el);
          return;
        }
        if (Date.now() - startTime > timeout) {
          resolve(null);
          return;
        }
        requestAnimationFrame(check);
      };
      check();
    });
  }

  /**
   * 模拟点击 - 增强版
   */
  static simulateClick(element: HTMLElement): void {
    // 确保元素可见
    element.scrollIntoView({ behavior: 'instant', block: 'center' });
    
    // 触发完整的鼠标事件序列
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
    
    // 备用：直接调用 click
    element.click();
  }

  /**
   * 模拟输入 - 增强版
   */
  static simulateInput(element: HTMLElement, value: string): void {
    element.focus();
    
    // 清空现有内容
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      element.select();
      document.execCommand('delete');
    }
    
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set;
    const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value'
    )?.set;

    if (element instanceof HTMLInputElement && nativeInputValueSetter) {
      nativeInputValueSetter.call(element, value);
    } else if (element instanceof HTMLTextAreaElement && nativeTextAreaValueSetter) {
      nativeTextAreaValueSetter.call(element, value);
    } else {
      element.innerText = value;
    }
    
    // 触发各种输入事件
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
  }

  /**
   * 模拟键盘输入（逐字符）
   */
  static async simulateTyping(
    element: HTMLElement,
    value: string,
    delay = 50
  ): Promise<void> {
    element.focus();
    
    for (const char of value) {
      element.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
      
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        element.value += char;
      } else {
        element.innerText += char;
      }
      
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
      
      await new Promise(r => setTimeout(r, delay));
    }
    
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /**
   * 滚动到指定位置
   */
  static async scrollToPosition(
    position: 'top' | 'bottom' | 'element',
    element?: HTMLElement
  ): Promise<void> {
    if (position === 'top') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (position === 'bottom') {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    } else if (position === 'element' && element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    await new Promise(r => setTimeout(r, 500));
  }

  /**
   * 获取元素的背景图片URL
   */
  static getBackgroundImageUrl(el: HTMLElement): string {
    const bg = window.getComputedStyle(el).backgroundImage || '';
    const match = bg.match(/url\((['"]?)(.*?)\1\)/i);
    return (match?.[2] || '').trim();
  }

  /**
   * 延时函数
   */
  static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
