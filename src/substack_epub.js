#!/usr/bin/env node

import { runCli } from "./cli.js";

try {
  await runCli({
    commandName: "substack_epub.js",
    defaultFormat: "epub",
  });
} catch (error) {
  console.error(`❌ 执行失败: ${error.message}`);
  process.exitCode = 1;
}

