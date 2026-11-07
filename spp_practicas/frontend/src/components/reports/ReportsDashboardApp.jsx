import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { get, showError } from '../../core/api';
import { openExport, registry, resetTab, datasetsToJson } from '../../core/reports-kit';
import { getPanelElement } from '../../core/panels';
import { provide, inject } from '../../core/registry';
import {
    fmt,
    pct,
    plural,
    monthLabel,
    day,
    ReportEmpty,
    ReportTable,
    ReportStack,
    ReportHBars,
    ReportColumns,
    ReportKpis,
    ReportCard,
    ReportToolbar,
} from './ReportWidgets';

export const TABS = [
    {
        key: 'general',
        label: 'General',
        root: 'rp-general',
        header: 'rp-general-header',
    },
    {
        key: 'types',
        label: 'Types',
        root: 'rp-types',
        header: 'rp-types-header',
    },
    {
        key: 'practice',
        label: 'Practice',
        root: 'rp-practice',
        header: 'rp-practice-header',
    },
    {
        key: 'feedback',
        label: 'Feedback',
        root: 'rp-feedback',
        header: 'rp-feedback-header',
    },
    {
        key: 'institutions',
        label: 'Institutions',
        root: 'rp-institutions',
        header: 'rp-institutions-header',
    },
];

const sum = (list, pick) =>
    list.reduce((total, item) => total + (Number(pick(item)) || 0), 0);
const share = (part, total) =>
    total ? Math.round((1000 * part) / total) / 10 : 0;
const level = (value) =>
    value >= 70 ? 'dv-fill--good' : value >= 40 ? 'dv-fill--mid' : 'dv-fill--low';
const gradeLevel = (grade) =>
    grade >= 4 ? 'dv-fill--good' : grade >= 3 ? 'dv-fill--mid' : 'dv-fill--low';

const STATUS = {
    active: { label: 'Active', cls: 'dv-s1' },
    completed: { label: 'Completed', cls: 'dv-s3' },
    cancelled: { label: 'Cancelled', cls: 'dv-s2' },
};

const practiceTable = [
    { key: 'code', label: 'Practice ID' },
    { key: 'student', label: 'Student' },
    { key: 'institution', label: 'Institution' },
];

const TAB_META = {
    general: {
        title: 'General',
        sub: 'Overview of the status and indicators of professional practices.',
        glossary: [
            [
                'Total practices',
                'Cumulative number of professional practices registered in the system.',
            ],
            [
                'Approval rate',
                'Percentage of practices with a final grade of 60% or more (3.0 out of 5.0).',
            ],
            [
                'Logged hours',
                'Total hours of activities and logbooks reported against required hours.',
            ],
            [
                'Final average',
                'Average grade obtained in already graded and completed practices.',
            ],
            [
                'Status distribution',
                'Practices classified into Active (in progress), Completed or Cancelled.',
            ],
            [
                'Partner institutions',
                'Companies and educational institutions with active agreements and assigned students.',
            ],
        ],
    },
    types: {
        title: 'Types',
        sub: 'Distribution, hours compliance and performance across practice types.',
        glossary: [
            [
                'Practice types',
                'Authorized curricular modalities for professional practice development.',
            ],
            [
                'Required hours',
                'Minimum regulatory hours to be completed for each modality.',
            ],
            [
                'Student distribution',
                'Proportion of students enrolled in each type relative to the program total.',
            ],
            [
                'Hours compliance',
                'Average percentage of hours completed over stipulated hours.',
            ],
            [
                'Academic performance',
                'Average final grades and approval rate by practice modality.',
            ],
        ],
    },
    practice: {
        title: 'Practice',
        sub: 'Detailed tracking of students, hours, academic progress and tutors.',
        glossary: [
            [
                'Practice ID',
                'Unique tracking code assigned to each professional practice.',
            ],
            [
                'Approved hours',
                'Hours reported in logbooks that have been approved by the assigned tutor.',
            ],
            [
                'Progress percentage',
                'Cumulative hourly progress relative to the total established target.',
            ],
            [
                'Final grade',
                'Consolidated grade assigned from evaluations and performance in practice.',
            ],
            [
                'Practice status',
                'Indicates whether the practice is Active (in progress), Completed or Cancelled.',
            ],
        ],
    },
    feedback: {
        title: 'Feedback',
        sub: 'Monitoring of tutor observations, evaluation comments and response times.',
        glossary: [
            [
                'Feedback comments',
                'Pedagogical observations and guidance provided by tutors on submissions.',
            ],
            [
                'Average response time',
                'Average days the tutor takes to respond and provide feedback on submitted activities.',
            ],
            [
                'Pending reviews',
                'Submissions or logbooks sent by the student awaiting comments.',
            ],
            [
                'Tutor accompaniment',
                'Frequency and timeliness of qualitative guidance offered by tutors.',
            ],
        ],
    },
    institutions: {
        title: 'Institutions',
        sub: 'Partner entities, convention coverage and student placement statistics.',
        glossary: [
            [
                'Host institution',
                'Formally registered organization, company or school where the practice takes place.',
            ],
            [
                'Capacity & placement',
                'Total active and historical professional practices hosted at each institution.',
            ],
            [
                'Institutional advisors',
                'Professionals designated by the host entity to coordinate on-site work.',
            ],
            [
                'Institutional success rate',
                'Average student performance and approval rate per entity.',
            ],
        ],
    },
};

