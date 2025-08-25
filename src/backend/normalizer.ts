import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';

export interface FileNormalizationInputData {
  path: string;
  maxDb: number;
}

export async function normalizeFiles(files: FileNormalizationInputData[], targetDb: number) {
  for (const file of files) {
    await new Promise((resolve, reject) => {
      const dir = path.dirname(file.path);
      const base = path.basename(file.path, path.extname(file.path));
      const tempFile = path.join(dir, base + '_normalized.mp3');
      const delta = targetDb - file.maxDb;
      console.log(
        `Normalizing ${base} from ${file.maxDb}dB to ${targetDb}dB by applying volume filter with ${delta}dB)`,
      );

      ffmpeg(file.path)
        .audioFilters(`volume=${delta}dB`)
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
          resolve(true);
        })
        .on('error', reject)
        .save(tempFile);
    });
  }
  return true;
}
