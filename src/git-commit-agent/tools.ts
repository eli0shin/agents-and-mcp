import { z } from 'zod';
import { $ } from 'bun';
import { tool } from 'ai';

export const bashTool = tool({
  name: 'Bash',
  description: 'Use the Bash tool to run shell commands for git operations',
  inputSchema: z.object({
    command: z.string().describe('The bash command to execute'),
  }),
  execute: async ({ command }) => {
    const commandPreview = command.split('\n')[0];
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
});

export const readFileTool = tool({
  name: 'Read File',
  description: 'Use this tool to read files',
  inputSchema: z.object({
    path: z.string().describe('Relative path to the file to read'),
  }),
  execute: async ({ path }) => {
    console.log(`⎿Read(${path})`);
    try {
      const file = Bun.file(path);
      const content = await file.text();
      const lines = content.split('\n');
      const numberedContent = lines
        .map((line, index) => `${index + 1} | ${line}`)
        .join('\n');
      return numberedContent;
    } catch (error) {
      if (error instanceof Error) {
        return error.message;
      }
      return `Error reading file: ${String(error)}`;
    }
  },
});
