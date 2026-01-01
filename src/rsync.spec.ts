import { syncMediaDir } from "./rsync";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  rmSync,
  mkdirSync,
  utimesSync,
} from "fs";
import { tmpdir } from "os";
import { join } from "path";
import * as ssh2 from "ssh2";
import { generateKeyPairSync } from "crypto";
import { spawn } from "child_process";

describe("rsync.ts - End-to-End SSH Rsync Sync", () => {
  let rsyncServer: TestRsyncServer;
  const SERVER_PORT = 9023;
  const SERVER_USER = "testuser";

  let testRootDir: string;
  let serverDir: string;
  let clientPrivateKeyPath: string;
  let clientPublicKey: string;

  beforeAll(async () => {
    testRootDir = mkdtempSync(join(tmpdir(), "rsync-test-"));
    serverDir = join(testRootDir, "server");

    const clientKeyPair = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs1", format: "pem" },
    });
    clientPublicKey = clientKeyPair.publicKey;
    clientPrivateKeyPath = join(testRootDir, "client_key");
    writeFileSync(clientPrivateKeyPath, clientKeyPair.privateKey, {
      mode: 0o600,
    });

    mkdirSync(serverDir);
    writeFileSync(join(serverDir, "file1.txt"), "Server file 1 content");
    writeFileSync(join(serverDir, "file2.jpg"), "Server file 2 content");
    writeFileSync(join(serverDir, "file3.mp4"), "Server file 3 content");

    rsyncServer = new TestRsyncServer({
      port: SERVER_PORT,
      username: SERVER_USER,
      rootDir: serverDir,
      authorizedKeys: [clientPublicKey],
    });
    await rsyncServer.start();
  });

  afterAll(async () => {
    try {
      await rsyncServer.stop();
    } catch (err) {
      console.error("Error stopping rsync server:", err);
    }

    try {
      if (testRootDir) rmSync(testRootDir, { recursive: true, force: true });
    } catch (err) {
      console.error("Error cleaning up temp directories:", err);
    }
  });

  test("should sync missing files and overwrite files with same name but different mtime", async () => {
    const localDir = join(testRootDir, "local");
    mkdirSync(localDir);

    // Local has file2.jpg with same content as server but different mtime
    // This reproduces the real-world scenario where rsync keeps wanting to copy
    // files from the phone that already exist on the backup device
    const sharedContent = "Server file 2 content";
    writeFileSync(join(localDir, "file2.jpg"), sharedContent);
    const oneHourAgo = new Date(Date.now() - 3600000);
    utimesSync(join(localDir, "file2.jpg"), oneHourAgo, oneHourAgo);
    writeFileSync(join(localDir, "local-only.png"), "Local only");

    const initialLocalFiles = readdirSync(localDir);
    expect(initialLocalFiles.sort()).toEqual(["file2.jpg", "local-only.png"]);

    const syncedFiles = await syncMediaDir(".", localDir, false, {
      host: `${SERVER_USER}@127.0.0.1`,
      sshPort: SERVER_PORT,
      privateKey: clientPrivateKeyPath,
    });

    // rsync reports file2.jpg because mtime differs, even though content & SHA
    // are identical
    expect(syncedFiles.sort()).toEqual(["file1.txt", "file2.jpg", "file3.mp4"]);

    const finalLocalFiles = readdirSync(localDir);
    expect(finalLocalFiles.sort()).toEqual([
      "file1.txt",
      "file2.jpg",
      "file3.mp4",
      "local-only.png",
    ]);

    // file2.jpg content unchanged
    expect(readFileSync(join(localDir, "file2.jpg"), "utf-8")).toBe(
      sharedContent
    );
    expect(readFileSync(join(localDir, "file1.txt"), "utf-8")).toBe(
      "Server file 1 content"
    );
    expect(readFileSync(join(localDir, "file3.mp4"), "utf-8")).toBe(
      "Server file 3 content"
    );
    expect(readFileSync(join(localDir, "local-only.png"), "utf-8")).toBe(
      "Local only"
    );
  });

  test("should perform dry run without syncing files", async () => {
    const dryRunLocalDir = join(testRootDir, "local-dry-run");
    mkdirSync(dryRunLocalDir);

    // Same content but different mtime - rsync will report it for transfer
    writeFileSync(join(dryRunLocalDir, "file2.jpg"), "Server file 2 content");
    const oneHourAgo = new Date(Date.now() - 3600000);
    utimesSync(join(dryRunLocalDir, "file2.jpg"), oneHourAgo, oneHourAgo);

    const initialFiles = readdirSync(dryRunLocalDir);
    expect(initialFiles).toHaveLength(1);

    const syncedFiles = await syncMediaDir(".", dryRunLocalDir, true, {
      host: `${SERVER_USER}@127.0.0.1`,
      sshPort: SERVER_PORT,
      privateKey: clientPrivateKeyPath,
    });

    expect(syncedFiles).toHaveLength(3);
    expect(syncedFiles.sort()).toEqual(["file1.txt", "file2.jpg", "file3.mp4"]);

    // Dry run doesn't actually sync
    const finalFiles = readdirSync(dryRunLocalDir);
    expect(finalFiles).toHaveLength(initialFiles.length);
    expect(finalFiles).toEqual(["file2.jpg"]);
  });
});

