"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useReducer,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { FarmWorld, type WorldTravelRequest } from "./FarmWorld";
import { NftClaimPanel } from "./NftClaimPanel";
import { FieldStagePreview, SeedGlyph, type SeedKind } from "./FieldVisuals";
import {
  agentQuestions,
  contractAgentQuestions,
  contractChapters,
  contractFinalQuiz,
  courseRoute,
  finalQuiz,
  monadAgentQuestions,
  monadChapters,
  monadFinalQuiz,
  web3Chapters,
  type Chapter,
  type FinalQuestion,
} from "./course-data";
import {
  calculateExp,
  FIELD_STAGE_LABELS,
  FIELD_STAGE_ORDER,
  fieldVisualStage,
  growthStage,
  initialProgress,
  progressReducer,
  readStoredProgress,
  type FarmProgress,
} from "./progress";
import {
  calculateMonadExp,
  initialMonadProgress,
  MONAD_PROGRESS_STORAGE_KEY,
  monadProgressReducer,
  readStoredMonadProgress,
} from "./monad-progress";
import {
  calculateContractExp,
  CONTRACT_PROGRESS_STORAGE_KEY,
  contractProgressReducer,
  initialContractProgress,
  readStoredContractProgress,
} from "./contract-progress";
import {
  SCENE_STORAGE_KEY,
  type PortalId,
  type SceneDestination,
} from "./exploration";
import { FARM_MUSIC_STORAGE_KEY, useFarmMusic } from "./useFarmMusic";
import { FishingPanel } from "./FishingPanel";
import { TitleScreen } from "./TitleScreen";
import { monadCropAssetForStage, type LedgerStarCropStage } from "./field-assets";
import { SecurityGreenhousePanel } from "./security/SecurityGreenhousePanel";
import { Web3SecurityModule } from "./security/Web3SecurityModule";
import {
  GREENHOUSE_STAGE_COPY,
  initialSecurityProgress,
  readStoredSecurityProgress,
  SECURITY_PROGRESS_STORAGE_KEY,
  securityLabStage,
  securityProgressReducer,
} from "./security/security-progress";
import { clearSessionToken } from "./session";
import type {
  GreenhouseStage,
  SecurityProgress as SecurityProgressState,
} from "./security/types";
import { useWorldClock, type WorldPhase } from "./world-clock";
import {
  FISHING_STORAGE_KEY,
  FISH_SPECIES,
  initialFishingProgress,
  latestChainFishingReceipt,
  readStoredFishingProgress,
  type FishingProgress,
} from "./fishing";

type View = "home" | "profile" | SceneDestination;
type ActiveCourse = "web3" | "monad" | "contract";
type EntryScreen = "title" | "menu" | "game";

function MonadCropPreview({ stage }: { stage: LedgerStarCropStage }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={`monad-preview-crop crop-${stage}`} src={monadCropAssetForStage(stage)} alt="" draggable={false} />
  );
}

type Feedback = {
  tone: "success" | "gentle" | "danger";
  message: string;
} | null;

type ToastMessage = {
  id: number;
  message: string;
  tone: "success" | "warning" | "info";
};

const STORAGE_KEY = "monad-pixel-farm:v35:web3-progress";

function ToastNotice({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const collapseTimer = window.setTimeout(() => setCollapsed(true), 1800);
    const dismissTimer = window.setTimeout(onDismiss, 4200);
    return () => {
      window.clearTimeout(collapseTimer);
      window.clearTimeout(dismissTimer);
    };
  }, [toast.id, onDismiss]);

  return (
    <button
      className={joinClasses("toast", `toast-${toast.tone}`, collapsed && "is-collapsed")}
      onClick={() => collapsed ? onDismiss() : setCollapsed(true)}
      role="status"
      aria-live="polite"
      aria-label={collapsed ? `${toast.message}，点击关闭` : undefined}
    >
      <span className="toast-icon">{toast.tone === "success" ? "✓" : toast.tone === "warning" ? "!" : "→"}</span>
      <span className="toast-message">{toast.message}</span>
    </button>
  );
}

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function Icon({ children }: { children: ReactNode }) {
  return <span className="pixel-icon" aria-hidden="true">{children}</span>;
}

function Pill({
  children,
  tone = "violet",
}: {
  children: ReactNode;
  tone?: "violet" | "green" | "gold" | "blue" | "muted" | "danger";
}) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

function SectionTitle({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="section-title">
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
      </div>
      {children}
    </header>
  );
}

function StageRail({ progress }: { progress: FarmProgress }) {
  const stage = fieldVisualStage(progress);
  const active = FIELD_STAGE_ORDER.indexOf(stage);

  return (
    <div className="stage-rail" aria-label={`课程田状态：${FIELD_STAGE_LABELS[stage]}`}>
      {FIELD_STAGE_ORDER.map((item, index) => {
        const complete = index < active || (stage === "harvested" && index === active);
        return (
        <div
          className={joinClasses(
            "stage-node",
            complete && "is-complete",
            index === active && "is-active",
          )}
          aria-current={index === active ? "step" : undefined}
          key={item}
        >
          <span>{complete ? "✓" : index + 1}</span>
          <small>{FIELD_STAGE_LABELS[item]}</small>
        </div>
        );
      })}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
  tone = "normal",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  tone?: "normal" | "danger";
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex='-1'])",
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", handleKey);
    const initialFocus = dialogRef.current?.querySelector<HTMLElement>("[data-autofocus]")
      ?? dialogRef.current?.querySelector<HTMLElement>("button:not([disabled])");
    initialFocus?.focus();
    return () => {
      window.removeEventListener("keydown", handleKey);
      previousFocusRef.current?.focus();
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        className={joinClasses("dialog-card", tone === "danger" && "dialog-danger")}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="dialog-close" onClick={onClose} aria-label="关闭弹层">
          ×
        </button>
        <h2 id={titleId}>{title}</h2>
        {children}
      </section>
    </div>,
    document.body,
  );
}

function KnowledgeCardView({ chapter }: { chapter: Chapter }) {
  const rows = [
    ["这是什么", chapter.knowledge.definition],
    ["为什么要知道", chapter.knowledge.reason],
    ["你会看到什么", chapter.knowledge.visibleResult],
    ["什么会改变状态", chapter.knowledge.stateChange],
    ["操作前检查", chapter.knowledge.checkBeforeAction],
  ];
  return (
    <div className="knowledge-grid">
      {rows.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <p>{value}</p>
        </div>
      ))}
    </div>
  );
}

type MonadFieldPreviewStage = "sprout" | "bloom" | "fruit" | "harvested";

function monadFieldPreviewStage(name: string | null): MonadFieldPreviewStage | null {
  if (name === "monad-sprout") return "sprout";
  if (name === "monad-bloom") return "bloom";
  if (name === "monad-fruit") return "fruit";
  if (name === "monad-harvested") return "harvested";
  return null;
}

function previewProgress(name: string | null): FarmProgress | null {
  if (!name || name === "home") return null;
  if (name === "field-wild") return initialProgress;
  const seedOwned: FarmProgress = {
    ...initialProgress,
    started: true,
    seedGranted: true,
    recentActivity: ["获得 Web3 通识课程种子"],
  };
  if (name === "seed-shop" || name === "field-confirm") return seedOwned;
  const tilled: FarmProgress = {
    ...seedOwned,
    landCleared: true,
    recentActivity: ["开垦第 1 格 Web3 通识课程田"],
  };
  if (name === "field-tilled") return tilled;
  const planted: FarmProgress = {
    ...tilled,
    planted: true,
    recentActivity: ["播下账本星种"],
  };
  if (name === "field-seeded") return planted;
  if (name === "chapter" || name === "safety") return planted;
  const read: FarmProgress = {
    ...planted,
    chaptersRead: [true, true, true],
    recentActivity: ["完成全部理论，知识种子已经发芽"],
  };
  if (name === "field-sprout") return read;
  if (name === "challenge" || name === "safety-challenge") return read;
  const challenged: FarmProgress = {
    ...read,
    challengePassed: [true, true, true],
    recentActivity: ["完成全部章节挑战，知识作物已经开花"],
  };
  if (name === "field-bloom") return challenged;
  if (name === "verification" || name === "quiz") {
    return { ...challenged, verification: name === "quiz" ? "quiz" : "none" };
  }
  const fruited: FarmProgress = {
    ...challenged,
    verification: "passed",
    recentActivity: ["结课验证通过，知识作物已经结果"],
  };
  if (name === "field-fruit") return fruited;
  if (name === "harvest") return fruited;
  if (name === "profile" || name === "field-harvested" || monadFieldPreviewStage(name)) {
    return {
      ...fruited,
      harvested: true,
      recentActivity: ["收获守护浆果并解锁 Monad 基础"],
    };
  }
  return null;
}

function mapPreviewView(name: string | null): View | null {
  if (!name) return null;
  const views: Record<string, View> = {
    home: "home",
    explore: "home",
    walking: "home",
    "near-portal": "home",
    drawer: "courses",
    "profile-avatar": "profile",
    chapter: "chapter",
    safety: "chapter",
    challenge: "challenge",
    "safety-challenge": "challenge",
    verification: "verification",
    quiz: "quiz",
    harvest: "harvest",
    profile: "profile",
    "field-wild": "home",
    "field-tilled": "home",
    "field-seeded": "home",
    "field-sprout": "home",
    "field-bloom": "home",
    "field-fruit": "home",
    "field-harvested": "home",
    "monad-sprout": "home",
    "monad-bloom": "home",
    "monad-fruit": "home",
    "monad-harvested": "home",
    "field-confirm": "land",
    "seed-shop": "seeds",
    fishing: "fishing",
    "fish-book": "fishing",
    security: "security",
    "security-report": "security-report",
  };
  return views[name] ?? null;
}

