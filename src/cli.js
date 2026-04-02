#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { connectToChrome, getConfiguredPage } from "./lib/browser.js";
import { discoverArticles } from "./lib/article_discovery.js";
import { getSiteName, resolveOutputDir } from "./lib/site_utils.js";
import { renderPdfBook } from "./renderers/pdf_renderer.js";
import { renderEpubBook } from "./renderers/epub_renderer.js";

const VALID_FORMATS = new Set(["pdf", "epub", "both"]);
const VALID_QUALITY = new Set(["screen", "ebook", "printer", "prepress"]);

function printHelp({
  commandName,
  defaultFormat,
}) {
  console.log(`
📚 Substack 下载器

使用方法:
  node src/${commandName} <substack_url> [options]

参数:
  substack_url          Substack 站点 URL

选项:
  --output-dir <dir>    输出目录 (默认: ./downloads/<站点名>)
  --format <mode>       输出格式: pdf | epub | both (默认: ${defaultFormat})
  --retries <n>         网络与渲染重试次数 (默认: 3)
  --refresh-epub-cache  强制忽略 EPUB 章节缓存并重新抓取
  --skip-compress       跳过 PDF 压缩（仅 PDF/both 模式生效）
  --quality <level>     PDF 压缩质量: screen, ebook, printer, prepress (默认: ebook)
  --help, -h            显示帮助

⚠️  首次使用:
  1. 先运行: node src/start.js --profile
  2. 在打开的浏览器中登录 Substack 站点
  3. 关闭浏览器后再运行下载器

示例:
  node src/${commandName} https://stratechery.com
  node src/${commandName} https://example.substack.com --format epub
  node src/${commandName} https://example.substack.com --retries 3
  node src/${commandName} https://example.substack.com --format epub --refresh-epub-cache
  node src/${commandName} https://example.substack.com --format both --quality printer
`);
}

function parseArgs(argv, defaultFormat) {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    return { help: true };
  }

  const substackUrl = argv[0];
  if (!substackUrl || substackUrl.startsWith("-")) {
    throw new Error("缺少 substack_url 参数");
  }

  const options = {
    substackUrl,
    outputDir: null,
    format: defaultFormat,
    retries: 3,
    refreshEpubCache: false,
    skipCompress: false,
    compressionQuality: "ebook",
  };

  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--output-dir":
        options.outputDir = argv[i + 1];
        i++;
        break;
      case "--format":
        options.format = (argv[i + 1] || "").toLowerCase();
        i++;
        break;
      case "--retries":
        options.retries = Number.parseInt(argv[i + 1], 10);
        i++;
        break;
      case "--refresh-epub-cache":
        options.refreshEpubCache = true;
        break;
      case "--skip-compress":
        options.skipCompress = true;
        break;
      case "--quality":
        options.compressionQuality = (argv[i + 1] || "").toLowerCase();
        i++;
        break;
      default:
        if (arg.startsWith("-")) {
          throw new Error(`未知参数: ${arg}`);
        }
    }
  }

  if (!VALID_FORMATS.has(options.format)) {
    throw new Error(`--format 仅支持: ${Array.from(VALID_FORMATS).join(", ")}`);
  }
  if (!VALID_QUALITY.has(options.compressionQuality)) {
    throw new Error(`--quality 仅支持: ${Array.from(VALID_QUALITY).join(", ")}`);
  }
  if (!Number.isInteger(options.retries) || options.retries < 0 || options.retries > 10) {
    throw new Error("--retries 需为 0-10 的整数");
  }

  return options;
}

export async function runCli({
  argv = process.argv.slice(2),
  commandName = "cli.js",
  defaultFormat = "pdf",
} = {}) {
  const parsed = parseArgs(argv, defaultFormat);
  if (parsed.help) {
    printHelp({ commandName, defaultFormat });
    return;
  }

  const siteName = getSiteName(parsed.substackUrl);
  const outputDir = resolveOutputDir(parsed.substackUrl, parsed.outputDir);
  const format = parsed.format;
  const progressState = {
    retries: 0,
  };
  const onProgress = (event) => {
    if (typeof event?.event === "string" && event.event.endsWith(".retry")) {
      progressState.retries++;
    }
  };

  fs.mkdirSync(outputDir, { recursive: true });

  console.log(`
╔════════════════════════════════════════════════════════════╗
║              📚 Substack 下载器                            ║
╚════════════════════════════════════════════════════════════╝

🌐 目标站点: ${parsed.substackUrl}
📁 输出目录: ${outputDir}
🧾 输出格式: ${format.toUpperCase()}
🔁 重试次数: ${parsed.retries}
${format === "epub" || format === "both" ? `♻️  EPUB 缓存: ${parsed.refreshEpubCache ? "强制刷新" : "启用"}`
 : ""}
${format === "pdf" || format === "both" ? `🗜️  PDF 压缩质量: ${parsed.skipCompress ? "跳过压缩" : parsed.compressionQuality}` : ""}
`);

  console.log("🔌 连接到 Chrome...");
  const browser = await connectToChrome();

  try {
    const page = await getConfiguredPage(browser);
    const { articles, articleRecords, siteTitle, stats: discoveryStats } = await discoverArticles(page, {
      substackUrl: parsed.substackUrl,
      outputDir,
      retries: parsed.retries,
      onProgress,
    });
    const renderArticles = articleRecords && articleRecords.length > 0 ? articleRecords : articles;

    const results = {};

    if (format === "pdf" || format === "both") {
      results.pdf = await renderPdfBook({
        page,
        articles: renderArticles,
        siteTitle,
        siteName,
        outputDir,
        skipCompress: parsed.skipCompress,
        compressionQuality: parsed.compressionQuality,
        retries: parsed.retries,
        onProgress,
      });
    }

    if (format === "epub" || format === "both") {
      results.epub = await renderEpubBook({
        page,
        articles: renderArticles,
        siteName,
        siteTitle,
        outputDir,
        retries: parsed.retries,
        refreshEpubCache: parsed.refreshEpubCache,
        onProgress,
      });
    }

    const outputs = [];
    if (results.pdf?.finalPdfPath) outputs.push(results.pdf.finalPdfPath);
    if (results.epub?.epubPath) outputs.push(results.epub.epubPath);

    console.log(`
╔════════════════════════════════════════════════════════════╗
║                   ✅ 下载完成！                            ║
╚════════════════════════════════════════════════════════════╝

📊 站点: ${siteTitle}
📄 文章总数: ${articles.length}
📁 输出目录: ${outputDir}
📦 产物数量: ${outputs.length}
🔁 发生重试: ${progressState.retries}
🧭 发现统计: 归档 ${discoveryStats?.archiveEntries ?? 0} / sitemap ${discoveryStats?.sitemapEntries ?? 0} / 新增 ${discoveryStats?.newFromSitemap ?? 0}
`);

    outputs.forEach((filePath, index) => {
      console.log(`   ${index + 1}. ${filePath}`);
    });
    console.log("");
  } finally {
    await browser.disconnect();
  }
}

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  try {
    await runCli();
  } catch (error) {
    console.error(`❌ 执行失败: ${error.message}`);
    process.exitCode = 1;
  }
}
