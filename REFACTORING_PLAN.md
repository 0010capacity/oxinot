# Refactoring Plan for MD Editor

## Overview
This document outlines a comprehensive refactoring plan to improve code quality, maintainability, and extensibility. The plan focuses on establishing a scalable theme system, unifying layout patterns, eliminating hard-coded values, and optimizing performance.

---

## 1. Theme System Architecture

### 1.1 Create Theme Infrastructure

**Location**: `src/theme/`

#### Files to Create:
- `src/theme/types.ts` - Theme type definitions
- `src/theme/tokens.ts` - Design tokens (spacing, typography, etc.)
- `src/theme/colors.ts` - Color palette definitions
- `src/theme/themes.ts` - Theme configurations
- `src/theme/ThemeProvider.tsx` - Theme context provider
- `src/theme/useTheme.ts` - Theme hook

#### Implementation:

**src/theme/types.ts**
```typescript
export type ColorScheme = 'dark' | 'light';
export type ColorVariant = 'default' | 'blue' | 'purple' | 'green' | 'amber';

export interface Theme {
  scheme: ColorScheme;
  variant: ColorVariant;
  colors: ColorPalette;
  spacing: Spacing;
  typography: Typography;
  radius: Radius;
}

export interface ColorPalette {
  // Background colors
  bg: {
    primary: string;
    secondary: string;
    tertiary: string;
    elevated: string;
  };
  
  // Text colors
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    link: string;
  };
  
  // Border colors
  border: {
    primary: string;
    secondary: string;
    focus: string;
  };
  
  // Interactive colors
  interactive: {
    hover: string;
    active: string;
    selected: string;
    focus: string;
  };
  
  // Semantic colors
  accent: string;
  success: string;
  warning: string;
  error: string;
  
  // Component-specific
  bullet: {
    default: string;
    hover: string;
    active: string;
  };
  
  indentGuide: string;
}

export interface Spacing {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  xxl: string;
}

export interface Typography {
  fontFamily: string;
  monoFontFamily: string;
  fontSize: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  lineHeight: {
    tight: string;
    normal: string;
    relaxed: string;
  };
}

export interface Radius {
  sm: string;
  md: string;
  lg: string;
}
```

**src/theme/tokens.ts**
```typescript
export const SPACING = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '48px',
} as const;

export const TYPOGRAPHY = {
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  monoFontFamily: "'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace",
  fontSize: {
    xs: '12px',
    sm: '14px',
    md: '16px',
    lg: '18px',
    xl: '24px',
  },
  lineHeight: {
    tight: '1.3',
    normal: '1.5',
    relaxed: '1.6',
  },
} as const;

export const RADIUS = {
  sm: '3px',
  md: '6px',
  lg: '12px',
} as const;

export const LAYOUT = {
  maxContentWidth: '800px',
  containerPadding: '40px 20px',
  containerPaddingMobile: '20px 12px',
  contentBottomPadding: '200px',
  titleBarHeight: '44px',
  bulletSize: '6px',
  bulletContainerSize: '24px',
  collapseToggleSize: '20px',
  indentSize: 24,
} as const;

export const TRANSITIONS = {
  fast: '0.1s ease',
  normal: '0.15s ease',
  slow: '0.2s ease',
} as const;

export const OPACITY = {
  disabled: '0.3',
  dimmed: '0.5',
  hover: '0.6',
  active: '0.85',
} as const;
```

