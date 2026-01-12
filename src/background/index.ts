import OpenAI from 'openai';
import { marked } from 'marked';
import { getSettings, saveSettings, DEFAULT_SETTINGS, addHistoryItem } from '../utils/storage';
import { ExtractionResult, ActiveTask, ChatMessage } from '../utils/types';
import { generateArticlePrompt, TOUTIAO_DEFAULT_PROMPT, WEIXIN_DEFAULT_PROMPT, ZHIHU_DEFAULT_PROMPT } from '../utils/prompts';
import { generateRandomString } from '../utils/crypto';

console.log('Background service worker started');

let currentTask: ActiveTask | null = null;
let abortController: AbortController | null = null;

// Initialize state from storage on startup
chrome.storage.local.get(['currentTask'], (result) => {
  if (result.currentTask) {
    currentTask = result.currentTask;
  }
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
});

// ========== Cookie 自动更新监听器 ==========
// 当用户登录/退出平台时，自动更新设置中的 cookie

// 防抖定时器，避免频繁更新
let cookieUpdateTimers: { [key: string]: NodeJS.Timeout } = {};

// 监听 cookie 变化
chrome.cookies.onChanged.addListener(async (changeInfo) => {
  const { cookie } = changeInfo;
  const domain = cookie.domain;
  
  // 判断是哪个平台的 cookie 变化
  let platform: 'toutiao' | 'zhihu' | 'weixin' | null = null;
  
  if (domain.includes('toutiao.com')) {
    platform = 'toutiao';
  } else if (domain.includes('zhihu.com')) {
    platform = 'zhihu';
  } else if (domain.includes('qq.com')) {
    platform = 'weixin';
  }
  
  if (!platform) return;
  
  // 使用防抖，避免短时间内多次 cookie 变化导致频繁更新
  // 等待 2 秒后再更新，确保所有 cookie 都已设置完成
  if (cookieUpdateTimers[platform]) {
    clearTimeout(cookieUpdateTimers[platform]);
  }
  
  cookieUpdateTimers[platform] = setTimeout(async () => {
    console.log(`[Cookie Monitor] Detected ${platform} cookie change, auto-updating...`);
    await updatePlatformCookie(platform!);
    delete cookieUpdateTimers[platform!];
  }, 2000);
});

// 更新指定平台的 cookie
async function updatePlatformCookie(platform: 'toutiao' | 'zhihu' | 'weixin') {
  try {
    const settings = await getSettings();
    const now = Date.now() / 1000;
    
    let url: string;
    let settingsKey: 'toutiao' | 'zhihu' | 'weixin';
    
    switch (platform) {
      case 'toutiao':
        url = 'https://mp.toutiao.com/';
        settingsKey = 'toutiao';
        break;
      case 'zhihu':
        url = 'https://zhuanlan.zhihu.com/';
        settingsKey = 'zhihu';
        break;
      case 'weixin':
        url = 'https://mp.weixin.qq.com/';
        settingsKey = 'weixin';
        break;
    }
    
    // 使用 URL 方式获取该平台所有有效的 cookie
    const cookies = await chrome.cookies.getAll({ url });
    
    // 过滤：只保留未过期且有值的 cookie
    const validCookies = cookies.filter(c => {
      if (c.expirationDate && c.expirationDate < now) return false;
      if (!c.value || c.value.trim() === '') return false;
      return true;
    });
    
    if (validCookies.length > 0) {
      const cookieStr = validCookies.map(c => `${c.name}=${c.value}`).join('; ');
      
      // 检查 cookie 是否有变化，避免无意义的更新
      const currentCookie = settings[settingsKey]?.cookie || '';
      if (cookieStr !== currentCookie) {
        console.log(`[Cookie Monitor] Updating ${platform} cookie (${validCookies.length} cookies)`);
        
        const newSettings = {
          ...settings,
          [settingsKey]: {
            ...settings[settingsKey],
            cookie: cookieStr
          }
        };
        
        await saveSettings(newSettings);
        console.log(`[Cookie Monitor] ${platform} cookie updated successfully`);
      }
    } else {
      // 没有有效 cookie，可能是用户退出登录了
      // 清空设置中的 cookie
      const currentCookie = settings[settingsKey]?.cookie || '';
      if (currentCookie) {
        console.log(`[Cookie Monitor] ${platform} cookies cleared (user logged out?)`);
        
        const newSettings = {
          ...settings,
          [settingsKey]: {
            ...settings[settingsKey],
            cookie: ''
          }
        };
        
        await saveSettings(newSettings);
      }
    }
  } catch (error) {
    console.error(`[Cookie Monitor] Failed to update ${platform} cookie:`, error);
  }
}

// Listen for messages from Popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'START_LOGIN') {
    handleLogin(message.payload.provider)
      .then(() => sendResponse({ success: true }))
      .catch((e: any) => sendResponse({ success: false, error: e.message || String(e) }));
    return true; 
  }

  if (message.type === 'START_SUMMARIZATION') {
    startSummarization(message.payload);
    sendResponse({ success: true });
    return true; // async response
  }

  if (message.type === 'START_ARTICLE_GENERATION') {
    startArticleGeneration(message.payload);
    sendResponse({ success: true });
    return true; // async response
  }
  
  if (message.type === 'START_REFINEMENT') {
    const { messages, title } = message.payload;
    startRefinement(messages, title);
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'PUBLISH_TO_TOUTIAO') {
    handlePublishToToutiao(message.payload);
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'PUBLISH_TO_ZHIHU') {
    handlePublishToZhihu(message.payload);
    sendResponse({ success: true });
    return true;
  }

  // 一键生成文章并发布到头条
  if (message.type === 'GENERATE_AND_PUBLISH_TOUTIAO') {
    startArticleGenerationAndPublish(message.payload, 'toutiao');
    sendResponse({ success: true });
    return true;
  }

  // 一键生成文章并发布到知乎
  if (message.type === 'GENERATE_AND_PUBLISH_ZHIHU') {
    startArticleGenerationAndPublish(message.payload, 'zhihu');
    sendResponse({ success: true });
    return true;
  }

  // 一键生成文章并发布到微信公众号
  if (message.type === 'GENERATE_AND_PUBLISH_WEIXIN') {
    startArticleGenerationAndPublish(message.payload, 'weixin');
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'PUBLISH_TO_WEIXIN') {
    handlePublishToWeixin(message.payload);
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'CANCEL_SUMMARIZATION') {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    stopTimer(); // Ensure timer stops immediately
    currentTask = null;
    chrome.storage.local.remove('currentTask');
    broadcastUpdate();
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'GET_STATUS') {
    // Return the memory state which should be in sync with storage
    sendResponse(currentTask);
    return true;
  }
  
  if (message.type === 'CLEAR_STATUS') {
    currentTask = null;
    chrome.storage.local.remove('currentTask');
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'ANALYZE_SCREENSHOT') {
    handleAnalyzeScreenshot(message.payload)
      .then(result => sendResponse({ success: true, result }))
      .catch(e => sendResponse({ success: false, error: e.message || String(e) }));
    return true;
  }

  // 处理链接内容获取请求（用于增强版内容抓取）
  if (message.type === 'FETCH_LINK_CONTENT') {
    fetchLinkContent(message.payload.url, message.payload.timeout)
      .then(content => sendResponse({ success: true, content }))
      .catch(e => sendResponse({ success: false, error: e.message || String(e) }));
    return true;
  }

  // 处理图片 OCR 识别请求（使用 AI 视觉能力识别图片中的文字）
  if (message.type === 'OCR_IMAGE') {
    handleOcrImage(message.payload.imageUrl)
      .then(text => sendResponse({ success: true, text }))
      .catch(e => sendResponse({ success: false, error: e.message || String(e) }));
    return true;
  }

  // 处理 PING 请求（用于检测扩展连接是否有效，特别是 bfcache 恢复后）
  if (message.type === 'PING') {
    sendResponse({ success: true, pong: true });
    return false; // 同步响应
  }
});

