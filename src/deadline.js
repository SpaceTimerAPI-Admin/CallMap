// One deadline shared by every outside request in a poll, so a slow service can't blow past
// Netlify's time limit. Each request gets min(its own timeout, time left before the deadline).
let deadline = Infinity;
export const setDeadline = (ts) => { deadline = ts; };
export const clearDeadline = () => { deadline = Infinity; };
export const remaining = () => deadline - Date.now();
export const timeout = (ms) => AbortSignal.timeout(Math.max(300, Math.min(ms, deadline - Date.now())));
