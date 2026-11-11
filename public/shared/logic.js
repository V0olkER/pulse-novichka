// Ядро «Пульса новичка»: вопросы, контрольные точки, оценка риска, правила создания задач.
// Чистые функции без DOM и сети — один и тот же файл работает в браузере и в Node.

export const PROBATION_DAYS = 90;
export const GRACE_DAYS = 3; // сколько дней ждём ответа, прежде чем считать «молчит»

// Темы сигналов + подсказка руководителю, что делать в разговоре.
export const THEMES = {
  welcome: { label: 'Первый день', hint: 'Извинитесь, что встретили неорганизованно. Покажите рабочее место, представьте команде и назначьте наставника сегодня, а не «потом».' },
  tools: { label: 'Оснащение', hint: 'Выясните, чего конкретно не хватает (форма, доступы, сканер, касса, ноутбук) и закройте сегодня — это самый быстрый и дешёвый способ показать, что новичка ждали.' },
  expect: { label: 'Ожидания vs реальность', hint: 'Спросите, что именно отличается от обещанного на собеседовании. Если обещали лишнее — признайте и договоритесь, как будет на самом деле. Передайте HR/рекрутеру, что говорят кандидатам.' },
  mentor: { label: 'Наставник', hint: 'Закрепите конкретного человека и скажите новичку его имя. Наставнику — 10 минут в конце смены на вопросы первые две недели.' },
  schedule: { label: 'График и нагрузка', hint: 'Сверьте фактический график и нормы с тем, о чём договаривались. В первые 2–3 недели нагрузку повышают постепенно, особенно на складе в сезон.' },
  clarity: { label: 'Понятность задач', hint: 'Проговорите 3 главные вещи, по которым оценивается работа на испытательном, и как новичок узнает, что справляется.' },
  team: { label: 'Коллектив', hint: 'Узнайте, с кем не сложилось и почему. Если конфликт — разберите при HR, не «само рассосётся».' },
  pay: { label: 'Деньги', hint: 'Разберите расчётный лист вместе: из чего сложилась сумма, когда будет полная ставка, откуда удержания. Непонятная первая зарплата — одна из главных причин ухода в первый месяц.' },
  manager: { label: 'Внимание руководителя', hint: 'Сигнал о руководителе — задача уходит HR, а не руководителю. HR: поговорить с новичком и отдельно напомнить руководителю про встречу 1-на-1.' },
  stay: { label: 'Хочет уйти', hint: 'Срочный разговор: что должно измениться, чтобы остаться? Не уговаривайте — выясните причину и договоритесь о конкретном шаге со сроком.' },
  recommend: { label: 'Лояльность', hint: 'Спросите, что мешает советовать работу у нас знакомым — это обычно то же, что мешает остаться.' },
  mood: { label: 'Самочувствие', hint: 'Спросите открыто: «Как вам у нас? Что тяжелее всего?» Часто достаточно, что кто-то вообще спросил.' },
};

