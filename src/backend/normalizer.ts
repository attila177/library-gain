import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';

export interface FileNormalizationInputData {
  path: string;
  maxDb: number;
}

export enum NormalizeFilesMode {
  Independent = 'Independent',
  Album = 'Album'
}

export async function normalizeFiles(files: FileNormalizationInputData[], mode: NormalizeFilesMode, targetDb: number) {
  let albumDbChangeToApply = 0;
  if (mode === NormalizeFilesMode.Album) {
    // Calculate the overall change in dB for the album
    const albumMaxDb = Math.max(...files.map(file => file.maxDb));
    albumDbChangeToApply = targetDb - albumMaxDb;
  }

  for (const file of files) {
    await new Promise((resolve, reject) => {
      const dir = path.dirname(file.path);
      const base = path.basename(file.path, path.extname(file.path));
      const tempFile = path.join(dir, base + '_normalized.mp3');
      let fileDbChangeToApply = 0;
      if (mode === NormalizeFilesMode.Album) {
        fileDbChangeToApply = albumDbChangeToApply;
      } else if (mode === NormalizeFilesMode.Independent) {
        fileDbChangeToApply = targetDb - file.maxDb;
      } else {
        throw new Error('Unknown normalization mode');
      }
      if (fileDbChangeToApply === 0) {
        // No change needed
        resolve(true);
        return;
      }
      console.log(
        `Normalizing ${base} from ${file.maxDb}dB to ${targetDb}dB by applying volume filter with ${fileDbChangeToApply}dB) (${mode} mode)`,
      );

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
          resolve(true);
        })
        .on('error', reject)
        .save(tempFile);
    });
  }
  return true;
}
