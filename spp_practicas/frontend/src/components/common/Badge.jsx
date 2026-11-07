import React, { useState } from 'react';
import { ESTADOS } from '../../utils/evalBridge';

export function Icon({ name }) {
    return <i className={name} aria-hidden="true" />;
}

export function Badge({ estado, textoPropio }) {
    if (!estado) return null;
    const [t, ic] = ESTADOS[estado] || [estado, 'fa-solid fa-circle'];
    return (
        <span className={`ev-badge ev-badge--${String(estado).toLowerCase()}`}>
            <Icon name={ic} />
            {textoPropio || t}
        </span>
    );
}

export function BadgeOrigen({ origen }) {
    if (origen === 'IA') {
        return (
            <span className="ev-badge ev-badge--ia">
                <Icon name="fa-solid fa-wand-magic-sparkles" />
                AI
            </span>
        );
    }
    return (
        <span className="ev-badge ev-badge--manual">
            <Icon name="fa-solid fa-pen" />
            Manual
        </span>
    );
}

export function BusyButton({
    className = '',
    icon,
    busyText,
    onClick,
    disabled = false,
    title,
    style,
    children,
    ...rest
}) {
    const [busy, setBusy] = useState(false);

    const handleClick = async (e) => {
        if (busy || disabled || !onClick) return;
        setBusy(true);
        document.body.classList.add('is-loading-wait');
        try {
            await onClick(e);
        } finally {
            setBusy(false);
            document.body.classList.remove('is-loading-wait');
        }
    };

    return (
        <button
            type="button"
            className={`${className}${busy ? ' is-busy' : ''}`}
            disabled={disabled || busy}
            title={title}
            style={style}
            onClick={handleClick}
            {...rest}
        >
            {busy && busyText ? (
                <>
                    <Icon name="fa-solid fa-spinner fa-spin" /> {busyText}
                </>
            ) : (
                <>
                    {icon ? <Icon name={icon} /> : null}
                    {children}
                </>
            )}
        </button>
    );
}