// options: [подпись, уровень]; уровень 0 — норма, 1 — тревожно, 2 — критично
export const QUESTIONS = {
  welcome: { text: 'Вас встретили и показали, что где и как?', options: [['Да', 0], ['Частично', 1], ['Нет, разбирался(ась) сам(а)', 2]] },
  tools: { text: 'Есть всё для работы: форма, доступы, инструмент?', options: [['Да, всё есть', 0], ['Не всё', 1], ['Нет, работать нечем', 2]] },
  expect: { text: 'Работа совпадает с тем, что обещали на собеседовании?', options: [['Да', 0], ['В чём-то нет', 1], ['Сильно отличается', 2]] },
  mentor: { text: 'Есть человек, к которому можно подойти с любым вопросом?', options: [['Да, наставник помогает', 0], ['Не всегда есть кого спросить', 1], ['Нет, никого', 2]] },
  schedule: { text: 'График и нагрузка — как договаривались?', options: [['Да', 0], ['Тяжелее, чем думал(а)', 1], ['Намного тяжелее, долго не выдержу', 2]] },
  clarity: { text: 'Понятно, что от вас ждут и как это делать?', options: [['Да', 0], ['Не до конца', 1], ['Нет, не понимаю', 2]] },
  team: { text: 'Как вас приняли в коллективе?', options: [['Хорошо', 0], ['Нормально, держусь в стороне', 1], ['Плохо, есть конфликт', 2]] },
  pay: { text: 'Зарплата (аванс) пришла такой, как вы ожидали?', options: [['Да', 0], ['Ещё не получал(а)', 0], ['Меньше, не понимаю почему', 1], ['Намного меньше обещанного', 2]] },
  manager: { text: 'Руководитель обсуждал с вами, как у вас идут дела?', options: [['Да, регулярно', 0], ['Один раз, мельком', 1], ['Ни разу', 2]] },
  stay: { text: 'Видите себя у нас через полгода?', options: [['Да', 0], ['Пока не знаю', 1], ['Нет, ищу другое', 2]] },
  recommend: { text: 'Посоветовали бы знакомому работу у нас?', options: [['Да', 0], ['Не уверен(а)', 1], ['Нет', 2]] },
  mood: { text: 'Как вам у нас в целом?', emoji: true, options: [['😀', 0], ['🙂', 0], ['😐', 1], ['🙁', 2], ['😣', 2]] },
};

// Контрольные точки первых 90 дней. Вопросов мало: опрос на 30 секунд с телефона.
export const CHECKPOINTS = [
  { key: 'd3', day: 3, title: 'Первые дни', questions: ['welcome', 'tools', 'expect', 'mood'] },
  { key: 'd7', day: 7, title: 'Первая неделя', questions: ['mentor', 'schedule', 'mood'] },
  { key: 'd14', day: 14, title: 'Две недели', questions: ['clarity', 'team', 'mood'] },
  { key: 'd30', day: 30, title: 'Первый месяц', questions: ['pay', 'manager', 'stay', 'mood'] },
  { key: 'd60', day: 60, title: 'Два месяца', questions: ['schedule', 'pay', 'stay', 'mood'] },
  { key: 'd85', day: 85, title: 'Перед концом испытательного', questions: ['manager', 'stay', 'recommend', 'mood'] },
];
export const cpByKey = (key) => CHECKPOINTS.find((c) => c.key === key);

// ---------- даты ----------
const DAY = 86400000;
export const dateStr = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
const midnight = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d).getTime(); };
export const addDays = (s, n) => dateStr(midnight(s) + n * DAY + 3600000); // +1ч страхует от перехода на летнее время
// День работы: день выхода = 1-й день.
export const dayNumber = (hireDate, today) => Math.round((midnight(dateStr(today)) - midnight(hireDate)) / DAY) + 1;
const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
export const fmtDate = (s) => { const d = new Date(midnight(s)); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };

// ---------- справочники ----------
export const unitOf = (state, n) => state.org.units.find((u) => u.id === n.unitId);
export const shortName = (name) => { const [first, last] = name.split(' '); return last ? `${last} ${first[0]}.` : name; };
export const firstName = (name) => name.split(' ')[0];

// ---------- оценка ответа ----------
export function evaluateResponse(resp) {
  const flags = [];
  for (const [qid, idx] of Object.entries(resp.answers)) {
    const q = QUESTIONS[qid];
    if (!q || !q.options[idx]) continue;
    const [label, level] = q.options[idx];
    if (level > 0) flags.push({ qid, theme: qid, level, label });
  }
  flags.sort((a, b) => b.level - a.level);
  const level = flags.reduce((m, f) => Math.max(m, f.level), 0);
  return { level, flags };
}

const responsesOf = (state, id) => state.responses
  .filter((r) => r.newcomerId === id)
  .sort((a, b) => cpByKey(a.cp).day - cpByKey(b.cp).day);