export function FarmGame() {
  const [progress, dispatch] = useReducer(progressReducer, initialProgress);
  const [monadProgress, monadDispatch] = useReducer(monadProgressReducer, initialMonadProgress);
  const [contractProgress, contractDispatch] = useReducer(contractProgressReducer, initialContractProgress);
  const [securityProgress, securityDispatch] = useReducer(securityProgressReducer, initialSecurityProgress);
  const [fishingProgress, setFishingProgress] = useState<FishingProgress>(initialFishingProgress);
  const [activeCourse, setActiveCourse] = useState<ActiveCourse>("web3");
  const [view, setView] = useState<View>("home");
  const [entryScreen, setEntryScreen] = useState<EntryScreen>("title");
  const [hasSavedJourney, setHasSavedJourney] = useState(false);
  const [restartConfirmOpen, setRestartConfirmOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewName, setPreviewName] = useState<string | null>(null);
  const [timeMode, setTimeMode] = useState<WorldPhase | null>(null);
  const [activeChapter, setActiveChapter] = useState(0);
  const [challengeChapter, setChallengeChapter] = useState(0);
  const [challengeQuestion, setChallengeQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [questionResolved, setQuestionResolved] = useState(false);
  const [knowledgeChapter, setKnowledgeChapter] = useState<number | null>(null);
  const [agentOpen, setAgentOpen] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizErrors, setQuizErrors] = useState<string[]>([]);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastIdRef = useRef(0);
  const [travelRequest, setTravelRequest] = useState<WorldTravelRequest | null>(null);
  const [resetToken, setResetToken] = useState(0);
  const [lastPortalId, setLastPortalId] = useState<PortalId | null>(null);
  const travelTokenRef = useRef(0);
  const farmMusic = useFarmMusic();
  const worldClock = useWorldClock(timeMode);
  const showToast = useCallback((message: string, tone: ToastMessage["tone"] = "success") => {
    toastIdRef.current += 1;
    setToast({ id: toastIdRef.current, message, tone });
  }, []);
  const dismissToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const params = new URLSearchParams(window.location.search);
      const previewName = params.get("preview");
      const requestedTime = params.get("time");
      setPreviewName(previewName);
      setTimeMode(
        requestedTime === "dawn" || requestedTime === "day" || requestedTime === "dusk" || requestedTime === "night"
          ? requestedTime
          : null,
      );
      const preset = previewProgress(previewName);
      const presetView = mapPreviewView(previewName);
      if (preset || presetView) {
        setPreviewMode(true);
        setEntryScreen("game");
        if (preset) dispatch({ type: "reset" });
        if (preset) {
          if (preset.started) dispatch({ type: "start-course" });
          if (preset.landCleared) dispatch({ type: "clear-land" });
          if (preset.planted) dispatch({ type: "plant" });
          preset.chaptersRead.forEach((done, chapter) => {
            if (done) dispatch({ type: "complete-theory", chapter });
          });
          preset.challengePassed.forEach((done, chapter) => {
            if (done) dispatch({ type: "complete-challenge", chapter });
          });
          if (preset.verification === "quiz") dispatch({ type: "start-quiz" });
          if (preset.verification === "passed") dispatch({ type: "pass-verification" });
          if (preset.harvested) dispatch({ type: "harvest" });
        }
        if (previewName === "challenge") setChallengeChapter(1);
        if (previewName === "safety") setActiveChapter(2);
        if (previewName === "safety-challenge") setChallengeChapter(2);
        const monadPreviewStage = monadFieldPreviewStage(previewName);
        if (monadPreviewStage) {
          monadDispatch({ type: "reset" });
          monadDispatch({ type: "start-course" });
          monadDispatch({ type: "clear-land" });
          monadDispatch({ type: "plant" });
          [0, 1, 2].forEach((chapter) => monadDispatch({ type: "complete-theory", chapter }));
          if (monadPreviewStage === "bloom" || monadPreviewStage === "fruit" || monadPreviewStage === "harvested") {
            [0, 1, 2].forEach((chapter) => monadDispatch({ type: "complete-challenge", chapter }));
          }
          if (monadPreviewStage === "fruit" || monadPreviewStage === "harvested") {
            monadDispatch({ type: "pass-verification" });
          }
          if (monadPreviewStage === "harvested") monadDispatch({ type: "harvest" });
          setActiveCourse("monad");
        }
        if (previewName === "security" || previewName === "security-report") {
          securityDispatch({ type: "unlock" });
          if (previewName === "security-report") {
            securityDispatch({ type: "complete-scenario", scenarioId: "reentrancy-bank-v1", score: 100, passed: true });
            securityDispatch({ type: "complete-scenario", scenarioId: "access-control-mint-v1", score: 95, passed: true });
            securityDispatch({ type: "complete-scenario", scenarioId: "signature-replay-v1", score: 90, passed: true });
            securityDispatch({ type: "complete-scenario", scenarioId: "tx-origin-phish-v1", score: 90, passed: true });
            securityDispatch({
              type: "complete-audit",
              score: 88,
              passed: true,
              reportId: null,
              reportHash: "preview",
              falsePositivePenalty: 0,
            });
          }
        }
        if (presetView) setView(presetView);
        setHydrated(true);
        return;
      }
      const stored = readStoredProgress(window.localStorage.getItem(STORAGE_KEY));
      const storedMonad = readStoredMonadProgress(window.localStorage.getItem(MONAD_PROGRESS_STORAGE_KEY));
      const storedContract = readStoredContractProgress(window.localStorage.getItem(CONTRACT_PROGRESS_STORAGE_KEY));
      const storedFishing = readStoredFishingProgress(window.localStorage.getItem(FISHING_STORAGE_KEY));
      setHasSavedJourney(
        stored.started ||
        storedMonad.started ||
        storedContract.started ||
        storedFishing.totalCatches > 0,
      );
      setFishingProgress(storedFishing);
      dispatch({ type: "reset" });
      if (stored.started) dispatch({ type: "start-course" });
      if (stored.landCleared) dispatch({ type: "clear-land" });
      if (stored.planted) dispatch({ type: "plant" });
      stored.chaptersRead.forEach((done, chapter) => {
        if (done) dispatch({ type: "complete-theory", chapter });
      });
      stored.challengeMistakes.forEach((done, chapter) => {
        if (done) dispatch({ type: "challenge-mistake", chapter });
      });
      stored.challengePassed.forEach((done, chapter) => {
        if (done) dispatch({ type: "complete-challenge", chapter });
      });
      if (stored.verification === "quiz") dispatch({ type: "start-quiz" });
      if (stored.verification === "passed") dispatch({ type: "pass-verification" });
      if (stored.harvested) dispatch({ type: "harvest" });
      monadDispatch({ type: "reset" });
      if (storedMonad.started) monadDispatch({ type: "start-course" });
      if (storedMonad.landCleared) monadDispatch({ type: "clear-land" });
      if (storedMonad.planted) monadDispatch({ type: "plant" });
      storedMonad.chaptersRead.forEach((done, chapter) => {
        if (done) monadDispatch({ type: "complete-theory", chapter });
      });
      storedMonad.challengeMistakes.forEach((done, chapter) => {
        if (done) monadDispatch({ type: "challenge-mistake", chapter });
      });
      storedMonad.challengePassed.forEach((done, chapter) => {
        if (done) monadDispatch({ type: "complete-challenge", chapter });
      });
      if (storedMonad.verification === "quiz") monadDispatch({ type: "start-quiz" });
      if (storedMonad.verification === "passed") monadDispatch({ type: "pass-verification" });
      if (storedMonad.harvested) monadDispatch({ type: "harvest" });
      contractDispatch({ type: "reset" });
      if (storedContract.started) contractDispatch({ type: "start-course" });
      if (storedContract.landCleared) contractDispatch({ type: "clear-land" });
      if (storedContract.planted) contractDispatch({ type: "plant" });
      storedContract.chaptersRead.forEach((done, chapter) => {
        if (done) contractDispatch({ type: "complete-theory", chapter });
      });
      storedContract.challengeMistakes.forEach((done, chapter) => {
        if (done) contractDispatch({ type: "challenge-mistake", chapter });
      });
      storedContract.challengePassed.forEach((done, chapter) => {
        if (done) contractDispatch({ type: "complete-challenge", chapter });
      });
      if (storedContract.verification === "quiz") contractDispatch({ type: "start-quiz" });
      if (storedContract.verification === "passed") contractDispatch({ type: "pass-verification" });
      if (storedContract.harvested) contractDispatch({ type: "harvest" });
      const storedSecurity = readStoredSecurityProgress(
        window.localStorage.getItem(SECURITY_PROGRESS_STORAGE_KEY),
      );
      if (storedSecurity.unlocked) securityDispatch({ type: "unlock" });
      Object.entries(storedSecurity.scenarios).forEach(([scenarioId, entry]) => {
        if (entry.status === "passed" || entry.status === "failed") {
          securityDispatch({
            type: "complete-scenario",
            scenarioId,
            score: entry.score,
            passed: entry.status === "passed",
            synced: entry.syncedToServer,
          });
        }
      });
      if (storedSecurity.finalAudit.status === "passed" || storedSecurity.finalAudit.status === "failed") {
        securityDispatch({
          type: "complete-audit",
          score: storedSecurity.finalAudit.score,
          passed: storedSecurity.finalAudit.status === "passed",
          reportId: storedSecurity.finalAudit.reportId,
          reportHash: storedSecurity.finalAudit.reportHash,
          falsePositivePenalty: storedSecurity.finalAudit.falsePositivePenalty,
        });
      }
      if (storedMonad.harvested) setActiveCourse("contract");
      else if (stored.harvested) setActiveCourse("monad");
      setHydrated(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!hydrated || previewMode) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }, [hydrated, previewMode, progress]);

  useEffect(() => {
    if (!hydrated || previewMode) return;
    window.localStorage.setItem(MONAD_PROGRESS_STORAGE_KEY, JSON.stringify(monadProgress));
  }, [hydrated, monadProgress, previewMode]);

  useEffect(() => {
    if (!hydrated || previewMode) return;
    window.localStorage.setItem(CONTRACT_PROGRESS_STORAGE_KEY, JSON.stringify(contractProgress));
  }, [contractProgress, hydrated, previewMode]);

  useEffect(() => {
    if (!hydrated || previewMode) return;
    window.localStorage.setItem(FISHING_STORAGE_KEY, JSON.stringify(fishingProgress));
  }, [fishingProgress, hydrated, previewMode]);

  useEffect(() => {
    if (!hydrated || previewMode) return;
    window.localStorage.setItem(SECURITY_PROGRESS_STORAGE_KEY, JSON.stringify(securityProgress));
  }, [hydrated, previewMode, securityProgress]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (
        event.key !== "Escape" ||
        knowledgeChapter !== null ||
        agentOpen ||
        document.querySelector("[role='dialog']")
      ) return;
      if (view === "home") {
        if (!previewMode) setEntryScreen("menu");
        return;
      }
      closeDrawer();
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  // closeDrawer reads the latest portal id from this render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, knowledgeChapter, agentOpen, lastPortalId, previewMode]);

  const exp = calculateExp(progress) + calculateMonadExp(monadProgress) + calculateContractExp(contractProgress);
  const fieldStage = fieldVisualStage(progress);
  const monadFieldStage = fieldVisualStage(monadProgress);
  const contractFieldStage = fieldVisualStage(contractProgress);
  const activeProgress = activeCourse === "web3" ? progress : activeCourse === "monad" ? monadProgress : contractProgress;
  const activeChapters = activeCourse === "web3" ? web3Chapters : activeCourse === "monad" ? monadChapters : contractChapters;
  const activeQuiz = activeCourse === "web3" ? finalQuiz : activeCourse === "monad" ? monadFinalQuiz : contractFinalQuiz;
  const activeAgentQuestions = activeCourse === "web3" ? agentQuestions : activeCourse === "monad" ? monadAgentQuestions : contractAgentQuestions;
  const activeCourseTitle = activeCourse === "web3" ? "Web3 通识" : activeCourse === "monad" ? "Monad 基础" : "智能合约";
  const activeCourseOrder = activeCourse === "web3" ? 1 : activeCourse === "monad" ? 2 : 3;
  const unlockedFishCount = FISH_SPECIES.filter((fish) => fishingProgress.collection[fish.id].count > 0).length;
  const latestChainReceipt = latestChainFishingReceipt(fishingProgress);
  const level = contractProgress.harvested ? 4 : monadProgress.harvested ? 3 : progress.harvested ? 2 : 1;
  const levelName = contractProgress.harvested ? "合约建造师" : monadProgress.harvested ? "Monad 探索者" : progress.harvested ? "Web3 学徒" : "初来乍到";
  const journeyAvailable = hasSavedJourney || progress.started || monadProgress.started || contractProgress.started || fishingProgress.totalCatches > 0;
  const securityUnlocked = contractProgress.harvested;
  const securityStage = securityLabStage(securityProgress);
  const currentChapter = activeChapters[activeChapter];
  const challenge = activeChapters[challengeChapter];
  const currentQuestion = challenge.challenges[challengeQuestion];

  const primaryAction = useMemo(() => {
    const course: ActiveCourse = !progress.harvested ? "web3" : !monadProgress.harvested ? "monad" : "contract";
    const current = course === "web3" ? progress : course === "monad" ? monadProgress : contractProgress;
    if (course === "contract" && contractProgress.harvested) return { label: "查看成长档案", view: "profile" as View, course };
    if (!current.started) return { label: course === "web3" ? "开启 Web3 通识" : course === "monad" ? "开启 Monad 基础" : "开启智能合约", view: "courses" as View, course };
    if (!current.landCleared || !current.planted) {
      return { label: current.landCleared ? "前往播种" : "前往开荒", view: "land" as View, course };
    }
    const unread = current.chaptersRead.findIndex((done) => !done);
    if (unread >= 0) return { label: "继续学习", view: "chapter" as View, chapter: unread, course };
    const unfinished = current.challengePassed.findIndex((done) => !done);
    if (unfinished >= 0) {
      return { label: "继续挑战", view: "challenge" as View, chapter: unfinished, course };
    }
    if (current.verification !== "passed") {
      return {
        label: current.verification === "quiz" ? "继续结课小测" : "开始最终验证",
        view: current.verification === "quiz" ? ("quiz" as View) : ("verification" as View),
        course,
      };
    }
    if (!current.harvested) return { label: "收获知识果实", view: "harvest" as View, course };
    return { label: "查看成长档案", view: "profile" as View, course };
  }, [contractProgress, monadProgress, progress]);

  const drawerOpen = view !== "home";
  const workshopDestination: SceneDestination = !activeProgress.chaptersRead.every(Boolean)
    ? "courses"
    : !activeProgress.challengePassed.every(Boolean)
      ? "challenge"
      : activeProgress.verification === "quiz"
        ? "quiz"
        : activeProgress.verification !== "passed"
          ? "verification"
          : "harvest";
  const portalDestinations: Record<PortalId, SceneDestination> = {
    "knowledge-tower": "courses",
    "seed-shop": "seeds",
    "fishing-pond": "fishing",
    "course-fields": "land",
    "progress-workshop": workshopDestination,
    "security-greenhouse": "security",
  };
  const portalStatuses: Record<PortalId, string> = {
    "knowledge-tower": activeProgress.started ? `继续${activeCourseTitle}` : `开启${activeCourseTitle}`,
    "seed-shop": activeProgress.seedGranted ? (activeCourse === "web3" ? "账本星种已领取" : activeCourse === "monad" ? "并行紫藤种已领取" : "合约卷轴种已领取") : "等待领取种子",
    "fishing-pond": `${fishingProgress.totalCatches} 次垂钓 · 图鉴 ${unlockedFishCount}/${FISH_SPECIES.length}`,
    "course-fields": activeCourse === "web3"
      ? `第 1 格 · Web3 通识 · ${FIELD_STAGE_LABELS[fieldStage]}`
      : activeCourse === "monad"
        ? `第 2 格 · Monad 基础 · ${FIELD_STAGE_LABELS[monadFieldStage]}`
        : `第 3 格 · 智能合约 · ${FIELD_STAGE_LABELS[contractFieldStage]}`,
    "progress-workshop": activeProgress.challengePassed.every(Boolean)
      ? activeProgress.verification === "passed" ? "验证已完成" : "开始最终验证"
      : "章节挑战",
    "security-greenhouse": securityStage === "locked"
      ? "废弃温室 · 完成课程后解锁"
      : `Web3 安全训练场 · ${GREENHOUSE_STAGE_COPY[securityStage].label}`,
  };
  const drawerContext = view === "profile"
    ? { icon: "☻", location: "成长档案", detail: `${levelName} · ${exp} EXP` }
    : view === "courses"
      ? { icon: "▤", location: "知识塔", detail: `第 ${activeCourseOrder} 关课程路线` }
      : view === "chapter"
        ? { icon: "▤", location: "知识塔", detail: `第 ${activeChapter + 1} 章 · ${activeCourseTitle}` }
      : view === "seeds"
          ? { icon: "✦", location: "种子小铺", detail: `第 ${activeCourseOrder} 格课程种子` }
          : view === "fishing"
            ? { icon: "≈", location: "回执池塘", detail: `${fishingProgress.totalCatches} 次垂钓 · 图鉴 ${unlockedFishCount}/${FISH_SPECIES.length}` }
          : view === "land"
            ? { icon: "⌁", location: "课程土地", detail: `第 ${activeCourseOrder} 格 · ${FIELD_STAGE_LABELS[fieldVisualStage(activeProgress)]}` }
            : view === "challenge"
              ? { icon: "◆", location: "进步工坊", detail: `第 ${challengeChapter + 1} 章挑战` }
              : view === "verification"
                ? { icon: "◆", location: "进步工坊", detail: `${activeCourseTitle}最终验证` }
                : view === "quiz"
                  ? { icon: "◆", location: "进步工坊", detail: `${activeCourseTitle}结课小测` }
                  : view === "security" || view === "security-report"
                    ? { icon: "❖", location: "Web3 安全温室", detail: `安全温室 · ${GREENHOUSE_STAGE_COPY[securityStage].label}` }
                    : { icon: "◆", location: "进步工坊", detail: `${activeCourseTitle}课程收获` };
  const drawerStatus = view === "fishing"
    ? `图鉴 ${unlockedFishCount}/${FISH_SPECIES.length}`
    : view === "security" || view === "security-report"
      ? GREENHOUSE_STAGE_COPY[securityStage].label
      : FIELD_STAGE_LABELS[fieldVisualStage(activeProgress)];

  function navigate(nextView: View, chapter?: number) {
    if (typeof chapter === "number") {
      if (nextView === "chapter") setActiveChapter(chapter);
      if (nextView === "challenge") {
        setChallengeChapter(chapter);
        setChallengeQuestion(0);
        setSelectedAnswer("");
        setFeedback(null);
        setQuestionResolved(false);
      }
    }
    setView(nextView);
  }

  function portalForView(nextView: SceneDestination): PortalId {
    if (nextView === "courses" || nextView === "chapter") return "knowledge-tower";
    if (nextView === "seeds") return "seed-shop";
    if (nextView === "fishing") return "fishing-pond";
    if (nextView === "land") return "course-fields";
    if (nextView === "security" || nextView === "security-report") return "security-greenhouse";
    return "progress-workshop";
  }

  function travelTo(nextView: View, chapter?: number) {
    if (nextView === "profile") {
      setView("profile");
      return;
    }
    if (nextView === "home") {
      closeDrawer();
      return;
    }
    const portalId = portalForView(nextView);
    travelTokenRef.current += 1;
    setView("home");
    setTravelRequest({
      token: travelTokenRef.current,
      portalId,
      destination: nextView,
      chapter,
    });
  }

  function enterDestination(nextView: SceneDestination, chapter?: number) {
    const portalId = portalForView(nextView);
    setLastPortalId(portalId);
    navigate(nextView, chapter);
  }

  function closeDrawer() {
    setView("home");
    window.requestAnimationFrame(() => {
      if (lastPortalId) {
        document.querySelector<HTMLButtonElement>(`.portal-${lastPortalId}`)?.focus();
      }
    });
  }

  function handleShellBackgroundClick(event: ReactMouseEvent<HTMLElement>) {
    if (!drawerOpen || !(event.target instanceof Element)) return;
    if (
      event.target.closest(
        ".content-drawer, .topbar, .dock, .toast, .desktop-notice, .modal-backdrop, button, a, input, select, textarea, [role='dialog']",
      )
    ) return;
    closeDrawer();
  }

  function handlePrimaryAction() {
    setActiveCourse(primaryAction.course);
    travelTo(primaryAction.view, primaryAction.chapter);
  }

  function continueLearningFromLand(course: ActiveCourse, courseProgress: FarmProgress) {
    const unreadChapter = courseProgress.chaptersRead.findIndex((completed) => !completed);
    if (unreadChapter >= 0) {
      setActiveCourse(course);
      travelTo("chapter", unreadChapter);
      return;
    }
    handlePrimaryAction();
  }

  function courseDispatch(action: Parameters<typeof progressReducer>[1]) {
    if (activeCourse === "web3") dispatch(action);
    else if (activeCourse === "monad") monadDispatch(action);
    else contractDispatch(action);
  }

  function startCourse(course: ActiveCourse) {
    setActiveCourse(course);
    if (course === "web3") {
      dispatch({ type: "start-course" });
      showToast("账本星种已经放进背包");
    } else if (course === "monad") {
      if (!progress.harvested) return;
      monadDispatch({ type: "start-course" });
      showToast("并行紫藤种已经放进背包");
    } else {
      if (!monadProgress.harvested) return;
      contractDispatch({ type: "start-course" });
      showToast("合约卷轴种已经放进背包");
    }
    travelTo("seeds");
  }

  function completeTheory() {
    courseDispatch({ type: "complete-theory", chapter: activeChapter });
    showToast(`${activeCourseTitle}第 ${activeChapter + 1} 章理论已保存 · EXP +10`);
    const next = activeProgress.chaptersRead.findIndex(
      (done, index) => !done && index !== activeChapter,
    );
    if (next >= 0) setActiveChapter(next);
    else travelTo("challenge", 0);
  }

  function submitChallenge() {
    if (!selectedAnswer) {
      setFeedback({ tone: "gentle", message: "先选择一个判断，再提交。" });
      return;
    }
    if (selectedAnswer !== currentQuestion.answer) {
      courseDispatch({ type: "challenge-mistake", chapter: challengeChapter });
      setFeedback({
        tone: challenge.safety ? "danger" : "gentle",
        message: currentQuestion.failure,
      });
      setQuestionResolved(false);
      return;
    }
    const isLast = challengeQuestion === challenge.challenges.length - 1;
    if (isLast) courseDispatch({ type: "complete-challenge", chapter: challengeChapter });
    setFeedback({ tone: "success", message: currentQuestion.success });
    setQuestionResolved(true);
  }

  function continueChallenge() {
    const isLast = challengeQuestion === challenge.challenges.length - 1;
    setSelectedAnswer("");
    setFeedback(null);
    setQuestionResolved(false);
    if (!isLast) {
      setChallengeQuestion((value) => value + 1);
      return;
    }
    if (challengeChapter < 2) {
      setChallengeChapter((value) => value + 1);
      setChallengeQuestion(0);
      return;
    }
    setView("verification");
    showToast("全部章节挑战通过，知识作物已经开花");
  }

  function startQuiz() {
    courseDispatch({ type: "start-quiz" });
    setAgentOpen(false);
    setQuizErrors([]);
    setView("quiz");
  }

  function submitQuiz() {
    const wrong = activeQuiz
      .filter((question) => quizAnswers[question.id] !== question.answer)
      .map((question) => question.id);
    if (wrong.length > 0) {
      setQuizErrors(wrong);
      return;
    }
    courseDispatch({ type: "pass-verification" });
    setQuizErrors([]);
    showToast("结课小测全部正确 · EXP +50");
    setView("harvest");
  }

  function harvest() {
    courseDispatch({ type: "harvest" });
    if (activeCourse === "web3") {
      setActiveCourse("monad");
      showToast("守护浆果已保存，并解锁第 2 关 Monad 基础 · EXP +100");
    } else if (activeCourse === "monad") {
      setActiveCourse("contract");
      showToast("Monad 紫藤果已经保存，并解锁智能合约课程 · EXP +100");
    } else {
      showToast("合约晶果已经保存，三门首发课程全部完成 · EXP +100");
    }
    setView("profile");
  }

  function resetDemo() {
    dispatch({ type: "reset" });
    monadDispatch({ type: "reset" });
    contractDispatch({ type: "reset" });
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(MONAD_PROGRESS_STORAGE_KEY);
    window.localStorage.removeItem(CONTRACT_PROGRESS_STORAGE_KEY);
    window.localStorage.removeItem(FISHING_STORAGE_KEY);
    window.localStorage.removeItem(SCENE_STORAGE_KEY);
    window.localStorage.removeItem(FARM_MUSIC_STORAGE_KEY);
    window.localStorage.removeItem(SECURITY_PROGRESS_STORAGE_KEY);
    clearSessionToken();
    securityDispatch({ type: "reset" });
    setView("home");
    setActiveCourse("web3");
    setFishingProgress(initialFishingProgress);
    setHasSavedJourney(false);
    setResetToken((value) => value + 1);
    setQuizAnswers({});
    setQuizErrors([]);
    showToast("演示进度已经重置");
  }

  function enterFarm() {
    setRestartConfirmOpen(false);
    setView("home");
    setEntryScreen("game");
  }

  function continueJourney() {
    setRestartConfirmOpen(false);
    setEntryScreen("game");
    handlePrimaryAction();
  }

  function restartJourney() {
    resetDemo();
    setRestartConfirmOpen(false);
    setEntryScreen("game");
  }

  function openTitleMenu() {
    setTravelRequest(null);
    setView("home");
    setRestartConfirmOpen(false);
    setEntryScreen("menu");
  }

  return (
    <main className="app-shell" onClick={handleShellBackgroundClick}>
      <div className="desktop-notice">
        <strong>桌面演示优先</strong>
        <span>请使用不小于 1100px 的窗口查看完整农场地图。</span>
      </div>

      <header className="topbar pixel-frame">
        <button className="brand" onClick={openTitleMenu} aria-label="返回学习主菜单">
          <span className="brand-gem">M</span>
          <span><b>WEB3WORLD</b><small>探索、验证、把链上知识练成能力</small></span>
        </button>
        <div className="top-progress">
          <div className="hud-course-context">
            <span>第 {activeCourseOrder} 关 · 第 {activeCourseOrder} 格</span>
            <b>{activeCourseTitle}</b>
          </div>
          <StageRail progress={activeProgress} />
        </div>
        <div className="profile-hud">
          <div className={`world-clock phase-${worldClock.phase}`} aria-label={`农场时间 ${worldClock.label}，${worldClock.phaseLabel}`}>
            <span aria-hidden="true">{worldClock.isNight ? "☾" : "☀"}</span>
            <div><small>{worldClock.phaseLabel}</small><b>{worldClock.label}</b></div>
          </div>
          <button
            className="music-control"
            type="button"
            aria-pressed={farmMusic.enabled}
            aria-label={farmMusic.enabled ? "关闭农场环境音乐" : "播放农场环境音乐"}
            onClick={farmMusic.toggle}
          >
            <span aria-hidden="true">♪</span>
            <span>{farmMusic.enabled ? "音乐开启" : farmMusic.remembered ? "恢复音乐" : "环境音乐"}</span>
          </button>
          <div><small>LV.{level}</small><b>{levelName}</b></div>
          <div className="exp-box" aria-label={`${exp} EXP，共 765 EXP`}><span style={{ width: `${Math.min(100, (exp / 765) * 100)}%` }} /><b>{exp} / 765 EXP</b></div>
          <button className="icon-button avatar-button" onClick={() => setView("profile")} aria-label="打开成长档案">
            <span className="avatar-portrait" aria-hidden="true" />
          </button>
        </div>
      </header>

      <FarmWorld
        drawerOpen={drawerOpen || entryScreen !== "game"}
        previewMode={previewMode}
        primaryLabel={primaryAction.label}
        stage={growthStage(activeProgress)}
        courseTitle={activeCourseTitle}
        courseOrder={activeCourseOrder}
        fieldStage={fieldStage}
        monadFieldStage={monadFieldStage}
        monadStarted={monadProgress.started}
        contractFieldStage={contractFieldStage}
        contractStarted={contractProgress.started}
        securityStage={securityStage}
        worldClock={worldClock}
        portalDestinations={portalDestinations}
        portalStatuses={portalStatuses}
        travelRequest={travelRequest}
        resetToken={resetToken}
        onPrimary={handlePrimaryAction}
        onEnter={enterDestination}
        onMessage={showToast}
      />

      {drawerOpen && (
        <aside className="content-drawer pixel-frame" aria-live="polite" aria-label="地点内容">
          <div className="drawer-toolbar">
            <span className="drawer-location-icon" aria-hidden="true">{drawerContext.icon}</span>
            <div><span>{drawerContext.location}</span><b>{drawerContext.detail}</b></div>
            <Pill tone="violet">{drawerStatus}</Pill>
            <button className="drawer-close" onClick={closeDrawer} autoFocus aria-label="关闭地点内容并继续探索">×</button>
          </div>
          <div className="drawer-task-summary">
            <span><i aria-hidden="true">✦</i> 当前目标</span>
            <div><b>{primaryAction.label}</b><small>第 {activeCourseOrder} 关 · {activeCourseTitle}</small></div>
            <button onClick={handlePrimaryAction}>自动带路</button>
          </div>
          {view !== "security" && view !== "security-report" && (
            <div className="security-entry pixel-frame">
              <div className="security-entry-art" aria-hidden="true" />
              <div>
                <span>WEB3 安全温室 · {GREENHOUSE_STAGE_COPY[securityStage].label}</span>
                <b>{securityUnlocked ? "先在游戏里踩一次坑，再在真实交易前避开它" : "废弃温室也有一条可见的安全训练路线"}</b>
                <small>{GREENHOUSE_STAGE_COPY[securityStage].detail}</small>
              </div>
              <button className="pixel-button primary" onClick={() => setView("security")}>
                查看 Web3 安全训练场
              </button>
            </div>
          )}
          <div className="drawer-scroll" key={view}>
            {view === "courses" && (
              <CoursesPanel
                progress={progress}
                monadProgress={monadProgress}
                contractProgress={contractProgress}
                activeCourse={activeCourse}
                onOpenCourse={(course) => {
                  setActiveCourse(course);
                  setActiveChapter(0);
                  setChallengeChapter(0);
                  setChallengeQuestion(0);
                  setQuizAnswers({});
                  setQuizErrors([]);
                  const selectedProgress = course === "web3" ? progress : course === "monad" ? monadProgress : contractProgress;
                  if (!selectedProgress.started) startCourse(course);
                }}
                onChapter={(chapter) => navigate("chapter", chapter)}
              />
            )}
            {view === "seeds" && (
              <SeedsPanel
                progress={progress}
                monadProgress={monadProgress}
                contractProgress={contractProgress}
                activeCourse={activeCourse}
                onLand={() => travelTo("land")}
                onSelectCourse={setActiveCourse}
                securityStage={securityStage}
                onOpenSecurity={() => setView("security")}
              />
            )}
            {view === "fishing" && (
              <FishingPanel
                progress={fishingProgress}
                onProgress={setFishingProgress}
                onMessage={showToast}
                securityStage={securityStage}
                onOpenSecurity={() => setView("security")}
              />
            )}
            {view === "land" && (
               activeCourse === "web3" ? (
                <LandPanel
                  progress={progress}
                  initialConfirmOpen={previewMode && previewName === "field-confirm"}
                  onClear={() => {
                    dispatch({ type: "clear-land" });
                    showToast("第 1 格 Web3 通识课程田已经开垦");
                  }}
                  onPlant={() => {
                    dispatch({ type: "plant" });
                    showToast("一颗账本星种已播下，完成课程会让这株作物成长");
                  }}
                  nextLabel={fieldStage === "seeded" && !progress.chaptersRead.some(Boolean) ? "进入第一章" : primaryAction.label}
                  onContinue={() => continueLearningFromLand("web3", progress)}
                  securityStage={securityStage}
                  onOpenSecurity={() => setView("security")}
                />
               ) : activeCourse === "monad" ? (
                <MonadLandPanel
                  progress={monadProgress}
                  onClear={() => {
                    monadDispatch({ type: "clear-land" });
                    showToast("第 2 格 Monad 基础课程田已经开垦");
                  }}
                  onPlant={() => {
                    monadDispatch({ type: "plant" });
                    showToast("一颗并行紫藤种已播下，第 2 关正式开始");
                  }}
                  onContinue={() => continueLearningFromLand("monad", monadProgress)}
                  securityStage={securityStage}
                  onOpenSecurity={() => setView("security")}
                 />
               ) : (
                 <ContractLandPanel
                   progress={contractProgress}
                   onClear={() => {
                     contractDispatch({ type: "clear-land" });
                     showToast("第 3 格智能合约课程田已经开垦");
                   }}
                   onPlant={() => {
                     contractDispatch({ type: "plant" });
                     showToast("一颗合约卷轴种已播下，第 3 关正式开始");
                   }}
                   onContinue={() => continueLearningFromLand("contract", contractProgress)}
                   securityStage={securityStage}
                   onOpenSecurity={() => setView("security")}
                 />
               )
            )}
            {view === "chapter" && (
              <ChapterPanel
                chapter={currentChapter}
                completed={activeProgress.chaptersRead[activeChapter]}
                onComplete={completeTheory}
                onKnowledge={() => setKnowledgeChapter(activeChapter)}
                onAgent={() => setAgentOpen(true)}
              />
            )}
            {view === "challenge" && (
              <ChallengePanel
                chapter={challenge}
                question={currentQuestion}
                questionIndex={challengeQuestion}
                selected={selectedAnswer}
                feedback={feedback}
                resolved={questionResolved}
                onSelect={(answer) => {
                  setSelectedAnswer(answer);
                  setFeedback(null);
                }}
                onSubmit={submitChallenge}
                onContinue={continueChallenge}
                onRetry={() => {
                  setSelectedAnswer("");
                  setFeedback(null);
                }}
                onKnowledge={() => setKnowledgeChapter(challengeChapter)}
                onAgent={() => setAgentOpen(true)}
              />
            )}
            {view === "verification" && (
              <VerificationPanel courseTitle={activeCourseTitle} onAgent={() => setAgentOpen(true)} onQuiz={startQuiz} />
            )}
            {view === "quiz" && (
              <QuizPanel
                questions={activeQuiz}
                courseTitle={activeCourseTitle}
                answers={quizAnswers}
                errors={quizErrors}
                onAnswer={(id, answer) => {
                  setQuizAnswers((values) => ({ ...values, [id]: answer }));
                  setQuizErrors((values) => values.filter((value) => value !== id));
                }}
                onSubmit={submitQuiz}
                onAgent={() => setAgentOpen(true)}
              />
            )}
            {view === "harvest" && (
              activeCourse === "web3"
                ? <HarvestPanel progress={progress} onHarvest={harvest} />
                : activeCourse === "monad"
                  ? <MonadHarvestPanel progress={monadProgress} onHarvest={harvest} />
                  : <ContractHarvestPanel progress={contractProgress} onHarvest={harvest} />
            )}
            {view === "security" && (
              <SecurityGreenhousePanel
                progress={securityProgress}
                dispatch={securityDispatch}
                contractHarvested={contractProgress.harvested}
                walletAddress={null}
                recentFishingTxHash={latestChainReceipt?.txHash ?? null}
                auditor={`Monad Farmer Lv.${level}`}
                initialTab="journey"
                onMessage={showToast}
              />
            )}
            {view === "security-report" && (
              <SecurityGreenhousePanel
                progress={securityProgress}
                dispatch={securityDispatch}
                contractHarvested={contractProgress.harvested}
                walletAddress={null}
                recentFishingTxHash={latestChainReceipt?.txHash ?? null}
                auditor={`Monad Farmer Lv.${level}`}
                initialTab="audit"
                onMessage={showToast}
              />
            )}
            {view === "profile" && (
              <ProfilePanel
                progress={progress}
                monadProgress={monadProgress}
                contractProgress={contractProgress}
                exp={exp}
                onOpenMonad={() => {
                  setActiveCourse("monad");
                  if (!monadProgress.started) startCourse("monad");
                  else setView("courses");
                }}
                onOpenContract={() => {
                  setActiveCourse("contract");
                  if (!contractProgress.started) startCourse("contract");
                  else setView("courses");
                }}
                securityProgress={securityProgress}
                onOpenSecurity={() => setView("security")}
                onReset={resetDemo}
              />
            )}
          </div>
        </aside>
      )}

      <nav className="dock pixel-frame" aria-label="平台主导航">
        <button className={view === "home" ? "active" : ""} onClick={closeDrawer}><span>⌂</span>农场</button>
        <button className={view === "courses" || view === "chapter" ? "active" : ""} onClick={() => travelTo("courses")}><span>▤</span>知识塔</button>
        <button className={view === "fishing" ? "active" : ""} onClick={() => travelTo("fishing")}><span>≈</span>回执池塘</button>
        <button className={view === "seeds" ? "active" : ""} onClick={() => travelTo("seeds")}><span>✦</span>种子小铺</button>
        <button className={view === "challenge" || view === "verification" || view === "quiz" || view === "harvest" || view === "security" || view === "security-report" ? "active" : ""} onClick={() => travelTo(workshopDestination)}><span>◆</span>进步工坊</button>
      </nav>

      {toast && <ToastNotice key={toast.id} toast={toast} onDismiss={dismissToast} />}
      {knowledgeChapter !== null && (
        <Modal
          title={`知识卡 · ${activeChapters[knowledgeChapter].title}`}
          onClose={() => setKnowledgeChapter(null)}
          tone={activeChapters[knowledgeChapter].safety ? "danger" : "normal"}
        >
          <KnowledgeCardView chapter={activeChapters[knowledgeChapter]} />
        </Modal>
      )}
      {agentOpen && (
        <Modal title="和学习助手聊聊" onClose={() => setAgentOpen(false)}>
          <div className="service-state">
            <Pill tone="muted">前端演示状态</Pill>
            <h3>学习助手当前未连接真实服务</h3>
            <p>你的课程和挑战进度已经保存。今晚版本不会伪造 Agent 判断结果，也不会阻断结课。</p>
          </div>
          <div className="agent-preview" aria-label="标准化提问预览">
            <span className="agent-avatar">M</span>
            <div>
              <small>标准化问题预览</small>
              <p>{activeAgentQuestions[0]}</p>
            </div>
          </div>
          <div className="dialog-actions">
            <button className="pixel-button secondary" onClick={() => setAgentOpen(false)}>返回当前页面</button>
            {activeProgress.challengePassed.every(Boolean) && activeProgress.verification !== "passed" && (
              <button className="pixel-button primary" onClick={startQuiz}>切换到结课小测</button>
            )}
          </div>
        </Modal>
      )}
      {previewMode && <div className="preview-badge">视觉验收模式 · 不写入进度</div>}
      {!previewMode && entryScreen !== "game" && (
        <TitleScreen
          menuOpen={entryScreen === "menu"}
          restartConfirmOpen={restartConfirmOpen}
          hydrated={hydrated}
          hasSavedJourney={journeyAvailable}
          courseLabel={`第 ${activeCourseOrder} 关 · ${activeCourseTitle}`}
          nextActionLabel={primaryAction.label}
          onRevealMenu={() => setEntryScreen("menu")}
          onStart={enterFarm}
          onContinue={continueJourney}
          onRequestRestart={() => setRestartConfirmOpen(true)}
          onCancelRestart={() => setRestartConfirmOpen(false)}
          onConfirmRestart={restartJourney}
          onExit={() => setEntryScreen("title")}
        />
      )}
    </main>
  );
}

