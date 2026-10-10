"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, BellRing, Check, Coffee, Flame, History, Pause, Play, RotateCcw, Settings2, SkipForward, Sparkles, Target, Volume2, VolumeX, X } from "lucide-react";
import { defaults, finish, initialState, parseSettings, restoreTimer, tick, type Mode, type Settings, type TimerState } from "@/lib/timer";

const STORAGE_KEY = "zubodoro.v1";
const modes: { id: Mode; label: string; shortLabel: string }[] = [
  { id: "focus", label: "Фокус", shortLabel: "Фокус" },
  { id: "short", label: "Короткий перерыв", shortLabel: "Перерыв" },
  { id: "long", label: "Длинный перерыв", shortLabel: "Отдых" },
];
const toothPath = "M180 53C145 28 110 28 83 48C43 78 46 125 63 178C78 224 79 251 89 300C98 347 109 385 130 382C151 379 144 302 180 278C216 302 209 379 230 382C251 385 262 347 271 300C281 251 282 224 297 178C314 125 317 78 277 48C250 28 215 28 180 53Z";

function Tooth({ size = 20, strokeWidth = 1.8 }: { size?: number; strokeWidth?: number }) {
  return <svg width={size} height={size} viewBox="0 0 360 420" fill="none" stroke="currentColor" strokeWidth={strokeWidth * 15} strokeLinejoin="round" aria-hidden="true"><path d={toothPath}/></svg>;
}

function plural(number: number, forms: [string, string, string]) {
  const last = number % 10;
  const lastTwo = number % 100;
  return forms[lastTwo >= 11 && lastTwo <= 14 ? 2 : last === 1 ? 0 : last >= 2 && last <= 4 ? 1 : 2];
}

function ToothTimer({ progress, running, resting }: { progress: number; running: boolean; resting: boolean }) {
  return <svg className={`tooth-illustration ${running ? "is-running" : ""}`} viewBox="0 0 360 420" role="img" aria-label={resting ? "Зуб отдыхает" : "Улыбающийся зуб"}>
    <defs>
      <clipPath id="tooth-clip"><path d={toothPath} /></clipPath>
      <linearGradient id="enamel" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff"/><stop offset="1" stopColor="#f4f8f5"/></linearGradient>
    </defs>
    <ellipse cx="180" cy="399" rx="81" ry="7" fill="#d8e4dc" opacity=".5" />
    <path d={toothPath} fill="url(#enamel)" stroke="#345c50" strokeWidth="3" />
    <g clipPath="url(#tooth-clip)">
      <rect x="40" y={382 - progress * 348} width="280" height="360" fill={resting ? "#c8e8de" : "#f8c6bc"} opacity=".65" className="tooth-fill" />
    </g>
    <path d="M83 112C80 85 97 64 119 62" fill="none" stroke="#fff" strokeWidth="10" strokeLinecap="round" />
    {resting ? <g fill="none" stroke="#345c50" strokeWidth="4" strokeLinecap="round"><path d="M137 119q8 8 16 0"/><path d="M207 119q8 8 16 0"/></g> : <g fill="#345c50"><ellipse cx="145" cy="119" rx="4.5" ry="6"/><ellipse cx="215" cy="119" rx="4.5" ry="6"/></g>}
    <ellipse cx="124" cy="135" rx="11" ry="5" fill="#efb1a8" opacity=".55"/><ellipse cx="236" cy="135" rx="11" ry="5" fill="#efb1a8" opacity=".55"/>
    <path d="M170 135q10 12 20 0" fill="none" stroke="#345c50" strokeWidth="3" strokeLinecap="round" />
  </svg>;
}