// Какой опрос сейчас открыт для новичка: последняя наступившая и не пройденная точка.
export function dueCheckpoint(state, n, today) {
  const day = dayNumber(n.hireDate, today);
  const answered = new Set(responsesOf(state, n.id).map((r) => r.cp));
  const passed = CHECKPOINTS.filter((c) => c.day <= day);
  const last = passed[passed.length - 1];
  if (!last || answered.has(last.key)) return null;
  return last;
}
export const nextCheckpoint = (n, today) => CHECKPOINTS.find((c) => c.day > dayNumber(n.hireDate, today)) || null;

// Сводный статус новичка для доски HR.
export function newcomerStatus(state, n, today) {
  const day = dayNumber(n.hireDate, today);
  const resps = responsesOf(state, n.id);
  const last = resps[resps.length - 1] || null;
  const prev = resps[resps.length - 2] || null;
  const due = dueCheckpoint(state, n, today);
  const silent = !!due && day > due.day + GRACE_DAYS;
  const ev = last ? evaluateResponse(last) : { level: 0, flags: [] };
  const moodDrop = !!(last && prev && last.answers.mood != null && prev.answers.mood != null && last.answers.mood - prev.answers.mood >= 2);

  const reasons = ev.flags.map((f) => ({ theme: f.theme, level: f.level, text: f.qid === 'mood' ? `${THEMES.mood.label}: ${f.label}` : `${THEMES[f.theme].label}: «${f.label}»` }));
  if (moodDrop) reasons.push({ theme: 'mood', level: 1, text: 'Настроение заметно упало с прошлого опроса' });
  if (silent) reasons.push({ theme: 'silent', level: 1, text: `Не ответил(а) на опрос ${due.day}-го дня (${day - due.day} дн.)` });

  let risk;
  if (n.status === 'left') risk = 'left';
  else if (ev.level === 2) risk = 'red';
  else if (ev.level === 1 || silent || moodDrop) risk = 'yellow';
  else if (!last) risk = 'new';
  else risk = 'green';

  const tasks = state.tasks.filter((t) => t.newcomerId === n.id);
  const openTask = tasks.find((t) => t.status === 'open') || null;
  const lastAt = last ? last.at : '';
  const handled = tasks.some((t) => t.status === 'done' && t.doneAt >= lastAt);
  let action = 'none';
  if (risk === 'red' || risk === 'yellow') action = openTask ? 'task_open' : handled ? 'handled' : 'need_action';

  return { day, risk, reasons, last, due, silent, moodDrop, openTask, action, responses: resps, tasks };
}

export const RISK_ORDER = { red: 0, yellow: 1, new: 2, green: 3, left: 4 };
export const ACTION_ORDER = { need_action: 0, task_open: 1, handled: 2, none: 3 };

// ---------- правила задач ----------
// Задачу создаём, только когда нужен живой разговор — иначе руководители начнут игнорировать поток задач:
//  • критичный ответ (уровень 2);
//  • тревожный сигнал по одной и той же теме два опроса подряд;
//  • новичок сам попросил связаться с HR.
export function taskDecision(prevResp, resp) {
  const ev = evaluateResponse(resp);
  const prevThemes = new Set(prevResp ? evaluateResponse(prevResp).flags.map((f) => f.theme) : []);
  const repeated = ev.flags.filter((f) => prevThemes.has(f.theme)).map((f) => f.theme);
  const create = ev.level === 2 || repeated.length > 0 || !!resp.wantHr;
  // Если проблема в руководителе или новичок просит HR — задача HR, не руководителю.
  const toHr = !!resp.wantHr || ev.flags.some((f) => f.theme === 'manager');
  return { create, toHr, ev, repeated, urgent: ev.level === 2 };
}

function deadlineFrom(at, urgent) {
  let d = addDays(at, urgent ? 1 : 3);
  if (new Date(midnight(d)).getDay() === 0) d = addDays(d, 1); // воскресенье → понедельник
  return d;
}