/**
 * 获取链接页面的文本内容
 * @param url 要获取的链接URL
 * @param timeout 超时时间（毫秒）
 */
async function fetchLinkContent(url: string, timeout: number = 5000): Promise<string> {
  console.log(`[Background] Fetching link content: ${url}`);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    
    // 简单提取文本内容（移除HTML标签）
    // 创建一个临时的DOM解析器
    const textContent = extractTextFromHtml(html);
    
    console.log(`[Background] Fetched ${textContent.length} chars from ${url}`);
    return textContent;
    
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

import Tesseract from 'tesseract.js';

/**
 * 使用 Tesseract.js 识别图片中的文字（OCR）
 * 不需要调用大模型 API，完全本地运行
 * @param imageUrl 图片的 URL 或 base64 data URL
 */
async function handleOcrImage(imageUrl: string): Promise<string> {
  console.log(`[Background] OCR image with Tesseract: ${imageUrl.substring(0, 100)}...`);
  
  try {
    // 如果是普通 URL，先获取图片并转换为 base64
    let finalImageUrl = imageUrl;
    if (!imageUrl.startsWith('data:')) {
      try {
        const response = await fetch(imageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          }
        });
        if (response.ok) {
          const blob = await response.blob();
          const arrayBuffer = await blob.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
          const mimeType = blob.type || 'image/jpeg';
          finalImageUrl = `data:${mimeType};base64,${base64}`;
        }
      } catch (e) {
        console.warn('[Background] Failed to fetch image, using original URL:', e);
        // 继续使用原始 URL
      }
    }

    console.log('[Background] Starting Tesseract OCR...');
    
    // 使用 Tesseract.js 进行 OCR
    // 支持中文(chi_sim)和英文(eng)
    const result = await Tesseract.recognize(
      finalImageUrl,
      'chi_sim+eng', // 同时识别简体中文和英文
      {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`[Background] OCR progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      }
    );

    const text = result.data.text.trim();
    console.log(`[Background] OCR result: ${text.substring(0, 100)}...`);
    
    if (!text || text.length === 0) {
      return '无文字内容';
    }
    
    return text;
    
  } catch (error: any) {
    console.error('[Background] Tesseract OCR failed:', error);
    throw new Error(`OCR 识别失败: ${error.message}`);
  }
}

/**
 * 从HTML中提取纯文本内容
 */
function extractTextFromHtml(html: string): string {
  // 移除script和style标签及其内容
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');
  
  // 移除HTML注释
  text = text.replace(/<!--[\s\S]*?-->/g, '');
  
  // 移除所有HTML标签
  text = text.replace(/<[^>]+>/g, ' ');
  
  // 解码HTML实体
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&ldquo;/g, '"');
  text = text.replace(/&rdquo;/g, '"');
  text = text.replace(/&lsquo;/g, "'");
  text = text.replace(/&rsquo;/g, "'");
  text = text.replace(/&mdash;/g, '—');
  text = text.replace(/&ndash;/g, '–');
  text = text.replace(/&#\d+;/g, ''); // 移除其他数字实体
  
  // 清理多余空白
  text = text.replace(/\s+/g, ' ');
  text = text.trim();
  
  return text;
}

async function handleAnalyzeScreenshot({ prompt, history }: { prompt: string, history?: any[] }) {
  try {
    const settings = await getSettings();
    let effectiveApiKey = settings.apiKeys?.[settings.provider] || settings.apiKey;
    
    if (!effectiveApiKey) {
      throw new Error(`API Key for ${settings.provider} is missing.`);
    }

    // 1. Capture Screenshot
    // Note: captureVisibleTab works in background script for the active tab of the current window
    // @ts-ignore - Chrome API types can be tricky with optional arguments
    const dataUrl = await chrome.tabs.captureVisibleTab(undefined, { format: 'jpeg', quality: 60 });

    const openai = new OpenAI({
      apiKey: effectiveApiKey,
      baseURL: settings.baseUrl,
    });

    // 2. Call AI with Vision
    const messages = [
        ...(history || []),
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { 
              type: "image_url", 
              image_url: { 
                url: dataUrl,
                detail: "low" // Use low detail for speed and cost, usually enough for UI buttons
              } 
            }
          ]
        } as any // Cast to any to avoid type issues if installed SDK is slightly old
      ];

    const response = await openai.chat.completions.create({
      model: settings.model,
      messages: messages,
      max_tokens: 300
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('Screenshot analysis failed:', error);
    throw error;
  }
}


function updateTaskState(newState: Partial<ActiveTask>) {
  currentTask = { ...currentTask, ...newState } as ActiveTask;
  chrome.storage.local.set({ currentTask });
  broadcastUpdate();
}

let timerInterval: NodeJS.Timeout | null = null;
let startTime: number = 0;

function startTimer(baseMessage: string) {
  if (timerInterval) clearInterval(timerInterval);
  startTime = Date.now();
  
  timerInterval = setInterval(() => {
    if (!currentTask) {
      if (timerInterval) clearInterval(timerInterval);
      return;
    }
    
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const message = `${baseMessage} (${elapsed}s)`;
    
    // Update task state without broadcasting every second to avoid UI flicker overkill, 
    // but here we want to show it, so we update storage and broadcast.
    // To optimize, maybe only broadcast if popup is open? 
    // For now, we update the task state.
    currentTask = { ...currentTask, message };
    chrome.storage.local.set({ currentTask });
    broadcastUpdate();
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

async function startRefinement(messages: ChatMessage[], title?: string) {
  try {
    abortController = new AbortController();
    // Clear previous task state to avoid pollution, but we will merge new state in updateTaskState
    // so we set currentTask to empty object first if we want a fresh start, 
    // OR we just rely on overwriting fields.
    // For refinement, we want to ensure we track the title.
    
    // Explicitly set the initial state for refinement
    currentTask = {
      status: 'Refining...', 
      message: 'Initializing refinement...', 
      progress: 5,
      conversationHistory: messages,
      title: title
    };
    chrome.storage.local.set({ currentTask });
    broadcastUpdate();

    const settings = await getSettings();
    let effectiveApiKey = settings.apiKeys?.[settings.provider] || settings.apiKey;
    
    if (!effectiveApiKey) {
      throw new Error(`API Key for ${settings.provider} is missing. Please check settings.`);
    }

    const openai = new OpenAI({
      apiKey: effectiveApiKey,
      baseURL: settings.baseUrl,
    });

    updateTaskState({ 
      status: 'Refining...', 
      message: 'Sending instructions to AI...', 
      progress: 30,
      conversationHistory: messages
    });

    // Stream handling logic
    const stream = await openai.chat.completions.create({
      model: settings.model,
      messages: [
        { 
          role: 'system', 
          content: 'You are an expert technical editor. The conversation history contains a markdown document generated by an assistant. The user will ask for changes, optimizations, or extensions to this specific document. You must REWRITE the entire document incorporating these changes based on the existing content. Return ONLY the updated markdown content. Do not generate a new document from scratch unless explicitly asked. Do not include conversational filler like "Here is the updated version".' 
        },
        ...messages.filter(m => m.role !== 'system'),
      ] as any,
      stream: true,
    }, { signal: abortController.signal });

    const baseMessage = 'Generating response...';
    startTimer(baseMessage);

    let refinedContent = '';
    let lastUpdate = Date.now();
    
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      refinedContent += content;
      
      // Throttle updates to UI every 500ms
      const now = Date.now();
      if (now - lastUpdate > 500) {
        lastUpdate = now;
        // Update in-memory task state and broadcast, but AVOID storage writes for performance
        currentTask = {
          ...currentTask,
          status: 'Refining...',
          message: `${baseMessage} (${Math.floor(refinedContent.length / 100)}k chars)`,
          result: refinedContent, // Live preview
          progress: 50 + Math.min(40, Math.floor(refinedContent.length / 50)) // Fake progress based on length
        } as ActiveTask;
        broadcastUpdate();
      }
    }
    
    stopTimer();

    updateTaskState({ 
      status: 'Refining...', 
      message: 'Processing response...', 
      progress: 90,
      conversationHistory: messages
    });
    
    // Update history with assistant response
    const updatedHistory: ChatMessage[] = [
      ...messages,
      { role: 'assistant', content: refinedContent }
    ];

    // Generate new versioned title
    let newTitle = title || 'Untitled Chat';
    const versionMatch = newTitle.match(/\(v(\d+)\)$/);
    if (versionMatch) {
      const version = parseInt(versionMatch[1], 10) + 1;
      newTitle = newTitle.replace(/\(v\d+\)$/, `(v${version})`);
    } else {
      newTitle = `${newTitle} (v2)`;
    }

    // Save to History
    const newItem = {
      id: Date.now().toString(),
      title: newTitle,
      date: Date.now(),
      content: refinedContent,
      url: '' // We might not have URL here, but that's okay for refined docs
    };
    await addHistoryItem(newItem);

    updateTaskState({ 
      status: 'Refined!', 
      message: 'Refinement complete!',
      progress: 100, 
      result: refinedContent,
      conversationHistory: updatedHistory,
      title: newTitle
    });

  } catch (error: any) {
    stopTimer();
    if (error.name === 'AbortError') {
      console.log('Refinement cancelled');
      return;
    }
    console.error('Refinement error:', error);
    updateTaskState({ 
      status: 'Error', 
      message: error.message || 'Refinement failed',
      progress: 0, 
      error: error.message,
      conversationHistory: messages // Keep history so user can retry
    });
  } finally {
    abortController = null;
    stopTimer();
  }
}

async function startSummarization(extraction: ExtractionResult) {
  try {
    abortController = new AbortController();
    
    // Explicitly reset task for new summarization
    currentTask = { 
      status: 'Processing...', 
      message: 'Initializing...', 
      progress: 5,
      title: extraction.title 
    };
    chrome.storage.local.set({ currentTask });
    broadcastUpdate();

    const settings = await getSettings();
    
    // Determine the effective API Key:
    // 1. Try to get provider-specific key from the new apiKeys map
    // 2. Fallback to the legacy single 'apiKey' if not found
    let effectiveApiKey = settings.apiKeys?.[settings.provider] || settings.apiKey;
    
    // Special handling for 'custom' provider: might rely on the legacy field if not explicitly mapped,
    // but the UI now syncs custom key to apiKeys['custom'] too.
    
    if (!effectiveApiKey) {
      throw new Error(`API Key for ${settings.provider} is missing. Please check settings.`);
    }

    const openai = new OpenAI({
      apiKey: effectiveApiKey,
      baseURL: settings.baseUrl,
    });

    updateTaskState({ status: 'Processing...', message: 'Sending request to AI...', progress: 30 });

    // Format messages for better model understanding (avoid JSON confusion)
    const formattedContent = Array.isArray(extraction.messages) 
      ? extraction.messages.map((m: any) => `### ${m.role ? m.role.toUpperCase() : 'CONTENT'}:\n${m.content}`).join('\n\n')
      : String(extraction.messages);

    const initialMessages = [
      { role: 'system', content: settings.systemPrompt },
      { 
        role: 'user', 
        content: `Please summarize the following content from ${extraction.url}.\n\nTitle: ${extraction.title}\n\nContent:\n${formattedContent}` 
      }
    ];

    // Create a timeout promise that rejects after 180 seconds (extended for DeepSeek)
    // Note: For stream, we might want a "time to first byte" timeout instead, but 
    // keeping it simple for now: if the whole process takes > 3 mins, kill it.
    const timeoutId = setTimeout(() => {
        if (abortController) {
            abortController.abort();
            // We can't easily reject the await stream loop from outside, 
            // but aborting the controller will throw an AbortError in the loop.
        }
    }, 180000); 

    const stream = await openai.chat.completions.create({
      model: settings.model,
      messages: initialMessages as any,
      stream: true,
      temperature: 0.9, // 提高温度让回复更有创造性和多样化
    }, { signal: abortController.signal });

    const baseMessage = 'Generating summary...';
    // Initial update to show we are connected
    updateTaskState({ status: 'Processing...', message: baseMessage, progress: 50 });
    startTimer(baseMessage);

    let summary = '';
    let lastUpdate = Date.now();
    let hasReceivedContent = false;

    try {
        for await (const chunk of stream) {
            if (!hasReceivedContent) {
                // First byte received! Clear strict timeout and maybe set a longer one?
                // For now, we rely on the 3min global timeout or user cancel.
                hasReceivedContent = true;
            }

            const content = chunk.choices[0]?.delta?.content || '';
            summary += content;
            
            const now = Date.now();
            if (now - lastUpdate > 500) {
                lastUpdate = now;
                // Update in-memory task state and broadcast
                currentTask = {
                    ...currentTask,
                    status: 'Processing...',
                    message: `${baseMessage} (${Math.floor(summary.length / 100)}k chars)`,
                    result: summary, // Live preview
                    progress: 50 + Math.min(40, Math.floor(summary.length / 100))
                } as ActiveTask;
                broadcastUpdate();
            }
        }
    } finally {
        clearTimeout(timeoutId);
    }
    
    stopTimer();

    updateTaskState({ status: 'Processing...', message: 'Finalizing...', progress: 95 });
    
    // Improved content extraction logic:
    // 1. Check if the ENTIRE content is wrapped in a markdown code block.
    // We only extract if the code block starts at the beginning and ends at the end.
    // This prevents extracting a small internal code block (e.g. a Java example) and losing the rest of the document.
    const outerCodeBlockRegex = /^```(?:markdown)?\s*([\s\S]*?)\s*```$/i;
    const outerMatch = summary.trim().match(outerCodeBlockRegex);
    
    if (outerMatch && outerMatch[1]) {
        // Only if the whole thing is a block, we unwrap it.
        summary = outerMatch[1];
    } else {
        // Otherwise, just strip any accidental leading/trailing backticks if they look like wrappers
        // but be careful not to touch internal code blocks.
        // Actually, if it's not a full wrapper, we assume the content is raw markdown.
        // We just do a safety trim.
        summary = summary.trim();
    }

    // 2. Clean Front Matter: Ensure it starts exactly with "---"
    // Find the FIRST occurrence of "---\n" or "---\r\n" which signifies the start of Front Matter
    // We look for:
    // - "---" followed by newline
    // - followed by typical Front Matter keys like "title:", "date:", "layout:" to reduce false positives
    const frontMatterStartRegex = /---\s*\n(?:\s*title:|\s*date:|\s*layout:)/;
    const match = summary.match(frontMatterStartRegex);
    
    if (match) {
      // If we found a valid Front Matter start, discard everything before it
      summary = summary.slice(match.index);
    } else {
      // Relaxed fallback: just look for the first "---" followed by a newline if the strict check failed
      // This helps if the model output format is slightly off but still has Front Matter
      const simpleMatch = summary.match(/---\s*\n/);
      if (simpleMatch && summary.indexOf('title:', simpleMatch.index!) > simpleMatch.index!) {
         summary = summary.slice(simpleMatch.index);
      }
    }

    // 3. Ensure Title in Body: Check if the body (after Front Matter) starts with an H1 title
    // Find the end of Front Matter
    const frontMatterEndRegex = /^---\s*$/m;
    const frontMatterEndMatch = summary.substring(3).match(frontMatterEndRegex); // Skip first '---'

    if (frontMatterEndMatch) {
        // We found the closing '---'
        let bodyStartIndex = 3 + frontMatterEndMatch.index! + frontMatterEndMatch[0].length;
        let body = summary.substring(bodyStartIndex);
        
        // Remove stray code block fences immediately after Front Matter
        // This handles cases where LLM wraps output in ```markdown ... ``` and we only stripped the opening
        const strayFenceMatch = body.match(/^\s*```(?:markdown)?\s*\n?/);
        if (strayFenceMatch) {
            const matchLen = strayFenceMatch[0].length;
            summary = summary.substring(0, bodyStartIndex) + summary.substring(bodyStartIndex + matchLen);
            body = summary.substring(bodyStartIndex);
        }
        
        // Check if body starts with H1 (ignoring whitespace)
        if (!/^\s*#\s+/.test(body)) {
            // Insert title
            const titleToInsert = extraction.title || 'Untitled';
            summary = summary.substring(0, bodyStartIndex) + `\n\n# ${titleToInsert}\n` + body;
        }
    } else {
        // No valid Front Matter structure found (or only opening '---')
        // Check if the whole text starts with H1
        if (!/^\s*#\s+/.test(summary)) {
             const titleToInsert = extraction.title || 'Untitled';
             summary = `# ${titleToInsert}\n\n` + summary;
        }
    }

    // 4. Final Cleanup: Remove trailing code block fences
    summary = summary.trim();
    if (summary.endsWith('```')) {
        summary = summary.substring(0, summary.length - 3).trim();
    }

    // Save to History
    const newItem = {
      id: Date.now().toString(),
      title: extraction.title || 'Untitled Chat',
      date: Date.now(),
      content: summary,
      url: extraction.url
    };
    
    await addHistoryItem(newItem);

    updateTaskState({ 
      status: 'Done!', 
      message: 'Summary generated successfully!',
      progress: 100, 
      result: summary, 
      conversationHistory: [
        ...initialMessages as ChatMessage[],
        { role: 'assistant', content: summary }
      ]
    });

    // Set badge to indicate completion
    chrome.action.setBadgeText({ text: '1' });
    chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });

    // Send Notification
    const iconUrl = chrome.runtime.getURL('public/icon-128.png');
    chrome.notifications.create({
      type: 'basic',
      iconUrl: iconUrl,
      title: 'Chat Export Complete',
      message: `Summary generated for: ${extraction.title || 'Untitled Chat'}`
    }, (notificationId) => {
      if (chrome.runtime.lastError) {
        console.error('Notification failed:', chrome.runtime.lastError);
      } else {
        console.log('Notification sent:', notificationId);
      }
    });

  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log('Summarization cancelled');
      return; // Do nothing if cancelled
    }

    console.error('Summarization error:', error);
    updateTaskState({ 
      status: 'Error', 
      message: error.message || 'An error occurred',
      progress: 0, 
      error: error.message 
    });

    // Send Error Notification
    const iconUrl = chrome.runtime.getURL('public/icon-128.png');
    chrome.notifications.create({
      type: 'basic',
      iconUrl: iconUrl,
      title: 'Chat Export Failed',
      message: error.message || 'Unknown error occurred'
    });
  } finally {
    stopTimer();
    abortController = null;
  }
}

