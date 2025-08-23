import ffmpeg from 'fluent-ffmpeg';

export async function normalizeFiles(files: string[], targetDb: number) {
  for (const file of files) {
    await new Promise((resolve, reject) => {
      ffmpeg(file)
        .audioFilters(`volume=${targetDb}dB`)
        .on('end', resolve)
        .on('error', reject)
        .save(file);
    });
  }
  return true;
}
