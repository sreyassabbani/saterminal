import { Spinner } from "@inkjs/ui";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import { useCallback, useEffect, useState } from "react";
import { loadFocus, saveFocus } from "@/database/focus-repository.ts";
import { dataDirectoryExists } from "@/database/index.ts";
import { loadAttemptEvents, loadAttempts } from "@/database/progress-repository.ts";
import { dataDirectory, displayPath } from "@/local-data/paths.ts";
import { ensureLocalData } from "@/local-data/setup.ts";
import { answerQuestion } from "@/practice/answer-question.ts";
import {
  emptyQueueMessage,
  questionsToReview,
  skipQuestion,
  takeNextQuestion,
  unansweredQuestions,
  type QuestionQueue,
} from "@/practice/question-queue.ts";
import { loadPreferences, type ResultDetail, type ReviewPreferences } from "@/preferences/index.ts";
import type { AnswerRecord, Attempt, AttemptEvent } from "@/progress/attempt.ts";
import type { Focus } from "@/questions/focus.ts";
import { defaultFocus } from "@/questions/focus.ts";
import { findQuestion, loadQuestionBank, questionBankStatus } from "@/questions/local-bank.ts";
import type { Question } from "@/questions/question.ts";
import { useTerminalSize } from "@/tui/hooks/use-terminal-size.ts";
import { DetailScreen } from "@/tui/screens/detail.tsx";
import { FocusScreen } from "@/tui/screens/focus.tsx";
import { HistoryScreen } from "@/tui/screens/history.tsx";
import { PracticeScreen } from "@/tui/screens/practice.tsx";
import { ResultScreen } from "@/tui/screens/result.tsx";
import { SetupScreen } from "@/tui/screens/setup.tsx";
import { SummaryScreen } from "@/tui/screens/summary.tsx";

type View = "setup" | "loading" | "focus" | "practice" | "result" | "history" | "summary" | "detail" | "error";

type StudyRecords = {
  attempts: ReadonlyMap<string, Attempt>;
  events: readonly AttemptEvent[];
  reviewPreferences: ReviewPreferences;
};

type SessionEntry = (records: StudyRecords) => {
  queue: QuestionQueue;
  destination: "focus" | "question";
  emptyNotice?: string;
};

const choosePracticeFocus: SessionEntry = () => ({
  queue: unansweredQuestions(),
  destination: "focus",
});

const beginReview: SessionEntry = ({ attempts, events, reviewPreferences }) => ({
  queue: questionsToReview(attempts.values(), events, reviewPreferences),
  destination: "question",
  emptyNotice: `No questions are ready. Review requires ${reviewPreferences.minimumDays} days and ${reviewPreferences.minimumAnswersAfter} later answers.`,
});

export function PracticeSession() {
  return <StudyShell enterSession={choosePracticeFocus} />;
}

export function ReviewSession() {
  return <StudyShell enterSession={beginReview} />;
}

function StudyShell({ enterSession }: { enterSession: SessionEntry }) {
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
  const [resultDetail, setResultDetail] = useState<ResultDetail>("standard");
  const [queue, setQueue] = useState<QuestionQueue>(() => unansweredQuestions());

  const showNextQuestion = useCallback(async (
    currentQueue = queue,
    currentAttempts = attempts,
    currentFocus = focus,
  ) => {
    setView("loading");
    try {
      const next = await takeNextQuestion(currentQueue, currentAttempts, currentFocus);
      setQueue(next.queue);
      if (!next.question) {
        setNotice(emptyQueueMessage(next.queue));
        setView("history");
        return;
      }
      setQuestion(next.question);
      setResult(undefined);
      setView("practice");
    } catch (cause) {
      setError(message(cause));
      setView("error");
    }
  }, [attempts, focus, queue]);

  const initialize = useCallback(async () => {
    setView("loading");
    try {
      await ensureLocalData();
      const currentAttempts = loadAttempts();
      const currentEvents = loadAttemptEvents();
      const currentFocus = loadFocus();
      const preferences = await loadPreferences();
      setResultDetail(preferences.display.resultDetail);
      await loadQuestionBank();
      const status = await questionBankStatus();
      setAttempts(currentAttempts);
      setFocus(currentFocus);
      setNotice(`${status.questions ?? 0} questions available offline.`);
      const entry = enterSession({
        attempts: currentAttempts,
        events: currentEvents,
        reviewPreferences: preferences.review,
      });
      setQueue(entry.queue);
      if (entry.destination === "question") {
        if (entry.queue.kind === "review" && !entry.queue.pendingIds.length) {
          setNotice(entry.emptyNotice ?? "No questions are ready for review.");
          setView("history");
          return;
        }
        const first = await takeNextQuestion(entry.queue, currentAttempts, currentFocus);
        setQueue(first.queue);
        if (first.question) {
          setQuestion(first.question);
          setView("practice");
        } else {
          setNotice(emptyQueueMessage(first.queue));
          setView("history");
        }
      } else {
        setView("focus");
      }
    } catch (cause) {
      setError(message(cause));
      setView("error");
    }
  }, [enterSession]);

  useEffect(() => {
    void dataDirectoryExists()
      .then((exists) => { if (exists) void initialize(); else setView("setup"); })
      .catch((cause) => { setError(message(cause)); setView("error"); });
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
      else void showNextQuestion(unansweredQuestions());
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
    setQueue(unansweredQuestions());
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
  if (view === "setup") {
    content = <SetupScreen location={displayPath(dataDirectory)} onAccept={() => void initialize()} onDecline={exit} />;
  } else if (view === "focus") {
    content = <FocusScreen focus={focus} notice={notice} onChange={updateFocus} onStart={() => void showNextQuestion(unansweredQuestions())} />;
  } else if (view === "practice" && question) {
    content = (
      <PracticeScreen
        key={question.id}
        question={question}
        onAnswer={(choice, duration) => void answer(choice, duration)}
        onSkip={() => void showNextQuestion(skipQuestion(queue, question.id))}
      />
    );
  } else if (view === "result" && question && result) {
    content = <ResultScreen question={question} result={result} resultDetail={resultDetail} onNext={() => void showNextQuestion()} />;
  } else if (view === "history") {
    content = <HistoryScreen attempts={attempts.values()} notice={notice} onOpen={(attempt) => void openAttempt(attempt)} />;
  } else if (view === "summary") {
    content = <SummaryScreen attempts={attempts.values()} />;
  } else if (view === "detail" && detail) {
    content = <DetailScreen question={detail.question} attempt={detail.attempt} onBack={() => setView("history")} />;
  } else if (view === "error") {
    content = (
      <Box flexDirection="column">
        <Text bold color="red">Something went wrong.</Text>
        <Text>{error}</Text>
        <Text color="gray">Press q to quit.</Text>
      </Box>
    );
  } else {
    content = <Spinner label="Loading local SAT data" />;
  }

  return <Box width={terminal.width} height={terminal.height}>{content}</Box>;
}

function message(value: unknown): string {
  return value instanceof Error ? value.message : String(value);
}
