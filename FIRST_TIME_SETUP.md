# 🚀 首次使用指南

## ⚠️ 重要：首次使用需要登录

如果你要下载**付费内容**或**需要登录的文章**，请在第一次使用前完成登录设置。
公开站点可跳过本指南，直接运行下载命令。

## 📋 快速步骤

### 1️⃣ 启动浏览器（带登录状态）

```bash
node src/start.js --profile
```

这会：
- 启动 Chrome 浏览器
- 复制你的 Chrome 配置（包括 Cookies 和登录状态）
- 保持浏览器打开，等待你操作

### 2️⃣ 登录 Substack

在打开的浏览器中：
1. 访问你要下载的 Substack 站点
2. 点击右上角登录
3. 输入邮箱和密码完成登录
4. 确认登录成功后，**关闭浏览器**

### 3️⃣ 开始下载（任选一种入口）

登录完成后，正常运行下载器：

```bash
# 统一入口（推荐）
node src/cli.js https://example.substack.com --format both

# PDF 入口（兼容旧命令）
node src/substack_downloader.js https://example.substack.com

# EPUB 入口
node src/substack_epub.js https://example.substack.com
```

下载器会自动使用你的登录状态！

## 🧭 入口说明

- `node src/cli.js`：统一入口，支持 `--format pdf|epub|both`
- `node src/substack_downloader.js`：默认输出 PDF
- `node src/substack_epub.js`：默认输出 EPUB

## 🔐 登录状态保持

- 登录状态会保存在 `~/.cache/scraping/` 目录
- 下次使用时无需重新登录
- 如果登录过期，重复上述步骤即可

## 💡 提示

### 对于公开内容
如果站点完全公开（不需要登录），可以跳过登录步骤：

```bash
# 直接下载公开内容（示例：仅 EPUB）
node src/cli.js https://public-site.substack.com --format epub
```

### 对于付费内容
- 确保你已订阅该站点
- 使用订阅邮箱登录
- 某些站点可能有额外的访问限制


## ❓ 常见问题

**Q: 为什么需要登录？**  
A: 很多 Substack 站点有付费内容，需要登录后才能访问完整文章。

**Q: 登录安全吗？**  
A: 完全安全。登录信息只保存在你的本地电脑（`~/.cache/scraping/`），不会上传到任何地方。

**Q: 可以跳过登录吗？**  
A: 可以。对于完全公开的站点，直接运行下载器即可，不需要登录。

**Q: 登录后能下载多久？**  
A: 取决于站点的 Cookie 过期时间，通常为几天到几周。过期后重新登录即可。

---

完成登录设置后，查看 [README.md](README.md) / [README_EN.md](README_EN.md) 了解完整参数与输出格式说明。
