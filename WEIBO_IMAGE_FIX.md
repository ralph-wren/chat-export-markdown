# 微博图片获取失败问题修复说明

## 问题描述

在微信公众号发布流程中，从微博页面获取图片时全部失败，日志显示：

```
[23:48:18] ℹ️ 检测到可能防盗链的图片来源，跳过直接链接插入
[23:48:19] ⚠️ base64 插入失败，尝试上传图片
[23:48:21] ⚠️ 图片处理失败
```

## 问题原因

1. **微博防盗链机制**：微博的 `sinaimg.cn` 域名有严格的防盗链检测
2. **Referrer 策略不足**：原有的 referrer 列表不够全面
3. **缺少详细日志**：难以定位具体失败原因

## 已实施的修复

### 1. 后端 `fetchImageAsDataUrl` 函数优化 (src/background/index.ts)

**改进内容：**
- ✅ 增加了更多 referrer 选项：
  - `https://weibo.com/`
  - `https://m.weibo.cn/`
  - `https://s.weibo.com/`
  - `https://www.weibo.com/`
- ✅ 添加了 User-Agent 头部
- ✅ 增加了图片大小检查（至少 1KB，避免错误页面）
- ✅ 添加了详细的控制台日志输出
- ✅ 改进了错误处理逻辑

### 2. 前端 `fetchSourceImageDataUrl` 函数优化 (src/content/weixin.ts)

**改进内容：**
- ✅ 增加了详细的日志输出到用户界面
- ✅ 增加了更多重试策略（最多 4 次尝试）
- ✅ 添加了降级方案（从 large 降级到 mw2000）
- ✅ 改进了错误信息展示

## 如何测试修复

### 步骤 1：重新编译扩展

```bash
cd c:\Users\ralph\IdeaProject\Memoraid
npm run build
```

### 步骤 2：重新加载扩展

1. 打开 Chrome 扩展管理页面：`chrome://extensions/`
2. 找到 Memoraid 扩展
3. 点击"重新加载"按钮

### 步骤 3：测试微博图片获取

1. 打开一个包含图片的微博页面
2. 使用 Memoraid 生成文章并发布到微信公众号
3. 观察日志输出

### 步骤 4：查看详细日志

**浏览器控制台日志（F12）：**
```
[fetchImageAsDataUrl] 尝试 1/4: https://wx3.sinaimg.cn/large/...
[fetchImageAsDataUrl] 响应状态: 200 OK
[fetchImageAsDataUrl] Content-Type: image/jpeg
[fetchImageAsDataUrl] Blob 大小: 123456 bytes
[fetchImageAsDataUrl] 成功获取图片，base64 长度: 164608
```

**页面日志面板：**
```
尝试获取图片 (第 1 次): https://wx3.sinaimg.cn/large/...
成功获取图片: 120.5 KB
来源图片base64已获取: mime=image/jpeg, len=164608
base64 图片插入成功
```

## 如果问题仍然存在

### 诊断步骤

1. **检查网络连接**
   - 确保可以直接访问微博图片 URL
   - 在浏览器中直接打开图片链接测试

2. **查看控制台错误**
   - 打开浏览器开发者工具（F12）
   - 切换到 Console 标签
   - 查找 `[fetchImageAsDataUrl]` 相关的错误信息

3. **检查图片 URL 格式**
   - 确认图片 URL 是否为 `sinaimg.cn` 域名
   - 检查 URL 是否包含正确的路径和文件名

### 可能的额外解决方案

#### 方案 1：使用图片代理服务

如果微博的防盗链机制过于严格，可以考虑使用图片代理服务：

```typescript
// 在 fetchImageAsDataUrl 中添加代理选项
const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(url)}`;
```

#### 方案 2：降低图片质量要求

修改 `fetchSourceImageDataUrl` 中的最小大小检查：

```typescript
// 从 50000 降低到 10000
if (dataUrl.length < 10000) return null;
```

#### 方案 3：跳过失败的图片

在发布流程中，如果某张图片获取失败，自动跳过并继续处理下一张：

```typescript
// 已在代码中实现
if (!success) {
  logger.log(`⚠️ 第 ${i + 1} 张图片处理失败，继续下一个`, 'warn');
  failedPlaceholders.add(placeholder.text);
}
```

## 技术细节

### 微博图片 URL 格式

微博图片 URL 通常格式如下：
```
https://wx3.sinaimg.cn/large/008nU6aaly8i9cwu6zcasj30u00u040q.jpg
https://wx4.sinaimg.cn/middle/008crF7Zly1i9dusvs8vtj30k00tu3zo.jpg
```

### URL 规范化逻辑

代码会自动将图片 URL 规范化为 `large` 规格：
- `thumb150` → `large`
- `bmiddle` → `large`
- `small` → `large`
- `mw2000` → `large`

### Referrer 策略

对于 `sinaimg.cn` 域名的图片，会依次尝试以下 referrer：
1. 原始 referrer（如果提供）
2. `https://weibo.com/`
3. `https://m.weibo.cn/`
4. `https://s.weibo.com/`
5. `https://www.weibo.com/`

## 联系支持

如果问题仍未解决，请提供以下信息：

1. 浏览器控制台的完整日志
2. 失败的图片 URL 示例
3. 微博页面的 URL
4. 错误截图

## 更新日志

- **2025-01-17**: 初始修复版本
  - 增加更多 referrer 选项
  - 添加详细日志输出
  - 改进错误处理
  - 增加图片大小检查
