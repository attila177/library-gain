import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { FileBasicAnalysisResult } from '../backend/fileScanner';
import { FileFfmpegAnalysisResult } from '../backend/analyzer';
import { NormalizeFilesMode } from '../backend/normalizer';

const { ipcRenderer } = window.require('electron');

interface FileData extends FileBasicAnalysisResult, FileFfmpegAnalysisResult {
  selected?: boolean;
}

export default function App() {
  const [files, setFiles] = useState<FileData[]>([]);
  const [targetDb, setTargetDb] = useState<number>(-7.0);
  const [lastFolder, setLastFolder] = useState<string | null>(null);
  const [selectionThreshold, setSelectionThreshold] = useState<number>(1.5);
  const [selectedMode, setSelectedMode] = useState<string>(NormalizeFilesMode.Independent.toString());

  const analyzeFiles = (fileList: any[]) => {
    fileList.forEach(async (file: any, idx: number) => {
      const analysis = await ipcRenderer.invoke('analyze-file', file.path);
      setFiles((prev) => {
        const updated = [...prev];
        updated[idx] = { ...file, ...analysis };
        return updated;
      });
    });
  };

  const pickFolder = async () => {
    const fileList = await ipcRenderer.invoke('pick-folder');
    if (!fileList || fileList.length === 0) return;
    setFiles(fileList);
    setLastFolder(fileList[0]?.folderPath || null); // keep track
    analyzeFiles(fileList);
  };

  const normalize = async () => {
    const selected = files.filter((f) => f.selected);
    await ipcRenderer.invoke('normalize-files', selected, targetDb, selectedMode as unknown as NormalizeFilesMode);
    alert('Normalization completed.');
  };

  const selectRelevant = async () => {
    files.forEach((file, idx) => {
      setFiles((prev) => {
        const updated = [...prev];
        updated[idx] = {
          ...file,
          selected:
            (file.maxDb && targetDb && Math.abs(file.maxDb - targetDb) > selectionThreshold) ||
            false,
        };
        return updated;
      });
    });
  };

  const toggleSelect = (idx: number) => {
    setFiles((prev) => {
      const updated = [...prev];
      updated[idx].selected = !updated[idx].selected;
      return updated;
    });
  };

  const humanFileSize = (fileSizeBytes: number) => {
    if (!fileSizeBytes) return 'unknown';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = fileSizeBytes;
    let unitIndex = 0;
    while (size > 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Library Gain</h1>
      <button onClick={pickFolder}>Pick Folder</button>
      <br />
      <button disabled={!lastFolder} onClick={() => lastFolder && analyzeFiles(files)}>Re-analyze Folder</button>
      <br />
      <label htmlFor="dbInput">Target Decibel: </label>
      <input
        id="dbInput"
        type="number"
        value={targetDb}
        onChange={(e) => setTargetDb(parseFloat(e.target.value))}
      /> dB
      <br />
      <label htmlFor="mode">Mode: </label>
      <select
        id="mode"
        value={selectedMode}
        onChange={(e) => setSelectedMode(e.target.value)}
      >
        <option value={NormalizeFilesMode.Independent.toString()}>Independent</option>
        <option value={NormalizeFilesMode.Album.toString()}>Album</option>
      </select>
      <br />
      <label htmlFor="selectionThresholdInput">Selection Threshold: </label>
      <input
        id="selectionThresholdInput"
        type="number"
        value={selectionThreshold}
        onChange={(e) => setSelectionThreshold(parseFloat(e.target.value))}
      /> dB
      <br />
      <button disabled={!files.length} onClick={selectRelevant}>Select relevant files</button>
      &nbsp;
      <button disabled={!files.some((f) => f.selected)} onClick={normalize}>Normalize Selected</button>
      <br />
      <table border={1} cellPadding={5} style={{ marginTop: 20, width: '100%' }}>
        <thead>
          <tr>
            <th></th>
            <th>File Name</th>
            <th>File Size</th>
            <th>Modified Date</th>
            <th>Replay Gain</th>
            <th>Average dB</th>
            <th>Max dB</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file, idx) => (
            <tr key={idx}>
              <td>
                <input
                  type="checkbox"
                  checked={file.selected || false}
                  onChange={() => toggleSelect(idx)}
                />
              </td>
              <td>{file.name}</td>
              <td>{humanFileSize(file.size)}</td>
              <td>{file.mtime ? file.mtime.replace('T', ' ') : '(unknown)'}</td>
              <td>{file.replayGain || '(unknown)'}</td>
              <td>{file.avgDb || '(unknown)'} dB</td>
              <td>{file.maxDb || '(unknown)'} dB</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
