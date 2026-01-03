# Refactoring Roadmap

## Current State Assessment

### ✅ What's Working Well

1. **Architecture Separation**
   - Clear boundaries between CM6, React, and rendering logic
   - Single source of truth (plain markdown string)
   - No feedback loops between React state and CM6

2. **Performance**
   - Viewport-only rendering
   - Efficient decoration rebuilding
   - Proper React ref management

3. **Type Safety**
   - Good TypeScript usage
   - Well-defined interfaces
   - Type-safe configuration

4. **Feature Completeness**
   - All major markdown elements supported
   - GFM extensions working
   - Interactive elements (checkboxes, links)
   - Good cursor behavior (show markers on edit)

### ❌ What Needs Improvement

1. **`hybridRendering.ts` is 1012 lines** (788 lines in `buildDecorations` alone)
   - God function anti-pattern
   - Hard to maintain, test, and extend
   - Repeated patterns everywhere

2. **Code Duplication**
   - `isOnCursorLine` check repeated 15+ times
   - Marker hiding logic duplicated
   - Decoration creation patterns repeated

3. **Hard-coded Styles**
   - Inline style strings scattered throughout
   - No style constants or theme system
   - Magic numbers everywhere

4. **Complex Table Logic**
   - 100+ lines of table rendering in one place
   - Hard to understand state management
   - Difficult to debug

5. **No Tests**
   - Complex logic with zero test coverage
   - Can't refactor with confidence
   - Edge cases not validated

6. **Poor Documentation**
   - Complex logic without comments
   - No explanation of "why" decisions
   - Missing API docs

---

## Refactoring Plan

### Phase 1: Extract Utilities (Low Risk, High Value)

**Goal:** Reduce duplication, make code more readable

#### 1.1 Create `src/editor/extensions/utils/decorationHelpers.ts`

```typescript
// Helper functions for common decoration patterns
export function isOnCursorLine(line: Line, cursorLineFrom: number, cursorLineTo: number): boolean
export function createHiddenMarker(from: number, to: number, isOnCursor: boolean): DecorationSpec
export function createStyledText(from: number, to: number, styles: StyleConfig): DecorationSpec
```

#### 1.2 Create `src/editor/extensions/utils/nodeHelpers.ts`

```typescript
// Helper functions for syntax tree navigation
export function getLineInfo(state: EditorState, pos: number): LineInfo
export function getCursorInfo(state: EditorState): CursorInfo
export function isNodeInViewport(node: SyntaxNode, viewport: Viewport): boolean
```

#### 1.3 Create `src/editor/extensions/theme/styles.ts`

```typescript
// Centralized style constants
export const HEADING_SIZES = [2.2, 2.0, 1.8, 1.6, 1.4, 1.2]
export const MARKER_STYLES = {
  hidden: 'display: none;',
  dimmed: 'opacity: 0.4; font-size: 0.85em;',
}
```

**Estimated Time:** 4-6 hours  
**Impact:** Reduces duplication by ~40%, improves readability  
**Risk:** Very low (pure extraction, no logic changes)

---

### Phase 2: Split Into Handlers (Medium Risk, High Value)

**Goal:** Break down the giant `buildDecorations` function

#### 2.1 Create Handler Interface

```typescript
// src/editor/extensions/handlers/types.ts
export interface DecorationHandler {
  canHandle(node: SyntaxNode): boolean
  handle(node: SyntaxNode, context: RenderContext): DecorationSpec[]
}

export interface RenderContext {
  state: EditorState
  cursorLine: Line
  decorations: DecorationSpec[]
}
```

#### 2.2 Create Individual Handlers

```
src/editor/extensions/handlers/
  ├── HeadingHandler.ts        (~50 lines)
  ├── EmphasisHandler.ts       (~40 lines)
  ├── StrongHandler.ts         (~40 lines)
  ├── InlineCodeHandler.ts     (~30 lines)
  ├── CodeBlockHandler.ts      (~60 lines)
  ├── BlockquoteHandler.ts     (~40 lines)
  ├── LinkHandler.ts           (~50 lines)
  ├── TaskListHandler.ts       (~70 lines)
  ├── TableHandler.ts          (~150 lines - still complex but isolated)
  ├── StrikethroughHandler.ts  (~40 lines)
  └── FootnoteHandler.ts       (~50 lines)
```

#### 2.3 Create Handler Registry

```typescript
// src/editor/extensions/handlers/HandlerRegistry.ts
export class HandlerRegistry {
  private handlers: DecorationHandler[] = []
  
  register(handler: DecorationHandler): void
  handleNode(node: SyntaxNode, context: RenderContext): DecorationSpec[]
}
```

#### 2.4 Refactor `buildDecorations`

```typescript
// New buildDecorations - much simpler!
function buildDecorations(view: EditorView): DecorationSet {
  const registry = getHandlerRegistry()
  const context = createRenderContext(view)
  
  for (const { from, to } of view.visibleRanges) {
    const tree = syntaxTree(context.state)
    tree.iterate({
      from,
      to,
      enter: (node) => {
        const specs = registry.handleNode(node, context)
        context.decorations.push(...specs)
      }
    })
  }
  
  return buildDecorationSet(context.decorations)
}
```

