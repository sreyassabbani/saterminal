import { useApp } from "ink";
import { useEffect } from "react";
import { argument } from "pastel";
import { z } from "zod";
import { formatQuestion } from "@/cli/reports/question.ts";
import { findQuestion } from "@/questions/local-bank.ts";

export const description = "Inspect a question by ID";
export const args = z.tuple([
  z.string().describe(argument({ name: "id", description: "Question ID" })),
]);

export default function ShowCommand({ args: [id] }: { args: z.infer<typeof args> }) {
  const { exit } = useApp();

  useEffect(() => {
    void (async () => {
      try {
        const question = await findQuestion(id);
        if (!question) {
          process.stderr.write(`sat: question ${id} was not found.\n`);
          process.exitCode = 1;
          return;
        }
        process.stdout.write(`${formatQuestion(question)}\n`);
      } catch (error) {
        process.stderr.write(`sat: ${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
      } finally {
        exit();
      }
    })();
  }, [exit, id]);

  return null;
}
