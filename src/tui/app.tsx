import { Spinner } from "@inkjs/ui";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
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
import { weakPracticeFocus } from "@/practice/weak-focus.ts";
import { defaultPreferences, loadPreferences, savePreferences, type Preferences, type ReviewPreferences } from "@/preferences/index.ts";
import { activity } from "@/progress/activity.ts";
import type { AnswerRecord, Attempt, AttemptEvent } from "@/progress/attempt.ts";
import { progressStatistics } from "@/progress/statistics.ts";
import type { Focus } from "@/questions/focus.ts";
import { defaultFocus } from "@/questions/focus.ts";
import { findQuestion, loadQuestionBank } from "@/questions/local-bank.ts";
import type { Question } from "@/questions/question.ts";
import { useTerminalSize } from "@/tui/hooks/use-terminal-size.ts";
import { DetailScreen } from "@/tui/screens/detail.tsx";
import { FocusScreen } from "@/tui/screens/focus.tsx";
import { HistoryScreen } from "@/tui/screens/history.tsx";
import { HomeScreen, type HomeDestination } from "@/tui/screens/home.tsx";
import { PracticeScreen } from "@/tui/screens/practice.tsx";
import { PreferencesScreen } from "@/tui/screens/preferences.tsx";
import { ResultScreen } from "@/tui/screens/result.tsx";
import { SetupScreen } from "@/tui/screens/setup.tsx";
import { SummaryScreen } from "@/tui/screens/summary.tsx";

type View = "setup" | "loading" | "home" | "focus" | "preferences" | "practice" | "result" | "history" | "summary" | "detail" | "error";

type StudyRecords = {
  attempts: ReadonlyMap<string, Attempt>;
  events: readonly AttemptEvent[];
  reviewPreferences: ReviewPreferences;
};

type SessionEntry = (records: StudyRecords) => {
  queue: QuestionQueue;
  destination: "home" | "question";
  emptyNotice?: string;
};

const openStudyHome: SessionEntry = () => ({
  queue: unansweredQuestions(),
  destination: "home",
});

const beginReview: SessionEntry = ({ attempts, events, reviewPreferences }) => ({
  queue: questionsToReview(attempts.values(), events, reviewPreferences),
  destination: "question",
  emptyNotice: `No questions are ready. Review requires ${reviewPreferences.minimumDays} days and ${reviewPreferences.minimumAnswersAfter} later answers.`,
});

export function PracticeSession() {
  return <StudyShell enterSession={openStudyHome} />;
}

export function ReviewSession() {
  return <StudyShell enterSession={beginReview} />;
}