**src/theme/colors.ts**
```typescript
// Define base color palettes for each variant
export const COLOR_VARIANTS = {
  default: {
    accent: '#6366f1',
    accentHover: '#818cf8',
  },
  blue: {
    accent: '#3b82f6',
    accentHover: '#60a5fa',
  },
  purple: {
    accent: '#a855f7',
    accentHover: '#c084fc',
  },
  green: {
    accent: '#10b981',
    accentHover: '#34d399',
  },
  amber: {
    accent: '#f59e0b',
    accentHover: '#fbbf24',
  },
} as const;

// Generate color palettes for dark and light schemes
export function createColorPalette(scheme: 'dark' | 'light', variant: keyof typeof COLOR_VARIANTS) {
  const variantColors = COLOR_VARIANTS[variant];
  
  if (scheme === 'dark') {
    return {
      bg: {
        primary: '#1a1a1a',
        secondary: '#1a1b1e',
        tertiary: '#0b0c0f',
        elevated: '#252525',
      },
      text: {
        primary: '#e0e0e0',
        secondary: '#c1c2c5',
        tertiary: '#909296',
        link: variantColors.accentHover,
      },
      border: {
        primary: 'rgba(255, 255, 255, 0.1)',
        secondary: 'rgba(255, 255, 255, 0.06)',
        focus: variantColors.accent,
      },
      interactive: {
        hover: 'rgba(255, 255, 255, 0.08)',
        active: 'rgba(255, 255, 255, 0.12)',
        selected: `rgba(${hexToRgb(variantColors.accent)}, 0.15)`,
        focus: `rgba(${hexToRgb(variantColors.accent)}, 0.3)`,
      },
      accent: variantColors.accent,
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      bullet: {
        default: 'rgba(255, 255, 255, 0.4)',
        hover: 'rgba(255, 255, 255, 0.7)',
        active: 'rgba(255, 255, 255, 0.85)',
      },
      indentGuide: 'rgba(255, 255, 255, 0.06)',
    };
  } else {
    return {
      bg: {
        primary: '#ffffff',
        secondary: '#f8f9fa',
        tertiary: '#f1f3f5',
        elevated: '#ffffff',
      },
      text: {
        primary: '#1a1a1a',
        secondary: '#495057',
        tertiary: '#868e96',
        link: variantColors.accent,
      },
      border: {
        primary: 'rgba(0, 0, 0, 0.1)',
        secondary: 'rgba(0, 0, 0, 0.06)',
        focus: variantColors.accent,
      },
      interactive: {
        hover: 'rgba(0, 0, 0, 0.05)',
        active: 'rgba(0, 0, 0, 0.08)',
        selected: `rgba(${hexToRgb(variantColors.accent)}, 0.1)`,
        focus: `rgba(${hexToRgb(variantColors.accent)}, 0.2)`,
      },
      accent: variantColors.accent,
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      bullet: {
        default: 'rgba(0, 0, 0, 0.4)',
        hover: 'rgba(0, 0, 0, 0.7)',
        active: 'rgba(0, 0, 0, 0.85)',
      },
      indentGuide: 'rgba(0, 0, 0, 0.06)',
    };
  }
}

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result 
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '0, 0, 0';
}
```

**src/theme/ThemeProvider.tsx**
```typescript
import { createContext, useEffect, useState, ReactNode } from 'react';
import { useMantineColorScheme } from '@mantine/core';
import { createColorPalette } from './colors';
import { SPACING, TYPOGRAPHY, RADIUS, LAYOUT, TRANSITIONS, OPACITY } from './tokens';
import type { Theme, ColorScheme, ColorVariant } from './types';

export const ThemeContext = createContext<Theme | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { colorScheme } = useMantineColorScheme();
  const [colorVariant, setColorVariant] = useState<ColorVariant>('default');
  
  const theme: Theme = {
    scheme: colorScheme as ColorScheme,
    variant: colorVariant,
    colors: createColorPalette(colorScheme as ColorScheme, colorVariant),
    spacing: SPACING,
    typography: TYPOGRAPHY,
    radius: RADIUS,
  };
  
  // Apply CSS variables to root
  useEffect(() => {
    const root = document.documentElement;
    const { colors } = theme;
    
    // Background colors
    root.style.setProperty('--color-bg-primary', colors.bg.primary);
    root.style.setProperty('--color-bg-secondary', colors.bg.secondary);
    root.style.setProperty('--color-bg-tertiary', colors.bg.tertiary);
    root.style.setProperty('--color-bg-elevated', colors.bg.elevated);
    
    // Text colors
    root.style.setProperty('--color-text-primary', colors.text.primary);
    root.style.setProperty('--color-text-secondary', colors.text.secondary);
    root.style.setProperty('--color-text-tertiary', colors.text.tertiary);
    root.style.setProperty('--color-text-link', colors.text.link);
    
    // Border colors
    root.style.setProperty('--color-border-primary', colors.border.primary);
    root.style.setProperty('--color-border-secondary', colors.border.secondary);
    root.style.setProperty('--color-border-focus', colors.border.focus);
    
    // Interactive colors
    root.style.setProperty('--color-interactive-hover', colors.interactive.hover);
    root.style.setProperty('--color-interactive-active', colors.interactive.active);
    root.style.setProperty('--color-interactive-selected', colors.interactive.selected);
    root.style.setProperty('--color-interactive-focus', colors.interactive.focus);
    
    // Semantic colors
    root.style.setProperty('--color-accent', colors.accent);
    root.style.setProperty('--color-success', colors.success);
    root.style.setProperty('--color-warning', colors.warning);
    root.style.setProperty('--color-error', colors.error);
    
    // Component-specific
    root.style.setProperty('--color-bullet-default', colors.bullet.default);
    root.style.setProperty('--color-bullet-hover', colors.bullet.hover);
    root.style.setProperty('--color-bullet-active', colors.bullet.active);
    root.style.setProperty('--color-indent-guide', colors.indentGuide);
    
    // Spacing
    Object.entries(SPACING).forEach(([key, value]) => {
      root.style.setProperty(`--spacing-${key}`, value);
    });
    
    // Layout
    Object.entries(LAYOUT).forEach(([key, value]) => {
      root.style.setProperty(`--layout-${camelToKebab(key)}`, typeof value === 'number' ? `${value}px` : value);
    });
    
    // Transitions
    Object.entries(TRANSITIONS).forEach(([key, value]) => {
      root.style.setProperty(`--transition-${key}`, value);
    });
    
    // Opacity
    Object.entries(OPACITY).forEach(([key, value]) => {
      root.style.setProperty(`--opacity-${key}`, value);
    });
  }, [theme]);
  
  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}

function camelToKebab(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
```

