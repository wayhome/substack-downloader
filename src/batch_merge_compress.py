#!/usr/bin/env python3
"""
批量合并和压缩PDF文件
每125个PDF合并成一个带书签的PDF，并压缩为ebook质量
"""

import os
import sys
import re
import subprocess
from pathlib import Path

try:
    from PyPDF2 import PdfMerger, PdfReader
except ImportError:
    print("❌ 需要安装 PyPDF2: uv pip install PyPDF2")
    sys.exit(1)


def extract_title_from_filename(filename):
    """从文件名提取文章标题"""
    name = filename.stem
    # 移除数字前缀
    match = re.match(r'^\d+_(.+)$', name)
    if match:
        title = match.group(1)
        # 将连字符替换为空格，并转换为标题格式
        title = title.replace('-', ' ').replace('_', ' ')
        # 首字母大写
        title = ' '.join(word.capitalize() for word in title.split())
        return title
    return name


def merge_pdfs_batch(pdf_files, output_file):
    """合并一批PDF文件并生成目录"""

    print(f"\n📚 合并 {len(pdf_files)} 个PDF文件到: {output_file}")

    merger = PdfMerger()
    current_page = 0

    for i, pdf_file in enumerate(pdf_files, 1):
        try:
            # 读取PDF以获取页数
            reader = PdfReader(str(pdf_file))
            num_pages = len(reader.pages)

            # 提取标题
            title = extract_title_from_filename(pdf_file)

            print(f"   [{i}/{len(pdf_files)}] {title} ({num_pages} 页)")

            # 添加文件并创建书签
            merger.append(str(pdf_file))
            merger.add_outline_item(title, current_page)

            current_page += num_pages

        except Exception as e:
            print(f"   ⚠️  跳过损坏的文件: {pdf_file.name} ({e})")
            continue

    # 保存合并后的PDF
    try:
        merger.write(str(output_file))
        merger.close()

        # 获取文件大小
        file_size = output_file.stat().st_size / (1024 * 1024)  # MB

        print(f"   ✅ 合并完成: {file_size:.2f} MB, {current_page} 页")
        return True

    except Exception as e:
        print(f"   ❌ 合并失败: {e}")
        return False


def compress_pdf_gs(input_file, output_file, quality='ebook'):
    """使用Ghostscript压缩PDF"""

    input_path = Path(input_file)
    output_path = Path(output_file)

    # 获取原始文件大小
    original_size = input_path.stat().st_size / (1024 * 1024)  # MB

    print(f"\n🔧 正在压缩: {input_path.name}")
    print(f"   原始大小: {original_size:.2f} MB")

    # 根据文件大小动态计算超时时间
    base_timeout = 300  # 5分钟
    additional_timeout = max(0, (original_size - 100) / 100) * 300
    timeout_seconds = max(600, min(base_timeout + additional_timeout, 7200))

    # Ghostscript命令
    gs_command = [
        'gs',
        '-sDEVICE=pdfwrite',
        '-dCompatibilityLevel=1.4',
        f'-dPDFSETTINGS=/{quality}',
        '-dNOPAUSE',
        '-dQUIET',
        '-dBATCH',
        '-dDetectDuplicateImages=true',
        '-dCompressFonts=true',
        '-r150',
        f'-sOutputFile={output_path}',
        str(input_path)
    ]

    try:
        result = subprocess.run(gs_command, capture_output=True, text=True, timeout=int(timeout_seconds))

        if result.returncode != 0:
            print(f"   ❌ Ghostscript错误: {result.stderr}")
            return False

        # 获取压缩后文件大小
        compressed_size = output_path.stat().st_size / (1024 * 1024)
        reduction = ((original_size - compressed_size) / original_size) * 100

        print(f"   ✅ 压缩完成: {compressed_size:.2f} MB (减小 {reduction:.1f}%)")

        # 删除未压缩的原文件
        input_path.unlink()

        return True

    except subprocess.TimeoutExpired:
        print("   ❌ 压缩超时")
        return False
    except FileNotFoundError:
        print("   ❌ 未找到Ghostscript，请安装: brew install ghostscript")
        return False
    except Exception as e:
        print(f"   ❌ 压缩失败: {e}")
        return False


