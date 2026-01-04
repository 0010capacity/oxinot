# Welcome to Block-Based Outliner 🧠
This is a **Logseq-style** outliner with *full markdown support*
## Markdown Features
  **Bold text** and *italic text* work perfectly
  `inline code` is rendered beautifully
  [Links](https://example.com) are clickable
  You can also use ~~strikethrough~~ text
### Code Blocks
  Here's some JavaScript using a **code block** (type ```):
  ```javascript
function greet(name) {
  console.log(`Hello, ${name}!`);
  return true;
}

const result = greet("World");
  ```
  Python example:
  ```python
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)
  ```
### Lists and Formatting
  Regular **bullet** points
  With *nested* formatting
    Even in `child blocks`
    > Blockquotes work too!
## Special Block Types
### Tables
  Type `|||` to create a table.
### Fence Blocks ///
  Type `///` to create a multi-line fence block
  ///
This is a fence block.
It can contain multiple lines.
Perfect for longer content!

You can have paragraphs,

And even **markdown** inside.
  ///
  Fence blocks are great for:
    Quotes
    Multi-line notes
    Free-form text
### Code Blocks ```
  Type ```javascript` or ```python` to create a code block
  Code blocks have:
    Syntax highlighting support
    Language-specific formatting
    Square bullet icon (green)
  Try typing ``` on any line!
## Typography Examples
  # H1 Heading
  ## H2 Heading
  ### H3 Heading
  #### H4 Heading
## Inline Code and Math
  Use `const x = 42` for inline code
  Or `Array.from({ length: 5 })` for longer expressions
## Project: Build a Blog
  ### Planning Phase
    Define requirements
      User authentication
      Post editor with **markdown**
      Comment system
    Research tech stack
      Frontend: React + TypeScript
      Backend: Node.js + Express
      Database: PostgreSQL
  ### Development
    Setup repository
      `git init` and create `.gitignore`
      Setup `package.json` with dependencies
    Build components
      Header component
      Post list
      Post detail with `syntax highlighting`
  ### Testing & Launch
    Write unit tests
    Deploy to production
      Setup CI/CD pipeline
      Configure environment variables
## Learning: React Hooks
  **useState** - State management
    `const [count, setCount] = useState(0)`
    Best for simple state
  **useEffect** - Side effects
    Runs after render
    ```javascript
useEffect(() => {
  document.title = `Count: ${count}`;
  return () => console.log('cleanup');
}, [count]);
    ```
  **useCallback** - Memoized functions
  **useMemo** - Memoized values
## Daily Notes - 2024
  ### Today's Tasks ✅
    [x] Review pull requests
    [ ] Team standup at 10am
    [ ] Finish *documentation*
    [ ] Deploy to **staging**
  ### Ideas 💡
    Write blog: "Why Block-Based Editing Changes Everything"
    Add keyboard shortcuts: `Cmd+K` for quick search
    Implement block references: `[[Block ID]]`
  ### Meetings
    {
**Design Review Meeting**

Attendees: Sarah, John, Mike
Topics:
- New dashboard layout
- Mobile responsiveness
- Color scheme updates

Action items:
1. Update mockups by Friday
2. Schedule follow-up next week
    }
    Meeting notes in fence format:
    ///
MEETING NOTES - 2024
===================
Topic: Q1 Planning
Duration: 1 hour
Next steps: Follow up next week
    ///
## Getting Started
  Start typing in any block
  Press **Enter** to create a new block
  Press **Tab** to indent (create child)
  Press **Shift+Tab** to outdent
  Use markdown syntax naturally - it renders **live**!
Your First Blocks
  Your text here...
    Add child blocks...
      Go as deep as you need!