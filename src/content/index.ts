import { ExtractionResult, ChatMessage } from '../utils/types';
import { Readability } from '@mozilla/readability';
import { showDebugPanel, startDebugSession, stopDebugSession, getDebugSessionStatus } from '../utils/remoteDebug';

console.log('Chat Export Content Script Loaded');

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
  
  return false;
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'EXTRACT_CONTENT') {
    extractContent()
      .then(data => {
        sendResponse({ type: 'CONTENT_EXTRACTED', payload: data });
      })
      .catch(err => {
        sendResponse({ type: 'ERROR', payload: err.message });
      });
    return true; // Keep channel open for async response
  }
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

// 评论分页/加载更多选择器
const COMMENT_PAGINATION_SELECTORS = [
  // 下一页按钮
  '.comment-pagination .next', '.comments .next-page',
  '[class*="comment"] [class*="next"]',
  '[class*="comment"] [class*="more"]',
  // 加载更多按钮
  '.load-more-comments', '.show-more-comments',
  '[class*="comment"] .load-more',
  '[class*="comment"] .show-more',
  // 通用分页
  '.pagination .next', '.pager .next',
  // 文字匹配
  'button', 'a', 'div[role="button"]',
];

const COMMENT_PAGINATION_TEXTS = [
  '下一页', '加载更多', '查看更多', '展开更多评论', '更多评论',
  'Next', 'Load More', 'Show More', 'More Comments', 'View More',
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

async function extractGenericPage(): Promise<ExtractionResult> {
  console.log('[Memoraid] 开始增强版内容抓取...');
  
  // 1. 先展开正文的"阅读全文"
  await autoExpandContent();
  
  // 2. 展开评论区的折叠内容（最多5次）
  await expandFoldedContent();
  
  // 3. 加载更多评论页（最多5页）
  await loadMoreComments();

  let mainContent = '';
  let title = document.title || 'Web Page Content';
  
  // 4. 提取正文内容
  try {
    const documentClone = document.cloneNode(true) as Document;
    const reader = new Readability(documentClone);
    const article = reader.parse();
    title = article?.title || title;
    mainContent = article?.textContent || document.body.innerText;
  } catch (error) {
    console.warn('[Memoraid] Readability extraction failed, falling back to body text', error);
    mainContent = document.body.innerText;
  }

  // 5. 提取评论内容
  const comments = extractComments();
  
  // 6. 提取正文中的链接
  const links = extractArticleLinks();
  
  // 7. 获取链接内容（最多10个）
  const linkContents = await fetchLinkContents(links);

  // 8. 组装最终内容
  let fullContent = `【正文内容】\n\n${mainContent.trim()}`;
  
  if (comments.length > 0) {
    fullContent += `\n\n【评论区内容】（共${comments.length}条）\n\n${comments.join('\n\n---\n\n')}`;
  }
  
  if (linkContents.length > 0) {
    fullContent += `\n\n【相关链接内容】（共${linkContents.length}个）\n\n`;
    linkContents.forEach((lc, idx) => {
      fullContent += `\n--- 链接${idx + 1}: ${lc.url} ---\n${lc.content}\n`;
    });
  }

  console.log(`[Memoraid] 抓取完成: 正文${mainContent.length}字, ${comments.length}条评论, ${linkContents.length}个链接内容`);

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
 * 展开折叠的评论/回复内容（最多5次）
 */
async function expandFoldedContent(): Promise<void> {
  console.log('[Memoraid] 尝试展开折叠内容...');
  let expandCount = 0;
  
  for (let i = 0; i < EXTRACTION_CONFIG.MAX_FOLD_EXPAND; i++) {
    let expanded = false;
    
    // 1. 通过选择器查找折叠按钮
    for (const selector of FOLD_SELECTORS) {
      const elements = document.querySelectorAll(selector);
      for (const el of Array.from(elements)) {
        const htmlEl = el as HTMLElement;
        if (isElementVisible(htmlEl) && !htmlEl.dataset.memoraidExpanded) {
          const text = htmlEl.innerText?.trim() || '';
          // 检查是否是展开按钮（通过文字判断）
          if (FOLD_TEXTS.some(t => text.includes(t)) || text.match(/\d+\s*(条回复|replies|条评论)/)) {
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
        if (isElementVisible(htmlEl) && 
            !htmlEl.dataset.memoraidExpanded &&
            text.length < 30 &&
            FOLD_TEXTS.some(t => text.includes(t))) {
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
}

/**
 * 加载更多评论（翻页，最多5页）
 */
async function loadMoreComments(): Promise<void> {
  console.log('[Memoraid] 尝试加载更多评论...');
  let pageCount = 0;
  
  for (let i = 0; i < EXTRACTION_CONFIG.MAX_COMMENT_PAGES; i++) {
    let loaded = false;
    
    // 1. 通过选择器查找分页/加载更多按钮
    for (const selector of COMMENT_PAGINATION_SELECTORS) {
      const elements = document.querySelectorAll(selector);
      for (const el of Array.from(elements)) {
        const htmlEl = el as HTMLElement;
        const text = htmlEl.innerText?.trim() || '';
        
        // 检查是否在评论区内或是评论相关的分页
        const isInCommentArea = htmlEl.closest('[class*="comment"], [id*="comment"], .comments, #comments') !== null;
        const isCommentPagination = COMMENT_PAGINATION_TEXTS.some(t => text.includes(t));
        
        if (isElementVisible(htmlEl) && 
            !htmlEl.dataset.memoraidClicked &&
            (isInCommentArea || isCommentPagination) &&
            text.length < 30) {
          try {
            htmlEl.click();
            htmlEl.dataset.memoraidClicked = 'true';
            loaded = true;
            pageCount++;
            console.log(`[Memoraid] 加载更多评论: "${text.substring(0, 20)}..." (第${pageCount}页)`);
            await sleep(EXTRACTION_CONFIG.PAGE_WAIT_TIME);
            break;
          } catch (e) {
            console.warn('[Memoraid] 点击加载更多失败:', e);
          }
        }
      }
      if (loaded) break;
    }
    
    if (!loaded) {
      console.log(`[Memoraid] 没有更多评论页，共加载${pageCount}页`);
      break;
    }
  }
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
 * 提取正文中的链接
 */
function extractArticleLinks(): string[] {
  const links: string[] = [];
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
        links.push(href);
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
 * 获取链接内容（通过 background script）
 */
async function fetchLinkContents(links: string[]): Promise<Array<{url: string, content: string}>> {
  if (links.length === 0) return [];
  
  console.log(`[Memoraid] 开始获取${links.length}个链接的内容...`);
  const results: Array<{url: string, content: string}> = [];
  
  for (const url of links) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'FETCH_LINK_CONTENT',
        payload: { url, timeout: EXTRACTION_CONFIG.LINK_FETCH_TIMEOUT }
      });
      
      if (response && response.success && response.content) {
        // 截取前2000字符，避免内容过长
        const content = response.content.substring(0, 2000);
        results.push({ url, content });
        console.log(`[Memoraid] 获取链接内容成功: ${url.substring(0, 50)}... (${content.length}字)`);
      }
    } catch (e) {
      console.warn(`[Memoraid] 获取链接内容失败: ${url}`, e);
    }
  }
  
  console.log(`[Memoraid] 成功获取${results.length}个链接内容`);
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
