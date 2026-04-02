import path from "path";

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getSiteName(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const siteName = hostname.replace(/^www\./, "").replace(/\.(substack\.)?com$/, "");
    return siteName.replace(/[^a-zA-Z0-9-]/g, "_");
  } catch {
    return "substack_site";
  }
}

export function resolveOutputDir(substackUrl, outputDirArg) {
  if (outputDirArg) return outputDirArg;
  return path.join(process.cwd(), "downloads", getSiteName(substackUrl));
}

export function parseTimestamp(value) {
  if (!value) return NaN;
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : NaN;
}

