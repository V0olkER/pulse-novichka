// Сервер «Пульса новичка»: без зависимостей, Node >= 18.
//  • отдаёт фронтенд из public/;
//  • хранит состояние в data/state.json;
//  • личная ссылка новичка /s/<token> видит только свой опрос;
//  • при создании задачи отправляет её в Битрикс24 (tasks.task.add), если задан BITRIX_WEBHOOK_URL.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { reduce, surveyView, bitrixPayload } from './public/shared/logic.js';
import { makeSeed } from './public/shared/seed.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const DATA_FILE = process.env.DATA_FILE || path.join(ROOT, 'data', 'state.json');
const PORT = Number(process.env.PORT || 3000);
const WEBHOOK = (process.env.BITRIX_WEBHOOK_URL || '').replace(/\/?$/, '/');
const HAS_WEBHOOK = WEBHOOK.length > 1;

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8', '.ico': 'image/x-icon' };

// ---------- хранилище ----------
let state;
let queue = Promise.resolve(); // последовательная запись — без гонок между запросами
async function load() {
  try { state = JSON.parse(await fs.readFile(DATA_FILE, 'utf8')); }
  catch { state = makeSeed(new Date()); await save(); }
}
async function save() {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  const tmp = `${DATA_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(state, null, 1));
  await fs.rename(tmp, DATA_FILE);
}
const stamp = () => { const d = new Date(); const p = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };

function apply(action) {
  const run = queue.then(async () => {
    state = reduce(state, { ...action, at: stamp() });
    await save();
    await syncPendingTasks();
    return state;
  });
  queue = run.catch(() => {});
  return run;
}

// ---------- Битрикс24 ----------
async function syncPendingTasks() {
  for (const t of state.tasks.filter((x) => x.sync?.state === 'pending')) {
    let sync;
    if (!HAS_WEBHOOK) {
      sync = { state: 'ok', mode: 'mock', at: stamp() };
    } else {
      try {
        const res = await fetch(`${WEBHOOK}tasks.task.add.json`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bitrixPayload(state, t)), signal: AbortSignal.timeout(10000),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || body.error) throw new Error(body.error_description || body.error || `HTTP ${res.status}`);
        sync = { state: 'ok', mode: 'bitrix', bitrixId: body.result?.task?.id ?? null, at: stamp() };
      } catch (e) {
        sync = { state: 'error', mode: 'bitrix', error: String(e.message || e), at: stamp() };
      }
    }
    state = reduce(state, { type: 'taskSynced', taskId: t.id, sync });
  }
  await save();
}

// ---------- HTTP ----------
const send = (res, code, body, type = 'application/json; charset=utf-8') => {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
async function readJson(req) {
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > 100_000) throw new Error('Слишком большой запрос'); }
  return raw ? JSON.parse(raw) : {};
}
async function serveStatic(res, rel) {
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC)) return send(res, 403, 'Forbidden', 'text/plain');
  try { send(res, 200, await fs.readFile(file), MIME[path.extname(file)] || 'application/octet-stream'); }
  catch { send(res, 404, 'Not found', 'text/plain; charset=utf-8'); }
}

const HR_ACTIONS = new Set(['createTask', 'completeTask', 'addNewcomer']);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = decodeURIComponent(url.pathname);
  try {
    if (p === '/api/health') return send(res, 200, { ok: true, mode: 'server', bitrix: HAS_WEBHOOK ? 'webhook' : 'mock' });

    // --- новичок: только свой опрос ---
    const m = p.match(/^\/api\/survey\/([a-z0-9]{6,40})$/);
    if (m) {
      if (req.method === 'GET') {
        const v = surveyView(state, m[1], new Date());
        return v ? send(res, 200, v) : send(res, 404, { error: 'Ссылка недействительна' });
      }
      if (req.method === 'POST') {
        const v = surveyView(state, m[1], new Date());
        if (!v) return send(res, 404, { error: 'Ссылка недействительна' });
        if (!v.checkpoint) return send(res, 409, { error: 'Сейчас нет открытого опроса' });
        const body = await readJson(req);
        await apply({ type: 'submitSurvey', newcomerId: v.newcomerId, cp: v.checkpoint.key, answers: body.answers, comment: body.comment, wantHr: body.wantHr });
        const resp = state.responses.filter((r) => r.newcomerId === v.newcomerId).pop();
        const task = state.tasks.find((t) => t.responseId === resp.id);
        return send(res, 200, { ok: true, followUp: task ? task.assignee.role : null, nextDay: surveyView(state, m[1], new Date())?.nextDay ?? null });
      }
    }

    // --- HR ---
    // ВНИМАНИЕ: в демо-версии нет авторизации HR (см. отчёт). В проде — вход через Битрикс24 (OAuth приложения).
    if (p === '/api/state' && req.method === 'GET') return send(res, 200, { ...state, server: { bitrix: HAS_WEBHOOK ? 'webhook' : 'mock' } });
    if (p === '/api/action' && req.method === 'POST') {
      const action = await readJson(req);
      if (!HR_ACTIONS.has(action.type)) return send(res, 400, { error: 'Недопустимое действие' });
      if (action.type === 'addNewcomer') action.token = crypto.randomBytes(9).toString('base64url').toLowerCase().replace(/[^a-z0-9]/g, 'x');
      await apply(action);
      return send(res, 200, { ...state, server: { bitrix: HAS_WEBHOOK ? 'webhook' : 'mock' } });
    }
    if (p === '/api/reset' && req.method === 'POST') {
      await (queue = queue.then(async () => { state = makeSeed(new Date()); await save(); }));
      return send(res, 200, { ...state, server: { bitrix: HAS_WEBHOOK ? 'webhook' : 'mock' } });
    }
    if (p.startsWith('/api/')) return send(res, 404, { error: 'Нет такого метода' });

    // --- статика ---
    // /s/<token> — личная ссылка новичка; относительные пути к скриптам с неё приходят как /s/app.js
    if (p.startsWith('/s/') && path.extname(p)) return serveStatic(res, p.slice(2));
    if (p === '/' || p.startsWith('/s/')) return serveStatic(res, 'index.html');
    return serveStatic(res, p);
  } catch (e) {
    return send(res, 400, { error: String(e.message || e) });
  }
});

await load();
server.listen(PORT, () => console.log(`Пульс новичка: http://localhost:${PORT}  (Битрикс24: ${HAS_WEBHOOK ? 'вебхук задан' : 'демо, вебхук не задан'})`));
