export interface Env {
  DB: D1Database;
  R2: R2Bucket;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
}

interface AuthRequest {
  provider: 'google' | 'github';
  token: string;
}

interface SaveSettingsRequest {
  encryptedData: string;
  salt: string;
  iv: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Google Search Console 验证文件
    if (url.pathname === '/google3630936db0327b0d.html' && request.method === 'GET') {
      return new Response('google-site-verification: google3630936db0327b0d.html', {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // R2 静态资源访问 - /assets/*
    if (url.pathname.startsWith('/assets/') && request.method === 'GET') {
      const key = url.pathname.replace('/assets/', '');
      try {
        const object = await env.R2.get(key);
        if (!object) {
          return new Response('Not Found', { status: 404 });
        }
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('Cache-Control', 'public, max-age=31536000');
        headers.set('Access-Control-Allow-Origin', '*');
        return new Response(object.body, { headers });
      } catch (e) {
        return new Response('Error fetching asset', { status: 500 });
      }
    }

    // R2 图片上传 (需要认证，仅管理员使用)
    if (url.pathname === '/api/upload' && request.method === 'POST') {
      try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const filename = formData.get('filename') as string || file.name;
        
        if (!file) {
          return new Response(JSON.stringify({ error: 'No file provided' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const key = 'memoraid/' + filename;
        await env.R2.put(key, file.stream(), {
          httpMetadata: { contentType: file.type }
        });
        
        return new Response(JSON.stringify({ 
          success: true, 
          url: url.origin + '/assets/' + key 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // 官方网站首页
    if ((url.pathname === '/' || url.pathname === '') && request.method === 'GET') {
      const ASSETS_BASE = url.origin + '/assets/memoraid';
      const homepageHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Memoraid - AI 内容创作助手 | 网页总结、自媒体文章生成、一键多平台发布</title>
    <meta name="description" content="Memoraid 是一款强大的 Chrome 扩展，使用 AI 总结网页/对话内容，一键生成自媒体文章，支持自动发布到头条号、知乎专栏、微信公众号。">
    <meta name="keywords" content="AI助手,网页总结,自媒体文章,一键发布,头条号,知乎,公众号,Chrome扩展">
    <link rel="icon" type="image/png" href="${ASSETS_BASE}/icon-128.png">
    <link href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=Noto+Sans+SC:wght@300;400;500;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #09090b;
            --bg-subtle: #18181b;
            --bg-muted: #27272a;
            --surface: #1f1f23;
            --border: #3f3f46;
            --text: #fafafa;
            --text-secondary: #a1a1aa;
            --text-muted: #71717a;
            --accent: #22d3ee;
            --accent-secondary: #a78bfa;
            --gradient-1: linear-gradient(135deg, #22d3ee 0%, #a78bfa 50%, #f472b6 100%);
            --gradient-2: linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%);
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body {
            font-family: 'Sora', 'Noto Sans SC', system-ui, sans-serif;
            background: var(--bg);
            color: var(--text);
            line-height: 1.6;
            overflow-x: hidden;
        }
        
        /* 背景装饰 */
        .bg-glow {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            pointer-events: none; z-index: 0;
            background: 
                radial-gradient(ellipse 80% 50% at 50% -20%, rgba(34, 211, 238, 0.15) 0%, transparent 50%),
                radial-gradient(ellipse 60% 40% at 80% 60%, rgba(167, 139, 250, 0.1) 0%, transparent 50%),
                radial-gradient(ellipse 50% 30% at 20% 80%, rgba(244, 114, 182, 0.08) 0%, transparent 50%);
        }
        .noise {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            pointer-events: none; z-index: 1; opacity: 0.03;
            background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
        }
        
        /* 导航栏 */
        .navbar {
            position: fixed; top: 0; left: 0; right: 0; z-index: 1000;
            padding: 16px 24px;
            background: rgba(9, 9, 11, 0.8);
            backdrop-filter: blur(20px);
            border-bottom: 1px solid rgba(63, 63, 70, 0.5);
        }
        .navbar-inner {
            max-width: 1200px; margin: 0 auto;
            display: flex; align-items: center; justify-content: space-between;
        }
        .logo {
            display: flex; align-items: center; gap: 12px;
            text-decoration: none; color: var(--text);
        }
        .logo-icon {
            width: 44px; height: 44px; border-radius: 12px;
            background: var(--gradient-2);
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 0 20px rgba(34, 211, 238, 0.3);
            overflow: hidden;
        }
        .logo-icon img { width: 44px; height: 44px; object-fit: cover; }
        .logo-text { font-size: 1.25rem; font-weight: 600; letter-spacing: -0.02em; }
        .nav-links { display: flex; align-items: center; gap: 32px; }
        .nav-link {
            color: var(--text-secondary); text-decoration: none;
            font-size: 0.9rem; font-weight: 500;
            transition: color 0.2s;
        }
        .nav-link:hover { color: var(--text); }
        .btn-install {
            display: inline-flex; align-items: center; gap: 8px;
            padding: 10px 20px; border-radius: 10px;
            background: var(--text); color: var(--bg);
            font-size: 0.9rem; font-weight: 600;
            text-decoration: none; transition: all 0.3s;
        }
        .btn-install:hover { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(255,255,255,0.2); }
        .nav-actions { display: flex; align-items: center; gap: 12px; }
        .btn-login {
            display: inline-flex; align-items: center; gap: 8px;
            padding: 10px 20px; border-radius: 10px;
            background: transparent;
            border: 1px solid var(--border);
            color: var(--text); font-size: 0.9rem; font-weight: 500;
            text-decoration: none; transition: all 0.3s;
        }
        .btn-login:hover { background: var(--surface); border-color: var(--accent); }
        
        /* Hero 区域 */
        .hero {
            position: relative; z-index: 2;
            min-height: 100vh; padding: 140px 24px 80px;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            text-align: center;
        }
        .hero-badge {
            display: inline-flex; align-items: center; gap: 8px;
            padding: 8px 16px; border-radius: 100px;
            background: rgba(34, 211, 238, 0.1);
            border: 1px solid rgba(34, 211, 238, 0.3);
            color: var(--accent); font-size: 0.85rem; font-weight: 500;
            margin-bottom: 32px;
            animation: fadeInUp 0.6s ease forwards;
        }
        .hero-badge::before { content: '✨'; }
        .hero-title {
            font-size: clamp(2.5rem, 8vw, 4.5rem);
            font-weight: 700; line-height: 1.1;
            letter-spacing: -0.03em;
            margin-bottom: 24px;
            animation: fadeInUp 0.6s ease 0.1s forwards;
            opacity: 0;
        }
        .hero-title .gradient {
            background: var(--gradient-1);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .hero-subtitle {
            font-size: 1.25rem; color: var(--text-secondary);
            max-width: 600px; margin: 0 auto 40px;
            animation: fadeInUp 0.6s ease 0.2s forwards;
            opacity: 0;
        }
        .hero-actions {
            display: flex; gap: 16px; flex-wrap: wrap; justify-content: center;
            animation: fadeInUp 0.6s ease 0.3s forwards;
            opacity: 0;
        }
        .btn-primary {
            display: inline-flex; align-items: center; gap: 10px;
            padding: 16px 32px; border-radius: 14px;
            background: var(--gradient-2);
            color: white; font-size: 1rem; font-weight: 600;
            text-decoration: none; transition: all 0.3s;
            box-shadow: 0 4px 20px rgba(34, 211, 238, 0.3);
        }
        .btn-primary:hover { transform: translateY(-3px); box-shadow: 0 8px 30px rgba(34, 211, 238, 0.4); }
        .btn-secondary {
            display: inline-flex; align-items: center; gap: 10px;
            padding: 16px 32px; border-radius: 14px;
            background: var(--surface);
            border: 1px solid var(--border);
            color: var(--text); font-size: 1rem; font-weight: 600;
            text-decoration: none; transition: all 0.3s;
        }
        .btn-secondary:hover { background: var(--bg-muted); transform: translateY(-3px); }
        
        /* Hero 图片展示 */
        .hero-visual {
            margin-top: 80px; width: 100%; max-width: 1100px;
            animation: fadeInUp 0.8s ease 0.4s forwards;
            opacity: 0;
        }
        .hero-image-wrapper {
            position: relative;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 25px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1);
        }
        .hero-image-wrapper::before {
            content: '';
            position: absolute; top: 0; left: 0; right: 0;
            height: 40px;
            background: linear-gradient(180deg, rgba(0,0,0,0.3) 0%, transparent 100%);
            z-index: 1;
        }
        .hero-image {
            width: 100%; height: auto; display: block;
        }
        
        /* 功能特性区 */
        .features {
            position: relative; z-index: 2;
            padding: 120px 24px;
        }
        .section-header {
            text-align: center; margin-bottom: 80px;
        }
        .section-label {
            display: inline-block;
            padding: 6px 14px; border-radius: 100px;
            background: var(--bg-subtle);
            border: 1px solid var(--border);
            color: var(--accent); font-size: 0.8rem; font-weight: 600;
            text-transform: uppercase; letter-spacing: 0.1em;
            margin-bottom: 20px;
        }
        .section-title {
            font-size: clamp(2rem, 5vw, 3rem);
            font-weight: 700; letter-spacing: -0.02em;
            margin-bottom: 16px;
        }
        .section-desc {
            font-size: 1.1rem; color: var(--text-secondary);
            max-width: 600px; margin: 0 auto;
        }
        .features-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 24px;
            max-width: 1200px; margin: 0 auto;
        }
        .feature-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 20px;
            padding: 32px;
            transition: all 0.3s;
        }
        .feature-card:hover {
            transform: translateY(-8px);
            border-color: var(--accent);
            box-shadow: 0 20px 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(34, 211, 238, 0.2);
        }
        .feature-icon {
            width: 56px; height: 56px;
            border-radius: 16px;
            display: flex; align-items: center; justify-content: center;
            font-size: 1.75rem;
            margin-bottom: 20px;
        }
        .feature-icon.cyan { background: rgba(34, 211, 238, 0.15); }
        .feature-icon.purple { background: rgba(167, 139, 250, 0.15); }
        .feature-icon.pink { background: rgba(244, 114, 182, 0.15); }
        .feature-icon.amber { background: rgba(251, 191, 36, 0.15); }
        .feature-icon.green { background: rgba(52, 211, 153, 0.15); }
        .feature-icon.blue { background: rgba(96, 165, 250, 0.15); }
        .feature-title {
            font-size: 1.25rem; font-weight: 600;
            margin-bottom: 12px;
        }
        .feature-desc {
            color: var(--text-secondary); font-size: 0.95rem;
            line-height: 1.7;
        }
        
        /* 截图展示区 */
        .screenshots {
            position: relative; z-index: 2;
            padding: 120px 24px;
            background: var(--bg-subtle);
        }
        .screenshots-scroll {
            display: flex; gap: 24px;
            overflow-x: auto; padding: 20px 0;
            scroll-snap-type: x mandatory;
            -webkit-overflow-scrolling: touch;
        }
        .screenshots-scroll::-webkit-scrollbar { display: none; }
        .screenshot-item {
            flex: 0 0 auto;
            width: 340px;
            scroll-snap-align: center;
        }
        .screenshot-item img {
            width: 100%; height: auto;
            border-radius: 16px;
            border: 1px solid var(--border);
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            transition: transform 0.3s;
        }
        .screenshot-item:hover img { transform: scale(1.02); }
        
        /* CTA 区域 */
        .cta {
            position: relative; z-index: 2;
            padding: 120px 24px;
            text-align: center;
        }
        .cta-box {
            max-width: 800px; margin: 0 auto;
            padding: 80px 40px;
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 32px;
            position: relative;
            overflow: hidden;
        }
        .cta-box::before {
            content: '';
            position: absolute; top: 0; left: 0; right: 0; bottom: 0;
            background: var(--gradient-1);
            opacity: 0.05;
        }
        .cta-title {
            font-size: clamp(1.75rem, 4vw, 2.5rem);
            font-weight: 700; margin-bottom: 16px;
            position: relative;
        }
        .cta-desc {
            color: var(--text-secondary); font-size: 1.1rem;
            margin-bottom: 32px;
            position: relative;
        }
        .cta .btn-primary { position: relative; }
        
        /* 页脚 */
        .footer {
            position: relative; z-index: 2;
            padding: 60px 24px;
            border-top: 1px solid var(--border);
        }
        .footer-inner {
            max-width: 1200px; margin: 0 auto;
            display: flex; align-items: center; justify-content: space-between;
            flex-wrap: wrap; gap: 24px;
        }
        .footer-brand {
            display: flex; align-items: center; gap: 12px;
        }
        .footer-brand img { width: 32px; height: 32px; border-radius: 8px; }
        .footer-brand span { font-weight: 600; }
        .footer-links { display: flex; gap: 24px; }
        .footer-link {
            color: var(--text-muted); text-decoration: none;
            font-size: 0.9rem; transition: color 0.2s;
        }
        .footer-link:hover { color: var(--text); }
        .footer-copy { color: var(--text-muted); font-size: 0.85rem; }
        
        /* 动画 */
        @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        /* 响应式 */
        @media (max-width: 768px) {
            .nav-links { display: none; }
            .hero { padding: 120px 20px 60px; }
            .hero-actions { flex-direction: column; width: 100%; }
            .btn-primary, .btn-secondary { width: 100%; justify-content: center; }
            .features-grid { grid-template-columns: 1fr; }
            .footer-inner { flex-direction: column; text-align: center; }
        }
    </style>
</head>
<body>
    <div class="bg-glow"></div>
    <div class="noise"></div>
    
    <!-- 导航栏 -->
    <nav class="navbar">
        <div class="navbar-inner">
            <a href="/" class="logo">
                <div class="logo-icon">
                    <img src="${ASSETS_BASE}/icon-128.png" alt="Memoraid">
                </div>
                <span class="logo-text">Memoraid</span>
            </a>
            <div class="nav-links">
                <a href="#features" class="nav-link">功能特性</a>
                <a href="#screenshots" class="nav-link">产品截图</a>
                <a href="/admin" class="nav-link">管理后台</a>
            </div>
            <div class="nav-actions">
                <a href="/login" class="btn-login">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                    登录
                </a>
                <a href="https://chromewebstore.google.com/detail/memoraid/leonoilddlplhmmahjmnendflfnlnlmg" target="_blank" class="btn-install">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C8.21 0 4.831 1.757 2.632 4.501l3.953 6.848A5.454 5.454 0 0 1 12 6.545h10.691A12 12 0 0 0 12 0zM1.931 5.47A11.943 11.943 0 0 0 0 12c0 6.012 4.42 10.991 10.189 11.864l3.953-6.847a5.45 5.45 0 0 1-6.865-2.29zm13.342 2.166a5.446 5.446 0 0 1 1.45 7.09l.002.001h-.002l-3.952 6.848a12.014 12.014 0 0 0 9.229-9.006zM12 16.364a4.364 4.364 0 1 1 0-8.728 4.364 4.364 0 0 1 0 8.728z"/></svg>
                    安装扩展
                </a>
            </div>
        </div>
    </nav>
    
    <!-- Hero 区域 -->
    <section class="hero">
        <div class="hero-badge">AI 驱动的内容创作助手</div>
        <h1 class="hero-title">
            AI 总结<span class="gradient">一键发布</span><br>
            多平台<span class="gradient">智能创作</span>
        </h1>
        <p class="hero-subtitle">
            Memoraid 是一款强大的 Chrome 扩展，使用 AI 总结网页/对话内容，一键生成自媒体文章，支持自动发布到头条号、知乎专栏、微信公众号。
        </p>
        <div class="hero-actions">
            <a href="https://chromewebstore.google.com/detail/memoraid/your-extension-id" target="_blank" class="btn-primary">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C8.21 0 4.831 1.757 2.632 4.501l3.953 6.848A5.454 5.454 0 0 1 12 6.545h10.691A12 12 0 0 0 12 0zM1.931 5.47A11.943 11.943 0 0 0 0 12c0 6.012 4.42 10.991 10.189 11.864l3.953-6.847a5.45 5.45 0 0 1-6.865-2.29zm13.342 2.166a5.446 5.446 0 0 1 1.45 7.09l.002.001h-.002l-3.952 6.848a12.014 12.014 0 0 0 9.229-9.006zM12 16.364a4.364 4.364 0 1 1 0-8.728 4.364 4.364 0 0 1 0 8.728z"/></svg>
                免费安装 Chrome 扩展
            </a>
            <a href="#features" class="btn-secondary">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
                了解更多
            </a>
        </div>
        
        <div class="hero-visual">
            <div class="hero-image-wrapper">
                <img src="${ASSETS_BASE}/promo-1400x560.png" alt="Memoraid 产品展示" class="hero-image">
            </div>
        </div>
    </section>
    
    <!-- 功能特性 -->
    <section class="features" id="features">
        <div class="section-header">
            <span class="section-label">核心功能</span>
            <h2 class="section-title">从内容提取到一键发布，全流程 AI 赋能</h2>
            <p class="section-desc">支持 GPT-4、Claude、DeepSeek、通义千问等多种 AI 模型</p>
        </div>
        
        <div class="features-grid">
            <div class="feature-card">
                <div class="feature-icon cyan">📖</div>
                <h3 class="feature-title">智能内容提取</h3>
                <p class="feature-desc">自动提取 ChatGPT、Gemini、DeepSeek 等 AI 对话内容，内置 Readability 引擎智能识别任意网页核心内容。</p>
            </div>
            <div class="feature-card">
                <div class="feature-icon purple">🤖</div>
                <h3 class="feature-title">AI 驱动总结</h3>
                <p class="feature-desc">将对话/网页内容转化为结构化技术文档，或一键生成适合头条、知乎、公众号风格的自媒体文章。</p>
            </div>
            <div class="feature-card">
                <div class="feature-icon pink">✍️</div>
                <h3 class="feature-title">6 维度风格定制</h3>
                <p class="feature-desc">通过滑动条调整立场倾向、情感色彩、评价态度、表达方式、语言风格、趣味程度，打造个性化文章。</p>
            </div>
            <div class="feature-card">
                <div class="feature-icon amber">📤</div>
                <h3 class="feature-title">一键多平台发布</h3>
                <p class="feature-desc">支持头条号、知乎专栏、微信公众号，自动填充标题正文，智能配图，自动设置封面。</p>
            </div>
            <div class="feature-card">
                <div class="feature-icon green">💾</div>
                <h3 class="feature-title">云端数据同步</h3>
                <p class="feature-desc">支持 Google/GitHub 登录，端到端加密同步设置到云端，一键推送文档到 GitHub 仓库。</p>
            </div>
            <div class="feature-card">
                <div class="feature-icon blue">📝</div>
                <h3 class="feature-title">Markdown 导出</h3>
                <p class="feature-desc">实时预览带语法高亮的 Markdown，自动渲染 Mermaid 流程图、时序图，支持多格式导出。</p>
            </div>
        </div>
    </section>
    
    <!-- 产品截图 -->
    <section class="screenshots" id="screenshots">
        <div class="section-header">
            <span class="section-label">产品截图</span>
            <h2 class="section-title">简洁优雅的界面设计</h2>
            <p class="section-desc">精心打磨每一个细节，带来极致的使用体验</p>
        </div>
        
        <div class="screenshots-scroll">
            <div class="screenshot-item"><img src="${ASSETS_BASE}/screenshot-1.png" alt="截图1"></div>
            <div class="screenshot-item"><img src="${ASSETS_BASE}/screenshot-2.png" alt="截图2"></div>
            <div class="screenshot-item"><img src="${ASSETS_BASE}/screenshot-3.png" alt="截图3"></div>
            <div class="screenshot-item"><img src="${ASSETS_BASE}/screenshot-4.png" alt="截图4"></div>
            <div class="screenshot-item"><img src="${ASSETS_BASE}/screenshot-5.png" alt="截图5"></div>
            <div class="screenshot-item"><img src="${ASSETS_BASE}/screenshot-6.png" alt="截图6"></div>
            <div class="screenshot-item"><img src="${ASSETS_BASE}/screenshot-7.png" alt="截图7"></div>
            <div class="screenshot-item"><img src="${ASSETS_BASE}/screenshot-8.png" alt="截图8"></div>
        </div>
    </section>
    
    <!-- CTA -->
    <section class="cta">
        <div class="cta-box">
            <h2 class="cta-title">准备好提升您的内容创作效率了吗？</h2>
            <p class="cta-desc">立即安装 Memoraid，AI 总结 + 一键发布，让内容创作更轻松。完全免费，无需注册。</p>
            <a href="https://chromewebstore.google.com/detail/memoraid/your-extension-id" target="_blank" class="btn-primary">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C8.21 0 4.831 1.757 2.632 4.501l3.953 6.848A5.454 5.454 0 0 1 12 6.545h10.691A12 12 0 0 0 12 0zM1.931 5.47A11.943 11.943 0 0 0 0 12c0 6.012 4.42 10.991 10.189 11.864l3.953-6.847a5.45 5.45 0 0 1-6.865-2.29zm13.342 2.166a5.446 5.446 0 0 1 1.45 7.09l.002.001h-.002l-3.952 6.848a12.014 12.014 0 0 0 9.229-9.006zM12 16.364a4.364 4.364 0 1 1 0-8.728 4.364 4.364 0 0 1 0 8.728z"/></svg>
                立即免费安装
            </a>
        </div>
    </section>
    
    <!-- 页脚 -->
    <footer class="footer">
        <div class="footer-inner">
            <div class="footer-brand">
                <img src="${ASSETS_BASE}/icon-128.png" alt="Memoraid">
                <span>Memoraid</span>
            </div>
            <div class="footer-links">
                <a href="/admin" class="footer-link">管理后台</a>
            </div>
            <div class="footer-copy">© 2026 Memoraid. All rights reserved.</div>
        </div>
    </footer>
    
    <script>
        // 检查登录状态并更新导航栏
        (function() {
            const token = localStorage.getItem('memoraid_token');
            const email = localStorage.getItem('memoraid_email');
            
            if (token) {
                // 验证 token 是否有效
                fetch('/api/auth/verify', {
                    headers: { 'Authorization': 'Bearer ' + token }
                })
                .then(res => res.json())
                .then(data => {
                    if (data.authenticated) {
                        // 已登录，更新导航栏
                        const loginBtn = document.querySelector('.btn-login');
                        if (loginBtn) {
                            const userEmail = data.email || email || 'User';
                            const initial = userEmail.charAt(0).toUpperCase();
                            loginBtn.outerHTML = \`
                                <div class="user-menu" style="display: flex; align-items: center; gap: 12px;">
                                    <a href="/admin" style="display: flex; align-items: center; gap: 8px; color: var(--text); text-decoration: none; padding: 6px 12px; border-radius: 8px; background: var(--surface); border: 1px solid var(--border);">
                                        <span style="width: 28px; height: 28px; border-radius: 50%; background: var(--gradient-2); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600;">\${initial}</span>
                                        <span style="font-size: 0.85rem; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">\${userEmail}</span>
                                    </a>
                                    <button onclick="logout()" style="padding: 8px 12px; border-radius: 8px; background: transparent; border: 1px solid var(--border); color: var(--text-secondary); font-size: 0.8rem; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='#ef4444';this.style.color='#ef4444'" onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text-secondary)'">退出</button>
                                </div>
                            \`;
                        }
                    }
                })
                .catch(err => console.log('Auth check failed:', err));
            }
        })();
        
        // 退出登录
        function logout() {
            localStorage.removeItem('memoraid_token');
            localStorage.removeItem('memoraid_email');
            window.location.reload();
        }
    </script>
</body>
</html>`;
      return new Response(homepageHtml, { headers: { 'Content-Type': 'text/html; charset=UTF-8' } });
    }

    // 0. Health Check & Config Test
    if (url.pathname === '/health' && request.method === 'GET') {
        const config = {
            status: 'ok',
            timestamp: new Date().toISOString(),
            googleConfigured: !!env.GOOGLE_CLIENT_ID,
            githubConfigured: !!env.GITHUB_CLIENT_ID,
            dbConnected: !!env.DB
        };
        return new Response(JSON.stringify(config, null, 2), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    // 0.1 OAuth Config - 返回 Client ID 供扩展直接构建 OAuth URL
    if (url.pathname.startsWith('/auth/config/') && request.method === 'GET') {
        const provider = url.pathname.split('/').pop();
        let clientId = '';
        
        if (provider === 'google') {
            clientId = env.GOOGLE_CLIENT_ID?.trim() || '';
        } else if (provider === 'github') {
            clientId = env.GITHUB_CLIENT_ID?.trim() || '';
        }
        
        if (!clientId) {
            return new Response(JSON.stringify({ error: 'Provider not configured' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
        
        return new Response(JSON.stringify({ 
            clientId,
            callbackUrl: url.origin + '/auth/callback/' + provider
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    // 0.2 Privacy Policy (Public)
    if (url.pathname === '/privacy' && request.method === 'GET') {
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Privacy Policy - Memoraid</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; color: #333; }
                h1 { border-bottom: 1px solid #eee; padding-bottom: 15px; margin-bottom: 30px; }
                h2 { margin-top: 30px; color: #2c3e50; }
                ul { padding-left: 20px; }
                li { margin-bottom: 10px; }
                .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 0.9em; }
            </style>
        </head>
        <body>
            <h1>Privacy Policy for Memoraid</h1>
            <p><strong>Effective Date:</strong> January 7, 2026</p>

            <p>Memoraid ("we", "us", or "our") is committed to protecting your privacy. This Privacy Policy explains how our Chrome Extension collects, uses, and safeguards your information.</p>

            <h2>1. Information We Collect</h2>
            <p>We collect the minimum amount of data necessary to provide our services:</p>
            <ul>
                <li><strong>Authentication Data:</strong> When you log in using Google or GitHub, we receive your email address and a unique user identifier to manage your account.</li>
                <li><strong>Sync Data:</strong> We store your application settings and preferences to synchronize them across your devices.</li>
            </ul>

            <h2>2. How We Use Your Information</h2>
            <ul>
                <li>To provide, maintain, and improve the Memoraid extension.</li>
                <li>To synchronize your settings securely across multiple instances of the extension.</li>
                <li>To authenticate your identity and prevent unauthorized access.</li>
            </ul>

            <h2>3. Data Security & Encryption</h2>
            <p>Your privacy is our priority. We employ <strong>Client-Side Encryption</strong> (AES-GCM) for your sync data:</p>
            <ul>
                <li>Your settings are encrypted <strong>on your device</strong> before they are sent to our servers.</li>
                <li>We do not have access to your encryption password or your decrypted data.</li>
                <li>All data is transmitted over secure SSL/TLS (HTTPS) connections.</li>
            </ul>

            <h2>4. Third-Party Services</h2>
            <p>We use trusted third-party services for authentication:</p>
            <ul>
                <li><strong>Google OAuth:</strong> For user authentication.</li>
                <li><strong>GitHub OAuth:</strong> For user authentication.</li>
            </ul>
            <p>We do not sell, trade, or otherwise transfer your personally identifiable information to outside parties.</p>

            <h2>5. Data Retention & Deletion</h2>
            <p>We retain your encrypted data as long as you use our service. You may request the deletion of your account and all associated data by contacting us.</p>

            <h2>6. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page.</p>

            <div class="footer">
                <p>Contact Us: If you have any questions about this Privacy Policy, please contact us via the Chrome Web Store support page.</p>
            </div>
        </body>
        </html>
        `;
        return new Response(html, {
            headers: { 'Content-Type': 'text/html; charset=UTF-8' }
        });
    }

    // 0.3 Login Page - 登录页面
    if (url.pathname === '/login' && request.method === 'GET') {
        const ASSETS_BASE = url.origin + '/assets/memoraid';
        const loginHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>登录 - Memoraid</title>
    <link rel="icon" type="image/png" href="${ASSETS_BASE}/icon-128.png">
    <link href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=Noto+Sans+SC:wght@300;400;500;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #09090b;
            --bg-subtle: #18181b;
            --surface: #1f1f23;
            --border: #3f3f46;
            --text: #fafafa;
            --text-secondary: #a1a1aa;
            --text-muted: #71717a;
            --accent: #22d3ee;
            --accent-secondary: #a78bfa;
            --gradient-1: linear-gradient(135deg, #22d3ee 0%, #a78bfa 50%, #f472b6 100%);
            --gradient-2: linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%);
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Sora', 'Noto Sans SC', system-ui, sans-serif;
            background: var(--bg);
            color: var(--text);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .bg-glow {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            pointer-events: none; z-index: 0;
            background: 
                radial-gradient(ellipse 80% 50% at 50% -20%, rgba(34, 211, 238, 0.15) 0%, transparent 50%),
                radial-gradient(ellipse 60% 40% at 80% 60%, rgba(167, 139, 250, 0.1) 0%, transparent 50%);
        }
        .login-container {
            position: relative; z-index: 1;
            width: 100%; max-width: 420px;
            padding: 20px;
        }
        .login-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 24px;
            padding: 48px 40px;
            text-align: center;
        }
        .logo {
            display: flex; align-items: center; justify-content: center; gap: 12px;
            margin-bottom: 32px;
        }
        .logo-icon {
            width: 56px; height: 56px; border-radius: 16px;
            background: var(--gradient-2);
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 0 30px rgba(34, 211, 238, 0.3);
            overflow: hidden;
        }
        .logo-icon img { width: 56px; height: 56px; object-fit: cover; }
        .logo-text { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.02em; }
        .login-title {
            font-size: 1.5rem; font-weight: 600;
            margin-bottom: 8px;
        }
        .login-subtitle {
            color: var(--text-secondary);
            font-size: 0.95rem;
            margin-bottom: 40px;
        }
        .login-buttons {
            display: flex; flex-direction: column; gap: 16px;
        }
        .login-btn {
            display: flex; align-items: center; justify-content: center; gap: 12px;
            padding: 16px 24px;
            border-radius: 14px;
            font-size: 1rem; font-weight: 600;
            text-decoration: none;
            transition: all 0.3s;
            cursor: pointer;
            border: none;
        }
        .login-btn.google {
            background: #fff; color: #1f1f23;
        }
        .login-btn.google:hover {
            background: #f5f5f5;
            transform: translateY(-2px);
            box-shadow: 0 10px 30px rgba(255,255,255,0.15);
        }
        .login-btn.github {
            background: #24292e; color: #fff;
            border: 1px solid #3f3f46;
        }
        .login-btn.github:hover {
            background: #2d3339;
            transform: translateY(-2px);
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }
        .login-btn svg { width: 20px; height: 20px; }
        .divider {
            display: flex; align-items: center; gap: 16px;
            margin: 32px 0;
            color: var(--text-muted);
            font-size: 0.85rem;
        }
        .divider::before, .divider::after {
            content: ''; flex: 1; height: 1px;
            background: var(--border);
        }
        .back-link {
            display: inline-flex; align-items: center; gap: 8px;
            color: var(--text-secondary);
            text-decoration: none;
            font-size: 0.9rem;
            transition: color 0.2s;
        }
        .back-link:hover { color: var(--accent); }
        .login-footer {
            margin-top: 32px;
            padding-top: 24px;
            border-top: 1px solid var(--border);
        }
        .login-footer p {
            color: var(--text-muted);
            font-size: 0.8rem;
            line-height: 1.6;
        }
        .login-footer a {
            color: var(--accent);
            text-decoration: none;
        }
        .login-footer a:hover { text-decoration: underline; }
        
        /* Loading state */
        .loading { opacity: 0.6; pointer-events: none; }
        .loading .login-btn { position: relative; }
        .spinner {
            width: 20px; height: 20px;
            border: 2px solid transparent;
            border-top-color: currentColor;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
    </style>
</head>
<body>
    <div class="bg-glow"></div>
    <div class="login-container">
        <div class="login-card">
            <div class="logo">
                <div class="logo-icon">
                    <img src="${ASSETS_BASE}/icon-128.png" alt="Memoraid">
                </div>
                <span class="logo-text">Memoraid</span>
            </div>
            
            <h1 class="login-title">欢迎回来</h1>
            <p class="login-subtitle">登录以访问管理后台</p>
            
            <div class="login-buttons" id="loginButtons">
                <button class="login-btn google" onclick="loginWith('google')">
                    <svg viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                    使用 Google 登录
                </button>
                <button class="login-btn github" onclick="loginWith('github')">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                    使用 GitHub 登录
                </button>
            </div>
            
            <div class="divider">或</div>
            
            <a href="/" class="back-link">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                返回首页
            </a>
            
            <div class="login-footer">
                <p>登录即表示您同意我们的 <a href="/privacy">隐私政策</a></p>
            </div>
        </div>
    </div>
    
    <script>
        function loginWith(provider) {
            const buttons = document.getElementById('loginButtons');
            buttons.classList.add('loading');
            
            // 构建回调 URL - 登录成功后跳转到后台
            const redirectUri = encodeURIComponent(window.location.origin + '/auth/web-callback');
            window.location.href = '/auth/login/' + provider + '?redirect_uri=' + redirectUri;
        }
    </script>
</body>
</html>`;
        return new Response(loginHtml, {
            headers: { 'Content-Type': 'text/html; charset=UTF-8' }
        });
    }

    // 0.4 Web Auth Callback - 网页登录回调
    if (url.pathname === '/auth/web-callback' && request.method === 'GET') {
        const token = url.searchParams.get('token');
        const email = url.searchParams.get('email');
        
        if (!token) {
            return Response.redirect(url.origin + '/login?error=auth_failed', 302);
        }
        
        // 设置 cookie 并跳转到后台
        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>登录成功</title>
</head>
<body>
    <script>
        // 保存 token 到 localStorage
        localStorage.setItem('memoraid_token', '${token}');
        localStorage.setItem('memoraid_email', '${email || ''}');
        // 跳转到后台
        window.location.href = '/admin';
    </script>
</body>
</html>`;
        return new Response(html, {
            headers: { 'Content-Type': 'text/html; charset=UTF-8' }
        });
    }

    // 0.5 验证用户登录状态 API
    if (url.pathname === '/api/auth/verify' && request.method === 'GET') {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer mock_jwt_')) {
            return new Response(JSON.stringify({ authenticated: false }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
        
        try {
            const tokenPart = authHeader.split('Bearer mock_jwt_')[1];
            const payload = JSON.parse(atob(tokenPart));
            
            // 检查 token 是否过期
            if (payload.exp && payload.exp < Date.now()) {
                return new Response(JSON.stringify({ authenticated: false, error: 'Token expired' }), {
                    status: 401,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
            
            return new Response(JSON.stringify({ 
                authenticated: true,
                userId: payload.userId,
                email: payload.email
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        } catch (e) {
            return new Response(JSON.stringify({ authenticated: false, error: 'Invalid token' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    }

    // 1. Auth Init - Redirect to Provider
    if (url.pathname.startsWith('/auth/login/') && request.method === 'GET') {
       const provider = url.pathname.split('/').pop();
       const redirectUri = url.searchParams.get('redirect_uri');

       console.log('Auth Init:', { provider, redirectUri, origin: url.origin });

       if (!redirectUri) {
           console.error('Missing redirect_uri');
           return new Response('Missing redirect_uri', { status: 400 });
       }

       let authUrl = '';
       
       if (provider === 'google') {
           const clientId = env.GOOGLE_CLIENT_ID?.trim();
           if (!clientId) {
               console.error('GOOGLE_CLIENT_ID not configured');
               return new Response('Google OAuth not configured. Please set GOOGLE_CLIENT_ID environment variable.', { status: 500 });
           }
           authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(url.origin + '/auth/callback/google')}&response_type=code&scope=email%20profile&prompt=select_account&state=${encodeURIComponent(redirectUri)}`;
       } else if (provider === 'github') {
           const clientId = env.GITHUB_CLIENT_ID?.trim();
           if (!clientId) {
               console.error('GITHUB_CLIENT_ID not configured');
               return new Response('GitHub OAuth not configured. Please set GITHUB_CLIENT_ID environment variable.', { status: 500 });
           }
           authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(url.origin + '/auth/callback/github')}&scope=user:email&state=${encodeURIComponent(redirectUri)}`;
       } else {
           console.error('Invalid provider:', provider);
           return new Response('Invalid provider', { status: 400 });
       }

       console.log('Redirecting to OAuth:', authUrl.substring(0, 100) + '...');
       
       // 使用 HTML meta refresh 重定向，而不是 302，以解决 Chrome 扩展 launchWebAuthFlow 的兼容性问题
       const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta http-equiv="refresh" content="0;url=${authUrl}">
    <title>Redirecting...</title>
</head>
<body>
    <p>Redirecting to ${provider} login...</p>
    <p>If you are not redirected, <a href="${authUrl}">click here</a>.</p>
    <script>window.location.href = "${authUrl}";</script>
</body>
</html>`;
       
       return new Response(html, {
           headers: { 'Content-Type': 'text/html; charset=UTF-8' }
       });
    }

    // 2. Auth Callback - Exchange Code & Redirect to Extension
    if (url.pathname.startsWith('/auth/callback/') && request.method === 'GET') {
        const provider = url.pathname.split('/').pop();
        const code = url.searchParams.get('code');
        const extRedirectUri = url.searchParams.get('state'); // We stored ext URI in state

        if (!code || !extRedirectUri) return new Response('Missing code or state', { status: 400 });

        try {
            let email = '';
            let providerId = '';

            if (provider === 'google') {
                // Exchange code for token
                const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        code,
                        client_id: env.GOOGLE_CLIENT_ID?.trim(),
                        client_secret: env.GOOGLE_CLIENT_SECRET?.trim(),
                        redirect_uri: url.origin + '/auth/callback/google',
                        grant_type: 'authorization_code'
                    })
                });
                const tokenData: any = await tokenResp.json();
                if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error);

                // Get User Info
                const userResp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                    headers: { Authorization: `Bearer ${tokenData.access_token}` }
                });
                const userData: any = await userResp.json();
                email = userData.email;
                providerId = userData.id;

            } else if (provider === 'github') {
                const tokenResp = await fetch('https://github.com/login/oauth/access_token', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        client_id: env.GITHUB_CLIENT_ID?.trim(),
                        client_secret: env.GITHUB_CLIENT_SECRET?.trim(),
                        code,
                        redirect_uri: url.origin + '/auth/callback/github'
                    })
                });
                const tokenData: any = await tokenResp.json();
                if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error);

                const userResp = await fetch('https://api.github.com/user', {
                    headers: { 
                        Authorization: `Bearer ${tokenData.access_token}`,
                        'User-Agent': 'Memoraid-Backend'
                    }
                });
                const userData: any = await userResp.json();
                email = userData.email; // Note: might be null if private
                providerId = String(userData.id);
                
                // Fallback for private emails
                if (!email) {
                    const emailsResp = await fetch('https://api.github.com/user/emails', {
                        headers: { 
                            Authorization: `Bearer ${tokenData.access_token}`,
                            'User-Agent': 'Memoraid-Backend'
                        }
                    });
                    const emails: any = await emailsResp.json();
                    email = emails.find((e: any) => e.primary)?.email || emails[0]?.email;
                }
            }

            // Create/Update User - 使用 INSERT OR REPLACE 来处理所有冲突情况
            const userId = `${provider}_${providerId}`;
            
            // 先尝试更新现有用户，如果不存在则插入
            const existingUser = await env.DB.prepare(
                `SELECT id FROM users WHERE id = ? OR email = ?`
            ).bind(userId, email).first();
            
            if (existingUser) {
                // 更新现有用户
                await env.DB.prepare(
                    `UPDATE users SET email = ?, provider = ?, provider_id = ? WHERE id = ? OR email = ?`
                ).bind(email, provider, providerId, userId, email).run();
            } else {
                // 插入新用户
                await env.DB.prepare(
                    `INSERT INTO users (id, email, provider, provider_id) VALUES (?, ?, ?, ?)`
                ).bind(userId, email, provider, providerId).run();
            }

            // Generate App Token (Simple Mock JWT for demo, ideally use proper JWT lib)
            // For security, use a proper JWT library with signature in production
            const appToken = btoa(JSON.stringify({ userId, email, exp: Date.now() + 30 * 24 * 3600 * 1000 }));
            const fullToken = `mock_jwt_${appToken}`; // Using prefix for consistency with middleware

            // Redirect back to extension
            return Response.redirect(`${extRedirectUri}?token=${fullToken}&email=${encodeURIComponent(email)}`, 302);

        } catch (e: any) {
            return new Response(`Auth Failed: ${e.message}`, { status: 500 });
        }
    }
    
    // Middleware: Extract User ID from Token
    const authHeader = request.headers.get('Authorization');
    let userId = 'test_user';

    if (authHeader && authHeader.startsWith('Bearer mock_jwt_')) {
        try {
            const tokenPart = authHeader.split('Bearer mock_jwt_')[1];
            // If it's the old simple mock token
            if (tokenPart.startsWith('google_') || tokenPart.startsWith('github_')) {
                userId = tokenPart;
            } else {
                // Try decoding base64
                const payload = JSON.parse(atob(tokenPart));
                userId = payload.userId;
            }
        } catch (e) {
            // Invalid token
            // return new Response('Unauthorized', { status: 401, headers: corsHeaders });
        }
    } else {
        // Enforce Auth for settings routes in production
        // return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    // 2. GET Settings
    if (url.pathname === '/settings' && request.method === 'GET') {
      const result = await env.DB.prepare(
        'SELECT encrypted_data, salt, iv, updated_at FROM settings WHERE user_id = ?'
      ).bind(userId).first();

      if (!result) {
        return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: corsHeaders });
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 3. POST Settings
    if (url.pathname === '/settings' && request.method === 'POST') {
      try {
        const body = await request.json() as SaveSettingsRequest;
        const { encryptedData, salt, iv } = body;

        // Ensure user exists to satisfy Foreign Key constraint
        // This handles cases where we use 'test_user' or db was reset but token remains
        await env.DB.prepare(
          `INSERT OR IGNORE INTO users (id, email, provider, provider_id) VALUES (?, ?, ?, ?)`
        ).bind(userId, `${userId}@placeholder.com`, 'system_auto', userId).run();

        await env.DB.prepare(
          `INSERT INTO settings (user_id, encrypted_data, salt, iv, updated_at) 
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(user_id) DO UPDATE SET 
             encrypted_data=excluded.encrypted_data,
             salt=excluded.salt,
             iv=excluded.iv,
             updated_at=excluded.updated_at`
        ).bind(userId, encryptedData, salt, iv, Math.floor(Date.now() / 1000)).run();

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message || String(e) }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // 4. GET Shared API Key - 为用户分配一个共享的 NVIDIA API 密钥
    if (url.pathname === '/api-key/nvidia' && request.method === 'GET') {
      try {
        // 使用设备指纹或 IP 作为用户标识（匿名用户也可以使用）
        const clientId = request.headers.get('X-Client-Id') || 
                         request.headers.get('CF-Connecting-IP') || 
                         'anonymous_' + Math.random().toString(36).substring(7);
        
        // 检查用户是否已经分配了密钥
        const existingAssignment = await env.DB.prepare(
          `SELECT ak.api_key FROM user_api_key_assignments ua 
           JOIN api_keys ak ON ua.api_key_id = ak.id 
           WHERE ua.user_id = ? AND ak.is_active = 1`
        ).bind(clientId).first();
        
        if (existingAssignment) {
          // 更新使用统计
          await env.DB.prepare(
            `UPDATE api_keys SET usage_count = usage_count + 1, last_used_at = ? 
             WHERE api_key = ?`
          ).bind(Math.floor(Date.now() / 1000), existingAssignment.api_key).run();
          
          return new Response(JSON.stringify({ 
            apiKey: existingAssignment.api_key,
            cached: true 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // 随机选择一个活跃的密钥（负载均衡）
        const randomKey = await env.DB.prepare(
          `SELECT id, api_key FROM api_keys 
           WHERE is_active = 1 AND provider = 'nvidia'
           ORDER BY usage_count ASC, RANDOM() 
           LIMIT 1`
        ).first();
        
        if (!randomKey) {
          return new Response(JSON.stringify({ error: 'No available API keys' }), {
            status: 503,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // 分配密钥给用户
        await env.DB.prepare(
          `INSERT OR REPLACE INTO user_api_key_assignments (user_id, api_key_id, assigned_at) 
           VALUES (?, ?, ?)`
        ).bind(clientId, randomKey.id, Math.floor(Date.now() / 1000)).run();
        
        // 更新使用统计
        await env.DB.prepare(
          `UPDATE api_keys SET usage_count = usage_count + 1, last_used_at = ? WHERE id = ?`
        ).bind(Math.floor(Date.now() / 1000), randomKey.id).run();
        
        return new Response(JSON.stringify({ 
          apiKey: randomKey.api_key,
          cached: false 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // 5. POST Logs (Debug Mode)
    if (url.pathname === '/logs' && request.method === 'POST') {
      try {
        const body = await request.json() as any;
        const { error, stack, context, userAgent, url: pageUrl } = body;
        
        // We use the userId from auth middleware if available, or 'anonymous'
        // Since logs might come from unauthenticated contexts in debug mode, we allow it.
        const logUserId = userId || 'anonymous';

        await env.DB.prepare(
          `INSERT INTO logs (user_id, error, stack, context, user_agent, url) 
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          logUserId, 
          error || 'Unknown Error', 
          stack || '', 
          JSON.stringify(context || {}), 
          userAgent || '', 
          pageUrl || ''
        ).run();

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
    }

    // ==================== 远程调试系统 API ====================

    // 6.1 POST /debug/session - 插件注册调试会话（生成验证码）
    if (url.pathname === '/debug/session' && request.method === 'POST') {
      try {
        const body = await request.json() as any;
        const { pluginInfo } = body;
        
        // 生成6位随机验证码
        const verificationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        // 创建调试会话
        await env.DB.prepare(
          `INSERT INTO debug_sessions (verification_code, plugin_info, is_active, last_heartbeat) 
           VALUES (?, ?, 1, ?)`
        ).bind(verificationCode, JSON.stringify(pluginInfo || {}), Math.floor(Date.now() / 1000)).run();

        return new Response(JSON.stringify({ 
          success: true,
          verificationCode,
          message: '调试会话已创建，请在后台使用此验证码发送命令'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
    }

    // 6.2 POST /debug/command - 发送调试命令到指定插件
    if (url.pathname === '/debug/command' && request.method === 'POST') {
      try {
        const body = await request.json() as any;
        const { verificationCode, commandType, commandData } = body;

        if (!verificationCode || !commandType) {
          return new Response(JSON.stringify({ error: '缺少验证码或命令类型' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // 验证会话是否存在且活跃
        const session = await env.DB.prepare(
          `SELECT * FROM debug_sessions WHERE verification_code = ? AND is_active = 1`
        ).bind(verificationCode).first();

        if (!session) {
          return new Response(JSON.stringify({ error: '无效的验证码或会话已过期' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // 插入命令
        const expiresAt = Math.floor(Date.now() / 1000) + 300; // 5分钟过期
        const result = await env.DB.prepare(
          `INSERT INTO debug_commands (verification_code, command_type, command_data, status, expires_at) 
           VALUES (?, ?, ?, 'pending', ?)`
        ).bind(verificationCode, commandType, JSON.stringify(commandData || {}), expiresAt).run();

        return new Response(JSON.stringify({ 
          success: true,
          commandId: result.meta.last_row_id,
          message: '命令已发送，等待插件执行'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
    }

    // 6.3 GET /debug/poll/:code - 插件轮询待执行的命令
    if (url.pathname.startsWith('/debug/poll/') && request.method === 'GET') {
      try {
        const verificationCode = url.pathname.split('/').pop();
        
        if (!verificationCode) {
          return new Response(JSON.stringify({ error: '缺少验证码' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // 更新会话心跳
        await env.DB.prepare(
          `UPDATE debug_sessions SET last_heartbeat = ? WHERE verification_code = ?`
        ).bind(Math.floor(Date.now() / 1000), verificationCode).run();

        // 获取待执行的命令（只取最早的一条）
        const now = Math.floor(Date.now() / 1000);
        const command = await env.DB.prepare(
          `SELECT id, command_type, command_data, created_at 
           FROM debug_commands 
           WHERE verification_code = ? AND status = 'pending' AND (expires_at IS NULL OR expires_at > ?)
           ORDER BY created_at ASC 
           LIMIT 1`
        ).bind(verificationCode, now).first();

        if (!command) {
          return new Response(JSON.stringify({ 
            hasCommand: false,
            message: '暂无待执行命令'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // 标记命令为执行中
        await env.DB.prepare(
          `UPDATE debug_commands SET status = 'executing' WHERE id = ?`
        ).bind(command.id).run();

        return new Response(JSON.stringify({ 
          hasCommand: true,
          command: {
            id: command.id,
            type: command.command_type,
            data: JSON.parse(command.command_data as string || '{}')
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
    }

    // 6.4 POST /debug/result - 插件上报命令执行结果
    if (url.pathname === '/debug/result' && request.method === 'POST') {
      try {
        const body = await request.json() as any;
        const { commandId, verificationCode, resultType, resultData, screenshotBase64, executionTime } = body;

        if (!commandId || !verificationCode) {
          return new Response(JSON.stringify({ error: '缺少命令ID或验证码' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // 更新命令状态
        const newStatus = resultType === 'success' ? 'completed' : 'failed';
        await env.DB.prepare(
          `UPDATE debug_commands SET status = ? WHERE id = ?`
        ).bind(newStatus, commandId).run();

        // 插入结果
        await env.DB.prepare(
          `INSERT INTO debug_results (command_id, verification_code, result_type, result_data, screenshot_base64, execution_time) 
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          commandId, 
          verificationCode, 
          resultType || 'success',
          JSON.stringify(resultData || {}),
          screenshotBase64 || null,
          executionTime || 0
        ).run();

        return new Response(JSON.stringify({ 
          success: true,
          message: '结果已上报'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
    }

    // 6.5 GET /debug/result/:commandId - 获取命令执行结果
    if (url.pathname.startsWith('/debug/result/') && request.method === 'GET') {
      try {
        const commandId = url.pathname.split('/').pop();
        
        if (!commandId) {
          return new Response(JSON.stringify({ error: '缺少命令ID' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // 获取命令状态
        const command = await env.DB.prepare(
          `SELECT id, command_type, command_data, status, created_at FROM debug_commands WHERE id = ?`
        ).bind(commandId).first();

        if (!command) {
          return new Response(JSON.stringify({ error: '命令不存在' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // 获取结果
        const result = await env.DB.prepare(
          `SELECT result_type, result_data, screenshot_base64, execution_time, created_at 
           FROM debug_results WHERE command_id = ? ORDER BY created_at DESC LIMIT 1`
        ).bind(commandId).first();

        return new Response(JSON.stringify({ 
          command: {
            id: command.id,
            type: command.command_type,
            data: JSON.parse(command.command_data as string || '{}'),
            status: command.status
          },
          result: result ? {
            type: result.result_type,
            data: JSON.parse(result.result_data as string || '{}'),
            screenshot: result.screenshot_base64,
            executionTime: result.execution_time,
            timestamp: result.created_at
          } : null
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
    }

    // 6.6 GET /debug/sessions - 获取所有活跃的调试会话
    if (url.pathname === '/debug/sessions' && request.method === 'GET') {
      try {
        const sessions = await env.DB.prepare(
          `SELECT verification_code, plugin_info, last_heartbeat, created_at 
           FROM debug_sessions 
           WHERE is_active = 1 AND last_heartbeat > ?
           ORDER BY created_at DESC`
        ).bind(Math.floor(Date.now() / 1000) - 300).all(); // 5分钟内有心跳的会话

        return new Response(JSON.stringify({ 
          sessions: sessions.results.map((s: any) => ({
            code: s.verification_code,
            pluginInfo: JSON.parse(s.plugin_info || '{}'),
            lastHeartbeat: s.last_heartbeat,
            createdAt: s.created_at
          }))
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
    }

    // 6.7 DELETE /debug/session/:code - 关闭调试会话
    if (url.pathname.startsWith('/debug/session/') && request.method === 'DELETE') {
      try {
        const verificationCode = url.pathname.split('/').pop();
        
        await env.DB.prepare(
          `UPDATE debug_sessions SET is_active = 0 WHERE verification_code = ?`
        ).bind(verificationCode).run();

        return new Response(JSON.stringify({ 
          success: true,
          message: '调试会话已关闭'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
    }

    // 6.8 GET /debug/history/:code - 获取会话的命令历史
    if (url.pathname.startsWith('/debug/history/') && request.method === 'GET') {
      try {
        const verificationCode = url.pathname.split('/').pop();
        
        const commands = await env.DB.prepare(
          `SELECT c.id, c.command_type, c.command_data, c.status, c.created_at,
                  r.result_type, r.result_data, r.execution_time
           FROM debug_commands c
           LEFT JOIN debug_results r ON c.id = r.command_id
           WHERE c.verification_code = ?
           ORDER BY c.created_at DESC
           LIMIT 50`
        ).bind(verificationCode).all();

        return new Response(JSON.stringify({ 
          history: commands.results.map((c: any) => ({
            id: c.id,
            type: c.command_type,
            data: JSON.parse(c.command_data || '{}'),
            status: c.status,
            createdAt: c.created_at,
            result: c.result_type ? {
              type: c.result_type,
              data: JSON.parse(c.result_data || '{}'),
              executionTime: c.execution_time
            } : null
          }))
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
    }

    // ==================== 文章发布统计系统 API ====================

    // 7.1 GET /admin - 文章管理后台页面 (深色主题，需要登录)
    if (url.pathname === '/admin' && request.method === 'GET') {
      const ASSETS_BASE = url.origin + '/assets/memoraid';
      const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Memoraid · 内容数据中心</title>
    <link rel="icon" type="image/png" href="${ASSETS_BASE}/icon-128.png">
    <link href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=Noto+Sans+SC:wght@300;400;500;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #09090b;
            --bg-subtle: #18181b;
            --bg-muted: #27272a;
            --surface: #1f1f23;
            --border: #3f3f46;
            --border-light: #2d2d30;
            --text: #fafafa;
            --text-secondary: #a1a1aa;
            --text-muted: #71717a;
            --accent: #22d3ee;
            --accent-secondary: #a78bfa;
            --gradient-1: linear-gradient(135deg, #22d3ee 0%, #a78bfa 50%, #f472b6 100%);
            --gradient-2: linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%);
            --coral: #f97316;
            --rose: #f43f5e;
            --violet: #a78bfa;
            --sky: #38bdf8;
            --amber: #fbbf24;
            --emerald: #34d399;
            --shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
            --shadow: 0 4px 6px -1px rgba(0,0,0,0.4);
            --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.5);
            --radius: 12px;
            --radius-lg: 20px;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body {
            font-family: 'Sora', 'Noto Sans SC', system-ui, sans-serif;
            background: var(--bg);
            color: var(--text);
            min-height: 100vh;
            line-height: 1.6;
            -webkit-font-smoothing: antialiased;
        }
        
        /* 背景装饰 */
        .bg-glow {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            pointer-events: none; z-index: 0;
            background: 
                radial-gradient(ellipse 80% 50% at 50% -20%, rgba(34, 211, 238, 0.08) 0%, transparent 50%),
                radial-gradient(ellipse 60% 40% at 90% 80%, rgba(167, 139, 250, 0.06) 0%, transparent 50%);
        }
        
        /* 顶部导航 */
        .topbar {
            position: sticky; top: 0; z-index: 100;
            background: rgba(9, 9, 11, 0.85);
            backdrop-filter: blur(20px);
            border-bottom: 1px solid var(--border);
            padding: 0 24px;
        }
        .topbar-inner {
            max-width: 1440px; margin: 0 auto;
            display: flex; align-items: center; justify-content: space-between;
            height: 64px;
        }
        .logo {
            display: flex; align-items: center; gap: 10px;
            font-weight: 600; font-size: 1.1rem; color: var(--text);
            text-decoration: none;
        }
        .logo-icon {
            width: 40px; height: 40px; border-radius: 12px;
            background: var(--gradient-2);
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 0 20px rgba(34, 211, 238, 0.3);
            overflow: hidden;
        }
        .logo-icon img { width: 40px; height: 40px; object-fit: cover; }
        .topbar-actions { display: flex; align-items: center; gap: 12px; }
        .user-info {
            display: flex; align-items: center; gap: 10px;
            padding: 6px 12px;
            background: var(--bg-muted);
            border-radius: 8px;
            font-size: 0.85rem;
            color: var(--text-secondary);
        }
        .user-avatar {
            width: 28px; height: 28px;
            border-radius: 50%;
            background: var(--gradient-1);
            display: flex; align-items: center; justify-content: center;
            font-size: 0.75rem; color: white; font-weight: 600;
        }
        .btn {
            display: inline-flex; align-items: center; gap: 6px;
            padding: 8px 16px; border-radius: 8px;
            font-size: 0.875rem; font-weight: 500;
            cursor: pointer; transition: all 0.2s;
            border: none; background: transparent;
            color: var(--text);
        }
        .btn-ghost { color: var(--text-secondary); }
        .btn-ghost:hover { background: var(--bg-muted); color: var(--text); }
        .btn-logout {
            color: var(--rose);
        }
        .btn-logout:hover { background: rgba(244, 63, 94, 0.1); }
        
        /* 主容器 */
        .container { max-width: 1440px; margin: 0 auto; padding: 32px 24px; }
        
        /* 页面标题区 */
        .page-header { margin-bottom: 40px; }
        .page-title {
            font-size: 2rem; font-weight: 700; color: var(--text);
            letter-spacing: -0.02em; margin-bottom: 8px;
        }
        .page-subtitle { color: var(--text-muted); font-size: 1rem; }
        
        /* 统计卡片网格 */
        .stats-row {
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            gap: 16px;
            margin-bottom: 40px;
        }
        .stat-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 20px;
            transition: all 0.25s ease;
            position: relative;
            overflow: hidden;
        }
        .stat-card:hover {
            border-color: var(--accent);
            box-shadow: var(--shadow-lg);
            transform: translateY(-2px);
        }
        .stat-card .stat-icon {
            width: 40px; height: 40px;
            border-radius: 12px;
            display: flex; align-items: center; justify-content: center;
            font-size: 1.25rem;
            margin-bottom: 16px;
        }
        .stat-card .stat-icon.articles { background: rgba(251, 191, 36, 0.15); }
        .stat-card .stat-icon.reads { background: rgba(56, 189, 248, 0.15); }
        .stat-card .stat-icon.likes { background: rgba(244, 63, 94, 0.15); }
        .stat-card .stat-icon.comments { background: rgba(52, 211, 153, 0.15); }
        .stat-card .stat-icon.shares { background: rgba(167, 139, 250, 0.15); }
        .stat-card .stat-icon.collects { background: rgba(251, 191, 36, 0.15); }
        .stat-card .stat-value {
            font-size: 1.75rem; font-weight: 700;
            color: var(--text); letter-spacing: -0.02em;
            line-height: 1.2;
            background: var(--gradient-1);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .stat-card .stat-label {
            font-size: 0.8rem; color: var(--text-muted);
            margin-top: 4px; font-weight: 500;
        }
        
        /* 筛选标签 */
        .filter-section { margin-bottom: 32px; }
        .filter-label {
            font-size: 0.75rem; font-weight: 600;
            color: var(--text-muted); text-transform: uppercase;
            letter-spacing: 0.05em; margin-bottom: 12px;
        }
        .filter-tags { display: flex; gap: 8px; flex-wrap: wrap; }
        .filter-tag {
            padding: 8px 16px; border-radius: 100px;
            font-size: 0.875rem; font-weight: 500;
            cursor: pointer; transition: all 0.2s;
            border: 1px solid var(--border);
            background: var(--surface); color: var(--text-secondary);
        }
        .filter-tag:hover { border-color: var(--accent); color: var(--text); }
        .filter-tag.active {
            background: var(--gradient-2); color: white;
            border-color: transparent;
        }
        
        /* 内容区块 */
        .content-section { margin-bottom: 48px; }
        .section-header {
            display: flex; align-items: center; justify-content: space-between;
            margin-bottom: 20px;
        }
        .section-title {
            font-size: 1.125rem; font-weight: 600; color: var(--text);
            display: flex; align-items: center; gap: 8px;
        }
        .section-title .count {
            background: var(--border-light);
            padding: 2px 10px; border-radius: 100px;
            font-size: 0.75rem; color: var(--text-muted);
        }
        
        /* 账号卡片 */
        .accounts-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
            gap: 16px;
        }
        .account-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius-lg);
            padding: 24px;
            transition: all 0.25s ease;
        }
        .account-card:hover {
            box-shadow: var(--shadow-lg);
            transform: translateY(-3px);
        }
        .account-top {
            display: flex; align-items: center; gap: 14px;
            margin-bottom: 20px;
        }
        .account-avatar {
            width: 48px; height: 48px;
            border-radius: 14px;
            background: var(--gradient-2);
            display: flex; align-items: center; justify-content: center;
            font-size: 1.5rem;
            box-shadow: 0 0 20px rgba(34, 211, 238, 0.2);
        }
        .account-meta h3 {
            font-size: 1rem; font-weight: 600; color: var(--text);
            margin-bottom: 2px;
        }
        .account-meta .platform-tag {
            font-size: 0.75rem; color: var(--text-muted);
            display: flex; align-items: center; gap: 4px;
        }
        .account-metrics {
            display: grid; grid-template-columns: repeat(3, 1fr);
            gap: 12px; padding-top: 16px;
            border-top: 1px solid var(--border-light);
        }
        .metric {
            text-align: center; padding: 12px 8px;
            background: var(--bg-subtle); border-radius: 10px;
        }
        .metric-value {
            font-size: 1.25rem; font-weight: 700;
            color: var(--accent);
        }
        .metric-label {
            font-size: 0.7rem; color: var(--text-muted);
            margin-top: 2px; font-weight: 500;
        }
        
        /* 文章表格 */
        .table-wrapper {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius-lg);
            overflow: hidden;
        }
        .data-table { width: 100%; border-collapse: collapse; }
        .data-table th {
            text-align: left; padding: 14px 20px;
            font-size: 0.75rem; font-weight: 600;
            color: var(--text-muted); text-transform: uppercase;
            letter-spacing: 0.04em;
            background: var(--bg-subtle); border-bottom: 1px solid var(--border);
        }
        .data-table td {
            padding: 16px 20px;
            border-bottom: 1px solid var(--border);
            font-size: 0.9rem;
        }
        .data-table tr:last-child td { border-bottom: none; }
        .data-table tr:hover { background: var(--bg-muted); }
        .article-title {
            font-weight: 500; color: var(--text);
            text-decoration: none; display: block;
            max-width: 360px;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
            transition: color 0.2s;
        }
        .article-title:hover { color: var(--accent); }
        .platform-cell {
            display: flex; align-items: center; gap: 6px;
            font-size: 0.85rem; color: var(--text-secondary);
        }
        .stat-pill {
            display: inline-flex; align-items: center; gap: 4px;
            padding: 4px 10px; border-radius: 6px;
            font-size: 0.8rem; font-weight: 500;
            background: var(--bg-muted);
        }
        .stat-pill.read { color: var(--sky); }
        .stat-pill.like { color: var(--rose); }
        .stat-pill.comment { color: var(--emerald); }
        .stat-pill.share { color: var(--violet); }
        .time-cell { color: var(--text-muted); font-size: 0.85rem; }
        
        /* 空状态 */
        .empty-state {
            text-align: center; padding: 80px 20px;
            color: var(--text-muted);
        }
        .empty-icon {
            width: 80px; height: 80px; margin: 0 auto 20px;
            background: var(--bg-muted); border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            font-size: 2.5rem; opacity: 0.6;
        }
        .empty-text { font-size: 1rem; }
        
        /* 加载状态 */
        .loading-state {
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            padding: 60px 20px; gap: 16px;
        }
        .spinner {
            width: 32px; height: 32px;
            border: 3px solid var(--border);
            border-top-color: var(--accent);
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .loading-text { color: var(--text-muted); font-size: 0.9rem; }
        
        /* 登录遮罩 */
        .auth-overlay {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: var(--bg);
            display: flex; align-items: center; justify-content: center;
            z-index: 9999;
        }
        .auth-message {
            text-align: center;
        }
        .auth-message h2 {
            font-size: 1.5rem; margin-bottom: 16px;
        }
        .auth-message p {
            color: var(--text-secondary); margin-bottom: 24px;
        }
        .auth-message .btn-login {
            display: inline-flex; align-items: center; gap: 8px;
            padding: 14px 28px; border-radius: 12px;
            background: var(--gradient-2);
            color: white; font-size: 1rem; font-weight: 600;
            text-decoration: none; transition: all 0.3s;
        }
        .auth-message .btn-login:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 30px rgba(34, 211, 238, 0.3);
        }
        
        /* 动画 */
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .fade-in { animation: fadeIn 0.4s ease forwards; }
        .delay-1 { animation-delay: 0.1s; opacity: 0; }
        .delay-2 { animation-delay: 0.2s; opacity: 0; }
        .delay-3 { animation-delay: 0.3s; opacity: 0; }
        
        /* 响应式 */
        @media (max-width: 1200px) {
            .stats-row { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 768px) {
            .stats-row { grid-template-columns: repeat(2, 1fr); }
            .accounts-grid { grid-template-columns: 1fr; }
            .table-wrapper { overflow-x: auto; }
            .data-table { min-width: 800px; }
            .topbar-inner { padding: 0 16px; }
            .container { padding: 24px 16px; }
        }
    </style>
</head>
<body>
    <div class="bg-glow"></div>
    
    <!-- 登录验证遮罩 -->
    <div class="auth-overlay" id="authOverlay">
        <div class="auth-message">
            <div class="spinner" style="margin: 0 auto 20px;"></div>
            <h2>验证登录状态...</h2>
        </div>
    </div>
    
    <!-- 顶部导航 -->
    <nav class="topbar">
        <div class="topbar-inner">
            <a href="/" class="logo">
                <div class="logo-icon">
                    <img src="${ASSETS_BASE}/icon-128.png" alt="M">
                </div>
                <span>Memoraid</span>
            </a>
            <div class="topbar-actions">
                <div class="user-info" id="userInfo" style="display:none;">
                    <div class="user-avatar" id="userAvatar">U</div>
                    <span id="userEmail">user@example.com</span>
                </div>
                <button class="btn btn-ghost" onclick="loadData()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
                    刷新
                </button>
                <button class="btn btn-logout" onclick="logout()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    退出
                </button>
            </div>
        </div>
    </nav>
    
    <main class="container">
        <!-- 页面标题 -->
        <div class="page-header fade-in">
            <h1 class="page-title">内容数据中心</h1>
            <p class="page-subtitle">跨平台内容发布数据一站式管理</p>
        </div>
        
        <!-- 统计卡片 -->
        <div class="stats-row fade-in delay-1">
            <div class="stat-card">
                <div class="stat-icon articles">📝</div>
                <div class="stat-value" id="totalArticles">-</div>
                <div class="stat-label">文章总数</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon reads">👁</div>
                <div class="stat-value" id="totalReads">-</div>
                <div class="stat-label">累计阅读</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon likes">❤️</div>
                <div class="stat-value" id="totalLikes">-</div>
                <div class="stat-label">获得点赞</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon comments">💬</div>
                <div class="stat-value" id="totalComments">-</div>
                <div class="stat-label">收到评论</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon shares">🔗</div>
                <div class="stat-value" id="totalShares">-</div>
                <div class="stat-label">被转发</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon collects">⭐</div>
                <div class="stat-value" id="totalCollects">-</div>
                <div class="stat-label">被收藏</div>
            </div>
        </div>
        
        <!-- 平台筛选 -->
        <div class="filter-section fade-in delay-2">
            <div class="filter-label">按平台筛选</div>
            <div class="filter-tags" id="platformFilters"></div>
        </div>
        
        <!-- 账号概览 -->
        <section class="content-section fade-in delay-2">
            <div class="section-header">
                <h2 class="section-title">
                    账号概览
                    <span class="count" id="accountCount">0</span>
                </h2>
            </div>
            <div class="accounts-grid" id="accountsGrid">
                <div class="loading-state"><div class="spinner"></div><div class="loading-text">加载中...</div></div>
            </div>
        </section>
        
        <!-- 文章列表 -->
        <section class="content-section fade-in delay-3">
            <div class="section-header">
                <h2 class="section-title">
                    文章列表
                    <span class="count" id="articleCount">0</span>
                </h2>
            </div>
            <div class="table-wrapper" id="articlesTable">
                <div class="loading-state"><div class="spinner"></div><div class="loading-text">加载中...</div></div>
            </div>
        </section>
    </main>
    
    <script>
        const API_BASE = '';
        let currentPlatform = 'all';
        let userEmail = '';
        
        // 检查登录状态
        async function checkAuth() {
            const token = localStorage.getItem('memoraid_token');
            const email = localStorage.getItem('memoraid_email');
            
            if (!token) {
                showLoginRequired();
                return false;
            }
            
            try {
                const res = await fetch(API_BASE + '/api/auth/verify', {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                const data = await res.json();
                
                if (!data.authenticated) {
                    localStorage.removeItem('memoraid_token');
                    localStorage.removeItem('memoraid_email');
                    showLoginRequired();
                    return false;
                }
                
                // 登录成功，显示用户信息
                userEmail = data.email || email || 'User';
                document.getElementById('userEmail').textContent = userEmail;
                document.getElementById('userAvatar').textContent = userEmail.charAt(0).toUpperCase();
                document.getElementById('userInfo').style.display = 'flex';
                document.getElementById('authOverlay').style.display = 'none';
                return true;
            } catch (e) {
                console.error('Auth check failed:', e);
                showLoginRequired();
                return false;
            }
        }
        
        // 显示需要登录
        function showLoginRequired() {
            document.getElementById('authOverlay').innerHTML = 
                '<div class="auth-message">' +
                    '<h2>需要登录</h2>' +
                    '<p>请先登录以访问管理后台</p>' +
                    '<a href="/login" class="btn-login">' +
                        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>' +
                        '前往登录' +
                    '</a>' +
                '</div>';
        }
        
        // 退出登录
        function logout() {
            localStorage.removeItem('memoraid_token');
            localStorage.removeItem('memoraid_email');
            window.location.href = '/login';
        }
        
        // 格式化数字 - 更友好的显示
        function formatNum(n) {
            if (!n || n === 0) return '0';
            if (n >= 100000000) return (n / 100000000).toFixed(1) + '亿';
            if (n >= 10000) return (n / 10000).toFixed(1) + '万';
            if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
            return n.toLocaleString();
        }
        
        // 格式化时间 - 相对时间
        function formatTime(ts) {
            if (!ts) return '-';
            const now = Date.now();
            const diff = now - ts * 1000;
            const minutes = Math.floor(diff / 60000);
            const hours = Math.floor(diff / 3600000);
            const days = Math.floor(diff / 86400000);
            
            if (minutes < 1) return '刚刚';
            if (minutes < 60) return minutes + ' 分钟前';
            if (hours < 24) return hours + ' 小时前';
            if (days < 7) return days + ' 天前';
            
            const d = new Date(ts * 1000);
            return d.getFullYear() + '/' + (d.getMonth()+1) + '/' + d.getDate();
        }
        
        // 加载数据
        async function loadData() {
            const token = localStorage.getItem('memoraid_token');
            try {
                const query = currentPlatform !== 'all' ? '?platform=' + currentPlatform : '';
                const headers = token ? { 'Authorization': 'Bearer ' + token } : {};
                
                // 并行加载所有数据
                const [statsRes, platformsRes, accountsRes, articlesRes] = await Promise.all([
                    fetch(API_BASE + '/api/articles/stats' + query, { headers }),
                    fetch(API_BASE + '/api/platforms', { headers }),
                    fetch(API_BASE + '/api/accounts' + query, { headers }),
                    fetch(API_BASE + '/api/articles' + query, { headers })
                ]);
                
                const [stats, platforms, accounts, articles] = await Promise.all([
                    statsRes.json(), platformsRes.json(), accountsRes.json(), articlesRes.json()
                ]);
                
                // 更新统计数据
                document.getElementById('totalArticles').textContent = formatNum(stats.totalArticles);
                document.getElementById('totalReads').textContent = formatNum(stats.totalReads);
                document.getElementById('totalLikes').textContent = formatNum(stats.totalLikes);
                document.getElementById('totalComments').textContent = formatNum(stats.totalComments);
                document.getElementById('totalShares').textContent = formatNum(stats.totalShares);
                document.getElementById('totalCollects').textContent = formatNum(stats.totalCollects);
                
                // 渲染各部分
                renderPlatformFilters(platforms.platforms || []);
                renderAccounts(accounts.accounts || []);
                renderArticles(articles.articles || []);
                
            } catch (e) {
                console.error('加载数据失败:', e);
            }
        }
        
        // 渲染平台筛选标签
        function renderPlatformFilters(platforms) {
            let html = '<button class="filter-tag ' + (currentPlatform === 'all' ? 'active' : '') + '" onclick="filterPlatform(\\'all\\')">全部</button>';
            html += platforms.map(p => 
                '<button class="filter-tag ' + (currentPlatform === p.name ? 'active' : '') + '" onclick="filterPlatform(\\'' + p.name + '\\')">' + 
                (p.icon || '') + ' ' + p.display_name + '</button>'
            ).join('');
            document.getElementById('platformFilters').innerHTML = html;
        }
        
        // 渲染账号卡片
        function renderAccounts(accounts) {
            document.getElementById('accountCount').textContent = accounts.length;
            
            if (!accounts.length) {
                document.getElementById('accountsGrid').innerHTML = 
                    '<div class="empty-state"><div class="empty-icon">📭</div><p class="empty-text">暂无账号数据</p></div>';
                return;
            }
            
            const html = accounts.map(a => 
                '<div class="account-card">' +
                    '<div class="account-top">' +
                        '<div class="account-avatar">' + (a.platform_icon || '👤') + '</div>' +
                        '<div class="account-meta">' +
                            '<h3>' + (a.account_name || '未知账号') + '</h3>' +
                            '<div class="platform-tag">' + (a.platform_display_name || a.platform_name || '') + '</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="account-metrics">' +
                        '<div class="metric"><div class="metric-value">' + formatNum(a.article_count) + '</div><div class="metric-label">文章</div></div>' +
                        '<div class="metric"><div class="metric-value">' + formatNum(a.total_reads) + '</div><div class="metric-label">阅读</div></div>' +
                        '<div class="metric"><div class="metric-value">' + formatNum(a.total_likes) + '</div><div class="metric-label">点赞</div></div>' +
                    '</div>' +
                '</div>'
            ).join('');
            
            document.getElementById('accountsGrid').innerHTML = html;
        }
        
        // 渲染文章表格
        function renderArticles(articles) {
            document.getElementById('articleCount').textContent = articles.length;
            
            if (!articles.length) {
                document.getElementById('articlesTable').innerHTML = 
                    '<div class="empty-state"><div class="empty-icon">📄</div><p class="empty-text">暂无文章数据</p></div>';
                return;
            }
            
            const rows = articles.map(a => 
                '<tr>' +
                    '<td><a href="' + (a.article_url || '#') + '" target="_blank" class="article-title">' + (a.title || '无标题') + '</a></td>' +
                    '<td><div class="platform-cell">' + (a.platform_icon || '') + ' ' + (a.platform_display_name || '') + '</div></td>' +
                    '<td>' + (a.account_name || '-') + '</td>' +
                    '<td><span class="stat-pill read">' + formatNum(a.read_count) + '</span></td>' +
                    '<td><span class="stat-pill like">' + formatNum(a.like_count) + '</span></td>' +
                    '<td><span class="stat-pill comment">' + formatNum(a.comment_count) + '</span></td>' +
                    '<td><span class="stat-pill share">' + formatNum(a.share_count) + '</span></td>' +
                    '<td class="time-cell">' + formatTime(a.publish_time) + '</td>' +
                '</tr>'
            ).join('');
            
            document.getElementById('articlesTable').innerHTML = 
                '<table class="data-table">' +
                    '<thead><tr>' +
                        '<th>标题</th><th>平台</th><th>账号</th>' +
                        '<th>阅读</th><th>点赞</th><th>评论</th><th>转发</th><th>发布时间</th>' +
                    '</tr></thead>' +
                    '<tbody>' + rows + '</tbody>' +
                '</table>';
        }
        
        // 平台筛选
        function filterPlatform(platform) {
            currentPlatform = platform;
            loadData();
        }
        
        // 初始化：先检查登录，再加载数据
        async function init() {
            const isAuth = await checkAuth();
            if (isAuth) {
                loadData();
            }
        }
        
        init();
    </script>
</body>
</html>`;
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=UTF-8' } });
    }

    // 7.2 GET /api/platforms - 获取所有平台
    if (url.pathname === '/api/platforms' && request.method === 'GET') {
      try {
        const platforms = await env.DB.prepare(
          'SELECT id, name, display_name, icon FROM platforms ORDER BY id'
        ).all();
        return new Response(JSON.stringify({ platforms: platforms.results }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // 7.3 GET /api/accounts - 获取账号列表（含统计）
    if (url.pathname === '/api/accounts' && request.method === 'GET') {
      try {
        const platform = url.searchParams.get('platform');
        let query = `
          SELECT a.*, p.name as platform_name, p.display_name as platform_display_name, p.icon as platform_icon,
            (SELECT COUNT(*) FROM articles WHERE account_id = a.id) as article_count,
            (SELECT COALESCE(SUM(s.read_count), 0) FROM articles art 
             LEFT JOIN article_stats s ON s.id = (SELECT MAX(id) FROM article_stats WHERE article_id = art.id)
             WHERE art.account_id = a.id) as total_reads,
            (SELECT COALESCE(SUM(s.like_count), 0) FROM articles art 
             LEFT JOIN article_stats s ON s.id = (SELECT MAX(id) FROM article_stats WHERE article_id = art.id)
             WHERE art.account_id = a.id) as total_likes
          FROM accounts a
          JOIN platforms p ON a.platform_id = p.id
        `;
        if (platform) query += ` WHERE p.name = '${platform}'`;
        query += ' ORDER BY a.updated_at DESC';
        
        const accounts = await env.DB.prepare(query).all();
        return new Response(JSON.stringify({ accounts: accounts.results }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // 7.4 GET /api/articles - 获取文章列表（含最新统计）
    if (url.pathname === '/api/articles' && request.method === 'GET') {
      try {
        const platform = url.searchParams.get('platform');
        const accountId = url.searchParams.get('account_id');
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const offset = parseInt(url.searchParams.get('offset') || '0');
        
        let query = `
          SELECT art.*, acc.account_name, p.name as platform_name, p.display_name as platform_display_name, p.icon as platform_icon,
            COALESCE(s.read_count, 0) as read_count,
            COALESCE(s.like_count, 0) as like_count,
            COALESCE(s.comment_count, 0) as comment_count,
            COALESCE(s.share_count, 0) as share_count,
            COALESCE(s.collect_count, 0) as collect_count,
            COALESCE(s.forward_count, 0) as forward_count
          FROM articles art
          JOIN accounts acc ON art.account_id = acc.id
          JOIN platforms p ON acc.platform_id = p.id
          LEFT JOIN article_stats s ON s.id = (SELECT MAX(id) FROM article_stats WHERE article_id = art.id)
          WHERE 1=1
        `;
        if (platform) query += ` AND p.name = '${platform}'`;
        if (accountId) query += ` AND art.account_id = ${accountId}`;
        query += ` ORDER BY art.publish_time DESC LIMIT ${limit} OFFSET ${offset}`;
        
        const articles = await env.DB.prepare(query).all();
        return new Response(JSON.stringify({ articles: articles.results }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // 7.5 GET /api/articles/stats - 获取总体统计
    if (url.pathname === '/api/articles/stats' && request.method === 'GET') {
      try {
        const platform = url.searchParams.get('platform');
        let whereClause = '';
        if (platform) {
          whereClause = `WHERE p.name = '${platform}'`;
        }
        
        const stats = await env.DB.prepare(`
          SELECT 
            COUNT(DISTINCT art.id) as totalArticles,
            COALESCE(SUM(s.read_count), 0) as totalReads,
            COALESCE(SUM(s.like_count), 0) as totalLikes,
            COALESCE(SUM(s.comment_count), 0) as totalComments,
            COALESCE(SUM(s.share_count), 0) as totalShares,
            COALESCE(SUM(s.collect_count), 0) as totalCollects
          FROM articles art
          JOIN accounts acc ON art.account_id = acc.id
          JOIN platforms p ON acc.platform_id = p.id
          LEFT JOIN article_stats s ON s.id = (SELECT MAX(id) FROM article_stats WHERE article_id = art.id)
          ${whereClause}
        `).first();
        
        return new Response(JSON.stringify(stats || {}), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // 7.6 POST /api/articles/report - 上报文章数据（供插件调用）
    if (url.pathname === '/api/articles/report' && request.method === 'POST') {
      try {
        const body = await request.json() as any;
        const { platform, account, articles } = body;
        
        if (!platform || !account || !articles) {
          return new Response(JSON.stringify({ error: '缺少必要参数' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // 获取或创建平台
        let platformRow = await env.DB.prepare(
          'SELECT id FROM platforms WHERE name = ?'
        ).bind(platform).first();
        
        if (!platformRow) {
          await env.DB.prepare(
            'INSERT INTO platforms (name, display_name, icon) VALUES (?, ?, ?)'
          ).bind(platform, platform, '📄').run();
          platformRow = await env.DB.prepare('SELECT id FROM platforms WHERE name = ?').bind(platform).first();
        }
        
        // 获取或创建账号
        let accountRow = await env.DB.prepare(
          'SELECT id FROM accounts WHERE platform_id = ? AND account_id = ?'
        ).bind(platformRow!.id, account.id).first();
        
        if (!accountRow) {
          await env.DB.prepare(
            'INSERT INTO accounts (platform_id, account_id, account_name, avatar_url, extra_info) VALUES (?, ?, ?, ?, ?)'
          ).bind(platformRow!.id, account.id, account.name || '', account.avatar || '', JSON.stringify(account.extra || {})).run();
          accountRow = await env.DB.prepare('SELECT id FROM accounts WHERE platform_id = ? AND account_id = ?').bind(platformRow!.id, account.id).first();
        } else {
          // 更新账号信息
          await env.DB.prepare(
            'UPDATE accounts SET account_name = ?, avatar_url = ?, updated_at = ? WHERE id = ?'
          ).bind(account.name || '', account.avatar || '', Math.floor(Date.now() / 1000), accountRow.id).run();
        }
        
        // 批量处理文章
        let inserted = 0, updated = 0;
        for (const art of articles) {
          // 获取或创建文章
          let articleRow = await env.DB.prepare(
            'SELECT id FROM articles WHERE account_id = ? AND article_id = ?'
          ).bind(accountRow!.id, art.id).first();
          
          if (!articleRow) {
            await env.DB.prepare(
              'INSERT INTO articles (account_id, article_id, title, content_summary, cover_image, article_url, publish_time, status, extra_info) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
            ).bind(accountRow!.id, art.id, art.title || '', art.summary || '', art.cover || '', art.url || '', art.publishTime || Math.floor(Date.now() / 1000), art.status || 'published', JSON.stringify(art.extra || {})).run();
            articleRow = await env.DB.prepare('SELECT id FROM articles WHERE account_id = ? AND article_id = ?').bind(accountRow!.id, art.id).first();
            inserted++;
          } else {
            // 更新文章信息
            await env.DB.prepare(
              'UPDATE articles SET title = ?, content_summary = ?, cover_image = ?, article_url = ?, updated_at = ? WHERE id = ?'
            ).bind(art.title || '', art.summary || '', art.cover || '', art.url || '', Math.floor(Date.now() / 1000), articleRow.id).run();
            updated++;
          }
          
          // 插入统计数据
          if (art.stats) {
            await env.DB.prepare(
              'INSERT INTO article_stats (article_id, read_count, like_count, comment_count, share_count, collect_count, forward_count, extra_stats) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            ).bind(articleRow!.id, art.stats.read || 0, art.stats.like || 0, art.stats.comment || 0, art.stats.share || 0, art.stats.collect || 0, art.stats.forward || 0, JSON.stringify(art.stats.extra || {})).run();
          }
        }
        
        return new Response(JSON.stringify({ success: true, inserted, updated }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
};
