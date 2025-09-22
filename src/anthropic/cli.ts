#!/usr/bin/env bun

/**
 * CLI for Anthropic provider authentication
 * Wire up auth commands for easy management
 */

import {
  loginCommand,
  logoutCommand,
  listCommand,
  statusCommand
} from './index.js';

const command = process.argv[2];
const subcommand = process.argv[3];

async function main() {
  if (command === 'auth') {
    switch (subcommand) {
      case 'login':
        await loginCommand();
        break;
      case 'logout':
        await logoutCommand();
        break;
      case 'list':
        await listCommand();
        break;
      case 'status':
        await statusCommand();
        break;
      default:
        console.log('Usage: bun run src/anthropic/cli.ts auth <login|logout|list|status>');
        process.exit(1);
    }
  } else {
    console.log('Available commands:');
    console.log('  auth login   - Set up Anthropic authentication');
    console.log('  auth logout  - Remove stored credentials');
    console.log('  auth list    - List stored credentials');
    console.log('  auth status  - Check authentication status');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});