# 小红书发布流程实现

## 日期
2026-01-24

## 问题描述
用户提供了小红书创作者平台的 Playwright 录制脚本，需要仿照其他自媒体平台（今日头条、微信公众号、知乎）的代码，实现小红书的自动化发布流程。

## 实现方案

### 1. 创建 Content Script

创建了 `src/content/xiaohongshu.ts` 文件，实现了以下功能：

#### 核心功能模块

1. **页面元素选择器配置**
   - 基于 Playwright 录制的操作步骤，定义了所有关键元素的选择器
   - 包括：新的创作按钮、标题输入框、正文编辑器、一键排版按钮、模板封面、下一步按钮、添加话题按钮、发布按钮等

2. **核心功能函数**
   ```typescript
   - clickNewCreation()      // 点击"新的创作"按钮
   - fillTitle()             // 填充标题
   - fillContent()           // 填充正文内容
   - clickAutoFormat()       // 点击"一键排版"按钮
   - selectTemplateCover()   // 选择模板封面
   - clickNextStep()         // 点击"下一步"按钮
   - addTopics()             // 添加话题
   - setContentTypeDeclaration() // 设置内容类型声明
   - clickPublish()          // 点击"发布"按钮
   ```

3. **自动填充流程**
   - `autoFillContent()`: 页面加载时自动执行的主流程
   - 从 `chrome.storage.local` 读取待发布数据
   - 按照正确的步骤顺序执行填充操作
   - 支持流程取消功能
   - 完成后清除待发布数据

4. **日志记录系统**
   - `XiaohongshuLogger` 类：提供可视化的操作日志
   - 实时显示操作进度和状态
   - 支持复制日志、停止操作等功能

5. **发布上报**
   - `installPublishReporting()`: 监听 URL 变化，检测发布成功
   - 当 URL 包含 `published=true` 时，上报发布成功到后端

### 2. 注册到 Manifest

在 `src/manifest.ts` 中添加了小红书的 content script 配置：

```typescript
{
  // 小红书创作者平台发布页面
  matches: ['*://creator.xiaohongshu.com/*'],
  js: ['src/content/xiaohongshu.ts'],
}
```

### 3. 工具函数复用

使用了项目中已有的工具类：
- `DOMHelper`: 提供 DOM 查找和操作功能
- `reportArticlePublish`: 上报文章发布成功
- `reportError`: 上报错误信息

### 4. 参考的 Playwright 操作步骤

根据用户提供的 Playwright 测试脚本，实现了以下操作流程：

1. 访问小红书创作者平台发布页面
2. 点击"新的创作"按钮（如果需要）
3. 填充标题和正文内容
4. 点击"一键排版"（可选）
5. 选择模板封面（可选）
6. 点击"下一步"进入发布设置
7. 添加话题（可选）
8. 设置内容类型声明（可选）
9. 点击"发布"按钮

## 技术细节

### DOM 操作策略

1. **多重选择器策略**
   - 为每个元素提供多个备选选择器
   - 按优先级顺序尝试查找元素
   - 提高兼容性和稳定性

2. **等待机制**
   - 页面加载等待：2000ms
   - 操作后等待：300-2000ms（根据操作类型调整）
   - 元素查找重试：最多 10 次，每次间隔 500ms

3. **事件触发**
   - 使用 `simulateClick()` 模拟点击
   - 使用 `dispatchEvent()` 触发 input 事件
   - 确保页面正确响应

### 错误处理

1. **流程取消机制**
   - 用户可以随时点击"停止"按钮取消流程
   - 每个步骤执行前检查 `isFlowCancelled` 标志

2. **错误上报**
   - 所有错误都通过 `reportError()` 上报
   - 日志记录器显示详细的错误信息

3. **容错设计**
   - 可选步骤失败不影响后续流程
   - 关键步骤失败则终止流程并提示用户

## 遇到的问题和解决方法

### 问题 1: TypeScript 编译错误 - 未使用的变量

**问题描述**：
- `ImageHandler` 导入但未使用
- `isFlowRunning` 和 `pendingSourceImages` 声明但未使用
- TypeScript 配置 `noUnusedLocals: true` 导致编译失败

**解决方法**：
1. 注释掉 `ImageHandler` 导入（预留给未来的图片处理功能）
2. 注释掉未使用的工具函数（预留给未来使用）
3. 删除未使用的变量声明，保持代码简洁

### 问题 2: reportArticlePublish 参数错误

**问题描述**：
- 初始实现中使用了 `sourceUrl` 参数
- 但 `reportArticlePublish` 函数不接受 `sourceUrl` 参数

**解决方法**：
- 查看函数签名，确认正确的参数格式
- 将 `sourceUrl` 放入 `extra` 字段中：
  ```typescript
  await reportArticlePublish({
    platform: 'xiaohongshu',
    title: '小红书文章',
    url: window.location.href,
    extra: {
      sourceUrl: pendingSourceUrl
    }
  });
  ```

## 后续优化建议

1. **图片处理功能**
   - 实现图片上传功能
   - 支持从源文章中提取并上传图片
   - 使用 ImageHandler 工具类

2. **话题智能推荐**
   - 根据文章内容自动推荐相关话题
   - 使用 AI 分析文章主题

3. **封面图智能选择**
   - 使用 AI 选择最合适的模板封面
   - 或者自动生成封面图

4. **发布设置持久化**
   - 保存用户的发布偏好设置
   - 如常用话题、内容类型声明等

5. **批量发布支持**
   - 支持一次性发布多篇文章
   - 定时发布功能

## 测试建议

1. **手动测试**
   - 访问 https://creator.xiaohongshu.com/publish/publish
   - 在 popup 中准备一篇文章
   - 点击"发布到小红书"按钮
   - 观察自动填充流程是否正常

2. **边界情况测试**
   - 测试标题过长的情况
   - 测试内容为空的情况
   - 测试网络延迟的情况
   - 测试页面元素变化的情况

3. **集成测试**
   - 测试从内容抓取到发布的完整流程
   - 测试多平台同时发布

## 相关文件

- `src/content/xiaohongshu.ts` - 小红书 content script
- `src/manifest.ts` - Manifest 配置文件
- `src/utils/domHelper.ts` - DOM 操作工具类
- `src/utils/debug.ts` - 调试和上报工具

## 参考资料

- [Playwright 文档](https://playwright.dev/)
- [小红书创作者平台](https://creator.xiaohongshu.com/)
- 项目中其他平台的实现：
  - `src/content/toutiao.ts` - 今日头条
  - `src/content/zhihu.ts` - 知乎
  - `src/content/weixin.ts` - 微信公众号
