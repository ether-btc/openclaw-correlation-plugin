# Changelog

All notable changes to the OpenClaw Correlation Plugin will be documented in this file.

## [2.0.1] - 2026-03-20

### Security

- Removed legacy reference files causing false positive security alerts
- Added comprehensive security documentation to plugin code (JSDoc comments)
- Passed deep security audit (March 20, 2026)

### Changed

- Removed `src/` directory (contained only legacy reference files)
- Added "Security" section to README.md
- Removed workspace dependency from package.json for better public distribution

### Fixed

- False positive security alerts from legacy reference files that were not actually loaded by OpenClaw

### Documentation

- Added security JSDoc comments to `index.ts`
- Added "Security" section to README.md documenting audit findings
- Created this CHANGELOG.md for version tracking

## [2.0.0] - 2026-03-18

### Added

- Initial release of correlation-aware memory search plugin
- Automatic context retrieval based on configurable rules
- Debug tools for rule matching
- Comprehensive documentation and deployment guides

---

*Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)*
