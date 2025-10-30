# Changelog

All notable changes to Pluto Duck will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2025-10-30

### Major UI/UX Redesign

#### New Three-Panel Layout
- **Left Panel**: Board list with collapsible sidebar featuring quick action buttons and project selector
- **Center Panel**: Dedicated board workspace with full-width focus
- **Right Panel**: Multi-tab chat interface for seamless AI interactions

### Added

#### Multi-Tab Chat System
- Support for up to 3 simultaneous chat tabs
- Auto-restore last opened tab when switching projects
- Auto-scroll functionality on new message arrival
- Independent chat contexts for parallel workflows

#### Board Management
- **Auto-updating Board List**: Real-time updates in left sidebar
  - Sort by last modified time (newest first)
  - Instant reflection of board changes
- **Multi-Item Support**: Multiple content types within a single board
  - Markdown blocks
  - Images (tested)
  - Charts (in development)
  - Tables (in development)
- **Grid Layout Enhancements**:
  - Resizable items with drag handles
  - Drag-and-drop repositioning with sticky grid alignment
  - Constrained movement for predictable layouts

#### Project System
- New project-based workspace organization
- Project selector in top-left toolbar
- Quick project switching and creation
- Per-project board and chat state persistence

### Changed
- Complete layout restructure from single-panel to three-panel design
- Improved spatial organization for better multitasking
- Enhanced navigation with collapsible sidebars

### Technical Notes
- Board grid system uses constrained drag-and-drop for stability
- Chat tab state is persisted per project
- Board list updates use real-time synchronization

---

## [0.1.0] - Initial Release

- Initial release of Pluto Duck
- Basic chat functionality
- Basic board features
- Local-first analytics with DuckDB

