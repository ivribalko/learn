import { CheckCircle2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { answerExamQuestion, fetchExam, type ExamQuestion, type ExamState } from "./api";
import "./ExamQuestions.css";

type ExamQuestionsProps = {
  courseId: string;
  lessonId: string;
  onAnsweredCountChange: (count: number) => void;
  onCompletionChange: (complete: boolean) => void;
  onError: (message: string) => void;
};

/** Renders server-persisted term questions and immediate answer feedback. */
export default function ExamQuestions({
  courseId,
  lessonId,
  onAnsweredCountChange,
  onCompletionChange,
  onError
}: ExamQuestionsProps) {
  const [exam, setExam] = useState<ExamState | null>(null);
  const [submittingQuestionId, setSubmittingQuestionId] = useState("");

  useEffect(() => {
    let active = true;
    void fetchExam(courseId, lessonId)
      .then((state) => {
        if (active) {
          setExam(state);
          onAnsweredCountChange(state.answeredCount);
          onCompletionChange(state.correctCount === state.questions.length);
        }
      })
      .catch((error) => {
        if (active) {
          onError(error instanceof Error ? error.message : "Unable to load the exam questions.");
        }
      });
    return () => {
      active = false;
    };
  }, [courseId, lessonId, onAnsweredCountChange, onCompletionChange, onError]);

  async function selectAnswer(questionId: string, optionId: string) {
    if (!exam || submittingQuestionId) {
      return;
    }
    setSubmittingQuestionId(questionId);
    try {
      const answeredQuestion = await answerExamQuestion(courseId, lessonId, questionId, optionId);
      const questions = exam.questions.map((question) =>
        question.id === answeredQuestion.id ? answeredQuestion : question
      );
      const nextExam = summarizeExam(exam, questions);
      setExam(nextExam);
      onAnsweredCountChange(nextExam.answeredCount);
      onCompletionChange(nextExam.correctCount === nextExam.questions.length);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unable to save the exam answer.");
    } finally {
      setSubmittingQuestionId("");
    }
  }

  if (!exam) {
    return <section className="exam-panel"><p>Loading exam…</p></section>;
  }

  return (
    <section className="exam-panel">
      <div className="exam-questions">
        {exam.questions.map((question, index) => (
          <ExamQuestionCard
            index={index}
            key={question.id}
            onSelect={(optionId) => void selectAnswer(question.id, optionId)}
            question={question}
            submitting={submittingQuestionId === question.id}
          />
        ))}
      </div>
    </section>
  );
}

/** Displays one exam question with four answer controls and persisted feedback. */
function ExamQuestionCard({
  index,
  onSelect,
  question,
  submitting
}: {
  index: number;
  onSelect: (optionId: string) => void;
  question: ExamQuestion;
  submitting: boolean;
}) {
  const answered = question.selectedOptionId !== null;
  return (
    <article className="exam-question">
      <h3>
        {question.correct === true ? (
          <CheckCircle2 className="passed-status" size={14} />
        ) : question.correct === false ? (
          <span className="failed-status"><X size={10} /></span>
        ) : (
          <span className="incomplete-status" />
        )}
        <span>{index + 1}. {question.prompt}</span>
      </h3>
      <div className="exam-options">
        {question.options.map((option) => {
          const selected = option.id === question.selectedOptionId;
          const correct = option.id === question.correctOptionId;
          const resultClass = correct ? "correct" : selected ? "incorrect" : "";
          return (
            <button
              className={`control-button exam-option ${selected ? "selected" : ""} ${resultClass}`}
              disabled={answered || submitting}
              key={option.id}
              onClick={() => onSelect(option.id)}
              type="button"
            >
              {correct ? (
                <CheckCircle2 className="passed-status" size={14} />
              ) : selected ? (
                <span className="failed-status"><X size={10} /></span>
              ) : (
                <span className="incomplete-status" />
              )}
              <span>{option.text}</span>
            </button>
          );
        })}
      </div>
    </article>
  );
}

function summarizeExam(exam: ExamState, questions: ExamQuestion[]): ExamState {
  return {
    ...exam,
    answeredCount: questions.filter((question) => question.selectedOptionId !== null).length,
    correctCount: questions.filter((question) => question.correct === true).length,
    questions
  };
}
