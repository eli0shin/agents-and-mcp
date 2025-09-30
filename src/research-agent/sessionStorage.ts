import { randomBytes } from 'crypto';
import { mkdir } from 'node:fs/promises';
import { join } from 'path';

import type { ResearchState } from './types.js';

const SESSION_STORAGE_ROOT = join(process.cwd(), 'research-sessions');

function sanitizeSegment(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9-_]/g, '_');
}

function randomId(bytes = 4): string {
  return randomBytes(bytes).toString('hex');
}

export function getSessionDirectory(sessionId: string): string {
  return join(SESSION_STORAGE_ROOT, sanitizeSegment(sessionId));
}

async function ensureSessionDirectory(sessionId: string): Promise<string> {
  const directory = getSessionDirectory(sessionId);
  await mkdir(directory, { recursive: true });
  return directory;
}

export async function persistState(state: ResearchState): Promise<void> {
  try {
    const directory = await ensureSessionDirectory(state.sessionId);
    const path = join(directory, 'state.json');
    const serializedState = JSON.stringify(state, null, 2);
    await Bun.write(path, serializedState);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('Failed to persist research state:', message);
  }
}

export async function persistPrompt(
  sessionId: string,
  functionName: string,
  content: string
): Promise<string> {
  try {
    const directory = await ensureSessionDirectory(sessionId);
    const id = randomId();
    const sanitizedFunction = sanitizeSegment(functionName || 'prompt');
    const fileName = `${sanitizedFunction}-${id}-prompt.txt`;
    const path = join(directory, fileName);
    await Bun.write(path, content);
    return id;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('Failed to persist research prompt:', message);
    return randomId();
  }
}

export async function persistResponse(
  sessionId: string,
  functionName: string,
  id: string,
  content: string
): Promise<void> {
  try {
    const directory = await ensureSessionDirectory(sessionId);
    const sanitizedFunction = sanitizeSegment(functionName || 'response');
    const sanitizedId = sanitizeSegment(id || randomId());
    const fileName = `${sanitizedFunction}-${sanitizedId}-response.txt`;
    const path = join(directory, fileName);
    await Bun.write(path, content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('Failed to persist model response:', message);
  }
}
