import * as L from './shared/logic.js';
import { createStore } from './store.js';

const $app = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => new Date();
const todayStr = () => L.dateStr(new Date());

let store;
let state;
const ui = {
  selected: null, dept: 'all', filter: 'all', q: '',
  surveyToken: null, survey: null, draft: null, done: null, surveyError: null,
  toast: null, resetArmed: false, newUnit: null,
};

const RISK_LABEL = { red: 'Красный', yellow: 'Жёлтый', green: 'Всё хорошо', new: 'Ещё нет ответов', left: 'Уволился' };

function toast(msg, kind = 'ok') {
  ui.toast = { msg, kind };
  render();
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { ui.toast = null; render(); }, 3500);
}

function route() {
  if (store.mode === 'server' && location.pathname.startsWith('/s/')) return 'public-survey';
  const h = location.hash.replace('#', '');
  return ['board', 'tasks', 'about', 'survey'].includes(h) ? h : 'board';
}

function rows() {
  return state.newcomers.filter((n) => n.status === 'active').map((n) => ({ n, unit: L.unitOf(state, n), st: L.newcomerStatus(state, n, today()) }));
}

const surveyLink = (n) => (store.mode === 'server' ? `${location.origin}/s/${n.token}` : null);
const isOverdue = (t) => t.status === 'open' && t.deadline < todayStr();
const moodOf = (r) => (r && r.answers.mood != null ? L.QUESTIONS.mood.options[r.answers.mood][0] : '');
const shortPerson = (name) => { const [f, l] = name.split(' '); return `${l} ${f[0]}.`; };
const themeLabel = (t) => (t === 'silent' ? 'Молчит' : L.THEMES[t]?.label || t);

// ---------------- оболочка ----------------
function shell(r, body) {
  const modeBadge = store.mode === 'server'
    ? `<span class="mode">Сервер · Битрикс24: ${store.bitrix === 'webhook' ? 'вебхук подключён' : 'демо (вебхук не задан)'}</span>`
    : '<span class="mode demo" title="Сервера нет: данные хранятся в этой вкладке браузера. Новичок и HR — в одном окне.">Демо-режим · данные в вашем браузере</span>';
  const nav = [['board', 'Новички'], ['tasks', 'Задачи'], ['about', 'Как устроено']]
    .map(([k, t]) => `<a href="#${k}" class="${r === k ? 'on' : ''}">${t}</a>`).join('');
  return `
  <header class="top">
    <div class="brand"><span class="pulse"></span><div><b>Пульс новичка</b><small>первые 90 дней нового сотрудника</small></div></div>
    <nav>${nav}<a href="#survey" class="survey-link ${r === 'survey' ? 'on' : ''}">📱 Опрос глазами новичка</a></nav>
    ${modeBadge}
  </header>
  <main>${body}</main>
  ${ui.selected ? drawer() : ''}
  ${ui.toast ? `<div class="toast ${ui.toast.kind}">${esc(ui.toast.msg)}</div>` : ''}`;
}

