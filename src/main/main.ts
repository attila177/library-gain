import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'path';
import { FileBasicAnalysisResult, scanFolder } from '../backend/fileScanner';
import { analyzeFile } from '../backend/analyzer';
import { FileNormalizationInputData, normalizeFile } from '../backend/normalizer';

let win: BrowserWindow | null = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.loadFile(path.join(__dirname, '../public/index.html'));
}

app.whenReady().then(createWindow);

ipcMain.handle('pick-folder', async () => {
  if (!win) return;
  const result = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
  if (result.canceled) return {folderPath: null, files: []};
  const folderPath = result.filePaths[0];
  let files: FileBasicAnalysisResult[] = [];
  if (result.filePaths.length > 0) {
    files = await scanFolder(folderPath);
  }
  return {folderPath, files};
});

ipcMain.handle('analyze-file', async (_event, filePath: string) => {
  return await analyzeFile(filePath);
});

ipcMain.handle('normalize-file', async (_event, file: FileNormalizationInputData, fileDbChangeToApply: number) => {
  return await normalizeFile(file, fileDbChangeToApply);
});
