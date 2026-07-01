import terminalKit from "terminal-kit";
import { fetchPracticeQuestion, findQuestionByShortId } from "./api.ts";
import { buildSummaryRows, ensureStateFiles, loadAttempts, recordAttempt, saveAttempts, saveSummary } from "./state.ts";
import { htmlToText, wrapText } from "./text.ts";
import type { Attempt, PracticeQuestion } from "./types.ts";

const term = terminalKit.terminal;
const gutter = 3;

type View = "loading" | "practice" | "review" | "history" | "summary" | "detail" | "error";

type AppState = {
  attempts: Map<string, Attempt>;
  view: View;
  question?: PracticeQuestion;
  selected: number;
  lastAnswer?: string;
  lastCorrect?: boolean;
  detailQuestion?: PracticeQuestion;
  historyIndex: number;
  error?: string;
};

export async function runTui(): Promise<void> {
  const state: AppState = {
    attempts: new Map(),
    view: "loading",
    selected: 0,
    historyIndex: 0,
  };

  term.fullscreen(true);
  term.hideCursor();
  term.grabInput();

  const cleanup = () => {
    term.grabInput(false);
    term.hideCursor(false);
    term.fullscreen(false);
    term.processExit(0);
  };

  process.on("SIGINT", cleanup);
  term.on("key", async (name: string) => {
    try {
      if (name === "CTRL_C" || name === "q") {
        cleanup();
        return;
      }

      await handleKey(state, name);
      render(state);
    } catch (error) {
      state.view = "error";
      state.error = error instanceof Error ? error.message : String(error);
      render(state);
    }
  });

  try {
    await ensureStateFiles();
    state.attempts = await loadAttempts();
    await loadNextQuestion(state);
  } catch (error) {
    state.view = "error";
    state.error = error instanceof Error ? error.message : String(error);
  }

  render(state);
}

async function handleKey(state: AppState, name: string): Promise<void> {
  if (state.view === "loading") {
    return;
  }

  if (name === "h") {
    state.view = "history";
    state.historyIndex = 0;
    return;
  }

  if (name === "s") {
    state.view = "summary";
    return;
  }

  if (name === "p") {
    state.view = state.question ? "practice" : "loading";
    if (!state.question) {
      await loadNextQuestion(state);
    }
    return;
  }

  if (state.view === "error") {
    if (name === "r") {
      state.view = "loading";
      await loadNextQuestion(state);
    }
    return;
  }

  if (state.view === "practice") {
    const choices = answerKeys(state.question);
    const directChoice = choices.findIndex((choice) => choice.toLowerCase() === name.toLowerCase());
    if (name === "UP" || name === "k") {
      state.selected = Math.max(0, state.selected - 1);
    } else if (name === "DOWN" || name === "j") {
      state.selected = Math.min(choices.length - 1, state.selected + 1);
    } else if (directChoice >= 0) {
      state.selected = directChoice;
    } else if (name === "ENTER") {
      const answer = choices[state.selected];
      const correct = state.question?.detail.correct_answer.includes(answer) ?? false;
      state.lastAnswer = answer;
      state.lastCorrect = correct;
      if (state.question) {
        recordAttempt(state.attempts, state.question.meta.questionId, correct);
        await saveAttempts(state.attempts);
        await saveSummary(state.attempts);
      }
      state.view = "review";
    }
    return;
  }

  if (state.view === "review" && (name === "ENTER" || name === "n")) {
    await loadNextQuestion(state);
    return;
  }

  if (state.view === "history") {
    const attempts = historyRows(state);
    if (name === "UP" || name === "k") {
      state.historyIndex = Math.max(0, state.historyIndex - 1);
    } else if (name === "DOWN" || name === "j") {
      state.historyIndex = Math.min(attempts.length - 1, state.historyIndex + 1);
    } else if (name === "ENTER" && attempts[state.historyIndex]) {
      state.view = "loading";
      render(state);
      state.detailQuestion = await findQuestionByShortId(attempts[state.historyIndex].question_id);
      state.view = "detail";
    }
    return;
  }

  if (state.view === "detail" && name === "ESCAPE") {
    state.view = "history";
  }
}

