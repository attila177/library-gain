import fs from 'fs';
import path from 'path';

export async function scanFolder(folderPath: string) {
  const files = fs.readdirSync(folderPath)
    .filter(f => f.toLowerCase().endsWith('.mp3'))
    .map(f => {
      const fullPath = path.join(folderPath, f);
      const stats = fs.statSync(fullPath);
      return {
        name: f,
        path: fullPath,
        size: stats.size,
        mtime: stats.mtime.toISOString()
      };
    });
  return files;
}
