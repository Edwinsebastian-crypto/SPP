import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    fmt,
    pct,
    plural,
    dateTime,
    ReportEmpty,
    ReportTable,
    ReportStack,
    ReportHBars,
    ReportColumns,
    ReportKpiGrid,
    ReportCard,
} from './ReportWidgets';

const num = (v) =>
    v === null || v === undefined || Number.isNaN(Number(v)) ? 0 : Number(v);
const sum = (list, pick) =>
    list.reduce((total, item) => total + num(pick(item)), 0);
const round = (n, d) => {
    const f = 10 ** (d === undefined ? 1 : d);
    return Math.round(n * f) / f;
};
const ratio = (part, total, d) =>
    total ? round((100 * part) / total, d === undefined ? 1 : d) : 0;

/** Documents saved by the first version only contain the headline figures. */
const isLegacy = (i) =>
    i.version === null ||
    i.version === undefined ||
    !i.summary ||
    i.summary.practices === null ||
    i.summary.practices === undefined;

const practicesOf = (i) =>
    isLegacy(i)
        ? sum(i.practicesByType || [], (t) => t.count)
        : num(i.summary.practices);

const summaryOf = (i) =>
    isLegacy(i)
        ? {
              practices: practicesOf(i),
              active: null,
              completed: null,
              cancelled: null,
              graded: null,
              averageGrade: null,
              approved: null,
              approvalRate: null,
              requiredHours: null,
              loggedHours: null,
              hoursCompletion: null,
          }
        : i.summary;

function totals(list) {
    const done = list.filter((i) => !isLegacy(i));
    const graded = sum(done, (i) => i.summary.graded);
    const practices = sum(list, practicesOf);
    const institutions = new Set();
    const advisors = new Set();
    list.forEach((i) => {
        (i.partnerInstitutions || []).forEach((p) =>
            institutions.add(p.taxId || p.institutionName)
        );
        (i.advisors || []).forEach((a) => advisors.add(a.document));
    });
    return {
        programs: list.length,
        practices,
        activeStudents: sum(list, (i) => i.activeStudentsTotal),
        activeTutors: sum(list, (i) => i.activeTutors),
        institutions: institutions.size || null,
        advisors: advisors.size || null,
        averageGrade: graded
            ? round(
                  sum(
                      done,
                      (i) =>
                          num(i.summary.averageGrade) * num(i.summary.graded)
                  ) / graded,
                  2
              )
            : null,
        approvalRate: graded
            ? ratio(
                  sum(done, (i) => i.summary.approved),
                  graded
              )
            : null,
        dropoutRate: practices
            ? ratio(
                  sum(list, (i) =>
                      isLegacy(i)
                          ? (num(i.dropoutRate) * practicesOf(i)) / 100
                          : i.summary.cancelled
                  ),
                  practices
              )
            : 0,
        duration: practices
            ? Math.round(
                  sum(
                      list,
                      (i) =>
                          num(i.averagePracticeDurationDays) * practicesOf(i)
                  ) / practices
              )
            : 0,
        tutorFeedback: sum(
            list,
            (i) => i.teacherSupport && i.teacherSupport.tutorFeedbackCount
        ),
        advisorFeedback: sum(
            list,
            (i) => i.teacherSupport && i.teacherSupport.advisorFeedbackCount
        ),
        completed: done.length ? sum(done, (i) => i.summary.completed) : null,
        latest:
            list
                .map((i) => i.generatedAt)
                .filter(Boolean)
                .sort()
                .pop() || null,
    };
}

const PROGRAM = [
    { key: 'programId', label: 'Program ID' },
    { key: 'program', label: 'Program' },
];
const withProgram = (i, row) => ({
    year: i.year,
    programId: i.programId,
    program: i.programName,
    ...row,
});
const YEAR = [{ key: 'year', label: 'Year' }];

