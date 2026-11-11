// Два режима хранения с одним интерфейсом:
//  server — данные на сервере (новичок отвечает со своего телефона, HR видит у себя);
//  demo   — сервера нет (например, статическая публикация): данные живут в этой вкладке браузера.
import { reduce, surveyView } from './shared/logic.js';
import { makeSeed } from './shared/seed.js';

const stamp = () => { const d = new Date(); const p = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };

async function api(method, url, body) {
  const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`);
  return data;
}

function serverStore(health) {
  return {
    mode: 'server',
    bitrix: health.bitrix,
    getState: () => api('GET', '/api/state'),
    dispatch: (action) => api('POST', '/api/action', action),
    reset: () => api('POST', '/api/reset'),
    getSurvey: (token) => api('GET', `/api/survey/${token}`),
    submitSurvey: (token, body) => api('POST', `/api/survey/${token}`, body),
  };
}

const LS_KEY = 'pulse-novichka-demo-v1';
function demoStore() {
  let state = null;
  try { state = JSON.parse(localStorage.getItem(LS_KEY)); } catch { /* хранилище недоступно — работаем в памяти */ }
  if (!state || state.version !== 1) state = makeSeed(new Date());
  const persist = () => { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch { /* ок */ } };
  const markMock = () => {
    for (const t of state.tasks) if (t.sync?.state === 'pending') t.sync = { state: 'ok', mode: 'mock', at: stamp() };
  };
  const token = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');
  const apply = (action) => { state = reduce(state, { ...action, at: stamp() }); markMock(); persist(); return structuredClone(state); };
  persist();
  return {
    mode: 'demo',
    bitrix: 'mock',
    getState: async () => structuredClone(state),
    dispatch: async (action) => apply(action.type === 'addNewcomer' ? { ...action, token: token() } : action),
    reset: async () => { state = makeSeed(new Date()); persist(); return structuredClone(state); },
    getSurvey: async (tok) => { const v = surveyView(state, tok, new Date()); if (!v) throw new Error('Ссылка недействительна'); return v; },
    submitSurvey: async (tok, body) => {
      const v = surveyView(state, tok, new Date());
      if (!v?.checkpoint) throw new Error('Сейчас нет открытого опроса');
      apply({ type: 'submitSurvey', newcomerId: v.newcomerId, cp: v.checkpoint.key, ...body });
      const resp = state.responses.filter((r) => r.newcomerId === v.newcomerId).pop();
      const task = state.tasks.find((t) => t.responseId === resp.id);
      return { ok: true, followUp: task ? task.assignee.role : null, nextDay: surveyView(state, tok, new Date())?.nextDay ?? null };
    },
  };
}

export async function createStore() {
  try {
    const res = await fetch('/api/health', { cache: 'no-store' });
    const h = await res.json();
    if (h?.ok && h.mode === 'server') return serverStore(h);
  } catch { /* сервера нет */ }
  return demoStore();
}
