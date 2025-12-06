#!/usr/bin/env node

/**
 * Substack 下载器
 * 自动下载任意 Substack 站点的所有文章并生成 PDF
 * 
 * 使用方法:
 *   ./substack_downloader.js <substack_url> [options]
 * 
 * 示例:
 *   ./substack_downloader.js https://stratechery.com
 *   ./substack_downloader.js https://example.substack.com --skip-compress
 */

import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

// 获取当前脚本所在目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 解析命令行参数
const args = process.argv.slice(2);
if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log(`
📚 Substack 下载器 - 下载任意 Substack 站点的所有文章

使用方法:
  ./substack_downloader.js <substack_url> [options]

参数:
  substack_url          Substack 站点的 URL

选项:
  --output-dir <dir>    输出目录 (默认: ./downloads/<站点名>)
  --skip-compress       跳过 PDF 压缩
  --quality <level>     压缩质量: screen, ebook, printer, prepress (默认: ebook)
  --help, -h           显示此帮助信息

⚠️  首次使用:
  1. 先运行: node src/start.js --profile
  2. 在打开的浏览器中登录 Substack 站点
  3. 关闭浏览器后再运行本下载器

示例:
  ./substack_downloader.js https://stratechery.com
  ./substack_downloader.js https://example.substack.com --output-dir ./my_pdfs
  ./substack_downloader.js https://blog.substack.com --quality printer
  `);
  process.exit(0);
}

const substackUrl = args[0];
const skipCompress = args.includes('--skip-compress');
const outputDirIndex = args.indexOf('--output-dir');
const qualityIndex = args.indexOf('--quality');

const compressionQuality = qualityIndex !== -1 && args[qualityIndex + 1] 
  ? args[qualityIndex + 1] 
  : 'ebook';

// 从 URL 提取站点名称
function getSiteName(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    // 移除 www. 和 .substack.com 或其他域名后缀
    let siteName = hostname.replace(/^www\./, '').replace(/\.(substack\.)?com$/, '');
    return siteName.replace(/[^a-zA-Z0-9-]/g, '_');
  } catch (e) {
    return 'substack_site';
  }
}

const siteName = getSiteName(substackUrl);
const defaultOutputDir = path.join(process.cwd(), 'downloads', siteName);
const outputDir = outputDirIndex !== -1 && args[outputDirIndex + 1]
  ? args[outputDirIndex + 1]
  : defaultOutputDir;

console.log(`
╔════════════════════════════════════════════════════════════╗
║              📚 Substack 下载器                            ║
╚════════════════════════════════════════════════════════════╝

🌐 目标站点: ${substackUrl}
📁 输出目录: ${outputDir}
${skipCompress ? '⚠️  跳过压缩' : `🗜️  压缩质量: ${compressionQuality}`}

`);

// 创建输出目录
fs.mkdirSync(outputDir, { recursive: true });
const pdfDir = path.join(outputDir, 'pdfs');
fs.mkdirSync(pdfDir, { recursive: true });

// 连接到 Chrome
console.log('🔌 连接到 Chrome...');
const browser = await puppeteer.connect({
  browserURL: "http://localhost:9222",
  defaultViewport: null,
});

const pages = await browser.pages();
const page = pages[0];

// 强制使用亮色模式和屏幕媒体，避免打印出暗色背景
await page.emulateMediaType('screen');
await page.emulateMediaFeatures([
  { name: 'prefers-color-scheme', value: 'light' },
]);

// 步骤1: 导航到站点并收集文章
console.log(`\n📍 步骤 1/5: 访问站点并加载所有文章...`);

// 尝试访问 Archive 页面（通常能显示所有文章）
let archiveUrl = substackUrl;
try {
  const urlObj = new URL(substackUrl);
  archiveUrl = `${urlObj.origin}/archive`;
  console.log(`   🔍 尝试访问归档页面: ${archiveUrl}`);
  await page.goto(archiveUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  console.log('   ✓ 成功访问归档页面');
} catch (e) {
  console.log('   ⚠️  归档页面不可用，使用主页');
  await page.goto(substackUrl, { waitUntil: 'networkidle2' });
}

// 点击 Latest 标签（如果存在）
try {
  const latestButton = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const latest = buttons.find(b => b.textContent.trim() === 'Latest');
    if (latest) {
      latest.click();
      return true;
    }
    return false;
  });
  
  if (latestButton) {
    await new Promise(r => setTimeout(r, 2000));
    console.log('   ✓ 切换到 Latest 标签');
  }
} catch (e) {
  // Latest 标签可能不存在，继续
}