// ---------------- доска ----------------
function board() {
  const all = rows();
  const t = todayStr();
  const red = all.filter((x) => x.st.risk === 'red').length;
  const yellow = all.filter((x) => x.st.risk === 'yellow').length;
  const need = all.filter((x) => x.st.action === 'need_action').length;
  const overdue = state.tasks.filter((x) => x.status === 'open' && x.deadline < t).length;
  let passed = 0; let answered = 0;
  for (const { st } of all) {
    passed += L.CHECKPOINTS.filter((c) => c.day <= st.day && !(st.due && st.due.key === c.key && !st.silent)).length;
    answered += st.responses.length;
  }
  const rate = passed ? Math.round((answered / passed) * 100) : 0;

  // о чём сигналы
  const themeCount = {};
  for (const { st } of all) if (st.risk === 'red' || st.risk === 'yellow') for (const th of new Set(st.reasons.map((x) => x.theme).filter((x) => x !== 'mood'))) themeCount[th] = (themeCount[th] || 0) + 1;
  const themes = Object.entries(themeCount).sort((a, b) => b[1] - a[1]);
  const maxT = themes[0]?.[1] || 1;

  const depts = [...new Set(state.org.units.map((u) => u.dept))];
  const deptRows = depts.map((d) => {
    const xs = all.filter((x) => x.unit.dept === d);
    return { d, total: xs.length, red: xs.filter((x) => x.st.risk === 'red').length, yellow: xs.filter((x) => x.st.risk === 'yellow').length };
  });

  let list = all;
  if (ui.dept !== 'all') list = list.filter((x) => x.unit.dept === ui.dept);
  if (ui.filter === 'need_action') list = list.filter((x) => x.st.action === 'need_action');
  else if (ui.filter !== 'all') list = list.filter((x) => x.st.risk === ui.filter);
  if (ui.q) list = list.filter((x) => x.n.name.toLowerCase().includes(ui.q.toLowerCase()));
  list.sort((a, b) => L.RISK_ORDER[a.st.risk] - L.RISK_ORDER[b.st.risk] || L.ACTION_ORDER[a.st.action] - L.ACTION_ORDER[b.st.action] || (b.st.last?.at || '').localeCompare(a.st.last?.at || ''));

  const kpi = (v, label, cls = '', filter = null) => `<button class="kpi ${cls} ${filter && ui.filter === filter ? 'on' : ''}" ${filter ? `data-act="filter" data-v="${filter}"` : 'disabled'}><b>${v}</b><span>${label}</span></button>`;

  return `
  <section class="kpis">
    ${kpi(all.length, 'новичков на испытательном', '', 'all')}
    ${kpi(red, 'красный сигнал', 'red', 'red')}
    ${kpi(yellow, 'жёлтый сигнал', 'yellow', 'yellow')}
    ${kpi(need, 'ждут действия HR', 'need', 'need_action')}
    ${kpi(overdue, 'задач руководителей просрочено', overdue ? 'red-text' : '')}
    ${kpi(`${rate}%`, 'опросов пройдено вовремя')}
  </section>

  <section class="split">
    <div class="card">
      <h3>О чём сигналы сейчас</h3>
      ${themes.length ? themes.map(([th, c]) => `<div class="bar"><span>${esc(themeLabel(th))}</span><i style="width:${(c / maxT) * 100}%"></i><b>${c}</b></div>`).join('') : '<p class="muted">Сигналов нет</p>'}
      <p class="muted small">Число новичков с жёлтым/красным статусом, у которых есть этот сигнал (плохое самочувствие не считаем — это симптом, а не причина). Если тема повторяется у разных руководителей — это уже не частный случай, а процесс.</p>
    </div>
    <div class="card">
      <h3>По подразделениям</h3>
      <table class="mini"><tr><th></th><th>новичков</th><th>красных</th><th>жёлтых</th></tr>
      ${deptRows.map((x) => `<tr class="click" data-act="dept" data-v="${esc(x.d)}"><td>${esc(x.d)}</td><td>${x.total}</td><td>${x.red ? `<span class="dot red"></span>${x.red}` : '—'}</td><td>${x.yellow ? `<span class="dot yellow"></span>${x.yellow}` : '—'}</td></tr>`).join('')}
      </table>
    </div>
  </section>

  <section class="card">
    <div class="filters">
      <select data-act="dept-select"><option value="all">Все подразделения</option>${depts.map((d) => `<option ${ui.dept === d ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select>
      <select data-act="filter-select">${[['all', 'Все статусы'], ['need_action', 'Ждут действия HR'], ['red', 'Красные'], ['yellow', 'Жёлтые'], ['green', 'Всё хорошо'], ['new', 'Ещё нет ответов']].map(([v, l]) => `<option value="${v}" ${ui.filter === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <input type="search" placeholder="Поиск по имени" value="${esc(ui.q)}" data-act="search">
      <span class="muted small">${list.length} из ${all.length}</span>
    </div>
    <table class="list">
      <thead><tr><th></th><th>Новичок</th><th>Где работает</th><th>Срок</th><th>Последний ответ</th><th>Сигналы</th><th>Что сейчас</th></tr></thead>
      <tbody>${list.map(rowHtml).join('') || '<tr><td colspan="7" class="muted">Никого не нашлось</td></tr>'}</tbody>
    </table>
  </section>`;
}

function actionCell(st) {
  if (st.action === 'need_action') return '<span class="badge need">Нужно действие</span>';
  if (st.action === 'task_open') {
    const t = st.openTask;
    return `<span class="badge ${isOverdue(t) ? 'overdue' : 'open'}">Задача: ${esc(shortPerson(t.assignee.name))}</span><small class="${isOverdue(t) ? 'red-text' : 'muted'}">${isOverdue(t) ? 'просрочена с ' : 'до '}${L.fmtDate(t.deadline)}</small>`;
  }
  if (st.action === 'handled') { const t = [...st.tasks].reverse().find((x) => x.status === 'done'); return `<span class="badge done">Отработано</span><small class="muted">${esc(L.OUTCOMES[t.outcome])}</small>`; }
  if (st.risk === 'new') return `<small class="muted">Первый опрос — на 3-й день</small>`;
  return '<small class="muted">—</small>';
}

function rowHtml({ n, unit, st }) {
  const pct = Math.min(100, (st.day / L.PROBATION_DAYS) * 100);
  const last = st.last;
  return `<tr class="click ${ui.selected === n.id ? 'sel' : ''}" data-act="open" data-id="${n.id}">
    <td><span class="dot ${st.risk}" title="${RISK_LABEL[st.risk]}"></span></td>
    <td><b>${esc(n.name)}</b><small>${esc(n.position)}</small></td>
    <td>${esc(unit.name)}<small>рук. ${esc(shortPerson(unit.manager.name))}</small></td>
    <td class="nowrap">День ${st.day} <small class="muted">из ${L.PROBATION_DAYS}</small><div class="prog"><i style="width:${pct}%"></i></div></td>
    <td>${last ? `<span class="mood">${moodOf(last)}</span> ${L.fmtDate(last.at)}<small>${esc(L.cpByKey(last.cp).title)}</small>` : '<small class="muted">—</small>'}${st.due ? `<small class="${st.silent ? 'red-text' : 'muted'}">${st.silent ? 'молчит' : 'ждём'}: опрос ${st.due.day}-го дня</small>` : ''}</td>
    <td class="reasons">${(st.reasons.some((x) => x.theme !== 'mood') ? st.reasons.filter((x) => x.theme !== 'mood') : st.reasons).slice(0, 3).map((x) => `<span class="chip l${x.level}">${esc(themeLabel(x.theme))}</span>`).join('') || '<small class="muted">—</small>'}</td>
    <td class="act">${actionCell(st)}</td>
  </tr>`;
}

// ---------------- карточка новичка ----------------
function drawer() {
  const n = state.newcomers.find((x) => x.id === ui.selected);
  if (!n) return '';
  const unit = L.unitOf(state, n);
  const st = L.newcomerStatus(state, n, today());
  const byCp = Object.fromEntries(st.responses.map((r) => [r.cp, r]));
  const timeline = L.CHECKPOINTS.map((c) => {
    const r = byCp[c.key];
    let cls = 'future'; let label = 'впереди';
    if (r) { const lv = L.evaluateResponse(r).level; cls = ['green', 'yellow', 'red'][lv]; label = L.fmtDate(r.at); }
    else if (st.due && st.due.key === c.key) { cls = st.silent ? 'missed' : 'due'; label = st.silent ? 'молчит' : 'ждём ответ'; }
    else if (c.day <= st.day) { cls = 'missed'; label = 'пропущен'; }
    return `<div class="tp ${cls}"><b>${c.day}</b><span>${label}</span></div>`;
  }).join('');

  const link = surveyLink(n);
  const canCreate = !st.openTask && n.status === 'active';
  const reason = st.silent && (!st.last || L.evaluateResponse(st.last).level < 2) ? 'silent' : 'talk';

  const respHtml = [...st.responses].reverse().map((r) => {
    const cp = L.cpByKey(r.cp);
    const task = state.tasks.find((t) => t.responseId === r.id);
    return `<div class="resp">
      <div class="resp-h"><b>${esc(cp.title)}</b> <span class="muted">· ${cp.day}-й день · ответил(а) ${L.fmtDate(r.at)}</span>${task ? ' <span class="badge open sm">→ задача</span>' : ''}</div>
      ${cp.questions.map((q) => { const [lab, lv] = L.QUESTIONS[q].options[r.answers[q]]; return `<div class="qa"><span>${esc(L.QUESTIONS[q].text)}</span><b class="l${lv}">${esc(lab)}</b></div>`; }).join('')}
      ${r.comment ? `<blockquote>«${esc(r.comment)}»</blockquote>` : ''}
      ${r.wantHr ? '<div class="small red-text">Просит, чтобы связался HR, а не руководитель</div>' : ''}
    </div>`;
  }).join('') || '<p class="muted">Ответов пока нет.</p>';

  const tasksHtml = [...st.tasks].reverse().map(taskCard).join('') || '<p class="muted">Задач не было.</p>';

  return `<div class="overlay" data-act="close"></div>
  <aside class="drawer">
    <button class="x" data-act="close" aria-label="Закрыть">×</button>
    <div class="d-head">
      <span class="dot big ${st.risk}"></span>
      <div><h2>${esc(n.name)}</h2><div class="muted">${esc(n.position)} · ${esc(unit.name)} · рук. ${esc(unit.manager.name)}</div>
      <div class="muted small">Вышел(ла) ${L.fmtDate(n.hireDate)} · день ${st.day} из ${L.PROBATION_DAYS} · ${RISK_LABEL[st.risk]}</div></div>
    </div>
    ${st.reasons.length ? `<div class="reasons-box">${st.reasons.map((x) => `<div class="l${x.level}">● ${esc(x.text)}</div>`).join('')}</div>` : ''}
    <div class="timeline">${timeline}</div>
    <div class="d-actions">
      <button class="btn ghost" data-act="as-newcomer" data-token="${n.token}">📱 Открыть опрос глазами новичка</button>
      ${link ? `<button class="btn ghost" data-act="copy" data-v="${esc(link)}">Скопировать личную ссылку</button>` : ''}
      ${canCreate ? `<button class="btn" data-act="create-task" data-id="${n.id}" data-reason="${reason}">${reason === 'silent' ? 'Задача HR: позвонить' : 'Задача руководителю: поговорить'}</button>` : ''}
    </div>
    ${link ? `<div class="small muted linkline">Личная ссылка: <code>${esc(link)}</code></div>` : ''}
    <h3>Задачи</h3>${tasksHtml}
    <h3>Ответы</h3>${respHtml}
  </aside>`;
}

function syncBadge(t) {
  const s = t.sync || {};
  if (s.state === 'pending') return '<span class="sync">отправляется в Битрикс24…</span>';
  if (s.state === 'error') return `<span class="sync err">Битрикс24: ошибка — ${esc(s.error)}</span>`;
  if (s.mode === 'bitrix') return `<span class="sync ok">Битрикс24: задача #${esc(s.bitrixId)}</span>`;
  if (s.mode === 'demo') return '<span class="sync">демо-данные</span>';
  return '<span class="sync">Битрикс24: демо, вебхук не задан</span>';
}

function taskCard(t) {
  const n = state.newcomers.find((x) => x.id === t.newcomerId);
  const done = t.status === 'done';
  return `<div class="task ${done ? 'is-done' : isOverdue(t) ? 'is-overdue' : ''}">
    <div class="task-h"><b>${esc(t.title)}</b></div>
    <div class="small muted">${t.assignee.role === 'hr' ? 'HR' : 'Руководитель'}: ${esc(t.assignee.name)} · создана ${L.fmtDate(t.createdAt)} · срок ${L.fmtDate(t.deadline)}${isOverdue(t) ? ' · <span class="red-text">просрочена</span>' : ''}${t.urgent ? ' · <span class="red-text">срочно</span>' : ''}</div>
    <div class="small">${syncBadge(t)}</div>
    <details><summary>Текст задачи${n ? '' : ''}</summary><pre>${esc(t.description)}</pre></details>
    ${done
    ? `<div class="outcome">✓ ${esc(L.OUTCOMES[t.outcome])}${t.note ? ` — ${esc(t.note)}` : ''} <span class="muted small">(${L.fmtDate(t.doneAt)})</span></div>`
    : `<form class="complete" data-task="${t.id}">
        <select name="outcome" required><option value="">Итог разговора…</option>${Object.entries(L.OUTCOMES).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select>
        <input name="note" placeholder="Что договорились (необязательно)">
        <button class="btn sm">Закрыть задачу</button>
      </form>`}
  </div>`;
}

// ---------------- задачи ----------------
function tasksPage() {
  const ts = [...state.tasks].sort((a, b) => (a.status === b.status ? b.createdAt.localeCompare(a.createdAt) : a.status === 'open' ? -1 : 1));
  const open = ts.filter((t) => t.status === 'open');
  return `<section class="card">
    <h2>Задачи по новичкам <span class="muted small">${open.length} открыто · ${open.filter(isOverdue).length} просрочено · ${ts.length - open.length} закрыто</span></h2>
    <p class="muted small">Задача создаётся автоматически, когда нужен живой разговор: критичный ответ, одна и та же проблема два опроса подряд или просьба новичка связаться с HR. Если проблема в руководителе — задача уходит HR. ${store.bitrix === 'webhook' ? 'Задачи отправляются в Битрикс24 через вебхук.' : 'Вебхук Битрикс24 не задан — ниже видно, что именно ушло бы в <code>tasks.task.add</code>.'}</p>
    ${ts.map((t) => { const n = state.newcomers.find((x) => x.id === t.newcomerId); return `<div class="task-row">${taskCard(t)}<div class="task-side"><button class="btn ghost sm" data-act="open" data-id="${t.newcomerId}">Карточка: ${esc(n ? shortPerson(n.name) : '')}</button><details><summary>Запрос в Битрикс24</summary><pre>POST {вебхук}/tasks.task.add.json\n${esc(JSON.stringify(L.bitrixPayload(state, t), null, 2))}</pre></details></div></div>`; }).join('')}
  </section>`;
}

// ---------------- как устроено ----------------
function about() {
  const unitId = ui.newUnit || state.org.units[0].id;
  const unit = state.org.units.find((u) => u.id === unitId);
  return `<section class="card prose">
    <h2>Как устроен «Пульс новичка»</h2>
    <p><b>Проблема.</b> Каждый третий ушедший не дорабатывает до 3 месяцев. Человек решает уйти задолго до заявления — но об этом никто не знает: руководитель смены занят, HR видит новичка только при приёме и увольнении.</p>
    <p><b>Идея.</b> Короткий опрос на телефон в ключевые дни адаптации (30 секунд, без логина — личная ссылка). Ответы превращаются в светофор для HR и, когда нужен разговор, — в задачу руководителю в Битрикс24 с подсказкой, о чём говорить.</p>
    <h3>Опросы</h3>
    <table class="mini wide">${L.CHECKPOINTS.map((c) => `<tr><td class="nowrap"><b>${c.day}-й день</b><br><small class="muted">${esc(c.title)}</small></td><td>${c.questions.map((q) => esc(L.QUESTIONS[q].text)).join('<br>')}</td></tr>`).join('')}</table>
    <h3>Светофор</h3>
    <ul>
      <li><span class="dot red"></span> <b>Красный</b> — в последнем опросе есть критичный ответ («намного меньше обещанного», «нет, ищу другое», «никого нет спросить»…).</li>
      <li><span class="dot yellow"></span> <b>Жёлтый</b> — тревожный ответ, настроение упало на 2+ пункта, или новичок не ответил ${L.GRACE_DAYS}+ дня («молчит»).</li>
      <li><span class="dot green"></span> <b>Зелёный</b> — всё в порядке. <span class="dot new"></span> <b>Серый</b> — ещё не было опроса.</li>
    </ul>
    <h3>Когда создаётся задача</h3>
    <ul>
      <li>Критичный ответ → задача руководителю, срок — следующий день.</li>
      <li>Одна и та же тревожная тема два опроса подряд → задача руководителю, срок — 3 дня.</li>
      <li>Сигнал про руководителя или новичок попросил HR → задача HR, а не руководителю. Комментарий новичка видит только HR.</li>
      <li>Одиночный жёлтый сигнал задачу не создаёт — он виден HR на доске. Так руководители не тонут в задачах и не начинают их игнорировать.</li>
    </ul>
  </section>

  <section class="split">
    <form class="card" id="add-form">
      <h3>Добавить новичка</h3>
      <p class="muted small">В рабочей версии это делает Битрикс24: при закрытии задачи «Приём сотрудника» исходящий вебхук передаёт ФИО, должность, подразделение и дату выхода. Здесь — вручную.</p>
      <label>Имя и фамилия<input name="name" required placeholder="Например, Пётр Иванов"></label>
      <label>Подразделение<select name="unitId" data-act="unit-select">${state.org.units.map((u) => `<option value="${u.id}" ${u.id === unitId ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select></label>
      <label>Должность<select name="position">${unit.positions.map((p) => `<option>${esc(p)}</option>`).join('')}</select></label>
      <label>Дата выхода<input type="date" name="hireDate" value="${todayStr()}" required></label>
      <button class="btn">Добавить</button>
    </form>
    <div class="card">
      <h3>Данные</h3>
      <p class="small">${store.mode === 'server' ? 'Режим: сервер. Ответы новичков приходят по личным ссылкам с любых устройств.' : 'Режим: демо без сервера. Всё хранится в этой вкладке; новичок и HR — в одном окне.'}</p>
      <p class="small muted">Все люди и ответы вымышлены. Оргструктура похожа на компанию опт+розница спорттоваров: 2 смены склада, 3 магазина, оптовый отдел продаж, офис.</p>
      <button class="btn ${ui.resetArmed ? 'danger' : 'ghost'}" data-act="reset">${ui.resetArmed ? 'Точно сбросить? Нажмите ещё раз' : 'Сбросить демо-данные'}</button>
    </div>
  </section>`;
}

// ---------------- опрос новичка ----------------
async function loadSurvey(token) {
  ui.surveyError = null;
  try { ui.survey = await store.getSurvey(token); } catch (e) { ui.survey = null; ui.surveyError = e.message; }
  ui.surveyToken = token;
  if (!ui.draft || ui.draft.token !== token) ui.draft = { token, answers: {}, comment: '', wantHr: false };
}

function surveyCard(isDemo) {
  if (ui.surveyError) return `<div class="phone-card"><h2>Ссылка не работает</h2><p class="muted">${esc(ui.surveyError)}. Если вы новый сотрудник — напишите в HR.</p></div>`;
  const v = ui.survey;
  if (!v) return '<div class="phone-card">Загрузка…</div>';
  const hrLine = `<p class="small muted">Если что-то срочное — HR: ${esc(v.hrName)}, ${esc(v.hrPhone)}</p>`;
  if (ui.done) {
    const f = ui.done.followUp;
    return `<div class="phone-card center">
      <div class="big-emoji">${f ? '🤝' : '🙌'}</div>
      <h2>Спасибо, ${esc(v.firstName)}!</h2>
      <p>${f === 'hr' ? `С вами свяжется ${esc(v.hrName)} из HR в ближайшие дни. Руководителю ваш комментарий не передаётся.` : f === 'manager' ? 'Спасибо, что сказали честно. Руководитель поговорит с вами в ближайшие дни, чтобы это исправить.' : 'Рады, что всё идёт хорошо.'}</p>
      ${ui.done.nextDay ? `<p class="muted">Следующий короткий опрос — на ${ui.done.nextDay}-й день.</p>` : ''}
      ${hrLine}
      ${isDemo ? `<button class="btn" data-act="see-hr" data-id="${v.newcomerId}">Посмотреть, что увидел HR →</button>` : ''}
    </div>`;
  }
  if (!v.checkpoint) {
    return `<div class="phone-card center"><div class="big-emoji">👍</div><h2>${esc(v.firstName)}, сейчас опросов нет</h2><p class="muted">${v.nextDay ? `Следующий — на ${v.nextDay}-й день работы.` : 'Испытательный срок позади — спасибо, что отвечали!'}</p>${hrLine}</div>`;
  }
  const cp = v.checkpoint;
  const d = ui.draft;
  const complete = cp.questions.every((q) => Number.isInteger(d.answers[q.id]));
  return `<form class="phone-card" id="survey-form">
    <div class="hello">Привет, ${esc(v.firstName)}! 👋</div>
    <h2>Сегодня ${v.day}-й день у нас. Как дела?</h2>
    <p class="muted small">Опрос «${esc(cp.title)}» — ${cp.questions.length} вопроса, 30 секунд. Ответы видит HR-отдел. Если что-то не так — с вами поговорят и помогут, а не накажут.</p>
    ${cp.questions.map((q) => `<fieldset class="${q.emoji ? 'emoji' : ''}"><legend>${esc(q.text)}</legend>
      ${q.options.map(([lab], i) => `<button type="button" class="opt ${d.answers[q.id] === i ? 'on' : ''}" data-act="answer" data-q="${q.id}" data-i="${i}">${esc(lab)}</button>`).join('')}
    </fieldset>`).join('')}
    <label class="comment">Что нам исправить? <span class="muted">(необязательно)</span><textarea name="comment" rows="3" maxlength="1000" data-act="comment">${esc(d.comment)}</textarea></label>
    <label class="check"><input type="checkbox" data-act="wanthr" ${d.wantHr ? 'checked' : ''}> Хочу поговорить с HR, а не с руководителем</label>
    <button class="btn wide" ${complete ? '' : 'disabled'}>${complete ? 'Отправить' : 'Ответьте на все вопросы'}</button>
    ${hrLine}
  </form>`;
}

function surveyPage() {
  const active = state.newcomers.filter((n) => n.status === 'active');
  const opts = active.map((n) => { const due = L.dueCheckpoint(state, n, today()); return `<option value="${n.token}" ${n.token === ui.surveyToken ? 'selected' : ''}>${esc(n.name)} — ${esc(n.position.toLowerCase())}${due ? ` · открыт опрос ${due.day}-го дня` : ''}</option>`; }).join('');
  return `<section class="survey-demo">
    <div class="explain">
      <h2>Так новичок видит опрос</h2>
      <p>Ссылка приходит в SMS или мессенджер в 3-й, 7-й, 14-й, 30-й, 60-й и 85-й день работы. Без логинов и приложений — склад и магазины работают не за компьютером.</p>
      <label class="small">Чей опрос открыть<select data-act="pick-newcomer">${opts}</select></label>
      <p class="small muted">Попробуйте ответить, что нагрузка «намного тяжелее» — и посмотрите, что произойдёт на доске HR и в задачах.</p>
    </div>
    <div class="phone">${surveyCard(true)}</div>
  </section>`;
}

// ---------------- рендер и события ----------------
async function render() {
  const r = route();
  if (r === 'public-survey') {
    document.body.className = 'public';
    $app.innerHTML = `<div class="public-wrap"><div class="brand"><span class="pulse"></span><b>Пульс новичка</b></div>${surveyCard(false)}</div>${ui.toast ? `<div class="toast ${ui.toast.kind}">${esc(ui.toast.msg)}</div>` : ''}`;
    return;
  }
  document.body.className = '';
  if (r === 'survey') {
    if (!ui.surveyToken) {
      const first = state.newcomers.find((n) => n.status === 'active' && L.dueCheckpoint(state, n, today()) && !L.newcomerStatus(state, n, today()).silent) || state.newcomers[0];
      await loadSurvey(first.token);
    }
    $app.innerHTML = shell(r, surveyPage());
    return;
  }
  $app.innerHTML = shell(r, r === 'tasks' ? tasksPage() : r === 'about' ? about() : board());
}

async function run(fn, okMsg) {
  try { const s = await fn(); if (s && s.newcomers) state = s; if (okMsg) toast(okMsg); else render(); }
  catch (e) { toast(e.message, 'err'); }
}

document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  if (!['reset'].includes(act)) ui.resetArmed = false;
  switch (act) {
    case 'open': ui.selected = el.dataset.id; render(); break;
    case 'close': ui.selected = null; render(); break;
    case 'filter': ui.filter = el.dataset.v; render(); break;
    case 'dept': ui.dept = ui.dept === el.dataset.v ? 'all' : el.dataset.v; render(); break;
    case 'answer': ui.draft.answers[el.dataset.q] = Number(el.dataset.i); render(); break;
    case 'wanthr': ui.draft.wantHr = el.checked; break;
    case 'as-newcomer':
      ui.selected = null; ui.done = null;
      if (store.mode === 'server') { window.open(`/s/${el.dataset.token}`, '_blank'); break; }
      await loadSurvey(el.dataset.token); location.hash = 'survey'; render(); break;
    case 'see-hr':
      ui.selected = el.dataset.id; ui.done = null; ui.filter = 'all'; ui.dept = 'all';
      state = await store.getState(); location.hash = 'board'; render(); break;
    case 'create-task':
      await run(() => store.dispatch({ type: 'createTask', newcomerId: el.dataset.id, reason: el.dataset.reason }), 'Задача создана'); break;
    case 'copy':
      try { await navigator.clipboard.writeText(el.dataset.v); toast('Ссылка скопирована'); } catch { toast('Не удалось скопировать — выделите ссылку ниже', 'err'); }
      break;
    case 'reset':
      if (!ui.resetArmed) { ui.resetArmed = true; render(); break; }
      ui.resetArmed = false; ui.selected = null; ui.surveyToken = null; ui.done = null; ui.draft = null;
      await run(() => store.reset(), 'Демо-данные сброшены'); break;
    default: break;
  }
});

document.addEventListener('change', async (e) => {
  const el = e.target;
  const act = el.dataset.act;
  if (act === 'dept-select') { ui.dept = el.value; render(); }
  if (act === 'filter-select') { ui.filter = el.value; render(); }
  if (act === 'unit-select') { ui.newUnit = el.value; render(); }
  if (act === 'pick-newcomer') { ui.done = null; await loadSurvey(el.value); render(); }
});

document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.act === 'search') {
    ui.q = el.value; render();
    const s = document.querySelector('[data-act="search"]');
    if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
  }
  if (el.dataset.act === 'comment' && ui.draft) ui.draft.comment = el.value;
});

document.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  if (f.id === 'survey-form') {
    const btn = f.querySelector('button.wide');
    if (btn) btn.disabled = true;
    try {
      ui.done = await store.submitSurvey(ui.surveyToken, { answers: ui.draft.answers, comment: ui.draft.comment, wantHr: ui.draft.wantHr });
      ui.draft = null;
      if (store.mode === 'demo') state = await store.getState();
      await loadSurvey(ui.surveyToken);
      render();
      window.scrollTo(0, 0);
    } catch (err) { toast(err.message, 'err'); }
  }
  if (f.classList.contains('complete')) {
    const fd = new FormData(f);
    await run(() => store.dispatch({ type: 'completeTask', taskId: f.dataset.task, outcome: fd.get('outcome'), note: fd.get('note') }), 'Задача закрыта');
  }
  if (f.id === 'add-form') {
    const fd = new FormData(f);
    await run(async () => {
      const s = await store.dispatch({ type: 'addNewcomer', name: fd.get('name'), unitId: fd.get('unitId'), position: fd.get('position'), hireDate: fd.get('hireDate'), source: 'manual' });
      ui.selected = s.newcomers[s.newcomers.length - 1].id;
      return s;
    }, 'Новичок добавлен. Первый опрос — на 3-й день');
  }
});

document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && ui.selected) { ui.selected = null; render(); } });
window.addEventListener('hashchange', () => { if (route() !== 'survey') ui.done = null; render(); });

(async () => {
  store = await createStore();
  if (route() === 'public-survey') {
    await loadSurvey(location.pathname.split('/')[2] || '');
  } else {
    state = await store.getState();
  }
  render();
})();
