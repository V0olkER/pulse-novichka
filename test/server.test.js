// Сквозной тест: настоящий сервер + поддельный Битрикс24, который принимает tasks.task.add.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const PORT = 3900 + Math.floor(Math.random() * 90);
const B24_PORT = PORT + 100;
const base = `http://127.0.0.1:${PORT}`;
const dataFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-')), 'state.json');
const received = [];
let srv; let b24;

before(async () => {
  b24 = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      received.push({ url: req.url, body: JSON.parse(raw) });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ result: { task: { id: String(1000 + received.length) } } }));
    });
  }).listen(B24_PORT);
  srv = spawn(process.execPath, ['server.js'], {
    env: { ...process.env, PORT: String(PORT), DATA_FILE: dataFile, BITRIX_WEBHOOK_URL: `http://127.0.0.1:${B24_PORT}/rest/1/secret` },
    stdio: 'pipe',
  });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(`${base}/api/health`)).ok) return; } catch { /* ждём */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('сервер не поднялся');
});
after(() => { srv?.kill(); b24?.close(); });

const j = async (method, url, body) => {
  const r = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json() };
};

test('основной сценарий: новичок отвечает с телефона → красный → задача ушла в Битрикс24', async () => {
  const h = await j('GET', '/api/health');
  assert.equal(h.body.bitrix, 'webhook');

  const { body: state } = await j('GET', '/api/state');
  const hero = state.newcomers[0];
  const page = await fetch(`${base}/s/${hero.token}`);
  assert.match(await page.text(), /<title>Пульс новичка/);
  assert.equal((await fetch(`${base}/s/app.js`)).status, 200, 'скрипты грузятся и со страницы личной ссылки');

  const sv = await j('GET', `/api/survey/${hero.token}`);
  assert.equal(sv.body.checkpoint.key, 'd7');
  assert.equal(JSON.stringify(sv.body).includes(state.newcomers[1].name), false, 'новичок не видит чужих данных');

  const bad = await j('POST', `/api/survey/${hero.token}`, { answers: { mentor: 0 } });
  assert.equal(bad.status, 400);

  const res = await j('POST', `/api/survey/${hero.token}`, { answers: { mentor: 0, schedule: 2, mood: 3 }, comment: 'Каждый день разгрузка' });
  assert.equal(res.status, 200);
  assert.equal(res.body.followUp, 'manager');

  assert.equal(received.length, 1);
  assert.equal(received[0].url, '/rest/1/secret/tasks.task.add.json');
  const f = received[0].body.fields;
  assert.equal(f.RESPONSIBLE_ID, 41);
  assert.equal(f.PRIORITY, 2);
  assert.doesNotMatch(f.DESCRIPTION, /Каждый день разгрузка/);

  const { body: after2 } = await j('GET', '/api/state');
  const task = after2.tasks.find((t) => t.newcomerId === hero.id && t.status === 'open');
  assert.equal(task.sync.state, 'ok');
  assert.equal(task.sync.bitrixId, '1001');

  const again = await j('POST', `/api/survey/${hero.token}`, { answers: { mentor: 0, schedule: 0, mood: 0 } });
  assert.equal(again.status, 409, 'второй раз тот же опрос не принимается');

  const done = await j('POST', '/api/action', { type: 'completeTask', taskId: task.id, outcome: 'fixed', note: 'Перевели на комплектацию' });
  assert.equal(done.body.tasks.find((t) => t.id === task.id).status, 'done');

  // состояние пережило перезапуск — лежит в файле
  const saved = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  assert.equal(saved.tasks.find((t) => t.id === task.id).status, 'done');
});

test('недопустимые запросы отклоняются', async () => {
  assert.equal((await j('GET', '/api/survey/nonexistenttoken')).status, 404);
  assert.equal((await j('POST', '/api/action', { type: 'submitSurvey' })).status, 400, 'HR-эндпоинт не принимает ответы за новичка');
  assert.equal((await fetch(`${base}/..%2f..%2fserver.js`)).status === 200, false);
});
