// Синтетические данные: вымышленные люди, оргструктура похожа на компанию опт+розница спорттоваров (~400 человек).
// Генерация детерминированная (фиксированный seed) и привязана к сегодняшней дате, чтобы демо всегда было «живым».
import { CHECKPOINTS, reduce, addDays, dateStr, dayNumber } from './logic.js';

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export const ORG = {
  company: 'Спорттовары: опт и розница',
  headcount: 400,
  hr: { name: 'Ольга Смирнова', role: 'HR-менеджер', bitrixId: 12, phone: '+7 (900) 000-00-12' },
  units: [
    { id: 'wh-a', dept: 'Склад', name: 'Склад, смена А', manager: { name: 'Сергей Логинов', bitrixId: 41 }, positions: ['Кладовщик', 'Комплектовщик', 'Грузчик'] },
    { id: 'wh-b', dept: 'Склад', name: 'Склад, смена Б', manager: { name: 'Ринат Хасанов', bitrixId: 42 }, positions: ['Комплектовщик', 'Водитель-экспедитор', 'Кладовщик'] },
    { id: 'shop-1', dept: 'Магазины', name: 'Магазин №1 (центр)', manager: { name: 'Елена Воронина', bitrixId: 51 }, positions: ['Продавец-консультант', 'Кассир'] },
    { id: 'shop-2', dept: 'Магазины', name: 'Магазин №2 (ТЦ)', manager: { name: 'Андрей Белов', bitrixId: 52 }, positions: ['Продавец-консультант', 'Старший продавец'] },
    { id: 'shop-3', dept: 'Магазины', name: 'Магазин №3 (спальный район)', manager: { name: 'Наталья Крылова', bitrixId: 53 }, positions: ['Продавец-консультант', 'Кассир'] },
    { id: 'sales', dept: 'Отдел продаж', name: 'Оптовый отдел продаж', manager: { name: 'Игорь Тихонов', bitrixId: 61 }, positions: ['Менеджер по оптовым продажам'] },
    { id: 'office', dept: 'Офис', name: 'Офис', manager: { name: 'Марина Гусева', bitrixId: 71 }, positions: ['Бухгалтер', 'Контент-менеджер маркетплейсов', 'Специалист по закупкам'] },
  ],
};

const MALE = ['Иван', 'Алексей', 'Дмитрий', 'Артём', 'Никита', 'Максим', 'Егор', 'Кирилл', 'Роман', 'Тимур', 'Павел', 'Денис', 'Илья', 'Глеб'];
const FEMALE = ['Анна', 'Мария', 'Екатерина', 'Дарья', 'Алина', 'Полина', 'Ксения', 'Виктория', 'Юлия', 'Софья', 'Вероника'];
const SURNAMES = ['Кузнецов', 'Попов', 'Васильев', 'Соколов', 'Михайлов', 'Новиков', 'Фёдоров', 'Морозов', 'Волков', 'Алексеев', 'Лебедев', 'Семёнов', 'Егоров', 'Павлов', 'Козлов', 'Степанов', 'Николаев', 'Орлов', 'Андреев', 'Макаров', 'Никитин', 'Захаров', 'Зайцев', 'Сорокин', 'Ершов', 'Комаров'];

