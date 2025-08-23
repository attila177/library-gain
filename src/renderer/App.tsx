import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';

const { ipcRenderer } = window.require('electron');

export default function App() {
  const [files, setFiles] = useState<any[]>([]);
  const [targetDb, setTargetDb] = useState<string>("-14");

  const pickFolder = async () => {
    const fileList = await ipcRenderer.invoke('pick-folder');
    setFiles(fileList);
    fileList.forEach(async (file: any, idx: number) => {
      const analysis = await ipcRenderer.invoke('analyze-file', file.path);
      setFiles(prev => {
        const updated = [...prev];
        updated[idx] = { ...file, ...analysis };
        return updated;
      });
    });
  };

  const normalize = async () => {
    const selected = files.filter(f => f.selected);
    await ipcRenderer.invoke('normalize-files', selected.map(f => f.path), parseFloat(targetDb));
    alert('Normalization completed.');
  };

  const toggleSelect = (idx: number) => {
    setFiles(prev => {
      const updated = [...prev];
      updated[idx].selected = !updated[idx].selected;
      return updated;
    });
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Library Gain</h1>
      <button onClick={pickFolder}>Pick Folder</button>
      <input type="text" value={targetDb} onChange={(e) => setTargetDb(e.target.value)} />
      <button onClick={normalize}>Normalize Selected</button>
      <table border={1} cellPadding={5} style={{ marginTop: 20, width: "100%" }}>
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
              <td><input type="checkbox" checked={file.selected || false} onChange={() => toggleSelect(idx)} /></td>
              <td>{file.name}</td>
              <td>{file.size}</td>
              <td>{file.mtime}</td>
              <td>{file.replayGain || ""}</td>
              <td>{file.avgDb || ""}</td>
              <td>{file.maxDb || ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
