# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CLI toolkit for AI agents and Model Context Protocol (MCP) tooling using Bun, TypeScript, and Vercel AI SDK with Anthropic Claude.

## Development Commands

### Building & Running
- **Build CLI**: `bun run build` (creates `bin/cli` executable)
- **Run CLI**: `./bin/cli` (after building) or `bun src/cli.ts` (dev mode)
- **Test**: `bun test`
- **Type check**: `bun run type`
- **Lint**: `bun run lint` or `bun run lint:fix`
- **Format**: `bun run format` or `bun run format:check`

### CLI Commands
- `./bin/cli search <query>` - Google Custom Search
- `./bin/cli auth <login|logout|status|list>` - Anthropic authentication
- `./bin/cli research <topic>` - Deep research agent
- `./bin/cli commit` - AI-powered git commit

## Architecture

### Core Components

**Research Agent** (`src/research-agent/`): Multi-phase deep research workflow
- Four phases: Initial Search → Strategic Planning → Fan-Out Investigation → Synthesis
- Uses `generateText()` with streaming tool use
- State machine pattern tracked in `ResearchState` type
- Tools: Google Search, Web Fetch (with HTML-to-Markdown conversion)
- Entry point: `performDeepResearch()` in `index.ts`

**Git Commit Agent** (`src/git-commit-agent/`): Automated commit workflow
- AI-generated commit messages using Vercel AI SDK
- Tools: Bash commands (`Bun.$`) and file reading
- Dry-run mode support
- Entry point: `performGitCommit()` in `index.ts`

**Google Scraper** (`src/google-scraper/`): Google Custom Search API client
- TypeScript-first with Zod validation
- Paginated searches (max 100 results)
- Entry point: `GoogleSearchClient` class in `index.ts`

**Anthropic Integration** (`src/anthropic/`): Provider with OAuth support
- Async provider initialization: `anthropicProvider()`
- OAuth preferred over API keys
- Credential storage in `auth/credentialStore.ts`
- CLI commands in `authCommands.ts`

**MCP Server** (`src/mcp.ts`): Basic Model Context Protocol server example using stdio transport

### Architectural Patterns

1. **Vercel AI SDK**: Use `generateText()` for agent interactions, `tool()` for tool definitions, `generateObject()` for structured outputs
2. **Zod-First Validation**: All API schemas and tool parameters validated with Zod v4.1.11
3. **Function-First TypeScript**: Prefer functions and types over classes/interfaces
4. **Bun-Native**: Use `Bun.file()`, `Bun.$`, avoid Node.js equivalents
5. **Parallel Processing**: Use `Promise.all()` for concurrent operations (see research agent phases)
6. **State Management**: Simple in-memory state objects, no persistence

## Key Files

- `src/cli.ts`: Main CLI entry point (Commander.js)
- `src/research-agent/index.ts`: Research orchestrator
- `src/git-commit-agent/index.ts`: Commit agent orchestrator
- `src/anthropic/index.ts`: Anthropic provider export
- `src/google-scraper/index.ts`: Google Search client

## Environment Variables

- `GOOGLE_API_KEY`, `GOOGLE_SEARCH_ENGINE_ID`: Required for Google Search
- Anthropic credentials: Managed via credential store (use `./bin/cli auth login`)

## Testing

- Framework: `bun test`
- Tests colocated with source (e.g., `src/google-scraper/index.test.ts`)
- TDD approach required for new features

---
description: Use Bun instead of Node.js, npm, pnpm, or vite.
globs: '*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json'
alwaysApply: false
---

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.md`.

## Linting

Use `bun run lint` to run ESLint checks and `bun run lint:fix` to auto-fix issues.

## Formatting

Use `bun run format` to format code with Prettier and `bun run format:check` to check formatting.

## Development Workflow

- Run `bun run build` then `./bin/cli` to test the real built CLI
- TDD approach: Write tests before implementing new features
- Prefer editing existing files over creating new ones
- Do not proactively create documentation files