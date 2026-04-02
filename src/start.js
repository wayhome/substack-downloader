#!/usr/bin/env node

import { spawn, execSync } from "node:child_process";
import puppeteer from "puppeteer-core";
import path from "node:path";
import fs from "node:fs";

const platform = process.platform;
const useProfile = process.argv[2] === "--profile";

if (process.argv[2] && process.argv[2] !== "--profile") {
  console.log("Usage: start.js [--profile]");
  console.log("\nOptions:");
  console.log(
    "  --profile  Copy your default Chrome profile (cookies, logins)",
  );
  console.log("\n⚠️  First-time users:");
  console.log("  1. Run: node start.js --profile");
  console.log("  2. Login to Substack in the opened browser");
  console.log("  3. Close browser and run the downloader");
  console.log("\nExamples:");
  console.log("  start.js            # Start with fresh profile");
  console.log("  start.js --profile  # Start with your Chrome profile (recommended)");
  process.exit(1);
}

// Kill existing Chrome (platform-specific)
try {
  if (platform === "win32") {
    execSync("taskkill /F /IM chrome.exe", { stdio: "ignore" });
  } else {
    execSync("killall 'Google Chrome' || killall 'Chromium' || true", { stdio: "ignore" });
  }
} catch {}

// Wait a bit for processes to fully die
await new Promise((r) => setTimeout(r, 1000));

// Setup profile directory
const cacheDir = path.join(process.env["HOME"] || process.env["USERPROFILE"], ".cache", "scraping");
fs.mkdirSync(cacheDir, { recursive: true });

if (useProfile) {
  // Determine Chrome profile path based on platform
  let chromeProfilePath;
  
  if (platform === "darwin") {
    chromeProfilePath = path.join(process.env["HOME"], "Library", "Application Support", "Google", "Chrome");
  } else if (platform === "win32") {
    chromeProfilePath = path.join(process.env["LOCALAPPDATA"], "Google", "Chrome", "User Data");
  } else {
    // Linux
    chromeProfilePath = path.join(process.env["HOME"], ".config", "google-chrome");
  }
  
  // Sync profile with rsync (Unix) or robocopy (Windows)
  try {
    if (platform === "win32") {
      execSync(`robocopy "${chromeProfilePath}" "${cacheDir}" /MIR /NFL /NDL /NJH /NJS`, { stdio: "pipe" });
    } else {
      execSync(`rsync -a --delete "${chromeProfilePath}/" "${cacheDir}/"`, { stdio: "pipe" });
    }
  } catch (e) {
    // robocopy returns non-zero exit codes even on success, ignore errors
  }
}

// Detect Chrome executable path based on OS
const chromePaths = {
  darwin: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ],
  linux: [
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ],
  win32: [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ],
};

const possiblePaths = chromePaths[platform] || chromePaths.darwin;
let chromePath = possiblePaths[0]; // Default to first path

// Try to find Chrome executable
for (const path of possiblePaths) {
  try {
    if (platform === "win32") {
      execSync(`if exist "${path}" exit 0 else exit 1`, { stdio: "ignore" });
    } else {
      execSync(`test -f "${path}"`, { stdio: "ignore" });
    }
    chromePath = path;
    break;
  } catch {}
}

// Start Chrome in background (detached so Node can exit)
spawn(
  chromePath,
  [
    "--remote-debugging-port=9222",
    `--user-data-dir=${cacheDir}`,
  ],
  { detached: true, stdio: "ignore" },
).unref();

// Wait for Chrome to be ready by attempting to connect
let connected = false;
for (let i = 0; i < 30; i++) {
  try {
    const browser = await puppeteer.connect({
      browserURL: "http://localhost:9222",
      defaultViewport: null,
      protocolTimeout: 120000, // 2 分钟超时，与下载器保持一致
    });
    await browser.disconnect();
    connected = true;
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 500));
  }
}

if (!connected) {
  console.error("✗ Failed to connect to Chrome");
  process.exit(1);
}

console.log(
  `✓ Chrome started on :9222${useProfile ? " with your profile" : ""}`,
);
