/**
 * EPUB 生成器
 * 参考 Substack2Epub 项目，使用 Puppeteer 替代 Playwright
 */

import Epub from "epub-gen";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import crypto from "crypto";
import sharp from "sharp";

const IMAGE_EXTENSION_BY_CONTENT_TYPE = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "image/avif": ".avif",
  "image/bmp": ".bmp",
};

const SUPPORTED_IMAGE_EXTENSIONS = new Set(Object.values(IMAGE_EXTENSION_BY_CONTENT_TYPE));
const KINDLE_MAX_IMAGE_WIDTH = 1200;
const KINDLE_JPEG_QUALITY = 82;

// 默认 EPUB 样式，偏 Kindle 阅读优化
const DEFAULT_EPUB_CSS = `
  body {
    font-family: Georgia, "Times New Roman", serif;
    line-height: 1.65;
    color: #111111;
    padding: 0;
    margin: 0;
    background: #ffffff;
  }

  .chapter {
    margin: 0 auto;
    max-width: 42em;
    padding: 0.2em 0.4em 1.2em;
  }

  .chapter-header {
    margin: 0.2em 0 1.1em;
  }

  .chapter-index {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 0.76em;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #666;
    margin-bottom: 0.75em;
  }

  .post-title {
    font-size: 1.85em;
    line-height: 1.28;
    margin: 0;
    color: #111;
    font-weight: 700;
  }

  .post-subtitle {
    margin-top: 0.45em;
    margin-bottom: 0.2em;
    font-size: 1.06em;
    line-height: 1.5;
    color: #3f3f3f;
    font-style: italic;
  }
  
  h1, h2, h3, h4, h5, h6 {
    color: #181818;
    margin: 1.35em 0 0.48em;
    line-height: 1.3;
  }
  
  h1 { font-size: 1.7em; }
  h2 { font-size: 1.42em; }
  h3 { font-size: 1.24em; }
  h4 { font-size: 1.08em; }
  
  p {
    margin: 0.62em 0;
    line-height: 1.65;
  }
  
  img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 0.95em auto;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  
  pre {
    background: #f5f5f5;
    border-radius: 4px;
    border: 1px solid #e2e2e2;
    padding: 0.85em 0.95em;
    overflow-x: auto;
    margin: 0.95em 0;
    line-height: 1.45;
    font-size: 0.9em;
  }
  
  code {
    background: #f3f3f3;
    border-radius: 2px;
    padding: 0.1em 0.3em;
    font-family: "Courier New", monospace;
    font-size: 0.92em;
  }
  
  pre code {
    background: transparent;
    padding: 0;
    font-size: inherit;
  }
  
  blockquote {
    border-left: 3px solid #777;
    padding-left: 0.85em;
    color: #444;
    margin: 0.9em 1.1em;
    font-style: italic;
  }
  
  a {
    color: #004c9a;
    text-decoration: none;
    word-break: break-word;
  }
  
  a:hover {
    text-decoration: underline;
  }
  
  ul, ol {
    margin: 0.9em 0;
    padding-left: 1.55em;
  }
  
  li {
    margin: 0.34em 0;
  }
  
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 0.95em 0;
    font-size: 0.95em;
  }
  
  th, td {
    border: 1px solid #ddd;
    padding: 0.46em;
    text-align: left;
    vertical-align: top;
  }
  
  th {
    background-color: #f2f2f2;
    font-weight: bold;
  }
  
  .article-meta {
    color: #666;
    font-size: 0.86em;
    margin-top: 0.65em;
  }
  
  .article-meta .meta-item {
    margin: 0.16em 0;
  }

  .post-divider {
    border: none;
    border-top: 1px solid #d6d6d6;
    margin: 1em 0 1.35em;
  }

  .article-content {
    font-size: 1.02em;
  }

  .article-content > :first-child {
    margin-top: 0;
  }

  .article-content > :last-child {
    margin-bottom: 0;
  }
`;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * EPUB 生成器类
 */
export class EpubGenerator {
  constructor(siteName, siteTitle, outputDir) {
    this.siteName = siteName;
    this.siteTitle = siteTitle;
    this.outputDir = outputDir;
    this.cacheDir = path.join(outputDir, '.cache');
    this.imagesDir = path.join(this.cacheDir, 'images');
    
    // 创建缓存目录
    fs.mkdirSync(this.cacheDir, { recursive: true });
    fs.mkdirSync(this.imagesDir, { recursive: true });
    
    this.imageCache = new Map(); // key(URL/规范化URL) -> { localPath, fileUrl }
    this.imagePage = null;
  }

