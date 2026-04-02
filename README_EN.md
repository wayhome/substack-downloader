# 📚 Substack Downloader

> Download any Substack publication and generate PDF / EPUB (or both) in one run

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen)](https://nodejs.org/)
[![Python Version](https://img.shields.io/badge/python-%3E%3D3.8-blue)](https://www.python.org/)

English | [简体中文](README.md)

## ✨ Features

- 🌐 **Works with all Substack sites** - Compatible with any Substack blog
- 📘 **Dual output formats** - `PDF`, `EPUB`, or `PDF+EPUB`
- 📑 **Auto-generated navigation** - PDF bookmarks + EPUB chapter TOC
- ⏰ **Chronological order** - From oldest to newest, complete archive
- 🖼️ **Kindle-friendly image pipeline** - EPUB images optimized with `sharp`
- 🗜️ **Smart compression** - Reduce file size by 70-80% while maintaining clarity
- 💾 **Resume capability** - Skip already downloaded articles
- 🔁 **Built-in retries** - Discovery and rendering stages can auto-retry
- 📊 **Detailed statistics** - Progress, success rate, file size, retries, output paths

## 📸 Demo

```bash
$ node src/cli.js https://www.algos.org --format both --quality ebook

╔════════════════════════════════════════════════════════════╗
║              📚 Substack Downloader                        ║
╚════════════════════════════════════════════════════════════╝

🌐 Target: https://www.algos.org/
📁 Output: ./downloads/algos_org
🧾 Format: BOTH
🔁 Retries: 3

✓ Found 67 articles (2023-02 to 2025-11)
✓ PDF generation completed
✓ EPUB generated: ./downloads/algos_org/algos_org.epub
```

## 📁 Project Structure

```
substack-downloader/
├── src/
│   ├── cli.js                    # Unified entry (--format) ⭐
│   ├── substack_downloader.js    # Compatibility entry (default PDF)
│   ├── substack_epub.js          # EPUB entry (default EPUB)
│   ├── renderers/                # PDF / EPUB renderers
│   ├── lib/                      # Shared browser/discovery/retry libs
│   ├── epub_generator.js         # EPUB generator
│   ├── start.js                  # Chrome launcher
│   ├── merge_pdfs.py             # PDF merging
│   └── compress_pdf.py           # PDF compression
├── examples/
│   └── batch_download.sh         # Batch download example
├── README.md                     # Documentation (Chinese)
├── README_EN.md                  # Documentation (English)
└── FIRST_TIME_SETUP.md          # First-time setup guide
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** >= 16.0.0
- **Chrome/Chromium** browser
- **Python** >= 3.10 (PDF pipeline only)
- **Ghostscript** (PDF compression only)
- **uv** (PDF pipeline only, recommended)

> 💡 If you export EPUB only, you can skip Python/uv/Ghostscript for now.

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/wayhome/substack-downloader.git
cd substack-downloader

# 2. Install pnpm (if not already installed)
npm install -g pnpm

# 3. Install project dependencies
pnpm install

# 4. Install uv (Python package manager)
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh
# Or using Homebrew (macOS)
brew install uv

# 5. Install Python dependencies
uv pip install PyPDF2
# Or use traditional pip
pip install PyPDF2

# 6. Install Ghostscript (macOS)
brew install ghostscript

# Linux (Ubuntu/Debian)
# sudo apt-get install ghostscript

# 7. Make scripts executable
chmod +x src/*.js src/*.sh
```

### Usage

#### ⚠️ First-Time Setup

**Before first run, login manually:**

```bash
# 1. Start Chrome with your profile (browser stays open)
node src/start.js --profile

# 2. Manually login to your Substack site in the opened Chrome
#    Close Chrome after logging in

# 3. The downloader will automatically use your login session
```

> 💡 Using `--profile` copies your Chrome configuration (including login status and cookies), ensuring access to paid/restricted content.

#### Command Line Usage

```bash
# 1) Legacy entry (defaults to PDF)
node src/substack_downloader.js https://example.substack.com

# 2) EPUB entry (defaults to EPUB)
node src/substack_epub.js https://example.substack.com

# 3) Unified entry (recommended)
node src/cli.js https://example.substack.com --format both --retries 3

# EPUB only
node src/cli.js https://example.substack.com --format epub

# EPUB only (force refresh chapter cache)
node src/cli.js https://example.substack.com --format epub --refresh-epub-cache

# PDF only (high quality)
node src/cli.js https://example.substack.com --format pdf --quality printer
```

## 📖 Documentation

- [First-Time Setup Guide](FIRST_TIME_SETUP.md) - Login tutorial ⭐
- [Changelog](CHANGELOG.md) - Version history
- [Contributing](CONTRIBUTING.md) - How to contribute

## 🎯 Real-world Examples

### Example 1: The Quant Stack

```bash
./src/substack_downloader.js https://www.algos.org/
```

**Results:**
- 📚 67 articles
- 📄 578 pages
- 💾 Original: 112 MB → Compressed: 21 MB (↓81%)
- ⏱️ Time: ~8 minutes

### Example 2: Stratechery  

```bash
./src/substack_downloader.js https://stratechery.com/
```

**Results:**
- 📚 150 articles
- 📄 890 pages  
- 💾 Original: 145 MB → Compressed: 38 MB (↓74%)
- ⏱️ Time: ~12 minutes

## 🛠️ How It Works

```
1. Discover posts (archive + sitemap), then sort chronologically
2. Route by --format
   ├─ PDF: render each post -> merge bookmarks -> optional compression
   └─ EPUB: extract article HTML -> download/optimize images -> package EPUB
3. Print summary stats (success rate, retries, output files)
```

## 📊 Compression Quality Comparison

| Quality Level | DPI | File Size | Use Case |
|--------------|-----|-----------|----------|
| screen | 72 | Smallest | Quick preview |
| **ebook** | **150** | **Small (recommended)** | **Screen reading** |
| printer | 300 | Medium | Print output |
| prepress | 300+ | Larger | Professional printing |

## 🔧 Configuration Options

```bash
node src/cli.js <url> [options]

Options:
  --output-dir <dir>    Output directory (default: ./downloads/<site-name>)
  --format <mode>       Output format: pdf | epub | both (default: pdf)
  --retries <n>         Retry count for network/rendering, 0-10 (default: 3)
  --refresh-epub-cache  Force ignore EPUB chapter cache and refetch
  --skip-compress       Skip PDF compression (PDF/both only)
  --quality <level>     PDF compression quality: screen, ebook, printer, prepress (default: ebook)
  --help, -h            Show help message
```

## 📁 Output Structure

```
downloads/<site-name>/
├── articles.txt              # List of article URLs
├── <site-name>.epub          # EPUB output (epub/both mode)
├── pdfs/                     # Individual PDF files
│   ├── 001_article-1.pdf
│   ├── 002_article-2.pdf
│   └── ...
├── <site-name>_complete.pdf     # Original merged PDF (pdf/both mode)
├── <site-name>_compressed.pdf   # Compressed PDF (optional)
└── .cache/                      # Image/runtime cache
    └── epub/
        ├── manifest.json        # Chapter cache manifest
        └── chapters/*.json      # Per-article chapter cache
```

## 🤝 Contributing

Contributions are welcome! Please check out the [Contributing Guide](CONTRIBUTING.md).

### Development

```bash
# Run tests
npm test

# Format code
npm run format

# Lint checks
npm run lint
```

## ⚠️ Disclaimer

- Please respect content copyright, use only for personal learning and backup
- Downloading large amounts of content may take considerable time
- Some paid content may require login to download
- Use responsibly to avoid overloading servers

## 📝 License

[MIT License](LICENSE) © 2025

## 🙏 Acknowledgments

- [Puppeteer](https://pptr.dev/) - Chrome automation
- [PyPDF2](https://pypdf2.readthedocs.io/) - PDF processing
- [Ghostscript](https://www.ghostscript.com/) - PDF compression
- All contributors

## 🔗 Related Links

- [Report Issues](https://github.com/wayhome/substack-downloader/issues)
- [Feature Requests](https://github.com/wayhome/substack-downloader/discussions)
- [Changelog](CHANGELOG.md)

## 📮 Contact

Questions or suggestions? Feel free to:
- Submit an [Issue](https://github.com/wayhome/substack-downloader/issues)
- Start a [Discussion](https://github.com/wayhome/substack-downloader/discussions)

---

⭐ If this project helps you, please give it a Star!
