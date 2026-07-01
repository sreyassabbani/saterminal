import terminalKit from "terminal-kit";
import { spawn } from "node:child_process";
import { fetchPracticeQuestion, findQuestionByShortId } from "./api.ts";
import { buildSummaryRows, ensureStateFiles, loadAttempts, recordAttempt, saveAttempts, saveSummary } from "./state.ts";
import { hasHtmlTable, htmlToText, wrapText } from "./text.ts";
import type { Attempt, PracticeQuestion, QuestionDetail } from "./types.ts";

const term = terminalKit.terminal;
const gutter = 3;

type View = "loading" | "practice" | "review" | "history" | "summary" | "detail" | "error";

type AppState = {
  attempts: Map<string, Attempt>;
  skippedIds: Set<string>;
  nextQuestion?: Promise<PracticeQuestion | undefined>;
  view: View;
  question?: PracticeQuestion;
  selected: number;
  questionScroll: number;
  elapsedMs: number;
  timerStartedAt?: number;
  timerPaused: boolean;
  timerHidden: boolean;
  lastAnswer?: string;
  lastCorrect?: boolean;
  detailQuestion?: PracticeQuestion;
  historyIndex: number;
  error?: string;
};

type KeyData = {
  code?: string | Buffer | number;
  codepoint?: number;
  isCharacter?: boolean;
};

