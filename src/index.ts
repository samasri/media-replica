import * as assert from "assert";
import { copyFileSync } from "fs";

import { config } from "./config";
import { syncMediaDir } from "./rsync";
import { now } from "./utils";

const importFilesToPhotoPrism = (
  photoPrismPath: string,
  sourcePath: string,
  files: string[]
) => {
  files.forEach((file) => {
    console.log("Copying", file);
    const filename = file.split("/").at(-1);
    assert(filename?.length ?? 0 > 0, `Could not get filename from ${file}`);
    copyFileSync(`${sourcePath}/${file}`, `${photoPrismPath}/${filename}`);
  });
};

const isIgnoredFileType = (fileName: string): boolean => {
  return (
    fileName.includes("Restored/") ||
    fileName.includes("Downloaded from iCloud/")
  );
};

const backupAndImportMedia = async (
  sourceDir: string,
  backupDir: string,
  photoPrismImportPath: string,
  ignoredFileNameList: string
) => {
  const syncedFileNames = await syncMediaDir(sourceDir, backupDir);
  const filesToImport = syncedFileNames.filter(
    (fileName) =>
      !(ignoredFileNameList.includes(fileName) || isIgnoredFileType(fileName))
  );
  importFilesToPhotoPrism(photoPrismImportPath, backupDir, filesToImport);
};

const main = async () => {
  const {
    phoneCamera,
    hddBackup,
    photoPrismImportPath,
    whatsappImages,
    whatsappVideo,
    ignoredFiles,
  } = config();

  console.log("Excluded files:", ignoredFiles);

  console.log(`${now()}: Backing up camera...`);
  await backupAndImportMedia(
    phoneCamera,
    hddBackup,
    photoPrismImportPath,
    ignoredFiles
  );

  console.log(`${now()}: Backing up whatsapp images...`);
  await backupAndImportMedia(
    whatsappImages,
    `${hddBackup}/WhatsappImages`,
    photoPrismImportPath,
    ignoredFiles
  );

  console.log(`${now()}: Backing up whatsapp video...`);
  await backupAndImportMedia(
    whatsappVideo,
    `${hddBackup}/WhatsappVideos`,
    photoPrismImportPath,
    ignoredFiles
  );
};

main();
