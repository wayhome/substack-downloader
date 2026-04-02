# 📚 Substack Downloader

> 一键下载任意 Substack 站点文章，支持生成 PDF / EPUB（或同时生成）

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen)](https://nodejs.org/)
[![Python Version](https://img.shields.io/badge/python-%3E%3D3.8-blue)](https://www.python.org/)

[English](README_EN.md) | 简体中文

## ✨ 特性

- 🌐 **支持所有 Substack 站点** - 适用于任何 Substack 博客
- 📘 **双格式输出** - 支持 `PDF`、`EPUB`、`PDF+EPUB`
- 📑 **自动生成目录** - PDF 带可点击书签，EPUB 带章节导航
- ⏰ **时间顺序排列** - 从最早到最新，完整记录
- 🖼️ **Kindle 友好图片处理** - EPUB 图片自动优化（`sharp`）
- 🗜️ **智能压缩** - 可减小 70-80% 文件大小，保持清晰度
- 💾 **断点续传** - 已下载的文章自动跳过
- 🔁 **内置重试机制** - 发现与渲染阶段支持失败自动重试
- 📊 **详细统计** - 实时进度、成功率、文件大小、重试次数等

## 📸 演示

```bash
$ node src/cli.js https://www.algos.org --format both --quality ebook

╔════════════════════════════════════════════════════════════╗
║              📚 Substack 下载器                            ║
╚════════════════════════════════════════════════════════════╝

🌐 目标站点: https://www.algos.org/
📁 输出目录: ./downloads/algos_org
🧾 输出格式: BOTH
🔁 重试次数: 3

✓ 找到 67 篇文章 (2023-02 至 2025-11)
✓ PDF 生成完成
✓ EPUB 生成完成: ./downloads/algos_org/algos_org.epub
```

## 📁 项目结构

```
substack-downloader/
├── src/
│   ├── cli.js                    # 统一入口（--format）⭐
│   ├── substack_downloader.js    # 兼容入口（默认 PDF）
│   ├── substack_epub.js          # EPUB 入口（默认 EPUB）
│   ├── renderers/                # PDF / EPUB 渲染器
│   ├── lib/                      # 浏览器/发现/重试公共库
│   ├── epub_generator.js         # EPUB 生成器
│   ├── start.js                  # Chrome 启动器
│   ├── merge_pdfs.py             # PDF 合并
│   └── compress_pdf.py           # PDF 压缩
├── examples/
│   └── batch_download.sh         # 批量下载示例
├── README.md                     # 项目说明（中文）
├── README_EN.md                  # 项目说明（英文）
└── FIRST_TIME_SETUP.md          # 首次登录指南
```

## 🚀 快速开始

### 前置要求

- **Node.js** >= 16.0.0
- **Chrome/Chromium** 浏览器
- **Python** >= 3.10（仅 PDF 流程需要）
- **Ghostscript**（仅 PDF 压缩需要）
- **uv**（仅 PDF 流程需要，推荐）

> 💡 如果你只导出 EPUB，可先不安装 Python/uv/Ghostscript。

### 安装

```bash
# 1. 克隆仓库
git clone https://github.com/wayhome/substack-downloader.git
cd substack-downloader

# 2. 安装 pnpm（如果还没有）
npm install -g pnpm

# 3. 安装项目依赖
pnpm install

# 4. 安装 uv (Python 包管理器)
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh
# 或使用 Homebrew (macOS)
brew install uv

# 5. 安装 Python 依赖
uv pip install PyPDF2
# 或使用传统 pip
pip install PyPDF2

# 6. 安装 Ghostscript (macOS)
brew install ghostscript

# Linux (Ubuntu/Debian)
# sudo apt-get install ghostscript

# 7. 添加执行权限
chmod +x src/*.js src/*.sh
```

### 使用方法

#### ⚠️ 首次使用必读

**第一次运行前，需要先手动登录：**

```bash
# 1. 启动 Chrome（会保持浏览器打开）
node src/start.js --profile

# 2. 在打开的 Chrome 中手动登录 Substack 站点
#    登录后关闭 Chrome

# 3. 之后运行下载器会自动使用登录状态
```

> 💡 使用 `--profile` 参数会复制你的 Chrome 配置（包括登录状态、Cookies），确保可以访问付费/登录内容。

#### 命令行使用

```bash
# 1) 旧入口（默认 PDF）
node src/substack_downloader.js https://example.substack.com

# 2) EPUB 入口（默认 EPUB）
node src/substack_epub.js https://example.substack.com

# 3) 统一入口（推荐）
node src/cli.js https://example.substack.com --format both --retries 3

# 仅 EPUB
node src/cli.js https://example.substack.com --format epub

# 仅 EPUB（强制刷新章节缓存）
node src/cli.js https://example.substack.com --format epub --refresh-epub-cache

# 仅 PDF（高质量）
node src/cli.js https://example.substack.com --format pdf --quality printer
```

## 📖 文档

- [首次使用指南](FIRST_TIME_SETUP.md) - 登录设置教程 ⭐
- [更新日志](CHANGELOG.md) - 版本历史
- [贡献指南](CONTRIBUTING.md) - 如何参与开发

## 🎯 实际案例

### 案例 1: The Quant Stack

```bash
./src/substack_downloader.js https://www.algos.org/
```

**结果:**
- 📚 67 篇文章
- 📄 578 页
- 💾 原始: 112 MB → 压缩: 21 MB (↓81%)
- ⏱️ 用时: ~8 分钟

### 案例 2: Stratechery  

```bash
./src/substack_downloader.js https://stratechery.com/
```

**结果:**
- 📚 150 篇文章
- 📄 890 页  
- 💾 原始: 145 MB → 压缩: 38 MB (↓74%)
- ⏱️ 用时: ~12 分钟

## 🛠️ 工作原理

```
1. 发现文章（archive + sitemap）并按时间排序
2. 根据 --format 路由到渲染器
   ├─ PDF: 逐篇打印 -> 合并目录 -> 可选压缩
   └─ EPUB: 抽取正文 -> 下载/优化图片 -> 打包 EPUB
3. 输出统计信息（成功率、重试次数、产物路径）
```

## 📊 压缩质量对比

| 质量级别 | DPI | 文件大小 | 适用场景 |
|---------|-----|---------|---------|
| screen | 72 | 最小 | 快速预览 |
| **ebook** | **150** | **小（推荐）** | **屏幕阅读** |
| printer | 300 | 中等 | 打印输出 |
| prepress | 300+ | 较大 | 专业印刷 |

## 🔧 配置选项

```bash
node src/cli.js <url> [options]

选项:
  --output-dir <dir>    输出目录 (默认: ./downloads/<站点名>)
  --format <mode>       输出格式: pdf | epub | both (默认: pdf)
  --retries <n>         网络与渲染重试次数，0-10 (默认: 3)
  --refresh-epub-cache  强制忽略 EPUB 章节缓存并重新抓取
  --skip-compress       跳过 PDF 压缩（仅 PDF/both 生效）
  --quality <level>     PDF 压缩质量: screen, ebook, printer, prepress (默认: ebook)
  --help, -h            显示帮助信息
```

## 📁 输出结构

```
downloads/<站点名>/
├── articles.txt              # 文章 URL 列表
├── <站点名>.epub             # EPUB 输出（epub/both 模式）
├── pdfs/                     # 单独的 PDF 文件
│   ├── 001_article-1.pdf
│   ├── 002_article-2.pdf
│   └── ...
├── <站点名>_complete.pdf     # 原始合并 PDF（pdf/both 模式）
├── <站点名>_compressed.pdf   # 压缩后 PDF（可选）
└── .cache/                   # 图片与运行缓存
    └── epub/
        ├── manifest.json     # 章节缓存索引
        └── chapters/*.json   # 单篇章节缓存（用于下次跳过重抓）
```

## 🤝 贡献

欢迎贡献！请查看 [贡献指南](CONTRIBUTING.md)。

### 开发

```bash
# 运行测试
npm test

# 代码格式化
npm run format

# Lint 检查
npm run lint
```

## ⚠️ 免责声明

- 请尊重内容版权，仅用于个人学习和备份
- 下载大量内容可能需要较长时间
- 部分付费内容可能需要登录才能下载
- 请合理使用，避免对服务器造成过大负担

## 📝 许可证

[MIT License](LICENSE) © 2025

## 🙏 致谢

- [Puppeteer](https://pptr.dev/) - Chrome 自动化
- [PyPDF2](https://pypdf2.readthedocs.io/) - PDF 处理
- [Ghostscript](https://www.ghostscript.com/) - PDF 压缩
- 所有贡献者

## 🔗 相关链接

- [报告问题](https://github.com/wayhome/substack-downloader/issues)
- [功能建议](https://github.com/wayhome/substack-downloader/discussions)
- [更新日志](CHANGELOG.md)

## 📮 联系方式

有问题或建议？欢迎：
- 提交 [Issue](https://github.com/wayhome/substack-downloader/issues)
- 发起 [Discussion](https://github.com/wayhome/substack-downloader/discussions)

---

⭐ 如果这个项目对你有帮助，请给个 Star！
