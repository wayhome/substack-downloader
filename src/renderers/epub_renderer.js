import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { EpubGenerator } from "../epub_generator.js";
import { sleep } from "../lib/site_utils.js";
import { retryAsync } from "../lib/retry.js";

const EPUB_CHAPTER_CACHE_VERSION = 1;
const EPUB_EXTRACTOR_SIGNATURE = "epub-generator-v4";

function getChapterCacheKey(url) {
  return crypto.createHash("md5").update(url).digest("hex");
}

function getChapterCacheFilePath(chaptersDir, url) {
  return path.join(chaptersDir, `${getChapterCacheKey(url)}.json`);
}

function extractLocalImageFilesFromHtml(html) {
  const imageFiles = new Set();
  const regex = /src=(['"])(file:\/\/[^'"]+)\1/g;
  let match;
  while ((match = regex.exec(html || "")) !== null) {
    try {
      imageFiles.add(fileURLToPath(match[2]));
    } catch {
      // ignore malformed file URLs
    }
  }
  return Array.from(imageFiles);
}

function isChapterCacheValid(cacheRecord, url) {
  if (!cacheRecord || typeof cacheRecord !== "object") return false;
  if (cacheRecord.cacheVersion !== EPUB_CHAPTER_CACHE_VERSION) return false;
  if (cacheRecord.extractorSignature !== EPUB_EXTRACTOR_SIGNATURE) return false;
  if (cacheRecord.url !== url) return false;
  if (!cacheRecord.chapter || typeof cacheRecord.chapter.html !== "string") return false;
  if (cacheRecord.chapter.url !== url) return false;

  const imageFiles = Array.isArray(cacheRecord.imageFiles) ? cacheRecord.imageFiles : [];
  return imageFiles.every((filePath) => fs.existsSync(filePath));
}

function readJsonFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function writeJsonFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

export async function renderEpubBook({
  page,
  articles,
  siteName,
  siteTitle,
  outputDir,
  retries = 3,
  refreshEpubCache = false,
  onProgress = null,
}) {
  const emit = (event, payload = {}) => {
    if (!onProgress) return;
    onProgress({
      event,
      renderer: "epub",
      timestamp: Date.now(),
      ...payload,
    });
  };

  console.log(`📍 EPUB: 抓取 ${articles.length} 篇文章并生成电子书...`);
  if (refreshEpubCache) {
    console.log("   ♻️  已启用 --refresh-epub-cache，忽略章节缓存");
  }

  const generator = new EpubGenerator(siteName, siteTitle, outputDir);
  const chapters = [];
  const failed = [];

  const epubCacheDir = path.join(outputDir, ".cache", "epub");
  const chaptersDir = path.join(epubCacheDir, "chapters");
  const manifestPath = path.join(epubCacheDir, "manifest.json");
  fs.mkdirSync(chaptersDir, { recursive: true });

  const manifest = readJsonFile(manifestPath) || {
    cacheVersion: EPUB_CHAPTER_CACHE_VERSION,
    extractorSignature: EPUB_EXTRACTOR_SIGNATURE,
    generatedAt: null,
    siteName,
    siteTitle,
    entries: {},
  };

  let cacheHits = 0;
  let cacheMisses = 0;

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    const url = (typeof article === "string" ? article : article?.url)?.trim();
    if (!url) continue;

    const articleName = url.split("/p/")[1] || `article_${i + 1}`;
    const progress = (((i + 1) / articles.length) * 100).toFixed(1);
    console.log(
      `   📚 [${i + 1}/${articles.length}] (${progress}%) ${articleName.slice(0, 50)}${articleName.length > 50 ? "..." : ""}`,
    );
    emit("epub.article.start", {
      index: i + 1,
      total: articles.length,
      url,
    });

    const cacheFilePath = getChapterCacheFilePath(chaptersDir, url);
    if (!refreshEpubCache) {
      const cachedRecord = readJsonFile(cacheFilePath);
      if (isChapterCacheValid(cachedRecord, url)) {
        chapters.push(cachedRecord.chapter);
        cacheHits++;
        manifest.entries[url] = {
          ...(manifest.entries[url] || {}),
          status: "cache_hit",
          cacheFile: path.relative(epubCacheDir, cacheFilePath),
          imageCount: Array.isArray(cachedRecord.imageFiles) ? cachedRecord.imageFiles.length : 0,
          updatedAt: new Date().toISOString(),
        };
        emit("epub.article.cache_hit", {
          index: i + 1,
          total: articles.length,
          url,
          cacheFilePath,
        });
        continue;
      }
    }

    cacheMisses++;

    try {
      const chapter = await retryAsync(
        async () => {
          await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
          await page.waitForSelector('article, main, [class*="post"]', { timeout: 30000 });
          await sleep(1000);

          // 触发懒加载，提升图片抽取完整度
          await page.evaluate(async () => {
            const imgs = Array.from(document.querySelectorAll("img"));
            for (const img of imgs) {
              const dataSrc = img.getAttribute("data-src") || img.dataset?.src;
              const dataSrcset = img.getAttribute("data-srcset") || img.dataset?.srcset;
              const cfSrc = img.getAttribute("data-cfsrc");
              if (!img.src && (dataSrc || cfSrc)) img.src = dataSrc || cfSrc;
              if (!img.srcset && dataSrcset) img.srcset = dataSrcset;
              img.loading = "eager";
              img.decoding = "sync";
            }

            const step = 800;
            for (let y = 0; y < document.body.scrollHeight; y += step) {
              window.scrollTo(0, y);
              await new Promise((r) => setTimeout(r, 100));
            }
            window.scrollTo(0, 0);
          });

          return generator.extractArticleContent(page, url);
        },
        {
          retries,
          onRetry: ({ attempt, delayMs, error }) => {
            console.warn(`   ⚠️  [${i + 1}/${articles.length}] 重试 ${attempt}/${retries}: ${error.message}`);
            emit("epub.article.retry", {
              index: i + 1,
              total: articles.length,
              url,
              attempt,
              retries,
              delayMs,
              error: error.message,
            });
          },
        },
      );

      if (chapter) {
        chapters.push(chapter);

        const imageFiles = extractLocalImageFilesFromHtml(chapter.html);
        writeJsonFile(cacheFilePath, {
          cacheVersion: EPUB_CHAPTER_CACHE_VERSION,
          extractorSignature: EPUB_EXTRACTOR_SIGNATURE,
          url,
          savedAt: new Date().toISOString(),
          imageFiles,
          chapter,
        });

        manifest.entries[url] = {
          status: "cached",
          cacheFile: path.relative(epubCacheDir, cacheFilePath),
          imageCount: imageFiles.length,
          updatedAt: new Date().toISOString(),
        };

        emit("epub.article.success", {
          index: i + 1,
          total: articles.length,
          url,
          cacheFilePath,
        });
      } else {
        const errorMessage = "提取内容为空";
        failed.push({ index: i + 1, url, error: errorMessage });
        manifest.entries[url] = {
          status: "failed",
          error: errorMessage,
          updatedAt: new Date().toISOString(),
        };
        emit("epub.article.failed", {
          index: i + 1,
          total: articles.length,
          url,
          error: errorMessage,
        });
      }
    } catch (error) {
      console.error(`   ❌ [${i + 1}/${articles.length}] 失败: ${error.message}`);
      failed.push({ index: i + 1, url, error: error.message });
      manifest.entries[url] = {
        status: "failed",
        error: error.message,
        updatedAt: new Date().toISOString(),
      };
      emit("epub.article.failed", {
        index: i + 1,
        total: articles.length,
        url,
        error: error.message,
      });
      await sleep(2000);
    }
  }

  manifest.generatedAt = new Date().toISOString();
  manifest.siteName = siteName;
  manifest.siteTitle = siteTitle;
  writeJsonFile(manifestPath, manifest);

  const epubPath = await generator.generateEpub(chapters);
  generator.cleanup();

  console.log(`
📗 EPUB 生成完成

📊 统计信息:
   站点: ${siteTitle}
   文章总数: ${articles.length}
   成功章节: ${chapters.length}
   失败: ${failed.length}
   缓存命中: ${cacheHits}
   缓存未命中: ${cacheMisses}
   输出文件: ${epubPath || "未生成"}
`);

  if (failed.length > 0) {
    console.log(`\n⚠️  失败的文章 (${failed.length}):`);
    failed.slice(0, 5).forEach((item) => {
      console.log(`   - [${item.index}] ${item.url.split("/p/")[1]}`);
    });
    if (failed.length > 5) {
      console.log(`   ... 还有 ${failed.length - 5} 个失败`);
    }
    console.log("");
  }

  return {
    epubPath,
    chapters,
    failed,
    stats: {
      total: articles.length,
      succeeded: chapters.length,
      failed: failed.length,
      cacheHits,
      cacheMisses,
      manifestPath,
    },
  };
}
