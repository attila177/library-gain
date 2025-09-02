import React, { useState } from 'react';
import { FileBasicAnalysisResult } from '../backend/fileScanner';
import { FileFfmpegAnalysisResult } from '../backend/analyzer';
import path from 'path';

const sleepTimePerFile = 10; // ms

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
  const [shouldShowRelativeParentPath, setShouldShowRelativeParentPath] = useState<boolean>(false);
  const [sortField, setSortField] = useState<string | null>('fullFilePath');
  const [sortAsc, setSortAsc] = useState<boolean | null>(true);
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
      const analysis = await ipcRenderer.invoke('analyze-file', file.fullFilePath);
      setFiles((prev) => {
        const updated = [...prev];
        updated[idx] = { ...file, ...analysis, selected: false };
        done++;
        logAndSetStatusText(`Analyzing... finished ${done} of ${fileList.length} files.`);
        return updated;
      });
    });
    await Promise.all(promises);
    await sleep(sleepTimePerFile * fileList.length); // wait a bit to let UI catch up
    setIsAnalyzing(false);
    logAndSetStatusText(`Done analyzing ${fileList.length} files.`);
  };

  const pickFolder = async () => {
    const { folderPath, files } = await ipcRenderer.invoke('pick-folder');
    if (!folderPath || !files || files.length === 0) return;
    setFiles([]);
    setFiles(files);
    setLastFolder(folderPath);
    await analyzeFiles(files);
  };

  const normalize = async () => {
    const selected = files.filter((f) => f.selected);
    logAndSetStatusText(`Starting normalization... ${selected[0]?.fullParentFolderPath || ''}`);
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
      const base = path.basename(file.fullFilePath, path.extname(file.fullFilePath));
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
        console.error(`Error normalizing file ${file.fullFilePath}:`, err);
        file.ffmpegNormalizationError = true;
        amountFailed++;
      }
      amountDone++;
    }
    await sleep(sleepTimePerFile * selected.length); // wait a bit to let UI catch up
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

  const getTrackDurationString = (durationSeconds: number) => {
    if (!durationSeconds) return '(unknown)';
    const minutes = Math.floor(durationSeconds / 60);
    const seconds = durationSeconds % 60;
    return `${minutes}:${Math.round(seconds).toString().padStart(2, '0')}`;
  };

  const getTotalDurationString = () => {
    if (isAnalyzing || !files[0]?.durationSeconds) {
      return '';
    }
    const rawMinutes = Math.round(files.reduce((acc, file) => acc + (file.durationSeconds || 0), 0) / 60);
    const hours = Math.floor(rawMinutes / 60);
    const modMinutes = rawMinutes % 60;
    return `(${hours ? `${hours}h ` : ''}${Math.round(modMinutes).toString().padStart(2, '0')}m)`;
  };

  const sortFilesByStringField = (field: keyof FileData) => {
    if (sortField === field) {
      setSortAsc((prev) => !prev);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
    setFiles((prev) => {
      const updated = [...prev];
      updated.sort((a, b) => {
        const aValue = typeof a[field] === 'string' ? a[field] || '' : '';
        const bValue = typeof b[field] === 'string' ? b[field] || '' : '';
        return sortAsc ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      });
      return updated;
    });
  };

  const sortFilesByNumberField = (field: keyof FileData) => {
    if (sortField === field) {
      setSortAsc((prev) => !prev);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
    setFiles((prev) => {
      const updated = [...prev];
      updated.sort((a, b) => {
        const aValue = typeof a[field] === 'number' ? a[field] || 0 : 0;
        const bValue = typeof b[field] === 'number' ? b[field] || 0 : 0;
        return sortAsc ? aValue - bValue : bValue - aValue;
      });
      return updated;
    });
  };

  const sortFilesByBooleanField = (field: keyof FileData) => {
    if (sortField === field) {
      setSortAsc((prev) => !prev);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
    setFiles((prev) => {
      const updated = [...prev];
      updated.sort((a, b) => {
        const aValue = a[field] ? 1 : 0;
        const bValue = b[field] ? 1 : 0;
        return sortAsc ? aValue - bValue : bValue - aValue;
      });
      return updated;
    });
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Library Gain</h1>
      <button onClick={pickFolder}>Pick Folder</button> {lastFolder || ''}
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
            <th onClick={() => sortFilesByBooleanField('selected')}>
              {files.reduce((acc, file) => acc + (file.selected ? 1 : 0), 0)} / {files.length}
            </th>
            <th onClick={() => sortFilesByStringField('name')}>File Name</th>
            <th>Path
                <input
                  type="checkbox"
                  checked={shouldShowRelativeParentPath}
                  onChange={() => setShouldShowRelativeParentPath(!shouldShowRelativeParentPath)}
                /></th>
            <th onClick={() => sortFilesByNumberField('size')}>File Size</th>
            <th onClick={() => sortFilesByStringField('mtime')}>Modified Date</th>
            <th onClick={() => sortFilesByNumberField('durationSeconds')}>Dur. {getTotalDurationString()}</th>
            <th onClick={() => sortFilesByStringField('replayGain')}>Replay Gain</th>
            <th onClick={() => sortFilesByNumberField('avgDb')}>Average dB</th>
            <th onClick={() => sortFilesByNumberField('maxDb')}>Max dB</th>
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
              <td>{file.relativeParentFolderPath ? file.name.substring(file.relativeParentFolderPath.length + 1) : file.name}</td>
              <td>{shouldShowRelativeParentPath ? file.relativeParentFolderPath : ''}</td>
              <td>{humanFileSize(file.size)}</td>
              <td>{file.mtime ? file.mtime.replace('T', ' ') : '(unknown)'}</td>
              <td>{getTrackDurationString(file.durationSeconds)}</td>
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
