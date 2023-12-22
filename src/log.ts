import { existsSync, mkdirSync, writeFileSync } from "fs";

const now = new Date();
const filename = `${now.toDateString().replaceAll(" ", "-")}-${now.getTime()}`;
const logDir = `${__dirname}/../logs`;
export const logFile = `${logDir}/${filename}`;
if (!existsSync(logDir)) mkdirSync(logDir);
writeFileSync(logFile, "");
