# 提示词强制刷新功能快速演示

## 🎬 演示：如何更新头条号提示词

假设你想要优化头条号的提示词，让文章更有吸引力。

### 步骤 1：修改提示词内容

打开 `src/utils/prompts.ts`，找到 `TOUTIAO_DEFAULT_PROMPT`：

```typescript
export const TOUTIAO_DEFAULT_PROMPT = `## 头条号文章风格指南

### 平台用户画像
头条用户特点：
- **年龄分布**：25-50岁为主，中年用户占比高
- **地域分布**：二三四线城市用户多，下沉市场是主力
- **阅读偏好**：热点新闻、社会民生、实用技巧、情感故事

### 写作风格要求
- **标题**：直击痛点，制造悬念  // ← 假设你在这里添加了新的要求
- **开头**：前3句话必须抓住眼球
- **语言**：通俗易懂，像跟邻居聊天
...
`;
```

### 步骤 2：更新版本号

在同一个文件末尾，找到并修改版本号：

```typescript
// 修改前
export const PROMPT_VERSIONS = {
  TOUTIAO: '1.0.0',  // ← 旧版本
  ZHIHU: '1.0.0',
  WEIXIN: '1.0.0'
};

// 修改后
export const PROMPT_VERSIONS = {
  TOUTIAO: '1.0.1',  // ← 新版本
  ZHIHU: '1.0.0',
  WEIXIN: '1.0.0'
};
```

### 步骤 3：构建项目

```bash
npm run build
```

构建输出示例：
```
> memoraid@1.1.2 build
> tsc && vite build

vite v5.4.21 building for production...
✓ built in 9.26s
```

### 步骤 4：重新加载扩展

1. 打开 Chrome 浏览器
2. 进入 `chrome://extensions/`
3. 找到 Memoraid 扩展
4. 点击"重新加载"按钮 🔄

### 步骤 5：验证更新

1. 打开扩展的设置面板
2. 打开浏览器开发者工具（F12）
3. 查看 Console 标签

你应该看到类似的日志：
```
[Prompt Update] 头条提示词已更新到版本: 1.0.1
```

4. 展开"头条配置"部分
5. 查看"自定义提示词"文本框
6. 确认内容已更新为你刚刚修改的版本

### 步骤 6：验证存储

在浏览器控制台执行：

```javascript
chrome.storage.sync.get(['promptVersions', 'toutiao'], (result) => {
  console.log('版本号:', result.promptVersions);
  console.log('提示词内容（前100字）:', result.toutiao?.customPrompt?.substring(0, 100));
});
```

输出示例：
```javascript
版本号: {toutiao: '1.0.1', zhihu: '1.0.0', weixin: '1.0.0'}
提示词内容（前100字）: ## 头条号文章风格指南

### 平台用户画像
头条用户特点：
- **年龄分布**：25-50岁为主，中年用户占比高...
```

## 🎯 完整演示：同时更新三个平台

如果你要同时优化所有平台的提示词：

### 1. 修改所有提示词

```typescript
// 修改头条
export const TOUTIAO_DEFAULT_PROMPT = `...新内容...`;

// 修改知乎
export const ZHIHU_DEFAULT_PROMPT = `...新内容...`;

// 修改微信
export const WEIXIN_DEFAULT_PROMPT = `...新内容...`;
```

### 2. 更新所有版本号

```typescript
export const PROMPT_VERSIONS = {
  TOUTIAO: '2.0.0',  // ← 重大更新
  ZHIHU: '2.0.0',    // ← 重大更新
  WEIXIN: '2.0.0'    // ← 重大更新
};
```

### 3. 构建并验证

```bash
npm run build
```

打开设置面板后，控制台会输出：
```
[Prompt Update] 头条提示词已更新到版本: 2.0.0
[Prompt Update] 知乎提示词已更新到版本: 2.0.0
[Prompt Update] 微信提示词已更新到版本: 2.0.0
```

## 🧪 模拟用户升级体验

