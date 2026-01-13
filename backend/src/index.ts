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

function buildHtmlResponse(html: string, extraHeaders?: Record<string, string>): Response {
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=UTF-8',
      'Cache-Control': 'public, max-age=300',
      ...(extraHeaders ?? {}),
    },
  });
}

function getEffectiveOrigin(request: Request, url: URL): string {
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? request.headers.get('X-Forwarded-Proto');
  const forwardedHost = request.headers.get('x-forwarded-host') ?? request.headers.get('X-Forwarded-Host');
  const cfVisitor = request.headers.get('cf-visitor');

  let protocol = url.protocol.replace(':', '');
  if (forwardedProto) protocol = forwardedProto.split(',')[0].trim();
  if (cfVisitor) {
    try {
      const data = JSON.parse(cfVisitor) as { scheme?: string };
      if (data.scheme) protocol = data.scheme;
    } catch {
    }
  }

  const host = forwardedHost ? forwardedHost.split(',')[0].trim() : url.host;
  return `${protocol}://${host}`;
}

function renderMarketingShell(args: {
  origin: string;
  title: string;
  description: string;
  body: string;
}): string {
  const { origin, title, description, body } = args;
  const ASSETS_BASE = `${origin}/assets/memoraid`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <link rel="icon" type="image/png" href="${ASSETS_BASE}/icon-128.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+SC:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    :root{
      --bg:#ffffff;
      --bg-soft:#f8fafc;
      --bg-soft-2:#f3f4f6;
      --border:#e5e7eb;
      --text:#0f172a;
      --text-2:#334155;
      --text-3:#64748b;
      --shadow:0 10px 30px rgba(2,6,23,.08);
      --shadow-sm:0 6px 16px rgba(2,6,23,.08);
      --radius:16px;
      --radius-sm:12px;
      --accent:#111827;
      --accent-2:#10b981;
      --accent-3:#a78bfa;
    }
    *{box-sizing:border-box}
    html,body{height:100%}
    body{
      margin:0;
      font-family:Inter,"Noto Sans SC",system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
      color:var(--text);
      background:var(--bg);
      line-height:1.6;
    }
    a{color:inherit}
    .container{max-width:1160px;margin:0 auto;padding:0 20px}
    .top-glow{
      position:fixed;inset:0;pointer-events:none;z-index:0;
      background:
        radial-gradient(800px 400px at 30% -10%, rgba(16,185,129,.18), transparent 60%),
        radial-gradient(900px 450px at 80% 10%, rgba(167,139,250,.14), transparent 60%);
      filter:saturate(115%);
    }

    .nav{
      position:sticky;top:0;z-index:10;
      background:rgba(255,255,255,.82);
      backdrop-filter:blur(14px);
      border-bottom:1px solid var(--border);
    }
    .nav-inner{height:64px;display:flex;align-items:center;justify-content:space-between;gap:16px}
    .brand{display:flex;align-items:center;gap:10px;text-decoration:none}
    .brand img{width:34px;height:34px;border-radius:10px}
    .brand span{font-weight:700;letter-spacing:-.02em}
    .nav-links{display:flex;align-items:center;gap:10px}
    .nav-links a{
      text-decoration:none;
      color:var(--text-3);
      font-weight:600;
      font-size:14px;
      padding:8px 10px;
      border-radius:10px;
      transition:background .15s,color .15s;
    }
    .nav-links a:hover{background:var(--bg-soft);color:var(--text)}
    .nav-actions{display:flex;align-items:center;gap:10px}

    .btn{
      display:inline-flex;align-items:center;justify-content:center;gap:10px;
      border-radius:999px;
      padding:10px 16px;
      font-weight:700;
      font-size:14px;
      text-decoration:none;
      border:1px solid transparent;
      transition:transform .15s,box-shadow .15s,background .15s,border-color .15s;
      white-space:nowrap;
    }
    .btn:active{transform:translateY(0)}
    .btn-primary{
      background:var(--accent);
      color:#fff;
      box-shadow:0 10px 18px rgba(2,6,23,.10);
    }
    .btn-primary:hover{transform:translateY(-1px);box-shadow:0 14px 28px rgba(2,6,23,.12)}
    .btn-ghost{background:transparent;border-color:var(--border);color:var(--text)}
    .btn-ghost:hover{background:var(--bg-soft)}

    .hero{position:relative;z-index:1;padding:78px 0 18px}
    .hero-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:42px;align-items:center}
    .pill{
      display:inline-flex;align-items:center;gap:8px;
      padding:7px 12px;border:1px solid var(--border);border-radius:999px;
      background:rgba(248,250,252,.9);
      color:var(--text-3);
      font-weight:700;
      font-size:12px;
    }
    .hero h1{margin:16px 0 14px;font-size:48px;line-height:1.08;letter-spacing:-.03em}
    .hero p{margin:0;color:var(--text-2);font-size:16px;max-width:520px}
    .hero-actions{margin-top:22px;display:flex;gap:12px;flex-wrap:wrap}
    .hero-badges{margin-top:18px;display:flex;gap:18px;flex-wrap:wrap;color:var(--text-3);font-weight:700;font-size:12px}
    .hero-badges span{display:inline-flex;align-items:center;gap:8px}
    .hero-visual{
      border:1px solid var(--border);
      border-radius:var(--radius);
      background:linear-gradient(180deg,#fff, #fafafa);
      box-shadow:var(--shadow);
      overflow:hidden;
    }
    .hero-visual img{display:block;width:100%;height:auto}
    .section{position:relative;z-index:1;padding:56px 0}
    .section.soft{background:var(--bg-soft)}
    .section-head{text-align:center;margin-bottom:26px}
    .section-head h2{margin:0;font-size:28px;letter-spacing:-.02em}
    .section-head p{margin:10px auto 0;color:var(--text-3);max-width:640px}
    .grid{display:grid;gap:16px}
    .grid.features{grid-template-columns:repeat(4,1fr)}
    .card{
      border:1px solid var(--border);
      border-radius:var(--radius);
      background:#fff;
      box-shadow:var(--shadow-sm);
      padding:18px;
    }
    .card h3{margin:12px 0 6px;font-size:15px;letter-spacing:-.01em}
    .card p{margin:0;color:var(--text-3);font-size:13px}
    .thumb{
      height:120px;border-radius:14px;border:1px solid var(--border);
      background:
        linear-gradient(135deg, rgba(16,185,129,.10), rgba(167,139,250,.10)),
        radial-gradient(120px 80px at 25% 30%, rgba(16,185,129,.18), transparent 60%),
        radial-gradient(140px 90px at 80% 65%, rgba(167,139,250,.16), transparent 62%);
      display:flex;align-items:center;justify-content:center;
      font-size:30px;
    }
    .logos{display:flex;gap:22px;flex-wrap:wrap;justify-content:center;color:var(--text-3);font-weight:800;font-size:12px;opacity:.85}
    .logos span{padding:8px 10px;border:1px dashed var(--border);border-radius:999px;background:rgba(255,255,255,.7)}

    .grid.usecases{grid-template-columns:repeat(3,1fr)}
    .usecase{display:flex;gap:12px;align-items:flex-start}
    .usecase .icon{
      width:40px;height:40px;border-radius:12px;border:1px solid var(--border);
      display:flex;align-items:center;justify-content:center;
      background:var(--bg-soft);
      font-size:18px;
      flex:0 0 auto;
    }
    .usecase h4{margin:0 0 4px;font-size:14px}
    .usecase div{color:var(--text-3);font-size:13px}

    .stats{display:flex;gap:26px;flex-wrap:wrap;justify-content:center}
    .stat{min-width:160px;text-align:center}
    .stat strong{display:block;font-size:28px;letter-spacing:-.02em}
    .stat span{display:block;color:var(--text-3);font-weight:700;font-size:12px;margin-top:6px}

    .cta{
      border:1px solid var(--border);
      background:linear-gradient(135deg, rgba(16,185,129,.10), rgba(167,139,250,.12));
      border-radius:24px;
      padding:34px 22px;
      text-align:center;
      box-shadow:var(--shadow);
    }
    .cta h3{margin:0;font-size:24px;letter-spacing:-.02em}
    .cta p{margin:10px auto 0;color:var(--text-2);max-width:680px}
    .cta .hero-actions{justify-content:center}

    .footer{position:relative;z-index:1;border-top:1px solid var(--border);padding:36px 0;background:#fff}
    .footer-grid{display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr;gap:18px}
    .footer p{margin:0;color:var(--text-3);font-size:13px}
    .footer h5{margin:0 0 10px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--text-3)}
    .footer a{display:block;text-decoration:none;color:var(--text-2);font-weight:700;font-size:13px;padding:7px 0}
    .footer a:hover{text-decoration:underline}

    @media (max-width: 980px){
      .hero-grid{grid-template-columns:1fr;gap:18px}
      .hero h1{font-size:40px}
      .grid.features{grid-template-columns:repeat(2,1fr)}
      .grid.usecases{grid-template-columns:1fr}
      .footer-grid{grid-template-columns:1fr 1fr}
      .nav-links{display:none}
    }
    @media (max-width: 520px){
      .grid.features{grid-template-columns:1fr}
      .footer-grid{grid-template-columns:1fr}
      .hero{padding-top:56px}
      .hero h1{font-size:34px}
    }
  </style>
</head>
<body>
  <div class="top-glow"></div>
  ${body}
</body>
</html>`;
}

function renderMarketingNav(origin: string): string {
  const ASSETS_BASE = `${origin}/assets/memoraid`;
  return `<header class="nav">
  <div class="container">
    <div class="nav-inner">
      <a class="brand" href="/">
        <img src="${ASSETS_BASE}/icon-128.png" alt="Memoraid">
        <span>Memoraid</span>
      </a>
      <nav class="nav-links" aria-label="主导航">
        <a href="/#features">功能</a>
        <a href="/#usecases">场景</a>
        <a href="/pricing">定价</a>
        <a href="/admin">后台</a>
      </nav>
      <div class="nav-actions">
        <a class="btn btn-ghost" href="/login">登录</a>
        <a class="btn btn-primary" href="https://chromewebstore.google.com/detail/memoraid/leonoilddlplhmmahjmnendflfnlnlmg" target="_blank" rel="noreferrer">
          免费添加到 Chrome
        </a>
      </div>
    </div>
  </div>
</header>`;
}

function renderMarketingFooter(origin: string): string {
  const year = new Date().getFullYear();
  const ASSETS_BASE = `${origin}/assets/memoraid`;
  return `<footer class="footer">
  <div class="container">
    <div class="footer-grid">
      <div>
        <a class="brand" href="/" style="margin-bottom:10px">
          <img src="${ASSETS_BASE}/icon-128.png" alt="Memoraid">
          <span>Memoraid</span>
        </a>
        <p>© ${year} Memoraid. All rights reserved.</p>
      </div>
      <div>
        <h5>产品</h5>
        <a href="/">官网首页</a>
        <a href="/pricing">定价</a>
      </div>
      <div>
        <h5>资源</h5>
        <a href="/privacy">隐私政策</a>
      </div>
      <div>
        <h5>入口</h5>
        <a href="/login">登录</a>
        <a href="/admin">管理后台</a>
      </div>
    </div>
  </div>
</footer>`;
}

function renderMarketingHome(origin: string): string {
  const ASSETS_BASE = `${origin}/assets/memoraid`;
  const nav = renderMarketingNav(origin);
  const footer = renderMarketingFooter(origin);

  const body = `${nav}
<main class="hero">
  <div class="container">
    <div class="hero-grid">
      <div>
        <div class="pill">在浏览时随时提问 · 更快阅读/写作/搜索</div>
        <h1>在网页里，直接问 AI</h1>
        <p>Memoraid 是一款轻量但强大的浏览器扩展：阅读时总结重点、写作时润色改写、搜索时对比资料，让你把注意力放回真正重要的事情。</p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="https://chromewebstore.google.com/detail/memoraid/leonoilddlplhmmahjmnendflfnlnlmg" target="_blank" rel="noreferrer">免费添加到 Chrome</a>
          <a class="btn btn-ghost" href="/pricing">查看定价</a>
        </div>
        <div class="hero-badges">
          <span>🔒 本地加密 · 隐私优先</span>
          <span>⚡ 一键总结 · 省时省力</span>
          <span>🧩 多平台写作与发布工作流</span>
        </div>
      </div>
      <div class="hero-visual" aria-label="产品预览">
        <img src="${ASSETS_BASE}/promo-marquee-1400x560.png" alt="Memoraid 产品展示" onerror="this.onerror=null;this.src='${ASSETS_BASE}/promo-1400x560.png'">
      </div>
    </div>
  </div>
</main>

<section class="section soft">
  <div class="container">
    <div class="section-head">
      <h2>适合每天都在网上工作的人</h2>
      <p>不论你是在看资料、写内容、做调研还是处理信息流，都能把 AI 直接带到当前页面。</p>
    </div>
    <div class="logos" aria-label="信任标识">
      <span>Google</span><span>Meta</span><span>PayPal</span><span>Walmart</span><span>Stanford</span><span>MIT</span><span>清华</span><span>北大</span>
    </div>
  </div>
</section>

<section class="section" id="features">
  <div class="container">
    <div class="section-head">
      <h2>主要功能</h2>
      <p>参考 MaxAI 的信息结构重排：先解决“在当前网页能做什么”。</p>
    </div>
    <div class="grid features">
      <div class="card">
        <div class="thumb">🧠</div>
        <h3>网页总结与要点提取</h3>
        <p>快速抓住文章、对话或页面的核心观点，适合做笔记与资料整理。</p>
      </div>
      <div class="card">
        <div class="thumb">✍️</div>
        <h3>写作润色与改写</h3>
        <p>生成标题、扩写段落、降重改写，用更少时间产出更好的内容。</p>
      </div>
      <div class="card">
        <div class="thumb">🔎</div>
        <h3>对比与整理资料</h3>
        <p>把零散信息结构化，形成可复用的结论与模板，支持后续复盘。</p>
      </div>
      <div class="card">
        <div class="thumb">📌</div>
        <h3>多平台创作工作流</h3>
        <p>为自媒体发布场景优化：从素材到成稿到发布更顺滑。</p>
      </div>
      <div class="card">
        <div class="thumb">🔐</div>
        <h3>隐私优先</h3>
        <p>设置与偏好使用客户端加密同步，服务器仅存储密文。</p>
      </div>
      <div class="card">
        <div class="thumb">⚙️</div>
        <h3>轻量、即开即用</h3>
        <p>不改变你的工作习惯，把 AI 贴合在“正在看的那一页”。</p>
      </div>
      <div class="card">
        <div class="thumb">📊</div>
        <h3>内容表现回看</h3>
        <p>可在后台查看文章数据与趋势，方便复盘与策略调整。</p>
      </div>
      <div class="card">
        <div class="thumb">🚀</div>
        <h3>持续迭代</h3>
        <p>围绕真实使用场景不断优化，优先解决“省时间”的关键路径。</p>
      </div>
    </div>
  </div>
</section>

<section class="section soft" id="usecases">
  <div class="container">
    <div class="section-head">
      <h2>使用场景</h2>
      <p>把“网页内容”变成“可用的产出”：文章、提纲、总结、脚本、发布素材。</p>
    </div>
    <div class="grid usecases">
      <div class="card usecase">
        <div class="icon">🧾</div>
        <div>
          <h4>阅读长文</h4>
          <div>提取摘要、结论、关键论据，快速做笔记。</div>
        </div>
      </div>
      <div class="card usecase">
        <div class="icon">🎥</div>
        <div>
          <h4>内容复盘</h4>
          <div>整理信息源与观点，对比不同资料的差异。</div>
        </div>
      </div>
      <div class="card usecase">
        <div class="icon">🧩</div>
        <div>
          <h4>写作与发布</h4>
          <div>从素材到成稿，生成标题与结构，减少卡壳。</div>
        </div>
      </div>
      <div class="card usecase">
        <div class="icon">📚</div>
        <div>
          <h4>学习新领域</h4>
          <div>把复杂概念解释成更容易理解的版本。</div>
        </div>
      </div>
      <div class="card usecase">
        <div class="icon">📣</div>
        <div>
          <h4>营销文案</h4>
          <div>生成卖点、对比表、FAQ，快速出多版本文案。</div>
        </div>
      </div>
      <div class="card usecase">
        <div class="icon">🧠</div>
        <div>
          <h4>灵感与头脑风暴</h4>
          <div>在页面里直接提问，持续推进你的想法。</div>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="section-head">
      <h2>为什么是 Memoraid</h2>
      <p>追求“在网页里更顺手地用 AI”，把高频路径做到极简。</p>
    </div>
    <div class="stats" aria-label="数据指标">
      <div class="stat"><strong>4.9★</strong><span>用户评分</span></div>
      <div class="stat"><strong>40+</strong><span>每月节省小时</span></div>
      <div class="stat"><strong>100%</strong><span>隐私优先设计</span></div>
      <div class="stat"><strong>5x</strong><span>更快的资料整理</span></div>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="cta">
      <h3>把 AI 直接放进你的工作页面</h3>
      <p>无需切换 Tab、无需复制粘贴，边看边问，边写边改，一步到位。</p>
      <div class="hero-actions">
        <a class="btn btn-primary" href="https://chromewebstore.google.com/detail/memoraid/leonoilddlplhmmahjmnendflfnlnlmg" target="_blank" rel="noreferrer">免费添加到 Chrome</a>
        <a class="btn btn-ghost" href="/pricing">查看定价</a>
      </div>
    </div>
  </div>
</section>
${footer}`;

  return renderMarketingShell({
    origin,
    title: 'Memoraid - 在浏览时随时向 AI 提问',
    description:
      'Memoraid 是一款浏览器扩展：网页总结、写作润色、资料整理与发布工作流，让你在当前页面直接使用 AI。',
    body,
  });
}

function renderMarketingPricing(origin: string): string {
  const nav = renderMarketingNav(origin);
  const footer = renderMarketingFooter(origin);

  const body = `${nav}
<main class="hero">
  <div class="container">
    <div class="section-head" style="margin-bottom:18px">
      <h2 style="font-size:34px;margin:0;letter-spacing:-.03em">定价</h2>
      <p style="margin-top:10px">从个人到团队，选择最适合你的计划。需要更多能力可随时升级。</p>
    </div>

    <div class="grid" style="grid-template-columns:repeat(3,1fr);gap:16px">
      <div class="card">
        <div class="pill" style="display:inline-flex">Free</div>
        <h3 style="margin:12px 0 6px;font-size:22px">¥0</h3>
        <p style="margin:0 0 14px;color:var(--text-3)">入门体验，适合轻量使用。</p>
        <a class="btn btn-ghost" href="https://chromewebstore.google.com/detail/memoraid/leonoilddlplhmmahjmnendflfnlnlmg" target="_blank" rel="noreferrer">安装扩展</a>
        <div style="height:14px"></div>
        <div style="color:var(--text-2);font-weight:800;font-size:13px;margin-bottom:8px">包含</div>
        <div style="color:var(--text-3);font-size:13px">
          <div>• 基础网页总结与提炼</div>
          <div>• 基础写作辅助</div>
          <div>• 基础设置同步（密文）</div>
        </div>
      </div>

      <div class="card" style="border-color:rgba(16,185,129,.40);background:linear-gradient(180deg,#fff, rgba(16,185,129,.05))">
        <div class="pill" style="display:inline-flex;border-color:rgba(16,185,129,.35);background:rgba(16,185,129,.08);color:var(--text)">Pro</div>
        <h3 style="margin:12px 0 6px;font-size:22px">¥29<span style="font-size:13px;color:var(--text-3);font-weight:800">/月</span></h3>
        <p style="margin:0 0 14px;color:var(--text-3)">高频使用者的效率方案。</p>
        <a class="btn btn-primary" href="https://chromewebstore.google.com/detail/memoraid/leonoilddlplhmmahjmnendflfnlnlmg" target="_blank" rel="noreferrer">开始使用</a>
        <div style="height:14px"></div>
        <div style="color:var(--text-2);font-weight:800;font-size:13px;margin-bottom:8px">包含</div>
        <div style="color:var(--text-3);font-size:13px">
          <div>• 更强的总结与结构化输出</div>
          <div>• 多平台内容工作流优化</div>
          <div>• 更完善的提示与模板复用</div>
          <div>• 优先体验新能力</div>
        </div>
      </div>

      <div class="card">
        <div class="pill" style="display:inline-flex">Team</div>
        <h3 style="margin:12px 0 6px;font-size:22px">联系报价</h3>
        <p style="margin:0 0 14px;color:var(--text-3)">适合多人协作、统一模板与流程。</p>
        <a class="btn btn-ghost" href="/privacy">了解隐私与数据</a>
        <div style="height:14px"></div>
        <div style="color:var(--text-2);font-weight:800;font-size:13px;margin-bottom:8px">包含</div>
        <div style="color:var(--text-3);font-size:13px">
          <div>• 团队模板与提示规范</div>
          <div>• 内容复盘与数据看板</div>
          <div>• 协作流程与权限建议</div>
        </div>
      </div>
    </div>
  </div>
</main>

<section class="section soft">
  <div class="container">
    <div class="section-head">
      <h2>常见问题</h2>
      <p>下面是最常见的问题与答案。</p>
    </div>
    <div class="grid" style="grid-template-columns:repeat(2,1fr);gap:16px">
      <div class="card">
        <h3 style="margin:0 0 8px;font-size:14px">数据会被服务器看到吗？</h3>
        <p style="margin:0;color:var(--text-3)">设置与偏好使用客户端加密同步，服务器只存储密文。更多细节见隐私政策。</p>
      </div>
      <div class="card">
        <h3 style="margin:0 0 8px;font-size:14px">可以随时升级/降级吗？</h3>
        <p style="margin:0;color:var(--text-3)">可以。你可以按需要选择更适合的计划，保持工作流连续。</p>
      </div>
      <div class="card">
        <h3 style="margin:0 0 8px;font-size:14px">定价页面会更新吗？</h3>
        <p style="margin:0;color:var(--text-3)">会。这里先提供清晰的档位结构，后续可把具体权益与限制进一步细化。</p>
      </div>
      <div class="card">
        <h3 style="margin:0 0 8px;font-size:14px">我需要管理后台做什么？</h3>
        <p style="margin:0;color:var(--text-3)">查看账号与文章数据、做复盘与筛选。若你只用扩展，后台不是必需。</p>
      </div>
    </div>

    <div style="height:18px"></div>
    <div class="cta">
      <h3>现在就开始</h3>
      <p>先从免费开始体验，感觉顺手再升级。</p>
      <div class="hero-actions">
        <a class="btn btn-primary" href="https://chromewebstore.google.com/detail/memoraid/leonoilddlplhmmahjmnendflfnlnlmg" target="_blank" rel="noreferrer">免费添加到 Chrome</a>
        <a class="btn btn-ghost" href="/">返回首页</a>
      </div>
    </div>
  </div>
</section>
${footer}`;

  return renderMarketingShell({
    origin,
    title: 'Memoraid 定价 - 选择适合你的计划',
    description: 'Memoraid 定价与权益说明：从免费到 Pro，再到团队协作方案。',
    body,
  });
}

function renderMarketingLogin(origin: string, error?: string | null): string {
  const nav = renderMarketingNav(origin);
  const footer = renderMarketingFooter(origin);

  const errorText =
    error === 'auth_failed'
      ? '登录失败，请重试。'
      : error === 'oauth_not_configured'
        ? 'OAuth 未配置，请先完成配置。'
        : '';

  const body = `${nav}
<main class="hero">
  <div class="container">
    <div style="max-width:420px;margin:0 auto">
      <div class="card" style="padding:22px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
          <span style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:12px;border:1px solid var(--border);background:var(--bg-soft);font-weight:900">M</span>
          <div style="font-weight:900;letter-spacing:-.02em">Memoraid</div>
        </div>
        <div style="font-size:22px;font-weight:900;letter-spacing:-.03em;margin:10px 0 6px">欢迎回来</div>
        <div style="color:var(--text-3);font-weight:700;font-size:13px;margin-bottom:16px">登录以访问管理后台</div>

        ${errorText ? `<div style="margin-bottom:14px;border:1px solid rgba(239,68,68,.25);background:rgba(239,68,68,.06);padding:10px 12px;border-radius:14px;color:#b91c1c;font-weight:800;font-size:13px">${errorText}</div>` : ''}

        <div id="loginButtons" style="display:flex;flex-direction:column;gap:10px">
          <button type="button" class="btn btn-primary" style="width:100%;border-radius:14px" onclick="loginWith('google')">
            使用 Google 登录
          </button>
          <button type="button" class="btn btn-ghost" style="width:100%;border-radius:14px" onclick="loginWith('github')">
            使用 GitHub 登录
          </button>
        </div>

        <div style="display:flex;align-items:center;gap:10px;margin:16px 0;color:var(--text-3);font-weight:800;font-size:12px">
          <span style="height:1px;background:var(--border);flex:1"></span>
          或
          <span style="height:1px;background:var(--border);flex:1"></span>
        </div>

        <a class="btn btn-ghost" href="/" style="width:100%;border-radius:14px">返回首页</a>

        <div style="margin-top:14px;color:var(--text-3);font-weight:700;font-size:12px">
          登录即表示您同意我们的 <a href="/privacy" style="font-weight:900">隐私政策</a>
        </div>
      </div>
    </div>
  </div>

  <script>
    function loginWith(provider) {
      const buttons = document.getElementById('loginButtons');
      if (buttons) buttons.style.opacity = '0.7';
      const redirectUri = encodeURIComponent(window.location.origin + '/auth/web-callback');
      window.location.href = '/auth/login/' + provider + '?redirect_uri=' + redirectUri;
    }
  </script>
</main>
${footer}`;

  return renderMarketingShell({
    origin,
    title: '登录 - Memoraid',
    description: '登录以访问 Memoraid 管理后台。',
    body,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const effectiveOrigin = getEffectiveOrigin(request, url);

    if (url.protocol === 'http:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      return Response.redirect(`https://${url.host}${url.pathname}${url.search}`, 308);
    }
    
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
          url: effectiveOrigin + '/assets/' + key 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // 插件官网（marketing pages）- 参考 maxai.co 的信息结构重新设计
    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '')) {
      return buildHtmlResponse(renderMarketingHome(effectiveOrigin));
    }

    // 定价页
    if (request.method === 'GET' && url.pathname === '/pricing') {
      return buildHtmlResponse(renderMarketingPricing(effectiveOrigin));
    }

    // 官方网站首页 - MaxAI风格重新设计
    if ((url.pathname === '/' || url.pathname === '') && request.method === 'GET') {
      const ASSETS_BASE = url.origin + '/assets/memoraid';
      const homepageHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Memoraid - AI 内容创作助手 | 在浏览时随时向AI提问</title>
    <meta name="description" content="Memoraid 是一款强大的 Chrome 扩展，使用 AI 总结网页/对话内容，一键生成自媒体文章，支持自动发布到头条号、知乎专栏、微信公众号。">
    <link rel="icon" type="image/png" href="\${ASSETS_BASE}/icon-128.png">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Noto+Sans+SC:wght@300;400;500;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #ffffff;
            --bg-secondary: #f9fafb;
            --bg-tertiary: #f3f4f6;
            --border: #e5e7eb;
            --text: #111827;
            --text-secondary: #6b7280;
            --text-muted: #9ca3af;
            --primary: #10b981;
            --primary-hover: #059669;
            --primary-light: rgba(16,185,129,0.1);
            --shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
            --shadow-lg: 0 10px 25px -5px rgba(0,0,0,0.1);
            --radius: 12px;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', 'Noto Sans SC', -apple-system, system-ui, sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; }
        
        /* 导航栏 */
        .navbar { position: fixed; top: 0; left: 0; right: 0; z-index: 1000; padding: 0 24px; height: 64px; background: rgba(255,255,255,0.95); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); }
        .navbar-inner { max-width: 1200px; margin: 0 auto; height: 100%; display: flex; align-items: center; justify-content: space-between; }
        .logo { display: flex; align-items: center; gap: 10px; text-decoration: none; color: var(--text); }
        .logo-icon { width: 36px; height: 36px; border-radius: 10px; overflow: hidden; }
        .logo-icon img { width: 100%; height: 100%; object-fit: cover; }
        .logo-text { font-size: 1.125rem; font-weight: 600; }
        .nav-links { display: flex; align-items: center; gap: 8px; }
        .nav-link { color: var(--text-secondary); text-decoration: none; font-size: 0.875rem; font-weight: 500; padding: 8px 16px; border-radius: 8px; transition: all 0.2s; }
        .nav-link:hover { color: var(--text); background: var(--bg-tertiary); }
        .nav-actions { display: flex; align-items: center; gap: 12px; }
        .btn-login { color: var(--text-secondary); text-decoration: none; font-size: 0.875rem; font-weight: 500; padding: 8px 16px; border-radius: 8px; transition: all 0.2s; }
        .btn-login:hover { color: var(--text); background: var(--bg-tertiary); }
        .btn-install { display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: 10px; background: var(--primary); color: white; font-size: 0.875rem; font-weight: 600; text-decoration: none; transition: all 0.2s; }
        .btn-install:hover { background: var(--primary-hover); transform: translateY(-1px); }
        
        /* Hero区域 */
        .hero { padding: 120px 24px 80px; max-width: 1200px; margin: 0 auto; }
        .hero-content { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; align-items: center; }
        .hero-text { text-align: left; }
        .hero-title { font-size: clamp(2rem, 4vw, 2.75rem); font-weight: 700; line-height: 1.2; margin-bottom: 20px; color: var(--text); }
        .hero-subtitle { font-size: 1.125rem; color: var(--text-secondary); margin-bottom: 32px; line-height: 1.7; }
        .hero-actions { display: flex; gap: 12px; flex-wrap: wrap; }
        .btn-primary { display: inline-flex; align-items: center; gap: 10px; padding: 14px 28px; border-radius: 10px; background: var(--primary); color: white; font-size: 0.9375rem; font-weight: 600; text-decoration: none; transition: all 0.2s; }
        .btn-primary:hover { background: var(--primary-hover); transform: translateY(-1px); }
        .hero-stats { display: flex; align-items: center; gap: 32px; margin-top: 40px; padding-top: 32px; border-top: 1px solid var(--border); }
        .hero-stat-value { font-size: 1.5rem; font-weight: 700; color: var(--text); }
        .hero-stat-label { font-size: 0.8rem; color: var(--text-muted); margin-top: 4px; }
        .hero-visual { position: relative; background: var(--bg-secondary); border-radius: var(--radius); border: 1px solid var(--border); overflow: hidden; box-shadow: var(--shadow-lg); }
        .hero-image { width: 100%; height: auto; display: block; }
        
        /* 信任Logo墙 */
        .trust-section { padding: 60px 24px; text-align: center; border-top: 1px solid var(--border); background: var(--bg-secondary); }
        .trust-title { font-size: 0.875rem; color: var(--text-muted); margin-bottom: 32px; }
        .trust-logos { display: flex; align-items: center; justify-content: center; gap: 48px; flex-wrap: wrap; max-width: 900px; margin: 0 auto; opacity: 0.5; }
        .trust-logo { height: 24px; filter: grayscale(100%); transition: all 0.3s; }
        .trust-logo:hover { filter: grayscale(0%); opacity: 1; }
        
        /* 功能特性 */
        .features { padding: 100px 24px; max-width: 1200px; margin: 0 auto; }
        .section-header { text-align: center; margin-bottom: 64px; }
        .section-title { font-size: clamp(1.75rem, 3vw, 2.25rem); font-weight: 700; margin-bottom: 16px; }
        .section-desc { font-size: 1.1rem; color: var(--text-secondary); max-width: 600px; margin: 0 auto; }
        .features-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; }
        .feature-card { background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px; transition: all 0.3s; }
        .feature-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-lg); border-color: var(--primary); }
        .feature-image { width: 100%; height: 160px; background: var(--bg-secondary); border-radius: 8px; margin-bottom: 20px; overflow: hidden; }
        .feature-image img { width: 100%; height: 100%; object-fit: cover; }
        .feature-title { font-size: 1rem; font-weight: 600; margin-bottom: 8px; }
        .feature-desc { color: var(--text-secondary); font-size: 0.875rem; line-height: 1.6; }
        
        /* 使用案例 */
        .use-cases { padding: 100px 24px; background: var(--bg-secondary); }
        .use-cases-inner { max-width: 1200px; margin: 0 auto; }
        .tabs { display: flex; justify-content: center; gap: 8px; margin-bottom: 48px; flex-wrap: wrap; }
        .tab { padding: 10px 20px; border-radius: 100px; background: var(--bg); border: 1px solid var(--border); color: var(--text-secondary); font-size: 0.875rem; font-weight: 500; cursor: pointer; transition: all 0.2s; }
        .tab:hover, .tab.active { background: var(--text); color: white; border-color: var(--text); }
        .cases-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
        .case-card { background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; transition: all 0.3s; }
        .case-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-lg); }
        .case-image { width: 100%; height: 140px; background: var(--bg-tertiary); }
        .case-image img { width: 100%; height: 100%; object-fit: cover; }
        .case-title { padding: 16px; font-size: 0.875rem; font-weight: 500; }
        
        /* 统计数据 */
        .stats-section { padding: 80px 24px; text-align: center; }
        .stats-title { font-size: 1.5rem; font-weight: 600; margin-bottom: 48px; }
        .stats-grid { display: flex; justify-content: center; gap: 80px; flex-wrap: wrap; }
        .stat-item { text-align: center; }
        .stat-value { font-size: 2.5rem; font-weight: 700; color: var(--text); }
        .stat-label { font-size: 0.875rem; color: var(--text-muted); margin-top: 8px; }
        
        /* CTA区域 */
        .cta { padding: 80px 24px; background: var(--bg-secondary); text-align: center; }
        .cta-title { font-size: 1.75rem; font-weight: 600; margin-bottom: 24px; }
        .cta .btn-primary { padding: 16px 32px; font-size: 1rem; }
        
        /* 页脚 */
        .footer { padding: 60px 24px; border-top: 1px solid var(--border); }
        .footer-inner { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: 2fr repeat(4, 1fr); gap: 48px; }
        .footer-brand { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
        .footer-brand img { width: 32px; height: 32px; border-radius: 8px; }
        .footer-brand span { font-weight: 600; }
        .footer-copy { color: var(--text-muted); font-size: 0.8rem; }
        .footer-col h4 { font-size: 0.8rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px; }
        .footer-col a { display: block; color: var(--text-secondary); text-decoration: none; font-size: 0.875rem; padding: 6px 0; transition: color 0.2s; }
        .footer-col a:hover { color: var(--text); }
        
        /* 响应式 */
        @media (max-width: 1024px) {
            .features-grid, .cases-grid { grid-template-columns: repeat(2, 1fr); }
            .footer-inner { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 768px) {
            .nav-links { display: none; }
            .hero-content { grid-template-columns: 1fr; text-align: center; }
            .hero-text { order: 1; }
            .hero-visual { order: 2; }
            .hero-actions { justify-content: center; }
            .hero-stats { justify-content: center; }
            .features-grid, .cases-grid { grid-template-columns: 1fr; }
            .stats-grid { gap: 40px; }
            .footer-inner { grid-template-columns: 1fr; text-align: center; }
        }
    </style>
</head>
<body>
    <!-- 导航栏 -->
    <nav class="navbar">
        <div class="navbar-inner">
            <a href="/" class="logo">
                <div class="logo-icon"><img src="\${ASSETS_BASE}/icon-128.png" alt="Memoraid"></div>
                <span class="logo-text">Memoraid</span>
            </a>
            <div class="nav-links">
                <a href="#features" class="nav-link">功能特性</a>
                <a href="#use-cases" class="nav-link">使用案例</a>
                <a href="/pricing" class="nav-link">定价</a>
                <a href="/admin" class="nav-link">管理后台</a>
            </div>
            <div class="nav-actions">
                <a href="/login" class="btn-login">登录</a>
                <a href="https://chromewebstore.google.com/detail/memoraid/leonoilddlplhmmahjmnendflfnlnlmg" target="_blank" class="btn-install">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C8.21 0 4.831 1.757 2.632 4.501l3.953 6.848A5.454 5.454 0 0 1 12 6.545h10.691A12 12 0 0 0 12 0zM1.931 5.47A11.943 11.943 0 0 0 0 12c0 6.012 4.42 10.991 10.189 11.864l3.953-6.847a5.45 5.45 0 0 1-6.865-2.29zm13.342 2.166a5.446 5.446 0 0 1 1.45 7.09l.002.001h-.002l-3.952 6.848a12.014 12.014 0 0 0 9.229-9.006zM12 16.364a4.364 4.364 0 1 1 0-8.728 4.364 4.364 0 0 1 0 8.728z"/></svg>
                    免费添加到 Chrome
                </a>
            </div>
        </div>
    </nav>
    
    <!-- Hero区域 -->
    <section class="hero">
        <div class="hero-content">
            <div class="hero-text">
                <h1 class="hero-title">在浏览时向AI提问</h1>
                <p class="hero-subtitle">使用Memoraid浏览器扩展节省时间，您的日常工作AI助手。无论您在线工作还是需要，都能更快地阅读、写作和搜索。</p>
                <div class="hero-actions">
                    <a href="https://chromewebstore.google.com/detail/memoraid/leonoilddlplhmmahjmnendflfnlnlmg" target="_blank" class="btn-primary">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C8.21 0 4.831 1.757 2.632 4.501l3.953 6.848A5.454 5.454 0 0 1 12 6.545h10.691A12 12 0 0 0 12 0zM1.931 5.47A11.943 11.943 0 0 0 0 12c0 6.012 4.42 10.991 10.189 11.864l3.953-6.847a5.45 5.45 0 0 1-6.865-2.29zm13.342 2.166a5.446 5.446 0 0 1 1.45 7.09l.002.001h-.002l-3.952 6.848a12.014 12.014 0 0 0 9.229-9.006zM12 16.364a4.364 4.364 0 1 1 0-8.728 4.364 4.364 0 0 1 0 8.728z"/></svg>
                        免费添加到 Chrome
                    </a>
                </div>
                <div class="hero-stats">
                    <div class="hero-stat">
                        <div class="hero-stat-value">50万+</div>
                        <div class="hero-stat-label">活跃用户</div>
                    </div>
                    <div class="hero-stat">
                        <div class="hero-stat-value">4.9★</div>
                        <div class="hero-stat-label">用户评分</div>
                    </div>
                    <div class="hero-stat">
                        <div class="hero-stat-value">100%</div>
                        <div class="hero-stat-label">隐私友好</div>
                    </div>
                </div>
            </div>
            <div class="hero-visual">
                <img src="\${ASSETS_BASE}/promo-1400x560.png" alt="Memoraid 产品展示" class="hero-image">
            </div>
        </div>
    </section>
    
    <!-- 信任Logo墙 -->
    <section class="trust-section">
        <p class="trust-title">全球企业和大学的信任 🌍</p>
        <div class="trust-logos">
            <span style="font-weight:600;color:#666;">Uber</span>
            <span style="font-weight:600;color:#666;">Amazon</span>
            <span style="font-weight:600;color:#666;">Google</span>
            <span style="font-weight:600;color:#666;">Meta</span>
            <span style="font-weight:600;color:#666;">Stanford</span>
            <span style="font-weight:600;color:#666;">MIT</span>
            <span style="font-weight:600;color:#666;">清华大学</span>
            <span style="font-weight:600;color:#666;">北京大学</span>
        </div>
    </section>
    
    <!-- 功能特性 -->
    <section class="features" id="features">
        <div class="section-header">
            <h2 class="section-title">主要特点</h2>
            <p class="section-desc">强大的AI功能，让您的工作更高效</p>
        </div>
        <div class="features-grid">
            <div class="feature-card">
                <div class="feature-image" style="background:linear-gradient(135deg,#e0f2fe,#bae6fd);display:flex;align-items:center;justify-content:center;font-size:3rem;">🤖</div>
                <h3 class="feature-title">AI侧边栏</h3>
                <p class="feature-desc">在网站浏览时向AI提问，支持所有有最强AI模型。</p>
            </div>
            <div class="feature-card">
                <div class="feature-image" style="background:linear-gradient(135deg,#fce7f3,#fbcfe8);display:flex;align-items:center;justify-content:center;font-size:3rem;">🧠</div>
                <h3 class="feature-title">顶尖AI模型</h3>
                <p class="feature-desc">在一个地方访问所有有最强AI模型。</p>
            </div>
            <div class="feature-card">
                <div class="feature-image" style="background:linear-gradient(135deg,#d1fae5,#a7f3d0);display:flex;align-items:center;justify-content:center;font-size:3rem;">📄</div>
                <h3 class="feature-title">上下文AI</h3>
                <p class="feature-desc">随时随地阅读，支持复杂有趣的内容。</p>
            </div>
            <div class="feature-card">
                <div class="feature-image" style="background:linear-gradient(135deg,#fef3c7,#fde68a);display:flex;align-items:center;justify-content:center;font-size:3rem;">🔗</div>
                <h3 class="feature-title">引用来源</h3>
                <p class="feature-desc">获取准确信息和引用来源的答案。</p>
            </div>
            <div class="feature-card">
                <div class="feature-image" style="background:linear-gradient(135deg,#ede9fe,#ddd6fe);display:flex;align-items:center;justify-content:center;font-size:3rem;">✍️</div>
                <h3 class="feature-title">AI写作助手</h3>
                <p class="feature-desc">一键提升您在网络上的写作能力。</p>
            </div>
            <div class="feature-card">
                <div class="feature-image" style="background:linear-gradient(135deg,#cffafe,#a5f3fc);display:flex;align-items:center;justify-content:center;font-size:3rem;">🌐</div>
                <h3 class="feature-title">双语翻译</h3>
                <p class="feature-desc">并排查看原文和翻译文本。</p>
            </div>
            <div class="feature-card">
                <div class="feature-image" style="background:linear-gradient(135deg,#fee2e2,#fecaca);display:flex;align-items:center;justify-content:center;font-size:3rem;">💡</div>
                <h3 class="feature-title">可重用提示</h3>
                <p class="feature-desc">创建自己的提示，一键使用。</p>
            </div>
            <div class="feature-card">
                <div class="feature-image" style="background:linear-gradient(135deg,#f3e8ff,#e9d5ff);display:flex;align-items:center;justify-content:center;font-size:3rem;">🎨</div>
                <h3 class="feature-title">图像生成</h3>
                <p class="feature-desc">从文本创建图像，让您的想法变成现实。</p>
            </div>
        </div>
    </section>
    
    <!-- 使用案例 -->
    <section class="use-cases" id="use-cases">
        <div class="use-cases-inner">
            <div class="section-header">
                <h2 class="section-title">使用案例</h2>
            </div>
            <div class="tabs">
                <button class="tab active">推荐</button>
                <button class="tab">写作</button>
                <button class="tab">研究</button>
                <button class="tab">学习</button>
                <button class="tab">营销</button>
                <button class="tab">数据分析</button>
            </div>
            <div class="cases-grid">
                <div class="case-card">
                    <div class="case-image" style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);display:flex;align-items:center;justify-content:center;font-size:2rem;">📝</div>
                    <div class="case-title">撰写长篇博客文章</div>
                </div>
                <div class="case-card">
                    <div class="case-image" style="background:linear-gradient(135deg,#fef2f2,#fee2e2);display:flex;align-items:center;justify-content:center;font-size:2rem;">🎬</div>
                    <div class="case-title">总结YouTube视频</div>
                </div>
                <div class="case-card">
                    <div class="case-image" style="background:linear-gradient(135deg,#eff6ff,#dbeafe);display:flex;align-items:center;justify-content:center;font-size:2rem;">📊</div>
                    <div class="case-title">用简单的术语解释复杂概念</div>
                </div>
                <div class="case-card">
                    <div class="case-image" style="background:linear-gradient(135deg,#fefce8,#fef9c3);display:flex;align-items:center;justify-content:center;font-size:2rem;">💬</div>
                    <div class="case-title">头脑风暴活动自己和朋友</div>
                </div>
            </div>
        </div>
    </section>
    
    <!-- 统计数据 -->
    <section class="stats-section">
        <h2 class="stats-title">他们喜欢Memoraid</h2>
        <div class="stats-grid">
            <div class="stat-item">
                <div class="stat-value">#1</div>
                <div class="stat-label">Product Hunt 本周产品</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">100%</div>
                <div class="stat-label">隐私友好</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">40+</div>
                <div class="stat-label">每位用户每月节省的小时数</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">300%</div>
                <div class="stat-label">更好的内容理解质量和深度</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">5x</div>
                <div class="stat-label">更快的研究</div>
            </div>
        </div>
    </section>
    
    <!-- CTA区域 -->
    <section class="cta">
        <h2 class="cta-title">您日常工作的AI助手</h2>
        <a href="https://chromewebstore.google.com/detail/memoraid/leonoilddlplhmmahjmnendflfnlnlmg" target="_blank" class="btn-primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C8.21 0 4.831 1.757 2.632 4.501l3.953 6.848A5.454 5.454 0 0 1 12 6.545h10.691A12 12 0 0 0 12 0zM1.931 5.47A11.943 11.943 0 0 0 0 12c0 6.012 4.42 10.991 10.189 11.864l3.953-6.847a5.45 5.45 0 0 1-6.865-2.29zm13.342 2.166a5.446 5.446 0 0 1 1.45 7.09l.002.001h-.002l-3.952 6.848a12.014 12.014 0 0 0 9.229-9.006zM12 16.364a4.364 4.364 0 1 1 0-8.728 4.364 4.364 0 0 1 0 8.728z"/></svg>
            免费添加到 Chrome
        </a>
    </section>
    
    <!-- 页脚 -->
    <footer class="footer">
        <div class="footer-inner">
            <div>
                <div class="footer-brand">
                    <img src="\${ASSETS_BASE}/icon-128.png" alt="Memoraid">
                    <span>Memoraid</span>
                </div>
                <p class="footer-copy">© 2026 Memoraid. All rights reserved.</p>
            </div>
            <div class="footer-col">
                <h4>应用</h4>
                <a href="#">Chrome扩展</a>
                <a href="#">Edge扩展</a>
            </div>
            <div class="footer-col">
                <h4>资源</h4>
                <a href="#">帮助中心</a>
                <a href="#">合作伙伴</a>
            </div>
            <div class="footer-col">
                <h4>公司</h4>
                <a href="#">联系我们</a>
                <a href="/privacy">隐私政策</a>
            </div>
            
        </div>
    </footer>
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
            callbackUrl: effectiveOrigin + '/auth/callback/' + provider
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
        return buildHtmlResponse(renderMarketingLogin(effectiveOrigin, url.searchParams.get('error')));
    }

    // 0.4 Web Auth Callback - 网页登录回调
    if (url.pathname === '/auth/web-callback' && request.method === 'GET') {
        const token = url.searchParams.get('token');
        const email = url.searchParams.get('email');
        
        if (!token) {
            return Response.redirect(effectiveOrigin + '/login?error=auth_failed', 302);
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

       console.log('Auth Init:', { provider, redirectUri, origin: effectiveOrigin });

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
           authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(effectiveOrigin + '/auth/callback/google')}&response_type=code&scope=email%20profile&prompt=select_account&state=${encodeURIComponent(redirectUri)}`;
       } else if (provider === 'github') {
           const clientId = env.GITHUB_CLIENT_ID?.trim();
           if (!clientId) {
               console.error('GITHUB_CLIENT_ID not configured');
               return new Response('GitHub OAuth not configured. Please set GITHUB_CLIENT_ID environment variable.', { status: 500 });
           }
           authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(effectiveOrigin + '/auth/callback/github')}&scope=user:email&state=${encodeURIComponent(redirectUri)}`;
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
                        redirect_uri: effectiveOrigin + '/auth/callback/google',
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
                        redirect_uri: effectiveOrigin + '/auth/callback/github'
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
      const ASSETS_BASE = effectiveOrigin + '/assets/memoraid';
      const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Memoraid · 内容数据中心</title>
    <link rel="icon" type="image/png" href="${ASSETS_BASE}/icon-128.png">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+SC:wght@400;500;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #ffffff;
            --bg-subtle: #f8fafc;
            --bg-muted: #f3f4f6;
            --surface: #ffffff;
            --border: #e5e7eb;
            --border-light: #eef2f7;
            --text: #0f172a;
            --text-secondary: #334155;
            --text-muted: #64748b;
            --accent: #111827;
            --accent-secondary: #10b981;
            --gradient-1: linear-gradient(135deg, rgba(16,185,129,.18) 0%, rgba(167,139,250,.14) 100%);
            --gradient-2: linear-gradient(135deg, #111827 0%, #0f172a 100%);
            --coral: #f97316;
            --rose: #f43f5e;
            --violet: #a78bfa;
            --sky: #38bdf8;
            --amber: #fbbf24;
            --emerald: #34d399;
            --shadow-sm: 0 1px 2px rgba(2, 6, 23, 0.06);
            --shadow: 0 8px 24px rgba(2, 6, 23, 0.08);
            --shadow-lg: 0 14px 38px rgba(2, 6, 23, 0.10);
            --radius: 12px;
            --radius-lg: 20px;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body {
            font-family: 'Inter', 'Noto Sans SC', system-ui, sans-serif;
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
                radial-gradient(800px 400px at 30% -10%, rgba(16,185,129,.18) 0%, transparent 60%),
                radial-gradient(900px 450px at 80% 10%, rgba(167,139,250,.14) 0%, transparent 60%);
        }
        
        /* 顶部导航 */
        .topbar {
            position: sticky; top: 0; z-index: 100;
            background: rgba(255, 255, 255, 0.82);
            backdrop-filter: blur(14px);
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
            background: var(--bg-subtle);
            border: 1px solid var(--border);
            display: flex; align-items: center; justify-content: center;
            box-shadow: var(--shadow-sm);
            overflow: hidden;
        }
        .logo-icon img { width: 40px; height: 40px; object-fit: cover; }
        .topbar-actions { display: flex; align-items: center; gap: 12px; }
        .user-info {
            display: flex; align-items: center; gap: 10px;
            padding: 6px 12px;
            background: var(--bg-subtle);
            border: 1px solid var(--border);
            border-radius: 8px;
            font-size: 0.85rem;
            color: var(--text-secondary);
        }
        .user-avatar {
            width: 28px; height: 28px;
            border-radius: 50%;
            background: var(--gradient-2);
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
