import { stdin, stdout } from "node:process";
import * as readline from "readline";

const printDate = (date: Date) =>
  `${date.toLocaleDateString("en-uk")}-${date.toLocaleTimeString("en-us")}`;

export const now = () => printDate(new Date());

export const askUser = (prompt: string) => {
  const rl = readline.createInterface({ input: stdin, output: stdout });

  const answerPromise = new Promise<string>((resolve) => {
    rl.question(`${prompt}\n`, (line: string) => {
      resolve(line);
      rl.close();
    });
  });
  return answerPromise;
};