**src/theme/useTheme.ts**
```typescript
import { useContext } from 'react';
import { ThemeContext } from './ThemeProvider';

export function useTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return theme;
}
```

### 1.2 Create Theme Store

**Location**: `src/stores/themeStore.ts`

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ColorVariant } from '../theme/types';

interface ThemeState {
  colorVariant: ColorVariant;
  setColorVariant: (variant: ColorVariant) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      colorVariant: 'default',
      setColorVariant: (variant) => set({ colorVariant: variant }),
    }),
    {
      name: 'theme-settings',
    }
  )
);
```

### 1.3 Update Settings Modal

**Location**: `src/App.tsx` (Settings Modal section)

Add theme variant selector to settings modal:
- Create radio group or segmented control for color variant selection
- Use `useThemeStore` to persist selection
- Show preview swatches for each variant

---

## 2. Layout System Unification

### 2.1 Create Shared Layout Components

**Location**: `src/components/layout/`

#### Files to Create:
- `src/components/layout/PageContainer.tsx` - Unified page container
- `src/components/layout/ContentWrapper.tsx` - Content width constraint wrapper
- `src/components/layout/PageHeader.tsx` - Consistent page header with breadcrumb

**src/components/layout/PageContainer.tsx**
```typescript
interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

// Provides consistent outer container styling
// Uses CSS variables from theme system
// maxWidth, padding, backgroundColor, etc.
```

**src/components/layout/ContentWrapper.tsx**
```typescript
interface ContentWrapperProps {
  children: ReactNode;
  maxWidth?: string; // defaults to LAYOUT.maxContentWidth
  paddingBottom?: string; // defaults to LAYOUT.contentBottomPadding
}

// Constrains content width and provides consistent padding
```

**src/components/layout/PageHeader.tsx**
```typescript
interface PageHeaderProps {
  title?: string;
  showBreadcrumb?: boolean;
  breadcrumbProps?: BreadcrumbProps;
}

// Unified header component with optional title and breadcrumb
// Consistent spacing and border styling
```

### 2.2 Refactor FileTreeIndex

**Location**: `src/components/FileTreeIndex.tsx`

**Changes**:
1. Replace root `div` with `PageContainer`
2. Replace inner content `div` with `ContentWrapper`
3. Use `PageHeader` for workspace title section
4. Replace all hard-coded padding/margin values with CSS variables
5. Replace all hard-coded colors with CSS variables
6. Extract repeated styles into reusable class names or style objects

**Example transformation**:
```typescript
// BEFORE
<div style={{
  width: "100%",
  height: "100%",
  padding: "40px 20px",
  backgroundColor: isDark ? "#1a1a1a" : "#ffffff",
}}>

// AFTER
<PageContainer>
  <ContentWrapper>
