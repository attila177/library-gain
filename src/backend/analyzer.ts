import mm from 'music-metadata';
import ffmpeg from 'fluent-ffmpeg';

export async function analyzeFile(filePath: string) {
  try {
    const metadata = await mm.parseFile(filePath);

    let replayGain: string = '';
    const rg = (metadata.common as any).replaygain_track_gain;
    if (rg) {
      if (typeof rg === 'object') {
        replayGain = rg.dB ? `${rg.dB} dB` : JSON.stringify(rg);
      } else {
        replayGain = String(rg);
      }
    }

    return new Promise((resolve) => {
      let avgDb = '';
      let maxDb = '';

      ffmpeg(filePath)
        .audioFilters('volumedetect')
        .format('null')
        .on('stderr', (line) => {
          if (line.includes('mean_volume')) {
            avgDb = line.split(':')[1].trim();
          }
          if (line.includes('max_volume')) {
            maxDb = line.split(':')[1].trim();
          }
        })
        .on('end', () => {
          resolve({ replayGain, avgDb, maxDb });
        })
        .saveToFile('/dev/null');
    });
  } catch (err) {
    return { replayGain: '', avgDb: '', maxDb: '' };
  }
}