function GeneralTab({ d }) {
    const T = 'general';
    const g = d.general;
    const statusRows = g.statusBreakdown.map((s) => ({
        status: s.label,
        practices: s.count,
        share: s.percent,
    }));
    const byLabel = {
        Active: STATUS.active,
        Completed: STATUS.completed,
        Cancelled: STATUS.cancelled,
    };

    const order = ['Below 3.0', '3.0 - 3.9', '4.0 - 5.0', 'Not graded'];
    const bands = order.map(
        (label) =>
            g.gradeBands.find((b) => b.label === label) || { label, count: 0 }
    );

    return (
        <>
            <ReportKpis
                tab={T}
                id="kpis"
                title="Key figures"
                items={[
                    {
                        icon: 'fa-solid fa-copy',
                        value: fmt(g.totalPractices),
                        raw: g.totalPractices,
                        label: 'Total practices',
                        sub: `${plural(
                            g.students,
                            'student',
                            'students'
                        )} · ${plural(g.tutors, 'tutor', 'tutors')}`,
                    },
                    {
                        icon: 'fa-solid fa-file-circle-check',
                        value: fmt(g.activePractices),
                        raw: g.activePractices,
                        label: 'Active',
                        sub: `${pct(
                            share(g.activePractices, g.totalPractices)
                        )} of the practices`,
                    },
                    {
                        icon: 'fa-solid fa-flag-checkered',
                        value: fmt(g.completedPractices),
                        raw: g.completedPractices,
                        label: 'Completed',
                        sub: `${pct(
                            share(g.completedPractices, g.totalPractices)
                        )} of the practices`,
                    },
                    {
                        icon: 'fa-solid fa-ban',
                        value: fmt(g.cancelledPractices),
                        raw: g.cancelledPractices,
                        label: 'Cancelled',
                        sub: `${pct(
                            share(g.cancelledPractices, g.totalPractices)
                        )} dropout rate`,
                    },
                    {
                        icon: 'fa-solid fa-chart-simple',
                        value: g.gradedPractices
                            ? fmt(g.averageGrade, 2)
                            : '—',
                        raw: g.averageGrade,
                        label: 'Average final grade',
                        sub: `${plural(
                            g.gradedPractices,
                            'graded practice',
                            'graded practices'
                        )} · scale 0 – 5`,
                    },
                    {
                        icon: 'fa-solid fa-circle-check',
                        value: g.gradedPractices ? pct(g.approvalRate) : '—',
                        raw: g.approvalRate,
                        label: 'Approval rate',
                        sub: 'Final grade of 3.0 or higher',
                    },
                    {
                        icon: 'fa-regular fa-clock',
                        value: fmt(g.loggedHours),
                        raw: g.loggedHours,
                        label: 'Hours logged',
                        sub: `${pct(g.hoursCompletion)} of ${fmt(
                            g.requiredHours
                        )} required`,
                    },
                    {
                        icon: 'fa-solid fa-building-columns',
                        value: fmt(g.institutions),
                        raw: g.institutions,
                        label: 'Institutions with practices',
                        sub: `${plural(
                            g.advisors,
                            'advisor',
                            'advisors'
                        )} involved`,
                    },
                ]}
            />
            <div className="dv-grid">
                <ReportCard
                    tab={T}
                    dataset={{
                        id: 'status',
                        title: 'Practice status',
                        columns: [
                            { key: 'status', label: 'Status' },
                            { key: 'practices', label: 'Practices', num: true },
                            {
                                key: 'share',
                                label: 'Share (%)',
                                num: true,
                                decimals: 1,
                            },
                        ],
                        rows: statusRows,
                    }}
                    sub="How the practices are distributed right now."
                >
                    <ReportStack
                        parts={g.statusBreakdown.map((s) => ({
                            label: s.label,
                            value: s.count,
                            cls: (byLabel[s.label] || STATUS.active).cls,
                        }))}
                        empty="There are no practices registered yet."
                    />
                </ReportCard>

                <ReportCard
                    tab={T}
                    dataset={{
                        id: 'grades',
                        title: 'Final grades',
                        columns: [
                            { key: 'range', label: 'Range' },
                            { key: 'practices', label: 'Practices', num: true },
                        ],
                        rows: bands.map((b) => ({
                            range: b.label,
                            practices: b.count,
                        })),
                    }}
                    sub="Practices by final grade."
                    note="The dashed line marks the minimum grade to pass (3.0)."
                >
                    <ReportColumns
                        labels={bands.map((b) => b.label.replace(' - ', ' – '))}
                        series={[
                            {
                                name: 'Practices',
                                cls: 'dv-s1',
                                values: bands.map((b) => b.count),
                            },
                        ]}
                        passBefore={1}
                        empty="There are no practices registered yet."
                    />
                </ReportCard>

                <ReportCard
                    tab={T}
                    dataset={{
                        id: 'monthly',
                        title: 'Practices started per month',
                        columns: [
                            { key: 'month', label: 'Month' },
                            { key: 'practices', label: 'Practices', num: true },
                        ],
                        rows: g.byMonth.map((m) => ({
                            month: m.month,
                            practices: m.count,
                        })),
                    }}
                    wide
                    sub="Last 12 months, by start date."
                >
                    <ReportColumns
                        labels={g.byMonth.map((m) => monthLabel(m.month))}
                        series={[
                            {
                                name: 'Practices started',
                                cls: 'dv-s1',
                                values: g.byMonth.map((m) => m.count),
                            },
                        ]}
                        tight
                        empty="No practice started in the last 12 months."
                    />
                </ReportCard>

                <ReportCard
                    tab={T}
                    dataset={{
                        id: 'programs',
                        title: 'Practices by program',
                        columns: [
                            { key: 'program', label: 'Program' },
                            { key: 'practices', label: 'Practices', num: true },
                        ],
                        rows: g.byProgram.map((p) => ({
                            program: p.name,
                            practices: p.count,
                        })),
                    }}
                    sub="Program of the student."
                >
                    <ReportHBars
                        items={g.byProgram.map((p) => ({
                            label: p.name,
                            value: p.count,
                            text: fmt(p.count),
                        }))}
                        empty="There are no practices registered yet."
                    />
                </ReportCard>

                <ReportCard
                    tab={T}
                    dataset={{
                        id: 'institutions',
                        title: 'Top institutions',
                        columns: [
                            { key: 'institution', label: 'Institution' },
                            { key: 'practices', label: 'Practices', num: true },
                        ],
                        rows: g.topInstitutions.map((p) => ({
                            institution: p.name,
                            practices: p.count,
                        })),
                    }}
                    sub="Institutions that host the most practices."
                >
                    <ReportHBars
                        items={g.topInstitutions.map((p) => ({
                            label: p.name,
                            value: p.count,
                            text: fmt(p.count),
                        }))}
                        empty="There are no practices registered yet."
                    />
                </ReportCard>

                <ReportCard
                    tab={T}
                    dataset={{
                        id: 'tutors',
                        title: 'Top tutors',
                        columns: [
                            { key: 'tutor', label: 'Tutor' },
                            { key: 'practices', label: 'Practices', num: true },
                        ],
                        rows: g.topTutors.map((p) => ({
                            tutor: p.name || 'Unassigned',
                            practices: p.count,
                        })),
                    }}
                    sub="Tutors with the most practices assigned."
                >
                    <ReportHBars
                        items={g.topTutors.map((p) => ({
                            label: p.name || 'Unassigned',
                            value: p.count,
                            text: fmt(p.count),
                        }))}
                        empty="There are no tutors assigned to practices yet."
                    />
                </ReportCard>
            </div>
        </>
    );
}