export const DATASETS = {
    programs: {
        title: 'Program summary',
        columns: YEAR.concat(PROGRAM, [
            { key: 'faculty', label: 'Faculty' },
            { key: 'totalStudents', label: 'Students (total)', num: true },
            { key: 'activeStudents', label: 'Active students', num: true },
            { key: 'activeTutors', label: 'Active tutors', num: true },
            { key: 'practices', label: 'Practices', num: true },
            { key: 'active', label: 'Active practices', num: true },
            { key: 'completed', label: 'Completed practices', num: true },
            { key: 'cancelled', label: 'Cancelled practices', num: true },
            { key: 'graded', label: 'Graded practices', num: true },
            {
                key: 'averageGrade',
                label: 'Average grade',
                num: true,
                decimals: 2,
            },
            { key: 'minGrade', label: 'Lowest grade', num: true, decimals: 2 },
            { key: 'maxGrade', label: 'Highest grade', num: true, decimals: 2 },
            { key: 'approved', label: 'Approved', num: true },
            { key: 'failed', label: 'Failed', num: true },
            {
                key: 'approvalRate',
                label: 'Approval rate (%)',
                num: true,
                decimals: 1,
            },
            { key: 'requiredHours', label: 'Required hours', num: true },
            { key: 'loggedHours', label: 'Logged hours', num: true },
            {
                key: 'hoursCompletion',
                label: 'Hours completed (%)',
                num: true,
                decimals: 1,
            },
            { key: 'activities', label: 'Activities', num: true },
            { key: 'evidences', label: 'Evidence items', num: true },
            {
                key: 'dropoutRate',
                label: 'Dropout rate (%)',
                num: true,
                decimals: 1,
            },
            {
                key: 'duration',
                label: 'Average duration (days)',
                num: true,
            },
            { key: 'tutorFeedback', label: 'Tutor feedback', num: true },
            { key: 'advisorFeedback', label: 'Advisor feedback', num: true },
            {
                key: 'withoutTutorFeedback',
                label: 'Practices without tutor feedback',
                num: true,
            },
            {
                key: 'withoutAdvisorFeedback',
                label: 'Practices without advisor feedback',
                num: true,
            },
            { key: 'generatedAt', label: 'Generated at' },
        ]),
        rows: (i) => {
            const s = summaryOf(i);
            const t = i.teacherSupport || {};
            return [
                withProgram(i, {
                    faculty: i.faculty,
                    totalStudents: i.totalStudents,
                    activeStudents: i.activeStudentsTotal,
                    activeTutors: i.activeTutors,
                    practices: s.practices,
                    active: s.active,
                    completed: s.completed,
                    cancelled: s.cancelled,
                    graded: s.graded,
                    averageGrade: s.averageGrade,
                    minGrade: s.minGrade,
                    maxGrade: s.maxGrade,
                    approved: s.approved,
                    failed: s.failed,
                    approvalRate: s.approvalRate,
                    requiredHours: s.requiredHours,
                    loggedHours: s.loggedHours,
                    hoursCompletion: s.hoursCompletion,
                    activities: s.activities,
                    evidences: s.evidences,
                    dropoutRate: i.dropoutRate,
                    duration: i.averagePracticeDurationDays,
                    tutorFeedback: t.tutorFeedbackCount,
                    advisorFeedback: t.advisorFeedbackCount,
                    withoutTutorFeedback: t.practicesWithoutTutorFeedback,
                    withoutAdvisorFeedback: t.practicesWithoutAdvisorFeedback,
                    generatedAt: i.generatedAt,
                }),
            ];
        },
    },
    types: {
        title: 'Practice types',
        columns: YEAR.concat(PROGRAM, [
            { key: 'typeId', label: 'Type ID' },
            { key: 'type', label: 'Practice type' },
            { key: 'semester', label: 'Semester', num: true },
            { key: 'requiredHours', label: 'Required hours', num: true },
            { key: 'count', label: 'Practices', num: true },
            { key: 'students', label: 'Students', num: true },
            {
                key: 'averageGrade',
                label: 'Average grade',
                num: true,
                decimals: 2,
            },
            {
                key: 'approvalRate',
                label: 'Approval rate (%)',
                num: true,
                decimals: 1,
            },
        ]),
        rows: (i) => (i.practicesByType || []).map((t) => withProgram(i, t)),
    },
    grades: {
        title: 'Grade distribution',
        columns: YEAR.concat(PROGRAM, [
            { key: 'range', label: 'Grade range' },
            { key: 'studentCount', label: 'Students', num: true },
        ]),
        rows: (i) => (i.gradeDistribution || []).map((g) => withProgram(i, g)),
    },
    support: {
        title: 'Teacher support (feedback)',
        columns: YEAR.concat(PROGRAM, [
            { key: 'tutorFeedbackCount', label: 'Tutor feedback', num: true },
            {
                key: 'advisorFeedbackCount',
                label: 'Advisor feedback',
                num: true,
            },
            {
                key: 'practicesWithoutTutorFeedback',
                label: 'Practices without tutor feedback',
                num: true,
            },
            {
                key: 'practicesWithoutAdvisorFeedback',
                label: 'Practices without advisor feedback',
                num: true,
            },
            {
                key: 'feedbackPerPractice',
                label: 'Feedback per practice',
                num: true,
                decimals: 1,
            },
        ]),
        rows: (i) => [withProgram(i, i.teacherSupport || {})],
    },
    institutions: {
        title: 'Partner institutions',
        columns: YEAR.concat(PROGRAM, [
            { key: 'taxId', label: 'Tax ID (NIT)' },
            { key: 'institutionName', label: 'Institution' },
            { key: 'address', label: 'Address' },
            { key: 'manager', label: 'Manager' },
            { key: 'email', label: 'Email' },
            { key: 'practiceCount', label: 'Practices', num: true },
            { key: 'studentCount', label: 'Students', num: true },
            { key: 'activeCount', label: 'Active', num: true },
            { key: 'completedCount', label: 'Completed', num: true },
            {
                key: 'averageGrade',
                label: 'Average grade',
                num: true,
                decimals: 2,
            },
        ]),
        rows: (i) =>
            (i.partnerInstitutions || []).map((p) => withProgram(i, p)),
    },
    tutors: {
        title: 'Academic tutors',
        columns: YEAR.concat(PROGRAM, [
            { key: 'document', label: 'Document' },
            { key: 'name', label: 'Name' },
            { key: 'email', label: 'Email' },
            { key: 'practices', label: 'Practices', num: true },
            { key: 'students', label: 'Students', num: true },
            { key: 'activePractices', label: 'Active practices', num: true },
            { key: 'feedbackCount', label: 'Feedback given', num: true },
            {
                key: 'averageGrade',
                label: 'Average grade',
                num: true,
                decimals: 2,
            },
        ]),
        rows: (i) => (i.tutors || []).map((t) => withProgram(i, t)),
    },
    advisors: {
        title: 'Pedagogical advisors',
        columns: YEAR.concat(PROGRAM, [
            { key: 'document', label: 'Document' },
            { key: 'name', label: 'Name' },
            { key: 'email', label: 'Email' },
            { key: 'practices', label: 'Practices', num: true },
            { key: 'students', label: 'Students', num: true },
            { key: 'activePractices', label: 'Active practices', num: true },
            { key: 'feedbackCount', label: 'Feedback given', num: true },
            {
                key: 'averageGrade',
                label: 'Average grade',
                num: true,
                decimals: 2,
            },
        ]),
        rows: (i) => (i.advisors || []).map((a) => withProgram(i, a)),
    },
    practices: {
        title: 'Practice roster',
        columns: YEAR.concat(PROGRAM, [
            { key: 'practiceId', label: 'Practice ID' },
            { key: 'studentDocumentType', label: 'Doc. type' },
            { key: 'studentDocument', label: 'Student document' },
            { key: 'studentName', label: 'Student' },
            { key: 'studentEmail', label: 'Student email' },
            { key: 'studentStatus', label: 'Student status' },
            { key: 'typeId', label: 'Type ID' },
            { key: 'type', label: 'Practice type' },
            { key: 'taxId', label: 'Institution NIT' },
            { key: 'institution', label: 'Institution' },
            { key: 'tutorDocument', label: 'Tutor document' },
            { key: 'tutor', label: 'Tutor' },
            { key: 'advisorDocument', label: 'Advisor document' },
            { key: 'advisor', label: 'Advisor' },
            { key: 'startDate', label: 'Start date' },
            { key: 'endDate', label: 'End date' },
            { key: 'durationDays', label: 'Duration (days)', num: true },
            { key: 'status', label: 'Status' },
            {
                key: 'finalGrade',
                label: 'Final grade',
                num: true,
                decimals: 2,
            },
            { key: 'finalObservation', label: 'Final observation' },
            { key: 'requiredHours', label: 'Required hours', num: true },
            { key: 'loggedHours', label: 'Logged hours', num: true },
            { key: 'activities', label: 'Activities', num: true },
            { key: 'evidences', label: 'Evidence items', num: true },
            { key: 'tutorFeedback', label: 'Tutor feedback', num: true },
            { key: 'advisorFeedback', label: 'Advisor feedback', num: true },
        ]),
        rows: (i) => (i.practices || []).map((p) => withProgram(i, p)),
    },
};

