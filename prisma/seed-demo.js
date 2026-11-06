/**
 * Presentation demo seed: 50 users, 100 tickets, 29 extra knowledge-base articles.
 *
 *   node prisma/seed-demo.js              preview only (no database connection)
 *   node prisma/seed-demo.js --apply      write to the database in DATABASE_URL
 *   node prisma/seed-demo.js --apply --reset
 *                                         first delete the tickets created by this
 *                                         script (TKT-DEMO-*), then recreate them
 *                                         with fresh dates
 *
 * Safe to re-run. Demo users are refreshed on every run (password restored, account
 * unlocked). Tickets already present are skipped unless --reset is given.
 *
 * Requires roles to exist: run `node prisma/seed.js` first on a fresh database.
 *
 * LOGIN PATTERN   <role><NN>@example.com      e.g. tech03@example.com
 * PASSWORD        <Role>@123                  e.g. Tech@123
 * DEMO ONLY: these passwords are intentionally simple. Never use them on a real system.
 */
const { TICKETS, POOLS, LOCATIONS } = require('./demo-data/tickets');
const { KB_ARTICLES } = require('./demo-data/kb-articles');

// ----------------------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------------------
const DOMAIN = 'example.com'; // reserved by IANA, can never receive real mail
const TICKET_PREFIX = 'TKT-DEMO-';
const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,100}$/; // same as auth.validator.js

const ROLE_PLAN = [
  { role: 'super_admin', prefix: 'super', count: 1, password: 'Super@123' },
  { role: 'it_manager', prefix: 'manager', count: 2, password: 'Manager@123' },
  { role: 'it_admin', prefix: 'admin', count: 3, password: 'Admin@123' },
  { role: 'it_technician', prefix: 'tech', count: 9, password: 'Tech@123' },
  { role: 'end_user', prefix: 'user', count: 35, password: 'User@123' },
];

const DEPARTMENTS = {
  IT: 'Information Technology', HR: 'Human Resources', FIN: 'Finance',
  OPS: 'Operations', ADM: 'Administration', LIB: 'Library Services',
};
const END_USER_DEPTS = ['HR', 'FIN', 'OPS', 'ADM', 'LIB'];

// 50 fictional names, in the order: super, managers, admins, technicians, end users
const NAMES = [
  ['Kwabena', 'Adjei'],
  ['Akua', 'Danso'], ['Kwadwo', 'Peprah'],
  ['Efia', 'Gyasi'], ['Yaw', 'Tetteh'], ['Adwoa', 'Quartey'],
  ['Kojo', 'Baidoo'], ['Afia', 'Sackey'], ['Kwesi', 'Lamptey'], ['Yaa', 'Ntim'], ['Fiifi', 'Ankrah'],
  ['Maame', 'Dankwa'], ['Nii', 'Armah'], ['Selina', 'Bempah'], ['Ebo', 'Wiredu'],
  ['Ruth', 'Fosu'], ['Isaac', 'Badu'], ['Gifty', 'Awuah'], ['Emmanuel', 'Asiedu'], ['Mavis', 'Brobbey'],
  ['Richard', 'Yeboah'], ['Joyce', 'Twumasi'], ['Benjamin', 'Oduro'], ['Comfort', 'Kyei'], ['Daniel', 'Manu'],
  ['Vivian', 'Okyere'], ['Prince', 'Sarfo'], ['Abigail', 'Tawiah'], ['Collins', 'Duah'], ['Lydia', 'Ampofo'],
  ['Stephen', 'Osei'], ['Rita', 'Nyame'], ['Francis', 'Gyamfi'], ['Dorcas', 'Agyei'], ['Eric', 'Quaye'],
  ['Janet', 'Ofosu'], ['Alex', 'Boadu'], ['Mercy', 'Annan'], ['Kelvin', 'Dwomoh'], ['Charity', 'Akoto'],
  ['Desmond', 'Larbi'], ['Josephine', 'Antwi'], ['Raymond', 'Kumi'], ['Gloria', 'Bekoe'], ['Patrick', 'Ayim'],
  ['Sandra', 'Boamah'], ['Jerry', 'Nti'], ['Esther', 'Mintah'], ['Ernest', 'Fordjour'], ['Beatrice', 'Amankwah'],
];