```

### 2.3 Refactor BlockEditor

**Location**: `src/outliner/BlockEditor.tsx`

**Changes**:
1. Use same `PageContainer` and `ContentWrapper` as FileTreeIndex
2. Update breadcrumb section to use `PageHeader`
3. Ensure consistent spacing matches FileTreeIndex
4. Replace hard-coded styles with CSS variables

### 2.4 Update Breadcrumb Component

**Location**: `src/components/Breadcrumb.tsx`

**Changes**:
1. Extract styles to CSS module or use CSS variables
2. Remove hard-coded opacity values - use `--opacity-dimmed`
3. Ensure consistent with `PageHeader` usage

---

## 3. Style System Consolidation

### 3.1 Create Shared CSS Files

**Location**: `src/styles/`

#### Files to Create:
- `src/styles/variables.css` - CSS custom properties (generated from theme)
- `src/styles/base.css` - Base styles and resets
- `src/styles/layout.css` - Common layout patterns
- `src/styles/components.css` - Shared component styles
- `src/styles/utilities.css` - Utility classes

**src/styles/variables.css**
- Import this file in `src/index.css`
- Define all CSS variables (theme system will override these)
- Provides fallback values

**src/styles/layout.css**
```css
.page-container {
  width: 100%;
  height: 100%;
  padding: var(--layout-container-padding);
  background-color: var(--color-bg-primary);
  overflow-y: auto;
}

.content-wrapper {
  max-width: var(--layout-max-content-width);
  margin: 0 auto;
  padding-bottom: var(--layout-content-bottom-padding);
}

.page-header {
  margin-bottom: var(--spacing-xl);
  padding-bottom: var(--spacing-md);
  border-bottom: 1px solid var(--color-border-primary);
}

.page-title {
  font-size: var(--typography-fontSize-xl);
  font-weight: 600;
  color: var(--color-text-primary);
}
```

### 3.2 Consolidate Component Styles

**Affected files**:
- `src/outliner/BlockEditor.css`
- `src/outliner/BlockComponent.css`
- `src/components/FileTreeIndex.tsx` (inline styles)

**Changes**:
1. Replace all hard-coded color values with CSS variables
2. Replace spacing values with CSS variables
3. Replace transition values with CSS variables
4. Replace opacity values with CSS variables
5. Remove duplicate style definitions

**Example transformations**:

```css
/* BEFORE */
.block-bullet {
  background-color: rgba(255, 255, 255, 0.4);
}

.theme-dark .block-bullet {
  background-color: rgba(0, 0, 0, 0.4);
}

/* AFTER */
.block-bullet {
  background-color: var(--color-bullet-default);
}
```

```css
/* BEFORE */
padding: 40px 20px;
margin-bottom: 32px;
opacity: 0.5;

