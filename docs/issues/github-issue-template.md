## Summary
The hybrid markdown rendering system has inverted logic between initial render state and cursor focus state. When fixing one, the other breaks - creating an "Othello game" scenario where every fix flips the problem to the opposite state.

## Problem Description

### The Othello Pattern
1. **Fix initial render** → Cursor focus behavior inverts
2. **Fix cursor focus** → Initial render state inverts
3. Repeat infinitely...

### Current Behavior (Broken)
- **Initial page load**: All blocks show raw markdown (`[[Welcome]]`, `## Heading`)
- **After clicking a block**: Only focused block shows raw markdown, unfocused blocks render properly
- **Expected**: Opposite of both

### Expected Behavior
- **Initial page load**: All unfocused blocks should render markdown (hide markers)
- **After clicking a block**: Focused block should show raw markdown (show markers for editing)
- **After clicking elsewhere**: Previous block should return to rendered state

## Technical Details

### Architecture
```
BlockComponent (isFocused prop)
  ↓
Editor (useLayoutEffect updates facet)
  ↓
createEditor (isFocusedFacet)
  ↓
hybridRendering.ts (buildDecorations)
  ↓
Handlers (WikiLinkHandler, HeadingHandler, etc.)
```

### Current Logic Flow

**1. Initial State**
```typescript
config.isFocused ?? false  // Default: false (unfocused)
↓
isFocusedFacet = false
↓
editorHasFocus = false
↓
shouldShowMarkers = false
```

**2. Handler Behavior (when `shouldShowMarkers = false`)**
```typescript
// WikiLinkHandler
if (shouldShowMarkers) continue;  // false → don't continue → render
// Expected: render ✓

// HeadingHandler  
createHiddenMarker(..., false)  // false → 'cm-hidden'
// Expected: hide markers ✓
```

**3. Actual Result**
- Logic appears correct
- But screen shows raw markdown for ALL blocks
- Suggests handlers aren't executing properly OR there's a deeper state issue

### The Core Contradiction

**Observation from logs:**
- Initial: 1 block with `isFocused: true`, 20 blocks with `isFocused: false`
- Screen: ALL blocks show raw markdown (as if all are focused)
- Logic: `shouldShowMarkers = false` should trigger rendering

**Hypothesis:**
The boolean logic is correct, but there's a semantic mismatch between what the code does and what the screen shows. Possibly:
- CSS override preventing proper rendering
- Decoration not being applied despite correct logic
- Race condition in decoration application
- React re-rendering clearing decorations

## Performance Issues

### Excessive Re-rendering
Single page load generates **hundreds of duplicate logs**:
```
[Editor Created] isFocused: false (x50+)
[buildDecorations] editorHasFocus from facet: false (x100+)
[processLine] lineText: "[[Welcome]]..." (x50+ per line)
```

**Causes:**
1. React remounting components unnecessarily
2. Missing key props in lists
3. No memoization on Editor/BlockComponent
4. Every cursor move triggers full page re-render

**Impact:**
- Poor performance
- Battery drain
- Makes debugging impossible (log spam)

## Code Quality Issues

### 1. Meaningless Function
```typescript
// src/editor/extensions/hybridRendering.ts:160
function shouldShowMarkersForLine(editorHasFocus: boolean): boolean {
  return editorHasFocus;  // Just returns input!
}
```
**Issue:** No-op function that adds zero value. Should be removed entirely.

### 2. Poor Variable Naming
```typescript
shouldShowMarkers  // Describes ACTION, not STATE
```
**Problem:** 
- Doesn't indicate WHEN markers should be shown
- "Should show markers = true" doesn't explain WHY

**Better names:**
- `isEditing` - Is the block in edit mode?
- `hasFocus` - Does this block have focus?
- `isInEditMode` - Is the user editing this block?

### 3. Inconsistent Terminology
Mixed usage of:
- "show markers" (original markdown visible)
- "hide markers" (rendered output)
- "render" (process markdown)
- "edit mode" / "preview mode"

**Need unified terminology:**
- **Edit Mode** (`isEditing = true`): Show raw markdown with markers
- **Preview Mode** (`isEditing = false`): Show rendered content without markers

### 4. Handler Logic Inconsistency
Different handlers use opposite logic:

```typescript
// WikiLinkHandler (regex-based)
if (shouldShowMarkers) continue;  // true = show original

// HeadingHandler (syntax-tree-based)  
createHiddenMarker(..., shouldShowMarkers);  // true = dim, false = hidden
```

This creates confusion about what `shouldShowMarkers` means.

## Root Cause Analysis

### Theory 1: Semantic Inversion
- Variable name says "show markers"
- But logic sometimes means "render" (opposite)
- Led to multiple logic inversions throughout refactoring

### Theory 2: State Timing
- Initial render happens before focus state properly propagates
- useLayoutEffect runs but decorations built with stale state
- Need to force decoration rebuild after focus state updates

### Theory 3: Decoration Application
- Decorations are built correctly
- But not applied to DOM properly
- CSS or CodeMirror state preventing application

## Tasks to Fix

### Phase 1: Stabilize & Understand
- [ ] Fix excessive re-rendering
  - Add proper React keys to BlockComponent list
  - Memoize Editor component
  - Prevent unnecessary BlockComponent remounts
- [ ] Add minimal targeted logging
  - Log only on focus change
  - Log decoration application success/failure
- [ ] Verify decorations are actually applied to DOM

### Phase 2: Refactor Logic
- [ ] Remove `shouldShowMarkersForLine()` function
- [ ] Rename `shouldShowMarkers` to `isEditing`
- [ ] Unify terminology everywhere (edit mode / preview mode)
- [ ] Make all handlers use consistent logic direction
- [ ] Add comprehensive comments explaining logic flow

### Phase 3: Fix Core Issue
- [ ] Trace exact point where logic inverts
- [ ] Fix timing issue if it's state propagation
- [ ] Fix handler logic if it's semantic inversion
- [ ] Add integration tests for both states

## Files Involved
- `src/editor/extensions/hybridRendering.ts` - Core rendering logic
- `src/editor/extensions/handlers/WikiLinkHandler.ts` - Regex-based handler
- `src/editor/extensions/handlers/HeadingHandler.ts` - Syntax-tree handler
- `src/editor/extensions/handlers/types.ts` - RenderContext definition
- `src/editor/extensions/utils/decorationHelpers.ts` - createHiddenMarker
- `src/components/Editor.tsx` - Focus state updates
- `src/outliner/BlockComponent.tsx` - Focus prop passing
- `src/editor/createEditor.ts` - Initial facet setup

## Test Cases Needed
1. Initial page load: all blocks rendered (preview mode)
2. Click block: focused block shows raw markdown (edit mode)
3. Click different block: previous returns to preview, new shows edit
4. Arrow key navigation: same behavior as click
5. Blur editor: all return to preview mode

## References
- Original issue started during refactoring for block-level focus
- Multiple fix attempts resulted in flipped behavior
- Performance issues discovered during debugging with logs