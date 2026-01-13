import { getSettings } from './storage';

export const reportError = async (error: Error | string, context?: any) => {
  try {
    const settings = await getSettings();
    if (!settings.debugMode) return;

    const errorMsg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    
    const payload = {
      error: errorMsg,
      stack,
      context,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    // Use the configured backend URL or default
    const backendUrl = settings.sync?.backendUrl || 'http://memoraid.dpdns.org';
    
    // Fire and forget - don't await result to avoid blocking
    fetch(`${backendUrl}/logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }).catch(e => console.error('Failed to report error:', e));

  } catch (e) {
    console.error('Error reporting failed:', e);
  }
};

export const reportArticlePublish = async (args: {
  platform: string;
  title: string;
  url?: string;
  summary?: string;
  cover?: string;
  publishTime?: number;
  status?: string;
  extra?: Record<string, unknown>;
}) => {
  try {
    const settings = await getSettings();
    let backendUrl = settings.sync?.backendUrl || 'https://memoraid.dpdns.org';
    if (backendUrl.startsWith('http://') && !backendUrl.includes('localhost') && !backendUrl.includes('127.0.0.1')) {
      backendUrl = backendUrl.replace(/^http:\/\//, 'https://');
    }
    const email = settings.sync?.email || 'unknown';

    const payload = {
      platform: args.platform,
      account: {
        id: email,
        name: email,
        avatar: '',
        extra: { source: 'extension' }
      },
      articles: [
        {
          id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
          title: args.title,
          summary: args.summary || '',
          cover: args.cover || '',
          url: args.url || '',
          publishTime: args.publishTime || Math.floor(Date.now() / 1000),
          status: args.status || 'published',
          extra: args.extra || {}
        }
      ]
    };

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (settings.sync?.token) headers.Authorization = `Bearer ${settings.sync.token}`;

    fetch(`${backendUrl}/api/articles/report`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    }).catch(() => undefined);
  } catch {
  }
};
