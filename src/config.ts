import assert = require("assert");
import { config as dotenvConfig } from "dotenv";
dotenvConfig();

export const config = () => {
  const hddBackup = process.env.HDD_BACKUP;
  const photoPrismImportPath = process.env.PHOTOPRISM_IMPORT_PATH;
  const ignoredFiles = process.env.IGNORE_FILES;

  const phoneCamera = process.env.PHONE_CAMERA;
  const whatsappImages = process.env.WHATSAPP_IMAGES_PATH;
  const whatsappVideo = process.env.WHATSAPP_VIDEOS_PATH;

  const message = (envVar: string) =>
    `${envVar} must be set in the .env or as an environment variable`;
  assert(hddBackup, message("HDD_BACKUP"));
  assert(photoPrismImportPath, message("PHOTOPRISM_IMPORT_PATH"));
  assert(ignoredFiles, message("IGNORE_FILES"));
  assert(phoneCamera, message("PHONE_CAMERA"));
  assert(whatsappImages, message("WHATSAPP_IMAGES_PATH"));
  assert(whatsappVideo, message("WHATSAPP_VIDEOS_PATH"));

  return {
    phoneCamera,
    hddBackup,
    ignoredFiles: (JSON.parse(ignoredFiles) as string[]).map((item: string) =>
      item.trim()
    ),
    photoPrismImportPath,
    whatsappImages,
    whatsappVideo,
  };
};
