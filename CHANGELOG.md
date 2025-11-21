# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-11-21

### 🚀 Added
- **More aggressive scrolling**: Increased scroll timeout to 5000ms and threshold to 15 attempts for better article loading
- **Prioritize Archive Page**: Now navigates to `/archive` page first for more reliable article discovery
- **Detailed logging**: Added scroll progress indicator, earliest article date, and preview of latest 3 articles
- **PDF printing progress bar**: Real-time progress indicator during PDF generation
- **Enhanced completion statistics**: Detailed summary including success/failure count, file sizes, and output paths
- **First-time login guide**: Added clear instructions for users to login before downloading paid/restricted content
- **Cross-platform support**: Chrome launcher now works on macOS, Linux, and Windows
- **pnpm support**: Switched to pnpm package manager for better dependency management

### 🐛 Fixed
- Fixed incomplete article list loading issue (was only getting latest page)
- Improved stability for sites with large numbers of articles (tested with 264 and 67 articles)
- Better handling of dynamically loaded content
- Removed hardcoded user paths - now uses environment variables

### 🔧 Changed
- Increased `maxScrollAttempts` from 100 to 300 for more thorough article collection
- Updated default scroll wait time from 3000ms to 5000ms
- Improved error messages and user feedback
- Simplified documentation structure (removed verbose docs, kept only core README files)
- Updated `start.js` to auto-detect Chrome paths across platforms

## [1.0.0] - 2025-11-20

### 🎉 Initial Release

#### Features
- ✅ Download all articles from any Substack site
- ✅ Generate individual PDFs for each article
- ✅ Merge all PDFs with automatic table of contents (bookmarks)
- ✅ Compress PDFs with Ghostscript (70-80% size reduction)
- ✅ Support for multiple compression quality levels
- ✅ Resume capability (skip already downloaded PDFs)
- ✅ Chronological ordering (oldest to newest)
- ✅ Command-line interface with options
- ✅ Interactive quick-start script
- ✅ Comprehensive documentation

#### Components
- `substack_downloader.js`: Main orchestration script
- `merge_pdfs.py`: PDF merging with bookmark generation
- `compress_pdf.py`: PDF compression using Ghostscript
- `start.js`: Chrome launcher with remote debugging

#### Tested Sites
- ✅ stratechery.com (150 articles, 890 pages, 145MB → 38MB)
- ✅ algos.org (67 articles, 578 pages, 112MB → 21MB)

---

## Version History

- **v1.1.0** (2025-11-21): Enhanced article collection and progress tracking
- **v1.0.0** (2025-11-20): Initial stable release

## Roadmap

### Planned for v1.2.0
- [ ] Better error recovery and retry mechanisms
- [ ] Custom PDF styling options
- [ ] Export to other formats (EPUB, MOBI)
- [ ] Web UI for easier usage

### Future Considerations
- [ ] Multi-threading for faster downloads
- [ ] Cloud storage integration
- [ ] Docker container support
- [ ] GUI application
- [ ] Browser extension

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to contribute to this changelog and the project.