def batch_merge_and_compress(pdf_dir, batch_size=125, output_dir=None):
    """
    批量合并和压缩PDF文件

    Args:
        pdf_dir: PDF文件所在目录
        batch_size: 每批合并的文件数量
        output_dir: 输出目录（默认与输入目录相同）
    """

    pdf_dir_path = Path(pdf_dir)

    if not pdf_dir_path.exists():
        print(f"❌ 目录不存在: {pdf_dir}")
        return False

    # 获取所有PDF文件并排序
    pdf_files = sorted(pdf_dir_path.glob('*.pdf'))

    if not pdf_files:
        print(f"❌ 目录中没有找到PDF文件: {pdf_dir}")
        return False

    # 设置输出目录
    if output_dir is None:
        output_dir = pdf_dir_path
    else:
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

    total_files = len(pdf_files)
    total_batches = (total_files + batch_size - 1) // batch_size

    print(f"{'='*60}")
    print(f"📦 批量合并和压缩PDF")
    print(f"{'='*60}")
    print(f"   总文件数: {total_files}")
    print(f"   每批数量: {batch_size}")
    print(f"   批次数量: {total_batches}")
    print(f"   输出目录: {output_dir}")
    print(f"{'='*60}")

    success_count = 0

    # 分批处理
    for batch_num in range(total_batches):
        start_idx = batch_num * batch_size
        end_idx = min(start_idx + batch_size, total_files)
        batch_files = pdf_files[start_idx:end_idx]

        print(f"\n\n{'='*60}")
        print(f"📂 批次 {batch_num + 1}/{total_batches}")
        print(f"   文件范围: {start_idx + 1} - {end_idx}")
        print(f"{'='*60}")

        # 生成输出文件名
        temp_merged = output_dir / f"batch_{batch_num + 1:03d}_temp.pdf"
        final_output = output_dir / f"batch_{batch_num + 1:03d}_compressed.pdf"

        # 步骤1: 合并PDF
        if merge_pdfs_batch(batch_files, temp_merged):
            # 步骤2: 压缩PDF
            if compress_pdf_gs(temp_merged, final_output):
                success_count += 1
                print(f"   🎉 批次 {batch_num + 1} 完成!")
            else:
                print(f"   ⚠️  批次 {batch_num + 1} 压缩失败")
                # 如果压缩失败，保留未压缩的文件
                if temp_merged.exists():
                    temp_merged.rename(final_output)
        else:
            print(f"   ⚠️  批次 {batch_num + 1} 合并失败")

    # 最终统计
    print(f"\n\n{'='*60}")
    print(f"🏁 处理完成!")
    print(f"{'='*60}")
    print(f"   成功: {success_count}/{total_batches} 批次")
    print(f"   输出目录: {output_dir.absolute()}")
    print(f"{'='*60}")

    return success_count == total_batches


if __name__ == '__main__':
    # 默认参数
    pdf_dir = 'downloads/onepagecode/pdfs'
    batch_size = 125
    output_dir = None

    # 命令行参数
    if len(sys.argv) > 1:
        pdf_dir = sys.argv[1]
    if len(sys.argv) > 2:
        batch_size = int(sys.argv[2])
    if len(sys.argv) > 3:
        output_dir = sys.argv[3]

    print(f"""
用法: python batch_merge_compress.py [pdf_dir] [batch_size] [output_dir]

参数:
  pdf_dir     : PDF文件目录 (默认: downloads/onepagecode/pdfs)
  batch_size  : 每批合并数量 (默认: 125)
  output_dir  : 输出目录 (默认: 与输入目录相同)

示例:
  python batch_merge_compress.py
  python batch_merge_compress.py downloads/onepagecode/pdfs 100
  python batch_merge_compress.py downloads/onepagecode/pdfs 125 output
""")

    batch_merge_and_compress(pdf_dir, batch_size, output_dir)
