import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsLeft,
  ChevronsRight,
  Code2,
  Database,
  ExternalLink,
  LayoutGrid,
  LoaderCircle,
  Menu,
  Play,
  Trash2,
  X
} from "lucide-react";
import type { CSSProperties, MutableRefObject, ReactNode } from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { IconButton, WorkspaceWidthButton } from "./Controls";
import {
  fetchCourse,
  fetchCourses,
  fetchAssetFile,
  fetchAssetState,
  fetchLessonFile,
  fetchLessonFileState,
  fetchLessonOutput,
  fetchCourseProgress,
  resetAsset,
  resetLessonFile,
  runLessonFile,
  saveLessonFile,
  type AssetFileResponse,
  type AssetState,
  type LessonFileState,
  type RunResult
} from "./api";
import OpenAIHelpChat from "./OpenAIHelpChat";
import ExamQuestions from "./ExamQuestions";
import { findGlossaryMatch, type GlossaryMatch } from "./glossary";
import type { Course, CourseSummary, GlossaryEntry, Lesson } from "./courseTypes";
import { colorizeCode } from "./codeColorizer";
import { usePageScrollLock } from "./pageScrollLock";
import { getScrollFadeClass } from "./scrollFades";

type Status = "idle" | "loading" | "running" | "error";
type EditorPanelView = "code" | "asset";
type WorkspacePanelView = "split" | "editor" | "output";
type TooltipPosition = { arrowLeft: number; left: number; top: number; placement: "above" | "below" };
type TooltipStyle = CSSProperties & { "--tooltip-arrow-left"?: string };

const ASSET_INITIAL_ROW_COUNT = 5;
const ASSET_ROWS_PER_PAGE = 50;
const TOOLTIP_OPEN_EVENT = "learn-tooltip-open";

/** Main app view that owns top-level routing and lesson progress. */
export default function App() {
  const location = useLocation();
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [coursesLoaded, setCoursesLoaded] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (location.pathname !== "/") return;
    setCoursesLoaded(false);
    setMessage("");
    void fetchCourses()
      .then(setCourses)
      .catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load courses."))
      .finally(() => setCoursesLoaded(true));
  }, [location.pathname]);

  return (
    <Routes>
      <Route path="/" element={<CourseSelection courses={courses} loaded={coursesLoaded} message={message} />} />
      <Route path="/courses/:courseId" element={<CourseRoute />} />
      <Route path="/courses/:courseId/lessons/:lessonRoute" element={<CourseRoute />} />
      <Route path="/courses/:courseId/lessons/:lessonRoute/chat" element={<CourseRoute chatOpen />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

/** Course picker that uses the same navigation language as the lesson overview. */
function CourseSelection({ courses, loaded, message }: { courses: CourseSummary[]; loaded: boolean; message: string }) {
  return (
    <main className="shell course-selection-shell">
      <section className="lesson-page course-selection-page">
        <header className="lesson-hero">
          <div className="hero-title"><h1>Learn</h1></div>
        </header>
        <nav className="lesson-nav course-selection-nav">
          {!loaded && !message ? <p>Loading courses…</p> : null}
          {loaded && courses.length === 0 && !message ? <p>No courses installed.</p> : null}
          {courses.map((course) => {
            return (
              <Link className="lesson-link course-link" key={course.id} to={`/courses/${course.id}`}>
                <span className="course-link-copy">
                  <span>{course.completedLessonCount}/{course.lessonCount}</span>
                  <strong>{course.title}</strong>
                </span>
                <ChevronRight size={18} />
              </Link>
            );
          })}
        </nav>
        {message ? <div className="error-toast">{message}</div> : null}
      </section>
    </main>
  );
}

/** Loads one course and resolves its requested or next unfinished lesson route. */
function CourseRoute({ chatOpen = false }: { chatOpen?: boolean }) {
  const { courseId = "", lessonRoute } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [message, setMessage] = useState("");
  const [completedLessonIds, setCompletedLessonIds] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    setCourse(null);
    void fetchCourse(courseId)
      .then((loadedCourse) => {
        if (!active) return;
        setCourse(loadedCourse);
        setCompletedLessonIds(loadedCourse.progress.completedLessonIds);
      })
      .catch((error) => {
        if (active) setMessage(error instanceof Error ? error.message : "Unable to load the course.");
      });
    return () => { active = false; };
  }, [courseId]);

  if (message) return <Navigate to="/" replace />;
  if (!course) return <main className="shell"><section className="lesson-page"><p>Loading course…</p></section></main>;

  const lesson = lessonRoute
    ? course.lessons.find((item) => item.route === lessonRoute)
    : course.lessons.find((item) => !course.progress.completedLessonIds.includes(item.id))
      ?? course.lessons.at(-1);

  if (!lesson) {
    return <Navigate to={course.lessons[0].slug} replace />;
  }

  if (!lessonRoute) return <Navigate to={lesson.slug} replace />;

  const openChat = () => navigate(`${lesson.slug}/chat`, { state: { openedFromLesson: true } });
  const closeChat = () => {
    const routeState = location.state as { openedFromLesson?: boolean } | null;
    if (routeState?.openedFromLesson) {
      navigate(-1);
      return;
    }
    navigate(lesson.slug, { replace: true });
  };

  return (
    <>
      <LessonPage
        completedLessonIds={completedLessonIds}
        course={course}
        lesson={lesson}
        onComplete={setCompletedLessonIds}
      />
      <OpenAIHelpChat
        courseId={course.id}
        isOpen={chatOpen}
        key={course.id}
        lessonId={lesson.id}
        onClose={closeChat}
        onOpen={openChat}
      />
    </>
  );
}

