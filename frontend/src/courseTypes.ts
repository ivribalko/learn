export type CourseSummary = {
  completedLessonCount: number;
  id: string;
  title: string;
  lessonCount: number;
};

export type CourseProgress = {
  completedLessonIds: string[];
};

export type AssetPresentation = {
  label: string;
  shortLabel: string;
  icon: "book-open" | "database";
  previewKind: "csv" | "text";
};

export type CourseChapter = {
  id: string;
  title: string;
  lessonIds: string[];
};

export type Lesson = {
  id: string;
  route: string;
  slug: string;
  title: string;
  runtime: string;
  language: "cpp" | "python";
  concept: string[];
  math: string[];
  exercise: string;
  checkpoints: string[];
  exam: boolean;
};

export type GlossaryEntry = {
  terms: string[];
  label: string;
  definition: string;
  externalUrl?: string;
};

export type Course = {
  id: string;
  title: string;
  asset: AssetPresentation;
  chapters: CourseChapter[];
  lessons: Lesson[];
  glossary: GlossaryEntry[];
  progress: CourseProgress;
};
