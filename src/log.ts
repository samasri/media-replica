import { existsSync, mkdirSync, writeFileSync } from "fs";
import { DateTime } from "luxon";

let logFilePath: string;

export const logFile = () => {
  if (!logFilePath) {
    const now = DateTime.now().toFormat("dd.MM.yyyy-HH-mm-ss-SSS");
    const filename = `${now}.log`;
    const logDir = `${__dirname}/../logs`;
    logFilePath = `${logDir}/${filename}`;
    if (!existsSync(logDir)) mkdirSync(logDir);
    writeFileSync(logFilePath, "");
  }
  return logFilePath;
};
