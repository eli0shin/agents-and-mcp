import { z } from 'zod';
import { $ } from 'bun';

export const bashTool = {
  description: 'Execute bash commands for git operations',
  inputSchema: z.object({
    command: z.string().describe('The bash command to execute'),
  }),
  execute: async ({ command }: { command: string }) => {
    const commandPreview = command.split(' ').slice(0, 2).join(' ');
    console.log(`⎿Bash(${commandPreview})`);
    try {
      const result = await $`sh -c ${command}`.text();
      return result;
    } catch (error) {
      if (error instanceof Error) {
        return error.message;
      }
      return `Error: ${String(error)}`;
    }
  },
};

export const readFileTool = {
  description: 'Read file contents given a relative path',
  inputSchema: z.object({
    path: z.string().describe('Relative path to the file to read'),
  }),
  execute: async ({ path }: { path: string }) => {
    console.log(`⎿Read(${path})`);
    try {
      const file = Bun.file(path);
      const content = await file.text();
      return content;
    } catch (error) {
      if (error instanceof Error) {
        return error.message;
      }
      return `Error reading file: ${String(error)}`;
    }
  },
};

