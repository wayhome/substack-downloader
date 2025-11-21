# 📚 Substack Downloader

> 一键下载任意 Substack 站点的所有文章，自动生成带目录的 PDF 电子书

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen)](https://nodejs.org/)
[![Python Version](https://img.shields.io/badge/python-%3E%3D3.8-blue)](https://www.python.org/)

[English](README_EN.md) | 简体中文

## ✨ 特性

- 🌐 **支持所有 Substack 站点** - 适用于任何 Substack 博客
- 📑 **自动生成目录** - PDF 带有可点击的书签导航
- ⏰ **时间顺序排列** - 从最早到最新，完整记录
- 🗜️ **智能压缩** - 可减小 70-80% 文件大小，保持清晰度
- 💾 **断点续传** - 已下载的文章自动跳过
- 🎯 **完全自动化** - 一条命令搞定所有步骤
- 📊 **详细统计** - 实时进度、成功率、文件大小等

## 📸 演示

```bash
$ ./src/substack_downloader.js https://www.algos.org/

╔════════════════════════════════════════════════════════════╗
║              📚 Substack 下载器                            ║
╚════════════════════════════════════════════════════════════╝

🌐 目标站点: https://www.algos.org/
📁 输出目录: ./downloads/algos_org
🗜️  压缩质量: ebook

✓ 找到 67 篇文章 (2023-02 至 2025-11)
✓ PDF 打印完成: 67/67 (100%)
✓ 合并完成: 578 页, 67 个书签
✓ 压缩完成: 112MB → 21MB (↓81%)
```

## 📁 项目结构

```
substack-downloader/
├── src/
│   ├── substack_downloader.js   # 主程序 ⭐
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
- **Python** >= 3.10
- **Chrome/Chromium** 浏览器
- **Ghostscript** (用于压缩)
- **uv** - Python 包管理器（推荐，比 pip 快 10-100 倍）

> 💡 **关于 uv**: [uv](https://github.com/astral-sh/uv) 是新一代 Python 包管理器，用 Rust 编写，速度极快。如果你已习惯 pip，也可以继续使用 `pip install PyPDF2`。

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
# 基本用法
./src/substack_downloader.js https://example.substack.com

# 高质量版本（适合打印）
./src/substack_downloader.js https://example.substack.com --quality printer

# 自定义输出目录
./src/substack_downloader.js https://example.substack.com --output-dir ./my_books

# 跳过压缩（保留原始大小）
./src/substack_downloader.js https://example.substack.com --skip-compress
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
1. 访问站点          2. 滚动加载          3. 打印PDF
   Archive页面    →    所有文章列表    →    逐个访问打印
        ↓                                        ↓
4. 合并PDF          ←    5. 压缩优化    ←    生成单独PDF
   带目录书签              Ghostscript         (67个文件)
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
./src/substack_downloader.js <url> [options]

选项:
  --output-dir <dir>    输出目录 (默认: ./downloads/<站点名>)
  --skip-compress       跳过 PDF 压缩
  --quality <level>     压缩质量: screen, ebook, printer, prepress (默认: ebook)
  --help, -h           显示帮助信息
```

## 📁 输出结构

```
downloads/<站点名>/
├── articles.txt              # 文章 URL 列表
├── pdfs/                     # 单独的 PDF 文件
│   ├── 001_article-1.pdf
│   ├── 002_article-2.pdf
│   └── ...
├── <站点名>_complete.pdf     # 原始合并 PDF
└── <站点名>_compressed.pdf   # 压缩后 PDF (推荐)
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

