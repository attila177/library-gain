import ffmpeg from 'fluent-ffmpeg';
import fs from "fs";
import path from "path";

export async function normalizeFiles(files: string[], targetDb: number) {
  for (const file of files) {
    await new Promise((resolve, reject) => {
      const dir = path.dirname(file);
      const base = path.basename(file, path.extname(file));
      const tempFile = path.join(dir, base + "_normalized.mp3");

      ffmpeg(file)
        .audioFilters(`volume=${targetDb}dB`)
        .on("end", () => {
          // Replace original with normalized
          fs.renameSync(tempFile, file);
          resolve(true);
        })
        .on("error", reject)
        .save(tempFile);
    });
  }
  return true;
}
