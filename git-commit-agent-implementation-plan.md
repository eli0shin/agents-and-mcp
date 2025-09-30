# Git Commit Agent Implementation Plan

## Overview

Create a new git commit agent using Vercel AI SDK v5 with the Anthropic provider (Sonnet 4) to intelligently analyze changes and create meaningful git commits. The agent will follow the established patterns from the research agent implementation.

## Research Summary

### Key Findings from Codebase Analysis

1. **Architecture Pattern**: Multi-phase orchestrated architecture with clean separation of concerns
2. **AI Integration**: Vercel AI SDK v5.0.48 with Anthropic provider using `claude-sonnet-4-5-20250929`
3. **CLI Framework**: Commander.js with TypeScript extra typings
4. **Dependencies**: All required dependencies already available (no new installations needed)
5. **Testing**: Bun test framework with existing patterns for mocking external dependencies

### Existing Patterns to Follow

- **Functional Design**: Use functions and types over classes/interfaces
- **State Management**: Immutable state updates with persistence
- **Error Handling**: Success/failure wrapper pattern with graceful degradation
- **Tool Implementation**: Zod validation with typed responses
- **Session Storage**: Automatic persistence for debugging

## Implementation Plan

### Phase 1: Project Structure Setup

**Goal**: Create the folder structure and basic TypeScript definitions

**Tasks**:

1. Create `/src/git-commit-agent/` directory
2. Create core files:
   - `index.ts` - Main orchestrator and public API
   - `types.ts` - TypeScript type definitions
   - `tools.ts` - Tool implementations (bash, read-file)
   - `prompts.ts` - AI prompt templates for commit generation

**Expected Output**: Complete folder structure with empty/skeleton files

### Phase 2: Tool Implementation

**Goal**: Implement the two required tools using Vercel AI SDK v5 patterns

## Tool Design and Implementation Details

### Bash Tool Implementation

**Core Function**: Execute shell commands and return stdout/stderr

**Literal Implementation**:
```typescript
import { z } from 'zod';
import { $ } from 'bun';

const bashTool = {
  description: "Execute bash commands for git operations",
  inputSchema: z.object({
    command: z.string().describe("The bash command to execute")
  }),
  execute: async ({ command }: { command: string }) => {
    // Use Bun.$ to execute the command
    const result = await $`${command}`.text();
    return result;
  }
}
```

**How it works**:
1. AI calls tool with `{ command: "git status" }`
2. Function receives the command string
3. `Bun.$` executes the exact command in shell
4. Returns the raw stdout text to the AI
5. AI can use the output to understand repository state

**Key Patterns**:
- Use template literal with `Bun.$` for command execution
- `.text()` method returns stdout as string
- Command runs in current working directory by default
- Bun.$ handles shell parsing automatically

### Read File Tool Implementation

**Core Function**: Read file contents from relative path and return as string

**Literal Implementation**:
```typescript
import { z } from 'zod';

const readFileTool = {
  description: "Read file contents given a relative path",
  inputSchema: z.object({
    path: z.string().describe("Relative path to the file to read")
  }),
  execute: async ({ path }: { path: string }) => {
    // Use Bun.file to read the file
    const file = Bun.file(path);
    const content = await file.text();
    return content;
  }
}
```

**How it works**:
1. AI calls tool with `{ path: "package.json" }`
2. Function receives the path string
3. `Bun.file()` creates a file handle
4. `.text()` reads the entire file content as UTF-8 string
5. Returns raw file content to the AI

**Key Patterns**:
- `Bun.file(path)` creates file handle from path
- `.text()` method reads entire file as string
- Paths are relative to current working directory
- Bun automatically handles file encoding detection

### Tool Integration Pattern

**How tools are used together**:
```typescript
// AI can chain commands to understand repository
await bashTool.execute({ command: "git status --porcelain" });
await bashTool.execute({ command: "git diff --cached" });
await readFileTool.execute({ path: "package.json" });
await readFileTool.execute({ path: "README.md" });
```

**AI Tool Selection Logic**:
- **Bash tool**: For any git commands, file system operations, or shell tasks
- **Read file tool**: For examining specific file contents, configs, documentation

**Return Value Strategy**:
- Both tools return raw string output directly
- No wrapper objects or status codes - just the content
- AI processes the raw output to understand context
- Simple string returns keep the interface clean

### Phase 3: Agent Logic Implementation

**Goal**: Create the core agent logic for commit message generation