// 自动滚动加载所有文章（使用更激进的策略）
console.log('   📜 滚动加载所有文章（这可能需要几分钟）...');
const scrollResult = await page.evaluate(async () => {
  let lastArticleCount = 0;
  let currentArticleCount = 0;
  let unchangedCount = 0;
  let scrollAttempts = 0;
  const maxScrollAttempts = 300; // 进一步增加最大滚动次数
  
  console.log('   开始滚动加载...');
  
  while (scrollAttempts < maxScrollAttempts) {
    // 滚动到最底部
    window.scrollTo(0, document.body.scrollHeight);
    
    // 等待5秒让内容充分加载
    await new Promise(r => setTimeout(r, 5000));
    
    currentArticleCount = document.querySelectorAll('a[href*="/p/"]').length;
    
    // 每5次滚动输出一次进度
    if (scrollAttempts % 5 === 0) {
      console.log(`   ... 滚动 ${scrollAttempts} 次, 当前 ${currentArticleCount} 个链接`);
    }
    
    if (currentArticleCount === lastArticleCount) {
      unchangedCount++;
      // 连续15次没有新文章才停止（非常保守的策略）
      if (unchangedCount >= 15) {
        console.log(`   连续 ${unchangedCount} 次没有变化，停止滚动`);
        break;
      }
    } else {
      unchangedCount = 0;
    }
    
    lastArticleCount = currentArticleCount;
    scrollAttempts++;
  }
  
  // 获取最后一篇文章的日期
  const times = Array.from(document.querySelectorAll('time'));
  const lastDate = times.length > 0 ? times[times.length - 1].getAttribute('datetime') : '';
  
  console.log(`   滚动完成: ${scrollAttempts} 次滚动, ${currentArticleCount} 个链接`);
  
  return {
    articleCount: currentArticleCount,
    scrollAttempts: scrollAttempts,
    lastArticleDate: lastDate
  };
});

console.log(`   ✓ 滚动完成: ${scrollResult.scrollAttempts} 次，找到 ${scrollResult.articleCount} 个链接`);
if (scrollResult.lastArticleDate) {
  const lastDate = new Date(scrollResult.lastArticleDate);
  console.log(`   ✓ 最早文章日期: ${lastDate.toLocaleDateString('zh-CN')}`);
}

// 提取所有文章 URL（去重）
const articles = await page.evaluate(() => {
  const urlSet = new Set();
  document.querySelectorAll('a[href*="/p/"]').forEach(link => {
    const url = link.href;
    // 只保留文章页面，排除查询参数和锚点
    if (url.includes('/p/') && !url.includes('?') && !url.includes('#')) {
      urlSet.add(url);
    }
  });
  return Array.from(urlSet);
});

console.log(`   ✓ 提取到 ${articles.length} 篇独立文章`);

// 显示一些样本文章
if (articles.length > 0) {
  console.log(`   📝 最新3篇:`);
  articles.slice(-3).reverse().forEach((url, idx) => {
    const title = url.split('/p/')[1] || 'unknown';
    console.log(`      ${idx + 1}. ${title}`);
  });
  if (articles.length > 3) {
    console.log(`      ... 还有 ${articles.length - 3} 篇`);
  }
}
console.log('');

// 保存文章列表
const articlesFile = path.join(outputDir, 'articles.txt');
fs.writeFileSync(articlesFile, articles.reverse().join('\n'));
console.log(`   ✓ 文章列表已保存: ${articlesFile}\n`);

// 步骤2: 获取站点标题
console.log(`📍 步骤 2/5: 获取站点信息...`);
const siteTitle = await page.evaluate(() => {
  return document.querySelector('h1, [class*="publication-name"]')?.textContent?.trim() 
    || document.title 
    || 'Substack Publication';
});
console.log(`   ✓ 站点标题: ${siteTitle}\n`);

