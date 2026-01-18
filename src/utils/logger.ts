/**
 * 通用Logger UI类
 * 提供统一的日志显示界面
 */

export interface LoggerOptions {
  id: string;
  title: string;
  titleIcon?: string;
  position?: 'left' | 'right';
  color?: string;
}

export class Logger {
  private container: HTMLDivElement;
  private logContent: HTMLDivElement;
  private stopBtn: HTMLButtonElement;
  private copyBtn: HTMLButtonElement;
  private onStop?: () => void;

  constructor(options: LoggerOptions) {
    const {
      id,
      title,
      titleIcon = '🤖',
      position = 'left',
      color = '#0af'
    } = options;

    this.container = document.createElement('div');
    this.container.id = `memoraid-${id}-logger`;
    
    const left = position === 'left' ? '20px' : 'auto';
    const right = position === 'right' ? '20px' : 'auto';
    
    this.container.style.cssText = `
      position: fixed;
      top: 20px;
      left: ${left};
      right: ${right};
      width: 380px;
      max-height: 500px;
      background: rgba(0, 0, 0, 0.9);
      color: ${color};
      font-family: Consolas, Monaco, monospace;
      font-size: 12px;
      border-radius: 8px;
      padding: 12px;
      z-index: 20000;
      display: none;
      flex-direction: column;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
      border: 1px solid ${color};
    `;

    // 创建头部
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #444;
      padding-bottom: 8px;
      margin-bottom: 8px;
    `;
    
    const titleEl = document.createElement('span');
    titleEl.innerHTML = `${titleIcon} <span style="color:#fff;font-weight:bold;">Memoraid</span> ${title}`;
    
    const controls = document.createElement('div');
    controls.style.cssText = 'display: flex; gap: 6px;';

    // 停止按钮
    this.stopBtn = document.createElement('button');
    this.stopBtn.innerText = '停止';
    this.stopBtn.style.cssText = `
      background: #d32f2f;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 3px 8px;
      cursor: pointer;
      font-size: 11px;
      display: none;
    `;
    this.stopBtn.onclick = () => {
      if (this.onStop) this.onStop();
      this.log('🛑 已停止', 'error');
      this.stopBtn.style.display = 'none';
    };

    // 复制按钮
    this.copyBtn = document.createElement('button');
    this.copyBtn.innerText = '复制';
    this.copyBtn.style.cssText = `
      background: #1976d2;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 3px 8px;
      cursor: pointer;
      font-size: 11px;
    `;
    this.copyBtn.onclick = () => {
      navigator.clipboard.writeText(this.logContent.innerText);
      this.copyBtn.innerText = '已复制';
      setTimeout(() => {
        this.copyBtn.innerText = '复制';
      }, 1500);
    };

    // 关闭按钮
    const closeBtn = document.createElement('span');
    closeBtn.innerText = '✕';
    closeBtn.style.cssText = `
      cursor: pointer;
      color: #888;
      font-size: 16px;
      margin-left: 8px;
    `;
    closeBtn.onclick = () => {
      if (this.onStop) this.onStop();
      this.container.style.display = 'none';
    };

    controls.appendChild(this.stopBtn);
    controls.appendChild(this.copyBtn);
    controls.appendChild(closeBtn);
    header.appendChild(titleEl);
    header.appendChild(controls);

    // 创建日志内容区域
    this.logContent = document.createElement('div');
    this.logContent.style.cssText = `
      overflow-y: auto;
      flex: 1;
      min-height: 100px;
      max-height: 400px;
    `;

    this.container.appendChild(header);
    this.container.appendChild(this.logContent);
    document.body.appendChild(this.container);
  }

  show(): void {
    this.container.style.display = 'flex';
  }

  hide(): void {
    this.container.style.display = 'none';
  }

  setStopCallback(cb: () => void): void {
    this.onStop = cb;
    this.stopBtn.style.display = 'block';
  }

  hideStopButton(): void {
    this.stopBtn.style.display = 'none';
  }

  clear(): void {
    this.logContent.innerHTML = '';
  }

  log(
    message: string,
    type: 'info' | 'action' | 'error' | 'success' | 'warn' = 'info'
  ): void {
    this.show();
    const line = document.createElement('div');
    line.style.cssText = `
      margin-top: 4px;
      word-wrap: break-word;
      white-space: pre-wrap;
      line-height: 1.4;
    `;
    
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    
    const colors: Record<string, string> = {
      info: '#aaa',
      action: '#0ff',
      error: '#f55',
      success: '#4f4',
      warn: '#fb0'
    };
    
    const icons: Record<string, string> = {
      info: 'ℹ️',
      action: '▶️',
      error: '❌',
      success: '✅',
      warn: '⚠️'
    };
    
    line.innerHTML = `
      <span style="color:#555">[${time}]</span>
      ${icons[type]}
      <span style="color:${colors[type]}">${this.escapeHtml(message)}</span>
    `;
    
    this.logContent.appendChild(line);
    this.logContent.scrollTop = this.logContent.scrollHeight;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
