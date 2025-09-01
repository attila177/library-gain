import React, { useState } from 'react';
import { FileBasicAnalysisResult } from '../backend/fileScanner';
import { FileFfmpegAnalysisResult } from '../backend/analyzer';
import path from 'path';

const sleepTime = 100; // ms

const { ipcRenderer } = window.require('electron');

interface FileData extends FileBasicAnalysisResult, FileFfmpegAnalysisResult {
  selected?: boolean;
  ffmpegNormalizationError?: boolean;
}

enum NormalizeFilesMode {
  Independent = 'Independent',
  Album = 'Album',
}

export default function App() {
  const [files, setFiles] = useState<FileData[]>([]);
  const [targetDb, setTargetDb] = useState<number>(-7.0);
  const [lastFolder, setLastFolder] = useState<string | null>(null);
  const [selectionThreshold, setSelectionThreshold] = useState<number>(1);
  const [selectedMode, setSelectedMode] = useState<string>(
    NormalizeFilesMode.Independent.toString(),
  );
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isNormalizing, setIsNormalizing] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const logAndSetStatusText = (s: string) => {
    console.log(s);
    setStatusText(s);
  };
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const analyzeFiles = async (fileList: any[]) => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    let done = 0;
    logAndSetStatusText(`Starting analysis of ${fileList.length} files...`);
    const promises = fileList.map(async (file: any, idx: number) => {
      const analysis = await ipcRenderer.invoke('analyze-file', file.path);
      setFiles((prev) => {
        const updated = [...prev];
        updated[idx] = { ...file, ...analysis, selected: false };
        done++;
        logAndSetStatusText(`Analyzing... finished ${done} of ${fileList.length} files.`);
        return updated;
      });
    });
    await Promise.all(promises);
    await sleep(sleepTime);
    setIsAnalyzing(false);
    logAndSetStatusText(`Done analyzing ${fileList.length} files.`);
  };

  const pickFolder = async () => {
    const fileList = await ipcRenderer.invoke('pick-folder');
    if (!fileList || fileList.length === 0) return;
    setFiles(fileList);
    setLastFolder(fileList[0]?.folderPath || null); // keep track
    await analyzeFiles(fileList);
  };

  const normalize = async () => {
    const selected = files.filter((f) => f.selected);
    logAndSetStatusText(`Starting normalization...`);
    setIsNormalizing(true);
    let albumDbChangeToApply = 0;
    let amountDone = 0;
    let amountSuccess = 0;
    let amountFailed = 0;
    if (selectedMode === NormalizeFilesMode.Album) {
      // Calculate the overall change in dB for the album
      const albumMaxDb = Math.max(...files.map((file) => file.maxDb));
      albumDbChangeToApply = targetDb - albumMaxDb;
    }
    for (const file of selected) {
      const base = path.basename(file.path, path.extname(file.path));
      logAndSetStatusText(
        `Normalization ongoing: ${amountDone} of ${selected.length} done. ${amountSuccess} succeeded, ${amountFailed} failed. Current: ${base}`,
      );
      let fileDbChangeToApply = 0;
      if (selectedMode === NormalizeFilesMode.Album) {
        fileDbChangeToApply = albumDbChangeToApply;
      } else if (selectedMode === NormalizeFilesMode.Independent) {
        fileDbChangeToApply = targetDb - file.maxDb;
      } else {
        throw new Error('Unknown normalization mode: ' + selectedMode);
      }
      fileDbChangeToApply = Math.round(fileDbChangeToApply * 100) / 100; // round to 2 decimal places

      console.log(
        `Normalizing ${base} from ${file.maxDb}dB to ${targetDb}dB by applying volume filter with ${fileDbChangeToApply}dB (${selectedMode} mode)`,
      );
      try {
        await ipcRenderer.invoke('normalize-file', file, fileDbChangeToApply);
        file.ffmpegNormalizationError = false;
        amountSuccess++;
      } catch (err) {
        console.error(`Error normalizing file ${file.path}:`, err);
        file.ffmpegNormalizationError = true;
        amountFailed++;
      }
      amountDone++;
    }
    await sleep(sleepTime);
    setIsNormalizing(false);
    console.log('Normalization completed. Starting to unselect and reanalyze files...');
    await analyzeFiles(selected);
    logAndSetStatusText(`Normalization completed, files reanalyzed. ${amountSuccess} succeeded, ${amountFailed} failed.`);
  };

  const numberIsSet = (a: number | undefined | null) => {
    if (a === undefined || a === null) return false;
    return true;
  };

  const printNumber = (a: number | undefined | null) => {
    if (!numberIsSet(a)) return '(unknown)';
    return (a || 0).toFixed(2);
  };

  const fileIsIndependentlyRelevant = (file: FileData) => {
    return (
      numberIsSet(file.maxDb) &&
      numberIsSet(targetDb) &&
      Math.abs(file.maxDb - targetDb) > selectionThreshold
    );
  };

  const selectRelevant = async () => {
    let selectedBecauseOfAlbum = false;
    if (selectedMode === NormalizeFilesMode.Album.toString()) {
      selectedBecauseOfAlbum = files.some(fileIsIndependentlyRelevant);
    }
    files.forEach((file, idx) => {
      setFiles((prev) => {
        const updated = [...prev];
        let shouldSelect = false;
        if (selectedMode === NormalizeFilesMode.Album.toString()) {
          shouldSelect = selectedBecauseOfAlbum;
        } else if (selectedMode === NormalizeFilesMode.Independent.toString()) {
          shouldSelect = fileIsIndependentlyRelevant(file);
        } else {
          throw new Error('Unknown normalization mode: ' + selectedMode);
        }
        updated[idx] = {
          ...file,
          selected: shouldSelect,
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
      <button
        disabled={isAnalyzing || !lastFolder}
        onClick={() => lastFolder && analyzeFiles(files)}
      >
        Re-analyze Folder
      </button>
      <br />
      <label htmlFor="dbInput">Target Decibel: </label>
      <input
        id="dbInput"
        type="number"
        value={targetDb}
        onChange={(e) => setTargetDb(parseFloat(e.target.value))}
      />{' '}
      dB
      <br />
      <label htmlFor="mode">Mode: </label>
      <select id="mode" value={selectedMode} onChange={(e) => setSelectedMode(e.target.value)}>
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
      <button disabled={isAnalyzing || !files.length} onClick={selectRelevant}>
        Select relevant files
      </button>
      &nbsp;
      <button disabled={isAnalyzing || !files.some((f) => f.selected)} onClick={normalize}>
        Normalize Selected
      </button>
      <br />
      {isAnalyzing || isNormalizing ? '⏳⏳⏳' : ''}
      <span style={isAnalyzing || isNormalizing ? {color: 'blue'} : {}}>{statusText}</span>
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
                {file.ffmpegAnalysisError ? '⚠️' : ''}
                {file.ffmpegNormalizationError ? '❌' : ''}
              </td>
              <td>{file.name}</td>
              <td>{humanFileSize(file.size)}</td>
              <td>{file.mtime ? file.mtime.replace('T', ' ') : '(unknown)'}</td>
              <td>{file.replayGain || '(unknown)'}</td>
              <td>{printNumber(file.avgDb)} dB</td>
              <td>{printNumber(file.maxDb)} dB</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
