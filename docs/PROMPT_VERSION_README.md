# 提示词强制刷新功能实现总结

## 📋 功能概述

实现了提示词版本控制机制，当开发者修改默认提示词时，用户设置面板会自动更新到最新版本。

## 🎯 解决的问题

**问题**：修改 `prompts.ts` 中的默认提示词后，已安装插件的用户无法自动获取更新。

**解决方案**：通过版本号机制，在用户打开设置面板时自动检测并更新提示词。

## 📝 修改的文件

### 1. `src/utils/prompts.ts`
- ✅ 添加了 `PROMPT_VERSIONS` 常量导出
- 包含头条、知乎、微信三个平台的版本号

### 2. `src/utils/storage.ts`
- ✅ 在 `AppSettings` 接口中添加了 `promptVersions` 字段
- 用于存储每个平台的提示词版本号

### 3. `src/components/Settings.tsx`
- ✅ 导入 `PROMPT_VERSIONS` 常量
- ✅ 添加版本检查和自动更新的 useEffect hook
- 在设置加载完成后自动检查版本并更新

## 🚀 使用方法

### 开发者使用流程

1. **修改提示词**
   ```typescript
   // 在 prompts.ts 中修改
   export const TOUTIAO_DEFAULT_PROMPT = `...新内容...`;
   ```

2. **更新版本号**
   ```typescript
   export const PROMPT_VERSIONS = {
     TOUTIAO: '1.0.1',  // ← 更新这里
     ZHIHU: '1.0.0',
     WEIXIN: '1.0.0'
   };
   ```

3. **构建并发布**
   ```bash
   npm run build
   ```

### 用户体验

用户无需任何操作，下次打开设置面板时会自动更新到最新版本。

## 🔍 技术实现

### 版本检查逻辑

```typescript
// 在 Settings.tsx 中
useEffect(() => {
  const checkAndUpdatePrompts = async () => {
    // 检查每个平台的版本号
    if (settings.promptVersions?.toutiao !== PROMPT_VERSIONS.TOUTIAO) {
      // 更新头条提示词
      newSettings.toutiao.customPrompt = TOUTIAO_DEFAULT_PROMPT;
      needsUpdate = true;
    }
    // ... 其他平台类似
    
    if (needsUpdate) {
      // 保存新版本号和提示词
      await saveSettings(newSettings);
    }
  };
  
  checkAndUpdatePrompts();
}, [isSettingsLoaded, settings.promptVersions]);
```

### 存储结构

```typescript
{
  promptVersions: {
    toutiao: '1.0.0',
    zhihu: '1.0.0',
    weixin: '1.0.0'
  },
  toutiao: {
    cookie: '...',
    customPrompt: '...最新提示词...'
  }
  // ... 其他配置
}
```

## ✅ 测试验证

已通过以下测试：
- ✅ 构建成功，无 TypeScript 错误
- ✅ 代码逻辑完整，包含所有平台

待测试项（需要在浏览器中验证）：
- ⏳ 新用户安装后的初始化
- ⏳ 版本更新后的自动刷新
- ⏳ 控制台日志输出
- ⏳ 存储持久化

## 📚 相关文档

- **使用说明**：`docs/PROMPT_VERSION_USAGE.md`
  - 详细的使用方法和示例
  - 版本号规范说明
  - 常见问题解答

- **测试指南**：`docs/PROMPT_VERSION_TESTING.md`
  - 完整的测试场景
  - 验证步骤
  - 调试技巧

## ⚠️ 注意事项

1. **版本号必须更新**：修改提示词后必须更新对应的版本号，否则用户不会收到更新

2. **会覆盖用户自定义**：版本更新会覆盖用户的自定义提示词（这是设计决策）

3. **版本号格式**：建议使用语义化版本（1.0.0），但任何字符串都可以

4. **控制台日志**：更新时会在控制台输出日志，方便调试

## 🎉 效果

通过这个机制，你可以：
- ✅ 随时优化默认提示词
- ✅ 所有用户自动获取更新
- ✅ 无需用户手动操作
- ✅ 保持提示词的一致性和最新性

## 📞 问题反馈

如果遇到问题，请查看：
1. 控制台日志
2. Chrome Storage 中的数据
3. 测试指南中的问题排查部分
