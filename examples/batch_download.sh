#!/bin/bash

# Batch Download Script for Multiple Substack Sites
# Usage: ./examples/batch_download.sh

# 配置颜色输出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 要下载的站点列表
SITES=(
  "https://www.algos.org/"
  "https://stratechery.com/"
  "https://noahpinion.substack.com/"
  # 添加更多站点...
)

# 配置选项
OUTPUT_BASE_DIR="./downloads"
QUALITY="ebook"
DELAY_BETWEEN_SITES=10  # 站点之间的延迟（秒）

# 统计变量
TOTAL_SITES=${#SITES[@]}
SUCCESSFUL=0
FAILED=0

echo "╔════════════════════════════════════════════════════════════╗"
echo "║          📚 批量 Substack 下载器                           ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 总站点数: $TOTAL_SITES"
echo "📁 输出目录: $OUTPUT_BASE_DIR"
echo "🗜️  压缩质量: $QUALITY"
echo "⏱️  站点间延迟: ${DELAY_BETWEEN_SITES}秒"
echo ""

# 开始时间
START_TIME=$(date +%s)

# 遍历站点列表
for i in "${!SITES[@]}"; do
  SITE="${SITES[$i]}"
  SITE_NUM=$((i + 1))
  
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}[${SITE_NUM}/${TOTAL_SITES}] 正在下载: ${SITE}${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  
  # 执行下载
  if ./src/substack_downloader.js "$SITE" --quality "$QUALITY"; then
    echo -e "${GREEN}✓ 完成: ${SITE}${NC}"
    SUCCESSFUL=$((SUCCESSFUL + 1))
  else
    echo -e "${YELLOW}✗ 失败: ${SITE}${NC}"
    FAILED=$((FAILED + 1))
  fi
  
  echo ""
  
  # 如果不是最后一个站点，添加延迟
  if [ $SITE_NUM -lt $TOTAL_SITES ]; then
    echo -e "${YELLOW}⏸️  等待 ${DELAY_BETWEEN_SITES} 秒后继续...${NC}"
    sleep $DELAY_BETWEEN_SITES
    echo ""
  fi
done

# 结束时间
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
MINUTES=$((DURATION / 60))
SECONDS=$((DURATION % 60))

# 最终统计
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                    📊 下载统计                              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "✅ 成功: $SUCCESSFUL"
echo "❌ 失败: $FAILED"
echo "📝 总计: $TOTAL_SITES"
echo "⏱️  总用时: ${MINUTES}分${SECONDS}秒"
echo ""

# 失败站点列表（如果有）
if [ $FAILED -gt 0 ]; then
  echo "失败的站点："
  for i in "${!SITES[@]}"; do
    SITE="${SITES[$i]}"
    # 这里可以添加检查逻辑
  done
fi

echo "所有站点下载完成！"

