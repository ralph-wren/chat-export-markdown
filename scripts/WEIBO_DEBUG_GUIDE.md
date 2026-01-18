# 微博图片获取调试指南

## 🚀 快速开始

### 步骤 1: 打开微博页面
打开任何包含图片的微博页面，例如：
- 微博搜索结果页
- 用户主页
- 单条微博详情页

### 步骤 2: 打开浏览器控制台
按 `F12` 或右键点击页面选择"检查"

### 步骤 3: 运行调试脚本

复制以下脚本到控制台并回车：

```javascript
// 方法 1: 从本地文件加载（推荐）
fetch('file:///c:/Users/ralph/IdeaProject/Memoraid/scripts/weibo-image-debug.js')
  .then(r => r.text())
  .then(code => eval(code))
  .catch(e => console.error('加载失败:', e));

// 方法 2: 直接粘贴脚本内容
// 打开 scripts/weibo-image-debug.js 文件，复制全部内容到控制台
```

### 步骤 4: 使用调试面板

脚本运行后会在页面右上角显示一个调试面板：

1. **自动扫描**：脚本会自动扫描页面上的所有图片
2. **查看统计**：显示找到的图片总数和微博图片数量
3. **测试单个图片**：点击"测试获取"按钮测试每张图片
4. **查看结果**：查看三种获取方法的测试结果

## 📊 测试方法说明

调试脚本会测试三种获取图片的方法：

### 方法 1: 直接访问
- 直接使用 `fetch()` 访问图片 URL
- **预期结果**：失败（HTTP 403）
- **原因**：微博防盗链机制

### 方法 2: 代理访问
- 使用 `images.weserv.nl` 代理服务
- **预期结果**：成功
- **原因**：代理服务绕过防盗链

### 方法 3: Image 对象加载
- 使用浏览器原生 `Image` 对象
- **预期结果**：可能成功（取决于浏览器策略）
- **原因**：浏览器可能允许跨域图片显示

## 🔍 查看详细日志

调试面板底部会显示详细的操作日志：

```
[23:48:18] 开始扫描页面图片...
[23:48:18] 找到 15 个 <img> 标签
[23:48:18] 其中 8 个是微博图片
[23:48:19] 测试图片 1: https://wx3.sinaimg.cn/large/...
[23:48:19] 方法1: 直接访问
[23:48:19] 方法2: 使用 weserv.nl 代理
[23:48:20] 方法3: 使用 Image 对象
[23:48:20] 图片 1 测试成功
```

## 💡 控制台命令

脚本会暴露 `memoraidDebug` 全局对象，你可以在控制台使用：

```javascript
// 手动测试某个图片
memoraidDebug.testImage(0, 'https://wx3.sinaimg.cn/large/...');

// 添加日志
memoraidDebug.log('自定义日志', 'info');

// 关闭调试面板
memoraidDebug.close();
```

## 🎯 预期结果

### 成功的情况

如果代理服务工作正常，你应该看到：

```
✅ 直接访问: opaque (无法读取内容)
✅ 代理访问: 成功 1080x1920 (245.3KB)
✅ Image加载: 成功 1080x1920 (245.3KB)
```

并且会显示图片预览。

### 失败的情况

如果所有方法都失败：

```
❌ 直接访问: 失败: Failed to fetch
❌ 代理访问: 失败: Failed to fetch
❌ Image加载: 加载失败
```

这可能是因为：
1. 网络问题
2. 代理服务不可用
3. 图片 URL 已失效

## 🔧 故障排除

### 问题 1: 脚本加载失败

**错误信息**：`Uncaught ReferenceError: memoraidDebug is not defined`

**解决方案**：
1. 确保完整复制了脚本内容
2. 检查是否有语法错误
3. 尝试刷新页面后重新运行

### 问题 2: 未找到微博图片

**可能原因**：
1. 页面还未加载完成
2. 图片使用了懒加载
3. 图片在 iframe 中

**解决方案**：
1. 等待页面完全加载
2. 滚动页面触发懒加载
3. 手动点击"扫描页面图片"按钮

### 问题 3: 所有测试都失败

**可能原因**：
1. 网络连接问题
2. 代理服务不可用
3. 浏览器安全策略限制

**解决方案**：
1. 检查网络连接
2. 尝试在浏览器新标签页直接访问图片 URL
3. 检查浏览器控制台的网络请求

## 📝 收集调试信息

如果需要报告问题，请提供：

1. **浏览器信息**：Chrome 版本号
2. **页面 URL**：测试的微博页面地址
3. **控制台日志**：完整的日志输出（右键复制）
4. **测试结果截图**：调试面板的截图
5. **网络请求**：F12 → Network 标签的截图

## 🎓 高级用法

### 批量测试所有图片

```javascript
// 获取所有微博图片 URL
const weiboImages = Array.from(document.querySelectorAll('img'))
  .map(img => img.src || img.getAttribute('data-src'))
  .filter(src => src && src.includes('sinaimg.cn'));

console.log('找到微博图片:', weiboImages.length);

// 批量测试
for (let i = 0; i < weiboImages.length; i++) {
  await memoraidDebug.testImage(i, weiboImages[i]);
  await new Promise(r => setTimeout(r, 1000)); // 等待1秒
}
```

### 导出测试结果

```javascript
// 导出为 JSON
const results = {
  url: location.href,
  timestamp: new Date().toISOString(),
  images: weiboImages,
  // ... 其他信息
};

console.log(JSON.stringify(results, null, 2));
```

## 📚 相关文档

- [README_WEIBO_IMAGE_FIX.md](../README_WEIBO_IMAGE_FIX.md) - 完整的修复方案
- [test-proxy.html](../test-proxy.html) - 代理服务测试工具
- [test-weibo-image.html](../test-weibo-image.html) - 单图片测试工具

---

**提示**：这个调试脚本仅用于开发和调试，不会修改页面内容或发送任何数据到外部服务器。
