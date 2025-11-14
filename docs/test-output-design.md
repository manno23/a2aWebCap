# Test Output Design - Enhanced Readability

## Overview
This design improves test output readability through:
- **Consistent color coding** for common events across all tests
- **Clear visual separation** between test cases
- **Columnar layout** for better data organization
- **Event folding** for sequential common operations
- **Explicit condition display** showing what's being tested

## Color Scheme

### Task States
- `submitted` - **Cyan** (#00BFFF)
- `working` - **Yellow** (#FFD700)
- `input-required` - **Magenta** (#FF00FF)
- `auth-required` - **Orange** (#FFA500)
- `completed` - **Green** (#00FF00)
- `canceled` - **Gray** (#808080)
- `failed` - **Red** (#FF0000)
- `rejected` - **Dark Red** (#8B0000)

### Event Types
- Task creation - **Blue** (#0080FF)
- Status update - **Yellow** (#FFD700)
- Artifact update - **Purple** (#9370DB)
- Subscription - **Teal** (#008080)
- Error/Exception - **Red** (#FF0000)
- Assertion/Expect - **White** (bold)
- Pass indicator - **Bright Green** (#00FF00)
- Fail indicator - **Bright Red** (#FF0000)

### Operations
- API call - **Cyan** (#00BFFF)
- Wait/Sleep - **Gray** (#808080)
- Filter/Query - **Magenta** (#FF00FF)
- Database operation - **Blue** (#0080FF)

## Layout Structure

### Test Suite Header
```
╔══════════════════════════════════════════════════════════════════════════════╗
║ Test Suite: [Name]                                                    [Time] ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

### Test Case Structure
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ✓ Test: [Test Name]                                              [Duration] │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ [Test Details - see below]                                                  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Describe Block
```
╭─ Describe: [Group Name] ─────────────────────────────────────────────────────╮
│ [Tests inside this group]                                                    │
╰──────────────────────────────────────────────────────────────────────────────╯
```

## Event Folding Examples

### Before (verbose):
```
Creating task with message: 'Hello'
Task created with ID: task-123
Updating task status to: submitted
Status updated
Event emitted: submitted
Updating task status to: working
Status updated
Event emitted: working
```

### After (folded):
```
Create Task → submitted → working  [task-123]
  └─ Events: submitted, working
```

### State Transition Folding
```
States: submitted → working → input-required → working → completed
  └─ Events: 5 total (all propagated)
```

### Multiple Sequential API Calls
```
Tasks Created: 3 × createTask() → [task-001, task-002, task-003]
  └─ All states: working
```

## Column Layout

### For Event Sequences
```
TIME      EVENT           STATE         TASK-ID      DETAILS
────────  ──────────────  ────────────  ───────────  ─────────────────
00:00.123 TaskCreated     submitted     task-abc123  Message: "Hello"
00:00.145 StateUpdate     working       task-abc123  -
00:00.890 ArtifactUpdate  working       task-abc123  1 artifact added
00:01.234 StateUpdate     completed     task-abc123  final=true
```

### For Assertions
```
ASSERTION                                    EXPECTED           ACTUAL            STATUS
───────────────────────────────────────────  ─────────────────  ───────────────  ──────
statusUpdates.length > 0                     true               true              ✓
states includes 'working'                    true               true              ✓
finalEvents.length === 1                     1                  1                 ✓
finalEvents[0].status.state === 'completed'  'completed'        'completed'       ✓
```

## Test Condition Display

### Explicit "Testing For" Section
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ✓ should create streaming task and receive updates                   234ms  │
├──────────────────────────────────────────────────────────────────────────────┤
│ Testing Conditions:                                                          │
│   • Streaming task is created successfully                                  │
│   • Receives status updates during execution                                │
│   • Contains 'working' state in update sequence                             │
│   • Receives exactly one final event                                        │
│   • Final event state is 'completed'                                        │
│                                                                              │
│ Execution:                                                                   │
│   Create Task → submitted → working → completed  [task-7f8a9b]              │
│     └─ Callback received: 3 status updates, 0 artifacts                     │
│                                                                              │
│ Assertions: 5/5 passed                                                      │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Progress Indicators

### During Execution
```
⏳ Streaming Integration
   ✓ should create streaming task and receive updates (234ms)
   ⏳ should send updates to multiple callbacks...
```

### Summary
```
╔══════════════════════════════════════════════════════════════════════════════╗
║ Test Results Summary                                                         ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ Total Tests:    45                                                           ║
║ Passed:         43  ████████████████████████████████████████░░  95.6%        ║
║ Failed:          2  ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   4.4%        ║
║ Skipped:         0                                                           ║
║                                                                              ║
║ Duration:       3.45s                                                        ║
║ Slowest Test:   basic-flow.test.ts - 890ms                                  ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

## Compact Mode for Passing Tests

When all tests pass, fold them into single lines:
```
╭─ Streaming Integration ──────────────────────────────────────────────────────╮
│ ✓ 10 tests passed (1.23s)                                                   │
│   • should create streaming task and receive updates                        │
│   • should send updates to multiple callbacks                               │
│   • should work without callback                                            │
│   • should handle task state transitions correctly                          │
│   • should propagate context and task IDs correctly                         │
│   • should get current task from streaming task                             │
│   • should handle callback errors gracefully                                │
│   • should support unsubscribing callbacks                                  │
│   • should report final state correctly                                     │
│   • Protocol Invariants (5 sub-tests)                                       │
╰──────────────────────────────────────────────────────────────────────────────╯
```

## Verbose Mode for Failures

When tests fail, expand with full details:
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ✗ should enforce Invariant 3: Exactly one final event                234ms  │
├──────────────────────────────────────────────────────────────────────────────┤
│ Testing Conditions:                                                          │
│   • Exactly one event has final=true                                        │
│                                                                              │
│ Execution:                                                                   │
│   Create Task → submitted → working → completed  [task-xyz789]              │
│     └─ Callback received: 4 status updates                                  │
│                                                                              │
│ Assertions:                                                                  │
│   FAILED: finalEvents.length === 1                                          │
│     Expected: 1                                                              │
│     Actual:   2                                                              │
│                                                                              │
│ Event Details:                                                               │
│   TIME      EVENT          STATE        FINAL    TASK-ID                    │
│   ────────  ─────────────  ───────────  ───────  ────────                   │
│   00:00.12  StatusUpdate   submitted    false    task-xyz789                │
│   00:00.15  StatusUpdate   working      false    task-xyz789                │
│   00:00.89  StatusUpdate   completed    true     task-xyz789                │
│   00:00.91  StatusUpdate   completed    true     task-xyz789  ⚠️ DUPLICATE  │
│                                                                              │
│ Stack Trace:                                                                 │
│   at streaming.test.ts:301:7                                                │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Special Formatting

### Invariant Tests
```
Protocol Invariants:
  Inv-3: Exactly one final event                                          ✓
  Inv-4: Final event is last                                              ✓
  Inv-5: Consistent ID propagation                                        ✓
```

### Security Tests
```
🔒 Security Tests:
  Rate Limiting:
    ✓ Allow within limits         [5/5 requests → 5 allowed]
    ✓ Reject exceeding limits      [6/5 requests → 1 blocked]
    ✓ Track users separately       [user1: 2/5, user2: 1/5]
```

### E2E Flow Tests
```
End-to-End Flow:
  1. Server starts                 ✓ (http://localhost:8181)
  2. Client connects               ✓ (WebSocket ready)
  3. Send message                  ✓ (task-abc created)
  4. Task processes                ✓ (submitted → working → completed)
  5. Retrieve status               ✓ (status: completed, history: 2 msgs)
```

## Implementation Notes

### ANSI Color Codes
```javascript
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',

  // Foreground colors
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
  white: '\x1b[37m',

  // Background colors
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
};
```

### Box Drawing Characters
```javascript
const box = {
  topLeft: '┌', topRight: '┐',
  bottomLeft: '└', bottomRight: '┘',
  horizontal: '─', vertical: '│',

  // Double lines for headers
  doubleTopLeft: '╔', doubleTopRight: '╗',
  doubleBottomLeft: '╚', doubleBottomRight: '╝',
  doubleHorizontal: '═', doubleVertical: '║',

  // Rounded for describe blocks
  roundTopLeft: '╭', roundTopRight: '╮',
  roundBottomLeft: '╰', roundBottomRight: '╯',
};
```

## Example Full Test Output

```
╔══════════════════════════════════════════════════════════════════════════════╗
║ Streaming Integration Tests                                         RUN #1  ║
╚══════════════════════════════════════════════════════════════════════════════╝

╭─ sendMessageStreaming ───────────────────────────────────────────────────────╮
│                                                                              │
│ ┌────────────────────────────────────────────────────────────────────────┐   │
│ │ ✓ should create streaming task and receive updates              234ms │   │
│ ├────────────────────────────────────────────────────────────────────────┤   │
│ │ Testing: Streaming task creation and status update delivery      │   │
│ │                                                                        │   │
│ │ Flow: Create Task → submitted → working → completed [task-7f8a9b]     │   │
│ │   └─ 3 status updates, 1 final event                                  │   │
│ │                                                                        │   │
│ │ ✓ All 5 assertions passed                                             │   │
│ └────────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│ ✓ should send updates to multiple callbacks                          178ms  │
│ ✓ should work without callback                                       156ms  │
│ ✓ should handle task state transitions correctly                     201ms  │
│ ✓ should propagate context and task IDs correctly                    189ms  │
│                                                                              │
╰──────────────────────────────────────────────────────────────────────────────╯

╭─ Protocol Invariants ────────────────────────────────────────────────────────╮
│ Inv-3: ✓ Exactly one final event                                      145ms  │
│ Inv-4: ✓ Final event is last                                          132ms  │
│ Inv-5: ✓ Consistent ID propagation                                    156ms  │
╰──────────────────────────────────────────────────────────────────────────────╯

╔══════════════════════════════════════════════════════════════════════════════╗
║ Results                                                                      ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ ✓ 8 tests passed                                              Total: 1.39s  ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

## Configuration Options

Users can configure:
- `compact`: boolean - Use compact mode for passing tests (default: true)
- `showTiming`: boolean - Show timing for each test (default: true)
- `colorScheme`: 'default' | 'monochrome' | 'high-contrast'
- `verbosity`: 'minimal' | 'normal' | 'verbose'
- `foldEvents`: boolean - Fold sequential events (default: true)
- `showConditions`: boolean - Show "Testing Conditions" section (default: true)

## Next Steps

1. Create custom Vitest reporter implementing this design
2. Add configuration file for color/layout preferences
3. Test with existing test suite
4. Iterate based on real-world usage
