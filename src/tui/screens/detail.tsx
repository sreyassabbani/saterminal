import type { ResultDetail } from "@/preferences/index.ts";
import type { Attempt } from "@/progress/attempt.ts";
import type { Question } from "@/questions/question.ts";
import { AnswerReviewScreen } from "@/tui/screens/answer-review.tsx";

type DetailScreenProps = {
  question: Question;
  attempt: Attempt;
  resultDetail: ResultDetail;
  onBack: () => void;
};

export function DetailScreen({ question, attempt, resultDetail, onBack }: DetailScreenProps) {
  return (
    <AnswerReviewScreen
      title="question details"
      question={question}
      answer={attempt.answer}
      attempt={attempt}
      resultDetail={resultDetail}
      action={{ kind: "back", run: onBack }}
    />
  );
}
