import { appendFileSync } from "fs";
import * as Rsync from "rsync";
import { logFile } from "./log";
import assert = require("assert");

type RsyncStatic = typeof Rsync;
type Rsync = ReturnType<RsyncStatic["build"]>;

interface RsynOutput {
  code: number;
  cmd: string;
}

const rSyncExecute = (rsync: Rsync): Promise<RsynOutput> =>
  new Promise((resolve, reject) => {
    rsync.execute((error, code, cmd) => {
      if (error) reject(error);
      else resolve({ code, cmd });
    });
  });

const executeRsyncCommand = async (rsync: Rsync) => {
  const stdout = [] as string[];
  const stderr = [] as string[];
  rsync.output(
    (stdoutData: Buffer) => {
      const lines = stdoutData.toString().trim().split("\n");
      lines.forEach((line) => {
        appendFileSync(logFile, `Rsync output: ${line}\n`);
        stdout.push(line);
      });
    },
    (stderrData: Buffer) => {
      const line = stderrData.toString().trim();
      appendFileSync(logFile, `Rsync Error: ${line}\n`);
      stderr.push(line);
    }
  );
  const { code, cmd } = await rSyncExecute(rsync);
  return { code, cmd, stdout, stderr };
};

const isRsyncServiceLine = (line: string) => {
  if (line === "receiving incremental file list") return true;
  if (line.includes("sent") && line.includes("received")) return true;
  if (line.includes("total size")) return true;
  if (line.trim().length === 0) return true;
  return false;
};

export const syncMediaDir = async (
  sourceDir: string,
  backupDir: string,
  isDryRun = false
) => {
  assert(!sourceDir.endsWith("/"), "source path must not end with /");
  assert(!backupDir.endsWith("/"), "destination path must not end with /");
  const syncCommand = Rsync.build({
    source: `phone:${sourceDir}/`,
    destination: `${backupDir}/`,
    flags: "vt",
    shell: "ssh",
    dry: isDryRun ? true : undefined,
    archive: true,
  });

  const { code, stdout, stderr } = await executeRsyncCommand(syncCommand);
  assert(stderr.length === 0, `Messages were outputted on stderr: ${stderr}`);
  assert(code === 0, `Exited with error code: ${code}`);

  return stdout.filter((line) => !isRsyncServiceLine(line));
};
