"use client";

import { analyticsAttributes } from "@/lib/analytics/elements";
import { useEffect, useRef, useState } from "react";

import { usePublicAnalytics } from "@/app/analytics-provider";
import { getTelegramChannelUrl } from "@/lib/public-site-config";
import { ORANGE_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from "../public-home-content";
import {
  fetchQuizTeaserQuestion,
  QuizTeaserApiError,
  type QuizTeaserAnswer,
  type QuizTeaserQuestion,
} from "./quiz-teaser-api";
import { shuffleQuizAnswers } from "./quiz-teaser-answer-order";
import {
  CURATED_QUIZ_DAYS,
  CURATED_QUIZ_DAY_COUNT,
  getCuratedQuizQuestion,
  QUESTIONS_PER_QUIZ_DAY,
} from "./quiz-teaser-questions";
import {
  createEmptyQuizTeaserProgress,
  getLocalDateKey,
  isQuizCompletedToday,
  loadQuizTeaserProgress,
  QUIZ_TEASER_PROGRESS_STORAGE_KEY,
  saveQuizTeaserProgress,
  type ActiveQuizTeaserRound,
  type QuizTeaserProgress,
} from "./quiz-teaser-progress";

const SECTION_NAME = "quiz_teaser";
const UNAVAILABLE_MESSAGE = "Das Quiz ist gerade nicht verfügbar. Bitte versuche es später erneut.";
const QUOTA_MESSAGE =
  "Das Quiz-Limit für heute ist erreicht. Komm morgen wieder oder lerne im Telegram-Bot weiter.";

type Stage = "start" | "loading" | "question" | "result" | "error";

type Props = { trackedTelegramBotUrl: string };

function answerClass(answer: QuizTeaserAnswer, selectedId: string | null, correctId: string) {
  const base =
    "w-full rounded-2xl border px-4 py-3 text-left text-sm font-semibold leading-snug transition disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD166]";
  if (!selectedId) {
    return `${base} border-white/10 bg-white/[0.06] text-white hover:border-[#2AABEE]/60 hover:bg-[#2AABEE]/10`;
  }
  if (answer.id === correctId) {
    return `${base} border-[#4DE2C6]/60 bg-[#4DE2C6]/15 text-[#B9FFF2]`;
  }
  if (answer.id === selectedId) {
    return `${base} border-[#FFD166]/60 bg-[#FFD166]/10 text-[#FFE3A0]`;
  }
  return `${base} border-white/10 bg-white/[0.03] text-slate-400`;
}

function roundLabel(progress: QuizTeaserProgress) {
  return progress.completedCuratedDays < CURATED_QUIZ_DAY_COUNT
    ? `Tag ${progress.completedCuratedDays + 1} von ${CURATED_QUIZ_DAY_COUNT}`
    : "Neue Tagesrunde";
}

function withShuffledAnswers(question: QuizTeaserQuestion): QuizTeaserQuestion {
  return { ...question, answers: shuffleQuizAnswers(question.answers) };
}

function isSameProgress(left: QuizTeaserProgress, right: QuizTeaserProgress): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isCurrentApiQuestionRequest(
  progress: QuizTeaserProgress,
  requestedRound: ActiveQuizTeaserRound,
): boolean {
  const currentRound = progress.activeRound;
  return Boolean(
    currentRound &&
      currentRound.source === "api" &&
      currentRound.dayIndex === requestedRound.dayIndex &&
      currentRound.questionIndex === requestedRound.questionIndex &&
      currentRound.score === requestedRound.score &&
      currentRound.apiQuestion === undefined &&
      currentRound.answeredQuestionIds.length === requestedRound.answeredQuestionIds.length &&
      currentRound.answeredQuestionIds.every(
        (id, index) => id === requestedRound.answeredQuestionIds[index],
      ),
  );
}

export function PublicHomeQuizTeaserDailyWidget({ trackedTelegramBotUrl }: Props) {
  const { trackEvent } = usePublicAnalytics();
  const [stage, setStage] = useState<Stage>("start");
  const [progress, setProgress] = useState<QuizTeaserProgress>(createEmptyQuizTeaserProgress);
  const [question, setQuestion] = useState<QuizTeaserQuestion | null>(null);
  const [shownIndex, setShownIndex] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [finalExplanation, setFinalExplanation] = useState<string | null>(null);
  const [finalCorrectAnswer, setFinalCorrectAnswer] = useState<string | null>(null);
  const [finalWasCorrect, setFinalWasCorrect] = useState(false);
  const [hasFinalAnswerFeedback, setHasFinalAnswerFeedback] = useState(false);
  const [errorMessage, setErrorMessage] = useState(UNAVAILABLE_MESSAGE);
  const progressRef = useRef(progress);
  const lastSyncedDateRef = useRef(getLocalDateKey());

  useEffect(() => {
    let rolloverTimer: ReturnType<typeof setTimeout>;

    const reconcileSavedProgress = (saved: QuizTeaserProgress) => {
      const completedToday = isQuizCompletedToday(saved);
      progressRef.current = saved;
      setProgress(saved);
      setSelectedId(null);
      setFinalExplanation(null);
      setFinalCorrectAnswer(null);
      setFinalWasCorrect(false);
      setHasFinalAnswerFeedback(false);
      setErrorMessage(UNAVAILABLE_MESSAGE);

      if (completedToday) {
        setQuestion(null);
        setScore(saved.lastResult?.score ?? 0);
        setStage("result");
        return;
      }

      const round = saved.activeRound;
      if (!round) {
        setQuestion(null);
        setShownIndex(1);
        setScore(0);
        setStage("start");
        return;
      }

      const savedQuestion =
        round.source === "curated"
          ? getCuratedQuizQuestion(round.dayIndex, round.questionIndex)
          : round.apiQuestion;
      setScore(round.score);
      setShownIndex(round.questionIndex + 1);

      if (!savedQuestion) {
        setQuestion(null);
        setStage("start");
        return;
      }

      setQuestion(withShuffledAnswers(savedQuestion));
      setStage("question");
    };

    const syncProgressForCurrentDate = (isInitialLoad = false) => {
      const saved = loadQuizTeaserProgress();
      if (!saved) {
        return;
      }
      const currentDate = getLocalDateKey();
      const dateChanged = currentDate !== lastSyncedDateRef.current;
      lastSyncedDateRef.current = currentDate;
      if (!isInitialLoad) {
        if (!dateChanged && isSameProgress(saved, progressRef.current)) {
          return;
        }
        reconcileSavedProgress(saved);
        return;
      }

      const completedToday = isQuizCompletedToday(saved);
      progressRef.current = saved;
      setProgress(saved);
      setScore(saved.activeRound?.score ?? (completedToday ? saved.lastResult?.score ?? 0 : 0));
      setStage(completedToday ? "result" : "start");
    };

    const scheduleNextDateCheck = () => {
      const now = new Date();
      const nextLocalDay = new Date(now);
      nextLocalDay.setHours(24, 0, 0, 50);
      rolloverTimer = setTimeout(() => {
        syncProgressForCurrentDate();
        scheduleNextDateCheck();
      }, nextLocalDay.getTime() - now.getTime());
    };

    const syncWhenVisible = () => {
      if (document.visibilityState === "visible") {
        syncProgressForCurrentDate();
      }
    };
    const syncOnFocus = () => syncProgressForCurrentDate();
    const syncOnStorage = (event: StorageEvent) => {
      if (
        event.storageArea === window.localStorage &&
        (event.key === QUIZ_TEASER_PROGRESS_STORAGE_KEY || event.key === null)
      ) {
        syncProgressForCurrentDate();
      }
    };

    syncProgressForCurrentDate(true);
    scheduleNextDateCheck();
    window.addEventListener("focus", syncOnFocus);
    window.addEventListener("storage", syncOnStorage);
    document.addEventListener("visibilitychange", syncWhenVisible);

    return () => {
      clearTimeout(rolloverTimer);
      window.removeEventListener("focus", syncOnFocus);
      window.removeEventListener("storage", syncOnStorage);
      document.removeEventListener("visibilitychange", syncWhenVisible);
    };
  }, []);

  const commit = (next: QuizTeaserProgress) => {
    progressRef.current = next;
    setProgress(next);
    saveQuizTeaserProgress(next);
  };

  const fail = (error: unknown, _questionIndex: number) => {
    setErrorMessage(
      error instanceof QuizTeaserApiError && error.code === "quiz_teaser_quota_exceeded"
        ? QUOTA_MESSAGE
        : UNAVAILABLE_MESSAGE,
    );
    setStage("error");
    trackEvent("quiz_teaser_error", { section: SECTION_NAME, error_code: error instanceof TypeError ? "quiz_network_error" : error instanceof QuizTeaserApiError ? "quiz_server_error" : "quiz_invalid_response" });
  };

  const loadApiQuestion = async (round: ActiveQuizTeaserRound) => {
    setStage("loading");
    try {
      const loaded = await fetchQuizTeaserQuestion(round.answeredQuestionIds);
      const currentProgress = progressRef.current;
      if (!isCurrentApiQuestionRequest(currentProgress, round)) {
        return;
      }
      const activeRound = { ...round, apiQuestion: loaded };
      commit({ ...currentProgress, activeRound });
      setQuestion(withShuffledAnswers(loaded));
      setShownIndex(round.questionIndex + 1);
      setStage("question");
    } catch (error) {
      if (!isCurrentApiQuestionRequest(progressRef.current, round)) {
        return;
      }
      fail(error, round.questionIndex + 1);
    }
  };

  const showQuestion = (round: ActiveQuizTeaserRound) => {
    setSelectedId(null);
    setFinalExplanation(null);
    setHasFinalAnswerFeedback(false);
    setScore(round.score);
    setShownIndex(round.questionIndex + 1);

    if (round.source === "curated") {
      const loaded = getCuratedQuizQuestion(round.dayIndex, round.questionIndex);
      if (!loaded) {
        fail(new Error("Curated question missing"), round.questionIndex + 1);
        return;
      }
      setQuestion(withShuffledAnswers(loaded));
      setStage("question");
      return;
    }
    if (round.apiQuestion) {
      setQuestion(withShuffledAnswers(round.apiQuestion));
      setStage("question");
      return;
    }
    void loadApiQuestion(round);
  };

  const start = () => {
    if (isQuizCompletedToday(progress)) {
      setStage("result");
      return;
    }
    let round = progress.activeRound;
    let next = progress;
    if (!round) {
      const source =
        progress.completedCuratedDays < CURATED_QUIZ_DAY_COUNT ? "curated" : "api";
      round = {
        source,
        dayIndex:
          source === "curated"
            ? progress.completedCuratedDays
            : CURATED_QUIZ_DAY_COUNT + progress.completedBonusRounds,
        questionIndex: 0,
        score: 0,
        answeredQuestionIds: [],
      };
      next = { ...progress, activeRound: round };
      commit(next);
    }
    setErrorMessage(UNAVAILABLE_MESSAGE);
    trackEvent("quiz_teaser_started", {
      section: SECTION_NAME,
      question_index: round.questionIndex,
      day_number: round.dayIndex + 1,
      quiz_source: round.source,
    });
    showQuestion(round);
  };

  const select = (answer: QuizTeaserAnswer) => {
    const round = progress.activeRound;
    if (!question || !round || selectedId) return;

    const correct = answer.id === question.correctAnswerId;
    const nextScore = round.score + (correct ? 1 : 0);
    const answeredQuestionIds = [...round.answeredQuestionIds, question.id];
    setSelectedId(answer.id);
    setScore(nextScore);

    // Per-answer analytics is outside v1; game progress remains local.


    if (shownIndex === QUESTIONS_PER_QUIZ_DAY) {
      const completedCuratedDays =
        round.source === "curated"
          ? Math.min(CURATED_QUIZ_DAY_COUNT, progress.completedCuratedDays + 1)
          : progress.completedCuratedDays;
      const completedBonusRounds =
        round.source === "api"
          ? progress.completedBonusRounds + 1
          : progress.completedBonusRounds;
      const next: QuizTeaserProgress = {
        version: 1,
        completedCuratedDays,
        completedBonusRounds,
        activeRound: null,
        lastResult: {
          date: getLocalDateKey(),
          score: nextScore,
          source: round.source,
          dayNumber: round.dayIndex + 1,
        },
      };
      commit(next);
      setFinalWasCorrect(correct);
      setHasFinalAnswerFeedback(true);
      setFinalExplanation(question.explanation ?? null);
      setFinalCorrectAnswer(
        question.answers.find((candidate) => candidate.id === question.correctAnswerId)?.label ?? null,
      );
      setStage("result");
      trackEvent("quiz_teaser_completed", {
        section: SECTION_NAME,
        question_index: QUESTIONS_PER_QUIZ_DAY,
        score: nextScore,
        day_number: round.dayIndex + 1,
        quiz_source: round.source,
      });
      return;
    }

    const activeRound: ActiveQuizTeaserRound = {
      ...round,
      questionIndex: round.questionIndex + 1,
      score: nextScore,
      answeredQuestionIds,
      apiQuestion: undefined,
    };
    commit({ ...progress, activeRound });
  };

  const currentDay = CURATED_QUIZ_DAYS[progress.completedCuratedDays];
  const curatedFinished = progress.completedCuratedDays === CURATED_QUIZ_DAY_COUNT;
  const resultIsCurated = progress.lastResult?.source === "curated";

  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-[#07111f]/80 p-4 shadow-[0_18px_46px_rgba(0,0,0,0.24)] sm:rounded-3xl sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[#4DE2C6]">5-Fragen-Test</p>
        <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-slate-300">
          {stage === "question" || stage === "loading"
            ? `Frage ${shownIndex} von ${QUESTIONS_PER_QUIZ_DAY}`
            : stage === "result" ? "Heute geschafft" : roundLabel(progress)}
        </span>
      </div>

      {stage === "start" && (
        <div className="mt-6">
          <div className="flex gap-2" aria-label={`${progress.completedCuratedDays} von 5 Starttagen abgeschlossen`}>
            {CURATED_QUIZ_DAYS.map((day, index) => (
              <span key={day.day} aria-hidden="true" className={`h-1.5 flex-1 rounded-full ${index < progress.completedCuratedDays ? "bg-[#4DE2C6]" : "bg-white/10"}`} />
            ))}
          </div>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-[#FFD166]">{roundLabel(progress)}</p>
          <h3 className="mt-2 text-xl font-semibold leading-tight text-white sm:text-2xl">
            {currentDay?.title ?? "Deine neue Tagesrunde"}
          </h3>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            {currentDay?.description ?? "Fünf neue Fragen mit direktem Feedback und einem klaren Lernimpuls."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-[#4DE2C6]/10 px-3 py-1.5 text-[#B9FFF2]">
              {progress.completedCuratedDays < CURATED_QUIZ_DAY_COUNT ? "A1 → B2" : "A2"}
            </span>
            <span className="rounded-full bg-[#2AABEE]/10 px-3 py-1.5 text-[#9DDFFF]">ca. 3 Minuten</span>
            <span className="rounded-full bg-[#FFD166]/10 px-3 py-1.5 text-[#FFE3A0]">sofort erklärt</span>
          </div>
          <button type="button" onClick={start} className={`mt-6 w-full ${ORANGE_BUTTON_CLASS}`}>
            {progress.activeRound ? "Runde fortsetzen" : "Heutige Runde starten"}
          </button>
          <p className="mt-3 text-center text-xs leading-5 text-slate-500">Nach fünf Antworten ist die nächste Runde morgen verfügbar.</p>
        </div>
      )}

      {stage === "loading" && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5" aria-live="polite">
          <p className="text-sm font-semibold text-white">Deine Tagesfrage wird geladen...</p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full w-2/5 rounded-full bg-[#2AABEE]" /></div>
        </div>
      )}

      {stage === "question" && question && (
        <div className="mt-6">
          <div className="h-2 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
            <div className="h-full rounded-full bg-[#4DE2C6] transition-all" style={{ width: `${shownIndex * 20}%` }} />
          </div>
          <div className="mt-5 flex items-center gap-2">
            <span className="rounded-full border border-[#FFD166]/30 bg-[#FFD166]/10 px-2.5 py-1 text-xs font-bold text-[#FFE3A0]">{question.level ?? "Tagesmix"}</span>
            {question.topic && <span className="text-xs font-semibold text-slate-400">{question.topic}</span>}
          </div>
          <p className="mt-3 text-lg font-semibold leading-7 text-white">{question.prompt}</p>
          <div className="mt-5 grid gap-3">
            {question.answers.map((answer) => (
              <button key={answer.id} type="button" onClick={() => select(answer)} disabled={selectedId !== null} className={answerClass(answer, selectedId, question.correctAnswerId)} aria-pressed={selectedId === answer.id}>
                {answer.label}
              </button>
            ))}
          </div>
          {selectedId && (
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4" aria-live="polite">
              <p className={`text-sm font-semibold ${selectedId === question.correctAnswerId ? "text-[#B9FFF2]" : "text-[#FFE3A0]"}`}>
                {selectedId === question.correctAnswerId ? "Richtig – stark erkannt." : "Noch nicht. Die richtige Antwort ist grün markiert."}
              </p>
              {question.explanation && <p className="mt-2 text-sm leading-6 text-slate-300">{question.explanation}</p>}
              <button type="button" onClick={() => progress.activeRound && showQuestion(progress.activeRound)} className={`mt-4 w-full ${SECONDARY_BUTTON_CLASS}`}>Nächste Frage</button>
            </div>
          )}
        </div>
      )}

      {stage === "result" && (
        <div className="mt-6" aria-live="polite">
          {hasFinalAnswerFeedback && (
            <div className={`mb-4 rounded-2xl border p-4 ${finalWasCorrect ? "border-[#4DE2C6]/30 bg-[#4DE2C6]/10" : "border-[#FFD166]/30 bg-[#FFD166]/10"}`}>
              <p className={`text-sm font-semibold ${finalWasCorrect ? "text-[#B9FFF2]" : "text-[#FFE3A0]"}`}>{finalWasCorrect ? "Richtig – die Runde ist geschafft." : "Geschafft. Die richtige Antwort war grün markiert."}</p>
              {!finalWasCorrect && finalCorrectAnswer && (
                <p className="mt-2 text-sm font-semibold text-white">Richtige Antwort: {finalCorrectAnswer}</p>
              )}
              {finalExplanation && (
                <p className="mt-2 text-sm leading-6 text-slate-300">{finalExplanation}</p>
              )}
            </div>
          )}
          <div className="rounded-3xl border border-[#4DE2C6]/25 bg-[#4DE2C6]/10 p-5 text-center">
            <p className="text-sm font-semibold text-[#B9FFF2]">{resultIsCurated ? `Tag ${progress.lastResult?.dayNumber} geschafft` : "Tagesrunde geschafft"}</p>
            <p className="mt-2 text-4xl font-semibold text-white sm:text-5xl">{score}/{QUESTIONS_PER_QUIZ_DAY}</p>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              {curatedFinished ? "Dein 5-Tage-Start ist komplett. Ab morgen wartet eine neue Bonusrunde auf dich." : `Morgen geht es mit Tag ${progress.completedCuratedDays + 1} und fünf neuen Fragen weiter.`}
            </p>
          </div>
          <p className="mt-4 text-center text-xs font-medium text-slate-400">✓ Für heute gespeichert · nächste Runde morgen</p>
          <div className="mt-5 grid gap-3">
            <a {...analyticsAttributes("telegram_bot", "quiz_teaser", true)} href={trackedTelegramBotUrl} target="_blank" rel="noreferrer" onClick={() => trackEvent("quiz_teaser_cta_clicked", { section: SECTION_NAME, question_index: 5, score, destination: "telegram_bot" })} className={`w-full ${ORANGE_BUTTON_CLASS}`}>Im Telegram-Bot weiterüben</a>
            <a {...analyticsAttributes("telegram_channel", "quiz_teaser", true)} href={getTelegramChannelUrl()} target="_blank" rel="noreferrer" onClick={() => trackEvent("channel_cta_click", { section: SECTION_NAME, cta: "telegram_channel", score })} className={`w-full ${SECONDARY_BUTTON_CLASS}`}>Tägliche Lerntipps im Kanal</a>
          </div>
        </div>
      )}

      {stage === "error" && (
        <div className="mt-6 rounded-2xl border border-[#FFD166]/30 bg-[#FFD166]/10 p-5" role="status">
          <p className="text-sm font-semibold text-[#FFE3A0]">{errorMessage}</p>
          <button type="button" onClick={start} className={`mt-5 w-full ${SECONDARY_BUTTON_CLASS}`}>Noch einmal versuchen</button>
        </div>
      )}
    </div>
  );
}
