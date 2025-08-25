import fs from 'fs';
import path from 'path';

export interface FileBasicAnalysisResult {
  name: string;
  path: string;
  size: number;
  /** string with date in ISO format */
  mtime: string;
  folderPath: string;
}

export async function scanFolder(folderPath: string): Promise<FileBasicAnalysisResult[]> {
  const files: FileBasicAnalysisResult[] = fs
    .readdirSync(folderPath)
    .filter((f) => f.toLowerCase().endsWith('.mp3'))
    .map((f) => {
      const fullPath = path.join(folderPath, f);
      const stats = fs.statSync(fullPath);
      return {
        name: f,
        path: fullPath,
        size: stats.size,
        mtime: stats.mtime.toISOString(),
        folderPath: folderPath,
      } as FileBasicAnalysisResult;
    });
  return files;
}