// ============================================================================
// Rsync Test Server Helper
// ============================================================================

interface RsyncServerConfig {
  port: number;
  username: string;
  rootDir: string;
  authorizedKeys: string[];
}

class TestRsyncServer {
  private server: ssh2.Server;
  private config: RsyncServerConfig;

  constructor(config: RsyncServerConfig) {
    this.config = config;
    this.server = this.createServer();
  }

  private createServer(): ssh2.Server {
    const hostKey = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs1", format: "pem" },
    }).privateKey;

    return new ssh2.Server(
      { hostKeys: [hostKey] },
      this.handleClient.bind(this)
    );
  }

  private handleClient(client: ssh2.Connection) {
    client.on("authentication", (ctx: ssh2.AuthContext) => {
      if (ctx.username !== this.config.username) return ctx.reject();

      // For testing purposes, accept any publickey authentication
      if (ctx.method === "publickey") return ctx.accept();

      ctx.reject(["publickey"]);
    });

    client.on("ready", () => {
      client.on("session", (accept: ssh2.AcceptConnection<ssh2.Session>) => {
        const session = accept();

        session.on(
          "exec",
          (
            accept: ssh2.AcceptConnection<ssh2.ServerChannel>,
            _reject: ssh2.RejectConnection,
            info: ssh2.ExecInfo
          ) => {
            this.handleRsyncExec(accept, info);
          }
        );
      });
    });

    client.on("error", (err: Error & { code?: string }) => {
      // Ignore ECONNRESET - this is normal when client disconnects
      if (err.code !== "ECONNRESET") {
        console.error("SSH Client error:", err);
      }
    });
  }

  private handleRsyncExec(
    accept: ssh2.AcceptConnection<ssh2.ServerChannel>,
    info: ssh2.ExecInfo
  ) {
    const stream = accept();
    const command = info.command;

    const rsyncProc = spawn("/bin/sh", ["-c", command], {
      cwd: this.config.rootDir,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, PATH: "/usr/bin:/bin" },
    });

    // pipe() was causing a 255 error code from rsync
    // Manually handle data the flow seems to work better
    stream.on("data", (data: Buffer) => rsyncProc.stdin.write(data));

    stream.on("end", () => rsyncProc.stdin.end());

    rsyncProc.stdout.on("data", (data: Buffer) => stream.write(data));

    rsyncProc.stderr.on("data", (data: Buffer) => stream.stderr.write(data));

    rsyncProc.on("error", () => {
      stream.exit(1);
      stream.end();
    });

    rsyncProc.on("close", (code) => {
      stream.exit(code || 0);
      stream.end();
    });

    stream.on("close", () => {
      if (!rsyncProc.killed) rsyncProc.kill();
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.config.port, "127.0.0.1", () => resolve());
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => this.server.close(() => resolve()));
  }
}
