import { ArrowDown, ArrowUp, Check, ChevronDown, Copy, LoaderCircle, MessageCircleQuestionMark, Pencil, Quote, Square, SquarePen, X } from "lucide-react";
import type { FormEvent, MouseEvent as ReactMouseEvent } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  closeOpenAIChatSession,
  fetchOpenAIChatSettings,
  interruptOpenAIChatTurn,
  streamOpenAIChatTurn,
  type OpenAIChatMessage,
  type OpenAIChatSettings
} from "./api";
import { IconButton } from "./Controls";
import "./OpenAIHelpChat.css";

const SELECTION_QUOTE_EVENT = "learn-selection-quote";
const CHAT_OPEN_CLASS = "openai-chat-open";
const NARROW_CHAT_MEDIA = "(max-width: 640px)";
const TEST_CHAT_QUERY = "testChat";

type DisplayChatMessage = OpenAIChatMessage & { createdAt: number };

function getChatScrollElement(): HTMLElement {
  return document.scrollingElement instanceof HTMLElement ? document.scrollingElement : document.documentElement;
}

function createInitialMessages(): DisplayChatMessage[] {
  if (!import.meta.env.DEV || new URLSearchParams(window.location.search).get(TEST_CHAT_QUERY) !== "30") {
    return [];
  }

  const firstMessageTime = Date.now() - 29 * 60_000;
  return Array.from({ length: 30 }, (_, index) => {
    const messageNumber = index + 1;
    const role = index % 2 === 0 ? "user" : "assistant";
    return {
      role,
      content: `Test ${role} message ${messageNumber}. This temporary message checks conversation scrolling and layout.`,
      createdAt: firstMessageTime + index * 60_000
    };
  });
}

function exactSettingValue(value: string | number | boolean | null): string {
  return value === null ? "null" : String(value);
}

