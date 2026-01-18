/**
 * 编辑器操作工具类
 * 提供统一的编辑器内容操作功能
 */

import { DOMHelper } from './domHelper';

export interface ImagePlaceholder {
  text: string;
  keyword: string;
  position: number;
}

export class EditorHelper {
  /**
   * 查找图片占位符
   */
  static findImagePlaceholders(editor: HTMLElement): ImagePlaceholder[] {
    const content = editor.innerText || '';
    const placeholders: ImagePlaceholder[] = [];
    
    const patterns = [
      /\[图片[：:]\s*([^\]]+)\]/g,
      /【图片[：:]\s*([^】]+)】/g,
      /\[IMAGE[：:]\s*([^\]]+)\]/gi,
      /\{\{image[：:]\s*([^}]+)\}\}/gi,
      /\[插入图片[：:]\s*([^\]]+)\]/g,
      /\[配图[：:]\s*([^\]]+)\]/g,
      /【配图[：:]\s*([^】]+)】/g,
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        placeholders.push({
          text: match[0],
          keyword: match[1].trim(),
          position: match.index
        });
      }
    }
    
    // 按位置排序
    placeholders.sort((a, b) => a.position - b.position);
    return placeholders;
  }

  /**
   * 在编辑器中选中文本
   */
  static selectTextInEditor(editor: HTMLElement, searchText: string): boolean {
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
    let node: Node | null;
    
    while ((node = walker.nextNode())) {
      if (node.textContent && node.textContent.includes(searchText)) {
        const range = document.createRange();
        const startIndex = node.textContent.indexOf(searchText);
        range.setStart(node, startIndex);
        range.setEnd(node, startIndex + searchText.length);
        
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        
        node.parentElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return true;
      }
    }
    return false;
  }

  /**
   * 删除编辑器中的指定文本
   */
  static async deleteTextInEditor(
    editor: HTMLElement,
    searchText: string
  ): Promise<boolean> {
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
          await DOMHelper.sleep(200);
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
      
      await DOMHelper.sleep(300);
    }
    
    // 最后检查
    const finalContent = editor.innerText || '';
    return !finalContent.includes(searchText);
  }

  /**
   * 将光标移动到编辑器指定位置
   */
  static moveCursorToPosition(
    editor: HTMLElement,
    position: 'start' | 'end' | 'afterText',
    afterText?: string
  ): boolean {
    editor.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    
    if (position === 'start') {
      range.setStart(editor, 0);
      range.collapse(true);
    } else if (position === 'end') {
      range.selectNodeContents(editor);
      range.collapse(false);
    } else if (position === 'afterText' && afterText) {
      const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        if (node.textContent && node.textContent.includes(afterText)) {
          const endIndex = node.textContent.indexOf(afterText) + afterText.length;
          range.setStart(node, endIndex);
          range.collapse(true);
          break;
        }
      }
    }
    
    selection?.removeAllRanges();
    selection?.addRange(range);
    return true;
  }

  /**
   * 在编辑器中插入HTML内容
   */
  static insertHTML(editor: HTMLElement, html: string): void {
    editor.focus();
    document.execCommand('insertHTML', false, html);
  }

  /**
   * 在编辑器中插入文本
   */
  static insertText(editor: HTMLElement, text: string): void {
    editor.focus();
    document.execCommand('insertText', false, text);
  }

  /**
   * 获取编辑器内容
   */
  static getContent(editor: HTMLElement): string {
    return editor.innerText || '';
  }

  /**
   * 清空编辑器内容
   */
  static clearContent(editor: HTMLElement): void {
    editor.innerHTML = '';
    editor.innerText = '';
  }

  /**
   * 检查编辑器是否为空
   */
  static isEmpty(editor: HTMLElement): boolean {
    const content = editor.innerText?.trim();
    return !content || content === '请输入正文' || content === '从这里开始写正文';
  }
}