export function buildTask(state, n, resp, decision, id) {
  const unit = unitOf(state, n);
  const cp = cpByKey(resp.cp);
  const assignee = decision.toHr
    ? { role: 'hr', name: state.org.hr.name, bitrixId: state.org.hr.bitrixId }
    : { role: 'manager', name: unit.manager.name, bitrixId: unit.manager.bitrixId };
  const themes = [...new Set(decision.ev.flags.map((f) => f.theme))];
  const themeLabels = themes.map((t) => THEMES[t].label);
  const deadline = deadlineFrom(resp.at, decision.urgent);
  const title = `Новичок ${shortName(n.name)} (${n.position.toLowerCase()}, ${cp.day}-й день): ${themeLabels.length ? themeLabels.join(', ').toLowerCase() : 'просит связаться с HR'}`;

  const lines = [];
  lines.push(`Пульс новичка: ответы на опрос «${cp.title}» (${cp.day}-й день работы).`);
  lines.push(`Сотрудник: ${n.name}, ${n.position}, ${unit.name}. Вышел(ла) ${fmtDate(n.hireDate)}.`);
  lines.push('');
  lines.push('Что ответил(а):');
  for (const f of decision.ev.flags) lines.push(`— ${QUESTIONS[f.qid].text} → «${f.label}»${f.level === 2 ? ' [критично]' : ''}${decision.repeated.includes(f.theme) ? ' [повторно]' : ''}`);
  if (resp.wantHr) lines.push('— Просит, чтобы с ним/ней связался HR, а не руководитель.');
  lines.push('');
  lines.push(`Что сделать: лично поговорить до ${fmtDate(deadline)} и записать итог в задаче.`);
  if (themes.length) {
    lines.push('Подсказки к разговору:');
    for (const t of themes) lines.push(`• ${THEMES[t].label}: ${THEMES[t].hint}`);
  }
  if (resp.comment) {
    lines.push('');
    lines.push(assignee.role === 'hr' ? `Комментарий новичка: «${resp.comment}»` : 'Новичок оставил комментарий — он передан только HR.');
  }

  return {
    id, newcomerId: n.id, responseId: resp.id, createdAt: resp.at, deadline,
    assignee, title, description: lines.join('\n'), urgent: decision.urgent, themes,
    status: 'open', outcome: null, doneAt: null,
    sync: { state: 'pending' },
  };
}

export function manualTask(state, n, id, at, reason) {
  const unit = unitOf(state, n);
  const toHr = reason === 'silent';
  const assignee = toHr
    ? { role: 'hr', name: state.org.hr.name, bitrixId: state.org.hr.bitrixId }
    : { role: 'manager', name: unit.manager.name, bitrixId: unit.manager.bitrixId };
  const deadline = deadlineFrom(at, false);
  const title = toHr
    ? `Новичок ${shortName(n.name)} (${n.position.toLowerCase()}) не отвечает на опросы — позвонить`
    : `Новичок ${shortName(n.name)} (${n.position.toLowerCase()}): поговорить о том, как идут дела`;
  const description = [
    `Пульс новичка: задача создана вручную HR.`,
    `Сотрудник: ${n.name}, ${n.position}, ${unit.name}. Вышел(ла) ${fmtDate(n.hireDate)}.`,
    toHr ? 'Новичок перестал отвечать на короткие опросы. Молчание в первые недели часто означает, что человек уже ищет другую работу. Позвонить, спросить, как дела, без давления.' : 'Поговорить лично и записать итог в задаче.',
  ].join('\n');
  return { id, newcomerId: n.id, responseId: null, createdAt: at, deadline, assignee, title, description, urgent: false, themes: toHr ? ['silent'] : [], status: 'open', outcome: null, doneAt: null, sync: { state: 'pending' } };
}

// Тело запроса в Битрикс24 REST: метод tasks.task.add
export function bitrixPayload(state, task) {
  const fields = {
    TITLE: task.title,
    DESCRIPTION: task.description,
    RESPONSIBLE_ID: task.assignee.bitrixId,
    DEADLINE: `${task.deadline}T18:00:00+03:00`,
    PRIORITY: task.urgent ? 2 : 1,
    TAGS: ['Пульс новичка'],
  };
  if (task.assignee.role === 'manager') fields.AUDITORS = [state.org.hr.bitrixId];
  return { fields };
}