/* AFTER */
padding: var(--layout-container-padding);
margin-bottom: var(--spacing-xl);
opacity: var(--opacity-dimmed);
```

---

## 4. Component Refactoring

### 4.1 FileTreeIndex Component

**Location**: `src/components/FileTreeIndex.tsx`

**Issues identified**:
1. Extremely large component (996 lines)
2. Complex state management within component
3. Drag-and-drop logic mixed with rendering
4. Inline styles throughout
5. Repeated style patterns

**Refactoring plan**:

1. **Extract sub-components**:
   - `src/components/fileTree/PageTreeItem.tsx` - Extract PageTreeItem
   - `src/components/fileTree/NewPageInput.tsx` - Extract new page input
   - `src/components/fileTree/EmptyState.tsx` - Extract empty state
   - `src/components/fileTree/DeletePageModal.tsx` - Extract delete modal

2. **Extract hooks**:
   - `src/components/fileTree/usePageTreeDrag.ts` - Drag and drop logic
   - `src/components/fileTree/usePageTree.ts` - Tree building and collapse logic
   - `src/components/fileTree/usePageActions.ts` - CRUD operations

3. **Extract styles**:
   - `src/components/fileTree/FileTreeIndex.css` - Move inline styles to CSS
   - Use CSS variables throughout

4. **Simplify main component**:
   - Reduce to < 200 lines
   - Focus on composition and coordination
   - Delegate logic to hooks and sub-components

### 4.2 BlockComponent Refactoring

**Location**: `src/outliner/BlockComponent.tsx`

**Changes**:
1. Extract keybindings to separate hook: `src/outliner/hooks/useBlockKeybindings.ts`
2. Extract bullet click logic to separate hook: `src/outliner/hooks/useBlockNavigation.ts`
3. Update styles to use CSS variables
4. Reduce component size by extracting sub-components if needed

### 4.3 TitleBar Component

**Location**: `src/components/TitleBar.tsx`

**Changes**:
1. Extract macOS detection to utility: `src/utils/platform.ts`
2. Replace hard-coded colors with CSS variables
3. Extract action icons to separate component: `src/components/titleBar/ActionIcons.tsx`
4. Extract window controls to separate component: `src/components/titleBar/WindowControls.tsx`

### 4.4 Create Reusable Components

**Location**: `src/components/common/`

#### Files to Create:
- `src/components/common/BulletPoint.tsx` - Reusable bullet component
- `src/components/common/CollapseToggle.tsx` - Reusable collapse button
- `src/components/common/IndentGuide.tsx` - Indent guide line component
- `src/components/common/IconButton.tsx` - Styled icon button

These components should be used by both FileTreeIndex and BlockComponent for visual consistency.

---

## 5. Performance Optimization

### 5.1 FileTreeIndex Optimization

**Location**: `src/components/FileTreeIndex.tsx`

**Issues**:
- Re-renders entire tree on any page change
- Drag state causes unnecessary re-renders
- No virtualization for large page lists

**Optimizations**:
1. Memoize PageTreeItem component properly
2. Use `useCallback` for all handlers passed to children
3. Separate drag state into isolated context to prevent cascading re-renders
4. Consider using `react-virtuoso` for large lists (already in dependencies)
5. Implement windowing for trees with > 100 items

**Implementation**:
```typescript
// Create isolated drag context
const DragContext = createContext<DragState | null>(null);

// Memoize tree items with proper dependencies
const MemoizedPageTreeItem = memo(PageTreeItem, (prev, next) => {
  return (
    prev.page.id === next.page.id &&
    prev.page.title === next.page.title &&
    prev.page.updatedAt === next.page.updatedAt &&
    prev.depth === next.depth &&
    prev.isCollapsed === next.isCollapsed
  );
});
```

### 5.2 BlockComponent Optimization

**Location**: `src/outliner/BlockComponent.tsx`

**Current state**: Already using `memo` - good

**Additional optimizations**:
1. Verify `useDebouncedBlockUpdate` is not creating new function references
2. Ensure keybindings array is memoized (already using `useMemo`)
3. Check if `focusedBlockId` changes are causing unnecessary re-renders in non-focused blocks

### 5.3 Store Optimization

**Location**: `src/stores/blockStore.ts`, `src/stores/pageStore.ts`

**Current state**: Using Zustand with Immer - good approach

**Potential improvements**:
1. Add selectors with equality checks to prevent unnecessary re-renders
2. Consider splitting large stores into smaller domain-specific stores
3. Add devtools integration for debugging

**Example**:
```typescript
// Add shallow equality for array selections
import { shallow } from 'zustand/shallow';

export const useBlockIds = () => 
  useBlockStore(state => state.childrenMap['root'] || [], shallow);
```

### 5.4 Editor Performance

**Location**: `src/components/Editor.tsx`

**Review**:
1. Check if CodeMirror editor is being recreated unnecessarily
2. Ensure extensions array is stable (memoized)
3. Verify `onChange` handler is not recreated on every render

---

## 6. Code Quality Improvements

### 6.1 Type Safety Enhancements

**Locations**: Throughout codebase

**Improvements**:
1. Create strict types for all inline style objects
2. Add return types to all functions
3. Use `const assertions` for constant objects
4. Create discriminated unions for component variants

**Example**:
```typescript
// BEFORE
const styles = {
  container: {
    padding: "20px",
  }
};

// AFTER
const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: "20px",
  }
} as const;
```

### 6.2 Utility Functions

**Location**: `src/utils/`

#### Files to Create:
- `src/utils/platform.ts` - Platform detection utilities
- `src/utils/styles.ts` - Style helper functions
- `src/utils/tree.ts` - Tree traversal utilities
- `src/utils/string.ts` - String manipulation utilities

**src/utils/styles.ts**:
```typescript
// Helper to conditionally apply styles based on theme
export function getThemeValue(light: string, dark: string, isDark: boolean): string {
  return isDark ? dark : light;
}

