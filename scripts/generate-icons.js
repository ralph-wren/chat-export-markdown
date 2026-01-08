/**
 * 从 logo.svg 生成不同尺寸的 PNG 图标
 * 运行: node scripts/generate-icons.js
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const STORE_ASSETS_DIR = path.join(__dirname, '..', 'store-assets');
const SVG_PATH = path.join(PUBLIC_DIR, 'logo.svg');

const SIZES = [16, 48, 128];

async function generateIcons() {
  console.log('读取 SVG 文件...\n');
  
  const svgBuffer = fs.readFileSync(SVG_PATH);
  
  for (const size of SIZES) {
    const outputPath = path.join(PUBLIC_DIR, `icon-${size}.png`);
    
    try {
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(outputPath);
      
      console.log(`✅ 生成 icon-${size}.png`);
    } catch (error) {
      console.error(`❌ 生成 icon-${size}.png 失败: ${error.message}`);
    }
  }
  
  // 同时生成 store-assets 目录的 128 图标
  const storeIconPath = path.join(STORE_ASSETS_DIR, 'icon-128.png');
  try {
    await sharp(svgBuffer)
      .resize(128, 128)
      .png()
      .toFile(storeIconPath);
    
    console.log(`✅ 生成 store-assets/icon-128.png`);
  } catch (error) {
    console.error(`❌ 生成 store-assets/icon-128.png 失败: ${error.message}`);
  }
  
  console.log('\n图标生成完成！');
}

generateIcons().catch(console.error);
