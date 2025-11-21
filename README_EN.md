# 📚 Substack Downloader

> Download all articles from any Substack site and automatically generate a PDF ebook with table of contents

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen)](https://nodejs.org/)
[![Python Version](https://img.shields.io/badge/python-%3E%3D3.8-blue)](https://www.python.org/)

English | [简体中文](README.md)

## ✨ Features

- 🌐 **Works with all Substack sites** - Compatible with any Substack blog
- 📑 **Auto-generate TOC** - PDF with clickable bookmarks for navigation
- ⏰ **Chronological order** - From oldest to newest, complete archive
- 🗜️ **Smart compression** - Reduce file size by 70-80% while maintaining clarity
- 💾 **Resume capability** - Skip already downloaded articles
- 🎯 **Fully automated** - One command does everything
- 📊 **Detailed statistics** - Real-time progress, success rate, file sizes, etc.

## 📸 Demo

```bash
$ ./src/substack_downloader.js https://www.algos.org/

╔════════════════════════════════════════════════════════════╗
║              📚 Substack Downloader                        ║
╚════════════════════════════════════════════════════════════╝

🌐 Target: https://www.algos.org/
📁 Output: ./downloads/algos_org
🗜️  Quality: ebook

✓ Found 67 articles (2023-02 to 2025-11)
✓ PDF generation: 67/67 (100%)
✓ Merge complete: 578 pages, 67 bookmarks
✓ Compression: 112MB → 21MB (↓81%)
```

## 📁 Project Structure

```
substack-downloader/
├── src/
│   ├── substack_downloader.js   # Main program ⭐
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
- **Python** >= 3.10
- **Chrome/Chromium** browser
- **Ghostscript** (for compression)
- **uv** - Python package manager (recommended, 10-100x faster than pip)

> 💡 **About uv**: [uv](https://github.com/astral-sh/uv) is a next-generation Python package manager written in Rust, blazingly fast. If you prefer pip, you can still use `pip install PyPDF2`.

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
# Basic usage
./src/substack_downloader.js https://example.substack.com

# High quality (for printing)
./src/substack_downloader.js https://example.substack.com --quality printer

# Custom output directory
./src/substack_downloader.js https://example.substack.com --output-dir ./my_books

# Skip compression (keep original size)
./src/substack_downloader.js https://example.substack.com --skip-compress
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
1. Visit site         2. Scroll & load      3. Print PDFs
   Archive page    →    All articles    →    Visit each article
        ↓                                        ↓
4. Merge PDFs       ←    5. Compress      ←    Individual PDFs
   With bookmarks          Ghostscript         (67 files)
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
./src/substack_downloader.js <url> [options]

Options:
  --output-dir <dir>    Output directory (default: ./downloads/<site-name>)
  --skip-compress       Skip PDF compression
  --quality <level>     Compression quality: screen, ebook, printer, prepress (default: ebook)
  --help, -h           Show help message
```

## 📁 Output Structure

```
downloads/<site-name>/
├── articles.txt              # List of article URLs
├── pdfs/                     # Individual PDF files
│   ├── 001_article-1.pdf
│   ├── 002_article-2.pdf
│   └── ...
├── <site-name>_complete.pdf     # Original merged PDF
└── <site-name>_compressed.pdf   # Compressed PDF (recommended)
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