export const OUTCOMES = {
  stays: 'Поговорили, остаётся',
  fixed: 'Проблему устранили',
  watch: 'Поговорили, нужно наблюдать',
  leaving: 'Всё равно уходит',
};

// ---------- редьюсер: единственное место, где меняется состояние ----------
export function reduce(state, action) {
  const s = structuredClone(state);
  const nextId = (p) => `${p}${++s.seq}`;
  switch (action.type) {
    case 'submitSurvey': {
      const n = s.newcomers.find((x) => x.id === action.newcomerId);
      if (!n) throw new Error('Новичок не найден');
      const cp = cpByKey(action.cp);
      if (!cp) throw new Error('Неизвестная контрольная точка');
      if (s.responses.some((r) => r.newcomerId === n.id && r.cp === cp.key)) throw new Error('Этот опрос уже пройден');
      for (const qid of cp.questions) {
        const idx = action.answers?.[qid];
        if (!Number.isInteger(idx) || !QUESTIONS[qid].options[idx]) throw new Error(`Нет ответа на вопрос: ${QUESTIONS[qid].text}`);
      }
      const prev = responsesOf(s, n.id).filter((r) => cpByKey(r.cp).day < cp.day).pop() || null;
      const answers = Object.fromEntries(cp.questions.map((q) => [q, action.answers[q]]));
      const resp = { id: nextId('r'), newcomerId: n.id, cp: cp.key, answers, comment: (action.comment || '').trim().slice(0, 1000), wantHr: !!action.wantHr, at: action.at };
      s.responses.push(resp);
      const d = taskDecision(prev, resp);
      if (d.create) s.tasks.push(buildTask(s, n, resp, d, nextId('t')));
      return s;
    }
    case 'createTask': {
      const n = s.newcomers.find((x) => x.id === action.newcomerId);
      if (!n) throw new Error('Новичок не найден');
      if (s.tasks.some((t) => t.newcomerId === n.id && t.status === 'open')) throw new Error('По этому новичку уже есть открытая задача');
      s.tasks.push(manualTask(s, n, nextId('t'), action.at, action.reason));
      return s;
    }
    case 'completeTask': {
      const t = s.tasks.find((x) => x.id === action.taskId);
      if (!t) throw new Error('Задача не найдена');
      if (!OUTCOMES[action.outcome]) throw new Error('Укажите итог разговора');
      t.status = 'done'; t.outcome = action.outcome; t.note = (action.note || '').trim().slice(0, 500); t.doneAt = action.at;
      return s;
    }
    case 'taskSynced': {
      const t = s.tasks.find((x) => x.id === action.taskId);
      if (t) t.sync = action.sync;
      return s;
    }
    case 'addNewcomer': {
      const unit = s.org.units.find((u) => u.id === action.unitId);
      if (!unit) throw new Error('Подразделение не найдено');
      const name = (action.name || '').trim();
      if (name.split(/\s+/).length < 2) throw new Error('Укажите имя и фамилию');
      if (!action.position) throw new Error('Укажите должность');
      s.newcomers.push({ id: nextId('n'), token: action.token, name, position: action.position, unitId: unit.id, hireDate: action.hireDate, status: 'active', source: action.source || 'manual' });
      return s;
    }
    default:
      throw new Error(`Неизвестное действие ${action.type}`);
  }
}

// Данные, которые видит новичок по личной ссылке, — только свои.
export function surveyView(state, token, today) {
  const n = state.newcomers.find((x) => x.token === token && x.status === 'active');
  if (!n) return null;
  const cp = dueCheckpoint(state, n, today);
  const next = nextCheckpoint(n, today);
  return {
    newcomerId: n.id,
    firstName: firstName(n.name),
    day: dayNumber(n.hireDate, today),
    hrName: state.org.hr.name,
    hrPhone: state.org.hr.phone,
    checkpoint: cp ? { key: cp.key, day: cp.day, title: cp.title, questions: cp.questions.map((q) => ({ id: q, ...QUESTIONS[q] })) } : null,
    nextDay: next ? next.day : null,
  };
}
