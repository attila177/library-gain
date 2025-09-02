import mm from 'music-metadata';
import ffmpeg from 'fluent-ffmpeg';

export interface FileFfmpegAnalysisResult {
  avgDb: number;
  maxDb: number;
  replayGain: string;
  ffmpegAnalysisError: boolean;
  durationSeconds: number;
  comment: string;
}

export async function analyzeFile(filePath: string): Promise<FileFfmpegAnalysisResult> {
  let avgDb: number = 0;
  let maxDb: number = 0;
  let durationSeconds: number = 0;
  let replayGain: string = '';
  let comment: string = '';
  try {
    console.log(`Starting ffmpeg analysis of ${filePath}...`);
    const metadata = await mm.parseFile(filePath);

    const rg = (metadata.common as any).replaygain_track_gain;
    if (rg) {
      if (typeof rg === 'object') {
        replayGain = rg.dB ? `${rg.dB} dB` : JSON.stringify(rg);
      } else {
        replayGain = String(rg);
      }
    }

    // Duration (in seconds, float)
    if (metadata.format.duration) {
      durationSeconds = metadata.format.duration;
    }

    // Common comment (usually an array of strings)
    if (metadata.common.comment && metadata.common.comment.length > 0) {
      comment = metadata.common.comment.join("; ");
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
          console.log(`Finished ffmpeg analysis of ${filePath}.\n`);
          resolve({ comment, durationSeconds, replayGain, avgDb, maxDb, ffmpegAnalysisError: false });
        })
        .on('error', (err) => {
          console.error(`ffmpeg analysis failed on ${filePath}`, err);
          resolve({ comment, durationSeconds, replayGain, avgDb, maxDb, ffmpegAnalysisError: true }); // graceful fallback
        })
        .saveToFile('/dev/null');
    });
  } catch (err) {
    const result =  { comment, durationSeconds, replayGain, avgDb, maxDb, ffmpegAnalysisError: true };
    console.error(`Error analyzing file ${filePath} with ffmpeg: (${JSON.stringify(result)})`, err);
    return result;
  }
}
