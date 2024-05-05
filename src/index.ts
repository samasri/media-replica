import * as assert from "assert";
import { copyFileSync } from "fs";

import { config } from "./config";
import { syncMediaDir } from "./rsync";
import { askUser, now } from "./utils";
import showImages from "./show-images";
import { basename } from "path";

const importFilesToPhotoPrism = (
  photoPrismPath: string,
  sourcePath: string,
  files: string[]
) => {
  files.forEach((file) => {
    console.log("Copying", file);
    copyFileSync(
      `${sourcePath}/${file}`,
      `${photoPrismPath}/${basename(file)}`
    );
  });
};

const isIgnored = (fileName: string, ignoreList: string[]): boolean => {
  const partialMatches = [
    "Restored/",
    "Downloaded from iCloud/",
    "Camera/.trashed-",
  ];
  return (
    partialMatches.some((match) => fileName.includes(match)) ||
    ignoreList.includes(fileName) // exact matches
  );
};

const backupAndImportMedia = async (
  sourceDir: string,
  backupDir: string,
  photoPrismImportPath: string,
  ignoredFileNameList: string[],
  requestUserApproval = true
) => {
  const potentialSyncedFiles = await syncMediaDir(sourceDir, backupDir, true);
  if (potentialSyncedFiles.length === 0) {
    console.log("Media folders is already in sync");
    return;
  }

  console.log(
    `The following files will be synced:\n- ${potentialSyncedFiles.join(
      "\n- "
    )}`
  );
  const answer = await askUser("Do you want to proceed? (Y/n)");
  if (answer !== "Y") {
    console.log("Aborting");
    return;
  }

  const syncedFiles = await syncMediaDir(sourceDir, backupDir);
  const filesToImport = syncedFiles.filter(
    (fileName) => !isIgnored(fileName, ignoredFileNameList)
  );

  let userApprovedList = filesToImport;
  if (requestUserApproval) {
    userApprovedList = await showImages(backupDir, filesToImport);
    console.log({ userApprovedList });
  }
  importFilesToPhotoPrism(photoPrismImportPath, backupDir, userApprovedList);
};

const main = async () => {
  try {
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
      ignoredFiles,
      false
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
  } catch (error) {
    if (error instanceof assert.AssertionError) {
      console.log("\x1b[31m", "Assertion error:", error.message, "\x1b[0m");
    } else throw error;
  }
};

main();