export default function Home() {
  const [settings, setSettings] = useState<Settings>(defaults);
  const [timer, setTimer] = useState<TimerState>(() => initialState());
  const [task, setTask] = useState("");
  const [ready, setReady] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<"all" | "focus" | "break">("all");
  const [historyCount, setHistoryCount] = useState(20);
  const dialog = useRef<HTMLDialogElement>(null);
  const audio = useRef<AudioContext | null>(null);
  const sounded = useRef(0);
  const running = timer.deadline !== null;
  const resting = timer.mode !== "focus";
  const time = `${String(Math.floor(timer.remaining / 60)).padStart(2, "0")}:${String(timer.remaining % 60).padStart(2, "0")}`;
  const progress = Math.max(0, Math.min(1, 1 - timer.remaining / (settings[timer.mode] * 60)));
  const cycleProgress = timer.cycle % 4 || (timer.mode === "long" && timer.cycle > 0 ? 4 : 0);
  const alarm = timer.history.find(entry => entry.id === timer.alarmId);
  const filteredHistory = timer.history.filter(entry => historyFilter === "all" || (historyFilter === "focus" ? entry.mode === "focus" : entry.mode !== "focus"));

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved && typeof saved === "object") {
        const prefs = parseSettings(saved.settings);
        const restored = restoreTimer(saved.timer, prefs);
        setSettings(prefs);
        setTimer(restored);
        sounded.current = restored.completions;
        if (typeof saved.task === "string") setTask(saved.task.slice(0, 100));
      }
    } catch { /* Invalid saved data is replaced with defaults on the next save. */ }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings, timer, task }));
      setStorageWarning(false);
    }
    catch { setStorageWarning(true); }
  }, [ready, settings, timer, task]);

  useEffect(() => {
    if (!ready) return;
    const update = () => setTimer(current => tick(current, settings, Date.now()));
    const interval = window.setInterval(update, 250);
    document.addEventListener("visibilitychange", update);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", update); };
  }, [ready, settings]);

  useEffect(() => {
    document.title = running ? `${time} · ${resting ? "Перерыв" : "Фокус"} | Зубодоро` : "Зубодоро · время сосредоточиться";
  }, [running, time, resting]);

  useEffect(() => {
    if (timer.completions <= sounded.current) return;
    sounded.current = timer.completions;
    if (!settings.sound || !audio.current || audio.current.state !== "running") return;
    const context = audio.current;
    [523.25, 659.25, 783.99].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + index * 0.18;
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.12, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.5);
    });
  }, [timer.completions, settings.sound]);

  function unlockAudio() {
    if (!settings.sound) return;
    try {
      if (!audio.current) audio.current = new AudioContext();
      void audio.current.resume().catch(() => {});
    } catch { /* The timer also works in browsers without Web Audio. */ }
  }

  function toggleTimer() {
    unlockAudio();
    setTimer(current => {
      const now = Date.now();
      if (current.deadline !== null) {
        const updated = tick(current, settings, now);
        return { ...updated, deadline: null };
      }
      return { ...current, deadline: now + current.remaining * 1000, notice: "",
        sessionTask: current.remaining === settings[current.mode] * 60 ? task.trim() : current.sessionTask };
    });
  }

  function selectMode(mode: Mode) {
    setTimer(current => ({ ...current, mode, remaining: settings[mode] * 60, deadline: null, notice: "", sessionTask: "" }));
  }

  function changeDuration(mode: Mode, minutes: number) {
    setSettings(current => ({ ...current, [mode]: minutes }));
    if (timer.mode === mode) setTimer(current => ({ ...current, remaining: minutes * 60, deadline: null, notice: "", sessionTask: "" }));
  }

  return <div className={`app ${resting ? "rest-mode" : ""}`}>
    <header className="header">
      <a className="brand" href="/" aria-label="Зубодоро, главная"><span className="brand-mark"><Tooth size={25} strokeWidth={1.8}/></span><span>зубодоро<span className="brand-dot">.</span></span></a>
      <div className="header-actions">
        <span className="local-badge"><span/> Маленькими шагами</span>
        <button className="icon-button" title={settings.sound ? "Выключить звук" : "Включить звук"} aria-label={settings.sound ? "Выключить звук" : "Включить звук"} aria-pressed={settings.sound} onClick={() => { setSettings(s => ({ ...s, sound: !s.sound })); if (!settings.sound) { try { if (!audio.current) audio.current = new AudioContext(); void audio.current.resume().catch(() => {}); } catch {} } }}>
          {settings.sound ? <Volume2 size={20}/> : <VolumeX size={20}/>}
        </button>
        <button className="icon-button" title="Настройки" aria-label="Настройки" onClick={() => dialog.current?.showModal()}><Settings2 size={20}/></button>
      </div>
    </header>

    <main>
      <div className="intro"><span className="eyebrow"><Sparkles size={14}/> ВРЕМЯ ДЛЯ СЕБЯ И ДЕЛА</span><h1>{resting ? "Выдохни. Ты молодец." : "Делу время. Зубу тоже."}</h1><p>{resting ? "Немного отдыха, и снова в своём ритме." : "Одна задача. Один интервал. Всё получится."}</p></div>

      <div className="mode-tabs" role="tablist" aria-label="Режим таймера">
        {modes.map((mode, index) => <button key={mode.id} id={`tab-${mode.id}`} role="tab" tabIndex={timer.mode === mode.id ? 0 : -1} aria-selected={timer.mode === mode.id} aria-controls="timer-panel" className={timer.mode === mode.id ? "active" : ""} onClick={() => selectMode(mode.id)} onKeyDown={event => {
          const next = event.key === "ArrowRight" ? (index + 1) % 3 : event.key === "ArrowLeft" ? (index + 2) % 3 : event.key === "Home" ? 0 : event.key === "End" ? 2 : -1;
          if (next < 0) return;
          event.preventDefault();
          selectMode(modes[next].id);
          document.getElementById(`tab-${modes[next].id}`)?.focus();
        }}><span className="desktop-label">{mode.label}</span><span className="mobile-label">{mode.shortLabel}</span></button>)}
      </div>

      <section id="timer-panel" className="timer-section" role="tabpanel" aria-labelledby={`tab-${timer.mode}`}>
        {alarm && <div className="completion-alert" role="alert">
          <BellRing size={23}/><div><strong>Время вышло!</strong><p>{modes.find(mode => mode.id === alarm.mode)?.label}: {alarm.minutes} мин. Интервал завершён.</p></div>
          <button className="icon-button" title="Закрыть уведомление" aria-label="Закрыть уведомление" onClick={() => setTimer(s => ({ ...s, alarmId: null }))}><X size={19}/></button>
        </div>}
        <div className="timer-art">
          <span className="art-note note-left">{resting ? "можно просто" : "по одному"}<br/>{resting ? "побыть" : "кусочку"}<span className="note-line"/></span>
          <ToothTimer progress={progress} running={running} resting={resting}/>
          <div className="timer-display"><span className="timer-label">{running ? resting ? "ОТДЫХАЕМ" : "СОСРЕДОТОЧЕНЫ" : timer.remaining < settings[timer.mode] * 60 ? "НА ПАУЗЕ" : "ГОТОВЫ НАЧАТЬ?"}</span><span className="time" role="timer" aria-label={`Осталось ${Math.floor(timer.remaining / 60)} минут ${timer.remaining % 60} секунд`}>{time}</span><span className="timer-subtitle">{resting ? "заряжаем батарейки" : "минут чистого фокуса"}</span></div>
          <span className="art-note note-right"><Sparkles size={23} strokeWidth={1.3}/><span>{resting ? "заслуженный" : "маленький"}<br/>{resting ? "перерыв" : "шаг вперёд"}</span></span>
        </div>

        <div className="timer-controls">
          <button className="icon-button round-control" title="Начать интервал заново" aria-label="Начать интервал заново" disabled={!ready} onClick={() => setTimer(s => ({ ...s, remaining: settings[s.mode] * 60, deadline: null, notice: "", sessionTask: "" }))}><RotateCcw size={20}/></button>
          <button className="start-button" onClick={toggleTimer} disabled={!ready}>{running ? <Pause size={19} fill="currentColor"/> : <Play size={19} fill="currentColor"/>}{running ? "Пауза" : timer.remaining < settings[timer.mode] * 60 ? "Продолжить" : "Начать"}</button>
          <button className="icon-button round-control" title="Пропустить интервал" aria-label="Пропустить интервал" disabled={!ready} onClick={() => setTimer(s => finish(s, settings, Date.now(), true))}><SkipForward size={20}/></button>
        </div>
        <div className="cycle" aria-label={`Завершено ${cycleProgress} из 4 интервалов в текущем цикле`}>
          {[0, 1, 2, 3].map(i => <span key={i} className={`cycle-tooth ${i < cycleProgress ? "done" : ""}`}><Tooth size={17} strokeWidth={1.6}/></span>)}<span>{cycleProgress === 4 ? "большой перерыв заслужен" : "до большого перерыва"}</span>
        </div>
        <p className={`notice ${timer.notice ? "visible" : ""}`} role="status" aria-live="polite">{timer.notice || "Всё начинается с маленького шага"}</p>
      </section>

      <section className="task-section" aria-label="Текущая задача"><div className="task-icon"><Target size={21}/></div><div className="task-field"><label htmlFor="task">МОЙ ФОКУС СЕЙЧАС</label><input id="task" maxLength={100} value={task} onChange={event => setTask(event.target.value)} placeholder="На чём сосредоточимся?" autoComplete="off"/></div><ArrowRight size={19} className="task-arrow"/></section>

      <section className="daily-section" aria-label="Результаты за сегодня"><div className="daily-heading"><h2>Сегодня уже получилось</h2><span>Каждый интервал считается</span></div><div className="stats"><div className="stat"><span className="stat-icon coral"><Tooth size={20}/></span><div><strong>{timer.completed}<span> {plural(timer.completed, ["интервал", "интервала", "интервалов"])}</span></strong><p>маленьких побед</p></div></div><div className="stat"><span className="stat-icon mint"><Flame size={20}/></span><div><strong>{timer.minutes}<span> {plural(timer.minutes, ["минута", "минуты", "минут"])}</span></strong><p>в фокусе</p></div></div><div className="stat goal-stat"><span className="stat-icon lilac"><Check size={20}/></span><div><strong>{Math.min(timer.completed, 4)}<span> / 4</span></strong><p>{timer.completed >= 4 ? "цель на день достигнута" : "цель на день"}</p></div><div className="goal-track" aria-hidden="true">{[0,1,2,3].map(i => <span key={i} className={i < timer.completed ? "filled" : ""}/>)}</div></div></div></section>
      <section className="history-section" aria-labelledby="history-title">
        <div className="history-heading"><h2 id="history-title"><History size={18}/> История таймеров</h2><div className="history-filters" role="group" aria-label="Фильтр истории">{([{ id: "all", label: "Все" }, { id: "focus", label: "Фокус" }, { id: "break", label: "Перерывы" }] as const).map(filter => <button key={filter.id} aria-pressed={historyFilter === filter.id} onClick={() => { setHistoryFilter(filter.id); setHistoryCount(20); }}>{filter.label}</button>)}</div></div>
        {filteredHistory.length === 0 ? <p className="history-empty">{timer.history.length === 0 ? "Здесь пока нет завершённых интервалов." : "Таких интервалов пока нет."}</p> : <ul className="history-list">{filteredHistory.slice(0, historyCount).map(entry => <li key={entry.id}>
          <span className={`stat-icon ${entry.mode === "focus" ? "coral" : "mint"}`}>{entry.mode === "focus" ? <Tooth size={20}/> : <Coffee size={20}/>}</span>
          <div className="history-details"><strong>{modes.find(mode => mode.id === entry.mode)?.label}</strong>{entry.task && <p>{entry.task}</p>}<time dateTime={new Date(entry.endedAt).toISOString()}>{new Date(entry.endedAt).toLocaleString("ru-RU", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</time></div>
          <span className="history-duration">{entry.minutes} мин<span><Check size={12}/> Завершён</span></span>
        </li>)}</ul>}
        {filteredHistory.length > historyCount && <button className="history-more" onClick={() => setHistoryCount(count => count + 20)}>Показать ещё</button>}
      </section>
    </main>

    <footer><span><Tooth size={14}/> Бережно к себе. Внимательно к делу.</span><span>Сделано для твоего ритма</span></footer>
    {storageWarning && <p className="storage-warning" role="status">Браузер не разрешил сохранение. Таймер работает, но прогресс может потеряться после закрытия.</p>}

    <dialog ref={dialog} className="settings-dialog" onClick={event => { if (event.target === dialog.current) dialog.current?.close(); }} aria-labelledby="settings-title">
      <div className="dialog-content"><div className="dialog-heading"><div><span className="eyebrow">ТВОЙ РИТМ</span><h2 id="settings-title">Настройки</h2></div><button className="icon-button" aria-label="Закрыть настройки" title="Закрыть" onClick={() => dialog.current?.close()}><X size={21}/></button></div>
        <div className="duration-settings">{modes.map(mode => <label key={mode.id} className="duration-row"><span>{mode.id === "focus" ? <Target size={18}/> : <Coffee size={18}/>} {mode.label}<strong>{settings[mode.id]} мин</strong></span><input aria-label={`Длительность: ${mode.label}`} type="range" min={mode.id === "long" ? 15 : 1} max={mode.id === "focus" ? 90 : 30} value={settings[mode.id]} disabled={running} onChange={e => changeDuration(mode.id, Number(e.target.value))}/></label>)}</div>
        {running && <p className="settings-hint">Длительность можно изменить, когда таймер на паузе.</p>}
        <label className="toggle-row"><span>Звук в конце интервала</span><input type="checkbox" checked={settings.sound} onChange={e => { setSettings(s => ({ ...s, sound: e.target.checked })); }}/></label>
        <label className="toggle-row"><span>Автоматически начинать следующий</span><input type="checkbox" checked={settings.autoStart} onChange={e => setSettings(s => ({ ...s, autoStart: e.target.checked }))}/></label>
        <button className="dialog-done" onClick={() => { unlockAudio(); dialog.current?.close(); }}><Check size={18}/> Готово</button>
      </div>
    </dialog>
  </div>;
}
