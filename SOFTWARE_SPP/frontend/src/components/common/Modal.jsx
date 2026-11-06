import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Badge';

export function Modal({ titulo, ancho, cerrarAfuera = false, onClose, children }) {
    const cajaRef = useRef(null);
    const [shake, setShake] = useState(false);

    useEffect(() => {
        const prevFocus = document.activeElement;
        const onKey = (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onClose?.();
            }
        };
        document.addEventListener('keydown', onKey);
        const timer = setTimeout(() => {
            const first = cajaRef.current?.querySelector('input,textarea,select,button:not(.ev-modal-close)');
            if (first) first.focus();
        }, 30);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('keydown', onKey);
            if (prevFocus && typeof prevFocus.focus === 'function') {
                prevFocus.focus();
            }
        };
    }, [onClose]);

    const handleOverlayMouseDown = (e) => {
        if (e.target === e.currentTarget) {
            if (cerrarAfuera) {
                onClose?.();
            } else {
                setShake(false);
                setTimeout(() => setShake(true), 10);
            }
        }
    };

    return createPortal(
        <div className="ev-modal-overlay" onMouseDown={handleOverlayMouseDown}>
            <div
                ref={cajaRef}
                className={`ev-modal${shake ? ' ev-modal--shake' : ''}`}
                role="dialog"
                aria-modal="true"
                style={ancho ? { maxWidth: `${ancho}px` } : undefined}
            >
                <button
                    type="button"
                    className="ev-modal-close"
                    aria-label="Close"
                    onClick={() => onClose?.()}
                >
                    <Icon name="fa-solid fa-xmark" />
                </button>
                <h3 className="ev-modal-title">{titulo}</h3>
                {children}
            </div>
        </div>,
        document.body
    );
}
