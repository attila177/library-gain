import mm from 'music-metadata';
import ffmpeg from 'fluent-ffmpeg';

export interface FileFfmpegAnalysisResult {
  avgDb: number;
  maxDb: number;
  replayGain: string;
}

export async function analyzeFile(filePath: string): Promise<FileFfmpegAnalysisResult> {
  let avgDb: number = 0;
  let maxDb: number = 0;
  let replayGain: string = '';
  try {
    const metadata = await mm.parseFile(filePath);

    const rg = (metadata.common as any).replaygain_track_gain;
    if (rg) {
      if (typeof rg === 'object') {
        replayGain = rg.dB ? `${rg.dB} dB` : JSON.stringify(rg);
      } else {
        replayGain = String(rg);
      }
    }

    return new Promise((resolve) => {
      ffmpeg(filePath)
        .audioFilters('volumedetect')
        .format('null')
        .on('stderr', (line) => {
          if (line.includes('mean_volume')) {
            avgDb = parseFloat(line.split(':')[1].trim());
          }
          if (line.includes('max_volume')) {
            maxDb = parseFloat(line.split(':')[1].trim());
          }
        })
        .on('end', () => {
          resolve({ replayGain, avgDb, maxDb });
        })
        .saveToFile('/dev/null');
    });
  } catch (err) {
    return { replayGain, avgDb, maxDb };
  }
}
