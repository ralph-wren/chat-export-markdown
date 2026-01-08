/**
 * 使用 Playwright 打开头条发布页面
 * 使用系统安装的 Chrome 浏览器和用户数据目录
 * 
 * 运行方式: node scripts/open-toutiao.js
 */

import { chromium } from 'playwright';

const CONFIG = {
  // Chrome 浏览器路径
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  // 用户数据目录
  userDataDir: 'C:\\Users\\ralph\\AppData\\Local\\Google\\Chrome\\Chrome-Automation',
  // 头条发布页面 URL
  toutiaoPublishUrl: 'https://mp.toutiao.com/profile_v4/graphic/publish'
};

async function openToutiaoPublish() {
  console.log('🚀 启动 Chrome 浏览器...');
  console.log(`   浏览器路径: ${CONFIG.executablePath}`);
  console.log(`   用户数据目录: ${CONFIG.userDataDir}`);
  
  try {
    // 使用 launchPersistentContext 来使用现有的用户数据目录
    const context = await chromium.launchPersistentContext(CONFIG.userDataDir, {
      executablePath: CONFIG.executablePath,
      headless: false, // 显示浏览器窗口
      channel: 'chrome',
      args: [
        '--start-maximized', // 最大化窗口
        '--disable-blink-features=AutomationControlled', // 隐藏自动化标识
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
    console.log('   - 浏览器窗口将保持打开状态');
    console.log('   - 按 Ctrl+C 关闭脚本（浏览器会保持打开）');
    console.log('');

    // 等待用户操作，保持浏览器打开
    // 监听页面关闭事件
    page.on('close', () => {
      console.log('📄 页面已关闭');
    });

    // 保持脚本运行
    await new Promise(() => {});

  } catch (error) {
    console.error('❌ 错误:', error.message);
    
    if (error.message.includes('user data directory is already in use')) {
      console.log('');
      console.log('💡 提示: Chrome 用户数据目录正在被使用');
      console.log('   请先关闭所有 Chrome 窗口，然后重试');
      console.log('   或者使用不同的用户配置文件');
    }
    
    process.exit(1);
  }
}

// 运行
openToutiaoPublish();
