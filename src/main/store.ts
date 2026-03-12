import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import type { StoreData } from '../shared/types';

const STORE_FILE = 'arccode-data.json';

function getStorePath(): string {
  return path.join(app.getPath('userData'), STORE_FILE);
}

const DEFAULT_DATA: StoreData = {
  projects: [],
  activeSessionId: null,
};

export function loadStore(): StoreData {
  try {
    const raw = fs.readFileSync(getStorePath(), 'utf-8');
    return JSON.parse(raw) as StoreData;
  } catch {
    return { ...DEFAULT_DATA, projects: [] };
  }
}

export function saveStore(data: StoreData): void {
  fs.writeFileSync(getStorePath(), JSON.stringify(data, null, 2), 'utf-8');
}