const SECTION_HINTS = {
    programs: 'One row per program with every indicator',
    types: 'Practices, students, average grade and approval per type',
    grades: 'Students per grade range',
    support: 'Tutor and advisor feedback',
    institutions: 'NIT, address, manager and contact',
    tutors: 'Document, e-mail and workload',
    advisors: 'Document, e-mail and workload',
    practices: 'Student by student: every practice with its data',
};

function dataset(key, list) {
    const def = DATASETS[key];
    return {
        id: `accreditation-${key}`,
        title: def.title,
        columns: def.columns,
        rows: list.flatMap((i) => def.rows(i)),
    };
}

function enrichSemesters(list, pTypes) {
    if (!pTypes || !pTypes.length || !list || !list.length) return;
    const typeMap = new Map();
    pTypes.forEach((pt) => {
        if (pt.id) typeMap.set(String(pt.id).trim().toLowerCase(), pt.semester);
        if (pt.code)
            typeMap.set(String(pt.code).trim().toLowerCase(), pt.semester);
        if (pt.name)
            typeMap.set(String(pt.name).trim().toLowerCase(), pt.semester);
    });
    list.forEach((ind) => {
        (ind.practicesByType || []).forEach((t) => {
            if (t.semester === null || t.semester === undefined) {
                const found =
                    (t.typeId &&
                        typeMap.get(String(t.typeId).trim().toLowerCase())) ||
                    (t.type &&
                        typeMap.get(String(t.type).trim().toLowerCase()));
                if (found !== undefined && found !== null) {
                    t.semester = found;
                }
            }
        });
    });
}

const jsonOf = (i, sections) => {
    const out = {
        programId: i.programId,
        programName: i.programName,
        faculty: i.faculty,
        year: i.year,
        generatedAt: i.generatedAt,
        version: i.version,
    };
    if (sections.has('programs'))
        Object.assign(out, {
            totalStudents: i.totalStudents,
            activeStudents: i.activeStudentsTotal,
            activeTutors: i.activeTutors,
            summary: i.summary,
            dropoutRate: i.dropoutRate,
            averagePracticeDurationDays: i.averagePracticeDurationDays,
        });
    if (sections.has('types')) out.practicesByType = i.practicesByType;
    if (sections.has('grades')) out.gradeDistribution = i.gradeDistribution;
    if (sections.has('support')) out.teacherSupport = i.teacherSupport;
    if (sections.has('institutions'))
        out.partnerInstitutions = i.partnerInstitutions;
    if (sections.has('tutors')) out.tutors = i.tutors;
    if (sections.has('advisors')) out.advisors = i.advisors;
    if (sections.has('practices')) out.practices = i.practices;
    return out;
};

