# 提示词强制刷新功能测试指南

## 测试目的

验证提示词版本控制机制是否正常工作，确保修改提示词后用户能自动获取更新。

## 测试环境准备

1. 确保已构建最新代码：`npm run build`
2. 在浏览器中加载/刷新扩展
3. 准备使用开发者工具查看控制台日志

## 测试场景

### 场景1：首次安装（新用户）

**测试步骤：**
1. 清除浏览器扩展数据（或使用新的浏览器配置）
2. 安装/重新加载扩展
3. 打开设置面板

**预期结果：**
- 所有平台的提示词都应该是当前代码中的最新版本
- `promptVersions` 字段应该已初始化为当前版本号
- 不应该有更新日志（因为是首次安装）

### 场景2：版本更新（现有用户）

**测试步骤：**

#### 步骤 2.1：模拟旧版本用户
1. 打开浏览器开发者工具
2. 进入 Application → Storage → Chrome Storage → Sync
3. 手动修改 `promptVersions.toutiao` 为 `"0.9.0"`（或删除整个 promptVersions 字段）
4. 刷新设置面板

#### 步骤 2.2：验证自动更新
**预期结果：**
- 控制台应该输出：`[Prompt Update] 头条提示词已更新到版本: 1.0.0`
- 头条号自定义提示词内容应该更新为最新版本
- 查看 Chrome Storage，`promptVersions.toutiao` 应该已更新为 `"1.0.0"`

### 场景3：多平台同时更新

**测试步骤：**
1. 在 `prompts.ts` 中修改所有三个平台的提示词
2. 更新所有版本号：
   ```typescript
   export const PROMPT_VERSIONS = {
     TOUTIAO: '1.1.0',
     ZHIHU: '1.1.0',
     WEIXIN: '1.1.0'
   };
   ```
3. 构建：`npm run build`
4. 刷新扩展并打开设置面板

**预期结果：**
- 控制台应该输出三条更新日志
- 所有平台的提示词都应该更新
- 所有版本号都应该是 `"1.1.0"`

### 场景4：部分平台更新

**测试步骤：**
1. 只修改知乎的提示词
2. 只更新知乎的版本号：
   ```typescript
   export const PROMPT_VERSIONS = {
     TOUTIAO: '1.1.0',
     ZHIHU: '1.2.0',  // ← 只更新这个
     WEIXIN: '1.1.0'
   };
   ```
3. 构建并刷新

**预期结果：**
- 控制台只应该输出知乎的更新日志
- 只有知乎的提示词被更新
- 头条和微信的提示词保持不变

## 验证清单

测试完成后，确认以下项目：

- [ ] 新用户安装后，提示词是最新版本
- [ ] 版本号更新后，旧用户自动获取新提示词
- [ ] 控制台日志正确显示更新信息
- [ ] Chrome Storage 中的版本号正确更新
- [ ] 不更新版本号时，提示词不会变化
- [ ] 多平台可以独立更新
- [ ] 构建过程无错误

## 调试技巧

### 查看存储的版本信息

在浏览器控制台执行：
```javascript
chrome.storage.sync.get(['promptVersions'], (result) => {
  console.log('当前版本:', result.promptVersions);
});
```

### 手动触发版本更新

在浏览器控制台执行：
```javascript
chrome.storage.sync.get(null, (data) => {
  delete data.promptVersions; // 删除版本信息
  chrome.storage.sync.set(data, () => {
    console.log('版本信息已删除，刷新页面将触发更新');
  });
});
```

### 查看当前提示词内容

在浏览器控制台执行：
```javascript
chrome.storage.sync.get(['toutiao', 'zhihu', 'weixin'], (result) => {
  console.log('头条提示词:', result.toutiao?.customPrompt);
  console.log('知乎提示词:', result.zhihu?.customPrompt);
  console.log('微信提示词:', result.weixin?.customPrompt);
});
```

## 注意事项

1. **清除缓存**：测试时确保清除浏览器缓存和扩展数据
2. **版本号格式**：版本号是字符串比较，确保格式一致
3. **自动保存**：Settings 组件有自动保存机制，更新会立即保存
4. **依赖检查**：useEffect 依赖于 `isSettingsLoaded` 和 `settings.promptVersions`

## 问题排查

### 问题：更新后提示词没有变化

**可能原因：**
- 版本号没有更新
- 构建后没有刷新扩展
- 浏览器缓存问题

**解决方法：**
1. 确认 `PROMPT_VERSIONS` 已更新
2. 运行 `npm run build`
3. 完全卸载并重新安装扩展

### 问题：控制台没有更新日志

**可能原因：**
- 版本号已经是最新的
- 设置面板没有正确加载

**解决方法：**
1. 检查 Chrome Storage 中的版本号
2. 手动删除 `promptVersions` 字段
3. 刷新设置面板

### 问题：更新触发了多次

**可能原因：**
- useEffect 依赖项配置问题
- settings 对象引用变化

**解决方法：**
- 这是正常的，代码中已经通过 `needsUpdate` 标志避免重复更新
- 如果持续循环，检查 useEffect 的依赖数组
