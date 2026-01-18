/**
 * 微博图片获取调试脚本
 * 
 * 使用方法：
 * 1. 打开微博页面（包含图片的页面）
 * 2. 在浏览器控制台粘贴此脚本并执行
 * 3. 脚本会自动分析页面上的所有图片并测试获取
 */
(function() {
  console.clear();
  console.log('%c=== 微博图片获取调试工具 ===', 'color: #00ff88; font-size: 16px; font-weight: bold;');
  
  // 创建调试面板
  const panelStyle = `
    position: fixed;
    top: 10px;
    right: 10px;
    width: 400px;
    max-height: 80vh;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border: 2px solid #00d9ff;
    border-radius: 12px;
    padding: 20px;
    z-index: 2147483647;
    font-family: 'Segoe UI', system-ui, sans-serif;
    color: #e8e8e8;
    box-shadow: 0 8px 32px rgba(0, 217, 255, 0.3);
    overflow-y: auto;
  `;

  const panel = document.createElement('div');
  panel.id = 'weibo-image-debug';
  panel.innerHTML = `
    <div style="${panelStyle}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <span style="font-size:16px;font-weight:bold;color:#00d9ff;">🖼️ 微博图片调试</span>
        <button id="wid-close" style="background:none;border:none;color:#888;font-size:20px;cursor:pointer;">×</button>
      </div>
      
      <div style="margin-bottom:16px;">
        <button id="wid-scan" style="width:100%;padding:12px;background:linear-gradient(135deg,#00d9ff,#0099ff);border:none;border-radius:8px;color:white;font-size:14px;font-weight:600;cursor:pointer;">
          🔍 扫描页面图片
        </button>
      </div>
      
      <div id="wid-stats" style="display:none;background:rgba(0,217,255,0.1);padding:12px;border-radius:8px;margin-bottom:16px;font-size:13px;">
        <div>找到图片: <strong id="wid-count">0</strong></div>
        <div>微博图片: <strong id="wid-weibo-count">0</strong></div>
      </div>
      
      <div id="wid-images" style="max-height:400px;overflow-y:auto;"></div>
      
      <div id="wid-log" style="margin-top:16px;font-size:11px;max-height:200px;overflow-y:auto;background:rgba(0,0,0,0.3);border-radius:6px;padding:10px;font-family:Consolas,monospace;"></div>
    </div>
  `;
  document.body.appendChild(panel);

  const closeBtn = document.getElementById('wid-close');
  const scanBtn = document.getElementById('wid-scan');
  const statsEl = document.getElementById('wid-stats');
  const countEl = document.getElementById('wid-count');
  const weiboCountEl = document.getElementById('wid-weibo-count');
  const imagesEl = document.getElementById('wid-images');
  const logEl = document.getElementById('wid-log');

  // 日志函数
  function log(msg, type = 'info') {
    const colors = { info: '#00d9ff', success: '#00ff88', error: '#ff6b6b', warn: '#ffcc00' };
    const time = new Date().toLocaleTimeString();
    logEl.innerHTML += `<div style="color:${colors[type]};margin:4px 0;">[${time}] ${msg}</div>`;
    logEl.scrollTop = logEl.scrollHeight;
    console.log(`[WeiboImageDebug] ${msg}`);
  }

  closeBtn.onclick = () => {
    panel.remove();
    log('调试面板已关闭');
  };

  // 扫描页面图片
  scanBtn.onclick = async () => {
    log('开始扫描页面图片...', 'info');
    imagesEl.innerHTML = '<div style="text-align:center;padding:20px;color:#888;">扫描中...</div>';
    
    // 查找所有图片
    const allImages = Array.from(document.querySelectorAll('img'));
    log(`找到 ${allImages.length} 个 <img> 标签`, 'info');
    
    // 过滤微博图片
    const weiboImages = allImages.filter(img => {
      const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-original') || '';
      return src.includes('sinaimg.cn');
    });
    
    log(`其中 ${weiboImages.length} 个是微博图片`, 'success');
    
    countEl.textContent = allImages.length;
    weiboCountEl.textContent = weiboImages.length;
    statsEl.style.display = 'block';
    
    if (weiboImages.length === 0) {
      imagesEl.innerHTML = '<div style="text-align:center;padding:20px;color:#ff6b6b;">未找到微博图片</div>';
      return;
    }
    
    // 显示图片列表
    imagesEl.innerHTML = '';
    for (let i = 0; i < Math.min(weiboImages.length, 10); i++) {
      const img = weiboImages[i];
      const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-original') || '';
      
      const card = document.createElement('div');
      card.style.cssText = 'background:rgba(0,0,0,0.3);padding:12px;border-radius:8px;margin-bottom:12px;';
      card.innerHTML = `
        <div style="font-size:12px;color:#00d9ff;margin-bottom:8px;">图片 ${i + 1}</div>
        <div style="font-size:10px;color:#888;word-break:break-all;margin-bottom:8px;">${src.substring(0, 80)}...</div>
        <button class="test-btn" data-index="${i}" data-src="${src}" style="width:100%;padding:8px;background:linear-gradient(135deg,#00ff88,#00cc66);border:none;border-radius:6px;color:#1a1a2e;font-size:12px;font-weight:600;cursor:pointer;">
          测试获取
        </button>
        <div class="test-result" id="result-${i}" style="margin-top:8px;font-size:11px;display:none;"></div>
      `;
      imagesEl.appendChild(card);
    }
    
    // 绑定测试按钮
    document.querySelectorAll('.test-btn').forEach(btn => {
      btn.onclick = () => testImage(btn.dataset.index, btn.dataset.src);
    });
  };

  // 测试单个图片
  async function testImage(index, url) {
    const resultEl = document.getElementById(`result-${index}`);
    resultEl.style.display = 'block';
    resultEl.innerHTML = '<div style="color:#ffcc00;">⏳ 测试中...</div>';
    
    log(`测试图片 ${parseInt(index) + 1}: ${url.substring(0, 60)}...`, 'info');
    
    // 测试方法 1: 直接访问
    log('方法1: 直接访问', 'info');
    const result1 = await testDirectFetch(url);
    
    // 测试方法 2: 使用代理
    log('方法2: 使用 weserv.nl 代理', 'info');
    const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(url.replace(/^https?:\/\//, ''))}`;
    const result2 = await testDirectFetch(proxyUrl);
    
    // 测试方法 3: 使用 Image 对象
    log('方法3: 使用 Image 对象', 'info');
    const result3 = await testImageLoad(url);
    
    // 显示结果
    let html = '<div style="padding:8px;background:rgba(0,0,0,0.3);border-radius:4px;">';
    html += `<div style="color:${result1.success ? '#00ff88' : '#ff6b6b'};margin:4px 0;">直接访问: ${result1.message}</div>`;
    html += `<div style="color:${result2.success ? '#00ff88' : '#ff6b6b'};margin:4px 0;">代理访问: ${result2.message}</div>`;
    html += `<div style="color:${result3.success ? '#00ff88' : '#ff6b6b'};margin:4px 0;">Image加载: ${result3.message}</div>`;
    html += '</div>';
    
    if (result3.success && result3.dataUrl) {
      html += `<img src="${result3.dataUrl}" style="width:100%;margin-top:8px;border-radius:4px;">`;
    }
    
    resultEl.innerHTML = html;
    
    if (result1.success || result2.success || result3.success) {
      log(`图片 ${parseInt(index) + 1} 测试成功`, 'success');
    } else {
      log(`图片 ${parseInt(index) + 1} 所有方法均失败`, 'error');
    }
  }

  // 测试直接 fetch
  async function testDirectFetch(url) {
    try {
      const response = await fetch(url, {
        mode: 'no-cors',
        cache: 'no-store',
        credentials: 'omit'
      });
      
      // no-cors 模式下无法读取响应内容，但可以判断是否成功
      return {
        success: response.type === 'opaque',
        message: `${response.type} (无法读取内容)`
      };
    } catch (e) {
      return {
        success: false,
        message: `失败: ${e.message}`
      };
    }
  }

  // 测试 Image 对象加载
  async function testImageLoad(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      const timeout = setTimeout(() => {
        resolve({
          success: false,
          message: '超时（5秒）'
        });
      }, 5000);
      
      img.onload = () => {
        clearTimeout(timeout);
        
        // 尝试转换为 canvas
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          
          resolve({
            success: true,
            message: `成功 ${img.width}x${img.height} (${(dataUrl.length / 1024).toFixed(1)}KB)`,
            dataUrl: dataUrl
          });
        } catch (e) {
          resolve({
            success: true,
            message: `加载成功但无法转换: ${e.message}`
          });
        }
      };
      
      img.onerror = () => {
        clearTimeout(timeout);
        resolve({
          success: false,
          message: '加载失败'
        });
      };
      
      img.src = url;
    });
  }

  log('调试面板已就绪', 'success');
  log('点击"扫描页面图片"开始', 'info');
  
  // 自动扫描
  setTimeout(() => {
    scanBtn.click();
  }, 500);
  
  // 暴露全局对象供控制台使用
  window.memoraidDebug = {
    log,
    testImage,
    panel,
    close: () => panel.remove()
  };
  
  console.log('%c调试工具已加载！', 'color: #00ff88; font-size: 14px; font-weight: bold;');
  console.log('%c使用 memoraidDebug 对象进行调试', 'color: #00d9ff; font-size: 12px;');
})();
