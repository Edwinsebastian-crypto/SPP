import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { session, logout, ROLES, request } from '../../core/api';

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

function preview(content) {
    const parts = String(content || '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    const body = (parts.length > 1 ? parts[1] : parts[0]) || '';
    const flat = body.replace(/\s*\n\s*/g, ' ');
    return flat.length > 140 ? flat.slice(0, 137) + '…' : flat;
}

export default function ProfileAndNotificationsApp() {
    const [items, setItems] = useState([]);
    const [unread, setUnread] = useState(0);
    const [open, setOpen] = useState(false);
    const [expandedId, setExpandedId] = useState(null);
    const [panelStyle, setPanelStyle] = useState({ width: '380px', top: '0px', left: '0px' });

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

        const logoutLinks = Array.from(document.querySelectorAll('.app-logout'));
        logoutLinks.forEach((link) => link.addEventListener('click', handleLogout));

        let cancelled = false;
        (async () => {
            try {
                const user = await session();
                if (cancelled || !user) return;
                const fullName = ((user.firstName || '') + ' ' + (user.lastName || '')).trim();

                document.querySelectorAll('.app-account strong').forEach((el) => {
                    el.textContent = fullName;
                });
                document.querySelectorAll('.app-account small').forEach((el) => {
                    el.textContent = (ROLES && ROLES[user.role]) || user.role;
                });

                const capitalize = (text) =>
                    text ? String(text).charAt(0).toUpperCase() + String(text).slice(1) : '';

                document.querySelectorAll('.profile-info-text').forEach((block) => {
                    const labelEl = block.querySelector('.profile-info-label');
                    const label = ((labelEl && labelEl.textContent) || '').trim().toLowerCase();
                    const value = block.querySelector('.profile-info-value');
                    if (!value) return;
                    if (label.includes('name')) value.textContent = fullName;
                    else if (label.startsWith('id'))
                        value.textContent = (user.documentType || '') + ' ' + (user.documentNumber || '');
                    else if (label.includes('email')) value.textContent = user.email || '';
                    else if (label.includes('program')) value.textContent = user.program || 'Unassigned';
                    else if (label.includes('status')) value.textContent = capitalize(user.status);
                });
            } catch (_) {
                // Handled by session redirect if unauthorized
            }
        })();

        return () => {
            cancelled = true;
            logoutLinks.forEach((link) => link.removeEventListener('click', handleLogout));
        };
    }, []);

    // 2. Sync bell badge onto topbar buttons
    useEffect(() => {
        const buttons = Array.from(document.querySelectorAll('.topbar-icon[aria-label="Notifications"]'));
        buttons.forEach((button) => {
            let badge = button.querySelector('.bell-badge');
            if (!unread) {
                if (badge) badge.remove();
                button.removeAttribute('data-unread');
                return;
            }
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'bell-badge';
                button.appendChild(badge);
            }
            badge.textContent = unread > 99 ? '99+' : String(unread);
            button.setAttribute('data-unread', String(unread));
        });
    }, [unread]);

    const placePanel = useCallback((anchor) => {
        const target = anchor || anchorRef.current;
        if (!target) return;
        const rect = target.getBoundingClientRect();
        const width = Math.min(380, window.innerWidth - 16);
        const top = Math.round(rect.bottom + 6);
        const left = Math.max(
            8,
            Math.min(window.innerWidth - width - 8, Math.round(rect.left + rect.width / 2 - width / 2))
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
        const buttons = Array.from(document.querySelectorAll('.topbar-icon[aria-label="Notifications"]'));
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
            setOpen(true);
            syncAriaExpanded(button, true);
            placePanel(button);
            loadNotifications();
        };

        buttons.forEach((button) => {
            button.setAttribute('aria-haspopup', 'dialog');
            button.setAttribute('aria-expanded', 'false');
            button.addEventListener('click', handleBtnClick);
        });

        const handleDocClick = (event) => {
            if (
                openRef.current &&
                panelRef.current &&
                !panelRef.current.contains(event.target)
            ) {
                setOpen(false);
                syncAriaExpanded(null, false);
            }
        };

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

        document.addEventListener('click', handleDocClick);
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
            document.removeEventListener('click', handleDocClick);
            document.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('resize', handleResize);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [loadNotifications, placePanel]);

    const handleItemClick = (n) => {
        const isCurrentlyExpanded = expandedId === n.id;
        setExpandedId(isCurrentlyExpanded ? null : n.id);
        if (!n.read) {
            markRead(n.id);
        }
    };

    if (typeof document === 'undefined') return null;

    return createPortal(
        <div
            ref={panelRef}
            className="bell-panel"
            role="dialog"
            aria-label="Notificaciones"
            hidden={!open}
            style={panelStyle}
        >
            <div className="bell-head">
                <strong>Notificaciones</strong>
                <button
                    type="button"
                    className="bell-markall"
                    hidden={unread === 0}
                    onClick={() => markRead(null)}
                >
                    Marcar todas como leídas
                </button>
            </div>
            <div className="bell-list">
                {items.length === 0 ? (
                    <p className="bell-empty">No tienes notificaciones.</p>
                ) : (
                    items.map((n) => {
                        const expanded = expandedId === n.id;
                        const body = expanded ? String(n.content || '') : preview(n.content);
                        const itemClass =
                            'bell-item' +
                            (n.read ? '' : ' is-unread') +
                            (expanded ? ' is-expanded' : '');
                        return (
                            <button
                                key={n.id}
                                type="button"
                                className={itemClass}
                                aria-expanded={expanded ? 'true' : 'false'}
                                onClick={() => handleItemClick(n)}
                            >
                                <span className="bell-item-subject">{n.subject}</span>
                                {body ? (
                                    <span className={expanded ? 'bell-item-full' : 'bell-item-body'}>
                                        {body}
                                    </span>
                                ) : null}
                                <span className="bell-item-time">{timeAgo(n.createdAt)}</span>
                            </button>
                        );
                    })
                )}
            </div>
        </div>,
        document.body
    );
}
