import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

/**
 * Pads a number with leading zero if needed.
 */
function pad(n) {
    return String(n).padStart(2, '0');
}

const MONTH_NAMES = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
];

const SHORT_MONTH_NAMES = [
    'Ene',
    'Feb',
    'Mar',
    'Abr',
    'May',
    'Jun',
    'Jul',
    'Ago',
    'Sep',
    'Oct',
    'Nov',
    'Dic',
];

const DAY_NAMES = ['DO', 'LU', 'MA', 'MI', 'JU', 'VI', 'SA'];

const HOURS_12 = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
const MINUTES = Array.from({ length: 60 }, (_, i) => pad(i));
const PERIODS = ['a. m.', 'p. m.'];

/**
 * Converts 12h + period (a. m. / p. m.) to 24h string "00".."23"
 */
function to24h(h12, period) {
    let h = parseInt(h12, 10);
    const isPM = period === 'p. m.' || period === 'PM';
    if (isPM && h < 12) h += 12;
    if (!isPM && h === 12) h = 0;
    return pad(h);
}

/**
 * Converts 24h integer 0..23 to { h12: "01".."12", period: "a. m." | "p. m." }
 */
function from24h(h24) {
    const h = parseInt(h24, 10);
    const isPM = h >= 12;
    let h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return {
        h12: pad(h12),
        period: isPM ? 'p. m.' : 'a. m.',
    };
}

/**
 * Formats value for human readable display in input trigger
 */
function formatDisplay(value, isDateTime) {
    if (!value) return '';
    try {
        if (isDateTime) {
            // value is YYYY-MM-DDTHH:mm or ISO
            const clean = value.replace('Z', '').replace(' ', 'T');
            const [datePart, timePart] = clean.split('T');
            if (!datePart) return value;
            const [y, m, d] = datePart.split('-');
            if (!timePart) return `${pad(d)}/${pad(m)}/${y}`;
            const [h, min] = timePart.split(':');
            const { h12, period } = from24h(h);
            return `${pad(d)}/${pad(m)}/${y} ${h12}:${pad(min || 0)} ${period}`;
        }
        // date only: YYYY-MM-DD
        const [y, m, d] = String(value).split('T')[0].split('-');
        if (y && m && d) return `${pad(d)}/${pad(m)}/${y}`;
        return value;
    } catch (_) {
        return value;
    }
}

/**
 * Parse an incoming string value to a Date object, or null
 */
function parseValueToDate(val) {
    if (!val) return null;
    try {
        const str = String(val).replace(' ', 'T');
        const parts = str.split('T');
        const [y, m, d] = parts[0].split('-').map(Number);
        if (!y || !m || !d) return null;
        let hh = 0;
        let mm = 0;
        if (parts[1]) {
            const timeTokens = parts[1].split(':').map(Number);
            hh = timeTokens[0] || 0;
            mm = timeTokens[1] || 0;
        }
        return new Date(y, m - 1, d, hh, mm);
    } catch (_) {
        return null;
    }
}

