import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';

export interface FileNormalizationInputData {
  path: string;
  maxDb: number;
}

export async function normalizeFile(
  file: FileNormalizationInputData,
  fileDbChangeToApply: number,
) {
  return new Promise((resolve, reject) => {
    console.log(`Starting ffmpeg normalization of ${file.path} with ${fileDbChangeToApply}dB...`);
    const dir = path.dirname(file.path);
    const base = path.basename(file.path, path.extname(file.path));
    const tempFile = path.join(dir, base + '_normalized.mp3');
    if (fileDbChangeToApply === 0) {
      // No change needed
      console.warn(`No change needed for ${file.path}.`);
      resolve(true);
      return;
    }

    ffmpeg(file.path)
      .audioFilters(`volume=${fileDbChangeToApply}dB`)
      .audioCodec('libmp3lame') // use LAME encoder
      .audioBitrate('256k') // fallback CBR
      .outputOptions([
        // extreme VBR quality (~220–260 kbps)
        '-qscale:a',
        '0',
        // remove replaygain track metadata
        '-metadata',
        'replaygain_track_gain=',
        // remove replaygain album metadata
        '-metadata',
        'replaygain_album_gain=',
        // remove replaygain track peak metadata
        '-metadata',
        'replaygain_track_peak=',
        // remove replaygain album peak metadata
        '-metadata',
        'replaygain_album_peak=',
      ])
      .on('end', () => {
        // Replace original with normalized
        fs.renameSync(tempFile, file.path);
        console.log(`Finished ffmpeg normalization of ${file.path} with ${fileDbChangeToApply}dB.\n`);
        resolve(true);
      })
      .on('error', (err) => {
        console.error(`ffmpeg normalization failed on ${file.path}`, err);
        err.message = `ffmpeg normalization failed on ${file.path}: ${err.message}`;
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
        reject(err);
      })
      .save(tempFile);
  });
}
