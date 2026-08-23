# 🤖 CodeSpit - AI-Ready Code Context Extractor

> **AI-Ready Code Context with AST Parsing**  
> Extract, parse, and chunk your codebase for AI consumption with semantic understanding.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3.3-blue)
![Node.js](https://img.shields.io/badge/Node.js-20+-green)
![License](https://img.shields.io/badge/license-ISC-yellow)

---

## 📖 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Output Formats](#output-formats)
- [Architecture](#architecture)
- [Technical Details](#technical-details)
- [Examples](#examples)
- [Contributing](#contributing)
- [License](#license)

---

## 📌 Overview

**CodeSpit** is a powerful command-line tool that extracts code context from your codebase using **Abstract Syntax Tree (AST) parsing**. It intelligently chunks your code into semantic units, making it AI-ready for LLMs, code analysis, and documentation generation.

### Why CodeSpit?

Traditional code extraction tools either:
- ❌ Send **entire files** (wastes tokens)
- ❌ Use **line-based chunking** (breaks logical units)
- ❌ Support **only one language**

**CodeSpit** solves all three problems:
- ✅ **Semantic chunking** - Each function/class gets its own chunk
- ✅ **Compact mode** - 80-90% token reduction
- ✅ **Multi-language** - TypeScript, JavaScript, Python, Ruby, PHP, JSON

> **Built by:** IoT Noob 🚀

---

## ✨ Features

### Core Capabilities

| Feature | Description |
|---------|-------------|
| **🌐 Multi-Language Support** | Parse TypeScript, JavaScript, Python, Ruby, PHP, JSON |
| **🧩 Semantic Chunking** | Split code by logical boundaries (functions, classes) |
| **📊 AST Analysis** | Extract functions, classes, imports, exports, interfaces |
| **⚡ Compact Mode** | Reduce token usage by 80-90% for AI consumption |
| **📸 Dense Code Image** | Render all files + relative paths + full content to crisp high-res PNG via Puppeteer (no AST) |
| **📄 Single File Mode** | Parse individual files |
| **📁 Directory Mode** | Parse entire projects |
| **🔄 Interactive CLI** | User-friendly prompts for all options |
| **🔍 Line Number Tracking** | Know exactly where each function lives |
| **📝 Import Grouping** | All imports in one chunk for context |

### Token Efficiency Comparison

| Mode | Token Usage | Savings | Use Case |
|------|-------------|---------|----------|
| **FULL mode** | ~10,000+ tokens/file | - | Debugging, full context |
| **COMPACT mode** | ~2,000 tokens/file | **80-90%** | AI context, code understanding |
| **Original (no chunking)** | ~50,000+ tokens | - | ❌ Inefficient |

---

## 🚀 Installation

### Prerequisites

- **Node.js** 20+
- **pnpm** (recommended) or npm

### Quick Install

```bash
# Clone the repository
git clone https://github.com/yourusername/CodeSpit.git
cd CodeSpit

# Install dependencies
pnpm install

# Build the project
pnpm build

# Use locally
pnpm start

# Or install globally
pnpm link --global
codespit
```

### Global Installation

```bash
# Build first
pnpm build

# Link globally
pnpm link --global

# Now use from anywhere
codespit ~/my-project/src/index.ts
codespit ~/my-project/
```

---

## 💻 Usage

### Command Line Interfaces

```bash
# Single file mode
codespit src/index.ts
codespit app.py

# Directory mode
codespit ./src
codespit ~/my-project

# Interactive mode (no arguments)
codespit
```

### Interactive Workflow

```bash
$ codespit

🤖 CodeSpit - AI-READY CODE EXTRACTOR WITH AST PARSING

📂 Enter file or directory path to extract: ./src

📋 Output mode:
  1. Full code (with line numbers)
  2. Compact AST only (recommended, 80% less tokens)

Choose (1 or 2): 2

🚀 Extracting with AST parsing...
✅ Done!
📄 Output: ai_context_20260131_120000.txt
📊 Files: 55
📊 Lines: 33,550
📊 Functions: 34
📊 Classes: 135
📊 Imports: 140
```

---

## 📁 Output Formats

### 1. FULL Mode (with line numbers)

```bash
codespit src/index.ts
# Choose option 1
```

- ✅ Complete source code
- ✅ Line numbers for reference
- ✅ AST summary
- ✅ Semantic chunks

**Best for:** Debugging, full context needed

### 2. COMPACT Mode (AST only) - Recommended

```bash
codespit src/index.ts
# Choose option 2
```

- ✅ AST summary only
- ✅ First 10-15 lines of each chunk
- ✅ 80-90% token reduction
- ✅ All functions/classes listed with line numbers

**Best for:** AI context, code understanding, LLM prompts

---

## 🏗 Architecture

### Project Structure

```
CodeSpit/
├── src/
│   ├── index.ts                 # Main CLI entry point
│   ├── parser/
│   │   ├── astParser.ts         # Universal Tree-sitter AST parser
│   │   ├── chunket.ts           # Semantic chunking engine
│   │   ├── extractor.ts         # Codebase extraction
│   │   └── languages.ts         # Language configurations
│   ├── utils/
│   │   ├── fileUtils.ts         # File operations
│   │   └── logger.ts            # Logging utilities
│   └── types/
│       └── index.ts             # TypeScript type definitions
├── dist/                        # Compiled output
├── package.json
├── tsconfig.json
└── README.md
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      USER INPUT                             │
│                 (file or directory)                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    FILE DISCOVERY                           │
│              findFiles() - glob pattern matching            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       LANGUAGE DETECTION                    │
│              detectLanguage() - based on extension          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       AST PARSING                           │
│                  parseFile() - Tree-sitter                  │
│                                                             │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│   │ TypeScript  │  │   Python    │  │   Ruby      │        │
│   │   Parser    │  │   Parser    │  │   Parser    │        │
│   └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    NODE EXTRACTION                          │
│               walkNode() - collect functions, classes,      │
│               imports, exports, interfaces, types           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   SEMANTIC CHUNKING                         │
│         createSemanticChunks() - group by logical           │
│         boundaries, not line count                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    OUTPUT GENERATION                        │
│              formatCompactOutput() - AI-ready               │
│              markdown with AST summary + chunks             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠 Technical Details

### How AST Parsing Works

CodeSpit uses **Tree-sitter** for multi-language AST parsing:

```
┌─────────────────────────────────────────────────────────────┐
│                      YOUR CODE                             │
│  function greet(name) {                                    │
│      return "Hello, " + name;                              │
│  }                                                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    TOKENIZATION                             │
│  ['function', 'greet', '(', 'name', ')', '{', 'return',    │
│   '"Hello, "', '+', 'name', '}']                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        PARSING                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  FunctionDeclaration                                │    │
│  │    ├── Identifier: "greet"                         │    │
│  │    ├── FormalParameters                            │    │
│  │    │   └── Identifier: "name"                      │    │
│  │    └── BlockStatement                              │    │
│  │        └── ReturnStatement                         │    │
│  │            └── BinaryExpression                    │    │
│  │                ├── StringLiteral: "Hello, "       │    │
│  │                └── Identifier: "name"             │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    NODE EXTRACTION                          │
│  Functions Found: 1                                        │
│    • greet (line 1)                                        │
│  Classes Found: 0                                          │
│  Imports Found: 0                                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   SEMANTIC CHUNKING                         │
│  ── Chunk 1: function (greet) ──                           │
│  function greet(name) {                                    │
│      return "Hello, " + name;                              │
│  }                                                         │
└─────────────────────────────────────────────────────────────┘
```

### Tree-sitter Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Tree-sitter Core (C)                      │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  GLR Parser                                        │    │
│  │  - Parse tables from grammar                       │    │
│  │  - Tokenizer                                       │    │
│  │  - Error recovery (continues on syntax errors)    │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Language-specific WASM Modules                 │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │ TypeScript│ │ Python  │ │  Ruby   │ │   PHP   │          │
│  │  .wasm   │ │  .wasm  │ │  .wasm  │ │  .wasm  │          │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   JavaScript API                           │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Parser class - setLanguage(), parse()              │    │
│  │  Tree class - rootNode                              │    │
│  │  Node class - type, children, text, start/end      │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Chunking Algorithm

```typescript
function createSemanticChunks(units: CodeUnit[]): CodeChunk[] {
    const chunks = [];
    
    // 1. Group imports together (they're related)
    const imports = units.filter(u => u.type === 'import');
    if (imports.length > 0) {
        chunks.push({ 
            type: 'imports', 
            content: imports.map(i => i.content).join('\n') 
        });
    }
    
    // 2. Each function/class gets its own chunk
    const nonImports = units.filter(u => u.type !== 'import');
    for (const unit of nonImports) {
        chunks.push(unit); // One unit = one chunk
    }
    
    // 3. Add overlap context (3 lines from previous chunk)
    return chunks.map((chunk, index) => {
        if (index === 0) return chunk;
        const prev = chunks[index - 1];
        if (!prev) return chunk;
        const overlap = prev.content.split('\n').slice(-3).join('\n');
        return { 
            ...chunk, 
            context: `/* Previous context */\n${overlap}` 
        };
    });
}
```

### Supported Languages

| Language | Extensions | Status |
|----------|------------|--------|
| **TypeScript** | `.ts`, `.tsx`, `.mts`, `.cts` | ✅ Full |
| **JavaScript** | `.js`, `.jsx`, `.mjs`, `.cjs` | ✅ Full |
| **Python** | `.py`, `.pyi` | ✅ Full |
| **Ruby** | `.rb`, `.rake`, `.gemspec` | ✅ Full |
| **PHP** | `.php`, `.php3-8` | ✅ Full |
| **JSON** | `.json`, `.jsonc`, `.json5` | ✅ Full |

---

## 📊 Examples

### Example 1: Parse a Single TypeScript File

```bash
$ codespit src/parser/astParser.ts

📋 Output mode:
  1. Full code (with line numbers)
  2. Compact AST only (recommended, 80% less tokens)

Choose (1 or 2): 2
```

### Example Output

```
============================================================
🤖 CodeSpit - AI-READY CODE CONTEXT WITH AST PARSING
   Mode: COMPACT (AST only)
============================================================
File:      astParser.ts
Path:      src/parser/astParser.ts
Date:      2026-07-31T07:06:06.792Z
============================================================

📄 astParser.ts
    📄 [src/parser/astParser.ts]
    └── CONTENT:
        🔬 AST ANALYSIS:
        📊 AST Summary:
          • Language: TypeScript
          • Functions: 4
          • Classes: 0
          • Imports: 3
        📋 Functions Found:
          • parseTypeScriptFile (lines 11-135)
          • walkNode (lines 27-115)
          • parsePythonFile (lines 141-263)
          • parseFile (lines 269-279)
        🧩 Semantic Chunks:
          ── Chunk 1: imports ──
          import * as ts from 'typescript';
          import type { CodeUnit, ParseResult } from '../types/index.js';
          import { createSemanticChunks } from './chunket.js';
```

### Example 2: Parse an Entire Python Project

```bash
$ codespit ~/my-python-project/

📂 Enter directory path to extract: ~/my-python-project/

Enter directories to ignore (space separated, or press Enter for none): tests venv

📋 Output mode:
  1. Full code (with line numbers)
  2. Compact AST only (recommended, 80% less tokens)

Choose (1 or 2): 2

📊 EXTRACTION SUMMARY
============================================================
Files Extracted:  55
Total Lines:      33,550
Total Chunks:     293
Functions Found:  34
Classes Found:    135
Imports Found:    140
============================================================
```

---

## 🤝 Contributing

### Development Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/CodeSpit.git
cd CodeSpit

# Install dependencies
pnpm install

# Build the project
pnpm build

# Run in development mode
pnpm dev

# Run tests (if any)
pnpm test

# Format code
pnpm format

# Lint code
pnpm lint
```

### Adding a New Language

1. **Install the Tree-sitter language module:**
   ```bash
   pnpm add tree-sitter-<language>
   ```

2. **Update `src/parser/languages.ts`:**
   ```typescript
   import Language from 'tree-sitter-<language>';
   
   export const LANGUAGE_CONFIGS = {
     // ... existing languages
     '<language>': {
       name: '<Language>',
       parser: new Parser().setLanguage(Language),
       extensions: ['.<ext>'],
       treeSitterLanguage: Language,
     },
   };
   ```

3. **Update the NODE_TYPE_MAP:**
   ```typescript
   export const NODE_TYPE_MAP = {
     // ... existing mappings
     '<language_node_type>': { category: 'function', isFunction: true, isClass: false },
   };
   ```

4. **Update the default options:**
   ```typescript
   const defaultOptions: ExtractOptions = {
     // ... existing options
     includeExtensions: ['.ts', '.tsx', '.js', '.jsx', '.py', '.rb', '.php', '.json', '.<new_ext>'],
   };
   ```

---

## 📄 License

This project is licensed under the **ISC License** - see the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Author

**IoT Noob**

- 🌐 [GitHub](https://github.com/yourusername)
- 📧 [Email](mailto:your.email@example.com)

---

## 🙏 Acknowledgments

- **[Tree-sitter](https://tree-sitter.github.io/)** - The amazing parsing engine
- **[TypeScript](https://www.typescriptlang.org/)** - For the compiler API
- **[Chalk](https://github.com/chalk/chalk)** - For terminal colors
- **[Glob](https://github.com/isaacs/node-glob)** - For file matching

---

## 📚 Related Projects

| Project | Description |
|---------|-------------|
| **[tree-sitter](https://github.com/tree-sitter/tree-sitter)** | The parsing engine behind CodeSpit |
| **[cursor](https://github.com/getcursor/cursor)** | AI-powered code editor |
| **[Aider](https://github.com/paul-gauthier/aider)** | AI pair programming |

---

## ⭐ Star This Project

If you found CodeSpit useful, please **star** the repository on GitHub!

```bash
https://github.com/yourusername/CodeSpit
```

---

## 📞 Support

For issues, questions, or contributions:

- **GitHub Issues**: [Create an issue](https://github.com/yourusername/CodeSpit/issues)
- **Discussions**: [Start a discussion](https://github.com/yourusername/CodeSpit/discussions)

---

**CodeSpit - Made with ❤️ by IoT Noob**