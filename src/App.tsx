/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Cloud,
  CloudOff,
  GripVertical,
  History as HistoryIcon,
  ListOrdered,
  LogIn,
  PenLine,
  Pencil,
  Plus,
  Puzzle,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  UserRound,
  Volume2,
  X,
} from "lucide-react";
import { cloudConfigured, supabase } from "./supabase";

type Word = { id: string; zh: string; en: string; bpmf: string; group: string };
type Group = { id: string; name: string; color: string };
type Tab = "practice" | "book" | "history";
type NavScreen = "practice" | "quiz" | "book" | "group" | "history";
type Sheet =
  | { kind: "word"; id?: string; group?: string }
  | { kind: "group-new" }
  | { kind: "group-rename"; id: string }
  | { kind: "group-delete"; id: string }
  | { kind: "group-order" };
type NavState = {
  littleWords?: boolean;
  screen?: NavScreen;
  groupId?: string;
  sheet?: boolean;
};
const GROUP_COLORS = ["#e59a55", "#62adc0", "#c77caf", "#81a864"];
type PracticeMode = "full" | "missing";
type HistoryRecord = {
  id: string;
  timestamp: number;
  score: number;
  total: number;
  groupNames: string[];
  groupIds?: string[];
};
type CloudData = {
  words: Word[];
  groups: Group[];
  history: HistoryRecord[];
  completedGroupIds?: string[];
};
type SyncStatus = "idle" | "loading" | "syncing" | "synced" | "offline";
const CODE_LIST_KEY = "little-words-codes-v1",
  ACTIVE_CODE_KEY = "little-words-active-code-v1",
  LEGACY_KEY = "little-words-v1",
  LEGACY_MIGRATED_KEY = "little-words-legacy-migrated-v1";
