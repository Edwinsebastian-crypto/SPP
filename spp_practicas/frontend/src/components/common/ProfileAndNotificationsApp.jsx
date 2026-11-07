import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { session, logout, ROLES, request } from '../../core/api';
import {
    bindLogoutLinks,
    updateProfileDOM,
    syncNotificationBellBadges,
    getNotificationBellButtons
} from '../../core/shell';

const POLL_MS = 60000;

function timeAgo(value) {
    const date = new Date(value);
    if (isNaN(date.getTime())) return '';
    const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
    if (minutes < 1) return 'ahora';
    if (minutes < 60) return 'hace ' + minutes + ' min';
    if (minutes < 1440) return 'hace ' + Math.round(minutes / 60) + ' h';
    if (minutes < 10080) return 'hace ' + Math.round(minutes / 1440) + ' d';
    return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getNotificationIcon(n) {
    const s = (n.subject || '').toLowerCase();
    if (s.includes('práctica') || s.includes('practica') || s.includes('actividad') || s.includes('evaluación') || s.includes('evaluacion')) {
        return 'fa-solid fa-book-open';
    }
    if (s.includes('aprobada') || s.includes('registro') || s.includes('cuenta')) {
        return 'fa-solid fa-user-check';
    }
    if (s.includes('retroalimentación') || s.includes('retroalimentacion') || s.includes('comentario')) {
        return 'fa-solid fa-comments';
    }
    return 'fa-solid fa-book-open';
}

function parseNotificationContent(rawSubject, rawContent) {
    const subject = String(rawSubject || '').trim();
    const raw = String(rawContent || '').trim();
    if (!raw) return { intro: '', cards: [], rest: '' };
    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    const cards = [];
    let intro;
    let rest = '';

    // 1. Bullets (•, -, *) -> Usado en director y resúmenes de tutor/asesor
    const bulletLines = lines.filter((l) => /^[•\-*]/.test(l));
    if (bulletLines.length > 0) {
        const introLines = [];
        const restLines = [];
        let seenBullet = false;

        for (const line of lines) {
            if (/^[•\-*]/.test(line)) {
                seenBullet = true;
                const cleaned = line.replace(/^[•\-*]\s*/, '').trim();
                const dashIdx = cleaned.indexOf('—');
                const hyphenIdx = cleaned.indexOf(' - ');
                const sepIdx = dashIdx !== -1 ? dashIdx : hyphenIdx;
                if (sepIdx !== -1) {
                    const title = cleaned.slice(0, sepIdx).trim();
                    const meta = cleaned.slice(sepIdx + (dashIdx !== -1 ? 1 : 3)).trim();
                    cards.push({ title, meta });
                } else {
                    cards.push({ title: cleaned, meta: '' });
                }
            } else if (seenBullet) {
                restLines.push(line);
            } else {
                introLines.push(line);
            }
        }
        intro = introLines.join(' ');
        rest = restLines.join(' ');
        return { intro, cards, rest };
    }

    // 2. Feedback / Retroalimentación (Estudiante)
    const quoteMatch = raw.match(/«([^»]+)»/);
    if (quoteMatch || /retroalimentaci[oó]n|comentario/i.test(subject) || /retroalimentaci[oó]n|comentario/i.test(raw)) {
        const quote = quoteMatch ? `«${quoteMatch[1]}»` : '';
        let greeting = '';
        const bodyLines = [];
        for (const line of lines) {
            if (/^hola\s+/i.test(line)) {
                greeting = line;
            } else if (/ingresa al spp/i.test(line)) {
                rest = line;
            } else if (!line.includes('«')) {
                bodyLines.push(line);
            }
        }
        intro = [greeting, bodyLines.join(' ')].filter(Boolean).join(' ');

        let actTitle = '';
        const subjMatch = subject.match(/(?:en tu actividad|actividad):\s*([^,.]+)/i);
        if (subjMatch) actTitle = subjMatch[1].trim();

        let author = '';
        const authorMatch = raw.match(/([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*\s*\([^)]+\))\s+dejó/);
        if (authorMatch) author = authorMatch[1].trim();

        cards.push({
            title: actTitle ? `Actividad: ${actTitle}` : 'Retroalimentación recibida',
            meta: [quote, author ? `Por: ${author}` : ''].filter(Boolean).join(' · ') || quote || 'Nueva retroalimentación registrada'
        });

        return { intro, cards, rest: rest || 'Ingresa al SPP para ver el detalle completo.' };
    }

    // 3. Calificaciones de actividades o prácticas
    if (/calificad[ao]|nota/i.test(subject) || /nota obtenida|nota final/i.test(raw)) {
        let greeting = '';
        let gradeStr = '';
        let detailStr = '';
        const other = [];

        for (const line of lines) {
            if (/^hola\s+/i.test(line)) {
                greeting = line;
            } else if (/nota\s+(?:obtenida|final):\s*([0-9.,]+(?:\s+de\s+[0-9.,]+)?)/i.test(line)) {
                gradeStr = line;
            } else if (/observaci[oó]n/i.test(line)) {
                detailStr = line;
            } else if (/ingresa al spp/i.test(line)) {
                rest = line;
            } else {
                other.push(line);
            }
        }

        intro = [greeting, other.join(' ')].filter(Boolean).join(' ');
        const titleMatch = subject.match(/(?:calificad[ao]:|evaluación:)\s*(.+)/i);
        const name = titleMatch ? titleMatch[1].trim() : '';

        cards.push({
            title: gradeStr || 'Calificación registrada',
            meta: [name, detailStr].filter(Boolean).join(' · ') || 'Detalle disponible en la plataforma'
        });

        return { intro, cards, rest };
    }

    // 4. Asignación de práctica
    if (/asignad[ao]/i.test(subject) || /se te asignó/i.test(raw)) {
        let greeting = '';
        let vigencia = '';
        const other = [];

        for (const line of lines) {
            if (/^hola\s+/i.test(line)) {
                greeting = line;
            } else if (/vigencia:/i.test(line)) {
                vigencia = line;
            } else {
                other.push(line);
            }
        }

        intro = [greeting, other.join(' ')].filter(Boolean).join(' ');
        const nameMatch = subject.match(/asignado una práctica:\s*(.+)/i) || raw.match(/la práctica "([^"]+)"/i);
        const pName = nameMatch ? nameMatch[1].trim() : 'Práctica Pedagógica';

        cards.push({
            title: `Práctica: ${pName}`,
            meta: vigencia || 'Asignación confirmada en el sistema'
        });

        return { intro, cards, rest };
    }

    // 5. Evaluaciones disponibles o recordatorios de vencimiento
    if (/disponible|vence|recordatorio/i.test(subject) || /fecha límite/i.test(raw)) {
        let greeting = '';
        let deadline = '';
        const other = [];

        for (const line of lines) {
            if (/^hola\s+/i.test(line)) {
                greeting = line;
            } else if (/fecha límite:|vence el/i.test(line)) {
                deadline = line;
            } else if (/entra al spp|ingresa al spp/i.test(line)) {
                rest = line;
            } else {
                other.push(line);
            }
        }

        intro = [greeting, other.join(' ')].filter(Boolean).join(' ');
        cards.push({
            title: subject.replace(/^Recordatorio:\s*/i, '').trim(),
            meta: deadline || 'Revisa la fecha límite en el sistema'
        });

        return { intro, cards, rest };
    }

    // 6. Registro / Aprobación de cuenta
    if (/registro|aprobada|cuenta/i.test(subject)) {
        let greeting = '';
        const other = [];
        for (const line of lines) {
            if (/^hola\s+/i.test(line)) {
                greeting = line;
            } else if (/ya puedes ingresar/i.test(line)) {
                rest = line;
            } else {
                other.push(line);
            }
        }
        intro = [greeting, other.join(' ')].filter(Boolean).join(' ');
        cards.push({
            title: subject,
            meta: 'Software de Prácticas Pedagógicas (SPP)'
        });
        return { intro, cards, rest };
    }

    // 7. Fallback general
    if (lines.length > 1) {
        intro = lines[0];
        cards.push({
            title: lines[1],
            meta: lines.slice(2).join(' ')
        });
    } else {
        intro = lines[0] || '';
    }

    return { intro, cards, rest };
}