/** Shared lesson-header control that renders identical link and button actions. */
function LessonIconAction({
  children,
  className = "",
  disabled = false,
  onClick,
  to
}: {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  to?: string;
}) {
  const classes = `control-button icon-button${className ? ` ${className}` : ""}`;
  return to ? (
    <Link className={classes} to={to}>{children}</Link>
  ) : (
    <IconButton className={className} disabled={disabled} onClick={onClick}>
      {children}
    </IconButton>
  );
}

/** Lesson page view that renders one concept, one saved file, and one output panel. */
function LessonPage({
  completedLessonIds,
  course,
  lesson,
  onComplete
}: {
  completedLessonIds: string[];
  course: Course;
  lesson: Lesson;
  onComplete: (completedLessonIds: string[]) => void;
}) {
  const [fileContent, setFileContent] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [assetInfo, setAssetInfo] = useState<AssetState | null>(null);
  const [assetFile, setAssetFile] = useState<AssetFileResponse | null>(null);
  const [editorPanelView, setEditorPanelView] = useState<EditorPanelView>("code");
  const [workspacePanelView, setWorkspacePanelView] = useState<WorkspacePanelView>("split");
  const [hasLessonFile, setHasLessonFile] = useState(false);
  const [hasSavedOutput, setHasSavedOutput] = useState(false);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isPageScrollable, setIsPageScrollable] = useState(false);
  const [examAnsweredCount, setExamAnsweredCount] = useState(0);
  const [examResetVersion, setExamResetVersion] = useState(0);
  const bottomNavigationRef = useRef<HTMLElement | null>(null);
  const fileStateRef = useRef<LessonFileState | null>(null);
  const codePanelRef = useRef<HTMLElement | null>(null);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const assetLoadRequestRef = useRef(0);
  const lessonLoadRequestRef = useRef(0);
  const outputLoadRequestRef = useRef(0);
  const pollingRef = useRef(false);
  const saveVersionRef = useRef(0);
  const savingRef = useRef(false);

  usePageScrollLock(isNavOpen);

  const currentIndex = useMemo(() => course.lessons.findIndex((item) => item.id === lesson.id), [course, lesson]);
  const previousLesson = currentIndex > 0 ? course.lessons[currentIndex - 1] : undefined;
  const nextLesson = currentIndex >= 0 && currentIndex < course.lessons.length - 1 ? course.lessons[currentIndex + 1] : undefined;
  const isComplete = lesson ? completedLessonIds.includes(lesson.id) : false;
  const canRestartLesson = hasLessonFile || Boolean(assetInfo?.exists) || hasSavedOutput || isComplete || examAnsweredCount > 0;
  const displayedFileContent = getDisplayedFileContent(fileContent);
  const codeEditorRows = countSourceLines(displayedFileContent);

  useLayoutEffect(() => {
    window.scrollTo({ top: 0 });
  }, [lesson.id]);

  useLayoutEffect(() => {
    const codePanel = codePanelRef.current;

    if (!codePanel) {
      return;
    }

    const recordPanelOffset = () => {
      codePanel.style.setProperty("--workspace-panel-top", `${codePanel.getBoundingClientRect().top}px`);
    };

    recordPanelOffset();
    window.addEventListener("orientationchange", recordPanelOffset);

    return () => window.removeEventListener("orientationchange", recordPanelOffset);
  }, [lesson.id]);

  useLayoutEffect(() => {
    let frame = 0;
    const updatePageScrollable = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const bottomNavigationHeight = bottomNavigationRef.current?.offsetHeight ?? 0;
        const contentHeight = document.documentElement.scrollHeight - bottomNavigationHeight;
        setIsPageScrollable(contentHeight > window.innerHeight + 1);
      });
    };

    const observer = new ResizeObserver(updatePageScrollable);
    observer.observe(document.documentElement);
    observer.observe(document.body);
    window.addEventListener("resize", updatePageScrollable);
    updatePageScrollable();

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", updatePageScrollable);
    };
  }, [lesson.id]);

  const reloadLessonFile = useCallback(async () => {
    const requestId = lessonLoadRequestRef.current + 1;
    lessonLoadRequestRef.current = requestId;
    await loadFile(course.id, lesson, setFileContent, setHasLessonFile, fileStateRef, setStatus, setMessage, () => {
      return lessonLoadRequestRef.current === requestId;
    });
  }, [course.id, lesson]);

  const reloadLessonOutput = useCallback(async () => {
    const requestId = outputLoadRequestRef.current + 1;
    outputLoadRequestRef.current = requestId;
    await loadOutput(course.id, lesson, setRunResult, setHasSavedOutput, setMessage, () => {
      return outputLoadRequestRef.current === requestId;
    });
  }, [course.id, lesson]);

  useEffect(() => {
    assetLoadRequestRef.current += 1;
    setExamAnsweredCount(0);
    setMessage("");
    setAssetFile(null);
    setEditorPanelView("code");
    void reloadLessonFile();
    void reloadLessonOutput();
    void loadAssetState(course.id, lesson.id, setAssetInfo, setMessage);
  }, [course.id, lesson, reloadLessonFile, reloadLessonOutput]);

  useEffect(() => {
    if (!isNavOpen) {
      return undefined;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsNavOpen(false);
      }
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isNavOpen]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible" || status === "running" || pollingRef.current || savingRef.current) {
        return;
      }

      pollingRef.current = true;
      void pollLessonFileState(course.id, lesson.id, fileStateRef, reloadLessonFile, setMessage).finally(() => {
        pollingRef.current = false;
      });
    }, 300);

    return () => window.clearInterval(timer);
  }, [course.id, lesson.id, reloadLessonFile, status]);

  useEffect(() => {
    if (!message) {
      return undefined;
    }

    const timer = window.setTimeout(() => setMessage(""), 5200);
    return () => window.clearTimeout(timer);
  }, [message]);

  async function handleCodeChange(content: string) {
    const saveVersion = saveVersionRef.current + 1;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    saveVersionRef.current = saveVersion;
    savingRef.current = true;
    setFileContent(content);
    setMessage("");
    try {
      await saveLessonFile(course.id, lesson.id, content);
      const nextFileState = await fetchLessonFileState(course.id, lesson.id);
      if (saveVersionRef.current === saveVersion) {
        fileStateRef.current = nextFileState;
        setHasLessonFile(true);
        savingRef.current = false;
        window.requestAnimationFrame(() => window.scrollTo(scrollX, scrollY));
      }
    } catch (error) {
      if (saveVersionRef.current === saveVersion) {
        savingRef.current = false;
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Unable to save lesson file.");
      }
    }
  }

  async function handleActivateBrowserEditor() {
    if ((status === "loading" && !fileContent) || savingRef.current) {
      return;
    }

    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    setStatus("loading");
    setMessage("");
    savingRef.current = true;
    try {
      const response = await saveLessonFile(course.id, lesson.id, fileContent);
      setFileContent(response.content);
      setHasLessonFile(true);
      const nextFileState = await fetchLessonFileState(course.id, lesson.id);
      fileStateRef.current = nextFileState;
      savingRef.current = false;
      setStatus("idle");
      window.requestAnimationFrame(() => window.scrollTo(scrollX, scrollY));
    } catch (error) {
      savingRef.current = false;
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to create lesson file.");
    }
  }

  async function handleRun() {
    setStatus("running");
    setMessage("");
    setRunResult(null);
    try {
      const result = await runLessonFile(course.id, lesson.id);
      const [lessonFileResponse, nextFileState] = await Promise.all([
        fetchLessonFile(course.id, lesson.id),
        fetchLessonFileState(course.id, lesson.id)
      ]);
      setFileContent(lessonFileResponse.content);
      setHasLessonFile(lessonFileResponse.exists);
      fileStateRef.current = nextFileState;
      void loadAssetState(course.id, lesson.id, setAssetInfo, setMessage);
      if (editorPanelView === "asset") {
        void fetchAssetFile(course.id, lesson.id).then(setAssetFile).catch(() => undefined);
      }
      setRunResult(result);
      setHasSavedOutput(true);
      setStatus("idle");
      const progress = await fetchCourseProgress(course.id);
      onComplete(progress.completedLessonIds);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to run lesson.");
    }
  }

  async function handleRestartLesson() {
    setStatus("loading");
    setMessage("");
    setRunResult(null);
    try {
      const [assetResponse, lessonFileResponse] = await Promise.all([
        resetAsset(course.id, lesson.id),
        resetLessonFile(course.id, lesson.id)
      ]);
      setAssetInfo(assetResponse);
      setAssetFile(null);
      setEditorPanelView("code");
      setFileContent(lessonFileResponse.content);
      setHasLessonFile(lessonFileResponse.exists);
      setHasSavedOutput(false);
      const nextFileState = await fetchLessonFileState(course.id, lesson.id);
      fileStateRef.current = nextFileState;
      const progress = await fetchCourseProgress(course.id);
      onComplete(progress.completedLessonIds);
      setExamAnsweredCount(0);
      setExamResetVersion((version) => version + 1);
      setStatus("idle");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to restart lesson.");
    }
  }

  async function handleToggleEditorPanel() {
    if (editorPanelView === "asset") {
      setEditorPanelView("code");
      return;
    }

    setEditorPanelView("asset");
    if (assetFile) {
      return;
    }

    const requestId = assetLoadRequestRef.current + 1;
    assetLoadRequestRef.current = requestId;
    setStatus("loading");
    setMessage("");
    try {
      const response = await fetchAssetFile(course.id, lesson.id);
      if (assetLoadRequestRef.current !== requestId) {
        return;
      }
      setAssetFile(response);
      setAssetInfo({ exists: true });
      setStatus("idle");
    } catch (error) {
      if (assetLoadRequestRef.current !== requestId) {
        return;
      }
      setStatus("error");
      setMessage(error instanceof Error ? error.message : `Unable to load ${course.asset.label.toLowerCase()}.`);
    }
  }

  const editorActions = (
    <>
      <button
        className="control-button pill-button workspace-action-button"
        disabled={status === "running" || (status === "loading" && editorPanelView === "asset")}
        onClick={() => void handleToggleEditorPanel()}
        type="button"
      >
        {editorPanelView === "asset" ? (
          <Code2 size={16} />
        ) : course.asset.icon === "database" ? (
          <Database size={16} />
        ) : (
          <BookOpen size={16} />
        )}
        {editorPanelView === "asset" ? "Code" : course.asset.shortLabel}
      </button>
      <WorkspaceWidthButton
        active={workspacePanelView === "editor"}
        onClick={() => setWorkspacePanelView((view) => view === "editor" ? "split" : "editor")}
      >
        {workspacePanelView === "editor" ? <ChevronsLeft size={16} /> : <ChevronsRight size={16} />}
      </WorkspaceWidthButton>
    </>
  );

  return (
    <main className={`shell ${isNavOpen ? "nav-open" : ""}`}>
      <section className="lesson-page">
        <header className="lesson-hero">
          <div className="hero-controls">
            <div className="lesson-menu">
              <LessonIconAction
                onClick={() => setIsNavOpen((open) => !open)}
              >
                {isNavOpen ? <X size={18} /> : <Menu size={18} />}
              </LessonIconAction>
              <aside className="lesson-menu-panel lesson-page">
                <header className="lesson-menu-header lesson-hero">
                  <div className="hero-controls">
                    <LessonIconAction
                      onClick={() => setIsNavOpen(false)}
                    >
                      <X size={18} />
                    </LessonIconAction>
                    <LessonIconAction to="/">
                      <LayoutGrid size={18} />
                    </LessonIconAction>
                  </div>
                  <div className="hero-title">
                    <h1>{course.title}</h1>
                  </div>
                </header>
                <nav className="lesson-nav">
                  {course.chapters.map((chapter) => (
                    <section className="lesson-nav-chapter" key={chapter.id}>
                      <h2 className="lesson-chapter-title">Chapter {chapter.id}: {chapter.title}</h2>
                      {course.lessons.filter((item) => chapter.lessonIds.includes(item.id)).map((item) => (
                        <Link
                          className="lesson-link"
                          key={item.id}
                          onClick={() => setIsNavOpen(false)}
                          to={item.slug}
                        >
                          <span className="lesson-link-indicators">
                            {getCheckIcon(completedLessonIds.includes(item.id), false)}
                          </span>
                          <span className="lesson-link-title">{item.id} — {item.title}</span>
                        </Link>
                      ))}
                    </section>
                  ))}
                </nav>
              </aside>
            </div>
            <div className="pager">
              {previousLesson ? (
                <LessonIconAction to={previousLesson.slug}>
                  <ChevronLeft size={18} />
                </LessonIconAction>
              ) : (
                <LessonIconAction disabled>
                  <ChevronLeft size={18} />
                </LessonIconAction>
              )}
              {nextLesson ? (
                <LessonIconAction to={nextLesson.slug}>
                  <ChevronRight size={18} />
                </LessonIconAction>
              ) : (
                <LessonIconAction disabled>
                  <ChevronRight size={18} />
                </LessonIconAction>
              )}
            </div>
            <LessonIconAction
              className="restart-action"
              disabled={!canRestartLesson}
              onClick={handleRestartLesson}
            >
              <Trash2 size={18} />
            </LessonIconAction>
          </div>
          <div className="hero-title">
            <h1>{renderGlossaryText(`${lesson.id} — ${lesson.title}`, course.glossary)}</h1>
          </div>
        </header>

        <section className="lesson-layout">
          {lesson.concept.length > 0 || lesson.math.length > 0 ? (
            <article className="concept-panel lesson-prose">
              {lesson.concept.length > 0 ? <p>{renderGlossaryText(lesson.concept.join(" "), course.glossary)}</p> : null}
              {lesson.math.length > 0 ? (
              <details className="expandable-section">
                <summary>
                  <span>Math</span>
                  <ChevronRight className="expandable-icon expandable-icon-closed" size={18} />
                  <ChevronDown className="expandable-icon expandable-icon-open" size={18} />
                </summary>
                <div className="expandable-content">
                  {lesson.math.map((line) => (
                    <p key={line}>{renderGlossaryText(line, course.glossary)}</p>
                  ))}
                </div>
              </details>
              ) : null}
            </article>
          ) : null}

          {lesson.exam ? (
            <ExamQuestions
              courseId={course.id}
              key={`${lesson.id}-${examResetVersion}`}
              lessonId={lesson.id}
              onAnsweredCountChange={setExamAnsweredCount}
              onError={setMessage}
            />
          ) : null}

          <section className="workbench">
            <div className="workspace-grid workspace-content-grid">
              <div className="exercise lesson-prose">
                <div className="detail-heading">
                  <h2>Exercise</h2>
                </div>
                <div className="formatted-text">{renderFormattedText(lesson.exercise, course.glossary)}</div>
              </div>
              <div className="checkpoints">
                <div className="detail-heading">
                  <h2>Checks</h2>
                </div>
                {lesson.checkpoints.map((checkpoint, index) => {
                  const check = runResult?.checks[index];
                  const passed = check?.passed ?? isComplete;
                  const failed = check ? !check.passed : false;
                  return (
                    <span className={passed ? "passed" : failed ? "failed" : ""} key={checkpoint}>
                      {getCheckIcon(passed, failed)}
                      <span className="checkpoint-label">{renderInlineFormattedText(checkpoint, course.glossary)}</span>
                    </span>
                  );
                })}
              </div>
              <div className={`workspace-panels workspace-panels-${workspacePanelView}`}>
                <section className="code-panel" ref={codePanelRef}>
                  {editorPanelView === "asset" ? (
                    <AssetPreview
                      action={editorActions}
                      assetFile={assetFile}
                      label={course.asset.label}
                      loading={status === "loading"}
                      previewKind={course.asset.previewKind}
                    />
                  ) : (
                    <CodeSurface
                      action={editorActions}
                      className={hasLessonFile ? undefined : "code-template"}
                      content={displayedFileContent}
                      disabled={status === "loading" && !fileContent}
                      editorRef={editorRef}
                      glossary={course.glossary}
                      language={lesson.language}
                      mode={hasLessonFile ? "editable" : "preview"}
                      onActivate={hasLessonFile ? undefined : handleActivateBrowserEditor}
                      onChange={handleCodeChange}
                      rows={codeEditorRows}
                    />
                  )}
                </section>
                <OutputPanel
                  action={
                    <button className="control-button pill-button" disabled={status === "running"} onClick={handleRun} type="button">
                      {status === "running" ? <LoaderCircle className="running-icon" size={18} /> : <Play size={18} />}
                      {status === "running" ? "Running…" : "Run"}
                    </button>
                  }
                  key={lesson.id}
                  result={runResult}
                  running={status === "running"}
                  runtime={lesson.runtime}
                  widthAction={
                    <WorkspaceWidthButton
                      active={workspacePanelView === "output"}
                      onClick={() => setWorkspacePanelView((view) => view === "output" ? "split" : "output")}
                    >
                      {workspacePanelView === "output" ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
                    </WorkspaceWidthButton>
                  }
                />
              </div>
            </div>
          </section>
        </section>
        {isPageScrollable ? (
          <footer className="lesson-bottom-navigation" ref={bottomNavigationRef}>
            {previousLesson ? (
              <LessonIconAction className="lesson-bottom-action lesson-bottom-previous" to={previousLesson.slug}>
                <ChevronLeft size={18} />
              </LessonIconAction>
            ) : null}
            <LessonIconAction className="lesson-bottom-action lesson-bottom-top" onClick={() => window.scrollTo({ top: 0 })}>
              <ChevronUp size={18} />
            </LessonIconAction>
            {nextLesson ? (
              <LessonIconAction className="lesson-bottom-action lesson-bottom-next" to={nextLesson.slug}>
                <ChevronRight size={18} />
              </LessonIconAction>
            ) : null}
          </footer>
        ) : null}
        {message ? (
          <div className="error-toast">
            {message}
          </div>
        ) : null}
      </section>
    </main>
  );
}