**Core Functions**:

1. **analyzeRepository**: Analyze current git state
   - Get git status, diff, branch info
   - Identify changed files and their purposes
   - Understand commit history context

2. **generateCommitMessage**: Use AI to create meaningful commit message
   - System prompt: Instructions for creating conventional commits
   - User prompt: Context about changes and repository state
   - Output: Structured commit message with title and description

3. **validateAndCommit**: Execute the actual commit
   - Validate generated message
   - Stage appropriate files
   - Execute commit with generated message
   - Provide feedback to user

**AI Integration Pattern**:

```typescript
const provider = await anthropicProvider;
const result = await generateText({
  model: provider('claude-sonnet-4-5-20250929'),
  tools: [bashTool, readFileTool],
  messages: [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content:
        'Please analyze the repository and create a commit message for the current changes.',
    },
  ],
  providerOptions: {
    anthropic: {
      thinking: { type: 'enabled', budgetTokens: 16000 },
    },
  },
});
```

### Phase 4: CLI Integration

**Goal**: Add git agent command to existing CLI

**CLI Command Structure**:

```typescript
program
  .command('git-commit')
  .description('Intelligent git commit with AI-generated messages')
  .option('-a, --all', 'Stage all changes before analyzing')
  .option('-p, --push', 'Push after successful commit')
  .option('--dry-run', 'Generate commit message without committing')
  .action(async (options) => {
    try {
      const result = await performGitCommit(options);
      console.log(result.message);
    } catch (error) {
      console.error('Git commit failed:', error.message);
      process.exit(1);
    }
  });
```

**Integration Points**:

- Add import to `/src/cli.ts`
- Follow existing error handling patterns
- Use consistent output formatting
- Support dry-run mode for testing

### Phase 5: Testing Implementation

**Goal**: Comprehensive test coverage following TDD principles

**Test Categories**:

1. **Unit Tests** (`git-commit-agent/index.test.ts`):
   - Test tool implementations with mocked external calls
   - Test commit message generation logic
   - Test repository analysis functions

2. **Integration Tests**:
   - Test full git commit workflow
   - Test CLI command integration
   - Test error scenarios and edge cases

**Testing Patterns**:

```typescript
import { test, expect, mock } from 'bun:test';

test('bash tool executes commands correctly', async () => {
  // Mock Bun.$
  const mockExec = mock();
  // Test implementation
});

test('read file tool handles relative paths', async () => {
  // Mock Bun.file
  const mockFile = mock();
  // Test implementation
});
```

## Technical Specifications

### Dependencies

- **No new dependencies required** - all needed packages already installed
- Vercel AI SDK v5.0.48
- Anthropic SDK v2.0.17
- Zod v4.1.11
- Commander.js v14.0.0

### File Structure

```
src/git-commit-agent/
├── index.ts                 # Main orchestrator and public API
├── types.ts                 # TypeScript interfaces and types
├── tools.ts                 # Bash and read-file tool implementations
└── prompts.ts               # AI prompt templates for commit generation
```

### Key Types

```typescript
type CommitResult = {
  success: boolean;
  message: string;
  commitHash?: string;
  error?: string;
};
```

## Implementation Strategy

### Development Approach

1. **TDD (Test-Driven Development)**: Write tests first for each component
2. **Incremental Development**: Build and test each phase independently
3. **Integration Points**: Test CLI integration early and often
4. **Error Handling**: Comprehensive error scenarios and graceful failures

### Success Criteria

- [ ] Agent can analyze git repository state
- [ ] Agent generates meaningful commit messages using AI
- [ ] Agent can execute git commits with proper error handling
- [ ] CLI integration works seamlessly
- [ ] Comprehensive test coverage (>90%)
- [ ] Follows all existing codebase patterns and conventions

### Risk Mitigation

- **Tool Security**: Validate all file paths and bash commands
- **Git Safety**: Implement dry-run mode and confirm before destructive operations
- **Error Recovery**: Graceful handling of network failures, invalid repositories, etc.
- **Performance**: Limit AI token usage and implement reasonable timeouts

## Next Steps

1. **Immediate**: Create project structure and basic files
2. **Day 1**: Implement tools and core agent logic
3. **Day 1**: Add CLI integration and basic testing
4. **Day 2**: Comprehensive testing and refinement

This simplified plan leverages existing patterns while keeping the implementation focused on the core git commit functionality without unnecessary complexity.

