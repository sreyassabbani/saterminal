import type { Question } from "@/questions/question.ts";
import { difficultyLabels, domainLabels, skillLabels } from "@/questions/taxonomy.ts";
import { htmlToText } from "@/text/html.ts";

export function formatQuestion(question: Question): string {
  const passage = question.passage ? `${htmlToText(question.passage)}\n\n` : "";
  const choices = question.choices
    .map((choice) => `${choice.key}. ${htmlToText(choice.content)}`)
    .join("\n");

  return [
    `Question ${question.id}`,
    `${difficultyLabels[question.difficulty]} · ${domainLabels[question.domain]} · ${skillLabels[question.skill]}`,
    "",
    `${passage}${htmlToText(question.prompt)}`,
    "",
    choices,
    "",
    `Correct answer: ${question.correctAnswers.join(", ")}`,
    "",
    "Explanation",
    htmlToText(question.explanation ?? "No explanation is available."),
  ].join("\n");
}
