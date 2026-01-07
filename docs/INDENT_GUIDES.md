# Indent Guides Feature

## Overview

The indent guides feature adds vertical lines to the outliner view that visually indicate the indentation levels of blocks. This makes it easier to understand the hierarchical structure of your outline at a glance.

## Features

- **Visual Hierarchy**: Vertical lines show the depth and structure of nested blocks
- **Toggle Control**: Can be enabled or disabled through the settings menu
- **Theme Aware**: Automatically adapts to light and dark themes
- **Persistent**: Your preference is saved and restored across sessions

## Usage

### Enabling/Disabling Indent Guides

1. Click the **Settings** icon (⚙️) in the top-right corner of the app
2. In the Settings modal, find the **Outliner** section
3. Toggle the **"Show indent guides"** switch

Your preference will be saved automatically and applied immediately.

### How It Works

- Each indentation level displays a vertical guide line
- Guide lines appear to the left of the collapse toggle and bullet point
- Lines extend through the entire block and its children
- The guides help you track which blocks belong to which parent

## Implementation Details

### Store

The feature uses a dedicated Zustand store for outliner settings:

```typescript
// src/stores/outlinerSettingsStore.ts
interface OutlinerSettings {
  showIndentGuides: boolean;
}
```

Settings are persisted to localStorage using Zustand's persist middleware.

### Components

**BlockComponent** (`src/outliner/BlockComponent.tsx`):
- Reads the `showIndentGuides` setting from the store
- Renders indent guide elements for each depth level
- Positions guides at `i * 24 + 32px` where i is the depth level

**App** (`src/App.tsx`):
- Provides the Settings modal UI
- Contains the toggle switch for indent guides
- Uses Mantine's Modal and Switch components

### Styling

CSS classes in `BlockComponent.css`:
- `.indent-guide`: Base styling for guide lines
- Theme-aware colors using `.theme-dark` variants
- Subtle opacity (0.1) for non-intrusive appearance
- Smooth transitions on hover and theme changes

## Default Behavior

- Indent guides are **enabled by default**
- The setting persists across app restarts
- Guides only appear when depth > 0 (not on root-level blocks)

## Browser Compatibility

This feature uses standard CSS and modern React patterns. It is compatible with all modern browsers that support:
- CSS absolute positioning
- RGBA colors
- CSS transitions
- LocalStorage (for persistence)

## Future Enhancements

Potential improvements for future versions:
- Customizable guide colors
- Different guide styles (solid, dashed, dotted)
- Adjustable guide opacity
- Highlight guides on hover for active depth level
- Rainbow colors for different depth levels