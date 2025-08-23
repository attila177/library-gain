import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'path';
import { scanFolder } from '../backend/fileScanner';
import { analyzeFile } from '../backend/analyzer';
import { normalizeFiles } from '../backend/normalizer';

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
  if (result.canceled || result.filePaths.length === 0) return [];
  const folderPath = result.filePaths[0];
  const files = await scanFolder(folderPath);
  return files;
});

ipcMain.handle('analyze-file', async (_event, filePath: string) => {
  return await analyzeFile(filePath);
});

ipcMain.handle('normalize-files', async (_event, files: string[], targetDb: number) => {
  return await normalizeFiles(files, targetDb);
});
