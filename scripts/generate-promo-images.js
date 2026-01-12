import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const storeAssetsDir = path.join(__dirname, '..', 'store-assets');
  const publicDir = path.join(__dirname, '..', 'public');
  
  const iconPath = path.join(publicDir, 'icon-128.png');
  
  // 定义两个宣传图的配置
  const promoConfigs = [
    {
      name: 'promo-small-440x280.png',
      width: 440,
      height: 280,
      iconSize: 80,
      fontSize: 'small'
    },
    {
      name: 'promo-marquee-1400x560.png',
      width: 1400,
      height: 560,
      iconSize: 160,
      fontSize: 'large'
    }
  ];

  // 渐变背景色 - 使用蓝紫色渐变
  const gradientStart = { r: 59, g: 130, b: 246 };  // #3b82f6 蓝色
  const gradientEnd = { r: 139, g: 92, b: 246 };    // #8b5cf6 紫色

  for (const config of promoConfigs) {
    console.log(`\n正在生成 ${config.name} (${config.width}x${config.height})...`);
    
    const outputPath = path.join(storeAssetsDir, config.name);
    
    // 创建渐变背景
    // 使用 SVG 创建渐变背景
    const svgBackground = `
      <svg width="${config.width}" height="${config.height}">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:rgb(${gradientStart.r},${gradientStart.g},${gradientStart.b});stop-opacity:1" />
            <stop offset="100%" style="stop-color:rgb(${gradientEnd.r},${gradientEnd.g},${gradientEnd.b});stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grad)"/>
      </svg>
    `;
    
    // 创建背景图层
    const background = await sharp(Buffer.from(svgBackground))
      .png()
      .toBuffer();
    
    // 调整图标大小
    const resizedIcon = await sharp(iconPath)
      .resize(config.iconSize, config.iconSize)
      .png()
      .toBuffer();
    
    // 计算图标位置（居中偏左）
    const iconLeft = Math.round(config.width * 0.25 - config.iconSize / 2);
    const iconTop = Math.round((config.height - config.iconSize) / 2);
    
    // 创建文字 SVG
    const titleSize = config.fontSize === 'large' ? 64 : 32;
    const subtitleSize = config.fontSize === 'large' ? 24 : 14;
    const textLeft = Math.round(config.width * 0.25 + config.iconSize / 2 + 30);
    const textCenterY = config.height / 2;
    
    const textSvg = `
      <svg width="${config.width}" height="${config.height}">
        <style>
          .title { fill: white; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-weight: bold; }
          .subtitle { fill: rgba(255,255,255,0.85); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; }
        </style>
        <text x="${textLeft}" y="${textCenterY - 10}" class="title" font-size="${titleSize}">Memoraid</text>
        <text x="${textLeft}" y="${textCenterY + titleSize * 0.6}" class="subtitle" font-size="${subtitleSize}">AI 网页总结 &amp; 自媒体发布助手</text>
      </svg>
    `;
    
    const textLayer = await sharp(Buffer.from(textSvg))
      .png()
      .toBuffer();
    
    // 合成最终图片
    await sharp(background)
      .composite([
        {
          input: resizedIcon,
          left: iconLeft,
          top: iconTop
        },
        {
          input: textLayer,
          left: 0,
          top: 0
        }
      ])
      .removeAlpha() // 移除 alpha 通道
      .png()
      .toFile(outputPath);
    
    console.log(`✅ 已生成: ${outputPath}`);
    
    // 验证输出
    const metadata = await sharp(outputPath).metadata();
    console.log(`   尺寸: ${metadata.width} x ${metadata.height}`);
    console.log(`   格式: ${metadata.format}`);
    console.log(`   通道: ${metadata.channels} (${metadata.channels === 3 ? '无 alpha' : '有 alpha'})`);
  }
  
  console.log('\n🎉 所有宣传图生成完成！');
}

main().catch(console.error);
