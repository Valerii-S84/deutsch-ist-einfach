export type StatsPayload = {
  users: number;
  quizzes: number;
};

export type StatsState = {
  users: number | null;
  quizzes: number | null;
  isUnavailable: boolean;
};

export type ActiveWizard = "student" | "partner" | null;
