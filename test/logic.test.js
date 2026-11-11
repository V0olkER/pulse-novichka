import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../public/shared/logic.js';
import { makeSeed, ORG } from '../public/shared/seed.js';

const NOW = new Date(2026, 10, 11, 12, 0);
const AT = '2026-11-11T12:00:00';

function fresh(day = 8) {
  let s = { version: 1, seq: 0, org: structuredClone(ORG), newcomers: [], responses: [], tasks: [] };
  s = L.reduce(s, { type: 'addNewcomer', unitId: 'wh-a', name: 'Тест Тестов', position: 'Кладовщик', hireDate: L.addDays('2026-11-11', -(day - 1)), token: 'tok123456' });
  return s;
}
const ok = (cp) => Object.fromEntries(L.cpByKey(cp).questions.map((q) => [q, 0]));

test('день работы: день выхода — 1-й', () => {
  assert.equal(L.dayNumber('2026-11-11', NOW), 1);
  assert.equal(L.dayNumber('2026-11-04', NOW), 8);
  assert.equal(L.dayNumber('2026-03-01', new Date(2026, 3, 1)), 32); // переход на летнее время не ломает счёт
});

test('открыт последний наступивший непройденный опрос', () => {
  const s = fresh(8);
  const n = s.newcomers[0];
  assert.equal(L.dueCheckpoint(s, n, NOW).key, 'd7');
  assert.equal(L.newcomerStatus(s, n, NOW).silent, false);
  const s2 = fresh(2);
  assert.equal(L.dueCheckpoint(s2, s2.newcomers[0], NOW), null);
  assert.equal(L.newcomerStatus(s2, s2.newcomers[0], NOW).risk, 'new');
});

test('все ответы в норме → зелёный, задачи нет', () => {
  let s = fresh(8);
  s = L.reduce(s, { type: 'submitSurvey', newcomerId: s.newcomers[0].id, cp: 'd7', answers: ok('d7'), at: AT });
  assert.equal(L.newcomerStatus(s, s.newcomers[0], NOW).risk, 'green');
  assert.equal(s.tasks.length, 0);
});

test('критичный ответ → красный и срочная задача руководителю на завтра', () => {
  let s = fresh(8);
  s = L.reduce(s, { type: 'submitSurvey', newcomerId: s.newcomers[0].id, cp: 'd7', answers: { ...ok('d7'), schedule: 2 }, comment: 'тяжело', at: AT });
  const st = L.newcomerStatus(s, s.newcomers[0], NOW);
  assert.equal(st.risk, 'red');
  assert.equal(s.tasks.length, 1);
  const t = s.tasks[0];
  assert.equal(t.assignee.role, 'manager');
  assert.equal(t.assignee.name, 'Сергей Логинов');
  assert.equal(t.deadline, '2026-11-12');
  assert.equal(t.urgent, true);
  assert.match(t.description, /График и нагрузка/);
  assert.doesNotMatch(t.description, /тяжело/, 'комментарий новичка не уходит руководителю');
  assert.equal(st.action, 'task_open');
});

test('одиночный жёлтый сигнал задачу не создаёт, повтор той же темы — создаёт', () => {
  let s = fresh(15);
  const id = s.newcomers[0].id;
  s = L.reduce(s, { type: 'submitSurvey', newcomerId: id, cp: 'd7', answers: { ...ok('d7'), mood: 2 }, at: '2026-11-04T18:00:00' });
  assert.equal(s.tasks.length, 0);
  assert.equal(L.newcomerStatus(s, s.newcomers[0], new Date(2026, 10, 5)).action, 'need_action');
  s = L.reduce(s, { type: 'submitSurvey', newcomerId: id, cp: 'd14', answers: { ...ok('d14'), mood: 2 }, at: AT });
  assert.equal(s.tasks.length, 1);
  assert.equal(s.tasks[0].urgent, false);
  assert.equal(s.tasks[0].deadline, '2026-11-14');
});

