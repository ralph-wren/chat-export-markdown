import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const storeAssetsDir = path.join(__dirname, '..', 'store-assets');
  
  // 先获取 screenshot-1.png 的尺寸信息
  const referenceImage = path.join(storeAssetsDir, 'screenshot-1.png');
  const sourceImage = path.join(storeAssetsDir, 'image copy 2.png');
  const outputImage = path.join(storeAssetsDir, 'screenshot-new.png');
  
  try {
    // 获取参考图片的元数据
    const refMetadata = await sharp(referenceImage).metadata();
    console.log('参考图片 (screenshot-1.png) 信息:');
    console.log(`  尺寸: ${refMetadata.width} x ${refMetadata.height}`);
    console.log(`  格式: ${refMetadata.format}`);
    
    // 获取源图片的元数据
    const srcMetadata = await sharp(sourceImage).metadata();
    console.log('\n源图片 (image copy 2.png) 信息:');
    console.log(`  尺寸: ${srcMetadata.width} x ${srcMetadata.height}`);
    console.log(`  格式: ${srcMetadata.format}`);
    
    // 将源图片调整为与参考图片相同的尺寸
    console.log(`\n正在将图片调整为 ${refMetadata.width} x ${refMetadata.height}...`);
    
    await sharp(sourceImage)
      .resize(refMetadata.width, refMetadata.height, {
        fit: 'contain',  // 保持比例，不裁剪
        background: { r: 255, g: 255, b: 255, alpha: 1 }  // 白色背景填充
      })
      .png()
      .toFile(outputImage);
    
    console.log(`\n✅ 处理完成！输出文件: ${outputImage}`);
    
    // 验证输出
    const outMetadata = await sharp(outputImage).metadata();
    console.log(`\n输出图片信息:`);
    console.log(`  尺寸: ${outMetadata.width} x ${outMetadata.height}`);
    console.log(`  格式: ${outMetadata.format}`);
    
  } catch (error) {
    console.error('处理失败:', error.message);
    process.exit(1);
  }
}

main();