export default function CustomDateTimePicker({
    id,
    name,
    value = '',
    onChange,
    type = 'datetime-local',
    required = false,
    disabled = false,
    placeholder,
    className = '',
    style = {},
}) {
    const isDateTime = type === 'datetime-local';
    const [open, setOpen] = useState(false);
    const [showMonthPicker, setShowMonthPicker] = useState(false);

    // Initial state based on current value or today
    const parsedInit = parseValueToDate(value) || new Date();
    const [viewYear, setViewYear] = useState(parsedInit.getFullYear());
    const [viewMonth, setViewMonth] = useState(parsedInit.getMonth());

    // Selected draft state
    const [selectedDate, setSelectedDate] = useState(() => parseValueToDate(value));
    const init12 = from24h(parsedInit.getHours());
    const [selectedHour, setSelectedHour] = useState(init12.h12);
    const [selectedMinute, setSelectedMinute] = useState(pad(parsedInit.getMinutes()));
    const [selectedPeriod, setSelectedPeriod] = useState(init12.period);

    const wrapRef = useRef(null);
    const popupRef = useRef(null);
    const hourColRef = useRef(null);
    const minColRef = useRef(null);

    // Dynamic viewport coords for portal popup
    const [coords, setCoords] = useState({ top: null, bottom: null, left: 0 });

    const updatePosition = useCallback(() => {
        if (!wrapRef.current) return;
        const rect = wrapRef.current.getBoundingClientRect();
        // If element is removed from DOM or hidden
        if (rect.width === 0 && rect.height === 0) return;

        const popupEl = popupRef.current;
        const actualHeight = popupEl ? popupEl.offsetHeight : (isDateTime ? 330 : 280);
        const actualWidth = popupEl ? popupEl.offsetWidth : (isDateTime ? 390 : 255);

        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;

        let placeAbove = false;
        if (spaceBelow < actualHeight + 10 && spaceAbove > spaceBelow) {
            placeAbove = true;
        }

        let left = rect.left;
        if (left + actualWidth > window.innerWidth - 12) {
            left = Math.max(12, window.innerWidth - actualWidth - 12);
        }
        if (left < 12) left = 12;

        if (placeAbove) {
            let bottom = Math.max(12, Math.round(window.innerHeight - rect.top + 6));
            if (window.innerHeight - bottom - actualHeight < 12) {
                bottom = Math.max(12, window.innerHeight - actualHeight - 12);
            }
            setCoords({
                top: null,
                bottom: Math.round(bottom),
                left: Math.round(left),
            });
        } else {
            let top = Math.round(rect.bottom + 6);
            if (top + actualHeight > window.innerHeight - 12) {
                top = Math.max(12, window.innerHeight - actualHeight - 12);
            }
            setCoords({
                top: Math.round(top),
                bottom: null,
                left: Math.round(left),
            });
        }
    }, [isDateTime]);

    // Synchronize when value changes externally
    useEffect(() => {
        const d = parseValueToDate(value);
        if (d) {
            setSelectedDate(d);
            setViewYear(d.getFullYear());
            setViewMonth(d.getMonth());
            const conv = from24h(d.getHours());
            setSelectedHour(conv.h12);
            setSelectedMinute(pad(d.getMinutes()));
            setSelectedPeriod(conv.period);
        } else {
            setSelectedDate(null);
        }
    }, [value]);

    // Position listener on open / scroll / resize
    useEffect(() => {
        if (!open) return;
        updatePosition();

        const onScroll = () => {
            updatePosition();
        };
        const onResize = () => {
            updatePosition();
        };

        window.addEventListener('scroll', onScroll, { capture: true, passive: true });
        window.addEventListener('resize', onResize);

        return () => {
            window.removeEventListener('scroll', onScroll, { capture: true });
            window.removeEventListener('resize', onResize);
        };
    }, [open, updatePosition]);

    // Close when clicking outside
    useEffect(() => {
        if (!open) return;
        const onDocClick = (e) => {
            const inWrap = wrapRef.current && wrapRef.current.contains(e.target);
            const inPopup = popupRef.current && popupRef.current.contains(e.target);
            if (!inWrap && !inPopup) {
                setOpen(false);
                setShowMonthPicker(false);
            }
        };
        const onEsc = (e) => {
            if (e.key === 'Escape') {
                if (showMonthPicker) {
                    setShowMonthPicker(false);
                } else {
                    setOpen(false);
                }
            }
        };
        document.addEventListener('mousedown', onDocClick);
        document.addEventListener('keydown', onEsc);
        return () => {
            document.removeEventListener('mousedown', onDocClick);
            document.removeEventListener('keydown', onEsc);
        };
    }, [open]);

    // Scroll selected hour and minute into view when popup opens
    useEffect(() => {
        if (open && isDateTime) {
            setTimeout(() => {
                const hourActive = hourColRef.current?.querySelector('.cdp-time-item.is-selected');
                if (hourActive) hourActive.scrollIntoView({ block: 'nearest' });
                const minActive = minColRef.current?.querySelector('.cdp-time-item.is-selected');
                if (minActive) minActive.scrollIntoView({ block: 'nearest' });
            }, 30);
        }
    }, [open, isDateTime]);

    // Month & Year Navigation
    const handlePrevMonth = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (showMonthPicker) {
            setViewYear((y) => y - 1);
            return;
        }
        if (viewMonth === 0) {
            setViewMonth(11);
            setViewYear((y) => y - 1);
        } else {
            setViewMonth((m) => m - 1);
        }
    };

    const handleNextMonth = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (showMonthPicker) {
            setViewYear((y) => y + 1);
            return;
        }
        if (viewMonth === 11) {
            setViewMonth(0);
            setViewYear((y) => y + 1);
        } else {
            setViewMonth((m) => m + 1);
        }
    };

    // Day Click
    const handleDayClick = (y, m, d) => {
        const newD = new Date(y, m, d);
        setSelectedDate(newD);
    };

    // "Borrar" (Clear)
    const handleClear = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setSelectedDate(null);
        if (onChange) {
            onChange({ target: { value: '', name, id } });
        }
        setShowMonthPicker(false);
        setOpen(false);
    };

    // "Hoy" (Today)
    const handleToday = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const now = new Date();
        setSelectedDate(now);
        setViewYear(now.getFullYear());
        setViewMonth(now.getMonth());
        if (isDateTime) {
            const conv = from24h(now.getHours());
            setSelectedHour(conv.h12);
            setSelectedMinute(pad(now.getMinutes()));
            setSelectedPeriod(conv.period);
        }
    };

    // "Aceptar" (Accept) — commits selection
    const handleAccept = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const targetD = selectedDate || new Date();
        const y = targetD.getFullYear();
        const m = pad(targetD.getMonth() + 1);
        const d = pad(targetD.getDate());

        let outVal = `${y}-${m}-${d}`;
        if (isDateTime) {
            const h24 = to24h(selectedHour, selectedPeriod);
            outVal += `T${h24}:${selectedMinute}`;
        }

        if (onChange) {
            onChange({ target: { value: outVal, name, id } });
        }
        setShowMonthPicker(false);
        setOpen(false);
    };

    // Calendar generation
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay(); // 0 is Sunday
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

    const calendarCells = [];

    // Preceding month days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
        const dayNum = prevMonthDays - i;
        const m = viewMonth === 0 ? 11 : viewMonth - 1;
        const y = viewMonth === 0 ? viewYear - 1 : viewYear;
        calendarCells.push({ day: dayNum, month: m, year: y, isCurrentMonth: false });
    }

    // Current month days
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
        calendarCells.push({ day: dayNum, month: viewMonth, year: viewYear, isCurrentMonth: true });
    }

    // Trailing month days
    const totalCells = Math.ceil(calendarCells.length / 7) * 7;
    let nextDayNum = 1;
    while (calendarCells.length < totalCells) {
        const m = viewMonth === 11 ? 0 : viewMonth + 1;
        const y = viewMonth === 11 ? viewYear + 1 : viewYear;
        calendarCells.push({ day: nextDayNum++, month: m, year: y, isCurrentMonth: false });
    }

    const todayDate = new Date();
    const isToday = (c) =>
        c.year === todayDate.getFullYear() &&
        c.month === todayDate.getMonth() &&
        c.day === todayDate.getDate();

    const isSelected = (c) =>
        selectedDate &&
        c.year === selectedDate.getFullYear() &&
        c.month === selectedDate.getMonth() &&
        c.day === selectedDate.getDate();

    const displayText = formatDisplay(value, isDateTime);

    return (
        <div
            ref={wrapRef}
            className={`cdp-wrap ${disabled ? 'is-disabled' : ''} ${className}`}
            style={{ position: 'relative', width: '100%', ...style }}
        >
            {/* The visual trigger input */}
            <div
                className={`cdp-input-box ${open ? 'is-open' : ''}`}
                tabIndex={disabled ? -1 : 0}
                role="button"
                aria-haspopup="dialog"
                aria-expanded={open}
                onClick={() => {
                    if (!disabled) setOpen((prev) => !prev);
                }}
                onKeyDown={(e) => {
                    if (disabled) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setOpen((prev) => !prev);
                    }
                }}
            >
                <span className={`cdp-value-text ${!displayText ? 'is-placeholder' : ''}`}>
                    {displayText || placeholder || (isDateTime ? 'dd/mm/aaaa --:--' : 'dd/mm/aaaa')}
                </span>
                <i className="fa-regular fa-calendar right-icon cdp-icon" aria-hidden="true" />
            </div>

            {/* Hidden native input for form compatibility & validation */}
            <input
                type="hidden"
                id={id}
                name={name}
                value={value}
                required={required}
                disabled={disabled}
            />

            {/* Popup Modal / Dropdown rendered in document.body via Portal to float above all modals */}
            {open && typeof document !== 'undefined' && createPortal(
                <div
                    ref={popupRef}
                    className="cdp-popup"
                    role="dialog"
                    aria-modal="true"
                    style={{
                        position: 'fixed',
                        top: coords.top !== null ? `${coords.top}px` : 'auto',
                        bottom: coords.bottom !== null ? `${coords.bottom}px` : 'auto',
                        left: `${coords.left}px`,
                        zIndex: 9999999,
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <div className="cdp-body">
                        {/* Calendar Left Column */}
                        <div className="cdp-calendar">
                            {/* Month Header */}
                            <div className="cdp-header">
                                <button
                                    type="button"
                                    className="cdp-month-selector-btn"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setShowMonthPicker((prev) => !prev);
                                    }}
                                    title="Seleccionar mes o año"
                                >
                                    <span className="cdp-month-label">
                                        {MONTH_NAMES[viewMonth]} de {viewYear}
                                    </span>
                                    <i
                                        className={`fa-solid ${
                                            showMonthPicker ? 'fa-chevron-up' : 'fa-chevron-down'
                                        } cdp-caret`}
                                    />
                                </button>
                                <div className="cdp-nav-arrows">
                                    <button
                                        type="button"
                                        className="cdp-arrow-btn"
                                        aria-label="Mes anterior"
                                        title="Mes anterior"
                                        onClick={handlePrevMonth}
                                    >
                                        <i className="fa-solid fa-chevron-left" />
                                    </button>
                                    <button
                                        type="button"
                                        className="cdp-arrow-btn"
                                        aria-label="Mes siguiente"
                                        title="Mes siguiente"
                                        onClick={handleNextMonth}
                                    >
                                        <i className="fa-solid fa-chevron-right" />
                                    </button>
                                </div>
                            </div>

                            {showMonthPicker ? (
                                <div className="cdp-month-picker-view">
                                    <div className="cdp-year-bar">
                                        <button
                                            type="button"
                                            className="cdp-arrow-btn"
                                            aria-label="Año anterior"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setViewYear((y) => y - 1);
                                            }}
                                        >
                                            <i className="fa-solid fa-chevron-left" />
                                        </button>
                                        <span className="cdp-year-display">{viewYear}</span>
                                        <button
                                            type="button"
                                            className="cdp-arrow-btn"
                                            aria-label="Año siguiente"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setViewYear((y) => y + 1);
                                            }}
                                        >
                                            <i className="fa-solid fa-chevron-right" />
                                        </button>
                                    </div>
                                    <div className="cdp-month-grid">
                                        {SHORT_MONTH_NAMES.map((name, mIdx) => {
                                            const isCur = mIdx === viewMonth;
                                            return (
                                                <button
                                                    key={name}
                                                    type="button"
                                                    className={`cdp-month-chip${
                                                        isCur ? ' is-selected' : ''
                                                    }`}
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setViewMonth(mIdx);
                                                        setShowMonthPicker(false);
                                                    }}
                                                >
                                                    {name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Weekday Names */}
                                    <div className="cdp-weekdays">
                                        {DAY_NAMES.map((dName) => (
                                            <span key={dName} className="cdp-weekday">
                                                {dName}
                                            </span>
                                        ))}
                                    </div>

                                    {/* Days Grid */}
                                    <div className="cdp-days">
                                        {calendarCells.map((cell, idx) => {
                                            const selected = isSelected(cell);
                                            const today = isToday(cell);
                                            return (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    className={`cdp-day-btn${
                                                        !cell.isCurrentMonth ? ' is-outside' : ''
                                                    }${selected ? ' is-selected' : ''}${
                                                        today ? ' is-today' : ''
                                                    }`}
                                                    onClick={() =>
                                                        handleDayClick(cell.year, cell.month, cell.day)
                                                    }
                                                >
                                                    {cell.day}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </>
                            )}

                            {/* Footer for Date Only */}
                            {!isDateTime && (
                                <div className="cdp-footer">
                                    <button
                                        type="button"
                                        className="cdp-btn-clear"
                                        onClick={handleClear}
                                    >
                                        Borrar
                                    </button>
                                    <div className="cdp-footer-right">
                                        <button
                                            type="button"
                                            className="cdp-btn-today"
                                            onClick={handleToday}
                                        >
                                            Hoy
                                        </button>
                                        <button
                                            type="button"
                                            className="cdp-btn-accept"
                                            onClick={handleAccept}
                                        >
                                            Aceptar
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Time Picker Right Column (if type="datetime-local") */}
                        {isDateTime && (
                            <div className="cdp-time-pane">
                                <div className="cdp-time-columns">
                                    {/* Hours Column */}
                                    <div ref={hourColRef} className="cdp-time-col">
                                        {HOURS_12.map((h) => (
                                            <button
                                                key={h}
                                                type="button"
                                                className={`cdp-time-item${
                                                    selectedHour === h ? ' is-selected' : ''
                                                }`}
                                                onClick={() => setSelectedHour(h)}
                                            >
                                                {h}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Minutes Column */}
                                    <div ref={minColRef} className="cdp-time-col">
                                        {MINUTES.map((m) => (
                                            <button
                                                key={m}
                                                type="button"
                                                className={`cdp-time-item${
                                                    selectedMinute === m ? ' is-selected' : ''
                                                }`}
                                                onClick={() => setSelectedMinute(m)}
                                            >
                                                {m}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Period Column (a. m. / p. m.) */}
                                    <div className="cdp-time-col cdp-period-col">
                                        {PERIODS.map((p) => (
                                            <button
                                                key={p}
                                                type="button"
                                                className={`cdp-time-item${
                                                    selectedPeriod === p ? ' is-selected' : ''
                                                }`}
                                                onClick={() => setSelectedPeriod(p)}
                                            >
                                                {p}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer for DateTime */}
                    {isDateTime && (
                        <div className="cdp-footer">
                            <button
                                type="button"
                                className="cdp-btn-clear"
                                onClick={handleClear}
                            >
                                Borrar
                            </button>
                            <div className="cdp-footer-right">
                                <button
                                    type="button"
                                    className="cdp-btn-today"
                                    onClick={handleToday}
                                >
                                    Hoy
                                </button>
                                <button
                                    type="button"
                                    className="cdp-btn-accept"
                                    onClick={handleAccept}
                                >
                                    Aceptar
                                </button>
                            </div>
                        </div>
                    )}
                </div>,
                document.body
            )}

            {/* Embedded styles to guarantee instant rendering anywhere */}
            <style>{`
                .cdp-wrap {
                    position: relative;
                    font-family: inherit;
                    user-select: none;
                }
                .cdp-input-box {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    width: 100%;
                    height: 48px;
                    padding: 0 16px;
                    border-radius: 12px;
                    border: 1px solid rgba(0, 0, 0, 0.12);
                    background: #f7faf8;
                    color: #103323;
                    font-size: 14.5px;
                    cursor: pointer;
                    transition: border-color .15s ease, box-shadow .15s ease, background .15s ease;
                    box-sizing: border-box;
                }
                .cdp-input-box:hover {
                    border-color: #288360;
                    background: #ffffff;
                }
                .cdp-input-box.is-open {
                    border-color: #1f7a63;
                    background: #ffffff;
                    box-shadow: 0 0 0 3px rgba(31, 122, 99, 0.15);
                }
                .cdp-value-text {
                    font-weight: 500;
                    color: #103323;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .cdp-value-text.is-placeholder {
                    color: #8fa097;
                    font-weight: 400;
                }
                .cdp-icon {
                    color: #53685e;
                    font-size: 16px;
                    flex-shrink: 0;
                    margin-left: 8px;
                }
                .cdp-wrap.is-disabled .cdp-input-box {
                    opacity: 0.6;
                    cursor: not-allowed;
                    background: #f0f0f0;
                }
                .cdp-popup {
                    position: fixed;
                    z-index: 9999999;
                    background: #ffffff;
                    border-radius: 14px;
                    border: 1px solid rgba(0, 0, 0, 0.08);
                    box-shadow: 0 14px 40px rgba(0, 0, 0, 0.22), 0 4px 12px rgba(0, 0, 0, 0.08);
                    padding: 10px 14px;
                    display: flex;
                    flex-direction: column;
                    gap: 7px;
                    animation: cdpFadeIn .18s ease-out;
                    box-sizing: border-box;
                }
                @media (max-width: 480px) {
                    .cdp-popup {
                        left: 8px !important;
                        right: 8px !important;
                        max-width: calc(100vw - 16px) !important;
                        overflow-x: auto;
                    }
                    .cdp-body {
                        flex-direction: column;
                    }
                    .cdp-calendar {
                        width: 100% !important;
                    }
                    .cdp-time-pane {
                        border-left: none !important;
                        border-top: 1px solid rgba(0, 0, 0, 0.08);
                        padding-left: 0 !important;
                        padding-top: 8px;
                    }
                }
                @media (max-height: 768px) {
                    .cdp-popup {
                        padding: 7px 11px;
                        gap: 5px;
                    }
                    .cdp-calendar {
                        width: 215px !important;
                        gap: 4px !important;
                    }
                    .cdp-day-btn {
                        height: 24px !important;
                        font-size: 11.5px !important;
                    }
                    .cdp-time-columns {
                        height: 160px !important;
                        gap: 4px !important;
                    }
                    .cdp-time-col {
                        max-height: 160px !important;
                        width: 42px !important;
                        gap: 3px !important;
                    }
                    .cdp-period-col {
                        width: 46px !important;
                    }
                    .cdp-time-item {
                        height: 23px !important;
                        min-height: 23px !important;
                        font-size: 11px !important;
                    }
                    .cdp-footer {
                        padding-top: 5px !important;
                    }
                }
                @keyframes cdpFadeIn {
                    from { opacity: 0; transform: translateY(-6px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .cdp-body {
                    display: flex;
                    gap: 12px;
                }
                .cdp-calendar {
                    width: 230px;
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .cdp-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0 4px 4px;
                    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
                }
                .cdp-month-selector-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    border: none;
                    background: transparent;
                    padding: 2px 6px;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: background .15s ease;
                }
                .cdp-month-selector-btn:hover {
                    background: #e6f0eb;
                }
                .cdp-caret {
                    font-size: 11px;
                    color: #4b6357;
                    transition: transform .2s ease;
                }
                .cdp-month-picker-view {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    padding: 4px 0;
                    min-height: 180px;
                    justify-content: center;
                }
                .cdp-year-bar {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0 8px;
                }
                .cdp-year-display {
                    font-size: 14.5px;
                    font-weight: 700;
                    color: #103323;
                }
                .cdp-month-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 6px;
                    padding: 3px;
                }
                .cdp-month-chip {
                    padding: 7px 4px;
                    border: none;
                    border-radius: 7px;
                    background: #f5f8f6;
                    color: #103323;
                    font-size: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all .15s ease;
                }
                .cdp-month-chip:hover {
                    background: #e0ece5;
                    color: #103323;
                }
                .cdp-month-chip.is-selected {
                    background: #1f7a63 !important;
                    color: #ffffff !important;
                    box-shadow: 0 2px 6px rgba(31, 122, 99, 0.35);
                }
                .cdp-month-label {
                    font-size: 13.5px;
                    font-weight: 700;
                    color: #103323;
                    text-transform: capitalize;
                }
                .cdp-nav-arrows {
                    display: flex;
                    gap: 4px;
                }
                .cdp-arrow-btn {
                    display: grid;
                    place-items: center;
                    width: 25px;
                    height: 25px;
                    border: none;
                    background: transparent;
                    color: #4b6357;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 11px;
                    transition: background .12s ease, color .12s ease;
                }
                .cdp-arrow-btn:hover {
                    background: #e6f0eb;
                    color: #103323;
                }
                .cdp-weekdays {
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    text-align: center;
                    font-size: 10.5px;
                    font-weight: 700;
                    color: #72867c;
                    margin-bottom: 1px;
                }
                .cdp-weekday {
                    padding: 2px 0;
                }
                .cdp-days {
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    gap: 2px;
                }
                .cdp-day-btn {
                    display: grid;
                    place-items: center;
                    height: 27px;
                    border: none;
                    background: transparent;
                    border-radius: 6px;
                    font-size: 12px;
                    font-weight: 500;
                    color: #103323;
                    cursor: pointer;
                    transition: background .12s ease, color .12s ease;
                    outline: none;
                }
                .cdp-day-btn:hover {
                    background: #e3efe5;
                }
                .cdp-day-btn.is-outside {
                    color: #b5c4bd;
                }
                .cdp-day-btn.is-today {
                    border: 1px solid #1f7a63;
                    font-weight: 700;
                }
                .cdp-day-btn.is-selected {
                    background: #1f7a63 !important;
                    color: #ffffff !important;
                    font-weight: 700;
                    box-shadow: 0 2px 8px rgba(31, 122, 99, 0.35);
                }
                .cdp-time-pane {
                    border-left: 1px solid rgba(0, 0, 0, 0.08);
                    padding-left: 10px;
                }
                .cdp-time-columns {
                    display: flex;
                    gap: 5px;
                    height: 184px;
                }
                .cdp-time-col {
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                    width: 46px;
                    overflow-y: auto;
                    max-height: 184px;
                    padding-right: 2px;
                    scrollbar-width: thin;
                }
                .cdp-period-col {
                    width: 50px;
                }
                .cdp-time-col::-webkit-scrollbar {
                    width: 4px;
                }
                .cdp-time-col::-webkit-scrollbar-thumb {
                    background: rgba(0, 0, 0, 0.15);
                    border-radius: 4px;
                }
                .cdp-time-item {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 26px;
                    min-height: 26px;
                    border: none;
                    background: #f5f8f6;
                    color: #103323;
                    border-radius: 6px;
                    font-size: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: background .12s ease, color .12s ease;
                    flex-shrink: 0;
                }
                .cdp-time-item:hover {
                    background: #e0ece5;
                }
                .cdp-time-item.is-selected {
                    background: #1f7a63 !important;
                    color: #ffffff !important;
                    box-shadow: 0 2px 6px rgba(31, 122, 99, 0.35);
                }
                .cdp-footer {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding-top: 6px;
                    border-top: 1px solid rgba(0, 0, 0, 0.07);
                    margin-top: 1px;
                }
                .cdp-btn-clear {
                    border: none;
                    background: transparent;
                    color: #b3261e;
                    font-size: 12px;
                    font-weight: 700;
                    cursor: pointer;
                    padding: 4px 6px;
                    border-radius: 6px;
                    transition: background .12s ease;
                }
                .cdp-btn-clear:hover {
                    background: #fee2e2;
                }
                .cdp-footer-right {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .cdp-btn-today {
                    border: none;
                    background: transparent;
                    color: #1f7a63;
                    font-size: 12px;
                    font-weight: 700;
                    cursor: pointer;
                    padding: 4px 8px;
                    border-radius: 6px;
                    transition: background .12s ease;
                }
                .cdp-btn-today:hover {
                    background: #e3efe5;
                }
                .cdp-btn-accept {
                    border: none;
                    background: #1f7a63;
                    color: #ffffff;
                    font-size: 12px;
                    font-weight: 700;
                    cursor: pointer;
                    padding: 5px 12px;
                    border-radius: 6px;
                    box-shadow: 0 2px 6px rgba(31, 122, 99, 0.3);
                    transition: background .15s ease, transform .12s ease;
                }
                    box-shadow: 0 2px 6px rgba(31, 122, 99, 0.3);
                    transition: background .15s ease, transform .12s ease;
                }
                .cdp-btn-accept:hover {
                    background: #176350;
                    transform: translateY(-1px);
                }
                .cdp-btn-accept:active {
                    transform: translateY(0);
                }

                /* Dark mode support */
                body.dark-theme .cdp-input-box {
                    background: #163628;
                    color: #ffffff;
                    border-color: rgba(255, 255, 255, 0.12);
                }
                body.dark-theme .cdp-value-text {
                    color: #ffffff;
                }
                body.dark-theme .cdp-value-text.is-placeholder {
                    color: #8da398;
                }
                body.dark-theme .cdp-icon {
                    color: #a8c7b9;
                }
                body.dark-theme .cdp-popup {
                    background: #143527;
                    border-color: rgba(255, 255, 255, 0.12);
                    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
                }
                body.dark-theme .cdp-month-label {
                    color: #ffffff;
                }
                body.dark-theme .cdp-month-selector-btn:hover {
                    background: rgba(255, 255, 255, 0.1);
                }
                body.dark-theme .cdp-caret {
                    color: #a8c7b9;
                }
                body.dark-theme .cdp-year-display {
                    color: #ffffff;
                }
                body.dark-theme .cdp-month-chip {
                    background: rgba(255, 255, 255, 0.08);
                    color: #ffffff;
                }
                body.dark-theme .cdp-month-chip:hover {
                    background: rgba(255, 255, 255, 0.16);
                }
                body.dark-theme .cdp-month-chip.is-selected {
                    background: #1f7a63 !important;
                    color: #ffffff !important;
                }
                body.dark-theme .cdp-arrow-btn {
                    color: #a8c7b9;
                }
                body.dark-theme .cdp-arrow-btn:hover {
                    background: rgba(255, 255, 255, 0.1);
                    color: #ffffff;
                }
                body.dark-theme .cdp-day-btn {
                    color: #ffffff;
                }
                body.dark-theme .cdp-day-btn:hover {
                    background: rgba(255, 255, 255, 0.1);
                }
                body.dark-theme .cdp-time-item {
                    background: rgba(255, 255, 255, 0.08);
                    color: #ffffff;
                }
                body.dark-theme .cdp-time-item:hover {
                    background: rgba(255, 255, 255, 0.16);
                }
            `}</style>
        </div>
    );
}
