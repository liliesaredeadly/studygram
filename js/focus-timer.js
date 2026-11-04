const FOCUS_PRESETS = [5, 10, 25];

function focusTimerIdle(durationMs = 600000) {
  return { status: "idle", durationMs, remainingMs: durationMs, endsAt: null };
}

function focusTimeLeft(state, now) {
  return state.status === "running"
    ? Math.max(0, Math.min(state.durationMs, state.endsAt - now))
    : state.remainingMs;
}

function settleFocusTimer(state, now) {
  if (state.status !== "running" || focusTimeLeft(state, now) > 0) return state;
  return { ...state, status: "finished", remainingMs: 0, endsAt: null };
}

function restoreFocusTimer(savedState, now, presets = FOCUS_PRESETS, defaultMinutes = 10) {
  if (!savedState || !presets.includes(savedState.durationMs / 60000)) return focusTimerIdle(defaultMinutes * 60000);
  const { status, durationMs, remainingMs, endsAt } = savedState;
  if (!Number.isSafeInteger(durationMs) || !Number.isSafeInteger(remainingMs) ||
      remainingMs < 0 || remainingMs > durationMs) return focusTimerIdle(defaultMinutes * 60000);

  const state = { status, durationMs, remainingMs, endsAt };
  if (status === "running" && remainingMs > 0 && Number.isSafeInteger(endsAt) &&
      endsAt > 0 && endsAt - now <= durationMs) {
    return settleFocusTimer(state, now);
  }
  if (endsAt === null && (
    (status === "paused" && remainingMs > 0) ||
    (status === "idle" && remainingMs === durationMs) ||
    (status === "finished" && remainingMs === 0)
  )) return state;
  return focusTimerIdle(defaultMinutes * 60000);
}

function updateFocusTimer(state, action, now, presets = FOCUS_PRESETS) {
  const ready = state.status === "idle" || state.status === "finished";
  switch (action.type) {
    case "select":
      if (ready && presets.includes(action.minutes)) {
        const durationMs = action.minutes * 60000;
        if (state.status !== "idle" || state.durationMs !== durationMs) return focusTimerIdle(durationMs);
      }
      break;
    case "start":
      if (ready) return {
        ...state, status: "running", remainingMs: state.durationMs, endsAt: now + state.durationMs
      };
      break;
    case "pause":
      if (state.status === "running") {
        const remainingMs = focusTimeLeft(state, now);
        if (remainingMs === 0) return settleFocusTimer(state, now);
        return { ...state, status: "paused", remainingMs, endsAt: null };
      }
      break;
    case "resume":
      if (state.status === "paused") {
        return { ...state, status: "running", endsAt: now + state.remainingMs };
      }
      break;
    case "reset":
      if (state.status !== "idle") return focusTimerIdle(state.durationMs);
      break;
    case "tick":
      return settleFocusTimer(state, now);
  }
  return state;
}
