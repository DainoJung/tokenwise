# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2025-XX-XX

### Added
- Unit tests for all modules (context-differ, skill-compressor, model-router, cost-tracker, pricing, token-counter)
- GitHub Actions CI/CD pipeline (lint, build, test)
- LICENSE file (MIT)
- CHANGELOG.md
- Streaming support for chat completions
- Anthropic API native support

### Fixed
- .gitignore now excludes IDE and tool-specific files

## [0.1.0] - 2025-XX-XX

### Added
- Initial release
- Context Differ — message deduplication and compression
- Skill Compressor — tool description optimization and relevance filtering
- Model Router — complexity-based model routing
- Cost Tracker — real-time cost monitoring and savings reporting
- Proxy Server — zero code change optimization via local proxy
- CLI (`tokenwise proxy`)
- OpenAI SDK-compatible client wrapper
