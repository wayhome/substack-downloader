#!/usr/bin/env python3
"""
使用Ghostscript压缩PDF文件，使用高质量设置保持清晰度
"""

import sys
import subprocess
from pathlib import Path

def compress_pdf_gs(input_file, output_file=None, quality='ebook'):
    """
    使用Ghostscript压缩PDF
    
    quality选项:
    - 'screen': 低质量，小文件 (72dpi)
    - 'ebook': 中等质量 (150dpi) - 推荐
    - 'printer': 高质量 (300dpi)
    - 'prepress': 印刷质量 (300dpi，保留颜色信息)
    """
    
    input_path = Path(input_file)
    
    if not input_path.exists():
        print(f"❌ 文件不存在: {input_file}")
        return False
    
    if output_file is None:
        output_file = input_path.stem + "_compressed.pdf"
    
    output_path = Path(output_file)
    
    # 获取原始文件大小
    original_size = input_path.stat().st_size / (1024 * 1024)  # MB
    
    print(f"📚 正在压缩: {input_path.name}")
    print(f"   原始大小: {original_size:.2f} MB")
    print(f"   质量设置: {quality}")
    print("\n🔧 使用Ghostscript压缩...")
    
    # 根据文件大小动态计算超时时间
    # 基础超时：5分钟（300秒）
    # 每100MB增加5分钟，最小10分钟，最大2小时
    base_timeout = 300  # 5分钟
    additional_timeout = max(0, (original_size - 100) / 100) * 300  # 每100MB增加5分钟
    timeout_seconds = max(600, min(base_timeout + additional_timeout, 7200))  # 10分钟到2小时之间
    timeout_minutes = timeout_seconds / 60

    print(f"   ⏱️  预计耗时: {timeout_minutes:.1f} 分钟（根据文件大小自动调整）")

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
        '-r150',  # 150 DPI，平衡质量和大小
        f'-sOutputFile={output_path}',
        str(input_path)
    ]

    try:
        result = subprocess.run(gs_command, capture_output=True, text=True, timeout=int(timeout_seconds))
        
        if result.returncode != 0:
            print(f"❌ Ghostscript错误: {result.stderr}")
            return False
        
        # 获取压缩后文件大小
        compressed_size = output_path.stat().st_size / (1024 * 1024)  # MB
        reduction = ((original_size - compressed_size) / original_size) * 100
        
        print(f"\n{'='*60}")
        print("✅ 压缩完成!")
        print(f"   原始文件: {input_path.name}")
        print(f"   原始大小: {original_size:.2f} MB")
        print(f"   压缩后文件: {output_path.name}")
        print(f"   压缩后大小: {compressed_size:.2f} MB")
        print(f"   减小: {original_size - compressed_size:.2f} MB ({reduction:.1f}%)")
        print(f"   保存位置: {output_path.absolute()}")
        print(f"{'='*60}")

        return True

    except subprocess.TimeoutExpired:
        print("❌ 压缩超时")
        return False
    except FileNotFoundError:
        print("❌ 未找到Ghostscript，请安装: brew install ghostscript")
        return False
    except Exception as e:
        print(f"❌ 压缩失败: {e}")
        return False

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("用法: python compress_pdf.py <input.pdf> [output.pdf] [quality]")
        print("质量选项: screen, ebook (默认), printer, prepress")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else None
    quality = sys.argv[3] if len(sys.argv) > 3 else 'ebook'
    
    compress_pdf_gs(input_file, output_file, quality)