function Banner({ text, tone = 'info' }) {
    return (
        <div className={`rp-note rp-note--${tone}`} role="status">
            <i
                className={
                    tone === 'warn'
                        ? 'fa-solid fa-triangle-exclamation'
                        : 'fa-solid fa-circle-info'
                }
                aria-hidden="true"
            />
            <span>{text}</span>
        </div>
    );
}

function RosterPanel({ indicator }) {
    const [searchVal, setSearchVal] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(searchVal.trim().toLowerCase());
        }, 200);
        return () => clearTimeout(timer);
    }, [searchVal]);

    const all = DATASETS.practices.rows(indicator);
    const columns = DATASETS.practices.columns
        .filter(
            (c) =>
                ![
                    'year',
                    'programId',
                    'program',
                    'studentDocumentType',
                    'typeId',
                    'taxId',
                    'tutorDocument',
                    'advisorDocument',
                    'finalObservation',
                    'studentStatus',
                    'studentEmail',
                ].includes(c.key)
        )
        .map((c) =>
            c.key === 'status'
                ? {
                      ...c,
                      render: (v) => (
                          <span
                              className={`dv-flag ${
                                  v === 'cancelled'
                                      ? ''
                                      : v === 'completed'
                                      ? 'dv-flag--ok'
                                      : 'dv-flag--warn'
                              }`}
                          >
                              {v || '—'}
                          </span>
                      ),
                  }
                : c
        );

    const rows = debouncedQuery
        ? all.filter((r) =>
              [
                  r.studentName,
                  r.studentDocument,
                  r.tutor,
                  r.advisor,
                  r.institution,
                  r.practiceId,
                  r.type,
              ].some((v) =>
                  String(v || '')
                      .toLowerCase()
                      .includes(debouncedQuery)
              )
          )
        : all;

    return (
        <div>
            <div className="dv-filters">
                <div className="dv-search">
                    <i
                        className="fa-solid fa-magnifying-glass"
                        aria-hidden="true"
                    />
                    <input
                        type="search"
                        placeholder="Search student, tutor, institution…"
                        aria-label="Search practices"
                        maxLength={80}
                        value={searchVal}
                        onChange={(e) => setSearchVal(e.target.value)}
                    />
                </div>
                <span className="dv-count">
                    {rows.length
                        ? `Showing ${fmt(Math.min(300, rows.length))} of ${fmt(
                              rows.length
                          )}`
                        : ''}
                </span>
            </div>
            <div>
                <ReportTable
                    columns={columns}
                    rows={rows.slice(0, 300)}
                    opts={{
                        empty: all.length
                            ? 'No practice matches the search.'
                            : `No practices in ${indicator.year}.`,
                    }}
                />
            </div>
            <p className="dv-note">
                The export includes more columns (documents, e-mails,
                observations, hours and feedback per practice).
            </p>
        </div>
    );
}