**Estimated Time:** 12-16 hours  
**Impact:** Massive improvement in maintainability, testability  
**Risk:** Medium (need careful testing, but handlers are isolated)

---

### Phase 3: Add Tests (Medium Risk, High Value)

**Goal:** Enable confident refactoring and catch regressions

#### 3.1 Setup Testing Infrastructure

```
tests/
  ├── setup.ts
  ├── utils/
  │   ├── createTestEditor.ts
  │   └── fixtures.ts
  └── handlers/
      ├── HeadingHandler.test.ts
      ├── TaskListHandler.test.ts
      └── ... (one test per handler)
```

#### 3.2 Write Handler Tests

```typescript
// Example test structure
describe('HeadingHandler', () => {
  it('should hide hash marks when cursor is not on line')
  it('should show dimmed hash marks when cursor is on line')
  it('should apply correct font size based on heading level')
  it('should handle headings without content')
  // etc.
})
```

#### 3.3 Write Integration Tests

```typescript
describe('Hybrid Rendering Integration', () => {
  it('should handle mixed inline elements')
  it('should handle nested structures')
  it('should handle cursor movement')
  // etc.
})
```

**Estimated Time:** 16-20 hours  
**Impact:** Confidence in code, catch regressions, enable future refactoring  
**Risk:** Low (tests don't break existing functionality)

---

### Phase 4: Improve Table Rendering (High Risk, Medium Value)

**Goal:** Simplify complex table logic

#### 4.1 Research Alternative Approaches

- Can we use a custom widget with better encapsulation?
- Can we use a state machine for table parsing?
- Can we cache table structure between renders?

#### 4.2 Implement New Table Handler

```typescript
// src/editor/extensions/handlers/table/
  ├── TableParser.ts       // Parse table structure
  ├── TableWidget.ts       // Custom widget if needed
  ├── TableDecorator.ts    // Create decorations
  └── TableHandler.ts      // Main handler
```

#### 4.3 Add Table-Specific Tests

**Estimated Time:** 8-12 hours  
**Impact:** Easier to maintain, potential performance improvement  
**Risk:** High (tables are complex, many edge cases)

---

### Phase 5: Polish & Documentation (Low Risk, Medium Value)

**Goal:** Make codebase accessible to new contributors

#### 5.1 Add JSDoc Comments

- Document all public APIs
- Explain complex algorithms
- Add usage examples

#### 5.2 Create Architecture Documentation

```
docs/
  ├── ARCHITECTURE.md       // High-level overview
  ├── DECORATIONS.md        // How decorations work
  ├── HANDLERS.md           // Handler system guide
  └── CONTRIBUTING.md       // How to add new features
```

#### 5.3 Add Inline Comments

- Explain "why" decisions
- Document workarounds for CM6 limitations
- Add references to related issues/docs

**Estimated Time:** 6-8 hours  
**Impact:** Easier onboarding, better maintenance  
**Risk:** Very low

---

## Implementation Strategy

### Recommended Order

1. **Phase 1 First** (extract utils)
   - Low risk, immediate value
   - Makes Phase 2 easier
   - Can be done incrementally

2. **Phase 2 Second** (split handlers)
   - Do one handler at a time
   - Test each handler as you go
   - Start with simplest handlers (Emphasis, Strong)
   - Leave TableHandler for last

3. **Phase 3 Alongside Phase 2**
   - Write tests for each handler after creating it
   - Prevents test writing from becoming a huge task

4. **Phase 4 Optional**
   - Only if table logic becomes a maintenance burden
   - Can be postponed

5. **Phase 5 Continuous**
   - Add documentation as you refactor
   - Don't leave it all for the end

### Success Metrics

- [ ] `hybridRendering.ts` reduced from 1012 lines to <200 lines
- [ ] No single function >100 lines
- [ ] Test coverage >80% for handler logic
- [ ] All handlers in separate files
- [ ] Zero code duplication for common patterns
- [ ] All "magic numbers" replaced with named constants
- [ ] Architecture documentation complete

---

## Alternative: "Big Bang" Rewrite?

### ❌ Not Recommended

**Pros:**
- Clean slate, perfect architecture
- No legacy constraints

**Cons:**
- High risk of breaking existing functionality
- Long period without shipping features
- Easy to miss edge cases
- Lose institutional knowledge encoded in current code

**Verdict:** Incremental refactoring is safer and more pragmatic.

---

## Conclusion

**Current Grade:** B- (functional but needs refactoring)  
**Target Grade:** A (clean, maintainable, tested)

The code works and demonstrates good architectural instincts, but has grown organically without sufficient refactoring. The proposed plan addresses technical debt while maintaining functionality and shipping value.

**Next Action:** Start with Phase 1 (extract utilities) - 4-6 hours of work for immediate improvement.