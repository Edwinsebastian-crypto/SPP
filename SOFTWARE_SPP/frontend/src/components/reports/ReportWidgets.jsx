import React, { useState, useRef, useEffect } from 'react';
import { Icon } from '../common/Badge';

export const fmt = (n, decimals) =>
    n === null || n === undefined || n === '' || Number.isNaN(Number(n))
        ? '—'
        : Number(n).toLocaleString('en-US', {
              maximumFractionDigits: decimals === undefined ? 0 : decimals,
          });

export const pct = (n, decimals) =>
    n === null || n === undefined || Number.isNaN(Number(n))
        ? '—'
        : fmt(n, decimals === undefined ? 1 : decimals) + ' %';

const MONTHS = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
];
export const monthLabel = (m) =>
    MONTHS[Number(String(m).slice(5, 7)) - 1] + ' ' + String(m).slice(2, 4);

export const plural = (n, one, many) =>
    fmt(n) + ' ' + (Number(n) === 1 ? one : many);

export const dateTime = (iso) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
        ? '—'
        : d.toLocaleString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
          });
};

export const day = (value) => (value ? String(value).slice(0, 10) : '—');

export function ReportEmpty({ text, icon, ic }) {
    return (
        <div className="dv-empty">
            <Icon name={icon || ic || 'fa-regular fa-folder-open'} />
            {text || 'There is no data yet.'}
        </div>
    );
}

