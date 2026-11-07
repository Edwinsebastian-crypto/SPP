'use strict';
// Unit test of the Home screen data: fake repositories, no database, no network.
const assert = require('assert');
const HomeService = require('../src/services/home.service');

let passed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log('  ✔', name); } catch (err) { console.error('  ✘', name, '\n   ', err.message); process.exitCode = 1; }
}

const NOW = new Date(2026, 9, 30, 10, 0, 0); // 30 Oct 2026, 10:00 local
const practice = {
  id: 'PRA-1', status: 'active', typeName: 'Observation', requiredHours: 100, startDate: '2026-09-01', endDate: '2026-11-05',
  studentName: 'Ana Perez', studentDocument: 'S1', tutorName: 'Luis Gomez', tutorDocument: 'T1', advisorName: 'Marta Diaz', advisorDocument: 'A1',
  institutionName: 'School X', finalGrade: '0.00'
};
const activities = [
  { id: 'A1', practiceId: 'PRA-1', number: 1, title: 'Activity', grade: '4.5', evidenceCount: 1, feedbackCount: 1, hours: 40, dueDate: null },
  { id: 'A2', practiceId: 'PRA-1', number: 2, title: 'Lesson plan', grade: '0', evidenceCount: 1, feedbackCount: 0, hours: 10, dueDate: '2026-11-02 08:00:00+00' },
  { id: 'A3', practiceId: 'PRA-1', number: 3, title: 'Activity', grade: null, evidenceCount: 0, feedbackCount: 0, hours: 0, dueDate: '2026-10-28 08:00:00+00' },
  { id: 'A4', practiceId: 'PRA-1', number: 4, title: 'Activity', grade: null, evidenceCount: 1, feedbackCount: 1, hours: 5, dueDate: null }
];
const feedbackBy = {
  A1: [{ role: 'tutor', text: 'Great', date: '2026-10-20', evidenceId: 'E1' }],
  A2: [],
  A4: [{ role: 'tutor', text: 'Ok', date: '2026-10-25', evidenceId: 'E4' }, { role: 'advisor', text: 'Nice', date: '2026-10-26', evidenceId: 'E4' }]
};

function build(overrides = {}) {
  return new HomeService({
    practiceRepository: { list: async (f = {}) => (f.studentDocument === 'NONE' ? [] : [practice]) },
    activityRepository: { listByPractice: async () => activities },
    feedbackRepository: { listByActivity: async (id) => feedbackBy[id] || [] },
    userRepository: { list: async (f = {}) => (f.status === 'pending'
      ? [{ documentNumber: 'P1', firstName: 'New', lastName: 'User', role: 'student', email: 'n@x.co' }]
      : [{ documentNumber: 'S1' }, { documentNumber: 'S2' }]) },
    indicatorRepository: { summary: async () => ({ practices: 1, activePractices: 1, students: 2, tutors: 1, advisors: 1, institutions: 1, averageGrade: 4.5 }) },
    auditService: { list: async () => [{ user: { fullName: 'Dir X', role: 'director' }, entity: 'practice', action: 'insert', date: NOW }] },
    now: () => NOW,
    ...overrides
  });
}

(async () => {
  console.log('# home');
  await test('student: hours, status counts, deadlines and feedback', async () => {
    const h = await build().build({ role: 'student', documentNumber: 'S1' });
    assert.equal(h.practice.workedHours, 55);
    assert.equal(h.practice.progressPct, 55);
    assert.equal(h.practice.daysLeft, 6);
    assert.deepEqual([h.activities.graded, h.activities.review, h.activities.pending, h.activities.completed], [1, 1, 1, 1]);
    assert.equal(h.activities.averageGrade, 4.5);
    assert.equal(h.upcoming.length, 1);
    assert.equal(h.upcoming[0].activityId, 'A3');
    assert.equal(h.upcoming[0].overdue, true);
    assert.equal(h.recentFeedback[0].text, 'Nice');
  });
  await test('student without practice', async () => {
    const h = await build({ practiceRepository: { list: async () => [] } }).build({ role: 'student', documentNumber: 'NONE' });
    assert.equal(h.practice, null);
  });
  await test('tutor: review queue, totals and student cards', async () => {
    const h = await build().build({ role: 'tutor', documentNumber: 'T1' });
    assert.equal(h.totals.pendingReview, 1);
    assert.equal(h.totals.overdue, 1);
    assert.equal(h.queue.items[0].activityId, 'A2');
    assert.equal(h.practices[0].student, 'Ana Perez');
    assert.equal(h.totals.reviewedPct, 67);
  });
  await test('advisor only counts advisor comments as reviewed', async () => {
    const h = await build().build({ role: 'advisor', documentNumber: 'A1' });
    // A1 graded, A4 has an advisor comment, A2 waits (A1 tutor-only comment does not count)
    assert.equal(h.totals.pendingReview, 1);
    assert.equal(h.queue.total, 1);
  });
  await test('director: summary, pending registrations, ending soon, audit', async () => {
    const h = await build().build({ role: 'director', documentNumber: 'D1' });
    assert.equal(h.summary.students, 2);
    assert.equal(h.pendingUsers.total, 1);
    assert.equal(h.studentsWithoutPractice, 1);
    assert.equal(h.endingSoon[0].id, 'PRA-1');
    assert.equal(h.recentActivity[0].who, 'Dir X');
  });
  await test('an audit failure does not break the director Home', async () => {
    const h = await build({ auditService: { list: async () => { throw new Error('mongo down'); } } }).build({ role: 'director' });
    assert.deepEqual(h.recentActivity, []);
  });
  console.log(`\nHOME: ${passed} passed`);
})();