/** Output panel view that keeps stdout, stderr, and checks visible beside code. */
function OutputPanel({
  action,
  result,
  running,
  runtime,
  widthAction
}: {
  action: ReactNode;
  result: RunResult | null;
  running: boolean;
  runtime: string;
  widthAction: ReactNode;
}) {
  const panelRef = useRef<HTMLElement | null>(null);
  const [isStatusExpanded, setIsStatusExpanded] = useState(false);
  const [scrollFadeClass, setScrollFadeClass] = useState("");
  const [statusHistory, setStatusHistory] = useState<string[]>([`Run the saved file with ${runtime} to see output and checks.`]);
  const currentStatus = running
    ? `Running with ${runtime}...`
    : result
      ? result.success
        ? "Run completed successfully."
        : "Run failed."
      : `Run the saved file with ${runtime} to see output and checks.`;

  useEffect(() => {
    setStatusHistory((history) => history.at(-1) === currentStatus ? history : [...history, currentStatus]);
  }, [currentStatus]);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) {
      return;
    }

    const updateFades = () => setScrollFadeClass(getScrollFadeClass(panel));
    updateFades();
    const observer = new ResizeObserver(updateFades);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [result, running]);

  return (
    <section
      className={`workspace-panel output-panel ${result ? "" : "output-panel-empty"} ${scrollFadeClass}`}
      onScroll={(event) => setScrollFadeClass(getScrollFadeClass(event.currentTarget))}
      ref={panelRef}
    >
      <PanelHeader
        action={action}
        className="output-title"
      >
        <div className="glossary-bar">
          {widthAction}
          <DisclosureButton
            expanded={isStatusExpanded}
            label="Output"
            onToggle={() => setIsStatusExpanded((expanded) => !expanded)}
          />
          {isStatusExpanded ? statusHistory.map((status, index) => <span key={`${index}-${status}`}>{status}</span>) : null}
        </div>
      </PanelHeader>
      {result ? (
        <>
          <pre>{result.stdout || "(no stdout)"}</pre>
          {result.stderr ? <pre className="stderr">{result.stderr}</pre> : null}
        </>
      ) : null}
    </section>
  );
}

