// Playwright 测试脚本 - 测试微信公众号 AI 配图功能
// 运行方式: npx playwright test test-ai-image.js --headed

const { chromium } = require('playwright');

(async () => {
  // 启动浏览器
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500 // 放慢操作便于观察
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // 请先手动登录微信公众平台，然后进入文章编辑页面
  // 这里假设已经在编辑页面
  console.log('请手动导航到微信公众号文章编辑页面，然后按 Enter 继续...');
  
  // 等待用户手动操作
  await page.goto('https://mp.weixin.qq.com/');
  
  // 等待30秒让用户登录
  console.log('等待30秒，请登录并进入文章编辑页面...');
  await page.waitForTimeout(30000);
  
  // 1. 点击图片按钮
  console.log('步骤1: 点击图片按钮');
  await page.click('#js_editor_insertimage');
  await page.waitForTimeout(1000);
  
  // 2. 点击 AI 配图
  console.log('步骤2: 点击 AI 配图');
  await page.locator('#js_editor_insertimage').getByText('AI 配图').click();
  await page.waitForTimeout(1500);
  
  // 3. 分析 DOM 结构
  console.log('步骤3: 分析 AI 配图弹窗 DOM 结构');
  
  // 获取所有图片元素
  const images = await page.$$eval('img', imgs => {
    return imgs.map((img, index) => ({
      index,
      src: img.src?.substring(0, 100),
      className: img.className,
      parentClass: img.parentElement?.className,
      grandParentClass: img.parentElement?.parentElement?.className,
      width: img.getBoundingClientRect().width,
      height: img.getBoundingClientRect().height
    }));
  });
  console.log('图片元素:', JSON.stringify(images, null, 2));
  
  // 获取所有"插入"按钮
  const insertBtns = await page.$$eval('*', els => {
    return els.filter(el => el.innerText?.trim() === '插入' && el.offsetParent !== null)
      .map((el, index) => ({
        index,
        tagName: el.tagName,
        className: el.className,
        parentClass: el.parentElement?.className,
        grandParentClass: el.parentElement?.parentElement?.className,
        rect: el.getBoundingClientRect()
      }));
  });
  console.log('插入按钮:', JSON.stringify(insertBtns, null, 2));
  
  // 4. 输入关键词
  console.log('步骤4: 输入关键词');
  const promptInput = page.getByRole('textbox', { name: '请描述你想要创作的内容' });
  await promptInput.click();
  await promptInput.fill('美女');
  await page.waitForTimeout(500);
  
  // 5. 点击重新创作
  console.log('步骤5: 点击重新创作');
  await page.getByRole('button', { name: '重新创作' }).click();
  
  // 6. 等待生成完成
  console.log('步骤6: 等待 AI 生成完成...');
  
  // 等待 ai-image-operation-group 出现
  try {
    await page.waitForSelector('.ai-image-operation-group', { timeout: 90000 });
    console.log('AI 图片生成完成！');
  } catch (e) {
    console.log('等待超时，继续分析...');
  }
  
  await page.waitForTimeout(2000);
  
  // 7. 再次分析 DOM 结构
  console.log('步骤7: 生成后再次分析 DOM 结构');
  
  // 获取 ai-image-list 区域的结构
  const aiImageList = await page.$$eval('.ai-image-list', lists => {
    return lists.map((list, listIndex) => {
      const items = list.querySelectorAll('.ai-image-item');
      return {
        listIndex,
        className: list.className,
        itemCount: items.length,
        items: Array.from(items).map((item, itemIndex) => ({
          itemIndex,
          className: item.className,
          hasOperationGroup: !!item.querySelector('.ai-image-operation-group'),
          hasInsertBtn: !!item.querySelector('.ai-image-finetuning-btn'),
          insertBtnText: item.querySelector('.ai-image-finetuning-btn')?.innerText
        }))
      };
    });
  });
  console.log('ai-image-list 结构:', JSON.stringify(aiImageList, null, 2));
  
  // 获取所有 ai-image-operation-group
  const operationGroups = await page.$$eval('.ai-image-operation-group', groups => {
    return groups.map((group, index) => ({
      index,
      className: group.className,
      parentClass: group.parentElement?.className,
      grandParentClass: group.parentElement?.parentElement?.className,
      innerHTML: group.innerHTML.substring(0, 200),
      isVisible: group.offsetParent !== null,
      rect: group.getBoundingClientRect()
    }));
  });
  console.log('ai-image-operation-group:', JSON.stringify(operationGroups, null, 2));
  
  // 获取所有 ai-image-finetuning-btn
  const finetuningBtns = await page.$$eval('.ai-image-finetuning-btn', btns => {
    return btns.map((btn, index) => ({
      index,
      className: btn.className,
      innerText: btn.innerText?.trim(),
      parentClass: btn.parentElement?.className,
      grandParentClass: btn.parentElement?.parentElement?.className,
      isVisible: btn.offsetParent !== null,
      rect: btn.getBoundingClientRect()
    }));
  });
  console.log('ai-image-finetuning-btn:', JSON.stringify(finetuningBtns, null, 2));
  
  // 8. 找到正确的插入按钮
  console.log('步骤8: 尝试找到正确的插入按钮');
  
  // 查找最后一个 ai-image-list（新生成的图片应该在这里）
  const lastAiImageList = await page.$('.ai-image-list:last-of-type');
  if (lastAiImageList) {
    console.log('找到最后一个 ai-image-list');
    
    // 在最后一个列表中找插入按钮
    const insertBtn = await lastAiImageList.$('.ai-image-finetuning-btn');
    if (insertBtn) {
      const btnText = await insertBtn.innerText();
      console.log('找到插入按钮，文本:', btnText);
      
      if (btnText.trim() === '插入') {
        console.log('点击插入按钮');
        await insertBtn.click();
        await page.waitForTimeout(2000);
        console.log('图片已插入！');
      }
    }
  }
  
  // 保持浏览器打开以便观察
  console.log('测试完成，浏览器保持打开状态...');
  await page.waitForTimeout(60000);
  
  await browser.close();
})();
