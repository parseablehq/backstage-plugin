# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2025-07-14

### Changed
- Updated UI to use "Parseable Dataset" terminology for better clarity
- Fixed Material Table rendering issue with "Cannot use 'in' operator" error
- Updated documentation and references throughout the codebase
- Removed time range controls from the UI for simplicity
- Added proper handling of log data for table rendering

### Fixed
- Fixed module import/export paths (removed .ts/.tsx extensions)
- Fixed component name consistency across the plugin
- Resolved runtime errors in the table component

## [0.1.0] - Initial Release

### Added
- Initial implementation of the Parseable plugin for Backstage
- Support for viewing log streams from Parseable
- Dataset selection functionality
- Search capabilities
- Live tail support
