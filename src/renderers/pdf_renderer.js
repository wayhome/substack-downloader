import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { sleep } from "../lib/site_utils.js";
import { retryAsync } from "../lib/retry.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function runStreamingProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, options);

    proc.stdout.on("data", (data) => {
      process.stdout.write(`   ${data}`);
    });

    proc.stderr.on("data", (data) => {
      process.stderr.write(`   ${data}`);
    });

    proc.on("close", (code) => {
      resolve(code ?? 1);
    });

    proc.on("error", (error) => {
      reject(error);
    });
  });
}

export async function renderPdfBook({
  page,
  articles,
  siteTitle,
  siteName,
  outputDir,
  skipCompress = false,
  compressionQuality = "ebook",
  retries = 3,
  onProgress = null,
}) {
  const emit = (event, payload = {}) => {
    if (!onProgress) return;
    onProgress({
      event,
      renderer: "pdf",
      timestamp: Date.now(),
      ...payload,
    });
  };

  const pdfDir = path.join(outputDir, "pdfs");
  fs.mkdirSync(pdfDir, { recursive: true });

  console.log(`📍 PDF: 打印 ${articles.length} 篇文章...`);
  console.log(`   ⏱️  预计需要 ${Math.ceil((articles.length * 4) / 60)} 分钟\n`);

  const completed = [];
  const failed = [];
  let skipped = 0;

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    const url = (typeof article === "string" ? article : article?.url)?.trim();
    if (!url) continue;

    try {
      const articleName = url.split("/p/")[1] || `article_${i + 1}`;
      const pdfPath = path.join(pdfDir, `${String(i + 1).padStart(3, "0")}_${articleName}.pdf`);

      if (fs.existsSync(pdfPath)) {
        if (i % 10 === 0 || skipped === 0) {
          console.log(`   ⏭️  [${i + 1}/${articles.length}] 已存在，跳过`);
        }
        completed.push({ index: i + 1, url, status: "skipped" });
        skipped++;
        emit("pdf.article.skipped", {
          index: i + 1,
          total: articles.length,
          url,
          pdfPath,
        });
        continue;
      }

      const progress = (((i + 1) / articles.length) * 100).toFixed(1);
      console.log(
        `   📄 [${i + 1}/${articles.length}] (${progress}%) ${articleName.slice(0, 50)}${articleName.length > 50 ? "..." : ""}`,
      );

      emit("pdf.article.start", {
        index: i + 1,
        total: articles.length,
        url,
        pdfPath,
      });

      await retryAsync(
        async () => {
          await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
          await page.waitForSelector('article, main, [class*="post"]', { timeout: 30000 });
          await sleep(2000);

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
              await new Promise((r) => setTimeout(r, 120));
            }
            window.scrollTo(0, 0);

            await Promise.all(
              imgs.map((img) => {
                if (img.complete && img.naturalWidth > 0) return Promise.resolve();
                return new Promise((res) => {
                  const done = () => res();
                  img.addEventListener("load", done, { once: true });
                  img.addEventListener("error", done, { once: true });
                });
              }),
            );
          });

          await page.evaluate(() => {
            const STYLE_ID = "__substack_dl_light_mode__";
            if (!document.getElementById(STYLE_ID)) {
              const style = document.createElement("style");
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
              el.classList.remove("dark", "night-mode");
              el.removeAttribute("data-theme");
              el.style.setProperty("background", "#ffffff", "important");
              el.style.setProperty("color", "#000000", "important");
              el.style.setProperty("color-scheme", "light", "important");
            }

            const metaTheme = document.querySelector('meta[name="theme-color"]');
            if (metaTheme) metaTheme.setAttribute("content", "#ffffff");
          });

          await page.pdf({
            path: pdfPath,
            format: "A4",
            printBackground: true,
            scale: 0.9,
            margin: { top: "20mm", right: "15mm", bottom: "20mm", left: "15mm" },
          });
        },
        {
          retries,
          onRetry: ({ attempt, delayMs, error }) => {
            console.warn(`   ⚠️  [${i + 1}/${articles.length}] 重试 ${attempt}/${retries}: ${error.message}`);
            emit("pdf.article.retry", {
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

      completed.push({ index: i + 1, url, path: pdfPath });
      emit("pdf.article.success", {
        index: i + 1,
        total: articles.length,
        url,
        pdfPath,
      });
      await sleep(1000);
    } catch (error) {
      console.error(`   ❌ [${i + 1}/${articles.length}] 失败: ${error.message}`);
      failed.push({ index: i + 1, url, error: error.message });
      emit("pdf.article.failed", {
        index: i + 1,
        total: articles.length,
        url,
        error: error.message,
      });
      await sleep(3000);
    }
  }

  if (skipped > 0) {
    console.log(`\n   ℹ️  跳过了 ${skipped} 个已存在的 PDF 文件`);
  }

  console.log(`\n   ✓ PDF 打印完成: ${completed.length}/${articles.length} 成功\n`);

  const mergedPdfPath = path.join(outputDir, `${siteName}_complete.pdf`);
  console.log("📍 PDF: 合并文件并生成目录...");

  const uvCacheDir = path.join(outputDir, ".cache", "uv-cache");
  fs.mkdirSync(uvCacheDir, { recursive: true });

  const mergeScript = path.resolve(__dirname, "../merge_pdfs.py");
  emit("pdf.merge.start", { mergedPdfPath });
  const mergeExitCode = await retryAsync(
    async () => {
      const code = await runStreamingProcess("uv", ["run", "--with", "PyPDF2", "python", mergeScript], {
        cwd: outputDir,
        env: {
          ...process.env,
          UV_CACHE_DIR: uvCacheDir,
          PDF_DIR: pdfDir,
          OUTPUT_FILE: mergedPdfPath,
        },
      });
      if (code !== 0) {
        throw new Error(`exit code ${code}`);
      }
      return code;
    },
    {
      retries,
      onRetry: ({ attempt, delayMs, error }) => {
        console.warn(`   ⚠️  PDF 合并重试 ${attempt}/${retries}: ${error.message}`);
        emit("pdf.merge.retry", { attempt, retries, delayMs, error: error.message });
      },
    },
  );

  if (mergeExitCode !== 0) {
    throw new Error(`合并失败，退出码: ${mergeExitCode}`);
  }
  emit("pdf.merge.success", { mergedPdfPath });

  const mergedStats = fs.statSync(mergedPdfPath);
  console.log(`   ✓ 合并完成: ${mergedPdfPath} (${(mergedStats.size / (1024 * 1024)).toFixed(2)} MB)\n`);

  let finalPdfPath = mergedPdfPath;
  if (!skipCompress) {
    console.log(`📍 PDF: 压缩文件 (质量: ${compressionQuality})...`);
    const compressedPdfPath = path.join(outputDir, `${siteName}_compressed.pdf`);
    const compressScript = path.resolve(__dirname, "../compress_pdf.py");
    emit("pdf.compress.start", { mergedPdfPath, compressedPdfPath, compressionQuality });

    let compressExitCode = 1;
    try {
      compressExitCode = await retryAsync(
        async () => {
          const code = await runStreamingProcess("uv", ["run", "python", compressScript, mergedPdfPath, compressedPdfPath, compressionQuality], {
          env: {
            ...process.env,
            UV_CACHE_DIR: uvCacheDir,
          },
          });
          if (code !== 0) {
            throw new Error(`exit code ${code}`);
          }
          return code;
        },
        {
          retries,
          onRetry: ({ attempt, delayMs, error }) => {
            console.warn(`   ⚠️  PDF 压缩重试 ${attempt}/${retries}: ${error.message}`);
            emit("pdf.compress.retry", { attempt, retries, delayMs, error: error.message });
          },
        },
      );
    } catch (error) {
      console.warn(`   ⚠️  压缩失败，但原始文件已保存 (${error.message})`);
      emit("pdf.compress.failed", { compressedPdfPath, error: error.message });
      compressExitCode = 1;
    }

    if (compressExitCode === 0 && fs.existsSync(compressedPdfPath)) {
      finalPdfPath = compressedPdfPath;
      emit("pdf.compress.success", { compressedPdfPath });
    }
  } else {
    console.log("📍 PDF: 跳过压缩\n");
    emit("pdf.compress.skipped");
  }

  const finalStats = fs.statSync(finalPdfPath);
  const finalSizeMB = (finalStats.size / (1024 * 1024)).toFixed(2);

  console.log(`
📘 PDF 生成完成

📊 统计信息:
   站点: ${siteTitle}
   文章总数: ${articles.length}
   成功下载: ${completed.length - skipped}
   已存在(跳过): ${skipped}
   失败: ${failed.length}
   成功率: ${((completed.length / Math.max(articles.length, 1)) * 100).toFixed(1)}%

📁 输出文件:
   ${skipCompress ? "完整版" : "压缩版"}: ${finalPdfPath}
   文件大小: ${finalSizeMB} MB
   ${skipCompress ? "" : `原始版: ${mergedPdfPath}`}
   输出目录: ${outputDir}
`);

  if (failed.length > 0) {
    console.log(`\n⚠️  失败的文章 (${failed.length}):`);
    failed.slice(0, 5).forEach((item) => {
      console.log(`   - [${item.index}] ${item.url.split("/p/")[1]}`);
    });
    if (failed.length > 5) {
      console.log(`   ... 还有 ${failed.length - 5} 个失败`);
    }
  }
  console.log("");

  return {
    finalPdfPath,
    mergedPdfPath,
    failed,
    completed,
    skipped,
    stats: {
      total: articles.length,
      succeeded: completed.length - skipped,
      skipped,
      failed: failed.length,
    },
  };
}
