import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { FileBasicAnalysisResult } from '../backend/fileScanner';
import { FileFfmpegAnalysisResult } from '../backend/analyzer';

const { ipcRenderer } = window.require('electron');

interface FileData extends FileBasicAnalysisResult, FileFfmpegAnalysisResult {
  selected?: boolean;
}

export default function App() {
  const [files, setFiles] = useState<FileData[]>([]);
  const [targetDb, setTargetDb] = useState<string>('-7');
  const [lastFolder, setLastFolder] = useState<string | null>(null);

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
    await ipcRenderer.invoke('normalize-files', selected, parseFloat(targetDb));
    alert('Normalization completed.');
  };

  const toggleSelect = (idx: number) => {
    setFiles((prev) => {
      const updated = [...prev];
      updated[idx].selected = !updated[idx].selected;
      return updated;
    });
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Library Gain</h1>
      <button onClick={pickFolder}>Pick Folder</button>
      <br />
      <button onClick={() => lastFolder && analyzeFiles(files)}>Re-analyze Folder</button>
      <br />
      <label htmlFor="dbInput">Target Decibel: </label>
      <input
        id="dbInput"
        type="text"
        value={targetDb}
        onChange={(e) => setTargetDb(e.target.value)}
      />
      <br />
      <button onClick={normalize}>Normalize Selected</button>
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
              <td>{file.size}</td>
              <td>{file.mtime}</td>
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
