import { Spinner } from "@inkjs/ui";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import { useCallback, useEffect, useRef, useState } from "react";
import { dataDirectoryExists, ensureDatabase } from "../database/index.ts";
import { loadFocus, saveFocus } from "../database/focus-repository.ts";
import { loadAttempts } from "../database/progress-repository.ts";
import { dataDirectory, displayPath } from "../local-data/paths.ts";
import { answerQuestion } from "../practice/answer-question.ts";
import type { Focus } from "../questions/focus.ts";
import { defaultFocus } from "../questions/focus.ts";
import { findQuestion, loadQuestionBank, nextQuestion, questionBankStatus } from "../questions/local-bank.ts";
import type { Question } from "../questions/question.ts";
import type { AnswerRecord, Attempt } from "../progress/attempt.ts";
import { reviewQueue } from "../progress/review-queue.ts";
import { DetailScreen } from "./screens/detail.tsx";
import { FocusScreen } from "./screens/focus.tsx";
import { HistoryScreen } from "./screens/history.tsx";
import { PracticeScreen } from "./screens/practice.tsx";
import { ResultScreen } from "./screens/result.tsx";
import { SetupScreen } from "./screens/setup.tsx";
import { SummaryScreen } from "./screens/summary.tsx";
import { useTerminalSize } from "./hooks/use-terminal-size.ts";

type View = "setup" | "loading" | "focus" | "practice" | "result" | "history" | "summary" | "detail" | "error";

export function SatApp({ mode = "practice" }: { mode?: "practice" | "review" }) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const terminal = useTerminalSize();
  const [view, setView] = useState<View>("loading");
  const [focus, setFocus] = useState<Focus>(defaultFocus);
  const [attempts, setAttempts] = useState<Map<string, Attempt>>(() => new Map());
  const [question, setQuestion] = useState<Question>();
  const [detail, setDetail] = useState<{ question: Question; attempt: Attempt }>();
  const [result, setResult] = useState<AnswerRecord>();
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const reviewIds = useRef<string[]>([]);
  const skippedIds = useRef(new Set<string>());

  const takeNextQuestion = useCallback(async (currentAttempts: Map<string, Attempt>, currentFocus: Focus) => {
    if (mode === "review") {
      while (reviewIds.current.length) {
        const candidate = await findQuestion(reviewIds.current.shift()!);
        if (candidate) return candidate;
      }
      return undefined;
    }
    return nextQuestion([...currentAttempts.keys(), ...skippedIds.current], currentFocus);
  }, [mode]);

  const showNextQuestion = useCallback(async (currentAttempts = attempts, currentFocus = focus) => {
    setView("loading");
    try {
      const next = await takeNextQuestion(currentAttempts, currentFocus);
      if (!next) {
        setNotice(mode === "review" ? "Review queue complete." : "No unanswered questions match this focus.");
        setView("history");
        return;
      }
      setQuestion(next);
      setResult(undefined);
      setView("practice");
    } catch (cause) {
      setError(message(cause));
      setView("error");
    }
  }, [attempts, focus, mode, takeNextQuestion]);

  const initialize = useCallback(async () => {
    setView("loading");
    try {
      ensureDatabase();
      const currentAttempts = loadAttempts();
      const currentFocus = loadFocus();
      await loadQuestionBank();
      const status = await questionBankStatus();
      setAttempts(currentAttempts);
      setFocus(currentFocus);
      setNotice(`${status.questions ?? 0} questions available offline.`);
      if (mode === "review") {
        reviewIds.current = reviewQueue(currentAttempts.values());
        if (!reviewIds.current.length) {
          setNotice("No review queue yet. Miss or correct a question first.");
          setView("history");
          return;
        }
        const first = await takeNextQuestion(currentAttempts, currentFocus);
        if (first) {
          setQuestion(first);
          setView("practice");
        } else {
          setNotice("Review queue complete.");
          setView("history");
        }
      } else {
        setView("focus");
      }
    } catch (cause) {
      setError(message(cause));
      setView("error");
    }
  }, [mode, takeNextQuestion]);

  useEffect(() => {
    if (dataDirectoryExists()) void initialize();
    else setView("setup");
  }, [initialize]);

  useEffect(() => {
    if (!stdout.isTTY) return;
    stdout.write("\x1b[?1049h\x1b[?25l");
    return () => { stdout.write("\x1b[?25h\x1b[?1049l"); };
  }, [stdout]);

  useInput((input) => {
    if (input === "q") exit();
    else if (input === "f" && view !== "setup") setView("focus");
    else if (input === "h" && view !== "setup") setView("history");
    else if (input === "s" && view !== "setup") setView("summary");
    else if (input === "p" && view !== "setup") {
      if (question && view !== "result") setView("practice");
      else void showNextQuestion();
    }
  });

  const answer = async (choice: string, durationSeconds: number) => {
    if (!question) return;
    setView("loading");
    try {
      const answerResult = await answerQuestion({ attempts, question, answer: choice, durationSeconds });
      setAttempts((current) => new Map(current).set(answerResult.attempt.questionId, answerResult.attempt));
      setResult(answerResult);
      setView("result");
    } catch (cause) {
      setError(message(cause));
      setView("error");
    }
  };

  const updateFocus = (next: Focus) => {
    saveFocus(next);
    setFocus(next);
    setQuestion(undefined);
    skippedIds.current.clear();
  };

  const openAttempt = async (attempt: Attempt) => {
    setView("loading");
    const found = await findQuestion(attempt.questionId);
    if (found) {
      setDetail({ question: found, attempt });
      setView("detail");
    } else {
      setNotice(`Question ${attempt.questionId} is no longer in the local bank.`);
      setView("history");
    }
  };

  let content;
  if (view === "setup") content = <SetupScreen location={displayPath(dataDirectory)} onAccept={() => void initialize()} onDecline={exit} />;
  else if (view === "focus") content = <FocusScreen focus={focus} notice={notice} onChange={updateFocus} onStart={() => void showNextQuestion()} />;
  else if (view === "practice" && question) content = <PracticeScreen key={question.id} question={question} onAnswer={(choice, duration) => void answer(choice, duration)} onSkip={() => { skippedIds.current.add(question.id); void showNextQuestion(); }} />;
  else if (view === "result" && question && result) content = <ResultScreen question={question} result={result} onNext={() => void showNextQuestion()} />;
  else if (view === "history") content = <HistoryScreen attempts={attempts.values()} notice={notice} onOpen={(attempt) => void openAttempt(attempt)} />;
  else if (view === "summary") content = <SummaryScreen attempts={attempts.values()} />;
  else if (view === "detail" && detail) content = <DetailScreen question={detail.question} attempt={detail.attempt} onBack={() => setView("history")} />;
  else if (view === "error") content = <Box flexDirection="column"><Text bold color="red">Something went wrong.</Text><Text>{error}</Text><Text color="gray">Press q to quit.</Text></Box>;
  else content = <Spinner label="Loading local SAT data" />;

  return <Box width={terminal.width} height={terminal.height}>{content}</Box>;
}

function message(value: unknown): string {
  return value instanceof Error ? value.message : String(value);
}