function broadcastUpdate() {
  chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', payload: currentTask }).catch(() => {
    // Popup might be closed, which is expected
  });
}

async function handlePublishToToutiao(payload: { title: string; content: string }) {
  try {
    const settings = await getSettings();
    const cookieStr = settings.toutiao?.cookie;

    if (cookieStr) {
      // Parse and set cookies
      // Cookies string format: key=value; key2=value2
      const cookies = cookieStr.split(';').map(c => c.trim()).filter(c => c);
      for (const cookie of cookies) {
        const separatorIndex = cookie.indexOf('=');
        if (separatorIndex === -1) continue;
        
        const name = cookie.substring(0, separatorIndex);
        const value = cookie.substring(separatorIndex + 1);
        
        if (name && value) {
          try {
            await chrome.cookies.set({
              url: 'https://mp.toutiao.com',
              domain: '.toutiao.com',
              name,
              value,
              path: '/',
              secure: true,
              sameSite: 'no_restriction'
            });
          } catch (e) {
            console.error(`Failed to set cookie ${name}`, e);
          }
        }
      }
    }

    // Clean up content before publishing
    let cleanedContent = payload.content;
    
    // 1. Remove "封面图建议" section (including variations)
    // Pattern: "封面图建议：..." or "### 封面图建议" or "## 封面图建议" followed by content until next heading or double newline
    cleanedContent = cleanedContent.replace(/^#{1,3}\s*封面图建议[：:].*/gm, ''); // Remove heading style
    cleanedContent = cleanedContent.replace(/^\*?\*?封面图建议\*?\*?[：:][^\n]*(\n(?![#\n])[^\n]*)*/gm, ''); // Remove paragraph style with continuation
    cleanedContent = cleanedContent.replace(/^封面图建议[：:][^\n]*\n?/gm, ''); // Simple single line
    
    // 2. Remove "Cover Image Suggestion" (English version)
    cleanedContent = cleanedContent.replace(/^#{1,3}\s*Cover Image Suggestion[：:].*/gim, '');
    cleanedContent = cleanedContent.replace(/^Cover Image Suggestion[：:][^\n]*\n?/gim, '');
    
    // 3. Remove "其他备选标题" / "备选标题" section (including all variations)
    // This removes the heading and all following lines until the next heading or double newline
    cleanedContent = cleanedContent.replace(/^#{1,3}\s*其他备选标题[：:]?.*(\n(?!#)[^\n]*)*/gm, '');
    cleanedContent = cleanedContent.replace(/^#{1,3}\s*备选标题[：:]?.*(\n(?!#)[^\n]*)*/gm, '');
    cleanedContent = cleanedContent.replace(/^\*?\*?其他备选标题\*?\*?[：:]?[^\n]*(\n(?![#\n])[^\n]*)*/gm, '');
    cleanedContent = cleanedContent.replace(/^\*?\*?备选标题\*?\*?[：:]?[^\n]*(\n(?![#\n])[^\n]*)*/gm, '');
    cleanedContent = cleanedContent.replace(/^其他备选标题[：:]?[^\n]*(\n(?![#\n])[^\n]*)*/gm, '');
    cleanedContent = cleanedContent.replace(/^备选标题[：:]?[^\n]*(\n(?![#\n])[^\n]*)*/gm, '');
    
    // 4. Remove blockquote style alternative titles (> 开头的备选标题列表)
    cleanedContent = cleanedContent.replace(/^>\s*[\d\.\-\*]*\s*[^>\n]*标题[^\n]*\n?/gm, '');
    cleanedContent = cleanedContent.replace(/^>\s*[\d\.\-\*]+[^\n]+\n?/gm, ''); // Remove numbered list in blockquote after title
    
    // 3. Clean up multiple consecutive blank lines
    cleanedContent = cleanedContent.replace(/\n{3,}/g, '\n\n');
    cleanedContent = cleanedContent.trim();
    
    // 4. Extract the real title from the content (H1 heading)
    let articleTitle = payload.title;
    const h1Match = cleanedContent.match(/^#\s+(.+)$/m);
    if (h1Match && h1Match[1]) {
      const extractedTitle = h1Match[1].trim();
      // Only use extracted title if it's meaningful (not generic)
      const genericTitles = ['微博搜索', 'Weibo Search', '搜索', 'Search', '主页', 'Home', 'Untitled'];
      const isGeneric = genericTitles.some(t => payload.title?.includes(t));
      if (isGeneric || !payload.title || payload.title.length < 3) {
        articleTitle = extractedTitle;
      }
      // If payload.title is meaningful, keep it but ensure it matches the H1
      // Actually, we should prefer the H1 title from the generated article
      if (extractedTitle.length > 3 && extractedTitle.length <= 30) {
        articleTitle = extractedTitle;
      }
    }
    
    // 5. Remove the H1 title from content (Toutiao has separate title field)
    cleanedContent = cleanedContent.replace(/^#\s+.+\n+/, '');
    cleanedContent = cleanedContent.trim();

    // Convert Markdown to HTML for Toutiao's rich text editor
    const htmlContent = await marked.parse(cleanedContent);

    // Save payload to storage for content script to pick up
    await chrome.storage.local.set({
      pending_toutiao_publish: {
        title: articleTitle,
        content: cleanedContent, // Keep cleaned markdown
        htmlContent: htmlContent, // Add converted HTML
        timestamp: Date.now()
      }
    });

    const tab = await chrome.tabs.create({
      url: 'https://mp.toutiao.com/profile_v4/graphic/publish',
      active: true
    });

    if (!tab.id) throw new Error('Failed to create tab');

    // The content script (src/content/toutiao.ts) will handle the rest
    console.log('Opened Toutiao publish page, waiting for content script to fill...');

  } catch (error) {
    console.error('Publish failed', error);
  }
}

async function handlePublishToZhihu(payload: { title: string; content: string }) {
  try {
    const settings = await getSettings();
    const cookieStr = settings.zhihu?.cookie;

    if (cookieStr) {
      // Parse and set cookies for zhihu.com
      const cookies = cookieStr.split(';').map(c => c.trim()).filter(c => c);
      for (const cookie of cookies) {
        const separatorIndex = cookie.indexOf('=');
        if (separatorIndex === -1) continue;
        
        const name = cookie.substring(0, separatorIndex);
        const value = cookie.substring(separatorIndex + 1);
        
        if (name && value) {
          try {
            await chrome.cookies.set({
              url: 'https://zhuanlan.zhihu.com',
              domain: '.zhihu.com',
              name,
              value,
              path: '/',
              secure: true,
              sameSite: 'no_restriction'
            });
          } catch (e) {
            console.error(`Failed to set Zhihu cookie ${name}`, e);
          }
        }
      }
    }

    // Clean up content before publishing
    let cleanedContent = payload.content;
    
    // Remove metadata sections similar to Toutiao
    cleanedContent = cleanedContent.replace(/^#{1,3}\s*封面图建议[：:].*/gm, '');
    cleanedContent = cleanedContent.replace(/^\*?\*?封面图建议\*?\*?[：:][^\n]*(\n(?![#\n])[^\n]*)*/gm, '');
    cleanedContent = cleanedContent.replace(/^封面图建议[：:][^\n]*\n?/gm, '');
    cleanedContent = cleanedContent.replace(/^#{1,3}\s*其他备选标题[：:]?.*(\n(?!#)[^\n]*)*/gm, '');
    cleanedContent = cleanedContent.replace(/^#{1,3}\s*备选标题[：:]?.*(\n(?!#)[^\n]*)*/gm, '');
    cleanedContent = cleanedContent.replace(/^\*?\*?其他备选标题\*?\*?[：:]?[^\n]*(\n(?![#\n])[^\n]*)*/gm, '');
    cleanedContent = cleanedContent.replace(/^\*?\*?备选标题\*?\*?[：:]?[^\n]*(\n(?![#\n])[^\n]*)*/gm, '');
    
    // Clean up multiple consecutive blank lines
    cleanedContent = cleanedContent.replace(/\n{3,}/g, '\n\n');
    cleanedContent = cleanedContent.trim();
    
    // Extract the real title from the content (H1 heading)
    let articleTitle = payload.title;
    const h1Match = cleanedContent.match(/^#\s+(.+)$/m);
    if (h1Match && h1Match[1]) {
      const extractedTitle = h1Match[1].trim();
      const genericTitles = ['微博搜索', 'Weibo Search', '搜索', 'Search', '主页', 'Home', 'Untitled'];
      const isGeneric = genericTitles.some(t => payload.title?.includes(t));
      if (isGeneric || !payload.title || payload.title.length < 3) {
        articleTitle = extractedTitle;
      }
      // 知乎标题限制100字
      if (extractedTitle.length > 3 && extractedTitle.length <= 100) {
        articleTitle = extractedTitle;
      }
    }
    
    // Remove the H1 title from content (Zhihu has separate title field)
    cleanedContent = cleanedContent.replace(/^#\s+.+\n+/, '');
    cleanedContent = cleanedContent.trim();

    // Convert Markdown to HTML for Zhihu's rich text editor
    const htmlContent = await marked.parse(cleanedContent);

    // Save payload to storage for content script to pick up
    await chrome.storage.local.set({
      pending_zhihu_publish: {
        title: articleTitle,
        content: cleanedContent,
        htmlContent: htmlContent,
        timestamp: Date.now()
      }
    });

    const tab = await chrome.tabs.create({
      url: 'https://zhuanlan.zhihu.com/write',
      active: true
    });

    if (!tab.id) throw new Error('Failed to create tab');

    // The content script (src/content/zhihu.ts) will handle the rest
    console.log('Opened Zhihu write page, waiting for content script to fill...');

  } catch (error) {
    console.error('Zhihu publish failed', error);
  }
}

async function handlePublishToWeixin(payload: { title: string; content: string }) {
  try {
    const settings = await getSettings();
    const cookieStr = settings.weixin?.cookie;

    if (cookieStr) {
      // Parse and set cookies for mp.weixin.qq.com
      const cookies = cookieStr.split(';').map(c => c.trim()).filter(c => c);
      for (const cookie of cookies) {
        const separatorIndex = cookie.indexOf('=');
        if (separatorIndex === -1) continue;
        
        const name = cookie.substring(0, separatorIndex);
        const value = cookie.substring(separatorIndex + 1);
        
        if (name && value) {
          try {
            await chrome.cookies.set({
              url: 'https://mp.weixin.qq.com',
              domain: '.qq.com',
              name,
              value,
              path: '/',
              secure: true,
              sameSite: 'no_restriction'
            });
          } catch (e) {
            console.error(`Failed to set Weixin cookie ${name}`, e);
          }
        }
      }
    }

    // Clean up content before publishing
    let cleanedContent = payload.content;
    
    // Remove metadata sections
    cleanedContent = cleanedContent.replace(/^#{1,3}\s*封面图建议[：:].*/gm, '');
    cleanedContent = cleanedContent.replace(/^\*?\*?封面图建议\*?\*?[：:][^\n]*(\n(?![#\n])[^\n]*)*/gm, '');
    cleanedContent = cleanedContent.replace(/^封面图建议[：:][^\n]*\n?/gm, '');
    cleanedContent = cleanedContent.replace(/^#{1,3}\s*其他备选标题[：:]?.*(\n(?!#)[^\n]*)*/gm, '');
    cleanedContent = cleanedContent.replace(/^#{1,3}\s*备选标题[：:]?.*(\n(?!#)[^\n]*)*/gm, '');
    cleanedContent = cleanedContent.replace(/^\*?\*?其他备选标题\*?\*?[：:]?[^\n]*(\n(?![#\n])[^\n]*)*/gm, '');
    cleanedContent = cleanedContent.replace(/^\*?\*?备选标题\*?\*?[：:]?[^\n]*(\n(?![#\n])[^\n]*)*/gm, '');
    
    // Clean up multiple consecutive blank lines
    cleanedContent = cleanedContent.replace(/\n{3,}/g, '\n\n');
    cleanedContent = cleanedContent.trim();
    
    // Extract the real title from the content (H1 heading)
    let articleTitle = payload.title;
    const h1Match = cleanedContent.match(/^#\s+(.+)$/m);
    if (h1Match && h1Match[1]) {
      const extractedTitle = h1Match[1].trim();
      const genericTitles = ['微博搜索', 'Weibo Search', '搜索', 'Search', '主页', 'Home', 'Untitled'];
      const isGeneric = genericTitles.some(t => payload.title?.includes(t));
      if (isGeneric || !payload.title || payload.title.length < 3) {
        articleTitle = extractedTitle;
      }
      // 微信公众号标题限制64字
      if (extractedTitle.length > 3 && extractedTitle.length <= 64) {
        articleTitle = extractedTitle;
      }
    }
    
    // Remove the H1 title from content (Weixin has separate title field)
    cleanedContent = cleanedContent.replace(/^#\s+.+\n+/, '');
    cleanedContent = cleanedContent.trim();

    // Convert Markdown to HTML for Weixin's rich text editor
    const htmlContent = await marked.parse(cleanedContent);

    // Save payload to storage for content script to pick up
    await chrome.storage.local.set({
      pending_weixin_publish: {
        title: articleTitle,
        content: cleanedContent,
        htmlContent: htmlContent,
        timestamp: Date.now()
      }
    });

    // 打开微信公众号首页
    // 内容脚本会检测登录状态并自动导航到图文编辑页面
    const tab = await chrome.tabs.create({
      url: 'https://mp.weixin.qq.com/',
      active: true
    });

    if (!tab.id) throw new Error('Failed to create tab');

    // The content script (src/content/weixin.ts) will handle the rest
    console.log('Opened Weixin publish page, waiting for content script to fill...');

  } catch (error) {
    console.error('Weixin publish failed', error);
  }
}

async function startArticleGeneration(extraction: ExtractionResult) {
  try {
    abortController = new AbortController();
    
    // Explicitly reset task for new generation
    currentTask = { 
      status: 'Processing...', 
      message: 'Initializing Article Generation...', 
      progress: 5,
      title: extraction.title 
    };
    chrome.storage.local.set({ currentTask });
    broadcastUpdate();

    const settings = await getSettings();
    
    let effectiveApiKey = settings.apiKeys?.[settings.provider] || settings.apiKey;
    
    if (!effectiveApiKey) {
      throw new Error(`API Key for ${settings.provider} is missing. Please check settings.`);
    }

    const openai = new OpenAI({
      apiKey: effectiveApiKey,
      baseURL: settings.baseUrl,
    });

    updateTaskState({ status: 'Processing...', message: 'Sending request to AI...', progress: 30 });

    const formattedContent = Array.isArray(extraction.messages) 
      ? extraction.messages.map((m: any) => `### ${m.role ? m.role.toUpperCase() : 'CONTENT'}:\n${m.content}`).join('\n\n')
      : String(extraction.messages);

    // 根据用户设置的文章风格生成动态提示词
    const articlePrompt = generateArticlePrompt(settings.articleStyle);

    const initialMessages = [
      { role: 'system', content: articlePrompt },
      { 
        role: 'user', 
        content: `请根据以下内容生成一篇自媒体文章。\n\n来源：${extraction.url}\n\n原标题：${extraction.title}\n\n内容：\n${formattedContent}` 
      }
    ];

    const timeoutId = setTimeout(() => {
        if (abortController) {
            abortController.abort();
        }
    }, 180000); 

    const stream = await openai.chat.completions.create({
      model: settings.model,
      messages: initialMessages as any,
      stream: true,
      temperature: 0.9, // 提高温度让回复更有创造性和多样化
    }, { signal: abortController.signal });

    const baseMessage = 'Generating article...';
    updateTaskState({ status: 'Processing...', message: baseMessage, progress: 50 });
    startTimer(baseMessage);

    let summary = '';
    let lastUpdate = Date.now();
    let hasReceivedContent = false;

    try {
        for await (const chunk of stream) {
            if (!hasReceivedContent) {
                hasReceivedContent = true;
            }

            const content = chunk.choices[0]?.delta?.content || '';
            summary += content;
            
            const now = Date.now();
            if (now - lastUpdate > 500) {
                lastUpdate = now;
                currentTask = {
                    ...currentTask,
                    status: 'Processing...',
                    message: `${baseMessage} (${Math.floor(summary.length / 100)}k chars)`,
                    result: summary,
                    progress: 50 + Math.min(40, Math.floor(summary.length / 100))
                } as ActiveTask;
                broadcastUpdate();
            }
        }
    } finally {
        clearTimeout(timeoutId);
    }
    
    stopTimer();

    updateTaskState({ status: 'Processing...', message: 'Finalizing...', progress: 95 });
    
    // Cleanup logic (similar to summarization)
    const outerCodeBlockRegex = /^```(?:markdown)?\s*([\s\S]*?)\s*```$/i;
    const outerMatch = summary.trim().match(outerCodeBlockRegex);
    
    if (outerMatch && outerMatch[1]) {
        summary = outerMatch[1];
    } else {
        summary = summary.trim();
    }

    // Basic Title Check (Article prompt asks for H1)
    const hasH1 = /^\s*#\s+/.test(summary);
    
    if (!hasH1) {
         const genericTitles = ['微博搜索', 'Weibo Search', '搜索', 'Search', '主页', 'Home'];
         const isGeneric = genericTitles.some(t => extraction.title?.includes(t));

         if (!isGeneric && extraction.title) {
             summary = `# ${extraction.title}\n\n` + summary;
         } else {
             // Try to promote first line as title if it looks like one
             const lines = summary.split('\n');
             const firstLine = lines[0]?.trim();
             if (firstLine && firstLine.length > 0 && firstLine.length < 100) {
                 // Remove existing bolding/formatting if any
                 const cleanTitle = firstLine.replace(/^\*\*|\*\*$/g, '').replace(/^#+\s*/, '');
                 summary = `# ${cleanTitle}\n\n` + lines.slice(1).join('\n');
             }
         }
    }

    // Cleanup trailing fences
    summary = summary.trim();
    if (summary.endsWith('```')) {
        summary = summary.substring(0, summary.length - 3).trim();
    }

    // 从生成的文章中提取真正的标题（H1）
    // 这样面板中显示的文件名就会和文章标题一致
    let finalTitle = extraction.title || 'Untitled Article';
    const h1TitleMatch = summary.match(/^#\s+(.+)$/m);
    if (h1TitleMatch && h1TitleMatch[1]) {
      const extractedTitle = h1TitleMatch[1].trim();
      // 如果提取的标题有意义（长度合适），就使用它
      if (extractedTitle.length >= 3 && extractedTitle.length <= 50) {
        finalTitle = extractedTitle;
      }
    }

    const newItem = {
      id: Date.now().toString(),
      title: finalTitle, // 使用从文章中提取的标题
      date: Date.now(),
      content: summary,
      url: extraction.url
    };
    
    await addHistoryItem(newItem);

    updateTaskState({ 
      status: 'Done!', 
      message: 'Article generated successfully!',
      progress: 100, 
      result: summary, 
      title: finalTitle, // 同步更新任务状态中的标题
      conversationHistory: [
        ...initialMessages as ChatMessage[],
        { role: 'assistant', content: summary }
      ]
    });

    chrome.action.setBadgeText({ text: '1' });
    chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });

    const iconUrl = chrome.runtime.getURL('public/icon-128.png');
    chrome.notifications.create({
      type: 'basic',
      iconUrl: iconUrl,
      title: 'Article Generation Complete',
      message: `Article generated for: ${finalTitle}`
    });

    // 注意：已移除自动发布功能
    // 用户可以在结果页面手动选择发布到头条或知乎

    return summary; // 返回生成的文章内容，供其他函数使用

  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log('Article generation cancelled');
      return null;
    }

    console.error('Article generation error:', error);
    updateTaskState({ 
      status: 'Error', 
      message: error.message || 'An error occurred',
      progress: 0, 
      error: error.message 
    });

    const iconUrl = chrome.runtime.getURL('public/icon-128.png');
    chrome.notifications.create({
      type: 'basic',
      iconUrl: iconUrl,
      title: 'Article Generation Failed',
      message: error.message || 'Unknown error occurred'
    });
    return null;
  } finally {
    stopTimer();
    abortController = null;
  }
}

// 一键生成文章并发布到指定平台
async function startArticleGenerationAndPublish(extraction: ExtractionResult, platform: 'toutiao' | 'zhihu' | 'weixin') {
  try {
    abortController = new AbortController();
    
    const platformName = platform === 'toutiao' ? '头条' : platform === 'zhihu' ? '知乎' : '公众号';
    
    // 初始化任务状态
    currentTask = { 
      status: 'Processing...', 
      message: `正在生成文章并准备发布到${platformName}...`, 
      progress: 5,
      title: extraction.title 
    };
    chrome.storage.local.set({ currentTask });
    broadcastUpdate();

    const settings = await getSettings();
    
    let effectiveApiKey = settings.apiKeys?.[settings.provider] || settings.apiKey;
    
    if (!effectiveApiKey) {
      throw new Error(`API Key for ${settings.provider} is missing. Please check settings.`);
    }

    const openai = new OpenAI({
      apiKey: effectiveApiKey,
      baseURL: settings.baseUrl,
    });

    updateTaskState({ status: 'Processing...', message: '正在发送请求到 AI...', progress: 20 });

    const formattedContent = Array.isArray(extraction.messages) 
      ? extraction.messages.map((m: any) => `### ${m.role ? m.role.toUpperCase() : 'CONTENT'}:\n${m.content}`).join('\n\n')
      : String(extraction.messages);

    // 根据用户设置的文章风格生成动态提示词（通用模板）
    const articlePrompt = generateArticlePrompt(settings.articleStyle);
    
    // 根据目标平台获取专属提示词
    // 通用提示词 + 平台专属提示词 = 完整提示词
    let platformPrompt = '';
    if (platform === 'toutiao') {
      // 头条：使用用户自定义提示词或默认头条提示词
      platformPrompt = settings.toutiao?.customPrompt || TOUTIAO_DEFAULT_PROMPT;
    } else if (platform === 'zhihu') {
      // 知乎：使用用户自定义提示词或默认知乎提示词
      platformPrompt = settings.zhihu?.customPrompt || ZHIHU_DEFAULT_PROMPT;
    } else if (platform === 'weixin') {
      // 公众号：使用用户自定义提示词或默认公众号提示词
      platformPrompt = settings.weixin?.customPrompt || WEIXIN_DEFAULT_PROMPT;
    }
    
    // 组合完整提示词：通用模板 + 平台专属指南
    const fullPrompt = `${articlePrompt}\n\n${platformPrompt}`;

    // 根据平台添加特殊提醒
    let platformReminder = '';
    if (platform === 'toutiao' || platform === 'zhihu') {
      platformReminder = `\n\n⚠️ 重要提醒：${platformName}平台的图片提示词必须是2-5个字的简短关键词（如"卫星"、"星空"），严禁使用长句子描述！`;
    } else if (platform === 'weixin') {
      platformReminder = `\n\n⚠️ 重要提醒：公众号平台的图片提示词需要15-50字的详细场景描述，用于AI生成配图。文章最后必须包含[封面: xxx]和[摘要: xxx]。`;
    }

    const initialMessages = [
      { role: 'system', content: fullPrompt },
      { 
        role: 'user', 
        content: `请根据以下内容生成一篇自媒体文章，目标平台是${platformName}。${platformReminder}\n\n来源：${extraction.url}\n\n原标题：${extraction.title}\n\n内容：\n${formattedContent}` 
      }
    ];

    const timeoutId = setTimeout(() => {
        if (abortController) {
            abortController.abort();
        }
    }, 180000); 

    const stream = await openai.chat.completions.create({
      model: settings.model,
      messages: initialMessages as any,
      stream: true,
      temperature: 0.9, // 提高温度让回复更有创造性和多样化
    }, { signal: abortController.signal });

    const baseMessage = '正在生成文章...';
    updateTaskState({ status: 'Processing...', message: baseMessage, progress: 30 });
    startTimer(baseMessage);

    let summary = '';
    let lastUpdate = Date.now();

    try {
        for await (const chunk of stream) {
            // 检查是否已取消
            if (!abortController || abortController.signal.aborted) {
              break;
            }
            
            const content = chunk.choices[0]?.delta?.content || '';
            summary += content;
            
            const now = Date.now();
            if (now - lastUpdate > 500) {
                lastUpdate = now;
                currentTask = {
                    ...currentTask,
                    status: 'Processing...',
                    message: `${baseMessage} (${Math.floor(summary.length / 100)}k 字符)`,
                    result: summary,
                    progress: 30 + Math.min(50, Math.floor(summary.length / 80))
                } as ActiveTask;
                broadcastUpdate();
            }
        }
    } finally {
        clearTimeout(timeoutId);
    }
    
    // 如果已取消，直接返回不继续处理
    if (!abortController || abortController.signal.aborted) {
      stopTimer();
      currentTask = null;
      chrome.storage.local.remove('currentTask');
      broadcastUpdate();
      return;
    }
    
    stopTimer();

    updateTaskState({ status: 'Processing...', message: '正在处理文章...', progress: 85 });
    
    // 清理文章内容
    const outerCodeBlockRegex = /^```(?:markdown)?\s*([\s\S]*?)\s*```$/i;
    const outerMatch = summary.trim().match(outerCodeBlockRegex);
    
    if (outerMatch && outerMatch[1]) {
        summary = outerMatch[1];
    } else {
        summary = summary.trim();
    }

    // 确保有标题
    const hasH1 = /^\s*#\s+/.test(summary);
    
    if (!hasH1) {
         const genericTitles = ['微博搜索', 'Weibo Search', '搜索', 'Search', '主页', 'Home'];
         const isGeneric = genericTitles.some(t => extraction.title?.includes(t));

         if (!isGeneric && extraction.title) {
             summary = `# ${extraction.title}\n\n` + summary;
         } else {
             const lines = summary.split('\n');
             const firstLine = lines[0]?.trim();
             if (firstLine && firstLine.length > 0 && firstLine.length < 100) {
                 const cleanTitle = firstLine.replace(/^\*\*|\*\*$/g, '').replace(/^#+\s*/, '');
                 summary = `# ${cleanTitle}\n\n` + lines.slice(1).join('\n');
             }
         }
    }

    summary = summary.trim();
    if (summary.endsWith('```')) {
        summary = summary.substring(0, summary.length - 3).trim();
    }

    // 提取标题
    let finalTitle = extraction.title || 'Untitled Article';
    const h1TitleMatch = summary.match(/^#\s+(.+)$/m);
    if (h1TitleMatch && h1TitleMatch[1]) {
      const extractedTitle = h1TitleMatch[1].trim();
      if (extractedTitle.length >= 3 && extractedTitle.length <= 50) {
        finalTitle = extractedTitle;
      }
    }

    // 保存到历史记录
    const newItem = {
      id: Date.now().toString(),
      title: finalTitle,
      date: Date.now(),
      content: summary,
      url: extraction.url
    };
    
    await addHistoryItem(newItem);

    updateTaskState({ 
      status: 'Publishing...', 
      message: `文章生成完成，正在跳转到${platformName}发布页面...`,
      progress: 95, 
      result: summary, 
      title: finalTitle
    });

    // 根据平台发布
    if (platform === 'toutiao') {
      await handlePublishToToutiao({
        title: finalTitle,
        content: summary
      });
    } else if (platform === 'zhihu') {
      await handlePublishToZhihu({
        title: finalTitle,
        content: summary
      });
    } else if (platform === 'weixin') {
      await handlePublishToWeixin({
        title: finalTitle,
        content: summary
      });
    }

    // 清除任务状态（因为已经跳转到发布页面）
    currentTask = null;
    chrome.storage.local.remove('currentTask');
    broadcastUpdate();

  } catch (error: any) {
    stopTimer();
    
    if (error.name === 'AbortError') {
      console.log('Article generation cancelled');
      // 取消时清理任务状态，不跳转到发布页面
      currentTask = null;
      chrome.storage.local.remove('currentTask');
      broadcastUpdate();
      return;
    }

    console.error('Article generation and publish error:', error);
    updateTaskState({ 
      status: 'Error', 
      message: error.message || '发生错误',
      progress: 0, 
      error: error.message 
    });

    const iconUrl = chrome.runtime.getURL('public/icon-128.png');
    chrome.notifications.create({
      type: 'basic',
      iconUrl: iconUrl,
      title: '文章生成失败',
      message: error.message || '未知错误'
    });
  } finally {
    abortController = null;
  }
}

async function handleLogin(provider: 'google' | 'github') {
  const settings = await getSettings();
  const backendUrl = settings.sync?.backendUrl || DEFAULT_SETTINGS.sync!.backendUrl;
  const redirectUri = chrome.identity.getRedirectURL(); 

  console.log('=== Login Debug Info ===');
  console.log('Provider:', provider);
  console.log('Backend URL:', backendUrl);
  console.log('Redirect URI:', redirectUri);

  // 首先从后端获取 OAuth 配置
  let authConfig: { clientId: string; authUrl: string } | null = null;
  
  try {
    console.log('Fetching OAuth config from backend...');
    const configResponse = await fetch(`${backendUrl}/auth/config/${provider}`);
    if (configResponse.ok) {
      authConfig = await configResponse.json();
      console.log('OAuth config received:', authConfig);
    }
  } catch (e) {
    console.log('Failed to fetch OAuth config, will use backend redirect');
  }

  let authUrl: string;
  
  if (authConfig && authConfig.clientId) {
    // 直接构建 OAuth URL，跳过后端重定向
    if (provider === 'google') {
      authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${authConfig.clientId}` +
        `&redirect_uri=${encodeURIComponent(backendUrl + '/auth/callback/google')}` +
        `&response_type=code` +
        `&scope=email%20profile` +
        `&prompt=select_account` +
        `&state=${encodeURIComponent(redirectUri)}`;
    } else {
      authUrl = `https://github.com/login/oauth/authorize?` +
        `client_id=${authConfig.clientId}` +
        `&redirect_uri=${encodeURIComponent(backendUrl + '/auth/callback/github')}` +
        `&scope=user:email` +
        `&state=${encodeURIComponent(redirectUri)}`;
    }
  } else {
    // 回退到后端重定向方式
    authUrl = `${backendUrl}/auth/login/${provider}?redirect_uri=${encodeURIComponent(redirectUri)}`;
  }

  console.log('Auth URL:', authUrl);
  console.log('========================');

  return new Promise<void>((resolve, reject) => {
    console.log('Launching WebAuthFlow...');
    
    chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true
    }, async (redirectUrl) => {
      console.log('WebAuthFlow callback received');
      console.log('Redirect URL:', redirectUrl);
      console.log('Last Error:', chrome.runtime.lastError);
      
      if (chrome.runtime.lastError) {
        const errorMsg = chrome.runtime.lastError.message || 'Unknown error';
        console.error('Auth Flow Error:', errorMsg);
        reject(new Error(errorMsg));
        return;
      }
      
      if (!redirectUrl) {
         console.error('No redirect URL received');
         reject(new Error('登录已取消或失败'));
         return;
      }

      try {
        console.log('Parsing redirect URL...');
        const url = new URL(redirectUrl);
        const token = url.searchParams.get('token');
        const email = url.searchParams.get('email');
        const error = url.searchParams.get('error');

        console.log('Token received:', !!token);
        console.log('Email received:', email);
        console.log('Error param:', error);

        if (error) {
          reject(new Error(`OAuth 错误: ${error}`));
          return;
        }

        if (token && email) {
          const currentSettings = await getSettings();
          const newSettings = {
            ...currentSettings,
            sync: {
              ...currentSettings.sync!,
              enabled: true,
              token: token,
              email: email,
              encryptionKey: currentSettings.sync?.encryptionKey || generateRandomString()
            }
          };
          await saveSettings(newSettings);
          console.log('Login successful, settings saved');
          resolve();
        } else {
          reject(new Error('未收到认证令牌'));
        }
      } catch (e: any) {
        console.error('Error parsing redirect URL:', e);
        reject(new Error('解析回调失败: ' + (e.message || String(e))));
      }
    });
  });
}