export default function AccreditationApp() {
    const [year, setYear] = useState(new Date().getFullYear());
    const [yearInput, setYearInput] = useState(
        String(new Date().getFullYear())
    );
    const [indicators, setIndicators] = useState([]);
    const [openId, setOpenId] = useState(null);
    const [openTab, setOpenTab] = useState('overview');
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState('');
    const [failure, setFailure] = useState('');

    const yearRef = useRef(year);
    yearRef.current = year;

    const load = useCallback(async (targetYear) => {
        const y = targetYear !== undefined ? targetYear : yearRef.current;
        setFailure('');
        setNotice('');
        try {
            const SPP = window.SPP;
            const [repRes, typesRes] = await Promise.all([
                SPP.get(`/api/reports?year=${encodeURIComponent(y)}`),
                SPP.get('/api/practice-types').catch(() => null),
            ]);
            const list = repRes.indicators || [];
            if (typesRes && typesRes.practiceTypes) {
                enrichSemesters(list, typesRes.practiceTypes);
            }
            setIndicators(list);
        } catch (err) {
            setIndicators([]);
            setFailure(
                (err && err.message) || 'The indicators could not be loaded.'
            );
        }
    }, []);

    useEffect(() => {
        window.SPP_ACCREDITATION = {
            reload: () => load(yearRef.current),
            datasets: DATASETS,
        };
        load(yearRef.current);
    }, [load]);

    const generateAndSave = async () => {
        if (busy) return;
        setBusy(true);
        setFailure('');
        setNotice('');
        try {
            const SPP = window.SPP;
            const [result, typesRes] = await Promise.all([
                SPP.post('/api/reports/generate', { year }),
                SPP.get('/api/practice-types').catch(() => null),
            ]);
            const list = result.indicators || [];
            if (typesRes && typesRes.practiceTypes) {
                enrichSemesters(list, typesRes.practiceTypes);
            }
            setIndicators(list);
            setNotice(
                `Saved ${plural(
                    list.length,
                    'program',
                    'programs'
                )} for ${year} in MongoDB, with the complete information of the practices.`
            );
            if (window.SPP_REPORTS && window.SPP_REPORTS.reload) {
                window.SPP_REPORTS.reload();
            }
        } catch (err) {
            if (window.SPP?.showError) window.SPP.showError(err);
        } finally {
            setBusy(false);
        }
    };

    const openExport = () => {
        if (!indicators.length) return;
        const K = window.SPP?.reportKit;
        if (!K || !K.openExport) return;
        K.openExport({
            title: `Export accreditation data · ${year}`,
            subtitle:
                'Choose the programs and the information to include. Excel gives one sheet per item.',
            filters: [
                {
                    id: 'programs',
                    label: 'Programs',
                    options: indicators.map((i) => ({
                        value: i.programId,
                        label: i.programName,
                        hint: plural(practicesOf(i), 'practice', 'practices'),
                    })),
                },
            ],
            sectionsLabel: 'Information to include',
            sections: Object.keys(DATASETS).map((key) => ({
                id: key,
                label: DATASETS[key].title,
                hint: SECTION_HINTS[key],
            })),
            build: ({ sections, filters }) => {
                const chosen = indicators.filter((i) =>
                    filters.programs.has(i.programId)
                );
                if (!chosen.length)
                    throw new Error('Select at least one program.');
                const datasets = Object.keys(DATASETS)
                    .filter((key) => sections.has(key))
                    .map((key) => dataset(key, chosen));
                const label =
                    chosen.length === 1
                        ? chosen[0].programName
                        : plural(chosen.length, 'program', 'programs');
                return {
                    datasets,
                    base: `accreditation-${year}${
                        chosen.length === 1 ? `-${chosen[0].programId}` : ''
                    }`,
                    title: `Accreditation indicators ${year}`,
                    subtitle: label,
                    mode: 'tables',
                    json: {
                        title: `Accreditation indicators ${year}`,
                        year,
                        generatedAt: new Date().toISOString(),
                        programs: chosen.map((i) => jsonOf(i, sections)),
                    },
                };
            },
        });
    };

    const handleYearBlurOrCommit = (valStr) => {
        const value = Number(valStr);
        if (!Number.isInteger(value) || value < 2000 || value > 2100) {
            setYearInput(String(year));
            return;
        }
        if (value !== year) {
            setYear(value);
            setOpenId(null);
            load(value);
        }
    };

    const t = totals(indicators);
    const latest = t.latest;
    const legacyCount = indicators.filter(isLegacy).length;
    const dash = (v, f) => (v === null || v === undefined ? '—' : f(v));

    const programRows = indicators.map((i) => {
        const s = summaryOf(i);
        const ts = i.teacherSupport || {};
        return {
            id: i.programId,
            program: i.programName,
            faculty: i.faculty || '—',
            students: i.activeStudentsTotal,
            practices: s.practices,
            completed: s.completed,
            grade: s.averageGrade,
            approval: s.approvalRate,
            dropout: i.dropoutRate,
            duration: i.averagePracticeDurationDays,
            feedback: `${num(ts.tutorFeedbackCount)} / ${num(
                ts.advisorFeedbackCount
            )}`,
            institutions: (i.partnerInstitutions || []).length,
            legacy: isLegacy(i),
        };
    });

    const programColumns = [
        {
            key: 'program',
            label: 'Program',
            render: (v, r) => (
                <span>
                    <span className="dv-cell-title">{v}</span>
                    <span className="dv-cell-sub">
                        {r.faculty + (r.legacy ? ' · summary only' : '')}
                    </span>
                </span>
            ),
        },
        { key: 'students', label: 'Active students', num: true },
        { key: 'practices', label: 'Practices', num: true },
        {
            key: 'completed',
            label: 'Completed',
            num: true,
            render: (v) => (v === null ? '—' : fmt(v)),
        },
        {
            key: 'grade',
            label: 'Avg. grade',
            num: true,
            render: (v) => (v === null || v === 0 ? '—' : fmt(v, 2)),
        },
        {
            key: 'approval',
            label: 'Approval',
            num: true,
            render: (v) => (v === null ? '—' : pct(v)),
        },
        {
            key: 'dropout',
            label: 'Dropout',
            num: true,
            render: (v) => pct(v),
        },
        {
            key: 'duration',
            label: 'Avg. duration',
            num: true,
            render: (v) => `${fmt(v)} d`,
        },
        { key: 'feedback', label: 'Feedback (tutor / advisor)', num: true },
        {
            key: 'id',
            label: '',
            render: (v) => (
                <button
                    type="button"
                    className={`ev-btn ev-btn--sm ${
                        openId === v ? 'ev-btn--dark' : 'ev-btn--ghost'
                    }`}
                    aria-expanded={String(openId === v)}
                    onClick={() => {
                        const nextId = openId === v ? null : v;
                        setOpenId(nextId);
                        setOpenTab('overview');
                        if (nextId) {
                            requestAnimationFrame(() => {
                                const d =
                                    document.getElementById('rp-acc-detail');
                                if (d)
                                    d.scrollIntoView({
                                        behavior: 'smooth',
                                        block: 'nearest',
                                    });
                            });
                        }
                    }}
                >
                    {openId === v ? 'Hide detail' : 'View detail'}
                </button>
            ),
        },
    ];

    const openIndicator = indicators.find((i) => i.programId === openId);

    const renderDetailPanel = (i) => {
        const s = summaryOf(i);
        const legacy = isLegacy(i);

        if (openTab === 'overview') {
            const kpis = [
                {
                    icon: 'fa-solid fa-user-graduate',
                    value: dash(i.activeStudentsTotal, fmt),
                    label: 'Active students',
                    sub:
                        i.totalStudents != null
                            ? `of ${fmt(i.totalStudents)} registered`
                            : null,
                },
                {
                    icon: 'fa-solid fa-chalkboard-user',
                    value: dash(i.activeTutors, fmt),
                    label: 'Active tutors',
                },
                {
                    icon: 'fa-solid fa-copy',
                    value: fmt(s.practices),
                    label: 'Practices',
                    sub: legacy
                        ? null
                        : `${fmt(s.active)} active · ${fmt(
                              s.completed
                          )} completed · ${fmt(s.cancelled)} cancelled`,
                },
                {
                    icon: 'fa-solid fa-chart-simple',
                    value: s.graded ? fmt(s.averageGrade, 2) : '—',
                    label: 'Average grade',
                    sub: s.graded
                        ? `${fmt(s.minGrade, 1)} lowest · ${fmt(
                              s.maxGrade,
                              1
                          )} highest`
                        : 'No graded practices',
                },
                {
                    icon: 'fa-solid fa-circle-check',
                    value: s.graded ? pct(s.approvalRate) : '—',
                    label: 'Approval rate',
                    sub: s.graded
                        ? `${fmt(s.approved)} approved · ${fmt(
                              s.failed
                          )} failed`
                        : null,
                },
                {
                    icon: 'fa-regular fa-clock',
                    value: legacy ? '—' : pct(s.hoursCompletion),
                    label: 'Hours completed',
                    sub: legacy
                        ? null
                        : `${fmt(s.loggedHours)} of ${fmt(
                              s.requiredHours
                          )} required`,
                },
                {
                    icon: 'fa-solid fa-ban',
                    value: pct(i.dropoutRate),
                    label: 'Dropout rate',
                    sub: 'Cancelled practices',
                },
                {
                    icon: 'fa-regular fa-calendar',
                    value: `${fmt(i.averagePracticeDurationDays)} d`,
                    label: 'Average duration',
                    sub: legacy
                        ? null
                        : `${fmt(s.activities)} activities · ${fmt(
                              s.evidences
                          )} evidence items`,
                },
            ];

            const dist = i.gradeDistribution || [];
            const order = ['0.1-2.9', '3.0-3.9', '4.0-5.0'];
            const bands = order.map(
                (r) =>
                    dist.find((g) => g.range === r) || {
                        range: r,
                        studentCount: 0,
                    }
            );

            return (
                <div>
                    <ReportKpiGrid items={kpis} />
                    <div className="dv-grid">
                        <ReportCard
                            tab="acc"
                            dataset={{
                                id: 'x',
                                title: 'Practice status',
                                noExport: true,
                            }}
                            opts={{
                                noTable: true,
                                sub: `Practices of ${i.year} by status.`,
                                chart: legacy ? (
                                    <ReportEmpty text="Not available in this version of the indicators." />
                                ) : (
                                    <ReportStack
                                        parts={[
                                            {
                                                label: 'Active',
                                                value: s.active,
                                                cls: 'dv-s1',
                                            },
                                            {
                                                label: 'Completed',
                                                value: s.completed,
                                                cls: 'dv-s3',
                                            },
                                            {
                                                label: 'Cancelled',
                                                value: s.cancelled,
                                                cls: 'dv-s2',
                                            },
                                        ]}
                                        opts={{
                                            empty: `No practices in ${i.year}.`,
                                        }}
                                    />
                                ),
                            }}
                        />
                        <ReportCard
                            tab="acc"
                            dataset={{
                                id: 'y',
                                title: 'Grade distribution',
                                noExport: true,
                                columns: [
                                    { key: 'range', label: 'Range' },
                                    {
                                        key: 'students',
                                        label: 'Students',
                                        num: true,
                                    },
                                ],
                                rows: bands.map((b) => ({
                                    range: b.range,
                                    students: b.studentCount,
                                })),
                            }}
                            opts={{
                                sub: 'Students by final grade.',
                                chart: (
                                    <ReportColumns
                                        labels={[
                                            'Below 3.0',
                                            '3.0 – 3.9',
                                            '4.0 – 5.0',
                                        ]}
                                        series={[
                                            {
                                                name: 'Students',
                                                cls: 'dv-s1',
                                                values: bands.map(
                                                    (b) => b.studentCount
                                                ),
                                            },
                                        ]}
                                        opts={{
                                            passBefore: 1,
                                            empty: 'No graded practices yet.',
                                        }}
                                    />
                                ),
                                note: 'The dashed line marks the minimum grade to pass (3.0).',
                            }}
                        />
                    </div>
                </div>
            );
        }

        if (openTab === 'types') {
            const types = i.practicesByType || [];
            const columns = DATASETS.types.columns.filter(
                (c) => !['year', 'programId', 'program'].includes(c.key)
            );
            return (
                <div>
                    <div className="rp-acc-chart">
                        <ReportHBars
                            rows={types.map((tp) => ({
                                label: tp.type,
                                value: tp.count,
                                text:
                                    fmt(tp.count) +
                                    (tp.averageGrade
                                        ? ` · avg ${fmt(tp.averageGrade, 2)}`
                                        : ''),
                            }))}
                            opts={{ empty: `No practices in ${i.year}.` }}
                        />
                    </div>
                    <ReportTable
                        columns={columns}
                        rows={DATASETS.types.rows(i)}
                        opts={{
                            empty: 'There is no information of this kind in the saved indicator.',
                        }}
                    />
                </div>
            );
        }

        if (openTab === 'support') {
            const ts = i.teacherSupport || {};
            const totalFb =
                num(ts.tutorFeedbackCount) + num(ts.advisorFeedbackCount);
            const kpis = [
                {
                    icon: 'fa-solid fa-comments',
                    value: fmt(ts.tutorFeedbackCount),
                    label: 'Tutor feedback',
                },
                {
                    icon: 'fa-solid fa-comment-dots',
                    value: fmt(ts.advisorFeedbackCount),
                    label: 'Advisor feedback',
                },
                {
                    icon: 'fa-solid fa-triangle-exclamation',
                    value:
                        ts.practicesWithoutTutorFeedback === null ||
                        ts.practicesWithoutTutorFeedback === undefined
                            ? '—'
                            : fmt(ts.practicesWithoutTutorFeedback),
                    label: 'Without tutor feedback',
                    attn: num(ts.practicesWithoutTutorFeedback) > 0,
                },
                {
                    icon: 'fa-solid fa-triangle-exclamation',
                    value:
                        ts.practicesWithoutAdvisorFeedback === null ||
                        ts.practicesWithoutAdvisorFeedback === undefined
                            ? '—'
                            : fmt(ts.practicesWithoutAdvisorFeedback),
                    label: 'Without advisor feedback',
                    attn: num(ts.practicesWithoutAdvisorFeedback) > 0,
                },
            ];
            const teacherColumns = (key) =>
                DATASETS[key].columns.filter(
                    (c) => !['year', 'programId', 'program'].includes(c.key)
                );
            return (
                <div>
                    <ReportKpiGrid items={kpis} />
                    {totalFb ? (
                        <ReportStack
                            parts={[
                                {
                                    label: 'Tutor',
                                    value: num(ts.tutorFeedbackCount),
                                    cls: 'dv-s1',
                                },
                                {
                                    label: 'Advisor',
                                    value: num(ts.advisorFeedbackCount),
                                    cls: 'dv-s2',
                                },
                            ]}
                        />
                    ) : (
                        <ReportEmpty
                            text={`No feedback was written for the practices of ${i.year}.`}
                        />
                    )}
                    <h4 className="dv-sub">Academic tutors</h4>
                    <ReportTable
                        columns={teacherColumns('tutors')}
                        rows={DATASETS.tutors.rows(i)}
                        opts={{ empty: 'No tutors saved for this program.' }}
                    />
                    <h4 className="dv-sub">Pedagogical advisors</h4>
                    <ReportTable
                        columns={teacherColumns('advisors')}
                        rows={DATASETS.advisors.rows(i)}
                        opts={{ empty: 'No advisors saved for this program.' }}
                    />
                </div>
            );
        }

        if (openTab === 'institutions') {
            const columns = DATASETS.institutions.columns.filter(
                (c) => !['year', 'programId', 'program'].includes(c.key)
            );
            return (
                <ReportTable
                    columns={columns}
                    rows={DATASETS.institutions.rows(i)}
                    opts={{
                        empty: 'There is no information of this kind in the saved indicator.',
                    }}
                />
            );
        }

        if (openTab === 'practices') {
            return <RosterPanel indicator={i} />;
        }

        return null;
    };

    return (
        <>
            <div className="rp-acc-head">
                <div className="rp-acc-title">
                    <h3>Accreditation indicators</h3>
                    <p>
                        {latest
                            ? `Generated ${dateTime(latest)}`
                            : 'Computed from the practicum database and saved in MongoDB.'}
                    </p>
                </div>
                <div className="rp-acc-controls">
                    <label htmlFor="ind-year">Year</label>
                    <input
                        id="ind-year"
                        type="number"
                        min="2000"
                        max="2100"
                        value={yearInput}
                        aria-label="Year"
                        onChange={(e) => setYearInput(e.target.value)}
                        onBlur={(e) => handleYearBlurOrCommit(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleYearBlurOrCommit(e.currentTarget.value);
                            }
                        }}
                    />
                    <button
                        type="button"
                        className="rp-acc-export"
                        disabled={!indicators.length}
                        onClick={openExport}
                    >
                        <i
                            className="fa-solid fa-download"
                            aria-hidden="true"
                        />
                        Export data
                    </button>
                    <button
                        type="button"
                        className="cp-btn cp-btn-save"
                        id="ind-generate"
                        style={{ margin: 0 }}
                        disabled={busy}
                        onClick={generateAndSave}
                    >
                        {busy ? 'Generating…' : 'Generate and save'}
                    </button>
                </div>
            </div>

            {failure ? <Banner text={failure} tone="warn" /> : null}
            {notice ? <Banner text={notice} tone="ok" /> : null}

            {!indicators.length ? (
                <ReportEmpty
                    text={`There are no indicators saved for ${year} yet. Click “Generate and save” to compute them from the practicum database and store them in MongoDB.`}
                    ic="fa-regular fa-clipboard"
                />
            ) : (
                <>
                    {legacyCount ? (
                        <Banner
                            text={`${legacyCount} ${
                                legacyCount === 1
                                    ? 'program was'
                                    : 'programs were'
                            } saved with an earlier version that only keeps the headline figures. Click “Generate and save” to store the complete information of ${year}.`}
                            tone="warn"
                        />
                    ) : null}

                    <ReportKpiGrid
                        cls="rp-acc-kpis"
                        items={[
                            {
                                icon: 'fa-solid fa-graduation-cap',
                                value: fmt(t.programs),
                                label: 'Programs',
                                sub: `${plural(
                                    t.practices,
                                    'practice',
                                    'practices'
                                )} in ${year}`,
                            },
                            {
                                icon: 'fa-solid fa-user-graduate',
                                value: fmt(t.activeStudents),
                                label: 'Active students',
                            },
                            {
                                icon: 'fa-solid fa-chalkboard-user',
                                value: fmt(t.activeTutors),
                                label: 'Active tutors',
                                sub: t.advisors
                                    ? `${plural(
                                          t.advisors,
                                          'advisor',
                                          'advisors'
                                      )} in practices`
                                    : null,
                            },
                            {
                                icon: 'fa-solid fa-building-columns',
                                value: dash(t.institutions, fmt),
                                label: 'Partner institutions',
                            },
                            {
                                icon: 'fa-solid fa-chart-simple',
                                value: dash(t.averageGrade, (v) => fmt(v, 2)),
                                label: 'Average grade',
                                sub: 'Scale 0 – 5',
                            },
                            {
                                icon: 'fa-solid fa-circle-check',
                                value: dash(t.approvalRate, pct),
                                label: 'Approval rate',
                                sub: 'Grade of 3.0 or higher',
                            },
                            {
                                icon: 'fa-solid fa-ban',
                                value: pct(t.dropoutRate),
                                label: 'Dropout rate',
                                sub: 'Cancelled practices',
                            },
                            {
                                icon: 'fa-solid fa-comments',
                                value: `${fmt(t.tutorFeedback)} / ${fmt(
                                    t.advisorFeedback
                                )}`,
                                label: 'Tutor / advisor feedback',
                                sub: `${fmt(t.duration)} days average duration`,
                            },
                        ]}
                    />

                    <ReportTable
                        columns={programColumns}
                        rows={programRows}
                        opts={{ empty: 'No programs.' }}
                    />

                    {openIndicator ? (
                        <article
                            className="dv-card dv-card--wide rp-acc-detail"
                            id="rp-acc-detail"
                        >
                            <div className="dv-card-head">
                                <div
                                    style={{
                                        marginRight: 'auto',
                                        minWidth: 0,
                                    }}
                                >
                                    <h3>
                                        {openIndicator.programName} ·{' '}
                                        {openIndicator.year}
                                    </h3>
                                    <p>
                                        {[
                                            openIndicator.faculty,
                                            openIndicator.generatedAt
                                                ? `Generated ${dateTime(
                                                      openIndicator.generatedAt
                                                  )}`
                                                : null,
                                            `Program ID ${openIndicator.programId}`,
                                        ]
                                            .filter(Boolean)
                                            .join(' · ')}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    className="dv-toggle"
                                    onClick={() => setOpenId(null)}
                                >
                                    <i
                                        className="fa-solid fa-xmark"
                                        aria-hidden="true"
                                    />
                                    Close
                                </button>
                            </div>

                            {isLegacy(openIndicator) ? (
                                <Banner
                                    text="This program was saved with an earlier version of the indicators and only has the headline figures. Click “Generate and save” to store the complete information (practices, students, tutors, institutions...)."
                                    tone="warn"
                                />
                            ) : null}

                            <div className="ev-tabs" role="tablist">
                                {[
                                    ['overview', 'Overview'],
                                    ['types', 'Practice types'],
                                    ['support', 'Teacher support'],
                                    [
                                        'institutions',
                                        `Institutions (${
                                            (
                                                openIndicator.partnerInstitutions ||
                                                []
                                            ).length
                                        })`,
                                    ],
                                    [
                                        'practices',
                                        `Practices (${
                                            (openIndicator.practices || [])
                                                .length
                                        })`,
                                    ],
                                ].map(([key, label]) => (
                                    <button
                                        key={key}
                                        type="button"
                                        className="ev-tab"
                                        role="tab"
                                        aria-selected={String(openTab === key)}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setOpenTab(key);
                                        }}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>

                            <div className="rp-acc-panel">
                                {renderDetailPanel(openIndicator)}
                            </div>
                        </article>
                    ) : null}
                </>
            )}
        </>
    );
}