  getCacheKeyForImage(rawUrl) {
    if (!rawUrl) return "";

    try {
      const parsed = new URL(rawUrl);
      parsed.hash = "";

      // 去掉常见 tracking 参数
      const trackingParams = [
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_term",
        "utm_content",
        "fbclid",
        "gclid",
        "mc_cid",
        "mc_eid",
      ];
      for (const key of trackingParams) {
        parsed.searchParams.delete(key);
      }

      // 对 Substack/CDN 常见变体参数做归一化，提升去重命中
      const host = parsed.hostname.toLowerCase();
      if (host.includes("substack") || host.includes("substackcdn")) {
        const transformParams = [
          "w",
          "h",
          "width",
          "height",
          "fit",
          "crop",
          "q",
          "quality",
          "fm",
          "format",
          "dpr",
          "auto",
          "s",
        ];
        for (const key of transformParams) {
          parsed.searchParams.delete(key);
        }
      }

      return parsed.toString();
    } catch {
      return rawUrl;
    }
  }

  getCachedImageForUrl(url) {
    if (!url) return null;
    return this.imageCache.get(url) || this.imageCache.get(this.getCacheKeyForImage(url)) || null;
  }

  setCachedImageForUrl(url, cachedImage) {
    if (!url || !cachedImage) return;
    this.imageCache.set(url, cachedImage);
    const normalizedKey = this.getCacheKeyForImage(url);
    if (normalizedKey) {
      this.imageCache.set(normalizedKey, cachedImage);
    }
  }

