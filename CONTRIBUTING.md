# Contributing to Substack Downloader

First off, thank you for considering contributing to Substack Downloader! 🎉

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Coding Guidelines](#coding-guidelines)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)

## Code of Conduct

This project and everyone participating in it is governed by a Code of Conduct. By participating, you are expected to uphold this code. Please be respectful and constructive in all interactions.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When you create a bug report, include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples** (URLs, command-line arguments, etc.)
- **Describe the behavior you observed** and what you expected
- **Include logs and error messages**
- **Specify your environment**: OS, Node.js version, Python version, Chrome version

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, include:

- **Use a clear and descriptive title**
- **Provide a detailed description** of the suggested enhancement
- **Explain why this enhancement would be useful**
- **List some examples** of how it would be used

### Pull Requests

1. Fork the repository and create your branch from `main`
2. If you've added code, add tests if applicable
3. Ensure your code follows the existing style
4. Update documentation as needed
5. Write a clear commit message

## Development Setup

### Prerequisites

- Node.js >= 16.0.0
- Python >= 3.8
- Chrome/Chromium browser
- Ghostscript

### Local Setup

```bash
# Clone your fork
git clone https://github.com/wayhome/substack-downloader.git
cd substack-downloader

# Install Node.js dependencies
pnpm install

# Install uv (Python package manager, recommended)
curl -LsSf https://astral.sh/uv/install.sh | sh
# Or: brew install uv

# Install Python dependencies
uv pip install PyPDF2
# Or: pip install PyPDF2

# Make scripts executable
chmod +x src/*.js src/*.sh

# Create a test branch
git checkout -b feature/my-new-feature
```

### Testing Your Changes

```bash
# Test with a small Substack site first
./src/substack_downloader.js https://example.substack.com

# Check if PDFs are generated correctly
ls -lh downloads/

# Verify bookmarks in the merged PDF
```

## Coding Guidelines

### JavaScript (Node.js)

- Use ES6+ features
- Follow existing code style
- Add comments for complex logic
- Use descriptive variable and function names
- Handle errors gracefully with try-catch

```javascript
// Good
async function downloadArticle(url) {
  try {
    const response = await fetch(url);
    return await response.text();
  } catch (error) {
    console.error(`Failed to download ${url}:`, error.message);
    throw error;
  }
}

// Bad
async function dl(u) {
  return await fetch(u).then(r => r.text());
}
```

### Python

- Follow PEP 8 style guide
- Use type hints where appropriate
- Add docstrings to functions
- Handle exceptions properly

```python
# Good
def merge_pdfs(input_dir: str, output_path: str) -> bool:
    """
    Merge multiple PDF files into a single PDF.
    
    Args:
        input_dir: Directory containing PDF files
        output_path: Path for the merged output PDF
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # implementation
        return True
    except Exception as e:
        print(f"Error merging PDFs: {e}")
        return False
```

### Documentation

- Update README.md for user-facing changes
- Update CHANGELOG.md following [Keep a Changelog](https://keepachangelog.com/)
- Add inline comments for complex logic
- Update API documentation if adding new features

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples

```
feat(downloader): add support for authenticated content

- Add login functionality
- Handle session cookies
- Update documentation

Closes #123
```

```
fix(pdf): correct bookmark generation for special characters

The bookmark titles were not properly escaped when they contained
special characters like quotes or parentheses.

Fixes #456
```

## Pull Request Process

1. **Update documentation**: Ensure README.md, CHANGELOG.md, and other docs reflect your changes

2. **Test thoroughly**: 
   - Test with multiple Substack sites
   - Test edge cases (empty sites, very large sites, etc.)
   - Verify PDF quality and bookmarks

3. **Update CHANGELOG.md**: Add your changes under `[Unreleased]` section

4. **Create Pull Request**:
   - Use a clear, descriptive title
   - Reference any related issues
   - Describe what changed and why
   - Include screenshots if UI-related

5. **Code Review**:
   - Address reviewer feedback
   - Keep discussion constructive and professional
   - Update your PR based on comments

6. **Merge**: Once approved, a maintainer will merge your PR

## Project Structure

```
substack-downloader/
├── src/                          # Source code
│   ├── substack_downloader.js   # Main script
│   ├── merge_pdfs.py            # PDF merging
│   ├── compress_pdf.py          # PDF compression
│   └── start.js                 # Chrome launcher
├── docs/                         # Documentation
├── examples/                     # Usage examples
├── tests/                        # Test files (future)
├── README.md                     # Project README
├── CHANGELOG.md                  # Version history
└── package.json                  # Node.js config
```

## Need Help?

- 💬 [Start a Discussion](https://github.com/wayhome/substack-downloader/discussions)
- 🐛 [Report a Bug](https://github.com/wayhome/substack-downloader/issues)
- 📧 Contact the maintainers

## Recognition

Contributors will be recognized in:
- README.md acknowledgments section
- GitHub contributors page
- Release notes for significant contributions

Thank you for contributing! 🙏