export function ReportTable({ columns, rows, empty, striped, opts }) {
    const emptyText = empty ?? opts?.empty;
    const isStriped = striped ?? opts?.striped;
    if (!rows || !rows.length) {
        return <ReportEmpty text={emptyText || 'There is no data yet.'} />;
    }
    return (
        <div className="dv-tablewrap">
            <table className={`dv-table${isStriped ? ' rp-striped' : ''}`}>
                <thead>
                    <tr>
                        {columns.map((c, idx) => (
                            <th
                                key={c.key || idx}
                                scope="col"
                                className={c.num ? 'num' : undefined}
                            >
                                {c.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, rIdx) => (
                        <tr key={rIdx}>
                            {columns.map((c, cIdx) => {
                                const raw = row[c.key];
                                let content;
                                if (c.render) {
                                    content = c.render(raw, row);
                                } else if (typeof raw === 'number') {
                                    content = fmt(
                                        raw,
                                        c.decimals === undefined
                                            ? Number.isInteger(raw)
                                                ? 0
                                                : 2
                                            : c.decimals
                                    );
                                } else {
                                    content =
                                        raw === null ||
                                        raw === undefined ||
                                        raw === ''
                                            ? '—'
                                            : raw;
                                }
                                return (
                                    <td
                                        key={c.key || cIdx}
                                        className={c.num ? 'num' : undefined}
                                    >
                                        {content}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export function ReportStack({ parts, empty, compact, legend, opts }) {
    const emptyText = empty ?? opts?.empty;
    const isCompact = compact ?? opts?.compact;
    const showLegend = legend !== undefined ? legend : opts?.legend !== undefined ? opts.legend : true;
    const total = (parts || []).reduce(
        (sum, p) => sum + (Number(p.value) || 0),
        0
    );
    if (!total) {
        return <ReportEmpty text={emptyText || 'There is no data yet.'} />;
    }
    return (
        <div className={isCompact ? 'rp-stack-compact' : undefined}>
            <div
                className="dv-stack"
                role="img"
                aria-label={parts.map((p) => p.label + ': ' + p.value).join(', ')}
            >
                {parts.map((p, idx) => (
                    <div
                        key={idx}
                        className={`dv-seg ${p.cls}${p.value ? '' : ' dv-seg--zero'}`}
                        style={{ flex: `${p.value || 0} 1 0` }}
                        data-tip={`${p.label}: ${fmt(p.value)} (${fmt((p.value / total) * 100, 1)} %)`}
                        tabIndex={0}
                    >
                        {p.value / total >= 0.08 ? String(p.value) : ''}
                    </div>
                ))}
            </div>
            {showLegend === false ? null : (
                <div className="dv-legend">
                    {parts.map((p, idx) => (
                        <span key={idx}>
                            <i className={`dv-key ${p.cls}`} />
                            {p.label + ' '}
                            <b>{fmt(p.value)}</b>
                            {' (' + fmt((p.value / total) * 100) + ' %)'}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

export function ReportHBars({ items, rows, max: maxProp, empty, opts }) {
    const list = items || rows;
    const emptyText = empty ?? opts?.empty;
    if (!list || !list.length) {
        return <ReportEmpty text={emptyText || 'There is no data yet.'} />;
    }
    const max =
        maxProp || opts?.max || Math.max(1, ...list.map((i) => Number(i.value) || 0));
    return (
        <div className="dv-hbars">
            {list.map((i, idx) => (
                <div key={idx} className="dv-hrow">
                    <span className="dv-hrow-label" title={i.label}>
                        {i.label}
                    </span>
                    <div
                        className="dv-track"
                        data-tip={
                            i.tip ||
                            `${i.label}: ${i.text || fmt(i.value, 2)}`
                        }
                        tabIndex={0}
                    >
                        <div
                            className={`dv-fill ${i.cls || ''}`}
                            style={{
                                width: `${Math.max(0, Math.min(100, ((Number(i.value) || 0) / max) * 100))}%`,
                            }}
                        />
                    </div>
                    <span className="dv-hrow-val">
                        {i.text || fmt(i.value, 2)}
                    </span>
                </div>
            ))}
        </div>
    );
}

export function ReportColumns({ labels, series, tight, passBefore, legend, empty, opts }) {
    const isTight = tight ?? opts?.tight;
    const passIdx = passBefore ?? opts?.passBefore;
    const showLegend = legend ?? opts?.legend;
    const emptyText = empty ?? opts?.empty;
    const max = Math.max(
        0,
        ...(series || []).flatMap((s) =>
            (s.values || []).map((v) => Number(v) || 0)
        )
    );
    if (!max) {
        return <ReportEmpty text={emptyText || 'There is no activity yet.'} />;
    }
    return (
        <div>
            <div
                className={`dv-cols${isTight ? ' dv-cols--tight' : ''}`}
                role="img"
                aria-label={`${series[0]?.name || ''} by ${(labels || []).join(', ')}`}
            >
                {(labels || []).map((label, index) => (
                    <React.Fragment key={index}>
                        {passIdx === index ? (
                            <i className="dv-pass-line" aria-hidden="true" />
                        ) : null}
                        <div className="dv-col">
                            {series.map((s, sIdx) => {
                                const value = Number(s.values[index]) || 0;
                                return (
                                    <div
                                        key={sIdx}
                                        className={`dv-bar ${s.cls}${value ? '' : ' dv-bar--zero'}`}
                                        style={{
                                            height: `${(value / max) * 100}%`,
                                        }}
                                        data-tip={`${label} · ${s.name}: ${fmt(value)}`}
                                        tabIndex={0}
                                    >
                                        <span>{String(value)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </React.Fragment>
                ))}
            </div>
            <div className={`dv-xaxis${isTight ? ' dv-xaxis--tight' : ''}`}>
                {(labels || []).map((l, idx) => (
                    <span key={idx}>{l}</span>
                ))}
            </div>
            {series.length > 1 || showLegend ? (
                <div className="dv-legend">
                    {series.map((s, idx) => (
                        <span key={idx}>
                            <i className={`dv-key ${s.cls}`} />
                            {s.name}
                        </span>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

export function ReportKpiGrid({ items, extraClass = '', cls = '' }) {
    const className = cls || extraClass;
    return (
        <div className={`dv-kpis ${className}`}>
            {(items || []).map((k, idx) => (
                <div
                    key={idx}
                    className={`dv-kpi${k.attn ? ' dv-kpi--attn' : ''}`}
                >
                    <div className="dv-kpi-icon">
                        <Icon name={k.icon} />
                    </div>
                    <div className="dv-kpi-body">
                        <span
                            className={`dv-kpi-value${String(k.value).length > 8 ? ' rp-kpi-text' : ''}`}
                        >
                            {k.value}
                        </span>
                        <span className="dv-kpi-label">{k.label}</span>
                        {k.sub ? (
                            <span className="dv-kpi-sub">{k.sub}</span>
                        ) : null}
                    </div>
                </div>
            ))}
        </div>
    );
}

export function ReportKpis({ tab, id, title, items }) {
    const gridRef = useRef(null);

    useEffect(() => {
        if (window.SPP?.reportKit?.register && gridRef.current) {
            window.SPP.reportKit.register(tab, {
                id,
                title,
                node: gridRef.current,
                columns: [
                    { key: 'metric', label: 'Metric' },
                    { key: 'value', label: 'Value' },
                    { key: 'detail', label: 'Detail' },
                ],
                rows: (items || []).map((k) => ({
                    metric: k.label,
                    value: k.raw !== undefined ? k.raw : k.value,
                    detail: k.sub || '',
                })),
            });
        }
    });

    return (
        <div
            ref={gridRef}
            className="dv-kpis rp-kpis"
            data-ds={`${tab}:${id}`}
        >
            {(items || []).map((k, idx) => (
                <div
                    key={idx}
                    className={`dv-kpi${k.attn ? ' dv-kpi--attn' : ''}`}
                >
                    <div className="dv-kpi-icon">
                        <Icon name={k.icon} />
                    </div>
                    <div className="dv-kpi-body">
                        <span
                            className={`dv-kpi-value${String(k.value).length > 8 ? ' rp-kpi-text' : ''}`}
                        >
                            {k.value}
                        </span>
                        <span className="dv-kpi-label">{k.label}</span>
                        {k.sub ? (
                            <span className="dv-kpi-sub">{k.sub}</span>
                        ) : null}
                    </div>
                </div>
            ))}
        </div>
    );
}

export function ReportCard({
    tab,
    dataset,
    sub,
    wide,
    noTable,
    note,
    children,
    opts,
}) {
    const [showTable, setShowTable] = useState(false);
    const cardRef = useRef(null);
    const subText = sub ?? opts?.sub;
    const isWide = wide ?? opts?.wide;
    const isNoTable = noTable ?? opts?.noTable;
    const noteText = note ?? opts?.note;
    const chartContent = children ?? opts?.chart;
    const hasTable =
        Boolean(dataset?.columns && dataset?.rows) && !isNoTable;

    useEffect(() => {
        if (
            !dataset?.noExport &&
            window.SPP?.reportKit?.register &&
            cardRef.current
        ) {
            window.SPP.reportKit.register(tab, {
                ...dataset,
                node: cardRef.current,
            });
        }
    });

    return (
        <article
            ref={cardRef}
            className={`dv-card${isWide ? ' dv-card--wide' : ''}`}
            data-ds={`${tab}:${dataset.id}`}
        >
            <div className="dv-card-head">
                <div style={{ marginRight: 'auto', minWidth: 0 }}>
                    <h3>{dataset.title}</h3>
                    {subText ? <p>{subText}</p> : null}
                </div>
                {hasTable ? (
                    <button
                        type="button"
                        className="dv-toggle"
                        aria-pressed={String(showTable)}
                        onClick={() => setShowTable((prev) => !prev)}
                    >
                        <Icon name="fa-solid fa-table" />
                        View table
                    </button>
                ) : null}
            </div>
            <div className="rp-chart" hidden={showTable}>
                {chartContent}
            </div>
            {hasTable ? (
                <div className="rp-tableview" hidden={!showTable}>
                    <ReportTable
                        columns={dataset.columns}
                        rows={dataset.rows}
                        empty="There is no data yet."
                    />
                </div>
            ) : null}
            {noteText ? <p className="dv-note">{noteText}</p> : null}
        </article>
    );
}

export function ReportToolbar({
    title,
    sub,
    glossary,
    updated,
    loading,
    onRefresh,
    onExport,
}) {
    const updatedFormatted = updated
        ? window.EvalUI?.fecha
            ? window.EvalUI.fecha(updated)
            : dateTime(updated)
        : '';

    return (
        <>
            <header className="dv-head">
                <div className="dv-head-text">
                    {title ? <h2>{title}</h2> : null}
                    <p className="ev-sub">
                        {sub ? sub + ' ' : ''}
                        <span className="rp-updated">
                            {updatedFormatted
                                ? 'Updated ' + updatedFormatted + '.'
                                : ''}
                        </span>
                    </p>
                </div>
                {onRefresh ? (
                    <button
                        type="button"
                        className={`ev-btn ev-btn--sm ev-btn--ghost${loading ? ' is-busy' : ''}`}
                        disabled={loading}
                        onClick={onRefresh}
                    >
                        <Icon name="fa-solid fa-rotate" />
                        Refresh
                    </button>
                ) : null}
                {onExport ? (
                    <button
                        type="button"
                        className="ev-btn ev-btn--sm ev-btn--dark"
                        onClick={onExport}
                    >
                        <Icon name="fa-solid fa-download" />
                        Export panel
                    </button>
                ) : null}
            </header>
            {glossary && glossary.length > 0 ? (
                <details className="dv-help">
                    <summary>
                        <Icon name="fa-solid fa-circle-info" />
                        How to read these figures?
                    </summary>
                    <dl>
                        {glossary.map(([term, desc], idx) => (
                            <React.Fragment key={idx}>
                                <dt>{term}</dt>
                                <dd>{desc}</dd>
                            </React.Fragment>
                        ))}
                    </dl>
                </details>
            ) : null}
        </>
    );
}
