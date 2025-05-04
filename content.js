// 等待页面加载完成
document.addEventListener('yt-navigate-finish', function() {
  // 确保我们在视频页面
  if (window.location.pathname.indexOf('/watch') === 0) {
    // 等待视频播放器加载
    waitForElement('.html5-video-container', function(container) {
      addScreenshotButton();
    });
  }
});

// 监听 URL 变化，处理 YouTube 的 SPA 特性
let lastUrl = location.href; 
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    if (window.location.pathname.indexOf('/watch') === 0) {
      setTimeout(() => {
        addScreenshotButton();
      }, 1500);
    }
  }
}).observe(document, {subtree: true, childList: true});

// 辅助函数：等待元素出现
function waitForElement(selector, callback) {
  if (document.querySelector(selector)) {
    callback(document.querySelector(selector));
    return;
  }

  const observer = new MutationObserver(function(mutations) {
    if (document.querySelector(selector)) {
      observer.disconnect();
      callback(document.querySelector(selector));
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// 添加截图按钮
// 添加截图按钮
function addScreenshotButton() {
  // 检查按钮是否已存在
  if (document.getElementById('youtube-screenshot-btn')) {
    return;
  }

  // 查找 YouTube 控制栏
  const controlsBar = document.querySelector('.ytp-right-controls');
  if (!controlsBar) return;

  // 创建截图按钮
  const screenshotBtn = document.createElement('button');
  screenshotBtn.id = 'youtube-screenshot-btn';
  // 保留 ytp-button 类以获取 YouTube 的基础按钮样式、对齐和间距
  screenshotBtn.className = 'ytp-button youtube-screenshot-btn';
  screenshotBtn.title = '截取当前视频帧';

  // 获取图标文件的 URL
  const iconUrl = chrome.runtime.getURL('screenshot_btn.png');

  // 设置背景相关的样式，移除尺寸和边距相关的内联样式
  screenshotBtn.style.backgroundImage = `url('${iconUrl}')`;
  screenshotBtn.style.backgroundSize = '56%'; // 或者尝试 '70%' 等百分比值，如果 contain 效果不佳
  screenshotBtn.style.backgroundRepeat = 'no-repeat';
  screenshotBtn.style.backgroundPosition = 'center';



  // 添加点击事件
  screenshotBtn.addEventListener('click', captureScreenshot);

  // 将按钮添加到控制栏
  controlsBar.insertBefore(screenshotBtn, controlsBar.firstChild);
}

// 截取当前视频帧
function captureScreenshot() {
  const video = document.querySelector('video');
  if (!video) return;

  // 创建 canvas 元素
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  // 将视频帧绘制到 canvas
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  // --- 修改：绘制字幕 ---
  try {
    const subtitleWrapper = document.querySelector('.ytp-caption-window-container');
    if (subtitleWrapper) {
      const subtitleSegments = subtitleWrapper.querySelectorAll('.ytp-caption-segment');
      if (subtitleSegments.length > 0) {
        // 拼接所有字幕段落
        let fullSubtitleText = '';
        subtitleSegments.forEach(segment => {
          // 处理换行符，确保它们被视为空格
          fullSubtitleText += segment.textContent.replace(/(\r\n|\n|\r)/gm, " ").trim() + ' ';
        });
        fullSubtitleText = fullSubtitleText.trim();

        if (fullSubtitleText) {
          // --- 字幕样式设置 ---
          const computedStyle = window.getComputedStyle(subtitleSegments[0]); // 获取一个段落的样式作为参考
          // --- 修改 fontSize 获取逻辑 ---
          let fontSize = parseFloat(computedStyle.fontSize);
          // 如果获取失败或值为无效数字，则使用默认值 18
          if (isNaN(fontSize) || fontSize <= 0) {
            console.warn("Could not get valid font size from element, using default 18px.");
            fontSize = 18;
          }
          // --- 增加 fontSize ---
          fontSize += 6; // 在获取到的基础上增加 4px
          // --- 结束修改 fontSize 获取逻辑 ---
          const fontFamily = computedStyle.fontFamily || 'Arial, sans-serif';
          // --- 修改 fontStyle 为中等加粗 (600)，浏览器会自动处理回退 ---
          const fontStyle = `400 ${fontSize}px ${fontFamily}`; // 使用数字权重 600
          const textColor = '#FFFFFF'; // 固定为白色
          const bgColor = 'rgba(0, 0, 0, 0.75)'; // 固定为半透明黑色
          const padding = fontSize * 0.2; // 内边距
          const lineHeight = fontSize * 1.3; // 行高
          const bottomMargin = canvas.height * 0.02; // 距离底部的边距
          const maxWidth = canvas.width * 0.5; // 字幕最大宽度调整为画布的50%

          ctx.font = fontStyle;
          ctx.textAlign = 'center'; // 文本居中对齐
          ctx.fillStyle = textColor;

          // --- 文本换行处理 ---
          const lines = wrapTextForCanvas(ctx, fullSubtitleText, maxWidth);
          const textBlockHeight = lines.length * lineHeight;

          // --- 计算绘制位置 ---
          const bgHeight = textBlockHeight + padding * 2;
          const bgWidth = maxWidth + padding * 2; // 背景宽度基于最大宽度
          const bgX = (canvas.width - bgWidth) / 2;
          const bgY = canvas.height - bottomMargin - bgHeight; // 背景Y坐标

          // --- 绘制背景 ---
          ctx.fillStyle = bgColor;
          ctx.fillRect(bgX, bgY, bgWidth, bgHeight);

          // --- 绘制文字 (逐行) ---
          ctx.fillStyle = textColor; // 重新设置文字颜色
          let currentY = bgY + padding + (lineHeight - fontSize) / 2 + fontSize * 0.8; // 计算第一行文字的基线 Y 坐标
          lines.forEach(line => {
            ctx.fillText(line, canvas.width / 2, currentY);
            currentY += lineHeight; // 移动到下一行
          });
        }
      }
    }
  } catch (error) {
    console.error("Error drawing subtitles:", error);
    // 即使绘制字幕出错，也继续截图流程
  }
  // --- 结束：绘制字幕 ---

  // --- 修改：获取视频标题作为文件名 ---
  let baseFileName = 'screenshot'; // 默认基础文件名
  const titleElement = document.querySelector('h1.title yt-formatted-string') || document.querySelector('h1.title'); // Try more specific selector first
  if (titleElement) {
    // 清理标题：移除特殊字符，将空格替换为下划线
    const cleanedTitle = titleElement.textContent.trim().replace(/[^\w\s-]/gi, '').replace(/\s+/g, '_');
    // 检查清理后的标题是否为空
    if (cleanedTitle) {
      baseFileName = cleanedTitle; // 如果标题有效，则使用清理后的标题
    }
  }

  // 获取视频播放器当前时间并格式化
  const timestamp = formatTime(video.currentTime); // 使用视频当前时间
  // 组合最终文件名
  const fileName = `${baseFileName}_${timestamp}.png`; // 使用下划线连接基础名称和时间戳
  // --- 结束：获取视频标题作为文件名 ---


  // 将 canvas 转换为图片并下载
  canvas.toBlob(function(blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName; // 使用最终确定的文件名
    a.click();

    // 清理
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);
  }, 'image/png');
}

// 格式化视频时间为 HH-MM-SS
function formatTime(seconds) {
  const date = new Date(seconds * 1000);
  const hh = date.getUTCHours().toString().padStart(2, '0');
  const mm = date.getUTCMinutes().toString().padStart(2, '0');
  const ss = date.getUTCSeconds().toString().padStart(2, '0');
  return `${hh}-${mm}-${ss}`; // 使用连字符分隔
}

// 新增：获取当前系统时间并格式化为 YYYYMMDD_HHMMSS (保留，以防万一)
function getCurrentFormattedTime() {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0'); // 月份从 0 开始，需要加 1
  const day = now.getDate().toString().padStart(2, '0');
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

// 新增：Canvas 文本换行辅助函数
function wrapTextForCanvas(context, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = context.measureText(currentLine + " " + word).width;
    if (width < maxWidth) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine); // 添加最后一行
  return lines;
}