const normalizeCode = (value: string) => value.trim().toLocaleLowerCase();
const cacheKey = (code: string) => `little-words-v1:${normalizeCode(code)}`;
const hashCode = async (code: string) => {
  const bytes = new TextEncoder().encode(`little-words:${normalizeCode(code)}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
};
const dictionary = [
  ["蘋果", "apple", "ㄆㄧㄥˊ ㄍㄨㄛˇ"],
  ["香蕉", "banana", "ㄒㄧㄤ ㄐㄧㄠ"],
  ["橘子", "orange", "ㄐㄩˊ ㄗˇ"],
  ["葡萄", "grape", "ㄆㄨˊ ㄊㄠˊ"],
  ["草莓", "strawberry", "ㄘㄠˇ ㄇㄟˊ"],
  ["西瓜", "watermelon", "ㄒㄧ ㄍㄨㄚ"],
  ["貓", "cat", "ㄇㄠ"],
  ["狗", "dog", "ㄍㄡˇ"],
  ["鳥", "bird", "ㄋㄧㄠˇ"],
  ["魚", "fish", "ㄩˊ"],
  ["兔子", "rabbit", "ㄊㄨˋ ˙ㄗ"],
  ["大象", "elephant", "ㄉㄚˋ ㄒㄧㄤˋ"],
  ["獅子", "lion", "ㄕ ㄗˇ"],
  ["紅色", "red", "ㄏㄨㄥˊ ㄙㄜˋ"],
  ["藍色", "blue", "ㄌㄢˊ ㄙㄜˋ"],
  ["黃色", "yellow", "ㄏㄨㄤˊ ㄙㄜˋ"],
  ["綠色", "green", "ㄌㄩˋ ㄙㄜˋ"],
  ["紫色", "purple", "ㄗˇ ㄙㄜˋ"],
  ["白色", "white", "ㄅㄞˊ ㄙㄜˋ"],
  ["黑色", "black", "ㄏㄟ ㄙㄜˋ"],
  ["書", "book", "ㄕㄨ"],
  ["鉛筆", "pencil", "ㄑㄧㄢ ㄅㄧˇ"],
  ["學校", "school", "ㄒㄩㄝˊ ㄒㄧㄠˋ"],
  ["老師", "teacher", "ㄌㄠˇ ㄕ"],
  ["朋友", "friend", "ㄆㄥˊ ㄧㄡˇ"],
  ["水", "water", "ㄕㄨㄟˇ"],
  ["牛奶", "milk", "ㄋㄧㄡˊ ㄋㄞˇ"],
  ["太陽", "sun", "ㄊㄞˋ ㄧㄤˊ"],
  ["月亮", "moon", "ㄩㄝˋ ㄌㄧㄤˋ"],
  ["星星", "star", "ㄒㄧㄥ ㄒㄧㄥ"],
  ["椅子", "chair", "ㄧˇ ˙ㄗ"],
  ["桌子", "table", "ㄓㄨㄛ ˙ㄗ"],
  ["沙發", "sofa", "ㄕㄚ ㄈㄚ"],
  ["床", "bed", "ㄔㄨㄤˊ"],
  ["門", "door", "ㄇㄣˊ"],
  ["窗戶", "window", "ㄔㄨㄤ ㄏㄨˋ"],
  ["燈", "lamp", "ㄉㄥ"],
  ["電視", "television", "ㄉㄧㄢˋ ㄕˋ"],
  ["冰箱", "refrigerator", "ㄅㄧㄥ ㄒㄧㄤ"],
  ["廚房", "kitchen", "ㄔㄨˊ ㄈㄤˊ"],
  ["浴室", "bathroom", "ㄩˋ ㄕˋ"],
  ["房間", "room", "ㄈㄤˊ ㄐㄧㄢ"],
  ["眼睛", "eyes", "ㄧㄢˇ ㄐㄧㄥ"],
  ["耳朵", "ears", "ㄦˇ ˙ㄉㄨㄛ"],
  ["鼻子", "nose", "ㄅㄧˊ ˙ㄗ"],
  ["嘴巴", "mouth", "ㄗㄨㄟˇ ˙ㄅㄚ"],
  ["頭", "head", "ㄊㄡˊ"],
  ["手", "hand", "ㄕㄡˇ"],
  ["腳", "foot", "ㄐㄧㄠˇ"],
  ["頭髮", "hair", "ㄊㄡˊ ㄈㄚˇ"],
  ["牙齒", "teeth", "ㄧㄚˊ ㄔˇ"],
  ["爸爸", "father", "ㄅㄚˋ ˙ㄅㄚ"],
  ["媽媽", "mother", "ㄇㄚ ˙ㄇㄚ"],
  ["哥哥", "older brother", "ㄍㄜ ˙ㄍㄜ"],
  ["姊姊", "older sister", "ㄐㄧㄝˇ ˙ㄐㄧㄝ"],
  ["弟弟", "younger brother", "ㄉㄧˋ ˙ㄉㄧ"],
  ["妹妹", "younger sister", "ㄇㄟˋ ˙ㄇㄟ"],
  ["嬰兒", "baby", "ㄧㄥ ㄦˊ"],
  ["家庭", "family", "ㄐㄧㄚ ㄊㄧㄥˊ"],
  ["麵包", "bread", "ㄇㄧㄢˋ ㄅㄠ"],
  ["米飯", "rice", "ㄇㄧˇ ㄈㄢˋ"],
  ["雞蛋", "egg", "ㄐㄧ ㄉㄢˋ"],
  ["起司", "cheese", "ㄑㄧˇ ㄙ"],
  ["蛋糕", "cake", "ㄉㄢˋ ㄍㄠ"],
  ["餅乾", "cookie", "ㄅㄧㄥˇ ㄍㄢ"],
  ["糖果", "candy", "ㄊㄤˊ ㄍㄨㄛˇ"],
  ["早餐", "breakfast", "ㄗㄠˇ ㄘㄢ"],
  ["午餐", "lunch", "ㄨˇ ㄘㄢ"],
  ["晚餐", "dinner", "ㄨㄢˇ ㄘㄢ"],
  ["果汁", "juice", "ㄍㄨㄛˇ ㄓ"],
  ["湯", "soup", "ㄊㄤ"],
  ["汽車", "car", "ㄑㄧˋ ㄔㄜ"],
  ["公車", "bus", "ㄍㄨㄥ ㄔㄜ"],
  ["火車", "train", "ㄏㄨㄛˇ ㄔㄜ"],
  ["飛機", "airplane", "ㄈㄟ ㄐㄧ"],
  ["船", "boat", "ㄔㄨㄢˊ"],
  ["腳踏車", "bicycle", "ㄐㄧㄠˇ ㄊㄚˋ ㄔㄜ"],
  ["機車", "scooter", "ㄐㄧ ㄔㄜ"],
  ["道路", "road", "ㄉㄠˋ ㄌㄨˋ"],
  ["尺", "ruler", "ㄔˇ"],
  ["橡皮擦", "eraser", "ㄒㄧㄤˋ ㄆㄧˊ ㄘㄚ"],
  ["書包", "schoolbag", "ㄕㄨ ㄅㄠ"],
  ["教室", "classroom", "ㄐㄧㄠˋ ㄕˋ"],
  ["學生", "student", "ㄒㄩㄝˊ ㄕㄥ"],
  ["作業", "homework", "ㄗㄨㄛˋ ㄧㄝˋ"],
  ["紙", "paper", "ㄓˇ"],
  ["剪刀", "scissors", "ㄐㄧㄢˇ ㄉㄠ"],
  ["膠水", "glue", "ㄐㄧㄠ ㄕㄨㄟˇ"],
  ["一", "one", "ㄧ"],
  ["二", "two", "ㄦˋ"],
  ["三", "three", "ㄙㄢ"],
  ["四", "four", "ㄙˋ"],
  ["五", "five", "ㄨˇ"],
  ["六", "six", "ㄌㄧㄡˋ"],
  ["七", "seven", "ㄑㄧ"],
  ["八", "eight", "ㄅㄚ"],
  ["九", "nine", "ㄐㄧㄡˇ"],
  ["十", "ten", "ㄕˊ"],
  ["早安", "good morning", "ㄗㄠˇ ㄢ"],
  ["謝謝", "thank you", "ㄒㄧㄝˋ ˙ㄒㄧㄝ"],
  ["再見", "goodbye", "ㄗㄞˋ ㄐㄧㄢˋ"],
  ["開心", "happy", "ㄎㄞ ㄒㄧㄣ"],
  ["難過", "sad", "ㄋㄢˊ ㄍㄨㄛˋ"],
  ["大", "big", "ㄉㄚˋ"],
  ["小", "small", "ㄒㄧㄠˇ"],
  ["快", "fast", "ㄎㄨㄞˋ"],
  ["慢", "slow", "ㄇㄢˋ"],
] as const;
const seedGroups: Group[] = [];
const seedWords: Word[] = [];

const makeLetterGap = (word: string, seedText = word) => {
  const characters = [...word];
  const letterIndexes = [...word]
    .map((character, index) => ({ character, index }))
    .filter(({ character }) => /[a-z]/i.test(character))
    .map(({ index }) => index);
  const letterCount = letterIndexes.length;
  const missingCount = letterCount >= 7 ? 3 : letterCount >= 4 ? 2 : 1;
  const usableIndexes =
    letterCount > 2 ? letterIndexes.slice(1, -1) : letterIndexes;
  const safeCount = Math.min(missingCount, usableIndexes.length);
  let seed = [...seedText].reduce(
    (value, character) => (value * 31 + character.charCodeAt(0)) >>> 0,
    2166136261,
  );
  const shuffled = [...usableIndexes];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const swapIndex = seed % (index + 1);
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }
  let missingIndexes = shuffled.slice(0, safeCount).sort((a, b) => a - b);
  const allConsecutive = missingIndexes.every(
    (value, index) => index === 0 || value === missingIndexes[index - 1] + 1,
  );
  if (safeCount > 1 && allConsecutive && usableIndexes.length > safeCount) {
    missingIndexes = Array.from({ length: safeCount }, (_, index) =>
      usableIndexes[
        Math.round((index * (usableIndexes.length - 1)) / (safeCount - 1))
      ],
    );
  }
  const missingSet = new Set(missingIndexes);
  return {
    prompt: characters
      .map((character, index) => (missingSet.has(index) ? "_" : character))
      .join(""),
    answer: missingIndexes.map((index) => characters[index]).join(""),
    characters,
    missingIndexes,
  };
};

export default function App() {
  const [tab, setTab] = useState<Tab>("practice"),
    [groups, setGroups] = useState<Group[]>(seedGroups),
    [words, setWords] = useState<Word[]>(seedWords),
    [selected, setSelected] = useState<string[]>([]),
    [ready, setReady] = useState(false);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [practiceMode, setPracticeMode] = useState<PracticeMode>("full");
  const [showCompleted, setShowCompleted] = useState(false);
  const [completedGroupIds, setCompletedGroupIds] = useState<string[]>([]);
  const [quiz, setQuiz] = useState<Word[]>([]),
    [idx, setIdx] = useState(0),
    [answer, setAnswer] = useState(""),
    [gapAnswers, setGapAnswers] = useState<string[]>([]),
    [result, setResult] = useState<"idle" | "correct" | "wrong">("idle"),
    [score, setScore] = useState(0),
    [done, setDone] = useState(false),
    [attempts, setAttempts] = useState(0),
    [countedCurrent, setCountedCurrent] = useState(false);
  const [answerFocused, setAnswerFocused] = useState(false);
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<{ message: string; undo?: () => void } | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const lastGroup = useRef("");
  const input = useRef<HTMLInputElement>(null);
  const gapInputs = useRef<Array<HTMLInputElement | null>>([]);
  const [activeCode, setActiveCode] = useState(""),
    [codeInput, setCodeInput] = useState(""),
    [savedCodes, setSavedCodes] = useState<string[]>([]),
    [syncStatus, setSyncStatus] = useState<SyncStatus>("idle"),
    [loginError, setLoginError] = useState("");
  const syncReady = useRef(false),
    syncTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const syncViewport = () => {
      document.documentElement.style.setProperty(
        "--visual-viewport-height",
        `${viewport.height}px`,
      );
      document.documentElement.style.setProperty(
        "--visual-viewport-top",
        `${viewport.offsetTop}px`,
      );
    };
    syncViewport();
    viewport.addEventListener("resize", syncViewport);
    viewport.addEventListener("scroll", syncViewport);
    return () => {
      viewport.removeEventListener("resize", syncViewport);
      viewport.removeEventListener("scroll", syncViewport);
    };
  }, []);
  // Back closes the top layer first: sheet → category → tab → practice.
  useEffect(() => {
    window.history.replaceState({ littleWords: true, screen: "practice" }, "");
    const handleBack = (event: PopStateEvent) => {
      const state = event.state as NavState | null;
      const screen: NavScreen =
        state?.littleWords && state.screen ? state.screen : "practice";
      setAnswerFocused(false);
      input.current?.blur();
      if (!state?.sheet) setSheet(null);
      if (screen === "quiz") {
        setTab("practice");
        setOpenGroupId(null);
        return;
      }
      if (screen === "group" || screen === "book") {
        setTab("book");
        setOpenGroupId(screen === "group" ? state?.groupId || null : null);
        setQuiz([]);
        setDone(false);
        return;
      }
      setTab(screen);
      setOpenGroupId(null);
      if (screen === "practice") {
        setQuiz([]);
        setDone(false);
      }
    };
    window.addEventListener("popstate", handleBack);
    return () => window.removeEventListener("popstate", handleBack);
  }, []);
  useEffect(() => {
    try {
      setSavedCodes(JSON.parse(localStorage.getItem(CODE_LIST_KEY) || "[]"));
      const last = localStorage.getItem(ACTIVE_CODE_KEY) || "";
      if (last) {
        setCodeInput(last);
        void loginWithCode(last);
      }
    } catch {}
  }, []);
  const applyData = (d: Partial<CloudData>) => {
    const nextWords = Array.isArray(d.words) ? d.words : [];
    const nextGroups = Array.isArray(d.groups) ? d.groups : [];
    const nextHistory = Array.isArray(d.history) ? d.history : [];
    const nextCompletedGroupIds = Array.isArray(d.completedGroupIds)
      ? d.completedGroupIds.filter((id) =>
          nextGroups.some((group) => group.id === id),
        )
      : [];
    const firstPending = nextGroups.find(
      (group) => !nextCompletedGroupIds.includes(group.id),
    );
    setWords(nextWords);
    setGroups(nextGroups);
    setHistory(nextHistory);
    setCompletedGroupIds(nextCompletedGroupIds);
    setSelected(firstPending ? [firstPending.id] : []);
  };
  const loginWithCode = async (raw: string) => {
    const code = normalizeCode(raw);
    if (code.length < 2 || code.length > 30) {
      setLoginError("代號請輸入 2～30 個字元");
      return;
    }
    setLoginError("");
    setSyncStatus("loading");
    syncReady.current = false;
    let local: CloudData | undefined;
    try {
      const cached = localStorage.getItem(cacheKey(code));
      if (cached) local = JSON.parse(cached);
      if (local) applyData(local);
      if (!supabase) throw new Error("cloud unavailable");
      const codeHash = await hashCode(code);
      const { data, error } = await supabase.rpc("get_word_profile", {
        p_code_hash: codeHash,
      });
      if (error) throw error;
      const remote = data?.[0]?.data as CloudData | undefined;
      if (remote) {
        applyData(remote);
        localStorage.setItem(cacheKey(code), JSON.stringify(remote));
      } else {
        let initial = local;
        if (!initial && !localStorage.getItem(LEGACY_MIGRATED_KEY)) {
          const legacy = localStorage.getItem(LEGACY_KEY);
          if (legacy) {
            initial = JSON.parse(legacy);
            localStorage.setItem(LEGACY_MIGRATED_KEY, code);
          }
        }
        initial = initial || { words: [], groups: [], history: [] };
        applyData(initial);
        const saved = await supabase.rpc("save_word_profile", {
          p_code_hash: codeHash,
          p_data: initial,
        });
        if (saved.error) throw saved.error;
        localStorage.setItem(cacheKey(code), JSON.stringify(initial));
      }
      setActiveCode(code);
      setCodeInput(code);
      localStorage.setItem(ACTIVE_CODE_KEY, code);
      setSavedCodes((prev) => {
        const next = [code, ...prev.filter((x) => x !== code)];
        localStorage.setItem(CODE_LIST_KEY, JSON.stringify(next));
        return next;
      });
      syncReady.current = true;
      setReady(true);
      setSyncStatus("synced");
    } catch {
      if (local) {
        setActiveCode(code);
        setReady(true);
        syncReady.current = true;
        setSyncStatus("offline");
      } else {
        setSyncStatus("offline");
        setLoginError(
          cloudConfigured
            ? "目前無法連上雲端，請稍後再試。"
            : "尚未完成雲端連線設定。",
        );
      }
    }
  };
  useEffect(() => {
    if (!ready || !activeCode || !syncReady.current) return;
    const payload = { words, groups, history, completedGroupIds };
    localStorage.setItem(cacheKey(activeCode), JSON.stringify(payload));
    setSyncStatus("syncing");
    window.clearTimeout(syncTimer.current);
    syncTimer.current = window.setTimeout(async () => {
      try {
        if (!supabase) throw new Error();
        const { error } = await supabase.rpc("save_word_profile", {
          p_code_hash: await hashCode(activeCode),
          p_data: payload,
        });
        if (error) throw error;
        setSyncStatus("synced");
      } catch {
        setSyncStatus("offline");
      }
    }, 700);
    return () => window.clearTimeout(syncTimer.current);
  }, [words, groups, history, completedGroupIds, ready, activeCode]);
  const switchCode = () => {
    syncReady.current = false;
    setActiveCode("");
    setReady(false);
    setSyncStatus("idle");
    setTab("practice");
    setOpenGroupId(null);
    setSheet(null);
    setQuiz([]);
    setDone(false);
    window.history.replaceState({ littleWords: true, screen: "practice" }, "");
  };
  const showToast = (message: string, undo?: () => void) => {
    window.clearTimeout(toastTimer.current);
    setToast({ message, undo });
    toastTimer.current = window.setTimeout(() => setToast(null), undo ? 5000 : 2200);
  };
  const pool = useMemo(
      () => words.filter((w) => selected.includes(w.group)),
      [words, selected],
    ),
    cur = quiz[idx],
    letterGap = cur
      ? makeLetterGap(cur.en, `${cur.id}:${idx}`)
      : { prompt: "", answer: "", characters: [], missingIndexes: [] };
  const countIn = (groupId: string) =>
    words.filter((word) => word.group === groupId).length;
  const pendingGroups = groups.filter(
    (group) => !completedGroupIds.includes(group.id),
  );
  const completedGroups = groups.filter((group) =>
    completedGroupIds.includes(group.id),
  );
  const setGroupCompleted = (groupIds: string[], completed: boolean) => {
    setCompletedGroupIds((current) =>
      completed
        ? [...current, ...groupIds.filter((id) => !current.includes(id))]
        : current.filter((id) => !groupIds.includes(id)),
    );
  };
  const toggleSelected = (groupId: string) =>
    setSelected((current) =>
      current.includes(groupId)
        ? current.filter((id) => id !== groupId)
        : [...current, groupId],
    );
  const groupChip = (group: Group) => {
    const on = selected.includes(group.id);
    const count = countIn(group.id);
    return (
      <button
        key={group.id}
        type="button"
        className={`group-chip${on ? " chosen" : ""}`}
        style={{ "--tone": group.color } as React.CSSProperties}
        aria-pressed={on}
        disabled={!count}
        onClick={() => toggleSelected(group.id)}
      >
        <span className="chip-check">{on ? <Check size={14} /> : null}</span>
        <b>{group.name}</b>
        <small>{count}</small>
      </button>
    );
  };
  const focusAnswer = () => {
    if (practiceMode === "missing") gapInputs.current[0]?.focus();
    else input.current?.focus();
  };
  const speak = (text = cur?.en) => {
    if (!text || !("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.55;
    u.pitch = 1.05;
    speechSynthesis.speak(u);
  };
  const navState = () => (window.history.state || {}) as NavState;
  const pushScreen = (screen: NavScreen, groupId?: string) =>
    window.history.pushState({ littleWords: true, screen, groupId }, "");
  const changeTab = (nextTab: Tab) => {
    if (nextTab === tab && !openGroupId && !quiz.length && !done) return;
    pushScreen(nextTab);
    setTab(nextTab);
    setOpenGroupId(null);
    setSheet(null);
    if (nextTab === "practice") {
      setQuiz([]);
      setDone(false);
    }
  };
  const openGroup = (groupId: string) => {
    pushScreen("group", groupId);
    setTab("book");
    setOpenGroupId(groupId);
    setSearch("");
  };
  const openSheet = (next: Sheet) => {
    window.history.pushState({ ...navState(), littleWords: true, sheet: true }, "");
    setSheet(next);
  };
  const closeSheet = () => {
    if (navState().sheet) window.history.back();
    else setSheet(null);
  };
  const start = () => {
    if (!pool.length) return;
    const q = [...pool].sort(() => Math.random() - 0.5);
    if (navState().screen !== "quiz") pushScreen("quiz");
    setTab("practice");
    setQuiz(q);
    setIdx(0);
    setScore(0);
    setAnswer("");
    setGapAnswers([]);
    setResult("idle");
    setAttempts(0);
    setCountedCurrent(false);
    setDone(false);
    setTimeout(() => speak(q[0].en), 150);
  };
  const check = (e: FormEvent) => {
    e.preventDefault();
    if (!cur) return;
    const expected = practiceMode === "missing" ? letterGap.answer : cur.en;
    const submitted =
      practiceMode === "missing"
        ? letterGap.missingIndexes
            .map(
              (_, slot) =>
                gapInputs.current[slot]?.value || gapAnswers[slot] || "",
            )
            .join("")
        : answer.trim();
    if (!submitted || submitted.length !== expected.length) return;
    const ok = submitted.toLowerCase() === expected.toLowerCase();
    if (ok) {
      input.current?.blur();
      gapInputs.current.forEach((element) => element?.blur());
      setResult("correct");
      if (!countedCurrent) {
        setScore((s) => s + 1);
        setCountedCurrent(true);
      }
    } else {
      setResult("wrong");
      setAttempts((a) => a + 1);
      setAnswer("");
      setGapAnswers([]);
      setTimeout(focusAnswer, 40);
    }
  };
  const repeatCurrent = () => {
    if (!cur) return;
    setAnswer("");
    setGapAnswers([]);
    setResult("idle");
    setAttempts(0);
    setTimeout(() => speak(cur.en), 80);
    setTimeout(focusAnswer, 120);
  };
  const next = () => {
    if (idx + 1 >= quiz.length) {
      setDone(true);
      setHistory((h) => [
        {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          score,
          total: quiz.length,
          groupIds: [...selected],
          groupNames: groups
            .filter((g) => selected.includes(g.id))
            .map((g) => g.name),
        },
        ...h,
      ]);
      return;
    }
    const n = idx + 1;
    setIdx(n);
    setAnswer("");
    setGapAnswers([]);
    setResult("idle");
    setAttempts(0);
    setCountedCurrent(false);
    setTimeout(() => speak(quiz[n].en), 100);
    setTimeout(focusAnswer, 120);
  };
  const createGroup = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return "";
    const existing = groups.find((g) => g.name === trimmed);
    if (existing) return existing.id;
    const id = crypto.randomUUID();
    setGroups((s) => {
      const unused = GROUP_COLORS.find((c) => !s.some((g) => g.color === c));
      return [
        ...s,
        { id, name: trimmed, color: unused || GROUP_COLORS[s.length % GROUP_COLORS.length] },
      ];
    });
    return id;
  };
  const saveWord = (word: Word, isNew: boolean) => {
    lastGroup.current = word.group;
    setWords((s) =>
      isNew ? [...s, word] : s.map((w) => (w.id === word.id ? word : w)),
    );
  };
  const removeWord = (id: string) => {
    const index = words.findIndex((w) => w.id === id);
    const removed = words[index];
    if (!removed) return;
    setWords((s) => s.filter((w) => w.id !== id));
    showToast(`已刪除「${removed.en}」`, () =>
      setWords((s) =>
        s.some((w) => w.id === removed.id)
          ? s
          : [...s.slice(0, index), removed, ...s.slice(index)],
      ),
    );
  };
  const renameGroup = (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setGroups((s) => s.map((g) => (g.id === id ? { ...g, name: trimmed } : g)));
  };
  const deleteGroup = (id: string, moveTo: string) => {
    if (moveTo)
      setWords((s) => s.map((w) => (w.group === id ? { ...w, group: moveTo } : w)));
    else setWords((s) => s.filter((w) => w.group !== id));
    setGroups((s) => s.filter((g) => g.id !== id));
    setCompletedGroupIds((ids) => ids.filter((x) => x !== id));
    setSelected((ids) => ids.filter((x) => x !== id));
  };
  const reorderGroups = (from: number, to: number) =>
    setGroups((s) => {
      const nextGroups = [...s];
      const [moved] = nextGroups.splice(from, 1);
      nextGroups.splice(to, 0, moved);
      return nextGroups;
    });
  const handleExport = () => {
    const blob = new Blob(
      [JSON.stringify({ words, groups, history, completedGroupIds }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `little-words-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const d = JSON.parse(ev.target?.result as string);
        if (d.words && d.groups) {
          setWords(d.words);
          setGroups(d.groups);
          setHistory(d.history || []);
          setCompletedGroupIds(
            Array.isArray(d.completedGroupIds) ? d.completedGroupIds : [],
          );
          showToast("還原成功");
        }
      } catch {
        showToast("檔案格式錯誤");
      }
    };
    reader.readAsText(file);
  };
  if (!activeCode)
    return (
      <CodeLogin
        code={codeInput}
        setCode={setCodeInput}
        savedCodes={savedCodes}
        status={syncStatus}
        error={loginError}
        login={loginWithCode}
      />
    );
  const openGroupData = openGroupId ? groups.find((g) => g.id === openGroupId) : undefined;
  const defaultGroup =
    (groups.some((g) => g.id === lastGroup.current) && lastGroup.current) ||
    groups[0]?.id ||
    "";
  const query = search.trim().toLowerCase();
  const found = query
    ? words.filter(
        (w) =>
          w.en.toLowerCase().includes(query) ||
          w.zh.includes(search.trim()) ||
          w.bpmf.includes(search.trim()),
      )
    : [];
  const selectedNames = groups.filter((g) => selected.includes(g.id));
  const unfinishedSelected = selectedNames.filter(
    (g) => !completedGroupIds.includes(g.id),
  );
  return (
    <main key="word-app" className="notranslate">
      <Header
        tab={tab}
        setTab={changeTab}
        code={activeCode}
        status={syncStatus}
        switchCode={switchCode}
      />
      <div className="shell">
        {tab === "practice" &&
          (done ? (
            <section className="result-card card">
              <CheckCircle2 className="result-icon" size={42} />
              <h2>完成練習！</h2>
              <p>這次答對 {score} / {quiz.length} 題</p>
              <div className="score">
                <b>{Math.round((score / quiz.length) * 100)}</b>
                <small>分</small>
              </div>
              <div className="result-summary">
                <span>
                  {practiceMode === "missing" ? "字母填空" : "完整拼字"}
                </span>
                <span>{quiz.length} 個單字</span>
              </div>
              {unfinishedSelected.length > 0 && (
                <button
                  type="button"
                  className="mark-done"
                  onClick={() => {
                    setGroupCompleted(unfinishedSelected.map((g) => g.id), true);
                    showToast(`已把 ${unfinishedSelected.map((g) => g.name).join("、")} 標記為已完成`);
                  }}
                >
                  <CheckCircle2 size={18} />
                  把「{unfinishedSelected.map((g) => g.name).join("、")}」標記為已完成
                </button>
              )}
              <div className="result-actions">
                <button className="primary" onClick={start}>
                  <RotateCcw size={18} /> 再練一次
                </button>
                <button
                  className="secondary"
                  onClick={() => {
                    setQuiz([]);
                    setDone(false);
                    window.history.replaceState(
                      { littleWords: true, screen: "practice" },
                      "",
                    );
                  }}
                >
                  換別的分類
                </button>
              </div>
            </section>
          ) : !quiz.length ? (
            <section className="practice-setup">
              <div className="title">
                <h2>開始練習</h2>
              </div>
              {groups.length === 0 ? (
                <div className="card empty-start">
                  <BookOpen size={30} />
                  <p>還沒有單字，先到單字本新增分類和單字。</p>
                  <button className="primary" onClick={() => changeTab("book")}>
                    前往單字本 <ArrowRight size={18} />
                  </button>
                </div>
              ) : (
                <>
                  <section className="card setup-block">
                    <div className="block-head">
                      <h3>要練哪些分類</h3>
                      {pendingGroups.length > 1 && (
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => {
                            const ids = pendingGroups.filter((g) => countIn(g.id)).map((g) => g.id);
                            setSelected((current) =>
                              ids.every((id) => current.includes(id))
                                ? current.filter((id) => !ids.includes(id))
                                : [...new Set([...current, ...ids])],
                            );
                          }}
                        >
                          {pendingGroups.filter((g) => countIn(g.id)).every((g) => selected.includes(g.id))
                            ? "全部取消"
                            : "全選"}
                        </button>
                      )}
                    </div>
                    {pendingGroups.length ? (
                      <div className="chip-grid">{pendingGroups.map(groupChip)}</div>
                    ) : (
                      <p className="empty-groups">所有分類都已完成，可以從下面挑一組複習。</p>
                    )}
                    {completedGroups.length > 0 && (
                      <div className="completed-groups">
                        <button
                          type="button"
                          className="completed-toggle"
                          aria-expanded={showCompleted}
                          onClick={() => setShowCompleted((open) => !open)}
                        >
                          <span>
                            <CheckCircle2 size={18} />
                            已完成 {completedGroups.length} 個分類
                          </span>
                          {showCompleted ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                        {showCompleted && (
                          <div className="chip-grid">{completedGroups.map(groupChip)}</div>
                        )}
                      </div>
                    )}
                  </section>
                  <section className="card setup-block">
                    <div className="block-head">
                      <h3>練習方式</h3>
                    </div>
                    <div className="mode-picker" aria-label="選擇練習方式">
                      <button
                        type="button"
                        className={practiceMode === "full" ? "chosen" : ""}
                        onClick={() => setPracticeMode("full")}
                        aria-pressed={practiceMode === "full"}
                      >
                        <PenLine size={22} />
                        <span>
                          <b>完整拼字</b>
                          <small>看中文，寫出英文</small>
                        </span>
                      </button>
                      <button
                        type="button"
                        className={practiceMode === "missing" ? "chosen" : ""}
                        onClick={() => setPracticeMode("missing")}
                        aria-pressed={practiceMode === "missing"}
                      >
                        <Puzzle size={22} />
                        <span>
                          <b>字母填空</b>
                          <small>填入缺少的字母</small>
                        </span>
                      </button>
                    </div>
                  </section>
                  <div className="start-bar">
                    <button className="primary" disabled={!pool.length} onClick={start}>
                      {pool.length ? `開始練習 · ${pool.length} 個單字` : "先選一個分類"}
                      {pool.length > 0 && <ArrowRight size={18} />}
                    </button>
                  </div>
                </>
              )}
            </section>
          ) : (
            <section
              className={`quiz card${answerFocused ? " answering" : ""}`}
            >
              <div className="qtop">
                <span>
                  第 {idx + 1} / {quiz.length} 題
                </span>
                <span>答對 {score} 題</span>
              </div>
              <div className="progress">
                <i style={{ width: `${((idx + 1) / quiz.length) * 100}%` }} />
              </div>
              <p>
                {practiceMode === "missing"
                  ? "看提示，填入空缺的英文字母"
                  : "看中文，寫出完整英文單字"}
              </p>
              <div className="zh">{cur?.zh}</div>
              <div className="bpmf">{cur?.bpmf}</div>
              <button className="speak" onClick={() => speak()}>
                    <Volume2 size={18} /> 再聽一次
              </button>
              <form
                className={practiceMode === "missing" ? "missing-form" : ""}
                onSubmit={check}
              >
                {practiceMode === "missing" ? (
                  <div
                    className="inline-gap"
                    aria-label={`單字提示 ${letterGap.prompt}`}
                  >
                    {letterGap.characters.map((character, characterIndex) => {
                      const slot = letterGap.missingIndexes.indexOf(characterIndex);
                      if (slot < 0)
                        return (
                          <span key={characterIndex}>
                            {character === " " ? " " : character}
                          </span>
                        );
                      return (
                        <input
                          key={characterIndex}
                          ref={(element) => {
                            gapInputs.current[slot] = element;
                          }}
                          autoFocus={slot === 0}
                          value={gapAnswers[slot] || ""}
                          maxLength={1}
                          disabled={result === "correct"}
                          aria-label={`第 ${slot + 1} 個空缺字母`}
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                          onFocus={() => setAnswerFocused(true)}
                          onBlur={() => setAnswerFocused(false)}
                          onKeyDown={(event) => {
                            if (
                              event.key === "Backspace" &&
                              !gapAnswers[slot] &&
                              slot > 0
                            )
                              gapInputs.current[slot - 1]?.focus();
                          }}
                          onChange={(event) => {
                            const value = event.target.value
                              .replace(/[^a-z]/gi, "")
                              .slice(-1)
                              .toLowerCase();
                            setGapAnswers((current) => {
                              const nextAnswers = Array.from(
                                { length: letterGap.missingIndexes.length },
                                (_, index) => current[index] || "",
                              );
                              nextAnswers[slot] = value;
                              return nextAnswers;
                            });
                            if (result === "wrong") setResult("idle");
                            if (value && slot + 1 < letterGap.missingIndexes.length)
                              gapInputs.current[slot + 1]?.focus();
                          }}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <input
                    ref={input}
                    autoFocus
                    value={answer}
                    onFocus={() => setAnswerFocused(true)}
                    onBlur={() => setAnswerFocused(false)}
                    onChange={(e) => {
                      setAnswer(e.target.value);
                      if (result === "wrong") setResult("idle");
                    }}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="在這裡輸入英文"
                  />
                )}
                {result === "idle" && (
                  <button
                    type="button"
                    className="primary"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      const form = e.currentTarget.form;
                      if (practiceMode === "missing") {
                        gapInputs.current.forEach((element) => element?.blur());
                        window.setTimeout(() => form?.requestSubmit(), 40);
                      } else form?.requestSubmit();
                    }}
                    onClick={(e) => {
                      if (e.detail === 0) e.currentTarget.form?.requestSubmit();
                    }}
                  >
                    確定
                  </button>
                )}
              </form>
              {result === "correct" && (
                <div className="feedback good">
                  <b>答對了！</b>
                  <span>{cur?.en}</span>
                  <div className="feedback-actions">
                    <button
                      type="button"
                      className="repeat"
                      onClick={repeatCurrent}
                    >
                      <RotateCcw size={17} />
                      再練一次
                    </button>
                    <button type="button" onClick={next}>
                      {idx + 1 >= quiz.length ? "查看結果" : "下一題"}
                      <ArrowRight size={17} />
                    </button>
                  </div>
                </div>
              )}
              {result === "wrong" && (
                <div className="feedback try">
                  <b>再想想看～</b>
                  <span>
                    {attempts < 2
                      ? "輸入錯誤，請再試一次！"
                      : "可以再聽一次或修改答案。"}
                  </span>
                  {attempts >= 2 && (
                    <button
                      type="button"
                      onClick={() => {
                        input.current?.blur();
                        gapInputs.current.forEach((element) => element?.blur());
                        setAnswer(
                          practiceMode === "missing"
                            ? ""
                            : cur?.en || "",
                        );
                        if (practiceMode === "missing")
                          setGapAnswers([...letterGap.answer]);
                        setResult("correct");
                        setCountedCurrent(true);
                      }}
                    >
                      看看答案
                    </button>
                  )}
                </div>
              )}
            </section>
          ))}
        {tab === "book" &&
          (openGroupData ? (
            <GroupPage
              group={openGroupData}
              words={words.filter((w) => w.group === openGroupData.id)}
              completed={completedGroupIds.includes(openGroupData.id)}
              speak={speak}
              back={() => window.history.back()}
              addWord={() => openSheet({ kind: "word", group: openGroupData.id })}
              editWord={(id) => openSheet({ kind: "word", id })}
              rename={() => openSheet({ kind: "group-rename", id: openGroupData.id })}
              remove={() => openSheet({ kind: "group-delete", id: openGroupData.id })}
              toggleCompleted={() =>
                setGroupCompleted(
                  [openGroupData.id],
                  !completedGroupIds.includes(openGroupData.id),
                )
              }
              practice={() => {
                setSelected([openGroupData.id]);
                setQuiz([]);
                setDone(false);
                setOpenGroupId(null);
                pushScreen("practice");
                setTab("practice");
              }}
            />
          ) : (
            <section className="book">
              <div className="book-head">
                <h2>單字本</h2>
                <button
                  className="primary"
                  disabled={!groups.length}
                  onClick={() => openSheet({ kind: "word", group: defaultGroup })}
                >
                  <Plus size={18} /> 新增單字
                </button>
              </div>
              {words.length > 0 && (
                <label className="search-box">
                  <Search size={18} />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="找單字（中文或英文）"
                    aria-label="搜尋單字"
                  />
                  {search && (
                    <button type="button" aria-label="清除搜尋" onClick={() => setSearch("")}>
                      <X size={16} />
                    </button>
                  )}
                </label>
              )}
              {query ? (
                <div className="card word-rows">
                  {found.length ? (
                    found.map((w) => (
                      <WordRow
                        key={w.id}
                        word={w}
                        groupName={groups.find((g) => g.id === w.group)?.name}
                        speak={speak}
                        edit={() => openSheet({ kind: "word", id: w.id })}
                      />
                    ))
                  ) : (
                    <p className="empty-note">找不到「{search.trim()}」</p>
                  )}
                </div>
              ) : (
                <>
                  <div className="group-list">
                    {groups.map((g) => (
                      <button
                        key={g.id}
                        className="card group-row"
                        style={{ "--tone": g.color } as React.CSSProperties}
                        onClick={() => openGroup(g.id)}
                      >
                        <i />
                        <span>
                          <b>{g.name}</b>
                          <small>
                            {countIn(g.id)} 個單字
                            {completedGroupIds.includes(g.id) && (
                              <em>
                                <CheckCircle2 size={13} /> 已完成
                              </em>
                            )}
                          </small>
                        </span>
                        <ChevronRight size={20} />
                      </button>
                    ))}
                  </div>
                  <div className="book-actions">
                    <button className="secondary" onClick={() => openSheet({ kind: "group-new" })}>
                      <Plus size={17} /> 新增分類
                    </button>
                    {groups.length > 1 && (
                      <button className="secondary" onClick={() => openSheet({ kind: "group-order" })}>
                        <ListOrdered size={17} /> 調整順序
                      </button>
                    )}
                  </div>
                  {groups.length === 0 && (
                    <p className="empty-note">先新增一個分類，例如「水果」或「第一課」。</p>
                  )}
                </>
              )}
            </section>
          ))}
        {tab === "history" && (
          <section>
            <div className="title">
              <h2>練習紀錄</h2>
            </div>
            {history.length === 0 ? (
              <div className="card empty-note big">還沒有練習紀錄</div>
            ) : (
              <div className="history-list">
                {history.map((h) => (
                  <article key={h.id} className="card history-card">
                    <div>
                      <h3>{h.groupNames.length ? h.groupNames.join("、") : "全部"}</h3>
                      <p>{new Date(h.timestamp).toLocaleString()}</p>
                    </div>
                    <div className="history-score">
                      <b>{h.score}</b> / {h.total}
                    </div>
                  </article>
                ))}
              </div>
            )}
            <div className="card settings-card">
              <h3>備份與還原</h3>
              <p>把單字、分類和練習紀錄存成檔案，或從檔案還原。</p>
              <div className="backup-actions">
                <button className="secondary" onClick={handleExport}>
                  匯出備份
                </button>
                <label className="secondary">
                  從檔案還原
                  <input type="file" accept=".json" hidden onChange={handleImport} />
                </label>
              </div>
            </div>
          </section>
        )}
      </div>
      <footer>
        已使用代號「{activeCode}」同步到雲端 · 發音由瀏覽器語音功能提供
      </footer>
      {sheet?.kind === "word" && (
        <WordSheet
          key={sheet.id || "new"}
          word={sheet.id ? words.find((w) => w.id === sheet.id) : undefined}
          group={sheet.group || defaultGroup}
          groups={groups}
          speak={speak}
          createGroup={createGroup}
          close={closeSheet}
          save={(word, isNew) => {
            saveWord(word, isNew);
            if (isNew) showToast(`已加入「${word.en}」`);
            else closeSheet();
          }}
          remove={(id) => {
            closeSheet();
            removeWord(id);
          }}
        />
      )}
      {sheet?.kind === "group-new" && (
        <NameSheet
          title="新增分類"
          initial=""
          action="建立"
          close={closeSheet}
          save={(name) => {
            const id = createGroup(name);
            closeSheet();
            if (id) showToast(`已新增「${name.trim()}」`);
          }}
        />
      )}
      {sheet?.kind === "group-rename" && (
        <NameSheet
          title="分類名稱"
          initial={groups.find((g) => g.id === sheet.id)?.name || ""}
          action="儲存"
          close={closeSheet}
          save={(name) => {
            renameGroup(sheet.id, name);
            closeSheet();
          }}
        />
      )}
      {sheet?.kind === "group-delete" && (
        <DeleteGroupSheet
          group={groups.find((g) => g.id === sheet.id)!}
          count={countIn(sheet.id)}
          others={groups.filter((g) => g.id !== sheet.id)}
          close={closeSheet}
          confirm={(moveTo) => {
            const name = groups.find((g) => g.id === sheet.id)?.name;
            deleteGroup(sheet.id, moveTo);
            setSheet(null);
            setOpenGroupId(null);
            window.history.go(-2);
            showToast(`已刪除「${name}」`);
          }}
        />
      )}
      {sheet?.kind === "group-order" && (
        <SheetFrame title="調整分類順序" close={closeSheet}>
          <p className="sheet-note">按住右邊把手上下拖曳</p>
          <Sortable
            items={groups}
            getKey={(g) => g.id}
            onMove={reorderGroups}
            className="order-list"
            renderItem={(g, _i, handle) => (
              <div className="order-row" style={{ "--tone": g.color } as React.CSSProperties}>
                <i />
                <b>{g.name}</b>
                <small>{countIn(g.id)}</small>
                <span {...handle} className="drag-handle" aria-label={`拖曳排序 ${g.name}`}>
                  <GripVertical size={20} />
                </span>
              </div>
            )}
          />
        </SheetFrame>
      )}
      {toast && (
        <div className="toast" role="status">
          <span>{toast.message}</span>
          {toast.undo && (
            <button
              onClick={() => {
                toast.undo?.();
                setToast(null);
              }}
            >
              復原
            </button>
          )}
        </div>
      )}
    </main>
  );
}
function Header({
  tab,
  setTab,
  code,
  status,
  switchCode,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  code: string;
  status: SyncStatus;
  switchCode: () => void;
}) {
  return (
    <header>
      <div className="brand">
        <span className="logo">Aa</span>
        <div>
          <h1>小小單字島</h1>
          <p>每天一點點，英文更進步</p>
        </div>
      </div>
      <div className="cloud-user">
        <span
          title={
            status === "synced"
              ? "已同步"
              : status === "syncing"
                ? "同步中"
                : "離線快取"
          }
        >
          {status === "offline" ? (
            <CloudOff size={16} />
          ) : status === "syncing" ? (
            <RefreshCw className="spin" size={16} />
          ) : (
            <Cloud size={16} />
          )}
          <b>{code}</b>
        </span>
        <button onClick={switchCode} aria-label="切換登入代號">
          切換
        </button>
      </div>
      <nav>
        {(
          [
            ["practice", "練習", PenLine],
            ["book", "單字本", BookOpen],
            ["history", "紀錄", HistoryIcon],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            className={tab === key ? "active" : ""}
            aria-current={tab === key ? "page" : undefined}
            onClick={() => setTab(key)}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </nav>
    </header>
  );
}
function CodeLogin({
  code,
  setCode,
  savedCodes,
  status,
  error,
  login,
}: {
  code: string;
  setCode: (v: string) => void;
  savedCodes: string[];
  status: SyncStatus;
  error: string;
  login: (v: string) => void;
}) {
  const busy = status === "loading";
  return (
    <main key="code-login" className="login-page notranslate">
      <section className="login-card card">
        <div className="login-mark">
          <Cloud size={28} />
        </div>
        <h1>登入小小單字島</h1>
        <p>輸入自己的代號，單字、分類和練習紀錄就會在手機與電腦同步。</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void login(code);
          }}
        >
          <label>
            登入代號
            <div className="code-field">
              <UserRound size={19} />
              <input
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="例如：grace-01"
                autoComplete="username"
              />
            </div>
          </label>
          <button className="primary" disabled={busy || !code.trim()}>
            {busy ? (
              <>
                <RefreshCw className="spin" size={18} />
                連線中…
              </>
            ) : (
              <>
                <LogIn size={18} />
                登入或新增代號
              </>
            )}
          </button>
        </form>
        {error && (
          <div className="login-error">
            <CloudOff size={17} />
            {error}
          </div>
        )}
        <small className="code-warning">
          知道代號的人可以查看與修改這份資料，請使用不容易被猜到的代號。
        </small>
        {savedCodes.length > 0 && (
          <div className="saved-codes">
            <h2>這台裝置用過的代號</h2>
            {savedCodes.map((item) => (
              <button
                key={item}
                onClick={() => {
                  setCode(item);
                  void login(item);
                }}
              >
                <CheckCircle2 size={17} />
                <span>{item}</span>
                <ArrowRight size={17} />
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
function WordRow({
  word,
  groupName,
  speak,
  edit,
}: {
  word: Word;
  groupName?: string;
  speak: (s: string) => void;
  edit: () => void;
}) {
  return (
    <div className="word-row">
      <button className="sound" aria-label={`播放${word.en}發音`} onClick={() => speak(word.en)}>
        <Volume2 size={18} />
      </button>
      <button className="word-main" onClick={edit} aria-label={`編輯 ${word.en}`}>
        <b>{word.en}</b>
        <span>
          {word.zh} <small className="bpmf">{word.bpmf}</small>
          {groupName && <em>{groupName}</em>}
        </span>
      </button>
      <Pencil size={15} className="row-hint" aria-hidden="true" />
    </div>
  );
}
function GroupPage({
  group,
  words,
  completed,
  speak,
  back,
  addWord,
  editWord,
  rename,
  remove,
  toggleCompleted,
  practice,
}: {
  group: Group;
  words: Word[];
  completed: boolean;
  speak: (s: string) => void;
  back: () => void;
  addWord: () => void;
  editWord: (id: string) => void;
  rename: () => void;
  remove: () => void;
  toggleCompleted: () => void;
  practice: () => void;
}) {
  return (
    <section className="group-page" style={{ "--tone": group.color } as React.CSSProperties}>
      <button className="back-button" onClick={back}>
        <ArrowLeft size={18} />
        單字本
      </button>
      <div className="group-title">
        <button className="title-edit" onClick={rename} aria-label={`修改分類名稱 ${group.name}`}>
          <i />
          <h2>{group.name}</h2>
          <Pencil size={16} />
        </button>
        <p>
          {words.length} 個單字{completed ? " · 已完成" : ""}
        </p>
      </div>
      <div className="group-actions">
        <button className="primary" disabled={!words.length} onClick={practice}>
          練習這組 <ArrowRight size={18} />
        </button>
        <button className="secondary" onClick={addWord}>
          <Plus size={17} /> 新增單字
        </button>
      </div>
      {words.length === 0 ? (
        <div className="card empty-note big">這個分類還沒有單字</div>
      ) : (
        <div className="card word-rows">
          {words.map((w) => (
            <WordRow key={w.id} word={w} speak={speak} edit={() => editWord(w.id)} />
          ))}
        </div>
      )}
      <div className="group-footer">
        <button className="link-button" onClick={toggleCompleted}>
          {completed ? <RotateCcw size={16} /> : <CheckCircle2 size={16} />}
          {completed ? "移回尚未完成" : "標記為已完成"}
        </button>
        <button className="link-button danger" onClick={remove}>
          <Trash2 size={16} /> 刪除分類
        </button>
      </div>
    </section>
  );
}
function SheetFrame({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <section className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-head">
          <h3>{title}</h3>
          <button type="button" className="icon-button" onClick={close} aria-label="關閉">
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function NameSheet({
  title,
  initial,
  action,
  close,
  save,
}: {
  title: string;
  initial: string;
  action: string;
  close: () => void;
  save: (name: string) => void;
}) {
  const [name, setName] = useState(initial);
  return (
    <SheetFrame title={title} close={close}>
      <form
        className="sheet-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) save(name);
        }}
      >
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：水果、第一課" maxLength={30} />
        <button className="primary" disabled={!name.trim()}>
          {action}
        </button>
      </form>
    </SheetFrame>
  );
}
function DeleteGroupSheet({
  group,
  count,
  others,
  close,
  confirm,
}: {
  group: Group;
  count: number;
  others: Group[];
  close: () => void;
  confirm: (moveTo: string) => void;
}) {
  const [target, setTarget] = useState(others[0]?.id || "");
  return (
    <SheetFrame title={`刪除「${group.name}」？`} close={close}>
      <div className="sheet-form">
        {count > 0 ? (
          <label>
            裡面的 {count} 個單字
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              {others.map((g) => (
                <option key={g.id} value={g.id}>
                  移到「{g.name}」
                </option>
              ))}
              <option value="">一起刪除</option>
            </select>
          </label>
        ) : (
          <p className="sheet-note">這個分類是空的。</p>
        )}
        <div className="sheet-buttons">
          <button type="button" className="secondary" onClick={close}>
            取消
          </button>
          <button type="button" className="danger-button" onClick={() => confirm(count ? target : "")}>
            刪除分類
          </button>
        </div>
      </div>
    </SheetFrame>
  );
}
function WordSheet({
  word,
  group,
  groups,
  speak,
  createGroup,
  close,
  save,
  remove,
}: {
  word?: Word;
  group: string;
  groups: Group[];
  speak: (s: string) => void;
  createGroup: (name: string) => string;
  close: () => void;
  save: (word: Word, isNew: boolean) => void;
  remove: (id: string) => void;
}) {
  const [zh, setZh] = useState(word?.zh || ""),
    [en, setEn] = useState(word?.en || ""),
    [bpmf, setBpmf] = useState(word?.bpmf || ""),
    [wg, setWg] = useState(word?.group || group),
    [newGroup, setNewGroup] = useState<string | null>(null),
    [lookup, setLookup] = useState<"idle" | "loading" | "found" | "missing">("idle");
  const lookupQuery = useRef(word?.zh || "");
  const zhInput = useRef<HTMLInputElement>(null);
  const fetchBopomofo = async (text: string) => {
    const r = await fetch(`https://www.moedict.tw/a/${encodeURIComponent(text)}.json`);
    if (!r.ok) return "";
    const d = await r.json();
    return (d.h?.[0]?.b || "") as string;
  };
  const searchWord = async () => {
    const q = zh.trim();
    if (!q || lookupQuery.current === q) return;
    lookupQuery.current = q;
    setLookup("loading");
    const local = dictionary.find((x) => x[0] === q);
    if (local) {
      setBpmf(local[2]);
      if (!en.trim()) setEn(local[1]);
      setLookup("found");
      return;
    }
    try {
      let pronunciation = await fetchBopomofo(q);
      if (!pronunciation && [...q].length > 1) {
        const parts = await Promise.all([...q].map(fetchBopomofo));
        if (parts.every(Boolean)) pronunciation = parts.join(" ");
      }
      if (lookupQuery.current !== q) return;
      if (pronunciation) {
        setBpmf(pronunciation);
        setLookup("found");
      } else setLookup("missing");
    } catch {
      if (lookupQuery.current === q) setLookup("missing");
    }
  };
  const groupId = newGroup !== null ? "" : wg;
  const canSave = zh.trim() && en.trim() && (groupId || (newGroup || "").trim());
  return (
    <SheetFrame title={word ? "編輯單字" : "新增單字"} close={close}>
      <form
        className="sheet-form word-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSave) return;
          const target = newGroup !== null ? createGroup(newGroup) : wg;
          if (!target) return;
          save(
            {
              id: word?.id || crypto.randomUUID(),
              zh: zh.trim(),
              en: en.trim().toLowerCase(),
              bpmf: bpmf.trim(),
              group: target,
            },
            !word,
          );
          if (!word) {
            setZh("");
            setEn("");
            setBpmf("");
            setLookup("idle");
            lookupQuery.current = "";
            setWg(target);
            setNewGroup(null);
            zhInput.current?.focus();
          }
        }}
      >
        <label>
          中文
          <input
            ref={zhInput}
            autoFocus={!word}
            value={zh}
            onChange={(e) => {
              setZh(e.target.value);
              setLookup("idle");
              lookupQuery.current = "";
            }}
            onBlur={() => void searchWord()}
            placeholder="例如：蘋果"
          />
        </label>
        <label>
          注音
          <input
            className="bpmf"
            value={bpmf}
            onChange={(e) => setBpmf(e.target.value)}
            placeholder={lookup === "loading" ? "查詢中…" : "輸入中文後自動帶出"}
          />
          {lookup === "missing" && <small className="lookuperror">查不到注音，請手動輸入</small>}
        </label>
        <label>
          英文
          <div className="with">
            <input
              value={en}
              onChange={(e) => setEn(e.target.value)}
              placeholder="例如：apple"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            <button type="button" onClick={() => speak(en)} aria-label="播放英文發音" disabled={!en.trim()}>
              <Volume2 size={17} />
            </button>
          </div>
        </label>
        <label>
          分類
          {newGroup === null ? (
            <select
              value={wg}
              onChange={(e) => {
                if (e.target.value === "__new") setNewGroup("");
                else setWg(e.target.value);
              }}
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
              <option value="__new">＋ 新增分類…</option>
            </select>
          ) : (
            <div className="inlinegroup">
              <input
                autoFocus
                value={newGroup}
                onChange={(e) => setNewGroup(e.target.value)}
                placeholder="新分類名稱"
                maxLength={30}
              />
              <button type="button" onClick={() => setNewGroup(null)}>
                取消
              </button>
            </div>
          )}
        </label>
        <button className="primary" disabled={!canSave}>
          {word ? "儲存" : "加入"}
        </button>
        {word && (
          <button type="button" className="link-button danger center" onClick={() => remove(word.id)}>
            <Trash2 size={16} /> 刪除這個單字
          </button>
        )}
      </form>
    </SheetFrame>
  );
}
/** Reorders rows by dragging a handle; works with touch, mouse and pen. */
function Sortable<T>({
  items,
  getKey,
  onMove,
  renderItem,
  className = "",
}: {
  items: T[];
  getKey: (item: T, index: number) => string;
  onMove: (from: number, to: number) => void;
  renderItem: (
    item: T,
    index: number,
    handle: React.HTMLAttributes<HTMLElement>,
  ) => React.ReactNode;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const state = useRef<{
    from: number;
    to: number;
    dy: number;
    startY: number;
    rects: DOMRect[];
    size: number;
  } | null>(null);
  const [drag, setDrag] = useState<{ from: number; to: number; dy: number; size: number } | null>(null);
  const begin = (e: React.PointerEvent<HTMLElement>, index: number) => {
    if (e.button !== 0 || !box.current) return;
    const rects = [...box.current.children].map((r) => r.getBoundingClientRect());
    const gap = rects.length > 1 ? Math.max(0, rects[1].top - rects[0].bottom) : 0;
    state.current = { from: index, to: index, dy: 0, startY: e.clientY, rects, size: rects[index].height + gap };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ from: index, to: index, dy: 0, size: state.current.size });
  };
  const move = (e: React.PointerEvent<HTMLElement>) => {
    const s = state.current;
    if (!s) return;
    s.dy = e.clientY - s.startY;
    const r = s.rects[s.from];
    const center = r.top + r.height / 2 + s.dy;
    let to = s.from;
    s.rects.forEach((q, i) => {
      const mid = q.top + q.height / 2;
      if (i < s.from && center < mid) to = Math.min(to, i);
      if (i > s.from && center > mid) to = Math.max(to, i);
    });
    s.to = to;
    setDrag({ from: s.from, to, dy: s.dy, size: s.size });
  };
  const end = () => {
    const s = state.current;
    state.current = null;
    setDrag(null);
    if (s && s.to !== s.from) onMove(s.from, s.to);
  };
  const shift = (i: number) => {
    if (!drag) return 0;
    if (i === drag.from) return drag.dy;
    if (drag.from < drag.to && i > drag.from && i <= drag.to) return -drag.size;
    if (drag.to < drag.from && i >= drag.to && i < drag.from) return drag.size;
    return 0;
  };
  return (
    <div ref={box} className={className}>
      {items.map((item, i) => (
        <div
          key={getKey(item, i)}
          className={`sortable-row${drag && drag.from === i ? " is-dragging" : ""}`}
          style={{ transform: `translateY(${shift(i)}px)` }}
        >
          {renderItem(item, i, {
            onPointerDown: (e) => begin(e, i),
            onPointerMove: move,
            onPointerUp: end,
            onPointerCancel: end,
          })}
        </div>
      ))}
    </div>
  );
}