// Helper to merge style objects
export function mergeStyles(...styles: React.CSSProperties[]): React.CSSProperties {
  return Object.assign({}, ...styles);
}
```

### 6.3 Constants Consolidation

**Location**: `src/constants/`

#### Files to Create:
- `src/constants/layout.ts` - Layout constants
- `src/constants/keyboard.ts` - Keyboard shortcuts
- `src/constants/colors.ts` - Color constants (reference theme system)

Move all magic numbers and strings to appropriate constant files.

### 6.4 Remove Duplicate Code

**Identified duplications**:

1. **Hover style handlers** - repeated in FileTreeIndex
   - Extract to reusable hook: `useHoverStyles(isDark, styles)`

2. **Opacity toggle patterns** - repeated in multiple components
   - Extract to utility: `createOpacityToggle(baseOpacity, hoverOpacity)`

3. **Border style generation** - repeated patterns
   - Extract to utility: `getBorderStyle(color, width = '1px')`

4. **Background color with isDark check** - repeated everywhere
   - Use CSS variables instead

---

## 7. CSS Architecture

### 7.1 Migrate to CSS Modules (Optional but Recommended)

**Rationale**: Better scoping, type safety with TypeScript, tree-shaking

**Approach**:
1. Convert existing CSS files to `.module.css`
2. Import styles as objects in components
3. Use classnames library for conditional classes

**Example**:
```typescript
// BlockComponent.module.css
.blockRow {
  display: flex;
  padding: var(--spacing-xs) 0;
  transition: background-color var(--transition-normal);
}

.blockRow:hover {
  background-color: var(--color-interactive-hover);
}

// BlockComponent.tsx
import styles from './BlockComponent.module.css';

<div className={styles.blockRow}>
```

### 7.2 Eliminate Theme-Dependent CSS Classes

**Current pattern**:
```css
.theme-dark .some-element { }
.theme-light .some-element { }
```

**Target pattern**:
```css
.some-element {
  color: var(--color-text-primary);
}
```

**Files to update**:
- `src/index.css`
- `src/outliner/BlockEditor.css`
- `src/outliner/BlockComponent.css`

### 7.3 CSS Organization

**Current**: Styles scattered across inline styles and CSS files
**Target**: Clear hierarchy and organization

**Structure**:
```
src/styles/
  ├── variables.css       # CSS custom properties
  ├── base.css           # Reset and base styles
  ├── layout.css         # Layout patterns
  ├── components.css     # Shared component styles
  └── utilities.css      # Utility classes

src/components/
  └── [Component]/
      ├── Component.tsx
      └── Component.module.css  # Component-specific styles

src/outliner/
  └── [Component]/
      ├── Component.tsx
      └── Component.module.css