function CoursesPanel({
  progress,
  monadProgress,
  contractProgress,
  activeCourse,
  onOpenCourse,
  onChapter,
}: {
  progress: FarmProgress;
  monadProgress: FarmProgress;
  contractProgress: FarmProgress;
  activeCourse: ActiveCourse;
  onOpenCourse: (course: ActiveCourse) => void;
  onChapter: (chapter: number) => void;
}) {
  const selectedProgress = activeCourse === "web3" ? progress : activeCourse === "monad" ? monadProgress : contractProgress;
  const selectedChapters = activeCourse === "web3" ? web3Chapters : activeCourse === "monad" ? monadChapters : contractChapters;
  const availableCount = monadProgress.harvested ? 3 : progress.harvested ? 2 : 1;
  return (
    <div className="panel-stack">
      <SectionTitle eyebrow="知识塔 · 课程路线" title="从通识走向合约">
        <Pill tone="violet">{availableCount} / 3 已解锁</Pill>
      </SectionTitle>
      <div className="course-route">
        {courseRoute.map((course, index) => {
          const unlocked = index === 0 || index === 1 && progress.harvested || index === 2 && monadProgress.harvested;
          const complete = index === 0 ? progress.harvested : index === 1 ? monadProgress.harvested : contractProgress.harvested;
          const selected = course.id === activeCourse;
          return (
            <article className={joinClasses("route-card", !unlocked && "is-locked", complete && "is-complete", selected && "is-selected")} key={course.id}>
              <span className="route-number">{complete ? "✓" : course.order}</span>
              <div><small>{course.seed}</small><h2>{course.title}</h2><p>{course.description}</p></div>
              <div className="route-card-action">
                <Pill tone={complete ? "green" : unlocked ? "blue" : "muted"}>{complete ? "已收获" : unlocked ? "可以学习" : "前置课程未收获"}</Pill>
                {unlocked && (
                  <button className="pixel-button ghost" onClick={() => onOpenCourse(course.id)}>
                    {selected ? "当前课程" : complete ? "查看课程" : course.id === "web3" ? "进入课程" : `进入第 ${course.order} 关`}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {!selectedProgress.started ? (
        <button className="pixel-button primary wide" onClick={() => onOpenCourse(activeCourse)}>
          开启{activeCourse === "web3" ? " Web3 通识" : activeCourse === "monad" ? "第 2 关 Monad 基础" : "第 3 关智能合约"}并领取种子
        </button>
      ) : !selectedProgress.planted ? (
        <div className="inline-note"><Icon>✦</Icon><span>{activeCourse === "web3" ? "账本星种" : activeCourse === "monad" ? "并行紫藤种" : "合约卷轴种"}已经领取。播种后才能进入正式学习。</span></div>
      ) : (
        <div className="chapter-path" aria-label={`${activeCourse === "web3" ? "Web3 通识" : activeCourse === "monad" ? "Monad 基础" : "智能合约"}章节路径`}>
          {selectedChapters.map((chapter, index) => {
            const available = index === 0 || selectedProgress.chaptersRead[index - 1];
            const done = selectedProgress.chaptersRead[index];
            return (
              <button key={chapter.id} disabled={!available} onClick={() => onChapter(index)} className={joinClasses(done && "is-done", available && !done && "is-current")}>
                <span>{done ? "✓" : available ? index + 1 : "锁"}</span>
                <b>{chapter.title}</b><small>{done ? "理论已完成" : available ? chapter.pace : "完成上一章后解锁"}</small>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SeedCard({
  kind,
  course,
  name,
  description,
  owned = false,
  locked = false,
}: {
  kind: SeedKind;
  course: string;
  name: string;
  description: string;
  owned?: boolean;
  locked?: boolean;
}) {
  return (
    <article className={joinClasses("seed-card", owned && "is-owned", locked && "is-locked")}>
      {owned && <span className="seed-bag-tag">布袋中</span>}
      <div className="seed-glyph-wrap"><SeedGlyph kind={kind} /></div>
      <div className="seed-card-copy">
        <small>{course}</small>
        <h2>{name}</h2>
        <p>{description}</p>
        <Pill tone={owned ? "green" : locked ? "muted" : "blue"}>{owned ? "背包中" : locked ? "锁定" : "等待领取"}</Pill>
      </div>
    </article>
  );
}

function SeedsPanel({
  progress,
  monadProgress,
  contractProgress,
  activeCourse,
  onLand,
  onSelectCourse,
  securityStage,
  onOpenSecurity,
}: {
  progress: FarmProgress;
  monadProgress: FarmProgress;
  contractProgress: FarmProgress;
  activeCourse: ActiveCourse;
  onLand: () => void;
  onSelectCourse: (course: ActiveCourse) => void;
  securityStage: GreenhouseStage;
  onOpenSecurity: () => void;
}) {
  return (
    <div className="panel-stack">
      <SectionTitle eyebrow="种子小铺" title="每一颗种子对应一门课程" />
      <p className="lead">它们是真正有籽粒、种皮和胚痕的知识种子。课程满足解锁条件后，对应种子会进入你的背包。</p>
      <div className="seed-shelf">
        <SeedCard
          kind="ledger-star"
          course="Web3 通识"
          name="账本星种"
          description={progress.seedGranted ? "硬质籽壳里有一枚星形胚痕，可用于第一块课程田。" : "开启 Web3 通识后获得。"}
          owned={progress.seedGranted}
        />
        <SeedCard
          kind="parallel-wisteria"
          course="Monad 基础"
          name="并行紫藤种"
          description={monadProgress.seedGranted ? "双瓣种仁带有两条并行紫纹，可用于第 2 格课程田。" : "收获守护浆果后，在知识塔开启第 2 关即可领取。"}
          owned={monadProgress.seedGranted}
          locked={!progress.harvested}
        />
        <SeedCard
          kind="contract-scroll"
          course="智能合约"
          name="合约卷轴种"
          description={contractProgress.seedGranted ? "细长卷曲种皮带有 ABI 刻纹，可用于第 3 格课程田。" : "收获 Monad 紫藤果后，在知识塔开启第 3 关即可领取。"}
          owned={contractProgress.seedGranted}
          locked={!monadProgress.harvested}
        />
      </div>
      <Web3SecurityModule
        context="seeds"
        securityStage={securityStage}
        onOpenSecurity={onOpenSecurity}
      />
      {activeCourse === "web3" && progress.seedGranted && !progress.planted && (
        <button className="pixel-button primary wide" onClick={onLand}>带着账本星种前往第 1 格</button>
      )}
      {activeCourse === "monad" && monadProgress.seedGranted && !monadProgress.planted && (
        <button className="pixel-button primary wide" onClick={onLand}>带着并行紫藤种前往第 2 格</button>
      )}
      {activeCourse === "contract" && contractProgress.seedGranted && !contractProgress.planted && (
        <button className="pixel-button primary wide" onClick={onLand}>带着合约卷轴种前往第 3 格</button>
      )}
      {progress.harvested && activeCourse === "web3" && (
        <button className="pixel-button ghost wide" onClick={() => onSelectCourse("monad")}>查看第 2 关种子</button>
      )}
      {monadProgress.harvested && activeCourse === "monad" && (
        <button className="pixel-button ghost wide" onClick={() => onSelectCourse("contract")}>查看第 3 关种子</button>
      )}
    </div>
  );
}

function LandPanel({
  progress,
  initialConfirmOpen,
  onClear,
  onPlant,
  nextLabel,
  onContinue,
  securityStage,
  onOpenSecurity,
}: {
  progress: FarmProgress;
  initialConfirmOpen: boolean;
  onClear: () => void;
  onPlant: () => void;
  nextLabel: string;
  onContinue: () => void;
  securityStage: GreenhouseStage;
  onOpenSecurity: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(initialConfirmOpen);
  const stage = fieldVisualStage(progress);
  const activeStage = FIELD_STAGE_ORDER.indexOf(stage);
  const stageCopy: Record<typeof stage, { title: string; body: string }> = {
    wild: {
      title: "第 1 格尚未开荒",
      body: "农田按顺序划分为 9 个课程格。第 1 格属于 Web3 通识，先清理这一格的杂草、石块和枯枝，才能播下一颗账本星种。",
    },
    tilled: {
      title: "第 1 格已经完成松土",
      body: "Web3 通识对应的第 1 格已经清理完成。账本星种正在布袋里等待，其他 8 格保持原状。",
    },
    seeded: {
      title: "一颗账本星种已经入土",
      body: "一颗账本星种正在第 1 格扎根。章节与挑战不会占用下一格，只会推动第 1 格里的同一株作物成长。",
    },
    sprout: {
      title: "知识嫩芽破土了",
      body: "同一颗账本星种完成了发芽。通过全部章节挑战，这一株作物会继续长高并开花。",
    },
    bloom: {
      title: "课程田已经开花",
      body: "Web3 通识的全部章节挑战已经通过。同一株作物完成最终验证后会结出守护浆果。",
    },
    fruit: {
      title: "守护浆果已经成熟",
      body: "最终验证已经通过。果实正在枝头等待你亲手收获。",
    },
    harvested: {
      title: "第 1 格完成收获",
      body: "守护浆果已经进入成长档案，第 1 格保留采摘后的植株；顺序中的第 2 格 Monad 基础已经解锁。",
    },
  };

  function confirmClear() {
    if (!progress.seedGranted || progress.landCleared) return;
    onClear();
    setConfirmOpen(false);
  }

  return (
    <div className="panel-stack">
      <SectionTitle eyebrow="九格课程农田 · 第 1 格" title="Web3 通识从第一格开始">
        <Pill tone={stage === "wild" ? "gold" : stage === "fruit" || stage === "harvested" ? "green" : "violet"}>{FIELD_STAGE_LABELS[stage]}</Pill>
      </SectionTitle>
      <div className="land-hero">
        <FieldStagePreview stage={stage} />
        <div><h2>{stageCopy[stage].title}</h2><p>{stageCopy[stage].body}</p></div>
      </div>
      <div className="course-plot-note" aria-label="当前为九格课程农田的第 1 格，使用一颗账本星种">
        <span>课程格 1/9</span>
        <b>账本星种 ×1</b>
        <p>Web3 通识只使用第 1 格和这一颗种子；完成整门课程后才按顺序进入第 2 格。</p>
      </div>
      <Web3SecurityModule
        context="land"
        securityStage={securityStage}
        onOpenSecurity={onOpenSecurity}
      />
      <div className="land-growth-rail" aria-label={`课程田成长阶段，当前为${FIELD_STAGE_LABELS[stage]}`}>
        {FIELD_STAGE_ORDER.map((item, index) => (
          <div
            className={joinClasses(index < activeStage && "done", index === activeStage && "active", index > activeStage && "locked")}
            aria-current={index === activeStage ? "step" : undefined}
            key={item}
          >
            <span>{index < activeStage || stage === "harvested" && index === activeStage ? "✓" : index + 1}</span>
            <b>{FIELD_STAGE_LABELS[item]}</b>
          </div>
        ))}
      </div>
      {!progress.landCleared && <button className="pixel-button primary wide" onClick={() => setConfirmOpen(true)} disabled={!progress.seedGranted}>开垦第 1 格 · Web3 通识</button>}
      {!progress.seedGranted && <div className="inline-note"><Icon>⌁</Icon><span>先在知识塔开启 Web3 通识并领取账本星种，才能开荒。</span></div>}
      {progress.landCleared && !progress.planted && <button className="pixel-button primary wide" onClick={onPlant}>播下账本星种</button>}
      {progress.planted && <button className="pixel-button primary wide" onClick={onContinue}>{nextLabel}</button>}
      {confirmOpen && (
        <Modal title="确认开荒第 1 格课程田？" onClose={() => setConfirmOpen(false)}>
          <div className="clear-land-confirm">
            <FieldStagePreview stage="wild" />
            <div>
              <p>这次只会清理九格农田中的第 1 格。该格对应 Web3 通识，会移走杂草、石块和枯枝并完成松土。</p>
              <ul><li>其他 8 格保持原状</li><li>第 1 格只播下一颗账本星种</li><li>完成课程后才按顺序解锁第 2 格</li></ul>
            </div>
          </div>
          <div className="dialog-actions">
            <button className="pixel-button ghost" data-autofocus onClick={() => setConfirmOpen(false)}>先等等</button>
            <button className="pixel-button primary" onClick={confirmClear}>确认开荒</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function MonadLandPanel({
  progress,
  onClear,
  onPlant,
  onContinue,
  securityStage,
  onOpenSecurity,
}: {
  progress: FarmProgress;
  onClear: () => void;
  onPlant: () => void;
  onContinue: () => void;
  securityStage: GreenhouseStage;
  onOpenSecurity: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const stage = fieldVisualStage(progress);
  const activeStage = FIELD_STAGE_ORDER.indexOf(stage);
  const copy: Record<typeof stage, { title: string; body: string }> = {
    wild: { title: "第 2 格等待开荒", body: "第 1 格 Web3 通识已经收获。现在按顺序清理第 2 格，为 Monad 基础课程准备独立土地。" },
    tilled: { title: "第 2 格松土完成", body: "并行紫藤种仍在布袋中。播种只会占用第 2 格，不改变第 1 格的收获记录。" },
    seeded: { title: "并行紫藤种已经入土", body: "完成 Monad 与 EVM、RPC 与浏览器、测试环境与资产安全三章，会让同一株紫藤继续生长。" },
    sprout: { title: "并行嫩芽已经破土", body: "三章理论已完成。接下来通过全部章节挑战，让紫藤开花。" },
    bloom: { title: "并行紫藤已经开花", body: "全部章节挑战已通过，完成最终验证后会结出 Monad 紫藤果。" },
    fruit: { title: "Monad 紫藤果已经成熟", body: "最终验证已经通过，果实正在第 2 格等待收获。" },
    harvested: { title: "第 2 格完成收获", body: "Monad 紫藤果已进入成长档案，第 3 格智能合约课程已经解锁。" },
  };

  return (
    <div className="panel-stack">
      <SectionTitle eyebrow="九格课程农田 · 第 2 格" title="Monad 基础独立生长">
        <Pill tone={stage === "wild" ? "gold" : stage === "fruit" || stage === "harvested" ? "green" : "violet"}>{FIELD_STAGE_LABELS[stage]}</Pill>
      </SectionTitle>
      <div className={`monad-land-visual is-${stage}`} role="img" aria-label={`第 2 格 Monad 基础课程田：${FIELD_STAGE_LABELS[stage]}`}>
        <span className="monad-land-grid">2</span>
        {stage === "seeded" && <SeedGlyph kind="parallel-wisteria" />}
        {(stage === "sprout" || stage === "bloom" || stage === "fruit" || stage === "harvested") && <MonadCropPreview stage={stage} />}
      </div>
      <div className="lesson-objective"><span>当前变化</span><h2>{copy[stage].title}</h2><p>{copy[stage].body}</p></div>
      <div className="course-plot-note" aria-label="当前为九格课程农田的第 2 格，使用一颗并行紫藤种">
        <span>课程格 2/9</span><b>并行紫藤种 ×1</b><p>一门课程、一格土地、一颗种子；课程完成后才顺序进入第 3 格。</p>
      </div>
      <Web3SecurityModule
        context="land"
        securityStage={securityStage}
        onOpenSecurity={onOpenSecurity}
      />
      <div className="land-growth-rail" aria-label={`Monad 基础课程田成长阶段，当前为${FIELD_STAGE_LABELS[stage]}`}>
        {FIELD_STAGE_ORDER.map((item, index) => (
          <div className={joinClasses(index < activeStage && "done", index === activeStage && "active", index > activeStage && "locked")} aria-current={index === activeStage ? "step" : undefined} key={item}>
            <span>{index < activeStage || stage === "harvested" && index === activeStage ? "✓" : index + 1}</span><b>{FIELD_STAGE_LABELS[item]}</b>
          </div>
        ))}
      </div>
      {!progress.landCleared && <button className="pixel-button primary wide" onClick={() => setConfirmOpen(true)}>开垦第 2 格 · Monad 基础</button>}
      {progress.landCleared && !progress.planted && <button className="pixel-button primary wide" onClick={onPlant}>播下并行紫藤种</button>}
      {progress.planted && <button className="pixel-button primary wide" onClick={onContinue}>{progress.chaptersRead.some(Boolean) ? "继续 Monad 基础" : "进入第 1 章 · Monad 与 EVM"}</button>}
      {confirmOpen && (
        <Modal title="确认开荒第 2 格课程田？" onClose={() => setConfirmOpen(false)}>
          <div className="clear-land-confirm">
            <div className="monad-clear-preview"><span>2</span><i>杂草</i><i>石块</i></div>
            <div><p>只清理九格农田中的第 2 格，用于 Monad 基础课程。</p><ul><li>第 1 格收获记录保持不变</li><li>只播下一颗并行紫藤种</li><li>不消耗其他课程种子</li></ul></div>
          </div>
          <div className="dialog-actions">
            <button className="pixel-button ghost" data-autofocus onClick={() => setConfirmOpen(false)}>先等等</button>
            <button className="pixel-button primary" onClick={() => { onClear(); setConfirmOpen(false); }}>确认开荒</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ContractLandPanel({
  progress,
  onClear,
  onPlant,
  onContinue,
  securityStage,
  onOpenSecurity,
}: {
  progress: FarmProgress;
  onClear: () => void;
  onPlant: () => void;
  onContinue: () => void;
  securityStage: GreenhouseStage;
  onOpenSecurity: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const stage = fieldVisualStage(progress);
  const activeStage = FIELD_STAGE_ORDER.indexOf(stage);
  const copy: Record<typeof stage, { title: string; body: string }> = {
    wild: { title: "第 3 格等待开荒", body: "第 2 格 Monad 基础已经收获。现在按顺序清理第 3 格，为智能合约课程准备独立土地。" },
    tilled: { title: "第 3 格松土完成", body: "合约卷轴种仍在布袋中。播种只会占用第 3 格，前两格的收获记录保持不变。" },
    seeded: { title: "合约卷轴种已经入土", body: "完成合约与状态、读取与 ABI、回执与权限风险三章，会让同一株作物继续生长。" },
    sprout: { title: "卷轴嫩芽已经破土", body: "三章理论已完成。接下来通过全部章节挑战，让合约晶花开放。" },
    bloom: { title: "合约晶花已经开放", body: "全部章节挑战已通过，完成最终验证后会结出合约晶果。" },
    fruit: { title: "合约晶果已经成熟", body: "最终验证已经通过，果实正在第 3 格等待收获。" },
    harvested: { title: "第 3 格完成收获", body: "合约晶果已进入成长档案，三门首发课程全部完成，并解锁 Lv.4 合约建造师。" },
  };

  return (
    <div className="panel-stack">
      <SectionTitle eyebrow="九格课程农田 · 第 3 格" title="智能合约独立生长">
        <Pill tone={stage === "wild" ? "gold" : stage === "fruit" || stage === "harvested" ? "green" : "violet"}>{FIELD_STAGE_LABELS[stage]}</Pill>
      </SectionTitle>
      <div className={`contract-land-visual is-${stage}`} role="img" aria-label={`第 3 格智能合约课程田：${FIELD_STAGE_LABELS[stage]}`}>
        <span className="contract-land-grid">3</span>
        {stage === "seeded" && <SeedGlyph kind="contract-scroll" />}
        {(stage === "sprout" || stage === "bloom" || stage === "fruit" || stage === "harvested") && <span className={`contract-preview-crop crop-${stage}`} />}
      </div>
      <div className="lesson-objective"><span>当前变化</span><h2>{copy[stage].title}</h2><p>{copy[stage].body}</p></div>
      <div className="course-plot-note" aria-label="当前为九格课程农田的第 3 格，使用一颗合约卷轴种">
        <span>课程格 3/9</span><b>合约卷轴种 ×1</b><p>一门课程、一格土地、一颗种子；这株作物记录完整的智能合约学习过程。</p>
      </div>
      <Web3SecurityModule
        context="land"
        securityStage={securityStage}
        onOpenSecurity={onOpenSecurity}
      />
      <div className="land-growth-rail" aria-label={`智能合约课程田成长阶段，当前为${FIELD_STAGE_LABELS[stage]}`}>
        {FIELD_STAGE_ORDER.map((item, index) => (
          <div className={joinClasses(index < activeStage && "done", index === activeStage && "active", index > activeStage && "locked")} aria-current={index === activeStage ? "step" : undefined} key={item}>
            <span>{index < activeStage || stage === "harvested" && index === activeStage ? "✓" : index + 1}</span><b>{FIELD_STAGE_LABELS[item]}</b>
          </div>
        ))}
      </div>
      {!progress.landCleared && <button className="pixel-button primary wide" onClick={() => setConfirmOpen(true)}>开垦第 3 格 · 智能合约</button>}
      {progress.landCleared && !progress.planted && <button className="pixel-button primary wide" onClick={onPlant}>播下合约卷轴种</button>}
      {progress.planted && <button className="pixel-button primary wide" onClick={onContinue}>{progress.chaptersRead.some(Boolean) ? "继续智能合约" : "进入第 1 章 · 合约、状态与函数"}</button>}
      {confirmOpen && (
        <Modal title="确认开荒第 3 格课程田？" onClose={() => setConfirmOpen(false)}>
          <div className="clear-land-confirm">
            <div className="contract-clear-preview"><span>3</span><i>杂草</i><i>石块</i></div>
            <div><p>只清理九格农田中的第 3 格，用于智能合约课程。</p><ul><li>前两格收获记录保持不变</li><li>只播下一颗合约卷轴种</li><li>不消耗其他课程种子</li></ul></div>
          </div>
          <div className="dialog-actions">
            <button className="pixel-button ghost" data-autofocus onClick={() => setConfirmOpen(false)}>先等等</button>
            <button className="pixel-button primary" onClick={() => { onClear(); setConfirmOpen(false); }}>确认开荒</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ChapterPanel({
  chapter,
  completed,
  onComplete,
  onKnowledge,
  onAgent,
}: {
  chapter: Chapter;
  completed: boolean;
  onComplete: () => void;
  onKnowledge: () => void;
  onAgent: () => void;
}) {
  return (
    <div className={joinClasses("panel-stack", chapter.safety && "safety-mode")}>
      <SectionTitle eyebrow={`第 ${chapter.number} 章 · ${chapter.pace}`} title={chapter.title}>
        <Pill tone={chapter.safety ? "danger" : completed ? "green" : "blue"}>{chapter.safety ? "安全章节" : completed ? "已完成" : "正在学习"}</Pill>
      </SectionTitle>
      {chapter.safety && <div className="safety-banner"><span>盾</span><div><b>请认真确认</b><p>这一步涉及账户或资产安全。我会直接说明错误操作的后果。</p></div></div>}
      <div className="lesson-objective"><span>本章目标</span><p>{chapter.objective}</p></div>
      <article className="lesson-copy"><p>{chapter.body}</p></article>
      <div className="term-row">{chapter.terms.map((term) => <Pill key={term} tone={chapter.safety ? "danger" : "violet"}>{term}</Pill>)}</div>
      <div className="example-card"><span>农场例子</span><p>{chapter.example}</p></div>
      <div className={joinClasses("caution-card", chapter.safety && "is-danger")}><b>{chapter.safety ? "必须记住" : "操作前提醒"}</b><p>{chapter.caution}</p></div>
      <div className="panel-actions">
        <button className="pixel-button secondary" onClick={onKnowledge}>打开知识卡</button>
        <button className="pixel-button ghost" onClick={onAgent}>聊聊这个概念</button>
        <button className="pixel-button primary" onClick={onComplete} disabled={completed}>{completed ? "本章理论已完成" : "我已读完本章"}</button>
      </div>
    </div>
  );
}

function ChallengePanel({
  chapter,
  question,
  questionIndex,
  selected,
  feedback,
  resolved,
  onSelect,
  onSubmit,
  onContinue,
  onRetry,
  onKnowledge,
  onAgent,
}: {
  chapter: Chapter;
  question: Chapter["challenges"][number];
  questionIndex: number;
  selected: string;
  feedback: Feedback;
  resolved: boolean;
  onSelect: (answer: string) => void;
  onSubmit: () => void;
  onContinue: () => void;
  onRetry: () => void;
  onKnowledge: () => void;
  onAgent: () => void;
}) {
  return (
    <div className={joinClasses("panel-stack", chapter.safety && "safety-mode")}>
      <SectionTitle eyebrow={`章节挑战 · 第 ${chapter.number} 章`} title={chapter.title}>
        <Pill tone={chapter.safety ? "danger" : "gold"}>{questionIndex + 1} / {chapter.challenges.length}</Pill>
      </SectionTitle>
      {chapter.safety && <div className="safety-banner compact"><span>盾</span><div><b>安全判断</b><p>错误选择会写明真实后果，不使用轻松语气。</p></div></div>}
      <div className="question-card">
        <small>情境</small><p className="question-scene">{question.scene}</p>
        <h2>{question.prompt}</h2>
        <div className="answer-list" role="radiogroup" aria-label="答案选项">
          {question.options.map((option) => (
            <button
              key={option.id}
              role="radio"
              aria-checked={selected === option.id}
              className={selected === option.id ? "selected" : ""}
              onClick={() => onSelect(option.id)}
              disabled={resolved}
            >
              <span>{selected === option.id ? "◆" : "◇"}</span>{option.label}
            </button>
          ))}
        </div>
      </div>
      {feedback && <div className={`feedback feedback-${feedback.tone}`} role="status"><span>{feedback.tone === "success" ? "✓" : feedback.tone === "danger" ? "!" : "✦"}</span><p>{feedback.message}</p></div>}
      {!resolved && <div className="support-row"><button onClick={onKnowledge}>▤ 查看知识卡</button><button onClick={onAgent}>◆ 聊聊这题</button>{feedback && <button onClick={onRetry}>↺ 再试一次</button>}</div>}
      <button className="pixel-button primary wide" onClick={resolved ? onContinue : onSubmit}>{resolved ? "继续下一步" : "提交判断"}</button>
      <p className="quiet-note">不设倒计时。答错后可以立即重试，其他有效进度不会清空。</p>
    </div>
  );
}

function VerificationPanel({ courseTitle, onAgent, onQuiz }: { courseTitle: string; onAgent: () => void; onQuiz: () => void }) {
  return (
    <div className="panel-stack">
      <SectionTitle eyebrow={`${courseTitle} · 最终验证`} title="最后确认一下你的收获">
        <Pill tone="green">作物已开花</Pill>
      </SectionTitle>
      <p className="lead">可以和学习助手聊一聊，也可以直接完成结课小测。两种方式获得相同课程结果和 50 EXP。</p>
      <div className="verification-grid">
        <article className="verification-card recommended">
          <Pill tone="violet">推荐</Pill><div className="verification-icon">◆</div><h2>和学习助手聊聊</h2>
          <p>通过三道标准化情境问题确认理解。当前版本展示真实的服务降级状态。</p>
          <button className="pixel-button primary" onClick={onAgent}>打开 Agent 入口</button>
        </article>
        <article className="verification-card">
          <Pill tone="blue">平等备选</Pill><div className="verification-icon">▤</div><h2>完成结课小测</h2>
          <p>固定五题，全部正确即可结果。答错可以重新确认，不清空课程进度。</p>
          <button className="pixel-button secondary" onClick={onQuiz}>直接完成小测</button>
        </article>
      </div>
      <div className="saved-note"><span>✓</span><p>课程与章节进度已经保存，切换验证方式不会丢失进度。</p></div>
    </div>
  );
}

function QuizPanel({
  questions,
  courseTitle,
  answers,
  errors,
  onAnswer,
  onSubmit,
  onAgent,
}: {
  questions: FinalQuestion[];
  courseTitle: string;
  answers: Record<string, string>;
  errors: string[];
  onAnswer: (id: string, answer: string) => void;
  onSubmit: () => void;
  onAgent: () => void;
}) {
  return (
    <div className="panel-stack">
      <SectionTitle eyebrow={`${courseTitle} · 结课小测 · 5 题`} title="平实地确认你已经掌握">
        <Pill tone="blue">必须全部正确</Pill>
      </SectionTitle>
      <div className="quiz-list">
        {questions.map((question, index) => (
          <fieldset className={joinClasses("quiz-question", errors.includes(question.id) && "has-error")} key={question.id}>
            <legend><span>{index + 1}</span>{question.prompt}</legend>
            <div>{question.options.map((option) => (
              <label key={option.id}>
                <input type="radio" name={question.id} value={option.id} checked={answers[question.id] === option.id} onChange={() => onAnswer(question.id, option.id)} />
                <span>{option.label}</span>
              </label>
            ))}</div>
            {errors.includes(question.id) && <p>这道题还需要重新确认。</p>}
          </fieldset>
        ))}
      </div>
      {errors.length > 0 && <div className="feedback feedback-gentle" role="alert"><span>✦</span><p>还有 {errors.length} 道题需要重新确认。其他答案已保留。</p></div>}
      <div className="panel-actions"><button className="pixel-button ghost" onClick={onAgent}>查看 Agent 降级入口</button><button className="pixel-button primary" onClick={onSubmit}>提交结课小测</button></div>
    </div>
  );
}

function HarvestPanel({ progress, onHarvest }: { progress: FarmProgress; onHarvest: () => void }) {
  return (
    <div className="panel-stack harvest-panel">
      <SectionTitle eyebrow="课程作物 · 已经结果" title="你的知识种子已经结出果实">
        <Pill tone="gold">等待收获</Pill>
      </SectionTitle>
      <div className="fruit-stage"><span className="fruit-glow">✦</span><div className="fruit">◆</div><h2>守护浆果</h2><p>Web3 通识课程成果</p></div>
      <div className="result-proof">
        <div><span>✓</span><b>3 章理论</b><small>全部读完</small></div>
        <div><span>✓</span><b>3 组挑战</b><small>全部通过</small></div>
        <div><span>✓</span><b>结课小测</b><small>5 题全对</small></div>
      </div>
      <p className="lead">收获后将获得果实、平台成就和 NFT 领取资格，并解锁 Monad 基础课程。NFT 当前只展示资格，不执行铸造。</p>
      <button className="pixel-button gold wide" onClick={onHarvest} disabled={progress.harvested}>{progress.harvested ? "已经收获" : "亲手收获守护浆果"}</button>
    </div>
  );
}

function MonadHarvestPanel({ progress, onHarvest }: { progress: FarmProgress; onHarvest: () => void }) {
  return (
    <div className="panel-stack harvest-panel monad-harvest-panel">
      <SectionTitle eyebrow="第 2 关 · 已经结果" title="并行紫藤结出了知识果实">
        <Pill tone="gold">等待收获</Pill>
      </SectionTitle>
      <div className="monad-fruit-stage"><MonadCropPreview stage="fruit" /><h2>Monad 紫藤果</h2><p>Monad 基础课程成果</p></div>
      <div className="result-proof">
        <div><span>✓</span><b>3 章理论</b><small>全部读完</small></div>
        <div><span>✓</span><b>3 组挑战</b><small>全部通过</small></div>
        <div><span>✓</span><b>结课小测</b><small>5 题全对</small></div>
      </div>
      <p className="lead">收获后，第 2 格会保留采摘后的紫藤，第 3 格智能合约课程将按顺序解锁。</p>
      <button className="pixel-button gold wide" onClick={onHarvest} disabled={progress.harvested}>{progress.harvested ? "已经收获" : "亲手收获 Monad 紫藤果"}</button>
    </div>
  );
}

function ContractHarvestPanel({ progress, onHarvest }: { progress: FarmProgress; onHarvest: () => void }) {
  return (
    <div className="panel-stack harvest-panel contract-harvest-panel">
      <SectionTitle eyebrow="第 3 关 · 已经结果" title="合约卷轴种结出了知识果实">
        <Pill tone="gold">等待收获</Pill>
      </SectionTitle>
      <div className="contract-fruit-stage"><span className="contract-preview-crop crop-fruit" /><h2>合约晶果</h2><p>智能合约课程成果</p></div>
      <div className="result-proof">
        <div><span>✓</span><b>3 章理论</b><small>全部读完</small></div>
        <div><span>✓</span><b>3 组挑战</b><small>全部通过</small></div>
        <div><span>✓</span><b>结课小测</b><small>5 题全对</small></div>
      </div>
      <p className="lead">收获后，第 3 格会保留采摘后的合约植株，成长档案升级为 Lv.4 合约建造师，并获得智能合约学习纪念徽章资格。</p>
      <button className="pixel-button gold wide" onClick={onHarvest} disabled={progress.harvested}>{progress.harvested ? "已经收获" : "亲手收获合约晶果"}</button>
    </div>
  );
}

function ProfilePanel({
  progress,
  monadProgress,
  contractProgress,
  exp,
  securityProgress,
  onOpenMonad,
  onOpenContract,
  onOpenSecurity,
  onReset,
}: {
  progress: FarmProgress;
  monadProgress: FarmProgress;
  contractProgress: FarmProgress;
  exp: number;
  securityProgress: SecurityProgressState;
  onOpenMonad: () => void;
  onOpenContract: () => void;
  onOpenSecurity: () => void;
  onReset: () => void;
}) {
  const [nftOpen, setNftOpen] = useState<"ledger" | "monad" | "contract" | null>(null);
  const levelName = contractProgress.harvested ? "合约建造师" : monadProgress.harvested ? "Monad 探索者" : progress.harvested ? "Web3 学徒" : "初来乍到";
  const harvestedCount = Number(progress.harvested) + Number(monadProgress.harvested) + Number(contractProgress.harvested);
  return (
    <div className="panel-stack">
      <SectionTitle eyebrow="个人学习档案" title={levelName}>
        <Pill tone={progress.harvested ? "gold" : "muted"}>{exp} EXP</Pill>
      </SectionTitle>
      <div className="profile-card">
        <div className="profile-avatar"><span className="avatar-portrait" aria-hidden="true" /></div><div><small>MONAD PIXEL FARMER</small><h2>{harvestedCount > 0 ? `${harvestedCount} 门课程已经收获` : "第一颗种子还在等待"}</h2><p>学习结果记录真实完成条件，徽章不影响 EXP、等级或后续课程解锁。</p></div>
      </div>
      <div className="archive-grid">
        <article className="archive-seed"><SeedGlyph kind="ledger-star" compact /><small>课程种子</small><b>{progress.seedGranted ? "账本星种 ×1" : "尚未获得"}</b></article>
        <article className="archive-seed"><SeedGlyph kind="parallel-wisteria" compact /><small>第 2 关种子</small><b>{monadProgress.seedGranted ? "并行紫藤种 ×1" : "尚未获得"}</b></article>
        <article className="archive-seed"><SeedGlyph kind="contract-scroll" compact /><small>第 3 关种子</small><b>{contractProgress.seedGranted ? "合约卷轴种 ×1" : "尚未获得"}</b></article>
        <article><span>◆</span><small>课程果实</small><b>{progress.harvested ? "守护浆果 ×1" : "尚未获得"}</b></article>
        <article><span>✦</span><small>第 2 关果实</small><b>{monadProgress.harvested ? "Monad 紫藤果 ×1" : "尚未获得"}</b></article>
        <article><span>⌘</span><small>第 3 关果实</small><b>{contractProgress.harvested ? "合约晶果 ×1" : "尚未获得"}</b></article>
        <article><span>★</span><small>平台成就</small><b>{progress.harvested ? "账本守护者" : "尚未获得"}</b></article>
        <article><span>▤</span><small>验证记录</small><b>{progress.verification === "passed" ? "结课小测通过" : "尚未完成"}</b></article>
      </div>
      <article className={joinClasses("nft-badge-card", progress.harvested && "is-eligible")}>
        <div className="nft-badge-art">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/art/badges/ledger-guardian-nft-v1.png" alt="账本守护者徽章：盾牌、打开的账本、金色星种与紫色晶体" />
        </div>
        <div><small>WEB3 通识学习纪念徽章</small><h2>账本守护者</h2><p>{progress.harvested ? "领取资格：可以领取" : "收获守护浆果后获得领取资格"}</p><Pill tone={progress.harvested ? "green" : "muted"}>{progress.harvested ? "可以领取" : "无资格"}</Pill></div>
        <button className="pixel-button secondary" onClick={() => setNftOpen("ledger")}>{progress.harvested ? "查看 NFT 领取说明" : "查看徽章说明"}</button>
      </article>
      <article className={joinClasses("nft-badge-card monad-nft-card", monadProgress.harvested && "is-eligible")}>
        <div className="nft-badge-art">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/art/badges/monad-explorer-nft-v1.png" alt="Monad 探索者徽章：紫色传送门、并行路径与金色罗盘" />
        </div>
        <div><small>MONAD 基础学习纪念徽章</small><h2>Monad 探索者</h2><p>{monadProgress.harvested ? "领取资格：可以领取" : "收获 Monad 紫藤果后获得领取资格"}</p><Pill tone={monadProgress.harvested ? "green" : "muted"}>{monadProgress.harvested ? "可以领取" : "无资格"}</Pill></div>
        <button className="pixel-button secondary" onClick={() => setNftOpen("monad")}>{monadProgress.harvested ? "查看 NFT 领取说明" : "查看徽章说明"}</button>
      </article>
      <article className={joinClasses("nft-badge-card contract-nft-card", contractProgress.harvested && "is-eligible")}>
        <div className="nft-badge-art">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/art/badges/contract-builder-nft-v1.png" alt="合约建造师徽章：铜绿合约晶果、代码花纹与紫色 Monad 晶体" />
        </div>
        <div><small>智能合约学习纪念徽章</small><h2>合约建造师</h2><p>{contractProgress.harvested ? "领取资格：可以领取" : "收获合约晶果后获得领取资格"}</p><Pill tone={contractProgress.harvested ? "green" : "muted"}>{contractProgress.harvested ? "可以领取" : "无资格"}</Pill></div>
        <button className="pixel-button secondary" onClick={() => setNftOpen("contract")}>{contractProgress.harvested ? "查看 NFT 领取说明" : "查看徽章说明"}</button>
      </article>
      {progress.harvested && !monadProgress.harvested && (
        <div className="unlocked-course"><Pill tone="green">第 2 关已解锁</Pill><h2>Monad 基础</h2><p>第 2 格和完整学习流程已经开放。</p><button className="pixel-button primary" onClick={onOpenMonad}>{monadProgress.started ? "继续第 2 关" : "开启第 2 关并领取种子"}</button></div>
      )}
      {monadProgress.harvested && !contractProgress.harvested && <div className="unlocked-course"><Pill tone="green">第 3 关已解锁</Pill><h2>智能合约</h2><p>第 3 格、三章课程、挑战和结课验证已经开放。</p><button className="pixel-button primary" onClick={onOpenContract}>{contractProgress.started ? "继续第 3 关" : "开启第 3 关并领取种子"}</button></div>}
      {contractProgress.harvested && (
        <article className={joinClasses("security-badge-card", securityProgress.badgeEligible && "is-eligible")}>
          <div className="security-badge-art" aria-hidden="true" />
          <div>
            <small>WEB3 安全温室 · 可验证安全能力凭证</small>
            <h2>Web3 Security Guardian</h2>
            <p>
              {securityProgress.badgeEligible
                ? "三个 Lab 与 Final Audit 全部通过，可以领取 Security Passport。"
                : `当前进度：Lab ${securityProgress.labsPassed.filter(Boolean).length}/3 · Final Audit ${securityProgress.finalAudit.status === "passed" ? "已通过" : "未通过"}`}
            </p>
            <Pill tone={securityProgress.badgeEligible ? "green" : "muted"}>
              {securityProgress.badgeEligible ? "可以领取" : "继续挑战"}
            </Pill>
          </div>
          <button className="pixel-button secondary" onClick={onOpenSecurity}>进入安全温室</button>
        </article>
      )}
      <button className="text-danger" onClick={onReset}>重置本地演示进度</button>
      {nftOpen === "ledger" && (
        <Modal title="账本守护者 · NFT 领取说明" onClose={() => setNftOpen(null)}>
          <div className="nft-dialog">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/art/badges/ledger-guardian-nft-v1.png" alt="账本守护者徽章 NFT 视觉" />
            <div><Pill tone={progress.harvested ? "green" : "muted"}>{progress.harvested ? "当前状态 · 可以领取" : "当前状态 · 无资格"}</Pill><h3>这是一枚可选的链上学习纪念</h3><p>它不影响 EXP、等级、课程结果或 Monad 基础解锁；使用小测或学习助手完成验证，获得的徽章价值完全相同。</p></div>
          </div>
          <NftClaimPanel courseId="web3" progress={progress} eligible={progress.harvested} />
        </Modal>
      )}
      {nftOpen === "monad" && (
        <Modal title="Monad 探索者 · NFT 领取" onClose={() => setNftOpen(null)}>
          <div className="nft-dialog">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/art/badges/monad-explorer-nft-v1.png" alt="Monad 探索者徽章 NFT 视觉" />
            <div><Pill tone={monadProgress.harvested ? "green" : "muted"}>{monadProgress.harvested ? "当前状态 · 可以领取" : "当前状态 · 无资格"}</Pill><h3>完成 Monad 基础课程的链上学习纪念</h3><p>平台验证第 2 关课程完成记录后，将 Monad 探索者徽章铸造到完成签名的钱包地址。</p></div>
          </div>
          <NftClaimPanel courseId="monad" progress={monadProgress} eligible={monadProgress.harvested} />
        </Modal>
      )}
      {nftOpen === "contract" && (
        <Modal title="合约建造师 · NFT 领取说明" onClose={() => setNftOpen(null)}>
          <div className="nft-dialog">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/art/badges/contract-builder-nft-v1.png" alt="合约建造师徽章 NFT 视觉" />
            <div><Pill tone={contractProgress.harvested ? "green" : "muted"}>{contractProgress.harvested ? "当前状态 · 可以领取" : "当前状态 · 无资格"}</Pill><h3>完成智能合约课程的链上学习纪念</h3><p>它只记录智能合约课程完成事实，不影响 EXP、Lv.4 等级或其他课程结果，可以稍后领取。</p></div>
          </div>
          <NftClaimPanel courseId="contract" progress={contractProgress} eligible={contractProgress.harvested} />
        </Modal>
      )}
    </div>
  );
}
