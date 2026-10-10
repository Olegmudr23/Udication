export type Mode = "focus" | "short" | "long";
export type Settings = { focus: number; short: number; long: number; autoStart: boolean; sound: boolean };
export type Session = { id: string; mode: Mode; minutes: number; endedAt: number; task: string };
export type TimerState = {
  mode: Mode;
  remaining: number;
  deadline: number | null;
  cycle: number;
  day: string;
  completed: number;
  minutes: number;
  notice: string;
  completions: number;
  history: Session[];
  alarmId: string | null;
  sessionTask: string;
};

export const defaults: Settings = { focus: 25, short: 5, long: 15, autoStart: false, sound: true };
export function localDay(now = Date.now()) {
  const date = new Date(now);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}
export function initialState(settings = defaults, now = Date.now()): TimerState {
  return { mode: "focus", remaining: settings.focus * 60, deadline: null, cycle: 0,
    day: localDay(now), completed: 0, minutes: 0, notice: "", completions: 0,
    history: [], alarmId: null, sessionTask: "" };
}

export function nextMode(mode: Mode, cycle: number): Mode {
  return mode === "focus" ? (cycle % 4 === 0 ? "long" : "short") : "focus";
}

export function finish(state: TimerState, settings: Settings, now: number, skipped = false): TimerState {
  const worked = state.mode === "focus" && !skipped;
  const cycle = state.cycle + (worked ? 1 : 0);
  const mode = skipped && state.mode === "focus" ? "short" : nextMode(state.mode, cycle);
  const sameDay = state.day === localDay(now);
  const endedAt = state.deadline !== null ? Math.min(state.deadline, now) : now;
  const workedToday = worked && localDay(endedAt) === localDay(now);
  const session: Session = {
    id: `${endedAt}-${state.mode}-${state.completions}`,
    mode: state.mode, minutes: settings[state.mode], endedAt,
    task: state.mode === "focus" ? state.sessionTask : "",
  };
  return {
    ...state, mode, cycle, day: localDay(now), remaining: settings[mode] * 60,
    deadline: settings.autoStart && !skipped ? now + settings[mode] * 60000 : null,
    completed: (sameDay ? state.completed : 0) + (workedToday ? 1 : 0),
    minutes: (sameDay ? state.minutes : 0) + (workedToday ? settings.focus : 0),
    completions: state.completions + (skipped ? 0 : 1),
    notice: skipped ? "Интервал пропущен" : worked ? "Отличная работа! Время отдохнуть." : "Перерыв окончен. За дело!",
    history: skipped ? state.history : [session, ...state.history],
    alarmId: skipped ? state.alarmId : session.id,
  };
}

export function tick(state: TimerState, settings: Settings, now: number): TimerState {
  const today = localDay(now);
  const current = state.day === today ? state : { ...state, day: today, completed: 0, minutes: 0 };
  if (current.deadline === null) return current;
  const remaining = Math.max(0, Math.ceil((current.deadline - now) / 1000));
  if (remaining === 0) return finish(current, settings, now);
  return remaining === current.remaining ? current : { ...current, remaining };
}

export function parseSettings(value: unknown): Settings {
  if (!value || typeof value !== "object") return defaults;
  const s = value as Partial<Settings>;
  const duration = (n: unknown, fallback: number, max: number) =>
    typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= max ? n : fallback;
  const long = duration(s.long, 15, 30);
  return { focus: duration(s.focus, 25, 90), short: duration(s.short, 5, 30), long: Math.max(15, long),
    autoStart: s.autoStart === true, sound: typeof s.sound === "boolean" ? s.sound : true };
}

function restoreHistory(value: unknown): Session[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  return value.filter((entry): entry is Session => {
    if (!entry || typeof entry !== "object") return false;
    const s = entry as Partial<Session>;
    if (typeof s.id !== "string" || !s.id || ids.has(s.id)
      || (s.mode !== "focus" && s.mode !== "short" && s.mode !== "long")
      || typeof s.minutes !== "number" || !Number.isInteger(s.minutes) || s.minutes < 1 || s.minutes > 90
      || typeof s.endedAt !== "number" || !Number.isFinite(s.endedAt) || Math.abs(s.endedAt) > 8.64e15
      || typeof s.task !== "string") return false;
    ids.add(s.id);
    return true;
  }).map(s => ({ id: s.id, mode: s.mode, minutes: s.minutes, endedAt: s.endedAt, task: s.task.slice(0, 100) }))
    .sort((a, b) => b.endedAt - a.endedAt);
}

export function restoreTimer(value: unknown, settings: Settings, now = Date.now()): TimerState {
  const fresh = initialState(settings, now);
  if (!value || typeof value !== "object") return fresh;
  const s = value as Partial<TimerState>;
  if (s.mode !== "focus" && s.mode !== "short" && s.mode !== "long") return fresh;
  const counter = (n: unknown) => typeof n === "number" && Number.isSafeInteger(n) && n >= 0 ? n : 0;
  const remaining = typeof s.remaining === "number" && Number.isFinite(s.remaining)
    ? Math.max(1, Math.min(settings[s.mode] * 60, Math.ceil(s.remaining))) : settings[s.mode] * 60;
  const deadline = typeof s.deadline === "number" && Number.isFinite(s.deadline)
    && s.deadline <= now + settings[s.mode] * 60000 ? s.deadline : null;
  const history = restoreHistory(s.history);
  return tick({ ...fresh, mode: s.mode, remaining, deadline, cycle: counter(s.cycle),
    history, completions: counter(s.completions),
    sessionTask: typeof s.sessionTask === "string" ? s.sessionTask.slice(0, 100) : "",
    alarmId: typeof s.alarmId === "string" && history.some(entry => entry.id === s.alarmId) ? s.alarmId : null,
    completed: s.day === fresh.day ? counter(s.completed) : 0,
    minutes: s.day === fresh.day ? counter(s.minutes) : 0 }, settings, now);
}
