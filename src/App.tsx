/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Cloud,
  CloudOff,
  LogIn,
  RefreshCw,
  UserRound,
  Volume2,
} from "lucide-react";
import { cloudConfigured, supabase } from "./supabase";

type Word = { id: string; zh: string; en: string; bpmf: string; group: string };
type Group = { id: string; name: string; color: string };
type Tab = "practice" | "words" | "groups" | "history";
type NavScreen = Tab | "quiz" | "review";
type HistoryRecord = {
  id: string;
  timestamp: number;
  score: number;
  total: number;
  groupNames: string[];
};
type CloudData = { words: Word[]; groups: Group[]; history: HistoryRecord[] };
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

export default function App() {
  const [tab, setTab] = useState<Tab>("practice"),
    [groups, setGroups] = useState<Group[]>(seedGroups),
    [words, setWords] = useState<Word[]>(seedWords),
    [selected, setSelected] = useState<string[]>([]),
    [ready, setReady] = useState(false);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [quiz, setQuiz] = useState<Word[]>([]),
    [idx, setIdx] = useState(0),
    [answer, setAnswer] = useState(""),
    [result, setResult] = useState<"idle" | "correct" | "wrong">("idle"),
    [score, setScore] = useState(0),
    [done, setDone] = useState(false),
    [attempts, setAttempts] = useState(0);
  const [answerFocused, setAnswerFocused] = useState(false);
  const [reviewGroupId, setReviewGroupId] = useState<string | null>(null);
  const [zh, setZh] = useState(""),
    [en, setEn] = useState(""),
    [bpmf, setBpmf] = useState(""),
    [wg, setWg] = useState(""),
    [ng, setNg] = useState(""),
    [inlineGroup, setInlineGroup] = useState(false),
    [newInlineGroup, setNewInlineGroup] = useState("");
  const [lookup, setLookup] = useState<
    "idle" | "loading" | "found" | "missing"
  >("idle");
  const input = useRef<HTMLInputElement>(null);
  const lookupQuery = useRef("");
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
  useEffect(() => {
    window.history.replaceState({ littleWords: true, screen: "practice" }, "");
    const handleBack = (event: PopStateEvent) => {
      const state = event.state as {
        littleWords?: boolean;
        screen?: NavScreen;
        groupId?: string;
      } | null;
      const screen =
        state?.littleWords && state.screen ? state.screen : "practice";
      setAnswerFocused(false);
      input.current?.blur();
      if (screen === "quiz") {
        setTab("practice");
        setReviewGroupId(null);
        return;
      }
      if (screen === "review") {
        setTab("groups");
        setReviewGroupId(state?.groupId || null);
        setQuiz([]);
        setDone(false);
        return;
      }
      setTab(screen);
      setReviewGroupId(null);
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
    setWords(nextWords);
    setGroups(nextGroups);
    setHistory(Array.isArray(d.history) ? d.history : []);
    setSelected(nextGroups[0] ? [nextGroups[0].id] : []);
    setWg(nextGroups[0]?.id || "");
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
    const payload = { words, groups, history };
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
  }, [words, groups, history, ready, activeCode]);
  const switchCode = () => {
    syncReady.current = false;
    setActiveCode("");
    setReady(false);
    setSyncStatus("idle");
    setTab("practice");
    setQuiz([]);
    setDone(false);
    window.history.replaceState({ littleWords: true, screen: "practice" }, "");
  };
  const pool = useMemo(
      () => words.filter((w) => selected.includes(w.group)),
      [words, selected],
    ),
    cur = quiz[idx];
  const speak = (text = cur?.en) => {
    if (!text || !("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.72;
    u.pitch = 1.05;
    speechSynthesis.speak(u);
  };
  const fetchBopomofo = async (text: string) => {
    const r = await fetch(
      `https://www.moedict.tw/a/${encodeURIComponent(text)}.json`,
    );
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
  const pushScreen = (screen: NavScreen, groupId?: string) =>
    window.history.pushState({ littleWords: true, screen, groupId }, "");
  const changeTab = (nextTab: Tab) => {
    pushScreen(nextTab);
    setTab(nextTab);
    setReviewGroupId(null);
  };
  const start = () => {
    if (!pool.length) return;
    const q = [...pool].sort(() => Math.random() - 0.5);
    pushScreen("quiz");
    setQuiz(q);
    setIdx(0);
    setScore(0);
    setAnswer("");
    setResult("idle");
    setAttempts(0);
    setDone(false);
    setTimeout(() => speak(q[0].en), 150);
  };
  const check = (e: FormEvent) => {
    e.preventDefault();
    if (!cur || !answer.trim()) return;
    const ok = answer.trim().toLowerCase() === cur.en.toLowerCase();
    if (ok) {
      input.current?.blur();
      setResult("correct");
      setScore((s) => s + 1);
    } else {
      setResult("wrong");
      setAttempts((a) => a + 1);
      setAnswer("");
    }
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
    setResult("idle");
    setAttempts(0);
    setTimeout(() => speak(quiz[n].en), 100);
    setTimeout(() => input.current?.focus(), 120);
  };
  const saveWord = (e: FormEvent) => {
    e.preventDefault();
    if (!zh.trim() || !en.trim() || !wg) return;
    setWords((s) => [
      ...s,
      {
        id: crypto.randomUUID(),
        zh: zh.trim(),
        en: en.trim().toLowerCase(),
        bpmf: bpmf.trim(),
        group: wg,
      },
    ]);
    setZh("");
    setEn("");
    setBpmf("");
    setLookup("idle");
  };
  const createGroup = (name: string) => {
    if (!name.trim()) return;
    const id = crypto.randomUUID();
    setGroups((s) => [
      ...s,
      {
        id,
        name: name.trim(),
        color: ["#e59a55", "#62adc0", "#c77caf", "#81a864"][s.length % 4],
      },
    ]);
    setWg(id);
    return id;
  };
  const saveInlineGroup = () => {
    if (createGroup(newInlineGroup)) {
      setNewInlineGroup("");
      setInlineGroup(false);
    }
  };
  const handleExport = () => {
    const blob = new Blob(
      [JSON.stringify({ words, groups, history }, null, 2)],
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
          alert("還原成功！");
        }
      } catch {
        alert("檔案格式錯誤");
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
          (!quiz.length || done ? (
            <section className="setup card">
              <span className="eyebrow">WORD PRACTICE</span>
              <h2>{done ? "完成練習！" : "今天想練哪一些？"}</h2>
              <p>
                {done
                  ? `答對 ${score} / ${quiz.length} 題，做得很好！`
                  : groups.length === 0
                    ? "目前沒有任何單字，請先去「單字」頁面新增資料！"
                    : "可以同時選擇一個或多個單字分組。"}
              </p>
              {done && (
                <div className="score">
                  <b>{Math.round((score / quiz.length) * 100)}</b>
                  <small>分</small>
                </div>
              )}
              <div className="picks">
                {groups.map((g) => {
                  const on = selected.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      className={on ? "chosen" : ""}
                      style={{ "--tone": g.color } as React.CSSProperties}
                      onClick={() =>
                        setSelected((s) =>
                          on ? s.filter((x) => x !== g.id) : [...s, g.id],
                        )
                      }
                    >
                      <i />
                      <b>{g.name}</b>
                      <small>
                        {words.filter((w) => w.group === g.id).length} 個單字
                      </small>
                      {on && <em>✓</em>}
                    </button>
                  );
                })}
              </div>
              <button
                className="primary"
                disabled={!pool.length}
                onClick={start}
              >
                {done ? "再練習一次" : `開始練習（${pool.length} 題）`}
              </button>
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
              <p>看中文，寫出完整英文單字</p>
              <div className="zh">{cur?.zh}</div>
              <div className="bpmf">{cur?.bpmf}</div>
              <button className="speak" onClick={() => speak()}>
                    <Volume2 size={18} /> 再聽一次
              </button>
              <form onSubmit={check}>
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
                  placeholder="在這裡輸入英文"
                />
                {result === "idle" && (
                  <button
                    type="button"
                    className="primary"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.currentTarget.form?.requestSubmit();
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
                  <button onClick={next}>下一題 →</button>
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
                        setAnswer(cur?.en || "");
                        setResult("correct");
                      }}
                    >
                      看看答案
                    </button>
                  )}
                </div>
              )}
            </section>
          ))}
        {tab === "words" && (
          <section>
            <Title
              en="MY WORDS"
              title="我的單字"
              p="輸入中文後查詢注音，英文請自行輸入。"
            />
            <div className="cols">
              <form className="card editor" onSubmit={saveWord}>
                <h3>＋ 新增單字</h3>
                <label>
                  中文
                  <div className="searchrow">
                    <input
                      value={zh}
                      onChange={(e) => {
                        setZh(e.target.value);
                        setBpmf("");
                        setLookup("idle");
                        lookupQuery.current = "";
                      }}
                      onBlur={() => void searchWord()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void searchWord();
                        }
                      }}
                      placeholder="例如：蘋果"
                    />
                    <button
                      type="button"
                      className="searchbtn"
                      onClick={searchWord}
                      disabled={!zh.trim() || lookup === "loading"}
                    >
                      {lookup === "loading" ? "查詢中…" : "查注音"}
                    </button>
                  </div>
                  {lookup === "found" && (
                    <small className="lookupok">已帶出注音</small>
                  )}
                  {lookup === "missing" && (
                    <small className="lookuperror">
                      查不到注音，請手動輸入。
                    </small>
                  )}
                </label>
                <label>
                  注音
                  <input
                    className="bpmf"
                    value={bpmf}
                    onChange={(e) => setBpmf(e.target.value)}
                    placeholder="搜尋後自動帶出"
                  />
                </label>
                <label>
                  英文（自行輸入）
                  <div className="englishsearch">
                    <div className="with">
                      <input
                        value={en}
                        onChange={(e) => setEn(e.target.value)}
                        placeholder="例如：apple"
                      />
                      <button
                        type="button"
                        onClick={() => speak(en)}
                        aria-label="播放英文發音"
                      >
                        <Volume2 size={17} />
                      </button>
                    </div>
                  </div>
                </label>
                <label>
                  分類
                  <div className="categoryrow">
                    <select value={wg} onChange={(e) => setWg(e.target.value)}>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="addcat"
                      onClick={() => setInlineGroup((v) => !v)}
                    >
                      ＋ 新增分類
                    </button>
                  </div>
                </label>
                {inlineGroup && (
                  <div className="inlinegroup">
                    <input
                      autoFocus
                      value={newInlineGroup}
                      onChange={(e) => setNewInlineGroup(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          saveInlineGroup();
                        }
                      }}
                      placeholder="新分類名稱"
                    />
                    <button type="button" onClick={saveInlineGroup}>
                      建立
                    </button>
                    <button type="button" onClick={() => setInlineGroup(false)}>
                      取消
                    </button>
                  </div>
                )}
                <button className="primary" disabled={groups.length === 0}>
                  儲存單字
                </button>
                {groups.length === 0 && (
                  <div
                    style={{
                      color: "var(--coral)",
                      fontSize: 13,
                      marginTop: 12,
                    }}
                  >
                    請先新增分類才能儲存單字
                  </div>
                )}
              </form>
              <WordList
                words={words}
                groups={groups}
                speak={speak}
                move={(id, group) =>
                  setWords((s) =>
                    s.map((w) => (w.id === id ? { ...w, group } : w)),
                  )
                }
                remove={(id) => setWords((s) => s.filter((w) => w.id !== id))}
              />
            </div>
          </section>
        )}
        {tab === "groups" &&
          (reviewGroupId && groups.some((g) => g.id === reviewGroupId) ? (
            <GroupReview
              group={groups.find((g) => g.id === reviewGroupId)!}
              words={words.filter((w) => w.group === reviewGroupId)}
              speak={speak}
              back={() => window.history.back()}
              practice={() => {
                setSelected([reviewGroupId]);
                setQuiz([]);
                setDone(false);
                setReviewGroupId(null);
                pushScreen("practice");
                setTab("practice");
              }}
            />
          ) : (
            <section>
              <Title
                en="WORD GROUPS"
                title="單字分組"
                p="點選分類可查看單字並先自行複習。"
              />
              <form
                className="addgroup card"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (createGroup(ng)) setNg("");
                }}
              >
                <input
                  value={ng}
                  onChange={(e) => setNg(e.target.value)}
                  placeholder="輸入新分組名稱"
                />
                <button className="primary">＋ 新增分組</button>
              </form>
              <div className="groupgrid">
                {groups.map((g) => (
                  <article
                    className="card groupcard"
                    key={g.id}
                    style={{ "--tone": g.color } as React.CSSProperties}
                  >
                    <button
                      className="group-open"
                      onClick={() => {
                        pushScreen("review", g.id);
                        setReviewGroupId(g.id);
                      }}
                    >
                      <span>▰</span>
                      <div>
                        <h3>{g.name}</h3>
                        <p>
                          {words.filter((w) => w.group === g.id).length} 個單字
                          · 點選查看
                        </p>
                      </div>
                      <ArrowRight size={20} />
                    </button>
                    <button
                      className="group-delete"
                      aria-label={`刪除${g.name}分類`}
                      disabled={groups.length <= 1}
                      onClick={() => {
                        const f = groups.find((x) => x.id !== g.id);
                        if (!f) return;
                        setWords((s) =>
                          s.map((w) =>
                            w.group === g.id ? { ...w, group: f.id } : w,
                          ),
                        );
                        setGroups((s) => s.filter((x) => x.id !== g.id));
                        setWg(f.id);
                      }}
                    >
                      ×
                    </button>
                  </article>
                ))}
              </div>
            </section>
          ))}
        {tab === "history" && (
          <section>
            <Title
              en="HISTORY & BACKUP"
              title="紀錄與設定"
              p="查看過去的練習成績，或備份你的資料。"
            />
            <div className="card settings-card" style={{ marginBottom: 32 }}>
              <h3>備份與還原</h3>
              <p>
                將所有的單字、分組與練習紀錄匯出為備份檔，或從備份檔還原資料。
              </p>
              <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                <button className="primary" onClick={handleExport}>
                  匯出備份 (JSON)
                </button>
                <label
                  className="primary"
                  style={{ background: "var(--muted)", cursor: "pointer" }}
                >
                  匯入還原
                  <input
                    type="file"
                    accept=".json"
                    style={{ display: "none" }}
                    onChange={handleImport}
                  />
                </label>
              </div>
            </div>
            <h3
              style={{
                marginBottom: 18,
                color: "var(--ink)",
                fontSize: 20,
                fontWeight: 700,
              }}
            >
              練習紀錄
            </h3>
            {history.length === 0 ? (
              <div
                className="card"
                style={{
                  padding: 40,
                  textAlign: "center",
                  color: "var(--muted)",
                }}
              >
                尚無練習紀錄
              </div>
            ) : (
              <div className="history-list">
                {history.map((h) => (
                  <article key={h.id} className="card history-card">
                    <div>
                      <h3>{new Date(h.timestamp).toLocaleString()}</h3>
                      <p>
                        練習主題：
                        {h.groupNames.length ? h.groupNames.join(", ") : "全部"}
                      </p>
                    </div>
                    <div className="history-score">
                      <b>{h.score}</b> / {h.total}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
      <footer>
        已使用代號「{activeCode}」同步到雲端 · 發音由瀏覽器語音功能提供
      </footer>
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
            ["practice", "練習"],
            ["words", "單字"],
            ["groups", "分組"],
            ["history", "紀錄"],
          ] as const
        ).map((x) => (
          <button
            key={x[0]}
            className={tab === x[0] ? "active" : ""}
            onClick={() => setTab(x[0])}
          >
            {x[1]}
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
        <span className="eyebrow">CLOUD WORDS</span>
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
function Title({ en, title, p }: { en: string; title: string; p: string }) {
  return (
    <div className="title">
      <span className="eyebrow">{en}</span>
      <h2>{title}</h2>
      <p>{p}</p>
    </div>
  );
}
function WordList({
  words,
  groups,
  speak,
  move,
  remove,
}: {
  words: Word[];
  groups: Group[];
  speak: (s: string) => void;
  move: (id: string, group: string) => void;
  remove: (id: string) => void;
}) {
  return (
    <div className="wordlist card">
      <div className="listhead">
        <h3>全部單字</h3>
        <span>{words.length} 個</span>
      </div>
      {words.map((w) => (
        <article key={w.id}>
          <button
            className="sound"
            aria-label={`播放${w.en}發音`}
            onClick={() => speak(w.en)}
          >
            <Volume2 size={18} />
          </button>
          <div>
            <b>{w.en}</b>
            <span>
              {w.zh} <small className="bpmf">{w.bpmf}</small>
            </span>
          </div>
          <select
            className="word-group-select"
            aria-label={`移動${w.en}到其他分類`}
            value={w.group}
            onChange={(e) => move(w.id, e.target.value)}
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <button
            className="delete"
            aria-label={`刪除${w.en}`}
            onClick={() => remove(w.id)}
          >
            ×
          </button>
        </article>
      ))}
    </div>
  );
}
function GroupReview({
  group,
  words,
  speak,
  back,
  practice,
}: {
  group: Group;
  words: Word[];
  speak: (s: string) => void;
  back: () => void;
  practice: () => void;
}) {
  return (
    <section className="group-review">
      <button className="back-button" onClick={back}>
        <ArrowLeft size={18} />
        返回分組
      </button>
      <div className="review-heading">
        <div>
          <span className="eyebrow">GROUP REVIEW</span>
          <h2>{group.name}</h2>
          <p>先看看中文與英文，也可以播放發音自行複習。</p>
        </div>
        <button className="primary" disabled={!words.length} onClick={practice}>
          前往測驗
          <ArrowRight size={18} />
        </button>
      </div>
      {words.length === 0 ? (
        <div className="card review-empty">這個分類還沒有單字</div>
      ) : (
        <div className="review-grid">
          {words.map((w) => (
            <article
              className="card review-word"
              key={w.id}
              style={{ "--tone": group.color } as React.CSSProperties}
            >
              <button
                className="review-sound"
                aria-label={`播放${w.en}發音`}
                onClick={() => speak(w.en)}
              >
                <Volume2 size={20} />
              </button>
              <div>
                <b>{w.en}</b>
                <span>{w.zh}</span>
                <small className="bpmf">{w.bpmf}</small>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