// 步骤3: 打印所有文章为 PDF
console.log(`📍 步骤 3/5: 打印 ${articles.length} 篇文章为 PDF...`);
console.log(`   ⏱️  预计需要 ${Math.ceil(articles.length * 4 / 60)} 分钟\n`);

const completed = [];
const failed = [];
let skipped = 0;

for (let i = 0; i < articles.length; i++) {
  const url = articles[i].trim();
  if (!url) continue;
  
  try {
    const articleName = url.split('/p/')[1] || `article_${i + 1}`;
    const pdfPath = path.join(pdfDir, `${String(i + 1).padStart(3, '0')}_${articleName}.pdf`);
    
    if (fs.existsSync(pdfPath)) {
      if (i % 10 === 0 || skipped === 0) {
        console.log(`   ⏭️  [${i + 1}/${articles.length}] 已存在，跳过`);
      }
      completed.push({ index: i + 1, url, status: 'skipped' });
      skipped++;
      continue;
    }
    
    const progress = ((i + 1) / articles.length * 100).toFixed(1);
    console.log(`   📄 [${i + 1}/${articles.length}] (${progress}%) ${articleName.slice(0, 50)}${articleName.length > 50 ? '...' : ''}`);
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('article, main, [class*="post"]', { timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    // 处理懒加载图片并确保加载完成，避免 PDF 中缺图
    await page.evaluate(async () => {
      const imgs = Array.from(document.querySelectorAll('img'));

      // 将懒加载属性写回 src/srcset，强制提前加载
      for (const img of imgs) {
        const dataSrc = img.getAttribute('data-src') || img.dataset?.src;
        const dataSrcset = img.getAttribute('data-srcset') || img.dataset?.srcset;
        const cfSrc = img.getAttribute('data-cfsrc');
        if (!img.src && (dataSrc || cfSrc)) img.src = dataSrc || cfSrc;
        if (!img.srcset && dataSrcset) img.srcset = dataSrcset;
        img.loading = 'eager';
        img.decoding = 'sync';
      }

      // 触发懒加载：快速滚动一遍页面
      const step = 800;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 120));
      }
      window.scrollTo(0, 0);

      // 等待所有图片完成加载/解码，防止空白占位
      await Promise.all(
        imgs.map((img) => {
          if (img.complete && img.naturalWidth > 0) return Promise.resolve();
          return new Promise((res) => {
            const done = () => res();
            img.addEventListener('load', done, { once: true });
            img.addEventListener('error', done, { once: true });
          });
        }),
      );
    });

    // 关闭夜间模式，保持白底黑字（不改动其他打印样式）
    await page.evaluate(() => {
      const STYLE_ID = '__substack_dl_light_mode__';
      if (!document.getElementById(STYLE_ID)) {
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
          :root { color-scheme: light !important; }
          html, body { background: #ffffff !important; color: #000000 !important; }
          article, main, [class*="post"], [data-theme], [class*="dark"], [class*="night"] {
            background: #ffffff !important;
            color: #000000 !important;
          }
          pre, code, pre code, code pre, [class*="code"], [class*="highlight"], [class*="monospace"] {
            background: #f5f5f5 !important;
            color: #111111 !important;
            border-radius: 6px !important;
          }
        `;
        document.head.appendChild(style);
      }

      const targets = [document.documentElement, document.body];
      for (const el of targets) {
        if (!el) continue;
        el.classList.remove('dark', 'night-mode');
        el.removeAttribute('data-theme');
        el.style.setProperty('background', '#ffffff', 'important');
        el.style.setProperty('color', '#000000', 'important');
        el.style.setProperty('color-scheme', 'light', 'important');
      }

      const metaTheme = document.querySelector('meta[name="theme-color"]');
      if (metaTheme) metaTheme.setAttribute('content', '#ffffff');
    });

    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' }
    });
    
    completed.push({ index: i + 1, url, path: pdfPath });
    await new Promise(r => setTimeout(r, 1000));
    
  } catch (error) {
    console.error(`   ❌ [${i + 1}/${articles.length}] 失败: ${error.message}`);
    failed.push({ index: i + 1, url, error: error.message });
    await new Promise(r => setTimeout(r, 3000));
  }
}

if (skipped > 0) {
  console.log(`\n   ℹ️  跳过了 ${skipped} 个已存在的PDF文件`);
}

await browser.disconnect();

console.log(`\n   ✓ PDF 打印完成: ${completed.length}/${articles.length} 成功\n`);

// 步骤4: 合并 PDF
console.log(`📍 步骤 4/5: 合并 PDF 并生成目录...`);
const mergedPdfPath = path.join(outputDir, `${siteName}_complete.pdf`);

// 调用 Python 合并脚本
await new Promise((resolve, reject) => {
  const pythonScript = path.join(__dirname, 'merge_pdfs.py');
  const pythonProcess = spawn('uv', ['run', '--with', 'PyPDF2', 'python', pythonScript], {
    cwd: outputDir,
    env: { 
      ...process.env,
      PDF_DIR: pdfDir,
      OUTPUT_FILE: mergedPdfPath
    }
  });
  
  pythonProcess.stdout.on('data', (data) => {
    process.stdout.write(`   ${data}`);
  });
  
  pythonProcess.stderr.on('data', (data) => {
    process.stderr.write(`   ${data}`);
  });
  
  pythonProcess.on('close', (code) => {
    if (code === 0) {
      resolve();
    } else {
      reject(new Error(`合并失败，退出码: ${code}`));
    }
  });
});

// 检查文件大小
const stats = fs.statSync(mergedPdfPath);
const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
console.log(`   ✓ 合并完成: ${mergedPdfPath} (${sizeMB} MB)\n`);

// 步骤5: 压缩 PDF（可选）
if (!skipCompress) {
  console.log(`📍 步骤 5/5: 压缩 PDF (质量: ${compressionQuality})...`);
  const compressedPdfPath = path.join(outputDir, `${siteName}_compressed.pdf`);
  
  await new Promise((resolve, reject) => {
    const compressScript = path.join(__dirname, 'compress_pdf.py');
    const pythonProcess = spawn('python3', [
      compressScript,
      mergedPdfPath,
      compressedPdfPath,
      compressionQuality
    ]);
    
    pythonProcess.stdout.on('data', (data) => {
      process.stdout.write(`   ${data}`);
    });
    
    pythonProcess.stderr.on('data', (data) => {
      process.stderr.write(`   ${data}`);
    });
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        console.warn(`   ⚠️  压缩失败，但原始文件已保存`);
        resolve();
      }
    });
  });
} else {
  console.log(`📍 步骤 5/5: 跳过压缩\n`);
}

// 完成
const finalStats = skipCompress ? 
  fs.statSync(mergedPdfPath) : 
  fs.existsSync(path.join(outputDir, `${siteName}_compressed.pdf`)) ?
    fs.statSync(path.join(outputDir, `${siteName}_compressed.pdf`)) : 
    fs.statSync(mergedPdfPath);

const finalSizeMB = (finalStats.size / (1024 * 1024)).toFixed(2);

console.log(`
╔════════════════════════════════════════════════════════════╗
║                   ✅ 下载完成！                            ║
╚════════════════════════════════════════════════════════════╝

📊 统计信息:
   站点: ${siteTitle}
   文章总数: ${articles.length}
   成功下载: ${completed.length - skipped}
   已存在(跳过): ${skipped}
   失败: ${failed.length}
   成功率: ${((completed.length / articles.length) * 100).toFixed(1)}%
   
📁 输出文件:
   ${skipCompress ? '完整版' : '压缩版'}: ${skipCompress ? mergedPdfPath : path.join(outputDir, `${siteName}_compressed.pdf`)}
   文件大小: ${finalSizeMB} MB
   ${skipCompress ? '' : '原始版: ' + mergedPdfPath}
   输出目录: ${outputDir}
   
📑 目录书签: ${articles.length} 个
💡 提示: 打开 PDF 后可在左侧看到文章目录书签，方便快速导航
`);

if (failed.length > 0) {
  console.log(`\n⚠️  失败的文章 (${failed.length}):`);
  failed.slice(0, 5).forEach(f => {
    console.log(`   - [${f.index}] ${f.url.split('/p/')[1]}`);
  });
  if (failed.length > 5) {
    console.log(`   ... 还有 ${failed.length - 5} 个失败`);
  }
}

console.log('');