// [подразделение, сценарий, день работы сегодня, индекс должности, пол]
const PLAN = [
  ['wh-a', 'hero', 8, 1, 'm'],        // демо: опрос 7-го дня ждёт ответа
  ['wh-a', 'heavy', 23, 2, 'm'],
  ['wh-a', 'ok', 41, 0, 'm'],
  ['wh-a', 'silent', 19, 1, 'm'],
  ['wh-a', 'ok', 70, 0, 'f'],
  ['wh-b', 'expect_pay', 32, 0, 'm'],  // свежий красный сигнал, задача просрочена
  ['wh-b', 'ok', 12, 0, 'm'],
  ['wh-b', 'heavy', 58, 1, 'm'],
  ['wh-b', 'ok', 2, 1, 'f'],
  ['wh-b', 'tools', 9, 0, 'm'],        // сигнал → задача → исправили → зелёный
  ['shop-1', 'no_mentor', 9, 0, 'f'],
  ['shop-1', 'ok', 35, 1, 'f'],
  ['shop-1', 'ok', 5, 0, 'm'],
  ['shop-2', 'manager', 32, 0, 'f'],
  ['shop-2', 'ok', 27, 0, 'm'],
  ['shop-2', 'expect_pay', 62, 0, 'f'],
  ['shop-3', 'ok', 14, 0, 'f'],
  ['shop-3', 'no_mentor', 17, 1, 'f'],
  ['shop-3', 'ok', 86, 0, 'm'],
  ['shop-3', 'silent', 37, 0, 'f'],
  ['sales', 'ok', 29, 0, 'm'],
  ['sales', 'expect_pay', 44, 0, 'm'],
  ['sales', 'ok', 1, 0, 'f'],
  ['office', 'ok', 52, 1, 'f'],
  ['office', 'ok', 18, 2, 'm'],
  ['office', 'no_mentor', 75, 0, 'f'],
];

// Ответы по сценариям: { точка: { вопрос: индекс варианта } }. Всё, что не указано, — норма с небольшим шумом.
const SCRIPTS = {
  heavy: { d7: { schedule: 1, mood: 2 }, d14: { mood: 3 }, d30: { manager: 1, stay: 1, mood: 2 }, d60: { schedule: 2, stay: 2, mood: 3 } },
  expect_pay: { d3: { expect: 1, mood: 1 }, d7: { mood: 1 }, d30: { pay: 3, stay: 1, mood: 3 }, d60: { pay: 2, stay: 2, mood: 3 } },
  no_mentor: { d3: { welcome: 1, mood: 2 }, d7: { mentor: 2, mood: 2 }, d14: { clarity: 1, team: 1, mood: 2 }, d30: { mood: 1 } },
  manager: { d14: { team: 1, mood: 1 }, d30: { manager: 2, stay: 1, mood: 2 } },
  tools: { d3: { tools: 2, mood: 2 } },
  silent: { d3: { expect: 1, mood: 2 } },
  hero: { d3: { mood: 1 } },
};
const COMMENTS = {
  'expect_pay:d30': 'На собеседовании говорили 55 на руки, пришло 38. Никто не объяснил почему.',
  'expect_pay:d60': 'Опять меньше, чем договаривались. Смотрю вакансии.',
  'heavy:d14': 'Каждую смену ставят на разгрузку фур, спина отваливается.',
  'heavy:d60': 'Сезон, переработки каждый день. Долго так не смогу.',
  'no_mentor:d7': 'Спрашиваю у кого получится, все заняты. Про кроссовки и размеры разбираюсь по интернету.',
  'manager:d30': 'Руководитель за месяц со мной ни разу нормально не поговорил, только замечания при покупателях.',
  'tools:d3': 'Третий день без сканера и без формы, работаю в своей одежде.',
};
const WANT_HR = new Set(['manager:d30']);
const KEEP_OPEN = new Set([5]); // индексы PLAN, где руководитель не отработал задачу (просрочена)
const OUTCOME_BY = { heavy: 'watch', expect_pay: 'watch', no_mentor: 'fixed', manager: 'stays', tools: 'fixed' };
const NOTES = {
  heavy: 'Перевёл на комплектацию на 2 недели, дальше чередуем.',
  expect_pay: 'Разобрали расчётку: удержали за форму и не было ночных. Обещали пересчитать с 1-го числа.',
  no_mentor: 'Закрепили наставника — старшего продавца.',
  manager: 'Поговорила с новичком и с руководителем, договорились о встрече 1-на-1 раз в неделю.',
  tools: 'Выдали форму и сканер на следующий день.',
};

