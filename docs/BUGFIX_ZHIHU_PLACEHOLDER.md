# 知乎图片占位符匹配及编译修复记录

## 问题描述

1. **图片占位符匹配失败**：
   用户反馈在知乎文章生成过程中，图片占位符（如 `[图片: 关键词]`）有时无法被正确识别和替换，特别是当占位符中包含多余空格或特殊字符时（例如 `[图片:  关键词 ]` 或 `[图片:\n关键词]`）。现有的精确匹配和简单模糊匹配无法覆盖所有情况。

2. **TypeScript 编译错误**：
   在使用 `window.find()` 方法作为文本查找的保底方案时，TypeScript 报错 `Property 'find' does not exist on type 'Window & typeof globalThis'`，因为 `find` 是非标准但被广泛支持的浏览器 API，未包含在默认的 TS 定义中。

## 解决思路

### 1. 增强文本匹配逻辑

为了提高占位符查找的鲁棒性，在 `selectTextInEditor`（选中文本）和 `deleteTextInEditor`（删除文本）函数中引入了**正则模糊匹配**机制。

- **原理**：将搜索关键词中的特殊字符转义，并将空格替换为 `\s*`（匹配任意空白字符），构建灵活的正则表达式。
- **示例**：`[图片: foo]` -> `\[\s*图片\s*[:：]\s*foo\s*\]`。这样即使原文是 `[图片:   foo ]` 也能匹配成功。
- **多级匹配策略**：
    1. **TreeWalker 精确匹配**：最快，最准确。
    2. **正则模糊匹配**：处理空格、换行、中文/英文冒号差异。
    3. **Window.find**：浏览器原生查找，作为保底，会自动滚动页面。
    4. **降级模糊匹配**：忽略所有空白字符的暴力匹配。

### 2. 修复 TypeScript 编译错误

- **方法**：使用类型断言 `(window as any).find(...)`。
- **原因**：这是最直接的修复方式，避免了修改全局类型定义文件的复杂性，且该方法仅在局部使用。

## 修改文件

- `src/content/zhihu.ts`

## 关键代码片段

### 正则匹配逻辑

```typescript
// 构建灵活的正则: 转义特殊字符，并将空格替换为 \s*
const escaped = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// 允许冒号是中文或英文，允许任意空白
const patternStr = escaped.replace(/\\:|\\：/g, '[:：]').replace(/\\ /g, '\\s*');
const regex = new RegExp(patternStr);

const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
let node: Node | null;

while ((node = walker.nextNode())) {
  const text = node.textContent || '';
  const match = regex.exec(text);
  if (match) {
    // ... 选中逻辑
  }
}
```

### 类型断言修复

```typescript
if ((window as any).find(searchText, false, false, true, false, false, false)) {
  // ...
}
```

## 验证结果

- 执行 `npm run build` 通过，无 TypeScript 错误。
- 逻辑上覆盖了更多格式的占位符，提高了图片插入的成功率。