async function loadNextQuestion(state: AppState): Promise<void> {
  state.view = "loading";
  state.question = await fetchPracticeQuestion(state.attempts.keys());
  state.selected = 0;
  state.lastAnswer = undefined;
  state.lastCorrect = undefined;
  state.view = "practice";
}

function render(state: AppState): void {
  term.clear();
  header(state);

  if (state.view === "loading") {
    line(3, "Loading...");
  } else if (state.view === "practice") {
    renderPractice(state);
  } else if (state.view === "review") {
    renderReview(state);
  } else if (state.view === "history") {
    renderHistory(state);
  } else if (state.view === "summary") {
    renderSummary(state);
  } else if (state.view === "detail") {
    renderDetail(state);
  } else if (state.view === "error") {
    renderError(state);
  }

  footer(state);
}

function header(state: AppState): void {
  const answered = state.attempts.size;
  term.moveTo(1, 1).bold("sat");
  term.moveTo(8, 1).gray(`reading/writing  answered ${answered}`);
  term.moveTo(1, 2).gray("-".repeat(term.width));
}

function footer(state: AppState): void {
  const controls = state.view === "practice"
    ? "up/down or j/k move | enter submit | h history | s summary | q quit"
    : state.view === "review"
      ? "enter/n next | h history | s summary | q quit"
      : state.view === "history"
        ? "up/down or j/k move | enter open | p practice | s summary | q quit"
        : state.view === "detail"
          ? "esc history | p practice | q quit"
          : state.view === "error"
            ? "r retry | q quit"
            : "p practice | h history | q quit";
  term.moveTo(1, term.height - 1).gray("-".repeat(term.width));
  term.moveTo(1, term.height).gray(controls.slice(0, term.width - 1));
}

function renderPractice(state: AppState): void {
  if (!state.question) {
    return;
  }

  const { detail } = state.question;
  const panes = paneLayout();
  let leftY = 4;
  let rightY = 4;

  leftY = printWrappedAt(htmlToText(detail.stimulus), panes.leftX, leftY, panes.leftWidth, term.height - 3);
  printWrappedAt(htmlToText(detail.stem), panes.leftX, leftY + 1, panes.leftWidth, term.height - 3, true);

  for (const [index, key] of answerKeys(state.question).entries()) {
    const marker = index === state.selected ? ">" : " ";
    const answer = `${marker} ${key}. ${htmlToText(detail.answerOptions[key])}`;
    rightY = printWrappedAt(answer, panes.rightX, rightY, panes.rightWidth, term.height - 3, index === state.selected);
    rightY++;
  }
}

function renderReview(state: AppState): void {
  if (!state.question) {
    return;
  }

  const { meta, detail } = state.question;
  const panes = paneLayout();
  let leftY = 4;
  let rightY = 4;
  const correct = state.lastCorrect ? "correct" : "incorrect";
  term.moveTo(panes.rightX, rightY++)[state.lastCorrect ? "green" : "red"](correct);
  lineAt(panes.rightX, rightY++, panes.rightWidth, `your answer: ${state.lastAnswer ?? "-"}`);
  lineAt(panes.rightX, rightY++, panes.rightWidth, `correct: ${detail.correct_answer.join(", ")}`);
  rightY++;
  lineAt(panes.rightX, rightY++, panes.rightWidth, `${meta.primary_class_cd} | ${meta.skill_cd}`);
  lineAt(panes.rightX, rightY++, panes.rightWidth, `difficulty ${meta.difficulty} | ${meta.questionId}`);
  rightY++;
  printWrappedAt(htmlToText(detail.rationale), panes.rightX, rightY, panes.rightWidth, term.height - 3);

  leftY = printWrappedAt(htmlToText(detail.stimulus), panes.leftX, leftY, panes.leftWidth, term.height - 3);
  printWrappedAt(htmlToText(detail.stem), panes.leftX, leftY + 1, panes.leftWidth, term.height - 3, true);
}

