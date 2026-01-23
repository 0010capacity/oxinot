# Copilot Agent Testing Scenarios

## Prerequisites
- Workspace open with at least one page
- AI provider configured (Claude or OpenAI)
- API key set in settings

## Test Scenarios

### 1. Simple Block Creation
**Goal**: Create a single block

**Steps**:
1. Open Copilot panel (Cmd/Ctrl + ;)
2. Type: "Create a block with the text 'Hello World'"
3. Send message

**Expected Behavior**:
- Agent should display "💭 Thinking" message
- Agent should display "🔧 Using tool: create_block" message
- Agent should display "✅ Tool executed successfully" message
- A new block with "Hello World" should appear in the current page
- Agent should provide a final answer confirming the task

### 2. Multiple Block Creation
**Goal**: Create multiple blocks in sequence

**Steps**:
1. Type: "Create 3 blocks with: 'Task 1', 'Task 2', 'Task 3'"
2. Send message

**Expected Behavior**:
- Agent should iterate multiple times
- Each iteration should call create_block tool
- System messages should show progress (💭, 🔧, ✅)
- 3 new blocks should be created
- Final answer confirms completion

### 3. Block Update
**Goal**: Update existing block content

**Steps**:
1. Create a block manually with text "Draft"
2. Focus on that block
3. Type in Copilot: "Update @current to say 'Final Version'"
4. Send message

**Expected Behavior**:
- Agent recognizes @current mention
- Calls update_block tool with focused block ID
- Block content changes to "Final Version"
- Success confirmation displayed

### 4. Complex Multi-Step Task
**Goal**: Test agent's ability to break down complex tasks

**Steps**:
1. Type: "Create a todo list with 5 items about learning TypeScript"
2. Send message

**Expected Behavior**:
- Agent plans the task
- Creates 5 blocks sequentially
- Each block contains a todo item related to TypeScript
- Agent provides summary of what was created

### 5. Error Handling
**Goal**: Test agent's behavior when tool fails

**Steps**:
1. Type: "Update block with ID 'invalid-uuid' to say 'test'"
2. Send message

**Expected Behavior**:
- Agent attempts to use tool
- Tool returns error (invalid UUID)
- Agent displays "❌ Tool failed" message
- Agent either retries with correct approach or reports inability to complete

### 6. Query and Action
**Goal**: Test agent using search + action

**Steps**:
1. Create several blocks with various content
2. Type: "Find all blocks containing 'important' and delete them"
3. Send message

**Expected Behavior**:
- Agent first uses query_blocks tool
- Agent reviews results
- Agent uses delete_block tool for each matching block
- Final summary of deletions

## Manual Testing Checklist

- [ ] Simple block creation works
- [ ] Multiple sequential tools work
- [ ] @mention context resolution works
- [ ] Agent respects iteration limit (max 10)
- [ ] Error messages display properly
- [ ] UI updates in real-time as agent works
- [ ] Chat history persists across messages
- [ ] Clear chat button works
- [ ] Agent stops when task is complete
- [ ] Console logs show proper execution flow

## Performance Expectations

- Response time: 2-10 seconds per tool call (depends on AI provider)
- UI updates: Real-time, no blocking
- Memory: Agent state should be properly cleaned up after completion

## Known Limitations

- Maximum 10 iterations per task
- Tools requiring approval will wait for user confirmation
- No support for parallel tool execution (sequential only)
- Context window limited to last 20 messages for history
