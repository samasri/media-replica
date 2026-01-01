import { syncMediaDir } from "./rsync";
import * as Rsync from "rsync";

jest.mock("fs", () => ({
  ...jest.requireActual("fs"),
  existsSync: () => true,
  appendFileSync: () => {},
}));

jest.mock("rsync", () => ({ build: jest.fn() }));

const mockBuild = Rsync.build as jest.Mock;

describe("rsync output buffering", () => {
  beforeEach(() => jest.clearAllMocks());

  const setupMock = (emitChunks: Buffer[]) => {
    let emit: (data: Buffer) => void;
    mockBuild.mockReturnValue({
      set: jest.fn().mockReturnThis(),
      output: jest.fn((stdout) => {
        emit = stdout;
      }),
      execute: jest.fn((cb) => {
        emitChunks.forEach((chunk) => emit(chunk));
        cb(null, 0, "rsync");
      }),
      command: jest.fn(() => "rsync --mock"),
    });
  };

  test.each([
    {
      name: "output split across multiple chunks",
      chunks: ["file1.txt\nfile2.jp", "g\nfile3.mp4\n"],
      expected: ["file1.txt", "file2.jpg", "file3.mp4"],
    },
    {
      name: "single chunk with complete lines",
      chunks: ["file1.txt\nfile2.jpg\n"],
      expected: ["file1.txt", "file2.jpg"],
    },
    {
      name: "trailing content without newline",
      chunks: ["file1.txt\nfile2.jpg"],
      expected: ["file1.txt", "file2.jpg"],
    },
    {
      name: "filters rsync service lines from chunked output",
      chunks: ["file1.txt\nSkip exis", "ting 'old.jpg'\nfile2.jpg\n"],
      expected: ["file1.txt", "file2.jpg"],
    },
  ])("$name", async ({ chunks, expected }) => {
    setupMock(chunks.map((c) => Buffer.from(c)));
    const files = await syncMediaDir("/source", "/dest", true);
    expect(files).toEqual(expected);
  });
});