function NotificationCard({ n, isExpanded, onToggle, onMarkRead }) {
    const { intro, cards, rest } = parseNotificationContent(n.subject, n.content);

    return (
        <div
            className={`bell-item${n.read ? ' is-read' : ' is-unread'}${isExpanded ? ' is-expanded' : ''}`}
            onClick={(e) => {
                e.stopPropagation();
                onToggle();
                if (!n.read) onMarkRead(n.id);
            }}
            role="button"
            tabIndex={0}
            aria-expanded={isExpanded}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onToggle();
                    if (!n.read) onMarkRead(n.id);
                }
            }}
        >
            <div className="bell-item-icon" aria-hidden="true">
                <i className={getNotificationIcon(n)} />
            </div>
            <div className="bell-item-content">
                <div className="bell-item-top">
                    <h4 className="bell-item-subject">{n.subject}</h4>
                    <div className="bell-item-indicators">
                        {!n.read ? <span className="bell-unread-dot" aria-label="No leída" /> : null}
                        <i
                            className={`fa-solid fa-chevron-down bell-chevron${isExpanded ? ' is-open' : ''}`}
                            aria-hidden="true"
                        />
                    </div>
                </div>

                {!isExpanded ? (
                    <div className="bell-item-meta bell-item-meta-collapsed">
                        <i className="fa-regular fa-clock" aria-hidden="true" />
                        <span>{timeAgo(n.createdAt)}</span>
                    </div>
                ) : (
                    <div className="bell-item-body">
                        {intro ? <p className="bell-item-desc">{intro}</p> : null}

                        {cards.length > 0 ? (
                            <div className="bell-item-cards">
                                {cards.map((c, idx) => (
                                    <div key={idx} className="bell-card-inner">
                                        <strong className="bell-card-inner-title">{c.title}</strong>
                                        {c.meta ? <p className="bell-card-inner-meta">{c.meta}</p> : null}
                                    </div>
                                ))}
                            </div>
                        ) : null}

                        {rest ? <p className="bell-item-desc bell-item-rest">{rest}</p> : null}

                        <div className="bell-item-meta">
                            <i className="fa-regular fa-clock" aria-hidden="true" />
                            <span>{timeAgo(n.createdAt)}</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function ProfileAndNotificationsApp() {
    const [items, setItems] = useState([]);
    const [unread, setUnread] = useState(0);
    const [open, setOpen] = useState(false);
    const [expandedIds, setExpandedIds] = useState(() => new Set());
    const toggleExpand = useCallback((id) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);
    const [showAll, setShowAll] = useState(false);
    const [panelStyle, setPanelStyle] = useState({ width: '400px', top: '0px', left: '0px' });

    const anchorRef = useRef(null);
    const panelRef = useRef(null);
    const openRef = useRef(false);
    openRef.current = open;

    // 1. Session + Profile + Logout binding
    useEffect(() => {
        const handleLogout = (e) => {
            e.preventDefault();
            logout();
        };

        const unbindLogout = bindLogoutLinks(handleLogout);

        let cancelled = false;
        (async () => {
            try {
                const user = await session();
                if (cancelled || !user) return;
                updateProfileDOM(user, ROLES);
            } catch (_) {
                // Handled by session redirect if unauthorized
            }
        })();

        return () => {
            cancelled = true;
            unbindLogout();
        };
    }, []);

    // 2. Sync bell badge onto topbar buttons
    useEffect(() => {
        syncNotificationBellBadges(unread);
    }, [unread]);

    const placePanel = useCallback((anchor) => {
        const target = anchor || anchorRef.current;
        if (!target) return;
        const rect = target.getBoundingClientRect();
        const width = Math.min(410, window.innerWidth - 24);
        const top = Math.round(rect.bottom + 8);
        const left = Math.max(
            12,
            Math.min(window.innerWidth - width - 12, Math.round(rect.right - width))
        );
        setPanelStyle({
            width: `${width}px`,
            top: `${top}px`,
            left: `${left}px`
        });
    }, []);

    const loadNotifications = useCallback(async () => {
        try {
            const data = await request('/api/notifications', { skipRedirect: true });
            const list = Array.isArray(data && data.notifications) ? data.notifications : [];
            setItems(list);
            setUnread(Number(data && data.unread) || 0);
        } catch (_) {
            // Silent retry on next poll
        }
    }, []);

    const markRead = useCallback(async (id) => {
        try {
            await request('/api/notifications/read', {
                method: 'POST',
                body: id ? { id } : {},
                skipRedirect: true
            });
            setItems((prev) => {
                const updated = prev.map((n) => (!id || n.id === id ? { ...n, read: true } : n));
                setUnread(updated.filter((n) => !n.read).length);
                return updated;
            });
        } catch (_) {
            // Ignored
        }
    }, []);

    // 3. Bind bell buttons, outside click, resize, and polling
    useEffect(() => {
        const buttons = getNotificationBellButtons();
        if (!buttons.length) return;

        const syncAriaExpanded = (activeBtn, isOpen) => {
            buttons.forEach((b) =>
                b.setAttribute('aria-expanded', isOpen && b === activeBtn ? 'true' : 'false')
            );
        };

        const handleBtnClick = (event) => {
            event.stopPropagation();
            const button = event.currentTarget;
            if (openRef.current && anchorRef.current === button) {
                setOpen(false);
                syncAriaExpanded(null, false);
                return;
            }
            anchorRef.current = button;
            placePanel(button);
            setOpen(true);
            syncAriaExpanded(button, true);
            loadNotifications();
        };

        buttons.forEach((button) => {
            button.setAttribute('aria-haspopup', 'dialog');
            button.setAttribute('aria-expanded', 'false');
            button.addEventListener('click', handleBtnClick);
        });

        const handleKeyDown = (event) => {
            if (event.key === 'Escape' && openRef.current) {
                setOpen(false);
                syncAriaExpanded(null, false);
            }
        };

        const handleResize = () => {
            if (openRef.current) placePanel();
        };

        const handleVisibility = () => {
            if (!document.hidden) loadNotifications();
        };
        document.addEventListener('keydown', handleKeyDown);
        window.addEventListener('resize', handleResize);
        document.addEventListener('visibilitychange', handleVisibility);

        loadNotifications();
        const timer = setInterval(() => {
            if (!document.hidden) loadNotifications();
        }, POLL_MS);

        return () => {
            clearInterval(timer);
            buttons.forEach((button) => button.removeEventListener('click', handleBtnClick));
            document.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('resize', handleResize);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [loadNotifications, placePanel]);

    if (typeof document === 'undefined') return null;

    const unreadItems = items.filter((n) => !n.read);
    const readItems = items.filter((n) => n.read);
    const maxInitial = 5;
    const displayedUnread = showAll ? unreadItems : unreadItems.slice(0, maxInitial);
    const remainingSlots = Math.max(0, maxInitial - displayedUnread.length);
    const displayedRead = showAll ? readItems : readItems.slice(0, remainingSlots || 3);

    return createPortal(
        <>
            {open ? (
                <div
                    className="bell-backdrop"
                    onClick={(e) => {
                                e.stopPropagation();
                                setOpen(false);
                                const buttons = getNotificationBellButtons();
                                buttons.forEach((b) => b.setAttribute('aria-expanded', 'false'));
                            }}
                    aria-hidden="true"
                />
            ) : null}

            <div
                ref={panelRef}
                className="bell-panel"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-label="Notificaciones"
                hidden={!open}
                style={panelStyle}
            >
                <div className="bell-head">
                    <div className="bell-head-left">
                        <div className="bell-head-icon" aria-hidden="true">
                            <i className="fa-regular fa-bell" />
                        </div>
                        <h3 className="bell-head-title">Notificaciones</h3>
                        <span className="bell-unread-pill">
                            {unread} {unread === 1 ? 'nueva' : 'nuevas'}
                        </span>
                    </div>
                    <div className="bell-head-right">
                        <button
                            type="button"
                            className="bell-close-btn"
                            aria-label="Cerrar notificaciones"
                            onClick={(e) => {
                                e.stopPropagation();
                                setOpen(false);
                                const buttons = getNotificationBellButtons();
                                buttons.forEach((b) => b.setAttribute('aria-expanded', 'false'));
                            }}
                            title="Cerrar"
                        >
                            <i className="fa-solid fa-xmark" aria-hidden="true" />
                        </button>
                        {unread > 0 ? (
                            <button
                                type="button"
                                className="bell-markall"
                                onClick={() => markRead(null)}
                                title="Marcar todas como leídas"
                            >
                                <i className="fa-solid fa-check" aria-hidden="true" /> Marcar todas
                            </button>
                        ) : null}
                    </div>
                </div>

                <div className="bell-list">
                    {items.length === 0 ? (
                        <p className="bell-empty">No tienes notificaciones.</p>
                    ) : (
                        <>
                            {displayedUnread.length > 0 ? (
                                <>
                                    <div className="bell-section-title">NUEVAS</div>
                                    {displayedUnread.map((n) => (
                                        <NotificationCard
                                            key={n.id}
                                            n={n}
                                            isExpanded={expandedIds.has(n.id)}
                                            onToggle={() => toggleExpand(n.id)}
                                            onMarkRead={markRead}
                                        />
                                    ))}
                                </>
                            ) : null}

                            {displayedRead.length > 0 ? (
                                <>
                                    <div className="bell-section-title">ANTERIORES</div>
                                    {displayedRead.map((n) => (
                                        <NotificationCard
                                            key={n.id}
                                            n={n}
                                            isExpanded={expandedIds.has(n.id)}
                                            onToggle={() => toggleExpand(n.id)}
                                            onMarkRead={markRead}
                                        />
                                    ))}
                                </>
                            ) : null}
                        </>
                    )}
                </div>

                {items.length > 0 ? (
                    <div className="bell-footer">
                        <button
                            type="button"
                            className="bell-footer-btn"
                            onClick={() => setShowAll((prev) => !prev)}
                        >
                            {showAll ? 'Mostrar menos' : 'Ver todas las notificaciones'}
                        </button>
                    </div>
                ) : null}
            </div>
        </>,
        document.body
    );
}