function StudyShell({ enterSession }: { enterSession: SessionEntry }) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const terminal = useTerminalSize();
  const [terminalReady, setTerminalReady] = useState(!stdout.isTTY);
  const [view, setView] = useState<View>("loading");
  const [focus, setFocus] = useState<Focus>(defaultFocus);
  const [attempts, setAttempts] = useState<Map<string, Attempt>>(() => new Map());
  const [events, setEvents] = useState<AttemptEvent[]>([]);
  const [preferences, setPreferences] = useState<Preferences>(() => structuredClone(defaultPreferences));
  const [bankSize, setBankSize] = useState(0);
  const [question, setQuestion] = useState<Question>();
  const [detail, setDetail] = useState<{ question: Question; attempt: Attempt }>();
  const [result, setResult] = useState<AnswerRecord>();
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
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
        setView("home");
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
      const currentPreferences = await loadPreferences();
      const bank = await loadQuestionBank();
      setAttempts(currentAttempts);
      setEvents(currentEvents);
      setFocus(currentFocus);
      setPreferences(currentPreferences);
      setBankSize(bank.questions.length);
      const entry = enterSession({
        attempts: currentAttempts,
        events: currentEvents,
        reviewPreferences: currentPreferences.review,
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
        setView("home");
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

  useLayoutEffect(() => {
    if (!stdout.isTTY) return;
    stdout.write("\x1b[?1049h\x1b[?25l");
    setTerminalReady(true);
    return () => { stdout.write("\x1b[?25h\x1b[?1049l"); };
  }, [stdout]);

  useInput((input) => {
    if (input === "q") exit();
    else if (input === "m" && view !== "setup") setView("home");
    else if (view !== "setup" && view !== "home" && view !== "preferences" && input === "f") setView("focus");
    else if (view !== "setup" && view !== "home" && view !== "preferences" && input === "h") setView("history");
    else if (view !== "setup" && view !== "home" && view !== "preferences" && input === "s") setView("summary");
    else if (view !== "setup" && view !== "home" && view !== "preferences" && input === "p") {
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
      setEvents((current) => [...current, answerResult.event]);
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

  const updatePreferences = async (next: Preferences) => {
    setView("loading");
    try {
      await savePreferences(next);
      setPreferences(next);
      setNotice("Preferences saved.");
      setView("home");
    } catch (cause) {
      setError(message(cause));
      setView("error");
    }
  };

  const openHomeDestination = async (destination: HomeDestination) => {
    setNotice(undefined);
    if (destination === "focus") setView("focus");
    else if (destination === "preferences") setView("preferences");
    else if (destination === "stats") setView("summary");
    else if (destination === "history") setView("history");
    else if (destination === "practice") await showNextQuestion(unansweredQuestions());
    else if (destination === "review") {
      const reviewQueue = questionsToReview(attempts.values(), events, preferences.review);
      if (reviewQueue.kind === "review" && !reviewQueue.pendingIds.length) {
        setNotice("No missed questions are eligible for review yet.");
        setView("home");
      } else {
        await showNextQuestion(reviewQueue);
      }
    } else {
      const weakFocus = weakPracticeFocus(attempts.values(), focus);
      if (!weakFocus) {
        setNotice("Answer a few questions first; no weak skills are known yet.");
        setView("home");
      } else {
        await showNextQuestion(unansweredQuestions(), attempts, weakFocus);
      }
    }
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
  } else if (view === "home") {
    const stats = progressStatistics(attempts.values());
    const currentActivity = activity(events);
    const reviewQueue = questionsToReview(attempts.values(), events, preferences.review);
    const weakFocus = weakPracticeFocus(attempts.values(), focus);
    content = (
      <HomeScreen
        stats={stats}
        activity={currentActivity}
        focus={focus}
        preferences={preferences}
        bankSize={bankSize}
        reviewEligible={reviewQueue.kind === "review" ? reviewQueue.pendingIds.length : 0}
        weakSkillCount={weakFocus?.skills.length ?? 0}
        notice={notice}
        onOpen={(destination) => void openHomeDestination(destination)}
      />
    );
  } else if (view === "focus") {
    content = <FocusScreen focus={focus} notice={notice} onChange={updateFocus} onStart={() => void showNextQuestion(unansweredQuestions())} />;
  } else if (view === "preferences") {
    content = <PreferencesScreen preferences={preferences} onSave={(next) => void updatePreferences(next)} onBack={() => setView("home")} />;
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
    content = <ResultScreen question={question} result={result} resultDetail={preferences.display.resultDetail} onNext={() => void showNextQuestion()} />;
  } else if (view === "history") {
    content = <HistoryScreen attempts={[...attempts.values()]} notice={notice} onOpen={(attempt) => void openAttempt(attempt)} />;
  } else if (view === "summary") {
    content = <SummaryScreen attempts={attempts.values()} events={events} />;
  } else if (view === "detail" && detail) {
    content = (
      <DetailScreen
        question={detail.question}
        attempt={detail.attempt}
        resultDetail={preferences.display.resultDetail}
        onBack={() => setView("history")}
      />
    );
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

  if (!terminalReady) return null;
  return <Box width={terminal.width} height={terminal.height}>{content}</Box>;
}

function message(value: unknown): string {
  return value instanceof Error ? value.message : String(value);
}
