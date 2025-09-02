import fs from 'fs';
import path from 'path';

export interface FileBasicAnalysisResult {
  /** includes parent folders relative to library root */
  name: string;
  fullFilePath: string;
  size: number;
  /** string with date in ISO format */
  ctime: string;
  /** string with date in ISO format */
  mtime: string;
  fullParentFolderPath: string;
  relativeParentFolderPath: string;
}

export async function scanFolder(folderPath: string): Promise<FileBasicAnalysisResult[]> {
  console.log(`Starting folder scan of ${folderPath}...`);
  const files: FileBasicAnalysisResult[] = fs
    .readdirSync(folderPath, {recursive: true})
    .filter((f) => typeof f === 'string')
    .filter((f) => f.toLowerCase().endsWith('.mp3'))
    .map((f) => {
      const fullPath = path.join(folderPath, f);
      const parentPath = path.dirname(fullPath);
      const relativeParentFolderPath = path.relative(folderPath, parentPath);
      const stats = fs.statSync(fullPath);
      const result: FileBasicAnalysisResult = {
        name: f,
        fullFilePath: fullPath,
        size: stats.size,
        ctime: stats.ctime.toISOString(),
        mtime: stats.mtime.toISOString(),
        fullParentFolderPath: parentPath,
        relativeParentFolderPath,
      };
      return result;
    });
  console.log(`Finished folder scan of ${folderPath}.\n`);
  return files;
}
