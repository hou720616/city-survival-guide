import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// #region debug-point A:global-error
{
  const _u = "http://127.0.0.1:7777/event", _s = "pitfalls-blank-screen";
  const _send = (hyp: string, msg: string, data: unknown) => {
    try { fetch(_u, { method: "POST", body: JSON.stringify({ sessionId: _s, runId: "pre", hypothesisId: hyp, location: "main.tsx", msg: "[DBG] " + msg, data, ts: Date.now() }) }).catch(() => {}); } catch { /* noop */ }
  };
  window.addEventListener("error", (e) => _send("A", "window.onerror", { message: e.message, stack: e.error?.stack, filename: e.filename, lineno: e.lineno }));
  window.addEventListener("unhandledrejection", (e) => _send("A", "unhandledrejection", { reason: String(e.reason), stack: (e.reason as Error)?.stack }));
  (window as unknown as { __dbg: typeof _send }).__dbg = _send;
}
// #endregion

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