const SLA = { P1_CRITICAL: [15, 240], P2_HIGH: [60, 480], P3_MEDIUM: [240, 1440], P4_LOW: [480, 4320] };

// Which technicians (index within the 9 technicians) usually work each category
const CATEGORY_TECHS = {
  NETWORK_CONNECTIVITY: [0, 1], HARDWARE_ISSUES: [2, 3], SOFTWARE_APPLICATION: [4, 5],
  ACCOUNT_ACCESS_IDENTITY: [6, 7], PRINTING_PROBLEMS: [8, 3], PRODUCTION_SYSTEMS: [0, 4, 8],
};

// ----------------------------------------------------------------------------
// Small deterministic helpers (same data on every run, apart from "now")
// ----------------------------------------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pad = (n, w = 2) => String(n).padStart(w, '0');
const addMin = (d, m) => new Date(d.getTime() + Math.round(m) * 60000);

// ----------------------------------------------------------------------------
// Users
// ----------------------------------------------------------------------------
function buildUsers() {
  const override = process.env.ITSM_DEMO_PASSWORD; // optional: one password for everyone
  if (override && !PASSWORD_RULE.test(override)) {
    throw new Error('ITSM_DEMO_PASSWORD must be 8+ chars with upper, lower, a digit and one of @$!%*?&');
  }
  const users = [];
  let n = 0;
  for (const plan of ROLE_PLAN) {
    for (let i = 1; i <= plan.count; i++) {
      const [firstName, lastName] = NAMES[n];
      users.push({
        email: `${plan.prefix}${pad(i)}@${DOMAIN}`,
        password: override || plan.password,
        firstName, lastName,
        role: plan.role,
        dept: plan.role === 'end_user' ? END_USER_DEPTS[(i - 1) % END_USER_DEPTS.length] : 'IT',
        employeeId: `EMP-D${pad(n + 1, 3)}`,
      });
      n++;
    }
  }
  for (const u of users) {
    if (!PASSWORD_RULE.test(u.password)) throw new Error(`Password for ${u.email} breaks the password policy`);
  }
  return users;
}

// ----------------------------------------------------------------------------
// Knowledge base (plan only: authors and ids are resolved when applying)
// ----------------------------------------------------------------------------
const KB_BY_TICKET_CATEGORY = {};
for (const a of KB_ARTICLES) {
  if (a.tc && a.status === 'PUBLISHED' && a.isPublic) (KB_BY_TICKET_CATEGORY[a.tc] ||= []).push(a);
}

function buildKbExtras(users, rand) {
  const byRole = (r) => users.filter((u) => u.role === r);
  const techs = byRole('it_technician');
  const admins = byRole('it_admin');
  const managers = byRole('it_manager');
  const endUsers = byRole('end_user');
  const authorFor = (a) => {
    if (a.author === 'manager') return managers[a.n % managers.length];
    if (a.author === 'admin') return admins[a.n % admins.length];
    return techs[a.n % techs.length];
  };
  const weights = [[1, 0.03], [2, 0.05], [3, 0.12], [4, 0.35], [5, 0.45]];
  const pickRating = () => {
    let r = rand(), acc = 0;
    for (const [v, w] of weights) { acc += w; if (r < acc) return v; }
    return 5;
  };
  const good = ['Clear and easy to follow.', 'Fixed my problem in minutes.', 'Very helpful, thank you.', 'Saved me a call to IT.'];
  const bad = ['Did not solve my problem.', 'Needs more detail on the steps.', 'Out of date for my device.'];

  return KB_ARTICLES.map((a) => {
    const published = a.status === 'PUBLISHED' && a.isPublic;
    const ratings = [];
    if (published) {
      const k = 4 + Math.floor(rand() * 9); // 4..12 ratings
      const pool = [...endUsers].sort(() => rand() - 0.5).slice(0, k);
      for (const u of pool) {
        const rating = pickRating();
        const feedback = rand() < 0.25 ? (rating >= 3 ? good : bad)[Math.floor(rand() * (rating >= 3 ? good : bad).length)] : null;
        ratings.push({ email: u.email, rating, feedback });
      }
    }
    return {
      ...a,
      authorEmail: authorFor(a).email,
      viewCount: a.status === 'PUBLISHED' ? 60 + Math.floor(rand() * 840) : 0,
      ratings,
    };
  });
}

