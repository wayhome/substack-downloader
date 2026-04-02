import puppeteer from "puppeteer-core";

export async function connectToChrome() {
  return puppeteer.connect({
    browserURL: "http://localhost:9222",
    defaultViewport: null,
    protocolTimeout: 120000,
  });
}

export async function getConfiguredPage(browser) {
  const pages = await browser.pages();
  const page = pages[0] || (await browser.newPage());

  await page.emulateMediaType("screen");
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);

  return page;
}