/** Floating OpenAI help view whose open state follows the active route. */
export default function OpenAIHelpChat({
  courseId,
  isOpen,
  lessonId,
  onClose,
  onOpen
}: {
  courseId: string;
  isOpen: boolean;
  lessonId: string;
  onClose: () => void;
  onOpen: () => void;
}) {
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [editingContent, setEditingContent] = useState("");
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [isReceivingResponse, setIsReceivingResponse] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isComposerMultiline, setIsComposerMultiline] = useState(false);
  const [isConversationEndVisible, setIsConversationEndVisible] = useState(true);
  const [isModelDetailsLoading, setIsModelDetailsLoading] = useState(false);
  const [isModelDetailsOpen, setIsModelDetailsOpen] = useState(false);
  const [messages, setMessages] = useState<DisplayChatMessage[]>(createInitialMessages);
  const [modelSettings, setModelSettings] = useState<OpenAIChatSettings | null>(null);
  const [expandedMessageIndex, setExpandedMessageIndex] = useState<number | null>(null);
  const [pendingQuote, setPendingQuote] = useState("");
  const copyResetTimeoutRef = useRef(0);
  const composerRef = useRef<HTMLFormElement | null>(null);
  const conversationEndRef = useRef<HTMLDivElement | null>(null);
  const editInputRef = useRef<HTMLTextAreaElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const modelMenuRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLElement | null>(null);
  const isAtConversationEndRef = useRef(true);
  const latestLessonSelectionRef = useRef("");
  const lessonScrollPositionRef = useRef(window.scrollY);
  const sessionActiveRef = useRef(false);
  const chatScrollPositionRef = useRef(0);
  const previousIsOpenRef = useRef(isOpen);

  useSelectionBridge();

  useEffect(() => () => window.clearTimeout(copyResetTimeoutRef.current), []);

  useEffect(() => {
    if (expandedMessageIndex === null) {
      return undefined;
    }
    const closeMenu = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest(".openai-chat-message")) {
        return;
      }
      setExpandedMessageIndex(null);
    };
    window.addEventListener("pointerdown", closeMenu);
    return () => window.removeEventListener("pointerdown", closeMenu);
  }, [expandedMessageIndex]);

  useEffect(() => {
    if (!isModelDetailsOpen) {
      return undefined;
    }
    const closeModelDetails = (event: PointerEvent) => {
      if (modelMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      setIsModelDetailsOpen(false);
    };
    window.addEventListener("pointerdown", closeModelDetails);
    return () => window.removeEventListener("pointerdown", closeModelDetails);
  }, [isModelDetailsOpen]);

  useEffect(() => {
    if (!isOpen || modelSettings) {
      return undefined;
    }
    let active = true;
    setIsModelDetailsLoading(true);
    sessionActiveRef.current = true;
    void fetchOpenAIChatSettings(courseId)
      .then((settings) => {
        if (active) {
          setModelSettings(settings);
        }
      })
      .catch((settingsError) => {
        if (active) {
          setError(settingsError instanceof Error ? settingsError.message : "Model details could not be loaded.");
        }
      })
      .finally(() => {
        if (active) {
          setIsModelDetailsLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [courseId, isOpen, modelSettings]);

  useLayoutEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    document.body.classList.add(CHAT_OPEN_CLASS);
    return () => document.body.classList.remove(CHAT_OPEN_CLASS);
  }, [isOpen]);

  useLayoutEffect(() => {
    const wasOpen = previousIsOpenRef.current;
    if (wasOpen === isOpen) {
      return;
    }
    previousIsOpenRef.current = isOpen;

    if (isOpen) {
      const conversation = getChatScrollElement();
      window.scrollTo({
        top: isAtConversationEndRef.current ? conversation.scrollHeight : chatScrollPositionRef.current
      });
      return;
    }

    chatScrollPositionRef.current = window.scrollY;
    setIsModelDetailsOpen(false);
    window.scrollTo({ top: lessonScrollPositionRef.current });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !conversationEndRef.current) {
      isAtConversationEndRef.current = true;
      setIsConversationEndVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(([entry]) => {
      isAtConversationEndRef.current = entry.isIntersecting;
      setIsConversationEndVisible(entry.isIntersecting);
    }, { threshold: 0 });
    observer.observe(conversationEndRef.current);
    return () => observer.disconnect();
  }, [isOpen, isSending, messages.length]);

  useEffect(() => {
    const captureQuote = (event: Event) => {
      const text = (event as CustomEvent<{ text: string }>).detail.text.trim();
      latestLessonSelectionRef.current = text;
      setPendingQuote(text);
    };

    window.addEventListener(SELECTION_QUOTE_EVENT, captureQuote);
    return () => window.removeEventListener(SELECTION_QUOTE_EVENT, captureQuote);
  }, []);

  useEffect(() => {
    const closePageSession = () => {
      if (!sessionActiveRef.current) {
        return;
      }
      sessionActiveRef.current = false;
      void closeOpenAIChatSession(courseId, true).catch(() => undefined);
    };
    window.addEventListener("pagehide", closePageSession);
    return () => window.removeEventListener("pagehide", closePageSession);
  }, [courseId]);

  useLayoutEffect(() => {
    if (editingMessageIndex === null) {
      return;
    }
    const editor = editInputRef.current;
    if (!editor) {
      return;
    }
    editor.focus();
    editor.setSelectionRange(editor.value.length, editor.value.length);
  }, [editingMessageIndex]);

  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }
    const conversation = getChatScrollElement();
    if (isAtConversationEndRef.current) {
      conversation.scrollTo({ top: conversation.scrollHeight });
    }
  }, [isOpen, isSending, messages, pendingQuote]);

  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }
    const input = inputRef.current;
    if (!input) {
      return;
    }
    input.style.height = "auto";
    input.style.height = `${input.scrollHeight}px`;
    const inputStyle = window.getComputedStyle(input);
    const singleLineHeight = (
      Number.parseFloat(inputStyle.lineHeight) +
      Number.parseFloat(inputStyle.paddingTop) +
      Number.parseFloat(inputStyle.paddingBottom)
    );
    setIsComposerMultiline(input.scrollHeight > singleLineHeight + 1);
  }, [draft, isOpen]);

  useLayoutEffect(() => {
    if (!isOpen || !composerRef.current || !overlayRef.current) {
      return undefined;
    }
    const composer = composerRef.current;
    const conversation = getChatScrollElement();
    const overlay = overlayRef.current;
    const updateComposerHeight = () => {
      overlay.style.setProperty("--openai-chat-composer-height", `${composer.getBoundingClientRect().height}px`);
      if (isAtConversationEndRef.current) {
        conversation.scrollTo({ top: conversation.scrollHeight });
      }
    };
    const resizeObserver = new ResizeObserver(updateComposerHeight);
    resizeObserver.observe(composer);
    updateComposerHeight();
    return () => resizeObserver.disconnect();
  }, [isOpen]);

  useEffect(() => {
    if (!error) {
      return undefined;
    }
    const timer = window.setTimeout(() => setError(""), 5200);
    return () => window.clearTimeout(timer);
  }, [error]);

  async function handleNewChat() {
    setDraft("");
    setEditingContent("");
    setEditingMessageIndex(null);
    setError("");
    setIsReceivingResponse(false);
    setIsModelDetailsOpen(false);
    setMessages([]);
    setExpandedMessageIndex(null);
    setPendingQuote("");
    isAtConversationEndRef.current = true;
    setIsConversationEndVisible(true);
    sessionActiveRef.current = false;
    try {
      await closeOpenAIChatSession(courseId);
      window.requestAnimationFrame(() => inputRef.current?.focus());
    } catch (sessionError) {
      setError(sessionError instanceof Error ? sessionError.message : "A new OpenAI chat could not start.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendMessage(draft, true);
  }

  async function handleStop() {
    try {
      await interruptOpenAIChatTurn(courseId);
    } catch (stopError) {
      setError(stopError instanceof Error ? stopError.message : "The OpenAI response could not be stopped.");
    }
  }

  function handleClearComposer() {
    setDraft("");
    setPendingQuote("");
    inputRef.current?.focus();
  }

  function handleToggleModelDetails() {
    setIsModelDetailsOpen((open) => !open);
  }

  function handleToggleChat() {
    if (isOpen) {
      onClose();
      return;
    }

    lessonScrollPositionRef.current = window.scrollY;
    setPendingQuote(latestLessonSelectionRef.current);
    onOpen();
  }

  function captureSelectionBeforeChatOpen() {
    if (isOpen) {
      return;
    }
    const selection = document.getSelection();
    const text = (
      getActiveControlSelection() ||
      (isSelectionInsideOpenAIChat(selection) ? "" : selection?.toString()) ||
      ""
    ).trim();
    latestLessonSelectionRef.current = text;
    setPendingQuote(text);
  }

  function handleScrollToEnd() {
    const conversation = getChatScrollElement();
    isAtConversationEndRef.current = true;
    setIsConversationEndVisible(true);
    conversation.scrollTo({ behavior: "smooth", top: conversation.scrollHeight });
  }

  function handleEditMessage(index: number, content: string) {
    setExpandedMessageIndex(null);
    setEditingContent(content);
    setEditingMessageIndex(index);
  }

  function handleCancelEdit() {
    setEditingContent("");
    setEditingMessageIndex(null);
  }

  function handleSaveEdit() {
    const content = editingContent.trim();
    if (editingMessageIndex === null || !content) {
      return;
    }
    setMessages((currentMessages) => currentMessages.map((message, index) => (
      index === editingMessageIndex ? { ...message, content } : message
    )));
    handleCancelEdit();
  }

  async function handleCopyMessage(index: number, content: string) {
    setExpandedMessageIndex(null);
    try {
      await navigator.clipboard.writeText(content);
      window.clearTimeout(copyResetTimeoutRef.current);
      setCopiedMessageIndex(index);
      copyResetTimeoutRef.current = window.setTimeout(() => setCopiedMessageIndex(null), 1600);
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : "The message could not be copied.");
    }
  }

  function handleMessageClick(event: ReactMouseEvent<HTMLElement>, index: number) {
    if (!window.matchMedia(NARROW_CHAT_MEDIA).matches) {
      return;
    }
    if (event.target instanceof Element && event.target.closest("a, button, input, textarea")) {
      return;
    }
    setExpandedMessageIndex((currentIndex) => currentIndex === index ? null : index);
  }

  async function sendMessage(messageText: string, clearDraft: boolean) {
    const content = messageText.trim();
    if (!content || isSending) {
      return;
    }

    const userMessage: OpenAIChatMessage = {
      role: "user",
      content,
      ...(pendingQuote ? { quote: pendingQuote } : {})
    };
    const conversation: DisplayChatMessage[] = [...messages, { ...userMessage, createdAt: Date.now() }];
    setMessages(conversation);
    if (clearDraft) {
      setDraft("");
    }
    setPendingQuote("");
    setError("");
    setIsReceivingResponse(false);
    setIsSending(true);
    sessionActiveRef.current = true;
    try {
      await streamOpenAIChatTurn(courseId, lessonId, content, userMessage.quote, (delta) => {
        setIsReceivingResponse(true);
        setMessages((currentMessages) => {
          const updatedMessages = [...currentMessages];
          const assistant = updatedMessages.at(-1);
          if (assistant?.role === "assistant") {
            updatedMessages[updatedMessages.length - 1] = { ...assistant, content: assistant.content + delta };
          } else {
            updatedMessages.push({ role: "assistant", content: delta, createdAt: Date.now() });
          }
          return updatedMessages;
        });
      });
    } catch (requestError) {
      sessionActiveRef.current = false;
      setMessages(messages);
      if (clearDraft) {
        setDraft(content);
      }
      setPendingQuote(userMessage.quote ?? "");
      setError(requestError instanceof Error ? requestError.message : "OpenAI could not answer this message.");
    } finally {
      setIsReceivingResponse(false);
      setIsSending(false);
    }
  }

  const modelDetails: [string, string][] = modelSettings ? [
    ["Model", modelSettings.model],
    ["Provider", modelSettings.provider],
    ["API", modelSettings.api],
    ["Reasoning effort", exactSettingValue(modelSettings.reasoningEffort)],
    ["Stored by OpenAI", exactSettingValue(modelSettings.store)],
    ["Streaming", exactSettingValue(modelSettings.streaming)],
    ["Truncation", modelSettings.truncation],
    ["Turn timeout seconds", exactSettingValue(modelSettings.turnTimeoutSeconds)]
  ] : [];

  return (
    <div className="openai-help-chat">
      {isOpen ? (
        <section className="openai-chat-overlay lesson-page" ref={overlayRef}>
          <IconButton
            className="openai-chat-new"
            disabled={isSending}
            onClick={() => void handleNewChat()}
          >
            <SquarePen size={18} />
          </IconButton>
          <div className="openai-chat-conversation-shell">
            <div className="openai-chat-conversation">
              <header className="openai-chat-header lesson-hero">
                <div className="hero-title">
                  <h1>OpenAI</h1>
                </div>
              </header>
              <div className="openai-chat-content">
                {messages.length === 0 ? (
                  <p className="openai-chat-empty">
                    Lesson context and selected text are attached automatically.
                  </p>
                ) : messages.map((message, index) => (
                  <article
                    className={`openai-chat-message openai-chat-message-${message.role} ${expandedMessageIndex === index ? "message-meta-open" : ""}`}
                    key={`${message.role}-${index}`}
                    onClick={(event) => handleMessageClick(event, index)}
                  >
                    <div className="openai-chat-message-body">
                      {message.quote ? (
                        <blockquote className="openai-chat-source-quote">
                          <Quote size={15} />
                          <span>{message.quote}</span>
                        </blockquote>
                      ) : null}
                      {message.role === "assistant" ? (
                        <div className="openai-chat-markdown lesson-prose">
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        </div>
                      ) : editingMessageIndex === index ? (
                        <div className="openai-chat-message-editor">
                          <textarea
                            className="openai-chat-textarea"
                            onChange={(event) => setEditingContent(event.target.value)}
                            ref={editInputRef}
                            value={editingContent}
                          />
                          <div className="openai-chat-message-editor-actions">
                            <IconButton onClick={handleCancelEdit}>
                              <X size={15} />
                            </IconButton>
                            <IconButton
                              disabled={!editingContent.trim()}
                              onClick={handleSaveEdit}
                            >
                              <Check size={15} />
                            </IconButton>
                          </div>
                        </div>
                      ) : (
                        <p>{message.content}</p>
                      )}
                    </div>
                    {editingMessageIndex !== index ? (
                      <div className="openai-chat-message-meta">
                        <time>{new Date(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time>
                        <button
                          className="control-button openai-chat-message-action"
                          onClick={() => void handleCopyMessage(index, message.content)}
                          type="button"
                        >
                          {copiedMessageIndex === index ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                        {message.role === "user" ? (
                          <button
                            className="control-button openai-chat-message-action"
                            disabled={isSending}
                            onClick={() => handleEditMessage(index, message.content)}
                            type="button"
                          >
                            <Pencil size={12} />
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                ))}
                {isSending && !isReceivingResponse ? (
                  <div className="openai-chat-thinking">
                    <LoaderCircle className="running-icon" size={17} />
                    Thinking...
                  </div>
                ) : null}
                {messages.length > 0 || isSending ? (
                  <>
                    <div className="openai-chat-bottom-space" />
                    <div className="openai-chat-end-sentinel" ref={conversationEndRef} />
                  </>
                ) : null}
              </div>
            </div>
            {!isConversationEndVisible ? (
              <IconButton
                className="openai-chat-scroll-end"
                onClick={handleScrollToEnd}
              >
                <ArrowDown size={18} />
              </IconButton>
            ) : null}
          </div>
          <form className="openai-chat-composer" onSubmit={handleSubmit} ref={composerRef}>
            {pendingQuote ? (
              <blockquote className="openai-chat-pending-quote">
                <Quote size={15} />
                <span>{pendingQuote}</span>
              </blockquote>
            ) : null}
            <div className={`openai-chat-input-row ${draft || pendingQuote ? "has-content" : ""}`}>
              <textarea
                className="openai-chat-textarea"
                disabled={isSending}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder="Ask…"
                ref={inputRef}
                rows={1}
                value={draft}
              />
              <div className={`openai-chat-input-actions ${isComposerMultiline ? "multiline" : ""}`}>
                <div className="openai-chat-model-menu" ref={modelMenuRef}>
                  <IconButton
                    className={`openai-chat-model-trigger ${isModelDetailsOpen ? "open" : ""}`}
                    onClick={handleToggleModelDetails}
                  >
                    <ChevronDown size={18} />
                  </IconButton>
                  {isModelDetailsOpen ? (
                    <section className="floating-surface openai-chat-model-popover">
                      <header className="openai-chat-model-popover-header">
                        <strong>{modelSettings?.model ?? "Model details"}</strong>
                        <span>Responses API</span>
                      </header>
                      {isModelDetailsLoading ? <p>Loading model details…</p> : (
                        <dl>
                          {modelDetails.map(([label, value]) => (
                            <div key={label}>
                              <dt>{label}</dt>
                              <dd>{value}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </section>
                  ) : null}
                </div>
                <IconButton
                  className="openai-chat-clear"
                  disabled={(!draft && !pendingQuote) || isSending}
                  onClick={handleClearComposer}
                >
                  <X size={16} />
                </IconButton>
                {isSending ? (
                  <IconButton
                    className="openai-chat-stop"
                    onClick={() => void handleStop()}
                  >
                    <Square fill="currentColor" size={14} />
                  </IconButton>
                ) : draft.trim() ? (
                  <IconButton
                    className="openai-chat-send"
                    type="submit"
                  >
                    <ArrowUp size={18} />
                  </IconButton>
                ) : (
                  <IconButton
                    className="openai-chat-explain"
                    disabled={!pendingQuote}
                    onClick={() => void sendMessage("explain", false)}
                  >
                    ?
                  </IconButton>
                )}
              </div>
            </div>
          </form>
        </section>
      ) : null}
      <IconButton
        className="openai-help-button"
        onClick={handleToggleChat}
        onPointerDown={captureSelectionBeforeChatOpen}
      >
        {isOpen ? <X size={23} /> : <MessageCircleQuestionMark size={25} />}
      </IconButton>
      {error ? <div className="error-toast">{error}</div> : null}
    </div>
  );
}

/** Publishes completed page selections as quote context for the chat. */
function useSelectionBridge() {
  useEffect(() => {
    let timeoutId = 0;

    const updateSelection = (event: Event) => {
      if (event.target instanceof Element && event.target.closest(".openai-help-chat")) {
        return;
      }

      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        const selection = document.getSelection();
        const text = getActiveControlSelection() || selection?.toString() || "";
        if (!isSelectionInsideOpenAIChat(selection)) {
          window.dispatchEvent(new CustomEvent(SELECTION_QUOTE_EVENT, { detail: { text } }));
        }
      }, 0);
    };

    window.addEventListener("keyup", updateSelection);
    window.addEventListener("pointerup", updateSelection);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("keyup", updateSelection);
      window.removeEventListener("pointerup", updateSelection);
    };
  }, []);
}

function isSelectionInsideOpenAIChat(selection: Selection | null | undefined): boolean {
  const activeElement = document.activeElement;
  if (activeElement instanceof Element && activeElement.closest(".openai-help-chat")) {
    return true;
  }

  const selectionNode = selection?.anchorNode;
  const selectionElement = selectionNode instanceof Element ? selectionNode : selectionNode?.parentElement;
  return Boolean(selectionElement?.closest(".openai-help-chat"));
}

function getActiveControlSelection(): string {
  const activeElement = document.activeElement;
  if (!(activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement)) {
    return "";
  }

  const start = activeElement.selectionStart;
  const end = activeElement.selectionEnd;
  if (start === null || end === null || start === end) {
    return "";
  }

  return activeElement.value.slice(Math.min(start, end), Math.max(start, end));
}