function scriptedAnswer(arch, cpKey, qid, r) {
  const v = SCRIPTS[arch]?.[cpKey]?.[qid];
  if (v != null) return v;
  if (qid === 'mood') return r() < 0.6 ? 0 : 1;
  if (qid === 'pay') return cpKey === 'd30' && r() < 0.3 ? 1 : 0; // «ещё не получал» — тоже норма
  if (qid === 'schedule' && arch === 'ok') return r() < 0.15 ? 1 : 0;
  return 0;
}

const stamp = (date, h, m) => `${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;

export function makeSeed(now = new Date(), seed = 20261111) {
  const r = rng(seed);
  const today = dateStr(now);
  const token = () => Array.from({ length: 12 }, () => 'abcdefghjkmnpqrstuvwxyz23456789'[Math.floor(r() * 31)]).join('');
  const used = new Set();
  const pickName = (g) => {
    for (;;) {
      const first = (g === 'f' ? FEMALE : MALE)[Math.floor(r() * (g === 'f' ? FEMALE : MALE).length)];
      const sur = SURNAMES[Math.floor(r() * SURNAMES.length)];
      const name = `${first} ${g === 'f' ? `${sur}а` : sur}`;
      if (!used.has(name)) { used.add(name); return name; }
    }
  };

  let state = { version: 1, seq: 0, org: structuredClone(ORG), newcomers: [], responses: [], tasks: [] };
  const events = [];
  PLAN.forEach(([unitId, arch, day, posIdx, g], i) => {
    const unit = ORG.units.find((u) => u.id === unitId);
    const hireDate = addDays(today, -(day - 1));
    state = reduce(state, { type: 'addNewcomer', unitId, name: pickName(g), position: unit.positions[posIdx], hireDate, token: token(), source: 'bitrix' });
    const n = state.newcomers[state.newcomers.length - 1];
    for (const cp of CHECKPOINTS) {
      if (cp.day > day) break;
      if (arch === 'silent' && cp.key !== 'd3') continue;
      if (arch === 'hero' && cp.key === 'd7') continue;
      const date = addDays(hireDate, cp.day - 1 + (r() < 0.6 ? 0 : 1));
      if (date >= today) continue; // сегодняшний опрос ещё «висит»
      const answers = Object.fromEntries(cp.questions.map((q) => [q, scriptedAnswer(arch === 'hero' ? 'ok' : arch, cp.key, q, r)]));
      if (arch === 'hero' && cp.key === 'd3') answers.mood = 1;
      const key = `${arch}:${cp.key}`;
      events.push({ i, arch, at: stamp(date, 18 + Math.floor(r() * 4), Math.floor(r() * 60)), action: { type: 'submitSurvey', newcomerId: n.id, cp: cp.key, answers, comment: COMMENTS[key] || '', wantHr: WANT_HR.has(key) } });
    }
  });

  events.sort((a, b) => a.at.localeCompare(b.at));
  for (const e of events) {
    const before = state.tasks.length;
    state = reduce(state, { ...e.action, at: e.at });
    if (state.tasks.length > before) state.tasks[state.tasks.length - 1].seedMeta = { i: e.i, arch: e.arch };
  }

  // Задачи старше 3 дней считаем отработанными (кроме намеренно «забытой»), свежие — открыты.
  for (const t of state.tasks) {
    t.sync = { state: 'ok', mode: 'demo' };
    const { i, arch } = t.seedMeta || {};
    delete t.seedMeta;
    const ageDays = dayNumber(t.createdAt, today) - 1;
    if (ageDays >= 4 && !KEEP_OPEN.has(i)) {
      t.status = 'done';
      t.outcome = OUTCOME_BY[arch] || 'stays';
      t.note = NOTES[arch] || '';
      t.doneAt = stamp(addDays(t.createdAt, 1), 12, 30);
    }
  }
  state.seededAt = today;
  return state;
}
