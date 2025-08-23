import mm from 'music-metadata';
import ffmpeg from 'fluent-ffmpeg';

export async function analyzeFile(filePath: string) {
  try {
    const metadata = await mm.parseFile(filePath);
    const replayGain = metadata.common.replaygain_track_gain || "";
    return new Promise((resolve) => {
      ffmpeg(filePath)
        .audioFilters('volumedetect')
        .format('null')
        .on('stderr', (line) => {
          let avgDb = "";
          let maxDb = "";
          if (line.includes('mean_volume')) {
            avgDb = line.split(':')[1].trim();
          }
          if (line.includes('max_volume')) {
            maxDb = line.split(':')[1].trim();
          }
          if (avgDb || maxDb) {
            resolve({ replayGain, avgDb, maxDb });
          }
        })
        .on('end', () => {
          resolve({ replayGain, avgDb: "", maxDb: "" });
        })
        .saveToFile('/dev/null');
    });
  } catch (err) {
    return { replayGain: "", avgDb: "", maxDb: "" };
  }
}
