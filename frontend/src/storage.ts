export type CourseProgress = {
  activeLessonId: string;
  completedLessonIds: string[];
};

type ProgressState = {
  courses: Record<string, CourseProgress>;
};

const storageKey = "learn-progress-v1";

const defaultProgress: ProgressState = {
  courses: {}
};

export function readProgress(): ProgressState {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw) return normalizeProgress(JSON.parse(raw) as ProgressState);
    return defaultProgress;
  } catch {
    return defaultProgress;
  }
}

export function readCourseProgress(courseId: string, firstLessonId: string): CourseProgress {
  return readProgress().courses[courseId] ?? { activeLessonId: firstLessonId, completedLessonIds: [] };
}

export function markLessonComplete(courseId: string, lessonId: string): CourseProgress {
  const progress = readProgress();
  const course = progress.courses[courseId] ?? { activeLessonId: lessonId, completedLessonIds: [] };
  const completedLessonIds = course.completedLessonIds.includes(lessonId)
    ? course.completedLessonIds
    : [...course.completedLessonIds, lessonId];
  const nextCourse = { activeLessonId: lessonId, completedLessonIds };
  writeProgress({ ...progress, courses: { ...progress.courses, [courseId]: nextCourse } });
  return nextCourse;
}

export function restartLessonProgress(courseId: string, lessonId: string): CourseProgress {
  const progress = readProgress();
  const course = progress.courses[courseId] ?? { activeLessonId: lessonId, completedLessonIds: [] };
  const nextCourse = {
    activeLessonId: lessonId,
    completedLessonIds: course.completedLessonIds.filter((completedLessonId) => completedLessonId !== lessonId)
  };
  writeProgress({ ...progress, courses: { ...progress.courses, [courseId]: nextCourse } });
  return nextCourse;
}

export function setActiveLesson(courseId: string, lessonId: string): CourseProgress {
  const progress = readProgress();
  const course = progress.courses[courseId] ?? { activeLessonId: lessonId, completedLessonIds: [] };
  const nextCourse = { ...course, activeLessonId: lessonId };
  writeProgress({ ...progress, courses: { ...progress.courses, [courseId]: nextCourse } });
  return nextCourse;
}

function writeProgress(progress: ProgressState): void {
  window.localStorage.setItem(storageKey, JSON.stringify(progress));
}

function normalizeProgress(value: ProgressState): ProgressState {
  return {
    courses: value.courses && typeof value.courses === "object" ? value.courses : {}
  };
}