// ----------------------------------------------------------------------------
// Tickets
// ----------------------------------------------------------------------------
function buildTickets(users, now, rand) {
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const rint = (a, b) => a + Math.floor(rand() * (b - a + 1));
  const techs = users.filter((u) => u.role === 'it_technician');
  const endUsers = users.filter((u) => u.role === 'end_user');
  const escalators = users.filter((u) => u.role === 'it_manager' || u.role === 'it_admin');
  const managers = users.filter((u) => u.role === 'it_manager');
  const assigners = users.filter((u) => u.role === 'it_admin');

  // Status mix for the 100 tickets. P1 tickets get a fixed, believable set first.
  const p1Statuses = ['ESCALATED', 'ESCALATED', 'ESCALATED', 'IN_PROGRESS', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CLOSED'];
  const rest = [];
  const add = (s, n) => { for (let i = 0; i < n; i++) rest.push(s); };
  add('OPEN', 10); add('ASSIGNED', 12); add('IN_PROGRESS', 16); add('PENDING', 8);
  add('ESCALATED', 4); add('RESOLVED', 19); add('CLOSED', 23);
  rest.sort(() => rand() - 0.5);
  let p1i = 0;

  const creatorsCycle = [...endUsers].sort(() => rand() - 0.5);
  let cyc = 0;
  const catCounter = {};
  const out = [];

  TICKETS.forEach((t, i) => {
    const status = t.priority === 'P1_CRITICAL' ? p1Statuses[p1i++ % p1Statuses.length] : rest.pop();
    const [respMin, resMin] = SLA[t.priority];

    // people
    const creator = t.staff ? techs[(i * 5 + 3) % techs.length] : creatorsCycle[cyc++ % creatorsCycle.length];
    const idx = (catCounter[t.category] = (catCounter[t.category] ?? -1) + 1);
    const candidates = CATEGORY_TECHS[t.category].map((k) => techs[k]).filter((u) => u.email !== creator.email);
    const tech = candidates[idx % candidates.length];
    const escalator = escalators[i % escalators.length];
    const assigned = status !== 'OPEN';
    const active = !['RESOLVED', 'CLOSED'].includes(status);

    // timeline
    const respLate = assigned && rand() < 0.08;
    const assignDelay = respLate ? respMin * (1.1 + 0.8 * rand()) : respMin * (0.05 + 0.7 * rand());
    const startDelay = 2 + rand() * Math.max(3, respMin * 0.6);
    const steps = !assigned ? [] : {
      ASSIGNED: [], IN_PROGRESS: ['IN_PROGRESS'], PENDING: ['IN_PROGRESS', 'PENDING'],
      ESCALATED: ['IN_PROGRESS', 'ESCALATED'],
    }[status] || (() => {
      const s = ['IN_PROGRESS'];
      if (rand() < 0.3) s.push('PENDING', 'IN_PROGRESS');
      if (rand() < 0.15) s.push('ESCALATED', 'IN_PROGRESS');
      s.push('RESOLVED');
      if (status === 'CLOSED') s.push('CLOSED');
      return s;
    })();

    let ageMin, resolveDur = 0, closeLag = 0;
    if (!assigned) {
      ageMin = respMin * (0.1 + 0.8 * rand());
    } else if (active) {
      const breach = rand() < 0.2;
      ageMin = resMin * (breach ? 1.05 + 0.9 * rand() : 0.15 + 0.7 * rand());
      ageMin = Math.max(ageMin, assignDelay + startDelay + (steps.length + 1) * 5);
    } else {
      const late = rand() < 0.12;
      resolveDur = Math.max(resMin * (late ? 1.1 + 0.7 * rand() : 0.2 + 0.7 * rand()), assignDelay + startDelay + 60);
      closeLag = status === 'CLOSED' ? 30 + rand() * 2000 : 0;
      ageMin = resolveDur + closeLag + 60 + rand() * 25 * 1440;
    }

    const openedAt = addMin(now, -ageMin);
    const assignedAt = assigned ? addMin(openedAt, assignDelay) : null;
    const firstStepAt = assigned ? addMin(assignedAt, startDelay) : null;
    // End of the "core" workflow: now (still active) or the moment of resolution.
    const coreEndAt = !assigned ? null : active ? addMin(now, -3) : addMin(openedAt, resolveDur);

    // history + step times (spread evenly between first step and end)
    const history = [{ by: creator.email, field: 'status', old: null, neu: 'OPEN', action: 'CREATED', note: null, at: openedAt }];
    let prev = 'OPEN';
    if (assigned) {
      const manual = rand() < 0.25;
      history.push({
        by: manual ? pick(assigners).email : tech.email, field: 'assigneeId', old: null, neu: '@tech',
        action: 'ASSIGNED', note: manual ? 'Assigned manually by an administrator' : 'Auto-routed by workload balancing', at: assignedAt,
      });
      prev = 'ASSIGNED';
    }
    const stepTimes = [];
    const core = steps.filter((s) => s !== 'CLOSED'); // CLOSED happens after resolution
    steps.forEach((s, k) => {
      const t0 = s === 'CLOSED'
        ? addMin(openedAt, resolveDur + closeLag)
        : k === 0 ? firstStepAt
          : addMin(firstStepAt, ((coreEndAt - firstStepAt) / 60000) * (k / (core.length - 1 || 1)));
      stepTimes.push(t0);
      const by = s === 'ESCALATED' ? escalator.email : tech.email;
      const note = {
        IN_PROGRESS: prev === 'PENDING' || prev === 'ESCALATED' ? 'Work resumed' : 'Investigation started',
        PENDING: pick(POOLS.pending), ESCALATED: pick(POOLS.escalate),
        RESOLVED: 'Solution applied and confirmed', CLOSED: 'Closed after confirmation',
      }[s];
      history.push({ by, field: 'status', old: prev, neu: s, action: s, note, at: t0 });
      prev = s;
    });
    const timeOf = (s) => { const k = steps.lastIndexOf(s); return k >= 0 ? stepTimes[k] : null; };
    const resolvedAt = timeOf('RESOLVED');
    const closedAt = timeOf('CLOSED');
    const escalatedAt = timeOf('ESCALATED');
    const lastAt = history[history.length - 1].at;

    // SLA flags
    const responseDue = addMin(openedAt, respMin);
    const resolutionDue = addMin(openedAt, resMin);
    const slaResponseMet = assigned ? assignedAt <= responseDue : null;
    const slaResolutionMet = resolvedAt ? resolvedAt <= resolutionDue : null;
    const breached = slaResponseMet === false || slaResolutionMet === false || (active && now > resolutionDue);

    // comments
    const comments = [];
    const cat = t.category;
    if (assigned) {
      const triageAt = addMin(assignedAt, 2 + rand() * 8);
      comments.push({ by: tech.email, internal: false, text: pick(POOLS.triage[cat]), at: triageAt });
      if (rand() < 0.5) comments.push({ by: creator.email, internal: false, text: pick(POOLS.userReply), at: addMin(triageAt, 10 + rand() * 80) });
      if (steps.length && rand() < 0.4) comments.push({ by: tech.email, internal: true, text: pick(POOLS.internal), at: addMin(firstStepAt, 3) });
    }
    if (steps.includes('PENDING')) comments.push({ by: tech.email, internal: false, text: pick(POOLS.pending), at: timeOf('PENDING') });
    if (steps.includes('ESCALATED')) {
      comments.push({ by: escalator.email, internal: true, text: pick(POOLS.manager), at: addMin(timeOf('ESCALATED'), 6) });
    }
    if (resolvedAt) comments.push({ by: tech.email, internal: false, text: pick(POOLS.resolution[cat]), at: addMin(resolvedAt, -1) });
    if (closedAt && rand() < 0.4) comments.push({ by: creator.email, internal: false, text: pick(POOLS.thanks), at: addMin(resolvedAt, 10 + rand() * 120) });
    const latest = addMin(now, -1); // never place a comment in the future
    for (const c of comments) if (c.at > latest) c.at = latest;
    comments.sort((a, b) => a.at - b.at);

    // knowledge-base link for solved tickets
    let kbN = null;
    if (resolvedAt && rand() < 0.55 && KB_BY_TICKET_CATEGORY[cat]) kbN = pick(KB_BY_TICKET_CATEGORY[cat]).n;

    const loc = pick(LOCATIONS[creator.dept]);
    const description = [
      t.symptom, '',
      `Location: ${loc}`,
      `Reported by: ${creator.firstName} ${creator.lastName}`,
      `Already tried: ${pick(POOLS.tried)}`,
    ].join('\n');

    out.push({
      ticketNumber: `${TICKET_PREFIX}${pad(i + 1, 3)}`,
      title: t.title, description, status, priority: t.priority, category: cat,
      impact: pick(POOLS.impact[t.priority]), urgency: POOLS.urgency[t.priority],
      source: pick(POOLS.sources),
      tags: [cat.toLowerCase().replace(/_/g, '-')],
      creatorEmail: creator.email, assigneeEmail: assigned ? tech.email : null, dept: creator.dept,
      openedAt, assignedAt, resolvedAt, closedAt, escalatedAt,
      lastActivityAt: lastAt,
      firstResponseAt: assignedAt,
      slaResponseDue: responseDue, slaResolutionDue: resolutionDue,
      slaResponseMet, slaResolutionMet, slaBreached: breached,
      history,
      comments, kbN,
      techEmail: tech.email,
    });
  });
  return out;
}

// ----------------------------------------------------------------------------
// Plan summary (no database)
// ----------------------------------------------------------------------------
function tally(list, key) {
  const m = {};
  for (const x of list) m[x[key]] = (m[x[key]] || 0) + 1;
  return m;
}

function buildAll(now = new Date()) {
  const rand = mulberry32(20260511);
  const users = buildUsers();
  const kb = buildKbExtras(users, rand);
  const tickets = buildTickets(users, now, rand);
  return { users, kb, tickets };
}

function printPlan({ users, kb, tickets }) {
  const creatorRole = {};
  const byEmail = Object.fromEntries(users.map((u) => [u.email, u]));
  for (const t of tickets) { const r = byEmail[t.creatorEmail].role; creatorRole[r] = (creatorRole[r] || 0) + 1; }
  console.log(JSON.stringify({
    mode: 'preview only, nothing written. Add --apply to write to the database.',
    users: { total: users.length, byRole: tally(users, 'role') },
    loginPattern: `<role><NN>@${DOMAIN}`,
    passwords: Object.fromEntries(ROLE_PLAN.map((p) => [p.prefix + 'NN', process.env.ITSM_DEMO_PASSWORD ? '(ITSM_DEMO_PASSWORD)' : p.password])),
    tickets: {
      total: tickets.length, byStatus: tally(tickets, 'status'), byPriority: tally(tickets, 'priority'),
      byCategory: tally(tickets, 'category'), createdByRole: creatorRole,
      slaBreached: tickets.filter((t) => t.slaBreached).length,
    },
    knowledgeBase: {
      extraArticles: kb.length, byStatus: tally(kb, 'status'), internalOnly: kb.filter((a) => !a.isPublic).length,
      ratings: kb.reduce((s, a) => s + a.ratings.length, 0),
    },
  }, null, 2));
}

// ----------------------------------------------------------------------------
// Apply
// ----------------------------------------------------------------------------
function describeTarget() {
  try {
    const u = new URL(process.env.DATABASE_URL);
    return `${u.hostname}${u.port ? ':' + u.port : ''}${u.pathname}`;
  } catch { return '(unparseable DATABASE_URL)'; }
}

async function apply({ reset }) {
  require('dotenv').config();
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  const { PrismaClient } = require('@prisma/client');
  const bcrypt = require('bcryptjs');
  const prisma = new PrismaClient({ transactionOptions: { maxWait: 20000, timeout: 60000 } });
  const now = new Date();
  const { users, kb, tickets } = buildAll(now);
  const rounds = parseInt(process.env.BCRYPT_ROUNDS, 10) || 12;
  const stats = { users: 0, articles: 0, ratings: 0, tickets: 0, skippedTickets: 0, deletedTickets: 0 };

  console.log(`Target database: ${describeTarget()}`);
  try {
    // roles
    const roles = Object.fromEntries((await prisma.role.findMany()).map((r) => [r.name, r.id]));
    for (const p of ROLE_PLAN) if (!roles[p.role]) throw new Error(`Role "${p.role}" is missing. Run: node prisma/seed.js`);

    // departments (match by code, then by name, to avoid unique-name clashes)
    const deptId = {};
    for (const [code, name] of Object.entries(DEPARTMENTS)) {
      const found = await prisma.department.findFirst({ where: { OR: [{ code }, { name }] } });
      deptId[code] = (found || await prisma.department.create({ data: { code, name, description: `${name} department` } })).id;
    }

    // users: one bcrypt hash per distinct password
    const hashes = {};
    const userId = {};
    for (const [i, u] of users.entries()) {
      hashes[u.password] ||= await bcrypt.hash(u.password, rounds);
      const base = {
        password: hashes[u.password], firstName: u.firstName, lastName: u.lastName,
        status: 'ACTIVE', emailVerified: true, failedLoginAttempts: 0, lockedUntil: null,
        roleId: roles[u.role], departmentId: deptId[u.dept],
      };
      const seen = i % 6 === 5 ? null : addMin(now, -(30 + ((i * 97) % 4000)));
      const rec = await prisma.user.upsert({
        where: { email: u.email },
        update: base,
        create: { email: u.email, employeeId: u.employeeId, lastLoginAt: seen, lastActiveAt: seen, ...base },
      });
      userId[u.email] = rec.id;
      stats.users++;
    }

    // knowledge base
    for (const a of kb) {
      const fields = {
        title: a.title, summary: a.summary, content: a.content, category: a.category, tags: a.tags,
        status: a.status, isPublic: a.isPublic, deletedAt: null, authorId: userId[a.authorEmail],
      };
      await prisma.knowledgeArticle.upsert({
        where: { id: a.id }, update: fields, create: { id: a.id, viewCount: a.viewCount, ...fields },
      });
      stats.articles++;
      if (a.ratings.length) {
        const res = await prisma.articleRating.createMany({
          data: a.ratings.map((r) => ({ articleId: a.id, userId: userId[r.email], rating: r.rating, feedback: r.feedback })),
          skipDuplicates: true,
        });
        stats.ratings += res.count;
        // same rule as kb.service.js: 3 and above is helpful
        const helpfulCount = await prisma.articleRating.count({ where: { articleId: a.id, rating: { gte: 3 } } });
        const notHelpfulCount = await prisma.articleRating.count({ where: { articleId: a.id, rating: { lt: 3 } } });
        await prisma.knowledgeArticle.update({ where: { id: a.id }, data: { helpfulCount, notHelpfulCount } });
      }
    }

    // tickets
    if (reset) {
      const old = await prisma.ticket.findMany({ where: { ticketNumber: { startsWith: TICKET_PREFIX } }, select: { id: true } });
      const ids = old.map((t) => t.id);
      if (ids.length) {
        await prisma.notification.deleteMany({ where: { ticketId: { in: ids } } });
        const del = await prisma.ticket.deleteMany({ where: { id: { in: ids } } }); // comments, history, KB links cascade
        stats.deletedTickets = del.count;
      }
    }
    const kbIdByN = Object.fromEntries(kb.map((a) => [a.n, a.id]));
    for (const t of tickets) {
      const exists = await prisma.ticket.findUnique({ where: { ticketNumber: t.ticketNumber }, select: { id: true } });
      if (exists) { stats.skippedTickets++; continue; }
      await prisma.$transaction(async (tx) => {
        const created = await tx.ticket.create({
          data: {
            ticketNumber: t.ticketNumber, title: t.title, description: t.description,
            status: t.status, priority: t.priority, category: t.category,
            impact: t.impact, urgency: t.urgency, source: t.source, tags: t.tags,
            slaResponseDue: t.slaResponseDue, slaResolutionDue: t.slaResolutionDue,
            slaResponseMet: t.slaResponseMet, slaResolutionMet: t.slaResolutionMet, slaBreached: t.slaBreached,
            firstResponseAt: t.firstResponseAt, openedAt: t.openedAt, assignedAt: t.assignedAt,
            resolvedAt: t.resolvedAt, closedAt: t.closedAt, escalatedAt: t.escalatedAt,
            lastActivityAt: t.lastActivityAt, createdAt: t.openedAt, updatedAt: t.lastActivityAt,
            creatorId: userId[t.creatorEmail], assigneeId: t.assigneeEmail ? userId[t.assigneeEmail] : null,
            departmentId: deptId[t.dept],
          },
        });
        await tx.ticketHistory.createMany({
          data: t.history.map((h) => ({
            ticketId: created.id, changedById: userId[h.by], field: h.field, oldValue: h.old,
            newValue: h.neu === '@tech' ? userId[t.techEmail] : h.neu, action: h.action, note: h.note, createdAt: h.at,
          })),
        });
        if (t.comments.length) {
          await tx.ticketComment.createMany({
            data: t.comments.map((c) => ({
              ticketId: created.id, authorId: userId[c.by], content: c.text, isInternal: c.internal, createdAt: c.at, updatedAt: c.at,
            })),
          });
        }
        if (t.kbN) await tx.knowledgeArticleTicket.createMany({ data: [{ articleId: kbIdByN[t.kbN], ticketId: created.id }], skipDuplicates: true });
      });
      stats.tickets++;
    }
    console.log(JSON.stringify({ applied: true, ...stats }, null, 2));
    console.log('\nLogin pattern:  <role><NN>@' + DOMAIN + '   (super01, manager01-02, admin01-03, tech01-09, user01-35)');
    console.log('Password:       <Role>@123   (Super@123, Manager@123, Admin@123, Tech@123, User@123)');
  } finally {
    await prisma.$disconnect();
  }
}

// ----------------------------------------------------------------------------
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--apply')) {
    apply({ reset: args.includes('--reset') }).catch((e) => { console.error('Demo seed failed:', e.message); process.exitCode = 1; });
  } else {
    printPlan(buildAll());
  }
}

module.exports = { buildAll, buildUsers, apply, PASSWORD_RULE, TICKET_PREFIX };