想要体验用户的升级过程？

### 方法 1：手动降级版本

在浏览器控制台执行：

```javascript
chrome.storage.sync.get(null, (data) => {
  // 降级到旧版本
  data.promptVersions = {
    toutiao: '0.9.0',
    zhihu: '0.9.0',
    weixin: '0.9.0'
  };
  
  chrome.storage.sync.set(data, () => {
    console.log('已降级到 0.9.0，刷新设置面板将触发自动更新');
    // 刷新页面
    location.reload();
  });
});
```

### 方法 2：删除版本信息

```javascript
chrome.storage.sync.get(null, (data) => {
  delete data.promptVersions;
  
  chrome.storage.sync.set(data, () => {
    console.log('已删除版本信息，刷新设置面板将初始化为当前版本');
    location.reload();
  });
});
```

## 📊 版本演进示例

展示一个真实的版本演进过程：

```typescript
// v1.0.0 - 初始版本
export const PROMPT_VERSIONS = {
  TOUTIAO: '1.0.0',
  ZHIHU: '1.0.0',
  WEIXIN: '1.0.0'
};

// v1.0.1 - 优化头条号标题要求
export const PROMPT_VERSIONS = {
  TOUTIAO: '1.0.1',  // ← 只改这个
  ZHIHU: '1.0.0',
  WEIXIN: '1.0.0'
};

// v1.1.0 - 为知乎添加专业领域标注
export const PROMPT_VERSIONS = {
  TOUTIAO: '1.0.1',
  ZHIHU: '1.1.0',    // ← 功能更新
  WEIXIN: '1.0.0'
};

// v2.0.0 - 重构所有平台提示词结构
export const PROMPT_VERSIONS = {
  TOUTIAO: '2.0.0',  // ← 重大变更
  ZHIHU: '2.0.0',
  WEIXIN: '2.0.0'
};
```

## 💡 实用技巧

### 技巧 1：快速查看当前版本

在设置面板的控制台执行：

```javascript
chrome.storage.sync.get('promptVersions', (r) => {
  console.table(r.promptVersions);
});
```

输出：
```
┌─────────┬─────────┐
│ (index) │ Values  │
├─────────┼─────────┤
│ toutiao │ '1.0.1' │
│ zhihu   │ '1.0.0' │
│ weixin  │ '1.0.0' │
└─────────┴─────────┘
```

### 技巧 2：监听版本变化

```javascript
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.promptVersions) {
    console.log('版本已更新:');
    console.log('旧:', changes.promptVersions.oldValue);
    console.log('新:', changes.promptVersions.newValue);
  }
});
```

### 技巧 3：批量测试更新

创建一个测试脚本来验证多次更新：

```javascript
async function testVersionUpdate() {
  const versions = ['1.0.0', '1.0.1', '1.1.0', '2.0.0'];
  
  for (const version of versions) {
    await new Promise(resolve => {
      chrome.storage.sync.get(null, (data) => {
        data.promptVersions = { toutiao: version, zhihu: version, weixin: version };
        chrome.storage.sync.set(data, () => {
          console.log(`设置为版本 ${version}`);
          resolve();
        });
      });
    });
    
    // 等待2秒
    await new Promise(r => setTimeout(r, 2000));
    location.reload();
  }
}

testVersionUpdate();
```

## ✅ 验证清单

完成演示后，确认：

- [ ] 提示词内容已修改
- [ ] 版本号已更新
- [ ] `npm run build` 成功
- [ ] 扩展已重新加载
- [ ] 控制台有更新日志
- [ ] 设置面板显示新内容
- [ ] Chrome Storage 中版本号正确

## 🎉 总结

通过这个演示，你已经学会：
1. ✅ 如何修改提示词
2. ✅ 如何更新版本号
3. ✅ 如何验证更新
4. ✅ 如何模拟用户体验
5. ✅ 如何调试和测试

现在你可以随时优化提示词，所有用户都会自动获取最新版本！🚀