function TypesTab({ d }) {
    const T = 'types';
    const types = d.types;
    const totalPractices = sum(types, (t) => t.practices);
    const graded = types.filter((t) => t.averageGrade > 0);
    const top = types[0];
    const best = graded
        .slice()
        .sort((a, b) => b.averageGrade - a.averageGrade)[0];
    const lowest = types
        .filter((t) => t.approvalRate > 0 || t.averageGrade > 0)
        .sort((a, b) => a.approvalRate - b.approvalRate)[0];

    const parts = (t) => [
        { label: STATUS.active.label, value: t.active, cls: STATUS.active.cls },
        {
            label: STATUS.completed.label,
            value: t.completed,
            cls: STATUS.completed.cls,
        },
        {
            label: STATUS.cancelled.label,
            value: t.cancelled,
            cls: STATUS.cancelled.cls,
        },
    ];

    const summaryColumns = [
        { key: 'type', label: 'Practice type' },
        { key: 'semester', label: 'Semester', num: true },
        { key: 'requiredHours', label: 'Required hours', num: true },
        { key: 'practices', label: 'Practices', num: true },
        { key: 'students', label: 'Students', num: true },
        { key: 'percent', label: '% of practices', num: true, decimals: 1 },
        { key: 'active', label: 'Active', num: true },
        { key: 'completed', label: 'Completed', num: true },
        { key: 'cancelled', label: 'Cancelled', num: true },
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
    ];
    const summaryRows = types.map((t) => ({
        type: t.name,
        semester: t.semester,
        requiredHours: t.requiredHours,
        practices: t.practices,
        students: t.students,
        percent: t.percent,
        active: t.active,
        completed: t.completed,
        cancelled: t.cancelled,
        averageGrade: t.averageGrade || null,
        approvalRate: t.averageGrade > 0 ? t.approvalRate : null,
    }));

    return (
        <>
            <ReportKpis
                tab={T}
                id="kpis"
                title="Key figures"
                items={[
                    {
                        icon: 'fa-solid fa-layer-group',
                        value: fmt(types.length),
                        raw: types.length,
                        label: 'Practice types in use',
                        sub: `${plural(
                            totalPractices,
                            'practice',
                            'practices'
                        )} in total`,
                    },
                    {
                        icon: 'fa-solid fa-ranking-star',
                        value: top ? top.name : '—',
                        raw: top ? top.name : '',
                        label: 'Most used type',
                        sub: top
                            ? `${plural(
                                  top.practices,
                                  'practice',
                                  'practices'
                              )} · ${pct(top.percent)} of the total`
                            : 'No practices yet.',
                    },
                    {
                        icon: 'fa-solid fa-star',
                        value: best ? fmt(best.averageGrade, 2) : '—',
                        raw: best ? best.averageGrade : null,
                        label: 'Highest average grade',
                        sub: best ? best.name : 'No graded practices yet.',
                    },
                    {
                        icon: 'fa-solid fa-triangle-exclamation',
                        value: lowest ? pct(lowest.approvalRate) : '—',
                        raw: lowest ? lowest.approvalRate : null,
                        label: 'Lowest approval rate',
                        sub: lowest ? lowest.name : 'No graded practices yet.',
                        attn: Boolean(lowest && lowest.approvalRate < 70),
                    },
                ]}
            />
            <div className="dv-grid">
                <ReportCard
                    tab={T}
                    dataset={{
                        id: 'participation',
                        title: 'Participation by type',
                        columns: [
                            { key: 'type', label: 'Practice type' },
                            { key: 'students', label: 'Students', num: true },
                            { key: 'practices', label: 'Practices', num: true },
                            {
                                key: 'percent',
                                label: '% of practices',
                                num: true,
                                decimals: 1,
                            },
                        ],
                        rows: types.map((t) => ({
                            type: t.name,
                            students: t.students,
                            practices: t.practices,
                            percent: t.percent,
                        })),
                    }}
                    sub="Students enrolled in each practice type and its share of all practices."
                >
                    <ReportHBars
                        items={types.map((t) => ({
                            label: t.name,
                            value: t.students,
                            text: `${fmt(t.students)} · ${pct(t.percent)}`,
                        }))}
                        empty="There are no practice types with practices yet."
                    />
                </ReportCard>

                <ReportCard
                    tab={T}
                    dataset={{
                        id: 'status',
                        title: 'Status by type',
                        columns: [
                            { key: 'type', label: 'Practice type' },
                            { key: 'active', label: 'Active', num: true },
                            { key: 'completed', label: 'Completed', num: true },
                            { key: 'cancelled', label: 'Cancelled', num: true },
                        ],
                        rows: types.map((t) => ({
                            type: t.name,
                            active: t.active,
                            completed: t.completed,
                            cancelled: t.cancelled,
                        })),
                    }}
                    sub="Active, completed and cancelled practices of each type."
                >
                    {types.length ? (
                        <div className="rp-strows">
                            <div className="dv-legend rp-legend-top">
                                {Object.values(STATUS).map((s, idx) => (
                                    <span key={idx}>
                                        <i className={`dv-key ${s.cls}`} />
                                        {s.label}
                                    </span>
                                ))}
                            </div>
                            {types.map((t, idx) => (
                                <div key={idx} className="rp-strow">
                                    <span
                                        className="dv-hrow-label"
                                        title={t.name}
                                    >
                                        {t.name}
                                    </span>
                                    <ReportStack
                                        parts={parts(t)}
                                        legend={false}
                                    />
                                    <span className="dv-hrow-val">
                                        {fmt(t.practices)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <ReportEmpty text="There are no practice types with practices yet." />
                    )}
                </ReportCard>

                <ReportCard
                    tab={T}
                    dataset={{
                        id: 'grade',
                        title: 'Average grade by type',
                        columns: [
                            { key: 'type', label: 'Practice type' },
                            {
                                key: 'average',
                                label: 'Average grade',
                                num: true,
                                decimals: 2,
                            },
                        ],
                        rows: types.map((t) => ({
                            type: t.name,
                            average: t.averageGrade || null,
                        })),
                    }}
                    sub="Only graded practices (scale 0 – 5)."
                >
                    <ReportHBars
                        items={types
                            .filter((t) => t.averageGrade > 0)
                            .map((t) => ({
                                label: t.name,
                                value: t.averageGrade,
                                text: fmt(t.averageGrade, 2),
                                cls: gradeLevel(t.averageGrade),
                            }))}
                        max={5}
                        empty="No graded practices yet."
                    />
                </ReportCard>

                <ReportCard
                    tab={T}
                    dataset={{
                        id: 'approval',
                        title: 'Approval rate by type',
                        columns: [
                            { key: 'type', label: 'Practice type' },
                            {
                                key: 'rate',
                                label: 'Approval rate (%)',
                                num: true,
                                decimals: 1,
                            },
                        ],
                        rows: types.map((t) => ({
                            type: t.name,
                            rate: t.averageGrade > 0 ? t.approvalRate : null,
                        })),
                    }}
                    sub="Graded practices with a final grade of 3.0 or higher."
                >
                    <ReportHBars
                        items={types
                            .filter((t) => t.averageGrade > 0)
                            .map((t) => ({
                                label: t.name,
                                value: t.approvalRate,
                                text: pct(t.approvalRate),
                                cls: level(t.approvalRate),
                            }))}
                        max={100}
                        empty="No graded practices yet."
                    />
                </ReportCard>

                <ReportCard
                    tab={T}
                    dataset={{
                        id: 'summary',
                        title: 'Summary table',
                        columns: summaryColumns,
                        rows: summaryRows,
                    }}
                    wide
                    noTable
                    sub="Everything about each practice type in one table."
                >
                    <ReportTable
                        columns={summaryColumns}
                        rows={summaryRows}
                        empty="There are no practice types with practices yet."
                    />
                </ReportCard>
            </div>
        </>
    );
}

function PracticeTab({ d }) {
    const T = 'practice';
    const p = d.practice;
    const a = p.activities;

    const activityParts = [
        { label: 'Graded', value: a.graded, cls: 'dv-s3' },
        { label: 'With tutor feedback', value: a.completed, cls: 'dv-s1' },
        {
            label: 'Evidence awaiting feedback',
            value: a.pendingReview,
            cls: 'dv-s2',
        },
        { label: 'No evidence yet', value: a.pending, cls: 'rp-s4' },
    ];

    const endingCols = [
        { key: 'code', label: 'Practice ID' },
        { key: 'student', label: 'Student' },
        { key: 'institution', label: 'Institution' },
        { key: 'endDate', label: 'End date', render: (v) => day(v) },
    ];
    const endingCardCols = endingCols.concat([
        { key: 'daysLeft', label: 'Days left', num: true },
    ]);
    const overdueCols = endingCols.concat([
        { key: 'daysOverdue', label: 'Days overdue', num: true },
    ]);

    return (
        <>
            <ReportKpis
                tab={T}
                id="kpis"
                title="Key figures"
                items={[
                    {
                        icon: 'fa-regular fa-file-lines',
                        value: fmt(p.total),
                        raw: p.total,
                        label: 'Total practices',
                        sub: plural(
                            p.totalStudents,
                            'student teacher',
                            'student teachers'
                        ),
                    },
                    {
                        icon: 'fa-solid fa-triangle-exclamation',
                        value: fmt(p.withoutEvidence),
                        raw: p.withoutEvidence,
                        label: 'Without evidence',
                        sub: p.withoutEvidence
                            ? 'No evidence uploaded yet.'
                            : 'Every practice has evidence.',
                        attn: p.withoutEvidence > 0,
                    },
                    {
                        icon: 'fa-solid fa-list-check',
                        value: fmt(a.total),
                        raw: a.total,
                        label: 'Activities',
                        sub: plural(
                            a.graded,
                            'graded activity',
                            'graded activities'
                        ),
                    },
                    {
                        icon: 'fa-regular fa-clock',
                        value: pct(p.hours.percent),
                        raw: p.hours.percent,
                        label: 'Hours completed',
                        sub: `${fmt(p.hours.logged)} of ${fmt(
                            p.hours.required
                        )} required hours`,
                    },
                    {
                        icon: 'fa-regular fa-calendar',
                        value: fmt(p.endingSoon.length),
                        raw: p.endingSoon.length,
                        label: 'Ending in 30 days',
                        sub: p.endingSoon.length
                            ? 'Active practices close to their end date.'
                            : 'None.',
                    },
                    {
                        icon: 'fa-solid fa-calendar-xmark',
                        value: fmt(p.overdue.length),
                        raw: p.overdue.length,
                        label: 'Past their end date',
                        sub: p.overdue.length
                            ? 'Still active after the end date.'
                            : 'None.',
                        attn: p.overdue.length > 0,
                    },
                ]}
            />
            <div className="dv-grid">
                <ReportCard
                    tab={T}
                    dataset={{
                        id: 'status',
                        title: 'Logbook status',
                        columns: [
                            { key: 'status', label: 'Status' },
                            { key: 'practices', label: 'Practices', num: true },
                            {
                                key: 'share',
                                label: 'Share (%)',
                                num: true,
                                decimals: 1,
                            },
                        ],
                        rows: p.status.map((s) => ({
                            status: s.label,
                            practices: s.count,
                            share: s.percent,
                        })),
                    }}
                    sub="Active logbooks versus closed ones (completed or cancelled)."
                >
                    <ReportStack
                        parts={p.status.map((s, i) => ({
                            label: s.label,
                            value: s.count,
                            cls: i === 0 ? 'dv-s1' : 'dv-s3',
                        }))}
                        empty="There are no practices registered yet."
                    />
                </ReportCard>

                <ReportCard
                    tab={T}
                    dataset={{
                        id: 'activities',
                        title: 'Activities progress',
                        columns: [
                            { key: 'state', label: 'State' },
                            {
                                key: 'activities',
                                label: 'Activities',
                                num: true,
                            },
                        ],
                        rows: activityParts.map((s) => ({
                            state: s.label,
                            activities: s.value,
                        })),
                    }}
                    sub="Where each activity of the logbooks currently stands."
                    note={
                        a.graded
                            ? `Average grade of the graded activities: ${fmt(
                                  a.averageGrade,
                                  2
                              )} / 5.0.`
                            : null
                    }
                >
                    <ReportStack
                        parts={activityParts}
                        empty="There are no activities yet."
                    />
                </ReportCard>

                <ReportCard
                    tab={T}
                    dataset={{
                        id: 'hours',
                        title: 'Hours',
                        columns: [
                            { key: 'concept', label: 'Concept' },
                            { key: 'hours', label: 'Hours', num: true },
                        ],
                        rows: [
                            { concept: 'Required', hours: p.hours.required },
                            { concept: 'Logged', hours: p.hours.logged },
                            {
                                concept: 'Completion (%)',
                                hours: p.hours.percent,
                            },
                        ],
                    }}
                    sub="Hours registered in the evidence versus the hours the practice types require."
                    note="Cancelled practices are not counted."
                >
                    <ReportHBars
                        items={[
                            {
                                label: 'Required',
                                value: p.hours.required,
                                text: `${fmt(p.hours.required)} h`,
                            },
                            {
                                label: 'Logged',
                                value: p.hours.logged,
                                text: `${fmt(p.hours.logged)} h · ${pct(
                                    p.hours.percent
                                )}`,
                                cls: 'dv-fill--good',
                            },
                        ]}
                        max={Math.max(p.hours.required, p.hours.logged, 1)}
                    />
                </ReportCard>

                <ReportCard
                    tab={T}
                    dataset={{
                        id: 'progress',
                        title: 'Lowest hours progress',
                        columns: [
                            { key: 'code', label: 'Practice ID' },
                            { key: 'student', label: 'Student' },
                            { key: 'logged', label: 'Logged h', num: true },
                            { key: 'required', label: 'Required h', num: true },
                            {
                                key: 'percent',
                                label: 'Progress (%)',
                                num: true,
                            },
                        ],
                        rows: p.lowestProgress,
                    }}
                    sub="Active practices that are further behind (top 10)."
                >
                    <ReportHBars
                        items={p.lowestProgress.map((r) => ({
                            label: `${r.student} · ${r.code}`,
                            value: r.percent,
                            text: `${pct(r.percent, 0)} · ${fmt(
                                r.logged
                            )}/${fmt(r.required)} h`,
                            cls: level(r.percent),
                        }))}
                        max={100}
                        empty="There are no active practices."
                    />
                </ReportCard>

                <ReportCard
                    tab={T}
                    dataset={{
                        id: 'ending',
                        title: 'Ending in the next 30 days',
                        columns: endingCardCols,
                        rows: p.endingSoon,
                    }}
                    wide
                    noTable
                    sub="Active practices whose end date is within a month."
                >
                    <ReportTable
                        columns={endingCardCols}
                        rows={p.endingSoon}
                        empty="No active practice ends within the next 30 days."
                    />
                </ReportCard>

                <ReportCard
                    tab={T}
                    dataset={{
                        id: 'overdue',
                        title: 'Past their end date',
                        columns: overdueCols,
                        rows: p.overdue,
                    }}
                    wide
                    noTable
                    sub="Practices that are still active after their end date."
                >
                    <ReportTable
                        columns={overdueCols}
                        rows={p.overdue}
                        empty="No active practice is past its end date."
                    />
                </ReportCard>

                <ReportCard
                    tab={T}
                    dataset={{
                        id: 'noEvidence',
                        title: 'Practices without evidence',
                        columns: practiceTable,
                        rows: p.withoutEvidenceList,
                    }}
                    wide
                    noTable
                    sub="No evidence has been uploaded to any activity (up to 100 most recent)."
                >
                    <ReportTable
                        columns={practiceTable}
                        rows={p.withoutEvidenceList}
                        empty="Every practice already has evidence uploaded."
                    />
                </ReportCard>
            </div>
        </>
    );
}

function FeedbackTab({ d }) {
    const T = 'feedback';
    const f = d.feedback;
    const total = d.practice.total;
    const e = f.evidence;

    const coverageParts = [
        { label: 'Tutor and advisor', value: e.both, cls: 'dv-s3' },
        { label: 'Tutor only', value: e.tutorOnly, cls: 'dv-s1' },
        { label: 'Advisor only', value: e.advisorOnly, cls: 'dv-s2' },
        { label: 'No feedback', value: e.none, cls: 'rp-s4' },
    ];

    return (
        <>
            <ReportKpis
                tab={T}
                id="kpis"
                title="Key figures"
                items={[
                    {
                        icon: 'fa-solid fa-comments',
                        value: fmt(f.tutorFeedback),
                        raw: f.tutorFeedback,
                        label: 'Tutor feedback',
                        sub: 'Comments written by academic tutors.',
                    },
                    {
                        icon: 'fa-solid fa-comment-dots',
                        value: fmt(f.advisorFeedback),
                        raw: f.advisorFeedback,
                        label: 'Advisor feedback',
                        sub: 'Comments written by pedagogical advisors.',
                    },
                    {
                        icon: 'fa-solid fa-clipboard-check',
                        value: pct(f.evidence.reviewedPercent),
                        raw: f.evidence.reviewedPercent,
                        label: 'Evidence with feedback',
                        sub: `${fmt(f.evidence.total - f.evidence.none)} of ${fmt(
                            f.evidence.total
                        )} evidence items`,
                    },
                    {
                        icon: 'fa-solid fa-scale-balanced',
                        value: total
                            ? fmt(
                                  (f.tutorFeedback + f.advisorFeedback) / total,
                                  1
                              )
                            : '—',
                        raw: total
                            ? Math.round(
                                  (10 * (f.tutorFeedback + f.advisorFeedback)) /
                                      total
                              ) / 10
                            : null,
                        label: 'Feedback per practice',
                        sub: 'Tutor and advisor comments together.',
                    },
                    {
                        icon: 'fa-solid fa-triangle-exclamation',
                        value: fmt(f.practicesWithoutTutorFeedback),
                        raw: f.practicesWithoutTutorFeedback,
                        label: 'Without tutor feedback',
                        sub: `${pct(
                            share(f.practicesWithoutTutorFeedback, total),
                            0
                        )} of the practices`,
                        attn: f.practicesWithoutTutorFeedback > 0,
                    },
                    {
                        icon: 'fa-solid fa-triangle-exclamation',
                        value: fmt(f.practicesWithoutAdvisorFeedback),
                        raw: f.practicesWithoutAdvisorFeedback,
                        label: 'Without advisor feedback',
                        sub: `${pct(
                            share(f.practicesWithoutAdvisorFeedback, total),
                            0
                        )} of the practices`,
                        attn: f.practicesWithoutAdvisorFeedback > 0,
                    },
                ]}
            />
            <div className="dv-grid">
                <ReportCard
                    tab={T}
                    dataset={{
                        id: 'monthly',
                        title: 'Feedback per month',
                        columns: [
                            { key: 'month', label: 'Month' },
                            { key: 'tutor', label: 'Tutor', num: true },
                            { key: 'advisor', label: 'Advisor', num: true },
                        ],
                        rows: f.byMonth,
                    }}
                    wide
                    sub="Comments written in the last 12 months."
                >
                    <ReportColumns
                        labels={f.byMonth.map((m) => monthLabel(m.month))}
                        series={[
                            {
                                name: 'Tutor',
                                cls: 'dv-s1',
                                values: f.byMonth.map((m) => m.tutor),
                            },
                            {
                                name: 'Advisor',
                                cls: 'dv-s2',
                                values: f.byMonth.map((m) => m.advisor),
                            },
                        ]}
                        tight
                        legend
                        empty="No feedback was written in the last 12 months."
                    />
                </ReportCard>

                <ReportCard
                    tab={T}
                    dataset={{
                        id: 'coverage',
                        title: 'Evidence coverage',
                        columns: [
                            { key: 'feedback', label: 'Feedback received' },
                            {
                                key: 'evidence',
                                label: 'Evidence items',
                                num: true,
                            },
                        ],
                        rows: coverageParts.map((s) => ({
                            feedback: s.label,
                            evidence: s.value,
                        })),
                    }}
                    sub="Who has already commented on each evidence item."
                >
                    <ReportStack
                        parts={coverageParts}
                        empty="There is no evidence uploaded yet."
                    />
                </ReportCard>

                <ReportCard
                    tab={T}
                    dataset={{
                        id: 'tutors',
                        title: 'Most active tutors',
                        columns: [
                            { key: 'tutor', label: 'Tutor' },
                            { key: 'feedback', label: 'Feedback', num: true },
                        ],
                        rows: f.topTutors.map((r) => ({
                            tutor: r.name,
                            feedback: r.count,
                        })),
                    }}
                    sub="Tutors with the most comments (top 5)."
                >
                    <ReportHBars
                        items={f.topTutors.map((r) => ({
                            label: r.name,
                            value: r.count,
                            text: fmt(r.count),
                        }))}
                        empty="There is no tutor feedback yet."
                    />
                </ReportCard>

                <ReportCard
                    tab={T}
                    dataset={{
                        id: 'advisors',
                        title: 'Most active advisors',
                        columns: [
                            { key: 'advisor', label: 'Advisor' },
                            { key: 'feedback', label: 'Feedback', num: true },
                        ],
                        rows: f.topAdvisors.map((r) => ({
                            advisor: r.name,
                            feedback: r.count,
                        })),
                    }}
                    sub="Advisors with the most comments (top 5)."
                >
                    <ReportHBars
                        items={f.topAdvisors.map((r) => ({
                            label: r.name,
                            value: r.count,
                            text: fmt(r.count),
                        }))}
                        empty="There is no advisor feedback yet."
                    />
                </ReportCard>

                <ReportCard
                    tab={T}
                    dataset={{
                        id: 'noTutor',
                        title: 'Practices without tutor feedback',
                        columns: practiceTable,
                        rows: f.withoutTutorFeedbackList,
                    }}
                    wide
                    noTable
                    sub="No tutor comment on any evidence (up to 100 most recent)."
                >
                    <ReportTable
                        columns={practiceTable}
                        rows={f.withoutTutorFeedbackList}
                        empty="Every practice already has tutor feedback."
                    />
                </ReportCard>

                <ReportCard
                    tab={T}
                    dataset={{
                        id: 'noAdvisor',
                        title: 'Practices without advisor feedback',
                        columns: practiceTable,
                        rows: f.withoutAdvisorFeedbackList,
                    }}
                    wide
                    noTable
                    sub="No advisor comment on any evidence (up to 100 most recent)."
                >
                    <ReportTable
                        columns={practiceTable}
                        rows={f.withoutAdvisorFeedbackList}
                        empty="Every practice already has advisor feedback."
                    />
                </ReportCard>
            </div>
        </>
    );
}

function InstitutionsTab({ d }) {
    const T = 'institutions';
    const i = d.institutions;
    const details = i.details;

    const parts = (r) => [
        { label: 'Active', value: r.activePractices, cls: STATUS.active.cls },
        {
            label: 'Completed',
            value: r.completedPractices,
            cls: STATUS.completed.cls,
        },
        {
            label: 'Cancelled',
            value: Math.max(
                0,
                r.practices - r.activePractices - r.completedPractices
            ),
            cls: STATUS.cancelled.cls,
        },
    ];

    const graded = details.filter((r) => r.averageGrade > 0);

    const detailColumns = [
        { key: 'institution', label: 'Institution' },
        { key: 'taxId', label: 'Tax ID (NIT)' },
        { key: 'address', label: 'Address' },
        { key: 'manager', label: 'Manager' },
        { key: 'email', label: 'Email' },
        { key: 'students', label: 'Student teachers', num: true },
        { key: 'practices', label: 'Practices', num: true },
        {
            key: 'activeStudents',
            label: 'Active student teachers',
            num: true,
        },
        {
            key: 'completedStudents',
            label: 'Completed student teachers',
            num: true,
        },
        {
            key: 'averageGrade',
            label: 'Average grade',
            num: true,
            decimals: 2,
        },
    ];
    const detailRows = details.map((r) => ({
        ...r,
        averageGrade: r.averageGrade || null,
    }));

    return (
        <>
            <ReportKpis
                tab={T}
                id="kpis"
                title="Key figures"
                items={[
                    {
                        icon: 'fa-solid fa-building-columns',
                        value: fmt(i.total),
                        raw: i.total,
                        label: 'Institutions registered',
                        sub: `${plural(
                            i.withPractices,
                            'institution',
                            'institutions'
                        )} with practices`,
                    },
                    {
                        icon: 'fa-solid fa-user-graduate',
                        value: fmt(i.withActiveStudents),
                        raw: i.withActiveStudents,
                        label: 'With active student teachers',
                        sub: 'At least one active practice.',
                    },
                    {
                        icon: 'fa-solid fa-flag-checkered',
                        value: fmt(i.completedOnly),
                        raw: i.completedOnly,
                        label: 'Only completed practices',
                        sub: 'No active practice right now.',
                    },
                    {
                        icon: 'fa-solid fa-people-group',
                        value: fmt(i.totalStudents),
                        raw: i.totalStudents,
                        label: 'Student teachers hosted',
                        sub: 'Distinct students with a practice.',
                    },
                ]}
            />
            <div className="dv-grid">
                <ReportCard
                    tab={T}
                    dataset={{
                        id: 'distribution',
                        title: 'Student teachers per institution',
                        columns: [
                            { key: 'institution', label: 'Institution' },
                            {
                                key: 'students',
                                label: 'Student teachers',
                                num: true,
                            },
                        ],
                        rows: i.distribution.map((r) => ({
                            institution: r.name,
                            students: r.count,
                        })),
                    }}
                    sub="Institutions that host the most student teachers."
                    note={
                        i.distribution.length > 10
                            ? 'Top 10 shown. The table lists all of them.'
                            : null
                    }
                >
                    <ReportHBars
                        items={i.distribution.slice(0, 10).map((r) => ({
                            label: r.name,
                            value: r.count,
                            text: fmt(r.count),
                        }))}
                        empty="There are no institutions with practices yet."
                    />
                </ReportCard>

                <ReportCard
                    tab={T}
                    dataset={{
                        id: 'status',
                        title: 'Practices by status',
                        columns: [
                            { key: 'institution', label: 'Institution' },
                            { key: 'active', label: 'Active', num: true },
                            { key: 'completed', label: 'Completed', num: true },
                            { key: 'cancelled', label: 'Cancelled', num: true },
                        ],
                        rows: details.map((r) => {
                            const [a, c, x] = parts(r);
                            return {
                                institution: r.institution,
                                active: a.value,
                                completed: c.value,
                                cancelled: x.value,
                            };
                        }),
                    }}
                    sub="Active, completed and cancelled practices of each institution."
                >
                    {details.length ? (
                        <div className="rp-strows">
                            <div className="dv-legend rp-legend-top">
                                {Object.values(STATUS).map((s, idx) => (
                                    <span key={idx}>
                                        <i className={`dv-key ${s.cls}`} />
                                        {s.label}
                                    </span>
                                ))}
                            </div>
                            {details.slice(0, 10).map((r, idx) => (
                                <div key={idx} className="rp-strow">
                                    <span
                                        className="dv-hrow-label"
                                        title={r.institution}
                                    >
                                        {r.institution}
                                    </span>
                                    <ReportStack
                                        parts={parts(r)}
                                        legend={false}
                                    />
                                    <span className="dv-hrow-val">
                                        {fmt(r.practices)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <ReportEmpty text="There are no institutions with practices yet." />
                    )}
                </ReportCard>

                <ReportCard
                    tab={T}
                    dataset={{
                        id: 'grade',
                        title: 'Average grade by institution',
                        columns: [
                            { key: 'institution', label: 'Institution' },
                            {
                                key: 'average',
                                label: 'Average grade',
                                num: true,
                                decimals: 2,
                            },
                        ],
                        rows: details.map((r) => ({
                            institution: r.institution,
                            average: r.averageGrade || null,
                        })),
                    }}
                    sub="Only graded practices (scale 0 – 5)."
                >
                    <ReportHBars
                        items={graded.slice(0, 10).map((r) => ({
                            label: r.institution,
                            value: r.averageGrade,
                            text: fmt(r.averageGrade, 2),
                            cls: gradeLevel(r.averageGrade),
                        }))}
                        max={5}
                        empty="No graded practices yet."
                    />
                </ReportCard>

                <ReportCard
                    tab={T}
                    dataset={{
                        id: 'details',
                        title: 'Institution details',
                        columns: detailColumns,
                        rows: detailRows,
                    }}
                    wide
                    noTable
                    sub="Contact data and activity of every institution with practices."
                >
                    <ReportTable
                        columns={detailColumns}
                        rows={detailRows}
                        empty="There are no institutions with practices yet."
                    />
                </ReportCard>
            </div>
        </>
    );
}

const TAB_COMPONENTS = {
    general: GeneralTab,
    types: TypesTab,
    practice: PracticeTab,
    feedback: FeedbackTab,
    institutions: InstitutionsTab,
};

export default function ReportsDashboardApp() {
    const [dashboard, setDashboard] = useState(null);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);

    const exportTabs = useCallback((currentKey) => {
        const ordered = TABS.slice().sort((a, b) =>
            a.key === currentKey ? -1 : b.key === currentKey ? 1 : 0
        );
        const sections = [];
        ordered.forEach((tab) => {
            const entry = registry.get(tab.key);
            if (!entry) return;
            entry.datasets.forEach((ds) =>
                sections.push({
                    id: `${tab.key}:${ds.id}`,
                    label: ds.title,
                    group:
                        tab.label +
                        (tab.key === currentKey ? ' (this tab)' : ''),
                    checked: tab.key === currentKey,
                })
            );
        });
        const current = TABS.find((t) => t.key === currentKey);
        openExport({
            title: 'Export reports',
            subtitle:
                'Choose the information you need. You can include other tabs too.',
            sections,
            build: ({ sections: selected }) => {
                const datasets = [];
                TABS.forEach((tab) => {
                    const entry = registry.get(tab.key);
                    if (!entry) return;
                    entry.datasets.forEach((ds) => {
                        if (selected.has(`${tab.key}:${ds.id}`))
                            datasets.push({
                                ...ds,
                                id: `${tab.key}-${ds.id}`,
                                title: `${tab.label} · ${ds.title}`,
                            });
                    });
                });
                const tabsUsed = new Set(
                    [...selected].map((s) => s.split(':')[0])
                );
                const only =
                    tabsUsed.size === 1
                        ? current && tabsUsed.has(current.key)
                            ? current
                            : TABS.find((t) => tabsUsed.has(t.key))
                        : null;
                return {
                    datasets,
                    base: only ? `reports-${only.key}` : 'reports',
                    title: only ? `Reports · ${only.label}` : 'Reports',
                    subtitle: 'Reports and Statistics',
                    mode: 'panel',
                    json: {
                        title: only ? `Reports · ${only.label}` : 'Reports',
                        generatedAt: new Date().toISOString(),
                        data: datasetsToJson(
                            datasets.map((d) => ({ ...d, columns: d.columns }))
                        ),
                    },
                };
            },
        });
    }, []);

    const reload = useCallback(async () => {
        setLoading((prev) => {
            if (prev) return prev;
            return true;
        });
        document.body.classList.add('is-loading-wait');
        const acc = getPanelElement('rep-accreditation-toolbar');
        if (acc) acc.style.display = 'none';

        try {
            const accApi = inject('accreditation');
            if (accApi && typeof accApi.reload === 'function') {
                accApi.reload().catch(() => {});
            }
            const res = await get('/api/reports/dashboard');
            TABS.forEach((tab) => resetTab(tab.key, tab.label));
            setErrorMsg(null);
            setDashboard(res.dashboard);
        } catch (err) {
            setErrorMsg(
                (err && err.message) || 'The reports could not be loaded.'
            );
            showError(err);
        } finally {
            setLoading(false);
            document.body.classList.remove('is-loading-wait');
            if (acc) acc.style.display = '';
        }
    }, []);

    useEffect(() => {
        const unsub = provide('reports', { reload: () => reload(), tabs: TABS });
        if (TABS.some((t) => getPanelElement(t.root))) {
            reload();
        }
        return unsub;
    }, [reload]);

    return (
        <>
            {TABS.map((tab) => {
                const headContainer = getPanelElement(tab.header);
                const rootContainer = getPanelElement(tab.root);
                const meta = TAB_META[tab.key] || {
                    title: tab.label,
                    sub: '',
                    glossary: [],
                };
                const TabComp = TAB_COMPONENTS[tab.key];

                return (
                    <React.Fragment key={tab.key}>
                        {headContainer
                            ? createPortal(
                                  <ReportToolbar
                                      title={meta.title}
                                      sub={meta.sub}
                                      glossary={meta.glossary}
                                      updated={
                                          dashboard
                                              ? dashboard.generatedAt
                                              : null
                                      }
                                      loading={loading}
                                      onRefresh={() => reload()}
                                      onExport={() => exportTabs(tab.key)}
                                  />,
                                  headContainer
                              )
                            : null}
                        {rootContainer
                            ? createPortal(
                                  loading ? (
                                      <p className="ev-loading">Cargando…</p>
                                  ) : errorMsg && !dashboard ? (
                                      <div className="dv-empty">
                                          <i
                                              className="fa-solid fa-plug-circle-exclamation"
                                              aria-hidden="true"
                                          />
                                          {errorMsg}
                                      </div>
                                  ) : dashboard && TabComp ? (
                                      <TabComp d={dashboard} />
                                  ) : null,
                                  rootContainer
                              )
                            : null}
                    </React.Fragment>
                );
            })}
        </>
    );
}
