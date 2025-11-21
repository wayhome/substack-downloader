#!/usr/bin/env python3
"""
合并所有PDF文件为一个完整的PDF，并生成目录（书签）
"""

import os
import sys
import re
from pathlib import Path

try:
    from PyPDF2 import PdfMerger, PdfReader
except ImportError:
    print("❌ 需要安装 PyPDF2: uv pip install PyPDF2")
    sys.exit(1)

def extract_title_from_filename(filename):
    """从文件名提取文章标题"""
    # 移除编号前缀和.pdf后缀
    # 格式: 001_article-title.pdf -> article-title
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

def merge_pdfs_with_toc(pdf_dir='pdfs', output_file='Substack_Complete.pdf'):
    """合并指定目录下的所有PDF文件，并生成目录"""
    
    pdf_dir_path = Path(pdf_dir)
    
    if not pdf_dir_path.exists():
        print(f"❌ 目录不存在: {pdf_dir}")
        return False
    
    # 获取所有PDF文件并排序
    pdf_files = sorted(pdf_dir_path.glob('*.pdf'))
    
    if not pdf_files:
        print(f"❌ 目录中没有找到PDF文件: {pdf_dir}")
        return False
    
    print(f"📚 找到 {len(pdf_files)} 个PDF文件")
    print(f"📝 开始合并并生成目录...")
    
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
            # 在当前页位置添加书签
            merger.add_outline_item(title, current_page)
            
            current_page += num_pages
            
        except Exception as e:
            print(f"   ⚠️  跳过损坏的文件: {pdf_file.name} ({e})")
            continue
    
    # 保存合并后的PDF
    output_path = Path(output_file)
    print(f"\n💾 正在保存到: {output_path.absolute()}")
    
    try:
        merger.write(str(output_path))
        merger.close()
        
        # 获取文件大小
        file_size = output_path.stat().st_size / (1024 * 1024)  # MB
        
        print(f"\n{'='*60}")
        print(f"✅ 合并完成!")
        print(f"   文件: {output_path.absolute()}")
        print(f"   大小: {file_size:.2f} MB")
        print(f"   总页数: {current_page}")
        print(f"   书签数: {len(pdf_files)}")
        print(f"{'='*60}")
        return True
        
    except Exception as e:
        print(f"❌ 保存失败: {e}")
        return False

if __name__ == '__main__':
    # 支持命令行参数或环境变量
    pdf_dir = os.getenv('PDF_DIR', 'pdfs')
    output_file = os.getenv('OUTPUT_FILE', None)
    
    # 命令行参数优先
    if len(sys.argv) > 1:
        pdf_dir = sys.argv[1]
    if len(sys.argv) > 2:
        output_file = sys.argv[2]
    
    merge_pdfs_with_toc(pdf_dir, output_file)