  /**
   * 从页面抽取文章内容（保持原始样式）
   */
  async extractArticleContent(page, articleUrl) {
    try {
      const articleData = await page.evaluate((url, siteTitleHint) => {
        const parseSrcsetCandidates = (srcset) => {
          if (!srcset) return [];

          // srcset 不能直接按 "," 拆分，Substack CDN URL 参数本身包含逗号
          return srcset
            .split(/,\s+/)
            .map(item => item.trim().split(/\s+/)[0]?.trim())
            .filter(Boolean);
        };

        const normalizeImageUrl = (rawSrc) => {
          if (!rawSrc) return '';
          const src = rawSrc.trim();
          if (!src || src.startsWith('data:')) return '';

          try {
            if (src.startsWith('//')) {
              return `https:${src}`;
            }
            return new URL(src, window.location.href).toString();
          } catch {
            return '';
          }
        };

        const normalizeText = (value) => (value || '').replace(/\s+/g, ' ').trim();

        const decodeEntities = (value) => {
          if (!value) return '';
          const textarea = document.createElement('textarea');
          textarea.innerHTML = value;
          return textarea.value;
        };

        const isPublicationTitle = (value) => {
          const normalized = normalizeText(value).toLowerCase();
          const siteTitle = normalizeText(siteTitleHint).toLowerCase();
          if (!normalized) return true;
          if (siteTitle && normalized === siteTitle) return true;
          if (/^(home|substack)$/.test(normalized)) return true;
          return false;
        };

        const cleanupTitleCandidate = (value) => {
          let title = normalizeText(decodeEntities(value));
          if (!title) return '';

          const siteTitle = normalizeText(siteTitleHint).toLowerCase();
          if (siteTitle) {
            const parts = title.split(/\s+[|｜·•\-–—]\s+/);
            if (parts.length > 1) {
              const tail = normalizeText(parts[parts.length - 1]).toLowerCase();
              if (tail === siteTitle || tail.includes('substack')) {
                title = normalizeText(parts.slice(0, -1).join(' - '));
              }
            }
          }

          return isPublicationTitle(title) ? '' : title;
        };

        const titleFromUrlSlug = (rawUrl) => {
          try {
            const parsed = new URL(rawUrl, window.location.origin);
            const slug = parsed.pathname.split('/p/')[1] || '';
            const base = decodeURIComponent(slug.split('/')[0] || '')
              .replace(/[-_]+/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            if (!base) return '';
            return base
              .split(' ')
              .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
              .join(' ');
          } catch {
            return '';
          }
        };

        const extractHeadlineFromJsonLd = () => {
          const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));

          const enqueueNode = (queue, node) => {
            if (!node) return;
            if (Array.isArray(node)) {
              node.forEach((item) => enqueueNode(queue, item));
              return;
            }
            queue.push(node);
          };

          for (const script of scripts) {
            try {
              const parsed = JSON.parse(script.textContent || '{}');
              const queue = [];
              enqueueNode(queue, parsed);

              while (queue.length > 0) {
                const node = queue.shift();
                if (!node || typeof node !== 'object') continue;

                if (typeof node.headline === 'string' && node.headline.trim()) {
                  return node.headline.trim();
                }
                if (typeof node.name === 'string' && node.name.trim()) {
                  return node.name.trim();
                }

                enqueueNode(queue, node['@graph']);
                enqueueNode(queue, node.mainEntity);
                enqueueNode(queue, node.mainEntityOfPage);
              }
            } catch {
              // ignore malformed JSON-LD
            }
          }
          return '';
        };

        const pickArticleTitle = () => {
          const candidates = [];
          const push = (value) => {
            const cleaned = cleanupTitleCandidate(value);
            if (cleaned && !candidates.includes(cleaned)) {
              candidates.push(cleaned);
            }
          };

          push(document.querySelector('[data-testid="post-title"]')?.textContent);
          push(document.querySelector('h1.post-title, h1[class*="post-title"]')?.textContent);
          push(document.querySelector('article [role="region"][aria-label="Post header"] h1')?.textContent);
          push(document.querySelector('[aria-label="Post"] article h1')?.textContent);
          push(document.querySelector('article h1')?.textContent);
          push(document.querySelector('meta[property="og:title"]')?.getAttribute('content'));
          push(document.querySelector('meta[name="twitter:title"]')?.getAttribute('content'));
          push(extractHeadlineFromJsonLd());
          push(document.title);
          push(titleFromUrlSlug(url));

          return candidates[0] || 'Untitled';
        };

        const isLikelyNonContentImage = (img) => {
          const lower = (value) => (value || '').toLowerCase();
          const alt = lower(img.getAttribute('alt'));
          const classHint = lower(`${img.className || ''} ${img.id || ''}`);
          const srcHint = lower(
            img.getAttribute('src') ||
            img.getAttribute('data-src') ||
            img.getAttribute('data-cfsrc') ||
            ''
          );

          // 常见站点装饰图：logo/avatar/icon/profile
          if (/(logo|avatar|icon|favicon|profile|badge)/.test(alt)) return true;
          if (/(logo|avatar|icon|favicon|profile|badge|author-photo|publication-logo|site-logo)/.test(classHint)) return true;
          if (/(\/avatar\/|\/profile_images\/|\/favicon|\/icon\/|logo)/.test(srcHint)) return true;

          // 常见非正文区域
          const nonContentAncestor = img.closest(
            '[class*="logo"], [class*="avatar"], [class*="author"], [class*="byline"], [class*="navbar"], [class*="header"], [class*="footer"], [class*="subscribe"], [class*="comment"], [class*="social"], [class*="share"], [data-testid*="avatar"], [data-testid*="logo"]'
          );
          if (nonContentAncestor) return true;

          // 小尺寸图通常是头像/图标
          const width = parseInt(img.getAttribute('width') || '0', 10);
          const height = parseInt(img.getAttribute('height') || '0', 10);
          if ((width > 0 && width <= 96) || (height > 0 && height <= 96)) return true;

          return false;
        };

        // 查找主要内容容器
        const contentSelectors = [
          '.available-content',
          '.body.markup',
          '[class*="post-content"]',
          '[class*="article-content"]',
          'article',
          'main',
          '.body',
        ];
        
        let contentContainer = null;
        for (const selector of contentSelectors) {
          contentContainer = document.querySelector(selector);
          if (contentContainer) break;
        }
        
        if (!contentContainer) {
          contentContainer = document.body;
        }
        
        // 克隆内容，避免修改原页面
        const workingContent = contentContainer.cloneNode(true);
        
        // 移除不需要的元素
        const removeSelectors = [
          'script',
          'style',
          'noscript',
          'iframe[src*="youtube"]', // 保留视频链接但移除嵌入
          'iframe[src*="twitter"]',
          'header',
          'footer',
          'nav',
          '[class*="subscribe"]',
          '[class*="paywall"]',
          '[class*="upgrade"]',
          '[data-testid="subscribe-button"]',
          'form',
          'button:not(:has(img))', // 保留包含图片的按钮
          '[class*="share"]',
          '[class*="social"]',
          '[class*="comment"]',
        ];
        
        removeSelectors.forEach(selector => {
          workingContent.querySelectorAll(selector).forEach(el => {
            // 保留包含图片的元素
            if (!el.querySelector('img')) {
              el.remove();
            }
          });
        });

        // 移除 picture/source 的外链候选，保留 img（后续会替换成本地资源）
        workingContent.querySelectorAll('source').forEach(source => source.remove());
        workingContent.querySelectorAll('picture').forEach(picture => {
          const image = picture.querySelector('img');
          if (image) {
            picture.replaceWith(image);
          } else {
            picture.remove();
          }
        });
        
        // 处理图片
        const images = [];
        workingContent.querySelectorAll('img').forEach((img, index) => {
          const srcsetCandidates = [
            ...parseSrcsetCandidates(img.getAttribute('srcset') || ''),
            ...parseSrcsetCandidates(img.getAttribute('data-srcset') || img.dataset?.srcset || ''),
            ...parseSrcsetCandidates(img.getAttribute('data-cfsrcset') || ''),
          ];

          const directSrc =
            img.getAttribute('src') ||
            img.getAttribute('data-src') ||
            img.dataset?.src ||
            img.getAttribute('data-cfsrc') ||
            img.getAttribute('data-original') ||
            img.getAttribute('data-lazy-src') ||
            '';

          const preferredSrc =
            srcsetCandidates.length > 0
              ? srcsetCandidates[srcsetCandidates.length - 1]
              : directSrc;

          const finalSrc = normalizeImageUrl(preferredSrc);
          if (!finalSrc || isLikelyNonContentImage(img)) {
            img.remove();
            return;
          }

          images.push({
            url: finalSrc,
            index: index,
            alt: img.getAttribute('alt') || ''
          });
          
          // 添加占位符，稍后替换为本地路径
          img.setAttribute('data-epub-image-index', index);
          img.setAttribute('src', finalSrc);
          
          // 清理不需要的属性
          [
            'srcset',
            'sizes',
            'loading',
            'decoding',
            'data-src',
            'data-srcset',
            'data-cfsrc',
            'data-cfsrcset',
            'data-original',
            'data-lazy-src',
          ].forEach(attr => {
            img.removeAttribute(attr);
          });
        });
        
        // 处理链接
        workingContent.querySelectorAll('a').forEach(a => {
          const href = a.getAttribute('href');
          if (href) {
            // 规范化链接
            if (href.startsWith('/')) {
              a.setAttribute('href', new URL(href, window.location.origin).toString());
            }
          }
        });
        
        // 提取元数据
        const title = pickArticleTitle();
        
        const subtitle = normalizeText(
          document.querySelector('[data-testid="post-subtitle"]')?.textContent ||
          document.querySelector('h2.subtitle, h3.subtitle, [class*="post-subtitle"], [class*="subtitle"]')?.textContent ||
          document.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
          document.querySelector('meta[name="description"]')?.getAttribute('content') ||
          ''
        );

        const publishDate = document.querySelector('time')?.getAttribute('datetime') ||
                           document.querySelector('time')?.textContent?.trim() ||
                           '';

        const author = normalizeText(
          document.querySelector('[data-testid="author-name"]')?.textContent ||
          document.querySelector('.byline-wrapper a[href*="@"]')?.textContent ||
          document.querySelector('[class*="author-name"]')?.textContent ||
          document.querySelector('[class*="author"] a')?.textContent ||
          document.querySelector('[class*="author"]')?.textContent ||
          ''
        );
        
        return {
          title,
          subtitle,
          publishDate,
          author,
          url,
          html: workingContent.innerHTML,
          images
        };
      }, articleUrl, this.siteTitle);
      
        // 下载并缓存图片
      if (articleData.images && articleData.images.length > 0) {
        await this.downloadImages(page, articleData.images);
        
        // 替换 HTML 中的图片路径为本地路径
        articleData.images.forEach(img => {
          const localImage = this.getCachedImageForUrl(img.url);
          if (localImage) {
            const imgTag = `data-epub-image-index="${img.index}"`;
            articleData.html = articleData.html.replace(
              new RegExp(`<img[^>]*${imgTag}[^>]*>`, 'g'),
              (match) => {
                if (/src=(['"]).*?\1/.test(match)) {
                  return match.replace(/src=(['"]).*?\1/, `src="${localImage.fileUrl}"`);
                }
                return match.replace('<img', `<img src="${localImage.fileUrl}"`);
              }
            );
          }
        });

        articleData.html = articleData.html.replace(/\sdata-epub-image-index="\d+"/g, '');
      }
      
      return articleData;
      
    } catch (error) {
      console.error(`   ❌ 抽取文章内容失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 下载并缓存图片
   */
  async downloadImages(page, images) {
    if (!this.imagePage || this.imagePage.isClosed()) {
      this.imagePage = await page.browser().newPage();
    }

    for (const img of images) {
      try {
        const cacheKey = this.getCacheKeyForImage(img.url);

        // 检查缓存
        if (this.getCachedImageForUrl(img.url) || this.getCachedImageForUrl(cacheKey)) {
          continue;
        }
        
        // 生成本地文件名（使用归一化 URL hash）
        const hash = crypto.createHash('md5').update(cacheKey).digest('hex');
        const kindlePath = path.join(this.imagesDir, `${hash}.jpg`);
        const existingFilename = fs
          .readdirSync(this.imagesDir)
          .find(name => name.startsWith(`${hash}.`));

        if (fs.existsSync(kindlePath)) {
          const cachedImage = {
            localPath: kindlePath,
            fileUrl: pathToFileURL(kindlePath).href,
          };
          this.setCachedImageForUrl(img.url, cachedImage);
          continue;
        }

        if (existingFilename) {
          const existingPath = path.join(this.imagesDir, existingFilename);
          const processed = await this.processImageForKindle(existingPath, kindlePath, img.url);
          const localPath = processed ? kindlePath : existingPath;

          if (processed && existingPath !== kindlePath && fs.existsSync(existingPath)) {
            fs.unlinkSync(existingPath);
          }

          this.setCachedImageForUrl(img.url, {
            localPath,
            fileUrl: pathToFileURL(localPath).href,
          });
          continue;
        }
        
        // 使用独立页面下载图片，避免污染当前文章页面
        const response = await this.imagePage.goto(img.url, {
          waitUntil: 'domcontentloaded',
          timeout: 30000 
        });

        if (!response || !response.ok()) {
          const status = response ? response.status() : 'no-response';
          console.warn(`   ⚠️  图片下载失败 ${img.url}: HTTP ${status}`);
          continue;
        }

        const buffer = await response.buffer();
        if (!buffer || buffer.length === 0) {
          console.warn(`   ⚠️  图片下载失败 ${img.url}: 空响应`);
          continue;
        }

        let ext = '.jpg';
        try {
          const pathnameExt = path.extname(new URL(img.url).pathname || '').toLowerCase();
          if (SUPPORTED_IMAGE_EXTENSIONS.has(pathnameExt)) {
            ext = pathnameExt;
          } else {
            const contentType = response.headers()['content-type']?.split(';')[0]?.trim().toLowerCase();
            if (contentType && IMAGE_EXTENSION_BY_CONTENT_TYPE[contentType]) {
              ext = IMAGE_EXTENSION_BY_CONTENT_TYPE[contentType];
            }
          }
        } catch {
          // 保留默认扩展名
        }

        const sourceFilename = `${hash}${ext}`;
        const sourcePath = path.join(this.imagesDir, sourceFilename);
        let localPath = kindlePath;

        const processed = await this.processImageForKindle(buffer, kindlePath, img.url);
        if (!processed) {
          fs.writeFileSync(sourcePath, buffer);
          localPath = sourcePath;
        }

        const cachedImage = {
          localPath,
          fileUrl: pathToFileURL(localPath).href,
        };

        this.setCachedImageForUrl(img.url, cachedImage);

        const finalUrl = response.url();
        if (finalUrl && finalUrl !== img.url) {
          this.setCachedImageForUrl(finalUrl, cachedImage);
        }

        console.log(`   📷 下载图片: ${path.basename(localPath)}`);
      } catch (error) {
        console.warn(`   ⚠️  图片下载失败 ${img.url}: ${error.message}`);
      }
    }
  }

  async processImageForKindle(input, outputPath, imageUrl) {
    try {
      await sharp(input, { animated: false, limitInputPixels: false })
        .rotate()
        .flatten({ background: "#ffffff" })
        .resize({
          width: KINDLE_MAX_IMAGE_WIDTH,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({
          quality: KINDLE_JPEG_QUALITY,
          mozjpeg: true,
          chromaSubsampling: "4:2:0",
        })
        .toFile(outputPath);

      return fs.existsSync(outputPath);
    } catch (error) {
      console.warn(`   ⚠️  Kindle 图片处理失败 ${imageUrl}: ${error.message}`);
      return false;
    }
  }

  /**
   * 格式化日期
   */
  formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toISOString().split('T')[0];
    } catch {
      return dateStr;
    }
  }

  /**
   * 生成 EPUB 文件
   */
  async generateEpub(chapters) {
    if (!chapters || chapters.length === 0) {
      console.log("📕 未找到可用章节，跳过 EPUB 生成\n");
      return null;
    }

    const epubPath = path.join(this.outputDir, `${this.siteName}.epub`);
    
    try {
      // 准备章节数据
      const content = chapters.map((chapter, idx) => {
        const rawTitle = typeof chapter.title === 'string' && chapter.title.trim()
          ? chapter.title.trim()
          : `Post ${idx + 1}`;
        const rawSubtitle = typeof chapter.subtitle === 'string' ? chapter.subtitle.trim() : '';
        const showSubtitle = rawSubtitle && rawSubtitle !== rawTitle;
        const dateLabel = this.formatDate(chapter.publishDate);
        const authorLabel = chapter.author || this.siteTitle;
        const sourceUrl = typeof chapter.url === 'string' ? chapter.url : '';
        const chapterIndexLabel = `第 ${String(idx + 1).padStart(3, '0')} 篇`;

        const metaItems = [];
        if (authorLabel) {
          metaItems.push(`<div class="meta-item">作者：${escapeHtml(authorLabel)}</div>`);
        }
        if (dateLabel) {
          metaItems.push(`<div class="meta-item">发布日期：${escapeHtml(dateLabel)}</div>`);
        }
        if (sourceUrl) {
          metaItems.push(
            `<div class="meta-item"><a href="${escapeHtml(encodeURI(sourceUrl))}" target="_blank">原文链接</a></div>`,
          );
        }

        return {
          title: `${String(idx + 1).padStart(3, '0')} ${rawTitle}`,
          data: `
            <section class="chapter">
              <div class="chapter-header">
                <div class="chapter-index">${chapterIndexLabel}</div>
                <h1 class="post-title">${escapeHtml(rawTitle)}</h1>
                ${showSubtitle ? `<div class="post-subtitle">${escapeHtml(rawSubtitle)}</div>` : ''}
                <div class="article-meta">
                  ${metaItems.join("\n")}
                </div>
              </div>
              <hr class="post-divider" />
              <div class="article-content">
                ${chapter.html}
              </div>
            </section>
          `
        };
      });
      
      // 创建 EPUB
      const book = new Epub(
        {
          title: `${this.siteTitle} Articles`,
          author: this.siteTitle,
          publisher: "Substack Downloader",
          lang: "zh-CN",
          css: DEFAULT_EPUB_CSS,
          content,
          // 注意：epub-gen 会自动处理图片路径
        },
        epubPath
      );

      await book.promise;
      
      console.log(`📕 EPUB 已生成: ${epubPath}`);
      console.log(`   章节数: ${chapters.length}`);
      console.log(`   图片数: ${new Set(Array.from(this.imageCache.values()).map(item => item.localPath)).size}`);
      
      return epubPath;
      
    } catch (error) {
      console.error(`❌ EPUB 生成失败: ${error.message}`);
      console.error(error.stack);
      return null;
    }
  }

  /**
   * 清理缓存
   */
  cleanup() {
    if (this.imagePage && !this.imagePage.isClosed()) {
      this.imagePage.close().catch(() => {
        // 忽略清理失败
      });
      this.imagePage = null;
    }

    // 可选：清理缓存目录
    // 默认保留缓存以便后续使用
  }
}
