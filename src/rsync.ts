import assert from "assert";
import { appendFileSync, existsSync } from "fs";
import * as Rsync from "rsync";

import { logFile } from "./log";

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
  const stdout: string[] = [];
  const stderr: string[] = [];
  let stdoutBuffer = "";
  let stderrBuffer = "";

  // Chunks don't align with line boundaries (e.g. "file1.txt\nfile2.jp" then "g\n")
  // so we buffer partial lines until we see a newline
  const handleStdout = (data: Buffer) => {
    stdoutBuffer += data.toString();
    const lines = stdoutBuffer.split(/[\r\n]+/);
    stdoutBuffer = lines.pop() || "";
    lines.forEach((line) => {
      appendFileSync(logFile(), `Rsync output: ${line}\n`, { flush: true });
      stdout.push(line);
    });
  };

  const handleStderr = (data: Buffer) => {
    stderrBuffer += data.toString();
    const lines = stderrBuffer.split("\n");
    stderrBuffer = lines.pop() || "";
    lines.forEach((line) => {
      appendFileSync(logFile(), `Rsync Error: ${line}\n`, { flush: true });
      stderr.push(line);
    });
  };

  rsync.output(handleStdout, handleStderr);

  const { code, cmd } = await rSyncExecute(rsync);

  if (stdoutBuffer.trim()) stdout.push(stdoutBuffer.trim());
  if (stderrBuffer.trim()) stderr.push(stderrBuffer.trim());

  return { code, cmd, stdout, stderr };
};

const isRsyncServiceLine = (line: string) => {
  if (line === "receiving incremental file list") return true;
  if (line.includes("sent") && line.includes("received")) return true;
  if (line.includes("total size")) return true;
  if (line.trim().length === 0) return true;
  // SSH warnings about known hosts
  if (line.includes("Permanently added") && line.includes("known hosts"))
    return true;
  if (line.startsWith("Transfer starting:")) return true;
  if (line.startsWith("Skip existing")) return true;
  if (line.startsWith("Transfer complete:")) return true;
  if (line === "./") return true;
  // Progress lines (e.g. "  241401856  22%  460.43MB/s   00:00:01")
  if (line.includes("%") && /\d+\.\d+[KMGkmg]?B\/s/.test(line)) return true;
  return false;
};

const buildSSHCommand = (sshPort?: number, privateKey?: string): string => {
  let command = "ssh";
  if (sshPort) {
    command += ` -p ${sshPort}`;
  }
  if (privateKey) {
    command += ` -i ${privateKey} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null`;
  }
  return command;
};

export interface SyncOptions {
  host?: string;
  sshPort?: number;
  privateKey?: string;
}

export const syncMediaDir = async (
  sourceDir: string,
  backupDir: string,
  isDryRun = false,
  options: SyncOptions = {}
) => {
  const { host = "phone", sshPort, privateKey } = options;

  assert(!sourceDir.endsWith("/"), "source path must not end with /");
  assert(!backupDir.endsWith("/"), "destination path must not end with /");
  assert(
    existsSync(backupDir),
    `Backup destination does not exist: ${backupDir}`
  );

  const escapedSourceDir = sourceDir.replace(/ /g, "\\ ");
  const syncCommand = Rsync.build({
    source: `${host}:${escapedSourceDir}/`,
    destination: `${backupDir}/`,
    flags: "vt",
    shell: buildSSHCommand(sshPort, privateKey),
    dry: isDryRun ? true : undefined,
    archive: true,
    progress: true,
  });

  const { code, stdout, stderr } = await executeRsyncCommand(syncCommand);
  assert(stderr.length === 0, `Messages were outputted on stderr: ${stderr}`);
  assert(code === 0, `Exited with error code: ${code}`);

  return stdout.filter((line) => !isRsyncServiceLine(line));
};
