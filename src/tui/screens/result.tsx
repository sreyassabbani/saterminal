import type { ResultDetail } from "@/preferences/index.ts";
import type { AnswerRecord } from "@/progress/attempt.ts";
import type { Question } from "@/questions/question.ts";
import { AnswerReviewScreen } from "@/tui/screens/answer-review.tsx";

type ResultScreenProps = {
  question: Question;
  result: AnswerRecord;
  resultDetail: ResultDetail;
  onNext: () => void;
};

export function ResultScreen({ question, result, resultDetail, onNext }: ResultScreenProps) {
  return (
    <AnswerReviewScreen
      title="answer"
      question={question}
      answer={result.answer}
      attempt={result.attempt}
      resultDetail={resultDetail}
      action={{ kind: "next", run: onNext }}
    />
  );
}