function getCheckIcon(passed: boolean, failed: boolean): ReactNode {
  if (passed) {
    return <CheckCircle2 className="passed-status" size={14} />;
  }

  if (failed) {
    return (
      <span className="failed-status">
        <X size={10} />
      </span>
    );
  }

  return <span className="incomplete-status" />;
}

/** Shared panel header that keeps labels and actions aligned across workspace views. */
function PanelHeader({
  action,
  children,
  className
}: {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={["panel-header", className].filter(Boolean).join(" ")}>
      {children}
      {action ? <div className="panel-actions">{action}</div> : null}
    </div>
  );
}

function countSourceLines(content: string): number {
  return Math.max(1, content.split("\n").length);
}

function getDisplayedFileContent(content: string): string {
  // Textarea renders the backend-normalized terminal newline as a blank editable row, unlike the template pre.
  return content.replace(/\n+$/, "");
}

function getAssetPreviewContent(
  assetFile: AssetFileResponse | null,
  loading: boolean,
  label: string,
  previewKind: "csv" | "text"
): string {
  if (assetFile) {
    const summary = previewKind === "csv"
      ? assetFile.rows !== null && assetFile.columns !== null
        ? `# ${assetFile.rows} rows x ${assetFile.columns} columns\n# ${assetFile.path}\n`
        : `# ${assetFile.path}\n`
      : `<!-- ${assetFile.path} -->\n`;
    const truncation = assetFile.truncated
      ? previewKind === "csv" ? "\n# Preview truncated." : "\n<!-- Preview truncated. -->"
      : "";
    return `${summary}${assetFile.content}${truncation}`;
  }

  return loading ? `Loading ${label.toLowerCase()}...` : `${label} preview is unavailable.`;
}

