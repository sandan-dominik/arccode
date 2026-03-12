import fs from 'node:fs';
import path from 'node:path';

const CANDIDATE_PATHS = [
  path.join(process.env['PROGRAMFILES'] || 'C:\\Program Files', 'Git', 'bin', 'bash.exe'),
  path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Git', 'bin', 'bash.exe'),
  path.join(process.env['LOCALAPPDATA'] || '', 'Programs', 'Git', 'bin', 'bash.exe'),
];

let cachedPath: string | null = null;

export function findGitBash(): string {
  if (cachedPath) return cachedPath;

  for (const p of CANDIDATE_PATHS) {
    if (fs.existsSync(p)) {
      cachedPath = p;
      return p;
    }
  }

  throw new Error(
    'Git Bash not found. Searched:\n' + CANDIDATE_PATHS.join('\n')
  );
}
