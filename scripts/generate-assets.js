import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const outputDir = path.join(process.cwd(), 'store-assets');
const logoPath = path.join(process.cwd(), 'public', 'logo.svg');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

// Helper to create SVG buffer
function createSvgBuffer(width, height, content) {
  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="10" flood-color="#000000" flood-opacity="0.1"/>
        </filter>
        <clipPath id="avatar-clip">
           <circle cx="20" cy="20" r="20" />
        </clipPath>
      </defs>
      ${content}
    </svg>
  `);
}

async function generateAssets() {
  console.log('Generating Store Assets (Strict Mode - Updated UI)...');
  const onlyArg = process.argv.find(arg => arg.startsWith('--only='));
  const only = onlyArg ? onlyArg.split('=')[1] : '';
  
  const logoBuffer = fs.readFileSync(logoPath);

  if (only && only !== 'marquee' && only !== 'features' && only !== 'all') {
    throw new Error(`Unknown --only value: ${only}. Use --only=marquee, --only=features or omit.`);
  }

  // 1. Store Icon (128x128) - Keep existing logic
  if (only && only !== 'all') {
    console.log(`Only generating ${only}...`);
  }
  if (!only || only === 'all') {
  const logoIcon = await sharp(logoBuffer).resize(96, 96).toBuffer();
  await sharp({
    create: {
      width: 128,
      height: 128,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([{ input: logoIcon, top: 16, left: 16 }])
    .png()
    .toFile(path.join(outputDir, 'icon-128.png'));
  console.log('Generated icon-128.png');
  }

  // 2. Small Promo Tile (440x280) - Keep existing logic
  if (!only || only === 'all') {
  const smallPromoSvg = `
    <rect width="100%" height="100%" fill="#ffffff" />
    <text x="220" y="200" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold" font-size="48" fill="#1e293b">Memoraid</text>
    <text x="220" y="240" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#64748b">AI Chat Export</text>
  `;
  const logoSmall = await sharp(logoBuffer).resize(100, 100).toBuffer();
  await sharp(createSvgBuffer(440, 280, smallPromoSvg))
    .composite([{ input: logoSmall, top: 50, left: 170 }])
    .png()
    .removeAlpha()
    .toFile(path.join(outputDir, 'promo-small-440x280.png'));
  console.log('Generated promo-small-440x280.png');
  }

  // 3. Marquee Promo Tile (1400x560) - Keep existing logic
  if (!only || only === 'marquee' || only === 'all') {
  const marqueePromoSvg = `
    <defs>
      <linearGradient id="promo-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#3b82f6" />
        <stop offset="55%" stop-color="#6366f1" />
        <stop offset="100%" stop-color="#a78bfa" />
      </linearGradient>
      <radialGradient id="promo-glow" cx="65%" cy="40%" r="80%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.18" />
        <stop offset="55%" stop-color="#ffffff" stop-opacity="0.07" />
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
      </radialGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#promo-grad)" />
    <rect width="100%" height="100%" fill="url(#promo-glow)" />
    <text x="470" y="330" font-family="Arial, sans-serif" font-weight="900" font-size="156" fill="#ffffff" letter-spacing="1">Memoraid</text>
    <text x="470" y="410" font-family="Arial, sans-serif" font-weight="800" font-size="48" fill="rgba(255,255,255,0.95)">AI 内容创作 · 一键发布到多平台</text>
  `;
  const logoMarquee = await sharp(logoBuffer).resize(320, 320).toBuffer();
  await sharp(createSvgBuffer(1400, 560, marqueePromoSvg))
    .composite([{ input: logoMarquee, top: 120, left: 110 }])
    .png()
    .removeAlpha()
    .toFile(path.join(outputDir, 'promo-marquee-1400x560.png'));
  console.log('Generated promo-marquee-1400x560.png');
  }

  if (!only || only === 'features' || only === 'all') {
    const featureItems = [
      { file: 'feature-extract.png', title: '要点提炼', subtitle: '网页 / 对话一键总结', a: '#10b981', b: '#3b82f6' },
      { file: 'feature-rewrite.png', title: '写作改写', subtitle: '标题 · 扩写 · 降重 · 润色', a: '#6366f1', b: '#a78bfa' },
      { file: 'feature-organize.png', title: '资料整理', subtitle: '对比归纳形成可复用模板', a: '#0ea5e9', b: '#22c55e' },
      { file: 'feature-publish.png', title: '一键发布', subtitle: '头条 / 知乎 / 公众号自动化', a: '#f97316', b: '#ef4444' },
      { file: 'feature-privacy.png', title: '隐私优先', subtitle: '客户端加密同步 · 服务器仅密文', a: '#0f172a', b: '#334155' },
      { file: 'feature-instant.png', title: '即开即用', subtitle: 'AI 贴合在当前页面', a: '#14b8a6', b: '#06b6d4' },
      { file: 'feature-analytics.png', title: '数据回看', subtitle: '表现趋势一眼掌握', a: '#8b5cf6', b: '#ec4899' },
      { file: 'feature-assets.png', title: '智能配图', subtitle: '素材上传 R2 · 稳定复用', a: '#22c55e', b: '#a3e635' },
    ];

    for (const item of featureItems) {
      const svg = `
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="${item.a}" />
            <stop offset="100%" stop-color="${item.b}" />
          </linearGradient>
          <radialGradient id="glowA" cx="22%" cy="25%" r="70%">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.24" />
            <stop offset="60%" stop-color="#ffffff" stop-opacity="0.06" />
            <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
          </radialGradient>
          <radialGradient id="glowB" cx="80%" cy="70%" r="75%">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.18" />
            <stop offset="55%" stop-color="#ffffff" stop-opacity="0.06" />
            <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#bg)" />
        <rect width="100%" height="100%" fill="url(#glowA)" />
        <rect width="100%" height="100%" fill="url(#glowB)" />

        <rect x="42" y="44" width="876" height="246" rx="28" fill="rgba(255,255,255,0.16)" stroke="rgba(255,255,255,0.22)" />
        <rect x="72" y="78" width="520" height="18" rx="9" fill="rgba(255,255,255,0.55)" />
        <rect x="72" y="112" width="640" height="12" rx="6" fill="rgba(255,255,255,0.34)" />
        <rect x="72" y="136" width="600" height="12" rx="6" fill="rgba(255,255,255,0.30)" />
        <rect x="72" y="160" width="520" height="12" rx="6" fill="rgba(255,255,255,0.28)" />
        <rect x="72" y="192" width="210" height="36" rx="18" fill="rgba(255,255,255,0.55)" />
        <rect x="292" y="192" width="180" height="36" rx="18" fill="rgba(255,255,255,0.28)" />

        <text x="72" y="352" font-family="Arial, sans-serif" font-weight="900" font-size="72" fill="#ffffff" letter-spacing="0.5">${item.title}</text>
        <text x="74" y="404" font-family="Arial, sans-serif" font-weight="700" font-size="30" fill="rgba(255,255,255,0.92)">${item.subtitle}</text>
      `;

      await sharp(createSvgBuffer(960, 480, svg))
        .png()
        .removeAlpha()
        .toFile(path.join(outputDir, item.file));
      console.log(`Generated ${item.file}`);
    }
  }

  // --- SCREENSHOTS GENERATION ---
  if (only && only !== 'all') return;
  
  // Shared Background for Screenshots (Browser Window Style)
  const bgWidth = 1280;
  const bgHeight = 800;
  const popupWidth = 400;
  const popupHeight = 600;
  const popupX = (bgWidth - popupWidth) / 2;
  const popupY = (bgHeight - popupHeight) / 2;

  // Screenshot 1: Home View with History
  const homeViewSvg = `
    <!-- Background -->
    <rect width="100%" height="100%" fill="#f1f5f9" />
    
    <!-- Browser Window Hint -->
    <rect x="0" y="0" width="1280" height="80" fill="#e2e8f0" />
    <circle cx="40" cy="40" r="8" fill="#cbd5e1" />
    <circle cx="70" cy="40" r="8" fill="#cbd5e1" />
    <circle cx="100" cy="40" r="8" fill="#cbd5e1" />
    
    <!-- Popup Container -->
    <rect x="${popupX}" y="${popupY}" width="${popupWidth}" height="${popupHeight}" rx="12" fill="#ffffff" filter="url(#shadow)" />
    
    <!-- Header -->
    <text x="${popupX + 50}" y="${popupY + 45}" font-family="Arial" font-weight="bold" font-size="20" fill="#1e293b">Memoraid</text>
    <!-- Settings Icon Mock -->
    <circle cx="${popupX + 370}" cy="${popupY + 40}" r="12" fill="none" stroke="#64748b" stroke-width="2" />
    
    <!-- Main Content -->
    <text x="${popupX + 200}" y="${popupY + 100}" text-anchor="middle" font-family="Arial" font-size="14" fill="#475569">Open a ChatGPT or Gemini chat page</text>
    <text x="${popupX + 200}" y="${popupY + 120}" text-anchor="middle" font-family="Arial" font-size="14" fill="#475569">and click the button below.</text>
    
    <!-- Summarize Button -->
    <rect x="${popupX + 80}" y="${popupY + 150}" width="240" height="48" rx="8" fill="#000000" />
    <text x="${popupX + 200}" y="${popupY + 180}" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="14" fill="#ffffff">Summarize &amp; Export</text>
    
    <!-- Recent Documents Header -->
    <line x1="${popupX}" y1="${popupY + 230}" x2="${popupX + 400}" y2="${popupY + 230}" stroke="#e2e8f0" />
    <text x="${popupX + 20}" y="${popupY + 260}" font-family="Arial" font-weight="bold" font-size="16" fill="#334155">Recent Documents</text>
    <text x="${popupX + 380}" y="${popupY + 260}" text-anchor="end" font-family="Arial" font-weight="bold" font-size="10" fill="#94a3b8" letter-spacing="1">CLEAR ALL</text>
    
    <!-- History Item 1 -->
    <rect x="${popupX + 20}" y="${popupY + 280}" width="360" height="70" rx="8" fill="#ffffff" stroke="#e2e8f0" />
    <text x="${popupX + 35}" y="${popupY + 310}" font-family="Arial" font-weight="bold" font-size="14" fill="#1e293b">图标设计建议</text>
    <text x="${popupX + 35}" y="${popupY + 330}" font-family="Arial" font-size="12" fill="#94a3b8">2026/1/5 15:31</text>
    
    <!-- History Item 2 -->
    <rect x="${popupX + 20}" y="${popupY + 360}" width="360" height="70" rx="8" fill="#ffffff" stroke="#e2e8f0" />
    <text x="${popupX + 35}" y="${popupY + 390}" font-family="Arial" font-weight="bold" font-size="14" fill="#1e293b">SQL子查询问题解析</text>
    <text x="${popupX + 35}" y="${popupY + 410}" font-family="Arial" font-size="12" fill="#94a3b8">2026/1/5 14:55</text>
    
    <!-- Status Footer -->
    <text x="${popupX + 200}" y="${popupY + 500}" text-anchor="middle" font-family="Arial" font-size="14" fill="#94a3b8">Status: Done!</text>
  `;
  
  const logoForScreenshot = await sharp(logoBuffer).resize(30, 30).toBuffer();
  
  await sharp(createSvgBuffer(1280, 800, homeViewSvg))
    .composite([{ input: logoForScreenshot, top: popupY + 25, left: popupX + 15 }])
    .png()
    .removeAlpha()
    .toFile(path.join(outputDir, 'screenshot-1.png'));
  console.log('Generated screenshot-1.png (Home View)');


  // Screenshot 2: Result View (SQL Analysis)
  const resultViewSvg = `
    <!-- Background -->
    <rect width="100%" height="100%" fill="#f1f5f9" />
    <rect x="0" y="0" width="1280" height="80" fill="#e2e8f0" />
    <circle cx="40" cy="40" r="8" fill="#cbd5e1" />
    <circle cx="70" cy="40" r="8" fill="#cbd5e1" />
    <circle cx="100" cy="40" r="8" fill="#cbd5e1" />
    
    <!-- Popup Container -->
    <rect x="${popupX}" y="${popupY}" width="${popupWidth}" height="${popupHeight}" rx="12" fill="#ffffff" filter="url(#shadow)" />
    
    <!-- Content Header -->
    <text x="${popupX + 20}" y="${popupY + 40}" font-family="Arial" font-weight="bold" font-size="18" fill="#1e293b">6.2 面试题二：相关子查询与性能</text>
    
    <!-- Content Body (Simulated) -->
    <text x="${popupX + 20}" y="${popupY + 70}" font-family="Arial" font-weight="bold" font-size="13" fill="#334155">题目：解释什么是相关子查询...</text>
    
    <text x="${popupX + 20}" y="${popupY + 100}" font-family="Arial" font-weight="bold" font-size="13" fill="#334155">参考答案：</text>
    
    <!-- Bullet Points -->
    <circle cx="${popupX + 25}" cy="${popupY + 125}" r="2" fill="#94a3b8" />
    <text x="${popupX + 35}" y="${popupY + 130}" font-family="Arial" font-size="13" fill="#475569">定义：相关子查询是指子查询...</text>
    
    <circle cx="${popupX + 25}" cy="${popupY + 155}" r="2" fill="#94a3b8" />
    <text x="${popupX + 35}" y="${popupY + 160}" font-family="Arial" font-size="13" fill="#475569">性能影响分析：</text>
    
    <!-- Nested Bullets -->
    <circle cx="${popupX + 45}" cy="${popupY + 185}" r="2" fill="#cbd5e1" />
    <text x="${popupX + 55}" y="${popupY + 190}" font-family="Arial" font-size="13" fill="#475569">在 SELECT 语句中：可能导致...</text>
    <text x="${popupX + 55}" y="${popupY + 210}" font-family="Arial" font-size="13" fill="#475569">优化手段包括：重写为 JOIN...</text>
    
    <circle cx="${popupX + 45}" cy="${popupY + 240}" r="2" fill="#cbd5e1" />
    <text x="${popupX + 55}" y="${popupY + 245}" font-family="Arial" font-size="13" fill="#475569">在 UPDATE 语句中：危害最大...</text>
    
    <!-- Buttons Area -->
    <rect x="${popupX + 20}" y="${popupY + 480}" width="175" height="40" rx="4" fill="#2563eb" />
    <text x="${popupX + 107}" y="${popupY + 505}" text-anchor="middle" font-family="Arial" font-size="14" fill="#ffffff">Copy</text>
    
    <rect x="${popupX + 205}" y="${popupY + 480}" width="175" height="40" rx="4" fill="#22c55e" />
    <text x="${popupX + 292}" y="${popupY + 505}" text-anchor="middle" font-family="Arial" font-size="14" fill="#ffffff">MD</text>
    
    <rect x="${popupX + 330}" y="${popupY + 480}" width="50" height="40" rx="4" fill="#ffffff" stroke="#e2e8f0" display="none" /> 
    <!-- Actually the user image has a 'Back' button on the right, let's adjust -->
    <!-- Re-layout buttons based on image: [Copy (Blue)] [MD (Green)] [Back (White)] -->
    <!-- Let's assume proportional widths -->
    <rect x="${popupX + 20}" y="${popupY + 480}" width="140" height="40" rx="6" fill="#2563eb" />
    <text x="${popupX + 90}" y="${popupY + 505}" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="14" fill="#ffffff">Copy</text>
    
    <rect x="${popupX + 170}" y="${popupY + 480}" width="140" height="40" rx="6" fill="#16a34a" />
    <text x="${popupX + 240}" y="${popupY + 505}" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="14" fill="#ffffff">MD</text>
    
    <rect x="${popupX + 320}" y="${popupY + 480}" width="60" height="40" rx="6" fill="#ffffff" stroke="#e2e8f0" />
    <text x="${popupX + 350}" y="${popupY + 505}" text-anchor="middle" font-family="Arial" font-size="13" fill="#1e293b">Back</text>
    
    <!-- Refine Input -->
    <rect x="${popupX + 20}" y="${popupY + 540}" width="320" height="40" rx="4" fill="#ffffff" stroke="#e2e8f0" />
    <text x="${popupX + 30}" y="${popupY + 565}" font-family="Arial" font-size="13" fill="#94a3b8">Ask AI to refine (e.g. 'Make it shorter')...</text>
    <rect x="${popupX + 350}" y="${popupY + 540}" width="30" height="40" rx="4" fill="#c084fc" />
  `;

  await sharp(createSvgBuffer(1280, 800, resultViewSvg))
    .png()
    .removeAlpha()
    .toFile(path.join(outputDir, 'screenshot-2.png'));
  console.log('Generated screenshot-2.png (Result View)');
}

generateAssets().catch(err => console.error(err));