```

---

## 8. Implementation Order

Execute refactoring in this order to minimize breaking changes:

### Phase 1: Foundation (No Breaking Changes)
1. Create theme system infrastructure (all files in `src/theme/`)
2. Create shared constants and utilities
3. Add CSS variables to existing CSS files (parallel to existing styles)
4. Create layout components (don't use them yet)
5. Run tests to ensure nothing breaks

### Phase 2: Theme Integration (Minimal Changes)
1. Wrap App with ThemeProvider
2. Add theme variant selector to settings
3. Update a single component (e.g., TitleBar) to use CSS variables
4. Verify theme switching works correctly
5. Gradually migrate other components one by one

### Phase 3: Layout Unification (Visible Changes)
1. Migrate BlockEditor to use layout components
2. Migrate FileTreeIndex to use layout components
3. Verify both screens maintain visual consistency
4. Adjust spacing/padding if needed
5. Test on different screen sizes

### Phase 4: Component Refactoring (Major Changes)
1. Extract FileTreeIndex sub-components
2. Extract FileTreeIndex hooks
3. Refactor PageTreeItem component
4. Extract shared components (BulletPoint, CollapseToggle, etc.)
5. Update BlockComponent to use shared components
6. Run comprehensive testing

### Phase 5: Style Migration (Final Cleanup)
1. Remove all inline styles from FileTreeIndex
2. Remove all inline styles from other components
3. Remove theme-dependent CSS classes
4. Consolidate CSS files
5. Optional: Migrate to CSS Modules

### Phase 6: Performance Optimization
1. Add memoization to FileTreeIndex
2. Implement virtualization if needed
3. Optimize store selectors
4. Profile and address any remaining issues

### Phase 7: Polish
1. Remove unused code
2. Update documentation
3. Add comments for complex logic
4. Run final linting and formatting
5. Create migration guide for future contributors

---

## 9. Testing Strategy

After each phase:

1. **Visual Regression Testing**:
   - Compare FileTreeIndex appearance before/after
   - Compare BlockEditor appearance before/after
   - Verify theme switching works correctly
   - Test on different screen sizes

2. **Functional Testing**:
   - Test all CRUD operations on pages
   - Test all block editing operations
   - Test drag-and-drop
   - Test keyboard shortcuts
   - Test collapse/expand functionality

3. **Performance Testing**:
   - Test with workspace containing 100+ pages
   - Test with page containing 1000+ blocks
   - Monitor render counts using React DevTools
   - Check for memory leaks

4. **Cross-Platform Testing**:
   - Test on macOS
   - Test on Windows (if applicable)
   - Verify custom title bar works correctly

---

## 10. Success Criteria

Refactoring is complete when:

- [ ] Theme system supports 5+ color variants (default, blue, purple, green, amber)
- [ ] All hard-coded color values removed from codebase
- [ ] All hard-coded spacing values replaced with CSS variables or tokens
- [ ] FileTreeIndex and BlockEditor use identical layout components
- [ ] FileTreeIndex component under 300 lines (from 996)
- [ ] No inline styles in FileTreeIndex or BlockEditor
- [ ] All components use CSS variables from theme system
- [ ] Performance benchmarks show no regression
- [ ] Visual appearance unchanged (except intentional improvements)
- [ ] All existing functionality works correctly
- [ ] Code passes linting and formatting checks
- [ ] Documentation updated

---

## 11. Risk Mitigation

### High-Risk Areas:
1. **FileTreeIndex refactoring** - Complex component, high chance of breaking functionality
   - Mitigation: Refactor incrementally, test after each extraction

2. **Theme system integration** - Could break existing styles
   - Mitigation: Keep old styles parallel until migration complete

3. **Layout changes** - Could affect user experience
   - Mitigation: Make changes gradually, gather feedback

### Rollback Strategy:
- Work in feature branch
- Commit after each phase
- Keep old code commented out during migration
- Only delete old code after full verification

---

## 12. File Structure Summary

### New Files to Create:
```
src/
├── theme/
│   ├── types.ts
│   ├── tokens.ts
│   ├── colors.ts
│   ├── themes.ts
│   ├── ThemeProvider.tsx
│   └── useTheme.ts
│
├── styles/
│   ├── variables.css
│   ├── base.css
│   ├── layout.css
│   ├── components.css
│   └── utilities.css
│
├── components/
│   ├── layout/
│   │   ├── PageContainer.tsx
│   │   ├── ContentWrapper.tsx
│   │   └── PageHeader.tsx
│   │
│   ├── common/
│   │   ├── BulletPoint.tsx
│   │   ├── CollapseToggle.tsx
│   │   ├── IndentGuide.tsx
│   │   └── IconButton.tsx
│   │
│   ├── fileTree/
│   │   ├── PageTreeItem.tsx
│   │   ├── NewPageInput.tsx
│   │   ├── EmptyState.tsx
│   │   ├── DeletePageModal.tsx
│   │   ├── usePageTreeDrag.ts
│   │   ├── usePageTree.ts
│   │   └── usePageActions.ts
│   │
│   └── titleBar/
│       ├── ActionIcons.tsx
│       └── WindowControls.tsx
│
├── utils/
│   ├── platform.ts
│   ├── styles.ts
│   ├── tree.ts
│   └── string.ts
│
├── constants/
│   ├── layout.ts
│   ├── keyboard.ts
│   └── colors.ts
│
└── stores/
    └── themeStore.ts
```

### Files to Modify:
```
src/
├── App.tsx                              # Add ThemeProvider, update settings modal
├── index.css                            # Import new style files, add CSS variables
├── stores/
│   ├── blockStore.ts                    # Add optimized selectors
│   ├── pageStore.ts                     # Add optimized selectors
│   └── outlinerSettingsStore.ts         # Integrate with theme system
├── components/
│   ├── FileTreeIndex.tsx                # Major refactor - extract components
│   ├── Breadcrumb.tsx                   # Use CSS variables
│   ├── TitleBar.tsx                     # Use CSS variables, extract sub-components
│   ├── SearchModal.tsx                  # Use CSS variables
│   ├── CalendarModal.tsx                # Use CSS variables
│   └── HelpModal.tsx                    # Use CSS variables
└── outliner/
    ├── BlockEditor.tsx                  # Use layout components
    ├── BlockEditor.css                  # Use CSS variables
    ├── BlockComponent.tsx               # Use shared components
    └── BlockComponent.css               # Use CSS variables
