/**
 * 使用 Playwright 打开头条发布页面
 * 使用系统安装的 Chrome 浏览器，但使用独立的 Profile 目录
 * 这样不会与正在运行的 Chrome 冲突
 * 
 * 运行方式: node scripts/open-toutiao-profile.js
 */

import { chromium } from 'playwright';
import path from 'path';
import os from 'os';

const CONFIG = {
  // Chrome 浏览器路径
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  // 使用独立的用户数据目录（在临时目录下创建）
  userDataDir: path.join(os.tmpdir(), 'playwright-chrome-toutiao'),
  // 头条发布页面 URL
  toutiaoPublishUrl: 'https://mp.toutiao.com/profile_v4/graphic/publish'
};

async function openToutiaoPublish() {
  console.log('🚀 启动 Chrome 浏览器...');
  console.log(`   浏览器路径: ${CONFIG.executablePath}`);
  console.log(`   用户数据目录: ${CONFIG.userDataDir}`);
  console.log('');
  console.log('⚠️  注意: 使用独立配置文件，首次运行需要登录头条账号');
  console.log('');
  
  try {
    // 使用 launchPersistentContext 来使用独立的用户数据目录
    const context = await chromium.launchPersistentContext(CONFIG.userDataDir, {
      executablePath: CONFIG.executablePath,
      headless: false, // 显示浏览器窗口
      args: [
        '--start-maximized', // 最大化窗口
        '--disable-blink-features=AutomationControlled', // 隐藏自动化标识
        '--no-first-run', // 跳过首次运行向导
        '--no-default-browser-check', // 跳过默认浏览器检查
      ],
      viewport: null, // 使用默认视口
      ignoreDefaultArgs: ['--enable-automation'], // 移除自动化标识
    });

    console.log('✅ 浏览器已启动');

    // 获取或创建新页面
    let page = context.pages()[0];
    if (!page) {
      page = await context.newPage();
    }

    console.log(`📄 正在访问: ${CONFIG.toutiaoPublishUrl}`);
    
    // 访问头条发布页面
    await page.goto(CONFIG.toutiaoPublishUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    console.log('✅ 页面已加载');
    console.log('');
    console.log('📝 提示:');
    console.log('   - 如果需要登录，请在浏览器中完成登录');
    console.log('   - 登录后，下次运行会自动保持登录状态');
    console.log('   - 浏览器窗口将保持打开状态');
    console.log('   - 按 Ctrl+C 关闭脚本和浏览器');
    console.log('');

    // 监听页面关闭事件
    page.on('close', () => {
      console.log('📄 页面已关闭');
    });

    // 监听上下文关闭事件
    context.on('close', () => {
      console.log('🔒 浏览器已关闭');
      process.exit(0);
    });

    // 保持脚本运行
    await new Promise(() => {});

  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
}

// 处理 Ctrl+C
process.on('SIGINT', () => {
  console.log('\n👋 正在关闭...');
  process.exit(0);
});

// 运行
openToutiaoPublish();