function renderHistory(state: AppState): void {
  const attempts = historyRows(state);
  let y = 4;
  line(y++, "answered questions");
  y++;

  if (attempts.length === 0) {
    line(y, "No attempts yet.");
    return;
  }

  const visibleRows = Math.max(1, term.height - 7);
  const start = Math.max(0, Math.min(state.historyIndex - visibleRows + 1, attempts.length - visibleRows));
  for (const [offset, attempt] of attempts.slice(start, start + visibleRows).entries()) {
    const index = start + offset;
    const marker = index === state.historyIndex ? ">" : " ";
    const text = `${marker} ${attempt.question_id.padEnd(10)} ${attempt.outcome.padEnd(9)} ${attempt.updated_at}`;
    term.moveTo(1, y++)[index === state.historyIndex ? "inverse" : "defaultColor"](text.slice(0, term.width - 1));
  }
}

function renderSummary(state: AppState): void {
  let y = 4;
  line(y++, "summary");
  y++;
  for (const row of buildSummaryRows(state.attempts)) {
    line(y++, `${row.metric.padEnd(10)} ${row.value}`);
  }
}

function renderDetail(state: AppState): void {
  const panes = paneLayout();
  let leftY = 4;
  let rightY = 4;
  if (!state.detailQuestion) {
    line(4, "Could not fetch details for this question.");
    return;
  }

  const { meta, detail } = state.detailQuestion;
  lineAt(panes.rightX, rightY++, panes.rightWidth, `${meta.primary_class_cd} | ${meta.skill_cd}`);
  lineAt(panes.rightX, rightY++, panes.rightWidth, `difficulty ${meta.difficulty} | ${meta.questionId}`);
  rightY++;

  leftY = printWrappedAt(htmlToText(detail.stimulus), panes.leftX, leftY, panes.leftWidth, term.height - 3);
  printWrappedAt(htmlToText(detail.stem), panes.leftX, leftY + 1, panes.leftWidth, term.height - 3, true);

  for (const key of answerKeys(state.detailQuestion)) {
    const label = detail.correct_answer.includes(key) ? "*" : " ";
    rightY = printWrappedAt(`${label} ${key}. ${htmlToText(detail.answerOptions[key])}`, panes.rightX, rightY, panes.rightWidth, term.height - 3);
    rightY++;
  }
}

function renderError(state: AppState): void {
  line(4, "Something went wrong.");
  printWrapped(state.error ?? "Unknown error.", 6, term.height - 3);
}

function answerKeys(question?: PracticeQuestion): string[] {
  return Object.keys(question?.detail.answerOptions ?? {}).sort();
}

function historyRows(state: AppState): Attempt[] {
  return [...state.attempts.values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

function printWrapped(value: string | undefined, y: number, maxY: number, bold = false): number {
  return printWrappedAt(value, 1, y, term.width - 4, maxY, bold);
}

function printWrappedAt(
  value: string | undefined,
  x: number,
  y: number,
  width: number,
  maxY: number,
  bold = false,
): number {
  for (const row of wrapText(value ?? "", width)) {
    if (y > maxY) {
      lineAt(x, y, width, "...");
      return y + 1;
    }
    if (bold) {
      term.moveTo(x, y++).bold(row.slice(0, width));
    } else {
      lineAt(x, y++, width, row);
    }
  }

  return y;
}

function line(y: number, value: string): void {
  term.moveTo(1, y)(value.slice(0, term.width - 1));
}

function lineAt(x: number, y: number, width: number, value: string): void {
  term.moveTo(x, y)(value.slice(0, width));
}

function paneLayout(): { leftX: number; leftWidth: number; rightX: number; rightWidth: number } {
  const usable = Math.max(40, term.width - gutter);
  const leftWidth = Math.max(20, Math.floor(usable / 2));
  const rightX = leftWidth + gutter + 1;
  const rightWidth = Math.max(20, term.width - rightX);

  return {
    leftX: 1,
    leftWidth,
    rightX,
    rightWidth,
  };
}
