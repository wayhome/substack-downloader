import fs from "fs";
import path from "path";
import { parseTimestamp, sleep } from "./site_utils.js";
import { retryAsync } from "./retry.js";

export async function discoverArticles(
  page,
  { substackUrl, outputDir, maxScrollAttempts = 300, retries = 3, onProgress = null },
) {
  const emit = (event, payload = {}) => {
    if (!onProgress) return;
    onProgress({
      event,
      timestamp: Date.now(),
      ...payload,
    });
  };

  emit("discovery.start", { substackUrl });
  console.log("\n📍 步骤 1: 访问站点并加载所有文章...");

  let archiveUrl = substackUrl;
  try {
    const urlObj = new URL(substackUrl);
    archiveUrl = `${urlObj.origin}/archive`;
    console.log(`   🔍 尝试访问归档页面: ${archiveUrl}`);
    await retryAsync(
      async () => {
        await page.goto(archiveUrl, { waitUntil: "networkidle2", timeout: 30000 });
      },
      {
        retries,
        onRetry: ({ attempt, delayMs, error }) => {
          console.warn(`   ⚠️  归档页面重试 ${attempt}/${retries}: ${error.message}，${delayMs}ms 后重试`);
        },
      },
    );
    console.log("   ✓ 成功访问归档页面");
  } catch {
    console.log("   ⚠️  归档页面不可用，使用主页");
    await retryAsync(
      async () => {
        await page.goto(substackUrl, { waitUntil: "networkidle2", timeout: 30000 });
      },
      {
        retries,
        onRetry: ({ attempt, delayMs, error }) => {
          console.warn(`   ⚠️  主页重试 ${attempt}/${retries}: ${error.message}，${delayMs}ms 后重试`);
        },
      },
    );
  }

  try {
    const latestButton = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const latest = buttons.find((b) => b.textContent.trim() === "Latest");
      if (latest) {
        latest.click();
        return true;
      }
      return false;
    });

    if (latestButton) {
      await sleep(2000);
      console.log("   ✓ 切换到 Latest 标签");
    }
  } catch {
    // ignore
  }

  console.log("   📜 滚动加载所有文章（这可能需要几分钟）...");
  let lastArticleCount = 0;
  let currentArticleCount = 0;
  let unchangedCount = 0;
  let scrollAttempts = 0;

  while (scrollAttempts < maxScrollAttempts) {
    const result = await page.evaluate(async () => {
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise((r) => setTimeout(r, 3000));
      return document.querySelectorAll('a[href*="/p/"]').length;
    });

    currentArticleCount = result;

    if (scrollAttempts % 5 === 0) {
      console.log(`   ... 滚动 ${scrollAttempts} 次, 当前 ${currentArticleCount} 个链接`);
      emit("discovery.scroll.progress", {
        scrollAttempts,
        articleCount: currentArticleCount,
      });
    }

    if (currentArticleCount === lastArticleCount) {
      unchangedCount++;
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

  const lastDate = await page.evaluate(() => {
    const times = Array.from(document.querySelectorAll("time"));
    return times.length > 0 ? times[times.length - 1].getAttribute("datetime") : "";
  });

  console.log(`   ✓ 滚动完成: ${scrollAttempts} 次，找到 ${currentArticleCount} 个链接`);
  if (lastDate) {
    console.log(`   ✓ 最早文章日期: ${new Date(lastDate).toLocaleDateString("zh-CN")}`);
  }
  emit("discovery.scroll.done", {
    scrollAttempts,
    articleCount: currentArticleCount,
    lastArticleDate: lastDate || null,
  });

  const archiveEntries = await page.evaluate(() => {
    const normalizeArticleUrl = (rawUrl) => {
      try {
        const parsed = new URL(rawUrl, window.location.origin);
        if (!parsed.pathname.includes("/p/")) return null;
        parsed.search = "";
        parsed.hash = "";
        return parsed.toString();
      } catch {
        return null;
      }
    };

    const parseableDate = (value) => {
      if (!value) return null;
      const normalized = value.trim();
      return Number.isFinite(Date.parse(normalized)) ? normalized : null;
    };

    const nearestTimeByNodeIndex = (timePoints, nodeIndex) => {
      if (timePoints.length === 0) return null;

      let left = 0;
      let right = timePoints.length - 1;
      while (left < right) {
        const mid = Math.floor((left + right) / 2);
        if (timePoints[mid].idx < nodeIndex) {
          left = mid + 1;
        } else {
          right = mid;
        }
      }

      const rightPoint = timePoints[left];
      const leftPoint = left > 0 ? timePoints[left - 1] : null;

      if (!leftPoint) return rightPoint?.date || null;
      if (!rightPoint) return leftPoint.date;

      const leftDist = Math.abs(nodeIndex - leftPoint.idx);
      const rightDist = Math.abs(rightPoint.idx - nodeIndex);
      return leftDist <= rightDist ? leftPoint.date : rightPoint.date;
    };

    const nodes = Array.from(document.querySelectorAll('time, a[href*="/p/"]'));
    const timePoints = [];

    nodes.forEach((node, idx) => {
      if (node.tagName !== "TIME") return;
      const rawDate = parseableDate(node.getAttribute("datetime") || node.textContent || "");
      if (!rawDate) return;
      timePoints.push({ idx, date: rawDate });
    });

    const entries = [];
    const seen = new Set();
    nodes.forEach((node, idx) => {
      if (node.tagName === "TIME") return;
      const url = normalizeArticleUrl(node.href);
      if (!url || seen.has(url)) return;
      seen.add(url);
      entries.push({
        url,
        date: nearestTimeByNodeIndex(timePoints, idx),
        order: entries.length,
      });
    });

    return entries;
  });

  const archiveDatedEntries = archiveEntries.filter((entry) => entry.date);
  console.log(`   ✓ 归档页面提取到 ${archiveEntries.length} 篇文章 (含日期 ${archiveDatedEntries.length} 篇)`);
  if (archiveDatedEntries.length > 0) {
    const archiveTimes = archiveDatedEntries
      .map((entry) => Date.parse(entry.date))
      .filter((ts) => Number.isFinite(ts))
      .sort((a, b) => a - b);
    if (archiveTimes.length > 0) {
      console.log(
        `   ✓ 归档日期范围: ${new Date(archiveTimes[0]).toISOString().slice(0, 10)} 至 ${new Date(archiveTimes[archiveTimes.length - 1]).toISOString().slice(0, 10)}`,
      );
    }
  }

  console.log("   🗺️  从 sitemap.xml 补充文章链接...");
  let sitemapArticles = [];
  try {
    const sitemapUrl = `${new URL(substackUrl).origin}/sitemap.xml`;
    sitemapArticles = await retryAsync(
      async () => {
        await page.goto(sitemapUrl, { waitUntil: "networkidle2", timeout: 30000 });
        return page.evaluate(() => {
          const xmlText = document.body.textContent || document.body.innerText;
          const articles = [];
          const urlBlockRegex = /<url>(.*?)<\/url>/gs;
          let blockMatch;

          while ((blockMatch = urlBlockRegex.exec(xmlText)) !== null) {
            const urlBlock = blockMatch[1];
            const locMatch = /<loc>(.*?)<\/loc>/.exec(urlBlock);
            if (!locMatch) continue;

            const url = locMatch[1].trim();
            if (!url.includes("/p/") || url.includes("?") || url.includes("#")) continue;

            const lastmodMatch = /<lastmod>(.*?)<\/lastmod>/.exec(urlBlock);
            const lastmod = lastmodMatch ? lastmodMatch[1].trim() : "";
            articles.push({ url, date: lastmod });
          }

          return articles;
        });
      },
      {
        retries,
        onRetry: ({ attempt, delayMs, error }) => {
          console.warn(`   ⚠️  sitemap 重试 ${attempt}/${retries}: ${error.message}，${delayMs}ms 后重试`);
        },
      },
    );

    console.log(`   ✓ sitemap.xml 提取到 ${sitemapArticles.length} 篇文章`);
  } catch (error) {
    console.warn(`   ⚠️  无法访问 sitemap.xml: ${error.message}`);
  }

  const articlesMap = new Map();
  archiveEntries.forEach((entry) => {
    articlesMap.set(entry.url, {
      url: entry.url,
      date: entry.date,
      order: entry.order,
    });
  });

  let ignoredSitemapDates = 0;
  const newFromSitemap = [];
  sitemapArticles.forEach((article) => {
    const existing = articlesMap.get(article.url);
    if (existing) {
      if (Number.isFinite(parseTimestamp(article.date))) ignoredSitemapDates++;
      return;
    }

    articlesMap.set(article.url, {
      url: article.url,
      date: article.date || null,
      order: -1 - newFromSitemap.length,
    });
    newFromSitemap.push(article);
  });

  const articlesWithDates = Array.from(articlesMap.values());
  articlesWithDates.sort((a, b) => {
    const aTime = parseTimestamp(a.date);
    const bTime = parseTimestamp(b.date);
    const aHasDate = Number.isFinite(aTime);
    const bHasDate = Number.isFinite(bTime);

    if (!aHasDate && !bHasDate) return b.order - a.order;
    if (!aHasDate) return 1;
    if (!bHasDate) return -1;
    if (aTime !== bTime) return aTime - bTime;
    return b.order - a.order;
  });

  const articles = articlesWithDates.map((item) => item.url);
  const articleRecords = articlesWithDates.map((item, idx) => ({
    index: idx + 1,
    url: item.url,
    date: item.date || null,
    order: item.order,
    hasDate: Number.isFinite(parseTimestamp(item.date)),
  }));
  console.log(
    `   ✓ 合并后共 ${articles.length} 篇独立文章${newFromSitemap.length > 0 ? ` (sitemap 新增了 ${newFromSitemap.length} 篇)` : ""}${ignoredSitemapDates > 0 ? ` (忽略已存在文章的 sitemap 日期 ${ignoredSitemapDates} 篇)` : ""}`,
  );

  const datedArticles = articlesWithDates.filter((item) => Number.isFinite(parseTimestamp(item.date)));
  if (datedArticles.length > 0) {
    console.log(
      `   ✓ 文章日期范围: ${datedArticles[0].date} 至 ${datedArticles[datedArticles.length - 1].date}`,
    );
  }

  if (articles.length > 0) {
    console.log("   📝 最新3篇:");
    articles
      .slice(-3)
      .reverse()
      .forEach((url, idx) => {
        const title = url.split("/p/")[1] || "unknown";
        console.log(`      ${idx + 1}. ${title}`);
      });
    if (articles.length > 3) {
      console.log(`      ... 还有 ${articles.length - 3} 篇`);
    }
  }
  console.log("");

  const articlesFile = path.join(outputDir, "articles.txt");
  fs.writeFileSync(articlesFile, [...articles].reverse().join("\n"));
  console.log(`   ✓ 文章列表已保存: ${articlesFile}\n`);

  console.log("📍 步骤 2: 获取站点信息...");
  try {
    await retryAsync(
      async () => {
        await page.goto(substackUrl, { waitUntil: "networkidle2", timeout: 30000 });
      },
      {
        retries,
        onRetry: ({ attempt, delayMs, error }) => {
          console.warn(`   ⚠️  站点信息页重试 ${attempt}/${retries}: ${error.message}，${delayMs}ms 后重试`);
        },
      },
    );
  } catch {
    // ignore; keep current page
  }

  const siteTitle = await page.evaluate(() => {
    return (
      document.querySelector('h1, [class*="publication-name"]')?.textContent?.trim() ||
      document.title ||
      "Substack Publication"
    );
  });
  console.log(`   ✓ 站点标题: ${siteTitle}\n`);

  const stats = {
    scrollAttempts,
    lastArticleDate: lastDate || null,
    archiveEntries: archiveEntries.length,
    archiveDatedEntries: archiveDatedEntries.length,
    sitemapEntries: sitemapArticles.length,
    newFromSitemap: newFromSitemap.length,
    ignoredSitemapDates,
    datedArticles: datedArticles.length,
    totalArticles: articles.length,
  };
  emit("discovery.done", {
    siteTitle,
    stats,
  });

  return {
    articles,
    articleRecords,
    siteTitle,
    articlesFile,
    stats,
  };
}