test('сигнал про руководителя или просьба HR → задача HR, комментарий виден HR', () => {
  let s = fresh(31);
  s = L.reduce(s, { type: 'submitSurvey', newcomerId: s.newcomers[0].id, cp: 'd30', answers: { ...ok('d30'), manager: 2 }, comment: 'никто не говорит', at: AT });
  assert.equal(s.tasks[0].assignee.role, 'hr');
  assert.match(s.tasks[0].description, /никто не говорит/);
  let s2 = fresh(8);
  s2 = L.reduce(s2, { type: 'submitSurvey', newcomerId: s2.newcomers[0].id, cp: 'd7', answers: ok('d7'), wantHr: true, at: AT });
  assert.equal(s2.tasks.length, 1);
  assert.equal(s2.tasks[0].assignee.role, 'hr');
});

test('молчание дольше 3 дней → жёлтый «молчит»', () => {
  const s = fresh(11);
  const st = L.newcomerStatus(s, s.newcomers[0], NOW);
  assert.equal(st.silent, true);
  assert.equal(st.risk, 'yellow');
  assert.equal(st.action, 'need_action');
});

test('закрытая задача → «отработано» до следующего опроса', () => {
  let s = fresh(8);
  s = L.reduce(s, { type: 'submitSurvey', newcomerId: s.newcomers[0].id, cp: 'd7', answers: { ...ok('d7'), mentor: 2 }, at: '2026-11-11T09:00:00' });
  s = L.reduce(s, { type: 'completeTask', taskId: s.tasks[0].id, outcome: 'fixed', note: 'дали наставника', at: '2026-11-11T11:00:00' });
  assert.equal(L.newcomerStatus(s, s.newcomers[0], NOW).action, 'handled');
});

test('валидация: нельзя пройти опрос дважды или без ответов', () => {
  let s = fresh(8);
  const id = s.newcomers[0].id;
  assert.throws(() => L.reduce(s, { type: 'submitSurvey', newcomerId: id, cp: 'd7', answers: { mentor: 0 }, at: AT }), /Нет ответа/);
  s = L.reduce(s, { type: 'submitSurvey', newcomerId: id, cp: 'd7', answers: ok('d7'), at: AT });
  assert.throws(() => L.reduce(s, { type: 'submitSurvey', newcomerId: id, cp: 'd7', answers: ok('d7'), at: AT }), /уже пройден/);
  assert.throws(() => L.reduce(s, { type: 'createTask', newcomerId: 'nope', at: AT }), /не найден/);
});

test('запрос в Битрикс24: поля tasks.task.add', () => {
  let s = fresh(8);
  s = L.reduce(s, { type: 'submitSurvey', newcomerId: s.newcomers[0].id, cp: 'd7', answers: { ...ok('d7'), schedule: 2 }, at: AT });
  const p = L.bitrixPayload(s, s.tasks[0]).fields;
  assert.equal(p.RESPONSIBLE_ID, 41);
  assert.deepEqual(p.AUDITORS, [12]);
  assert.equal(p.PRIORITY, 2);
  assert.equal(p.DEADLINE, '2026-11-12T18:00:00+03:00');
});

test('новичок по ссылке видит только своё', () => {
  const s = fresh(8);
  const v = L.surveyView(s, 'tok123456', NOW);
  assert.equal(v.firstName, 'Тест');
  assert.equal(v.checkpoint.key, 'd7');
  assert.equal(JSON.stringify(v).includes('Логинов'), false);
  assert.equal(L.surveyView(s, 'wrong', NOW), null);
});

test('демо-данные: целостны и покрывают все ситуации', () => {
  const s = makeSeed(NOW);
  assert.equal(s.newcomers.length, 26);
  const st = s.newcomers.map((n) => L.newcomerStatus(s, n, NOW));
  const risks = new Set(st.map((x) => x.risk));
  for (const r of ['red', 'yellow', 'green', 'new']) assert.ok(risks.has(r), `нет статуса ${r}`);
  const actions = new Set(st.map((x) => x.action));
  for (const a of ['need_action', 'task_open', 'handled']) assert.ok(actions.has(a), `нет ситуации ${a}`);
  // демо-герой: у первого новичка открыт опрос 7-го дня
  assert.equal(L.dueCheckpoint(s, s.newcomers[0], NOW).key, 'd7');
  // ни одного ответа «из будущего»
  for (const r of s.responses) assert.ok(r.at.slice(0, 10) < '2026-11-11');
  // детерминированность
  assert.deepEqual(makeSeed(NOW), s);
});