function AssetPreview({
  action,
  assetFile,
  label,
  loading,
  previewKind
}: {
  action: ReactNode;
  assetFile: AssetFileResponse | null;
  label: string;
  loading: boolean;
  previewKind: "csv" | "text";
}) {
  const content = getAssetPreviewContent(assetFile, loading, label, previewKind);
  if (previewKind === "csv" && assetFile) {
    return <CsvAssetPreview action={action} assetFile={assetFile} label={label} />;
  }

  return (
    <CodeSurface
      action={action}
      content={content}
      glossary={[]}
      language="text"
      mode="preview"
      rows={countSourceLines(content)}
      showGlossary={false}
    />
  );
}

function CodeHeader({ content, glossary }: { content: string; glossary: GlossaryEntry[] }) {
  const { lessonRoute } = useParams();
  const [isExpanded, setIsExpanded] = useState(false);
  const matches = getUniqueGlossaryMatches(content, glossary);
  const glossaryItems = matches.map((match) => ({
    key: `glossary-${match.label}-${match.text}`,
    label: match.label,
    node: (
      <GlossaryTerm
        id={`code-glossary-${match.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
        match={match}
        text={match.text}
      />
    )
  })).sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: "base" }));

  useEffect(() => setIsExpanded(false), [lessonRoute]);

  return (
    <div className="glossary-bar code-glossary-bar">
      {matches.length > 0 ? (
        <DisclosureButton
          expanded={isExpanded}
          label="Code"
          onToggle={() => setIsExpanded((expanded) => !expanded)}
        />
      ) : (
        <span className="glossary-heading">Code</span>
      )}
      {isExpanded ? glossaryItems.map((item) => <span key={item.key}>{item.node}</span>) : null}
    </div>
  );
}

function CodeSurface({
  action,
  className,
  content,
  disabled = false,
  editorRef,
  glossary,
  language,
  mode,
  onActivate,
  onChange,
  rows = 1,
  showGlossary = true
}: {
  action?: ReactNode;
  className?: string;
  content: string;
  disabled?: boolean;
  editorRef?: MutableRefObject<HTMLTextAreaElement | null>;
  glossary: GlossaryEntry[];
  language: "cpp" | "python" | "text";
  mode: "editable" | "preview";
  onActivate?: () => void | Promise<void>;
  onChange?: (content: string) => void | Promise<void>;
  rows?: number;
  showGlossary?: boolean;
}) {
  const internalEditorRef = useRef<HTMLTextAreaElement | null>(null);
  const highlightRef = useRef<HTMLPreElement | null>(null);
  const [scrollFadeClass, setScrollFadeClass] = useState("");

  useLayoutEffect(() => {
    const editor = internalEditorRef.current;
    if (!editor) {
      return;
    }

    const updateFades = () => {
      syncCodeHighlightScroll(editor, highlightRef.current);
      setScrollFadeClass(getScrollFadeClass(editor));
    };
    updateFades();
    const observer = new ResizeObserver(updateFades);
    observer.observe(editor);
    return () => observer.disconnect();
  }, [content]);

  return (
    <div className={["workspace-panel", "code-view", "code-surface", className].filter(Boolean).join(" ")}>
      <PanelHeader action={action}>{showGlossary ? <CodeHeader content={content} glossary={glossary} /> : <div />}</PanelHeader>
      <div className={`code-editor-stack ${scrollFadeClass}`}>
        <pre className="code-editor-highlight" ref={highlightRef}>{colorizeCode(language, content)}</pre>
        <textarea
          className="code-editor"
          disabled={disabled}
          onChange={(event) => {
            if (mode === "editable") {
              void onChange?.(event.target.value);
            }
          }}
          onClick={() => {
            if (mode === "preview") {
              void onActivate?.();
            }
          }}
          onScroll={(event) => {
            syncCodeHighlightScroll(event.currentTarget, highlightRef.current);
            setScrollFadeClass(getScrollFadeClass(event.currentTarget));
          }}
          readOnly={mode === "preview"}
          ref={(element) => {
            internalEditorRef.current = element;
            if (editorRef) {
              editorRef.current = element;
            }
          }}
          rows={rows}
          spellCheck={false}
          value={content}
          wrap="off"
        />
      </div>
    </div>
  );
}

function syncCodeHighlightScroll(editor: HTMLTextAreaElement, highlight: HTMLPreElement | null) {
  if (!highlight) {
    return;
  }
  highlight.scrollLeft = editor.scrollLeft;
  highlight.scrollTop = editor.scrollTop;
}

function CsvAssetPreview({
  action,
  assetFile,
  label
}: {
  action: ReactNode;
  assetFile: AssetFileResponse;
  label: string;
}) {
  const rows = parseCsvRows(assetFile.content);
  const [headers, ...bodyRows] = rows;
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
  const [scrollFadeClass, setScrollFadeClass] = useState("");
  const [visibleRowCount, setVisibleRowCount] = useState(ASSET_INITIAL_ROW_COUNT);
  const visibleRows = bodyRows.slice(0, visibleRowCount);
  const hasMoreRows = visibleRowCount < bodyRows.length;

  useEffect(() => {
    setVisibleRowCount(ASSET_INITIAL_ROW_COUNT);
  }, [assetFile.content]);

  useLayoutEffect(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) {
      return;
    }

    const updateFades = () => setScrollFadeClass(getScrollFadeClass(scrollArea));
    updateFades();
    const observer = new ResizeObserver(updateFades);
    observer.observe(scrollArea);
    return () => observer.disconnect();
  }, [assetFile.content, visibleRowCount]);

  return (
    <div className="workspace-panel code-view asset-view asset-table-view">
      <PanelHeader action={action}>
        <div className="asset-summary">
          <DisclosureButton
            expanded={isSummaryExpanded}
            label={label}
            onToggle={() => setIsSummaryExpanded((expanded) => !expanded)}
          />
          {isSummaryExpanded && assetFile.rows !== null && assetFile.columns !== null ? <span>{assetFile.rows} rows x {assetFile.columns} columns</span> : null}
          {isSummaryExpanded ? <span>{assetFile.path}</span> : null}
          {isSummaryExpanded && assetFile.truncated ? <span>Preview truncated.</span> : null}
        </div>
      </PanelHeader>
      <div
        className={`asset-scroll-area ${scrollFadeClass}`}
        onScroll={(event) => setScrollFadeClass(getScrollFadeClass(event.currentTarget))}
        ref={scrollAreaRef}
      >
        <table>
          <thead>
            <tr>{headers?.map((header, index) => <th key={`${header}-${index}`}>{header}</th>)}</tr>
          </thead>
          <tbody>
            {visibleRows.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`}>
                {headers.map((_, columnIndex) => (
                  <td key={`cell-${rowIndex}-${columnIndex}`}>{row[columnIndex] ?? ""}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="asset-load-more-row">
          <div className="asset-row-controls">
            <button
              className="control-button pill-button workspace-action-button"
              disabled={visibleRowCount <= ASSET_INITIAL_ROW_COUNT}
              onClick={() => {
                setVisibleRowCount(ASSET_INITIAL_ROW_COUNT);
                if (scrollAreaRef.current) {
                  scrollAreaRef.current.scrollTop = 0;
                }
              }}
              type="button"
            >
              <ChevronUp size={18} />
              Less
            </button>
            <button
              className="control-button pill-button workspace-action-button"
              disabled={!hasMoreRows}
              onClick={() => setVisibleRowCount((count) => Math.min(count + ASSET_ROWS_PER_PAGE, bodyRows.length))}
              type="button"
            >
              <ChevronDown size={18} />
              More
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Shared label and chevron control for collapsible workspace header content. */
function DisclosureButton({
  expanded,
  label,
  onToggle
}: {
  expanded: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      className="control-button glossary-disclosure"
      onClick={onToggle}
      type="button"
    >
      <span className="glossary-heading">{label}</span>
      {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
    </button>
  );
}

function parseCsvRows(content: string): string[][] {
  const rows: string[][] = [];
  let cell = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    const nextCharacter = content[index + 1];

    if (character === "\"" && inQuotes && nextCharacter === "\"") {
      cell += "\"";
      index += 1;
      continue;
    }

    if (character === "\"") {
      inQuotes = !inQuotes;
      continue;
    }

    if (character === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if (character === "\n" && !inQuotes) {
      row.push(cell);
      rows.push(row);
      cell = "";
      row = [];
      continue;
    }

    cell += character;
  }

  row.push(cell);
  rows.push(row);
  return rows.filter((cells) => cells.some((value) => value.length > 0));
}

function getUniqueGlossaryMatches(text: string, glossary: GlossaryEntry[]): Array<GlossaryMatch & { text: string }> {
  const matches: Array<GlossaryMatch & { text: string }> = [];
  const seen = new Set<string>();
  let cursor = 0;

  while (cursor < text.length) {
    const match = findGlossaryMatch(text, cursor, glossary);
    if (!match) {
      cursor += 1;
      continue;
    }

    const key = match.label.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      matches.push({
        ...match,
        text: text.slice(cursor, cursor + match.term.length)
      });
    }
    cursor += match.term.length;
  }

  return matches;
}

function renderGlossaryText(text: string, glossary: GlossaryEntry[]): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const match = findGlossaryMatch(text, cursor, glossary);
    if (!match) {
      const nextCursor = cursor + 1;
      appendText(nodes, text.slice(cursor, nextCursor));
      cursor = nextCursor;
      continue;
    }

    const matchedText = text.slice(cursor, cursor + match.term.length);
    nodes.push(
      <GlossaryTerm
        id={`glossary-${cursor}-${match.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
        key={`${cursor}-${match.label}-${matchedText}`}
        match={match}
        text={matchedText}
      />
    );
    cursor += match.term.length;
  }

  return nodes;
}

function renderFormattedText(text: string, glossary: GlossaryEntry[]): ReactNode[] {
  const nodes: ReactNode[] = [];
  const codeBlockPattern = /```([\s\S]*?)```/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockPattern.exec(text))) {
    appendFormattedProse(nodes, text.slice(cursor, match.index), glossary);
    nodes.push(
      <pre className="text-code-block" key={`code-block-${match.index}`}>
        <code>{match[1].trim()}</code>
      </pre>
    );
    cursor = match.index + match[0].length;
  }

  appendFormattedProse(nodes, text.slice(cursor), glossary);
  return nodes;
}

function appendFormattedProse(nodes: ReactNode[], text: string, glossary: GlossaryEntry[]): void {
  const paragraphs = text.split(/\n{2,}/).filter((paragraph) => paragraph.trim());
  paragraphs.forEach((paragraph, index) => {
    nodes.push(<p key={`paragraph-${nodes.length}-${index}`}>{renderInlineFormattedText(paragraph.trim(), glossary)}</p>);
  });
}

function renderInlineFormattedText(text: string, glossary: GlossaryEntry[]): ReactNode[] {
  const nodes: ReactNode[] = [];
  const parts = text.split(/(`[^`]+`)/g);

  parts.forEach((part, index) => {
    if (!part) {
      return;
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      nodes.push(
        <code className="inline-code" key={`inline-code-${index}`}>
          {part.slice(1, -1)}
        </code>
      );
      return;
    }

    nodes.push(...renderGlossaryText(part, glossary));
  });

  return nodes;
}

function appendText(nodes: ReactNode[], text: string): void {
  const lastNode = nodes[nodes.length - 1];
  if (typeof lastNode === "string") {
    nodes[nodes.length - 1] = lastNode + text;
    return;
  }
  nodes.push(text);
}

function GlossaryTerm({ id, match, text }: { id: string; match: GlossaryMatch; text: string }) {
  return (
    <span className="glossary-term-with-link">
      <SafeTooltip
        className="glossary-term"
        content={
          <>
            <strong>{match.label}</strong>
            <span>{match.definition}</span>
          </>
        }
        id={id}
      >
        <span className="glossary-label">{text}</span>
      </SafeTooltip>
      {match.externalUrl ? (
        <a
          className="glossary-external-link"
          href={match.externalUrl}
          rel="noreferrer"
          target="_blank"
        >
          <ExternalLink size={11} />
        </a>
      ) : null}
    </span>
  );
}

function SafeTooltip({
  children,
  className,
  content,
  id
}: {
  children: ReactNode;
  className?: string;
  content: ReactNode;
  id: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const tooltipRef = useRef<HTMLSpanElement | null>(null);
  const triggerRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const closeWhenAnotherTooltipOpens = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== id) {
        setIsOpen(false);
      }
    };

    window.addEventListener(TOOLTIP_OPEN_EVENT, closeWhenAnotherTooltipOpens);
    return () => window.removeEventListener(TOOLTIP_OPEN_EVENT, closeWhenAnotherTooltipOpens);
  }, [id]);

  useEffect(() => {
    if (isOpen) {
      window.dispatchEvent(new CustomEvent<string>(TOOLTIP_OPEN_EVENT, { detail: id }));
    }
  }, [isOpen, id]);

  useLayoutEffect(() => {
    if (!isOpen || !tooltipRef.current || !triggerRef.current) {
      return;
    }

    setPosition(calculateTooltipPosition(triggerRef.current, tooltipRef.current));
  }, [isOpen, content]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const updatePosition = () => {
      if (tooltipRef.current && triggerRef.current) {
        setPosition(calculateTooltipPosition(triggerRef.current, tooltipRef.current));
      }
    };
    const dismissOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setIsOpen(false);
    };
    const blockOutsidePointerDown = (event: PointerEvent) => {
      if (triggerRef.current?.contains(event.target as Node)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener("click", dismissOutside, true);
    window.addEventListener("pointerdown", blockOutsidePointerDown, true);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("click", dismissOutside, true);
      window.removeEventListener("pointerdown", blockOutsidePointerDown, true);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  return (
    <span
      className={["tooltip-host", className].filter(Boolean).join(" ")}
      onPointerUp={(event) => {
        const isGlossaryTooltip = className?.split(" ").includes("glossary-term");
        if (!isGlossaryTooltip || tooltipRef.current?.contains(event.target as Node)) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        setIsOpen((open) => !open);
      }}
      ref={triggerRef}
    >
      {children}
      <span
        className={`floating-surface tooltip-surface safe-tooltip ${isOpen ? "open" : ""} ${position?.placement ?? "below"}`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsOpen(false);
        }}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        ref={tooltipRef}
        style={position ? getTooltipStyle(position) : undefined}
      >
        {content}
      </span>
    </span>
  );
}

function getTooltipStyle(position: TooltipPosition): TooltipStyle {
  return {
    "--tooltip-arrow-left": `${position.arrowLeft}px`,
    left: position.left,
    top: position.top
  };
}

function calculateTooltipPosition(trigger: HTMLElement, tooltip: HTMLElement): TooltipPosition {
  const margin = 12;
  const gap = 10;
  const triggerRect = trigger.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const maxLeft = Math.max(margin, window.innerWidth - tooltipRect.width - margin);
  const preferredLeft = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
  const left = Math.min(Math.max(preferredLeft, margin), maxLeft);
  const triggerCenter = triggerRect.left + triggerRect.width / 2;
  const arrowLeft = Math.min(Math.max(triggerCenter - left, 18), tooltipRect.width - 18);
  const belowTop = triggerRect.bottom + gap;
  const belowFits = belowTop + tooltipRect.height <= window.innerHeight - margin;

  if (belowFits) {
    return { arrowLeft, left, top: belowTop, placement: "below" };
  }

  return {
    arrowLeft,
    left,
    placement: "above",
    top: Math.max(margin, triggerRect.top - tooltipRect.height - gap)
  };
}

async function loadFile(
  courseId: string,
  lesson: Lesson,
  setFileContent: (content: string) => void,
  setHasLessonFile: (exists: boolean) => void,
  fileStateRef: MutableRefObject<LessonFileState | null>,
  setStatus: (status: Status) => void,
  setMessage: (message: string) => void,
  shouldApply: () => boolean
) {
  setStatus("loading");
  try {
    const response = await fetchLessonFile(courseId, lesson.id);
    const nextFileState = await fetchLessonFileState(courseId, lesson.id);
    if (!shouldApply()) {
      return;
    }
    setFileContent(response.content);
    setHasLessonFile(response.exists);
    fileStateRef.current = nextFileState;
    setStatus("idle");
  } catch (error) {
    if (!shouldApply()) {
      return;
    }
    setStatus("error");
    setMessage("Unable to load lesson file.");
  }
}

async function loadOutput(
  courseId: string,
  lesson: Lesson,
  setRunResult: (result: RunResult | null) => void,
  setHasSavedOutput: (exists: boolean) => void,
  setMessage: (message: string) => void,
  shouldApply: () => boolean
) {
  try {
    const response = await fetchLessonOutput(courseId, lesson.id);
    if (!shouldApply()) {
      return;
    }
    setRunResult(response.result);
    setHasSavedOutput(response.exists);
  } catch (error) {
    if (!shouldApply()) {
      return;
    }
    setMessage("Unable to load lesson output.");
  }
}

async function pollLessonFileState(
  courseId: string,
  lessonId: string,
  fileStateRef: MutableRefObject<LessonFileState | null>,
  reloadLessonFile: () => Promise<void>,
  setMessage: (message: string) => void
) {
  try {
    const nextFileState = await fetchLessonFileState(courseId, lessonId);
    const previousFileState = fileStateRef.current;
    if (!previousFileState) {
      fileStateRef.current = nextFileState;
      return;
    }

    if (
      nextFileState.exists !== previousFileState.exists ||
      nextFileState.modifiedAt !== previousFileState.modifiedAt
    ) {
      await reloadLessonFile();
    }
  } catch (error) {
    setMessage(error instanceof Error ? error.message : "Unable to monitor lesson file.");
  }
}

async function loadAssetState(
  courseId: string,
  lessonId: string,
  setAssetInfo: (assetInfo: AssetState) => void,
  setMessage: (message: string) => void
) {
  try {
    setAssetInfo(await fetchAssetState(courseId, lessonId));
  } catch (error) {
    setMessage(error instanceof Error ? error.message : "Unable to load asset status.");
  }
}