```

---

## 13. Execution Instructions for AI Agent

1. **Start with Phase 1**: Create all theme infrastructure files exactly as specified
2. **Do not skip steps**: Each phase depends on previous phases
3. **Test after each file**: Ensure application still runs and compiles
4. **Preserve functionality**: Visual changes are acceptable, behavioral changes are not
5. **Use TypeScript strictly**: All new files must have proper types
6. **Follow existing patterns**: Match code style of existing files
7. **Document changes**: Add comments explaining complex logic
8. **Handle errors gracefully**: Add proper error boundaries and fallbacks

### Special Instructions:

- **When creating CSS variables**: Ensure fallback values are sensible
- **When extracting components**: Verify all props are properly typed
- **When refactoring FileTreeIndex**: Extract one sub-component at a time
- **When adding theme variants**: Test each variant works correctly
- **When consolidating styles**: Remove old code only after new code is verified

### Validation Checklist per File:

- [ ] File compiles without errors
- [ ] All imports resolve correctly
- [ ] Types are properly defined
- [ ] Component renders correctly
- [ ] No console errors
- [ ] Existing functionality preserved
- [ ] Code follows project conventions

---

## Appendix A: Color Mapping Reference

Map existing hard-coded colors to CSS variables:

| Current Value | CSS Variable | Usage |
|--------------|-------------|--------|
| `#1a1a1a` (dark) | `var(--color-bg-primary)` | Primary background |
| `#ffffff` (light) | `var(--color-bg-primary)` | Primary background |
| `rgba(255,255,255,0.1)` | `var(--color-border-primary)` | Dark mode borders |
| `rgba(0,0,0,0.1)` | `var(--color-border-primary)` | Light mode borders |
| `rgba(255,255,255,0.08)` | `var(--color-interactive-hover)` | Dark mode hover |
| `rgba(0,0,0,0.05)` | `var(--color-interactive-hover)` | Light mode hover |
| `#e0e0e0` | `var(--color-text-primary)` | Dark mode primary text |
| `#1a1a1a` | `var(--color-text-primary)` | Light mode primary text |
| `#c1c2c5` | `var(--color-text-secondary)` | Dark mode secondary text |
| `#495057` | `var(--color-text-secondary)` | Light mode secondary text |
| `#909296` | `var(--color-text-tertiary)` | Dark mode tertiary text |
| `#868e96` | `var(--color-text-tertiary)` | Light mode tertiary text |
| `rgba(99,102,241,0.15)` | `var(--color-interactive-selected)` | Selected state |
| `#6366f1` | `var(--color-accent)` | Accent color |

---

## Appendix B: Spacing Mapping Reference

Map existing hard-coded spacing to CSS variables:

| Current Value | CSS Variable |
|--------------|-------------|
| `4px` | `var(--spacing-xs)` |
| `8px` | `var(--spacing-sm)` |
| `16px` | `var(--spacing-md)` |
| `24px` | `var(--spacing-lg)` |
| `32px` | `var(--spacing-xl)` |
| `40px 20px` | `var(--layout-container-padding)` |
| `800px` | `var(--layout-max-content-width)` |
| `200px` | `var(--layout-content-bottom-padding)` |
| `44px` | `var(--layout-title-bar-height)` |

---

## Appendix C: Performance Targets

Benchmark metrics before and after refactoring:

| Metric | Current | Target | Measurement Method |
|--------|---------|--------|-------------------|
| FileTreeIndex render time | TBD | < 100ms | React DevTools Profiler |
| BlockEditor render time | TBD | < 50ms | React DevTools Profiler |
| Theme switch time | TBD | < 200ms | Manual timing |
| Large tree (100 pages) | TBD | No lag | User perception |
| Large document (1000 blocks) | TBD | No lag | User perception |
| Memory usage | TBD | No leaks | Chrome DevTools |

---

**END OF REFACTORING PLAN**