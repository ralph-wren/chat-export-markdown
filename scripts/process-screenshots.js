
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const inputDir = path.join(process.cwd(), 'store-assets/raw');
const outputDir = path.join(process.cwd(), 'store-assets/processed');

// 确保输出目录存在
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function processScreenshots() {
  console.log('开始处理截图...');
  
  if (!fs.existsSync(inputDir)) {
    console.error(`错误: 输入目录 ${inputDir} 不存在。`);
    return;
  }

  const files = fs.readdirSync(inputDir).filter(file => /\.(png|jpg|jpeg)$/i.test(file));
  
  if (files.length === 0) {
    console.log(`警告: 在 ${inputDir} 中没有找到图片文件。请将截图放入该目录。`);
    return;
  }

  console.log(`找到 ${files.length} 张图片，准备处理...`);

  // 目标尺寸
  const TARGET_WIDTH = 1280;
  const TARGET_HEIGHT = 800;
  
  // 截图在背景中的最大高度 (留出边距)
  const MAX_CONTENT_HEIGHT = 700; 

  for (const file of files) {
    const inputPath = path.join(inputDir, file);
    const outputPath = path.join(outputDir, `processed-${path.basename(file, path.extname(file))}.png`);
    
    try {
      // 1. 读取原始图片
      const image = sharp(inputPath);
      const metadata = await image.metadata();
      
      if (!metadata.width || !metadata.height) continue;

      // 2. 计算缩放比例
      // 我们希望图片完整显示，高度不超过 MAX_CONTENT_HEIGHT
      let resizeWidth, resizeHeight;
      const aspectRatio = metadata.width / metadata.height;
      
      if (metadata.height > MAX_CONTENT_HEIGHT) {
        resizeHeight = MAX_CONTENT_HEIGHT;
        resizeWidth = Math.round(resizeHeight * aspectRatio);
      } else {
        resizeHeight = metadata.height;
        resizeWidth = metadata.width;
      }

      // 3. 处理截图本身 (圆角 + 阴影效果)
      // 注意：sharp 直接加阴影比较复杂，我们这里用一个简单的半透明黑色背景模拟阴影
      
      const resizedImageBuffer = await image
        .resize(resizeWidth, resizeHeight)
        .toBuffer();

      // 创建阴影层 (比图片稍大，模糊)
      const shadowMargin = 20;
      const shadowWidth = resizeWidth + shadowMargin;
      const shadowHeight = resizeHeight + shadowMargin;
      
      // 创建背景画布
      const backgroundSvg = `
        <svg width="${TARGET_WIDTH}" height="${TARGET_HEIGHT}" version="1.1" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="#f8fafc" /> <!-- Slate-50 背景 -->
          <!-- 装饰性顶部条 (模拟浏览器) -->
          <rect x="0" y="0" width="${TARGET_WIDTH}" height="80" fill="#e2e8f0" />
          <circle cx="40" cy="40" r="8" fill="#cbd5e1" />
          <circle cx="70" cy="40" r="8" fill="#cbd5e1" />
          <circle cx="100" cy="40" r="8" fill="#cbd5e1" />
        </svg>
      `;

      // 阴影 SVG
      const shadowSvg = `
        <svg width="${shadowWidth}" height="${shadowHeight}">
           <rect x="0" y="0" width="${shadowWidth}" height="${shadowHeight}" rx="12" ry="12" fill="rgba(0,0,0,0.15)" />
        </svg>
      `;
      
      const shadowBuffer = await sharp(Buffer.from(shadowSvg))
        .blur(8) // 模糊处理模拟柔和阴影
        .toBuffer();

      // 计算居中位置
      const contentX = Math.round((TARGET_WIDTH - resizeWidth) / 2);
      const contentY = Math.round((TARGET_HEIGHT - resizeHeight) / 2) + 20; // 稍微向下偏移一点，避开顶部条
      
      const shadowX = contentX - (shadowMargin / 2);
      const shadowY = contentY - (shadowMargin / 2);

      // 4. 合成
      await sharp(Buffer.from(backgroundSvg))
        .composite([
          { input: shadowBuffer, top: Math.round(shadowY), left: Math.round(shadowX) },
          { input: resizedImageBuffer, top: contentX < 0 ? 0 : contentY, left: contentX < 0 ? 0 : contentX } 
        ])
        .png() // 强制 PNG
        .removeAlpha() // 移除 Alpha 通道 (商店要求)
        .toFile(outputPath);

      console.log(`✅ 已处理: ${file} -> ${outputPath}`);
      
    } catch (err) {
      console.error(`❌ 处理 ${file} 失败:`, err);
    }
  }
  
  console.log('\n🎉 所有图片处理完成！请查看 store-assets/processed 目录。');
}

processScreenshots();