export async function runTui(): Promise<void> {
  const state: AppState = {
    attempts: new Map(),
    skippedIds: new Set(),
    view: "loading",
    selected: 0,
    questionScroll: 0,
    elapsedMs: 0,
    timerPaused: false,
    timerHidden: false,
    historyIndex: 0,
  };

  term.fullscreen(true);
  term.hideCursor();
  term.grabInput();
  const tick = setInterval(() => {
    if (state.view === "practice" && !state.timerPaused) {
      render(state);
    }
  }, 1000);

  const cleanup = () => {
    clearInterval(tick);
    term.grabInput(false);
    term.hideCursor(false);
    term.fullscreen(false);
    term.processExit(0);
  };

  process.on("SIGINT", cleanup);
  term.on("key", async (name: string, _matches?: string[], data?: KeyData) => {
    try {
      if (name === "CTRL_C" || name === "q") {
        cleanup();
        return;
      }

      await handleKey(state, name, data);
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

async function handleKey(state: AppState, name: string, data?: KeyData): Promise<void> {
  if (state.view === "loading") {
    return;
  }

  if (name === "h") {
    pauseTimer(state);
    state.view = "history";
    state.historyIndex = 0;
    return;
  }

  if (name === "s") {
    pauseTimer(state);
    state.view = "summary";
    return;
  }

  if (name === "t") {
    state.timerHidden = !state.timerHidden;
    return;
  }

  if (name === "p") {
    state.view = state.question ? "practice" : "loading";
    state.questionScroll = 0;
    resumeTimer(state);
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

  if (state.view === "practice" || state.view === "review" || state.view === "detail") {
    if (name === "PAGE_DOWN" || name === "]") {
      state.questionScroll += questionPageSize();
      return;
    }
    if (name === "PAGE_UP" || name === "[") {
      state.questionScroll = Math.max(0, state.questionScroll - questionPageSize());
      return;
    }
    if (name === "HOME") {
      state.questionScroll = 0;
      return;
    }
  }

  if (state.view === "practice") {
    if (isPauseKey(name, data)) {
      toggleTimer(state);
      return;
    }

    if (state.question && questionNeedsExternalDisplay(state.question.detail)) {
      if (name === "n" || name === "x" || name === "ENTER") {
        skipQuestion(state);
        await loadNextQuestion(state);
      } else if (name === "o") {
        openExternalQuestion(state.question);
      }
      return;
    }

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
      const elapsedSeconds = elapsedQuestionSeconds(state);
      state.lastAnswer = answer;
      state.lastCorrect = correct;
      pauseTimer(state);
      if (state.question) {
        recordAttempt(state.attempts, state.question.meta.questionId, correct, elapsedSeconds);
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
      state.questionScroll = 0;
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
  state.question = await takeNextQuestion(state);
  state.selected = 0;
  state.questionScroll = 0;
  state.elapsedMs = 0;
  state.timerStartedAt = Date.now();
  state.timerPaused = false;
  state.lastAnswer = undefined;
  state.lastCorrect = undefined;
  state.view = "practice";
  cacheNextQuestion(state);
}

async function takeNextQuestion(state: AppState): Promise<PracticeQuestion> {
  const cached = state.nextQuestion;
  state.nextQuestion = undefined;

  if (cached) {
    const question = await cached;
    if (question) {
      return question;
    }
  }

  return fetchPracticeQuestion(questionExclusions(state));
}

function cacheNextQuestion(state: AppState): void {
  state.nextQuestion = fetchPracticeQuestion(questionExclusions(state)).catch(() => undefined);
}

function questionExclusions(state: AppState): string[] {
  return [
    ...state.attempts.keys(),
    ...state.skippedIds,
    ...(state.question ? [state.question.meta.questionId] : []),
  ];
}

function render(state: AppState): void {
  term.clear();
  if (state.view === "practice" && state.timerPaused) {
    renderPaused();
    return;
  }

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

function renderPaused(): void {
  const label = "PAUSED";
  const x = Math.max(1, Math.floor((term.width - label.length) / 2) + 1);
  const y = Math.max(1, Math.floor(term.height / 2));
  term.moveTo(x, y).bold(label);
}

function header(state: AppState): void {
  const answered = state.attempts.size;
  const timer = state.timerHidden ? "" : `  time ${formatElapsed(elapsedQuestionSeconds(state))}${timerStatus(state)}`;
  term.moveTo(1, 1).bold("sat");
  term.moveTo(8, 1).gray(`reading/writing  answered ${answered}${timer}`);
  term.moveTo(1, 2).gray("-".repeat(term.width));
}

function footer(state: AppState): void {
  const controls = state.view === "practice"
    ? practiceControls(state)
    : state.view === "review"
      ? "pgup/pgdn or [/] scroll question | enter/n next | h history | s summary | q quit"
      : state.view === "history"
        ? "up/down or j/k move | enter open | p practice | s summary | q quit"
        : state.view === "detail"
          ? "pgup/pgdn or [/] scroll question | esc history | p practice | q quit"
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
  let rightY = 4;

  if (questionNeedsExternalDisplay(detail)) {
    renderUnsupportedQuestion(state.question, panes);
    return;
  }

  renderQuestionPane(detail, panes.leftX, panes.leftWidth, state.questionScroll);

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

  renderQuestionPane(detail, panes.leftX, panes.leftWidth, state.questionScroll);
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
  let rightY = 4;
  if (!state.detailQuestion) {
    line(4, "Could not fetch details for this question.");
    return;
  }

  const { meta, detail } = state.detailQuestion;
  if (questionNeedsExternalDisplay(detail)) {
    renderUnsupportedQuestion(state.detailQuestion, panes);
    return;
  }

  lineAt(panes.rightX, rightY++, panes.rightWidth, `${meta.primary_class_cd} | ${meta.skill_cd}`);
  lineAt(panes.rightX, rightY++, panes.rightWidth, `difficulty ${meta.difficulty} | ${meta.questionId}`);
  rightY++;

  renderQuestionPane(detail, panes.leftX, panes.leftWidth, state.questionScroll);

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

function practiceControls(state: AppState): string {
  if (state.question && questionNeedsExternalDisplay(state.question.detail)) {
    return "space pause/resume | t timer | o open externally | n/x/enter skip | h history | s summary | q quit";
  }

  return "space pause/resume | t timer | up/down or j/k move | pgup/pgdn or [/] scroll question | enter submit | h history | s summary | q quit";
}

function isPauseKey(name: string, data?: KeyData): boolean {
  if (name === " " || name.toUpperCase() === "SPACE") {
    return true;
  }

  if (data?.isCharacter && data.codepoint === 32) {
    return true;
  }

  if (data?.code === " ") {
    return true;
  }

  if (Buffer.isBuffer(data?.code) && data.code.toString("utf8") === " ") {
    return true;
  }

  return false;
}

function answerKeys(question?: PracticeQuestion): string[] {
  return Object.keys(question?.detail.answerOptions ?? {}).sort();
}

function questionNeedsExternalDisplay(detail: QuestionDetail): boolean {
  return hasHtmlTable(
    detail.stimulus,
    detail.stem,
    detail.rationale,
    ...Object.values(detail.answerOptions),
  );
}

function skipQuestion(state: AppState): void {
  if (state.question) {
    state.skippedIds.add(state.question.meta.questionId);
  }
}

function toggleTimer(state: AppState): void {
  if (state.timerPaused) {
    resumeTimer(state);
  } else {
    pauseTimer(state);
  }
}

function pauseTimer(state: AppState): void {
  if (state.timerPaused || state.timerStartedAt === undefined) {
    return;
  }

  state.elapsedMs += Date.now() - state.timerStartedAt;
  state.timerStartedAt = undefined;
  state.timerPaused = true;
}

function resumeTimer(state: AppState): void {
  if (!state.timerPaused || state.view !== "practice") {
    return;
  }

  state.timerStartedAt = Date.now();
  state.timerPaused = false;
}

function elapsedQuestionSeconds(state: AppState): number {
  const activeMs = state.timerPaused || state.timerStartedAt === undefined ? 0 : Date.now() - state.timerStartedAt;
  return Math.max(0, Math.round((state.elapsedMs + activeMs) / 1000));
}

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function timerStatus(state: AppState): string {
  return state.view === "practice" && state.timerPaused ? " paused" : "";
}

function renderUnsupportedQuestion(question: PracticeQuestion, panes: ReturnType<typeof paneLayout>): void {
  const { meta, detail } = question;
  const appUrl = practiceQuestionUrl(question);
  const apiUrl = practiceQuestionApiUrl(question);
  let y = 4;

  lineAt(panes.leftX, y++, panes.leftWidth, "This question contains a table.");
  y++;
  y = printWrappedAt(
    "The terminal renderer cannot display this table accurately enough to answer the question here.",
    panes.leftX,
    y,
    panes.leftWidth,
    term.height - 3,
  );
  y++;
  y = printWrappedAt("Open it in PracticeSAT, search this question ID, then skip it in this app.", panes.leftX, y, panes.leftWidth, term.height - 3);
  y++;
  y = printWrappedAt(`Question ID: ${meta.questionId}`, panes.leftX, y, panes.leftWidth, term.height - 3);
  y++;
  y = printWrappedAt(appUrl, panes.leftX, y, panes.leftWidth, term.height - 3);
  y++;
  y = printWrappedAt(`API fallback: ${apiUrl}`, panes.leftX, y, panes.leftWidth, term.height - 3);

  let rightY = 4;
  lineAt(panes.rightX, rightY++, panes.rightWidth, `${meta.primary_class_cd} | ${meta.skill_cd}`);
  lineAt(panes.rightX, rightY++, panes.rightWidth, `difficulty ${meta.difficulty} | ${meta.questionId}`);
  rightY++;
  lineAt(panes.rightX, rightY++, panes.rightWidth, "o open externally");
  lineAt(panes.rightX, rightY++, panes.rightWidth, "n/x/enter skip");
  rightY++;
  printWrappedAt(htmlToText(detail.stem), panes.rightX, rightY, panes.rightWidth, term.height - 3, true);
}

function practiceQuestionUrl(question: PracticeQuestion): string {
  return `https://practicesat.vercel.app/question?questionId=${encodeURIComponent(question.meta.questionId)}`;
}

function practiceQuestionApiUrl(question: PracticeQuestion): string {
  return `https://practicesat.vercel.app/api/question/${encodeURIComponent(question.meta.external_id)}`;
}

function openExternalQuestion(question: PracticeQuestion): void {
  const child = spawn("open", [practiceQuestionUrl(question)], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

function historyRows(state: AppState): Attempt[] {
  return [...state.attempts.values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

type DisplayRow = {
  text: string;
  bold?: boolean;
};

function renderQuestionPane(detail: QuestionDetail, x: number, width: number, scroll: number): void {
  const rows = questionRows(detail, width);
  const maxRows = questionPageSize();
  const maxScroll = Math.max(0, rows.length - maxRows);
  const start = Math.min(scroll, maxScroll);

  for (const [offset, row] of rows.slice(start, start + maxRows).entries()) {
    const y = 4 + offset;
    if (row.bold) {
      term.moveTo(x, y).bold(row.text.slice(0, width));
    } else {
      lineAt(x, y, width, row.text);
    }
  }

  if (start > 0) {
    lineAt(x + width - 4, 4, 4, "^");
  }
  if (start < maxScroll) {
    lineAt(x + width - 4, term.height - 3, 4, "v");
  }
}

function questionRows(detail: QuestionDetail, width: number): DisplayRow[] {
  const rows: DisplayRow[] = [];
  const stimulus = wrapText(htmlToText(detail.stimulus), width).map((text) => ({ text }));
  const stem = wrapText(htmlToText(detail.stem), width).map((text) => ({ text, bold: true }));

  rows.push(...stimulus);
  if (stimulus.length > 0 && stem.length > 0) {
    rows.push({ text: "" });
  }
  rows.push(...stem);
  return rows;
}

function questionPageSize(): number {
  return Math.max(1, term.height - 6);
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
