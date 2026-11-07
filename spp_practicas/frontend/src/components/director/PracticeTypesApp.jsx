import React, { useEffect, useState, useRef, useCallback } from 'react';
import { get, post, put, del, showError } from '../../core/api';
import { alert as alertModal, confirm as confirmModal } from '../../core/modals';
import { resetScroll } from '../../core/panels';
import { useCustomSelect } from '../../hooks/useCustomSelect';
import { EVENTS, emit, on } from '../../core/events';

export default function PracticeTypesApp() {
    const [activeTab, setActiveTab] = useState('ptm-panel-register');
    const [practiceTypes, setPracticeTypes] = useState([]);
    const [allPractices, setAllPractices] = useState([]);

    const [editingId, setEditingId] = useState(null);
    const [name, setName] = useState('');
    const [semester, setSemester] = useState('');
    const [hours, setHours] = useState('');
    const [errors, setErrors] = useState({});

    const [openMenuId, setOpenMenuId] = useState(null);
    const [highlightId, setHighlightId] = useState(null);

    const rootRef = useRef(null);
    const semesterSelectRef = useRef(null);

    const loadTypes = useCallback(async () => {
        try {
            const [typeRes, pracRes] = await Promise.all([
                get('/api/practice-types'),
                get('/api/practices')
            ]);
            setPracticeTypes(typeRes.practiceTypes || []);
            setAllPractices(pracRes.practices || []);
        } catch (err) {
            showError(err);
        }
    }, []);

    const resetForm = useCallback(() => {
        setEditingId(null);
        setName('');
        setSemester('');
        setHours('');
        setErrors({});
    }, []);

    useEffect(() => {
        loadTypes();

        const navLink = document.querySelector('a[href="#manage-practices"]');
        const handleNavClick = () => {
            resetForm();
        };
        const handlePracticesChanged = () => {
            loadTypes();
        };

        if (navLink) navLink.addEventListener('click', handleNavClick);
        const unsubPractices = on(EVENTS.PRACTICES_CHANGED, handlePracticesChanged);

        return () => {
            if (navLink) navLink.removeEventListener('click', handleNavClick);
            unsubPractices();
        };
    }, [loadTypes, resetForm]);

    // Sync customSelect for semester select
    useCustomSelect([rootRef, semesterSelectRef], [semester, editingId, activeTab]);

    // Close 3-dot card menus on outside click
    useEffect(() => {
        if (!openMenuId) return;
        const handleDocClick = () => setOpenMenuId(null);
        document.addEventListener('click', handleDocClick);
        return () => document.removeEventListener('click', handleDocClick);
    }, [openMenuId]);

    const revealCard = (id) => {
        if (!id) return;
        setActiveTab('ptm-panel-list');
        setHighlightId(String(id));
        setTimeout(() => {
            const card =
                rootRef.current &&
                rootRef.current.querySelector(
                    `.ptm-type-card[data-id="${String(id).replace(/"/g, '')}"]`
                );
            if (!card) return;
            const shell = document.querySelector('.app-shell');
            const isMobile = window.innerWidth <= 900 || window.innerHeight <= 500;
            if (isMobile && shell) {
                const sectionEl = document.getElementById('manage-practices');
                const topbar = sectionEl && sectionEl.querySelector('.app-topbar');
                const topbarHeight = topbar ? topbar.offsetHeight : 0;
                const cardTop =
                    card.getBoundingClientRect().top -
                    shell.getBoundingClientRect().top +
                    shell.scrollTop;
                shell.scrollTo({
                    top: Math.max(0, cardTop - topbarHeight - 24),
                    behavior: 'smooth'
                });
                window.scrollTo(0, 0);
            } else {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 40);
        setTimeout(() => setHighlightId(null), 2400);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const nextErrors = {};
        if (!name.trim()) nextErrors.name = 'Enter the name of the practice type';
        if (!semester) nextErrors.semester = 'Select a semester';
        if (!hours) nextErrors.hours = 'Enter the hours';

        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) return;

        const isEdit = Boolean(editingId);
        const body = { name, semester, hours };
        try {
            let savedId = editingId;
            if (isEdit) {
                await put(`/api/practice-types/${editingId}`, body);
            } else {
                const res = await post('/api/practice-types', body);
                savedId = res && res.practiceType ? res.practiceType.id : null;
            }
            resetForm();
            await loadTypes();
            emit(EVENTS.DATA_CHANGED);
            if (window.SPP_REPORTS && window.SPP_REPORTS.reload) {
                window.SPP_REPORTS.reload();
            }
            revealCard(savedId);
            await alertModal({
                title: isEdit ? 'Practice type updated' : 'Practice type created',
                message: isEdit
                    ? 'The changes were saved and the practice type now appears in the list.'
                    : 'The practice type was registered successfully and already appears in the list.'
            });
        } catch (err) {
            showError(err);
        }
    };

    const handleView = (type) => {
        setOpenMenuId(null);
        alertModal({
            title: type.name,
            icon: 'info',
            rows: [
                { label: 'Practice Code', value: type.code },
                { label: 'Semester', value: type.semester },
                { label: 'Hours', value: type.hours }
            ]
        });
    };

    const handleEdit = (type) => {
        setOpenMenuId(null);
        setEditingId(type.id);
        setName(type.name || '');
        setSemester(String(type.semester || ''));
        setHours(String(type.hours || ''));
        setErrors({});
        setActiveTab('ptm-panel-register');
        resetScroll();
    };

    const handleDelete = async (type) => {
        setOpenMenuId(null);
        const confirmed = await confirmModal({
            title: 'Delete practice type',
            message: `The practice type "${type.name}" will be permanently deleted.\n\nThis action cannot be undone.`,
            confirmLabel: 'Delete'
        });
        if (!confirmed) return;
        try {
            await del(`/api/practice-types/${type.id}`);
            await loadTypes();
            emit(EVENTS.DATA_CHANGED);
            if (window.SPP_REPORTS && window.SPP_REPORTS.reload) {
                window.SPP_REPORTS.reload();
            }
            await alertModal({
                title: 'Practice type deleted',
                message: 'The practice type was deleted successfully.'
            });
        } catch (err) {
            showError(err);
        }
    };

    const isEditing = Boolean(editingId);

    return (
        <div ref={rootRef}>
            <header className="um-header">
                <h1>
                    <span id="ptm-main-title">
                        {isEditing ? 'Edit Practice Type' : 'Manage practice types'}
                    </span>{' '}
                    <span className="um-count-pill" id="ptm-total-pill">
                        {`${practiceTypes.length} practice types registered`}
                    </span>
                </h1>
            </header>

            <nav className="reports-tabs ptm-tabs" aria-label="Practice type management">
                <button
                    type="button"
                    className={`reports-tab-btn ptm-tab-btn${
                        activeTab === 'ptm-panel-register' ? ' active' : ''
                    }`}
                    data-ptm-panel="ptm-panel-register"
                    onClick={() => setActiveTab('ptm-panel-register')}
                >
                    <i
                        className={`fa-solid ${
                            isEditing ? 'fa-pen-to-square' : 'fa-circle-plus'
                        }`}
                        aria-hidden="true"
                    ></i>{' '}
                    <span className="ptm-tab-title">
                        {isEditing ? 'Edit Practice Type' : 'Register Practice Type'}
                    </span>
                </button>
                <button
                    type="button"
                    className={`reports-tab-btn ptm-tab-btn${
                        activeTab === 'ptm-panel-list' ? ' active' : ''
                    }`}
                    data-ptm-panel="ptm-panel-list"
                    onClick={() => setActiveTab('ptm-panel-list')}
                >
                    <i className="fa-solid fa-list" aria-hidden="true"></i> List types
                </button>
            </nav>

            <div
                id="ptm-panel-register"
                className="ptm-panel"
                style={{ display: activeTab === 'ptm-panel-register' ? 'block' : 'none' }}
            >
                <form
                    className="ptm-form ptm-form-centered"
                    id="ptm-form-register"
                    action="#"
                    method="post"
                    noValidate
                    onSubmit={handleSubmit}
                >
                    <div className="cp-card ptm-card">
                        <div className={`cp-field${errors.name ? ' has-error' : ''}`}>
                            <label htmlFor="ptm-name">Practice Name</label>
                            <div className="cp-input-wrap">
                                <input
                                    id="ptm-name"
                                    name="name"
                                    type="text"
                                    placeholder="Practice name"
                                    autoComplete="off"
                                    value={name}
                                    onChange={(e) => {
                                        setName(e.target.value);
                                        if (errors.name) {
                                            setErrors((prev) => ({ ...prev, name: '' }));
                                        }
                                    }}
                                />
                            </div>
                            {errors.name ? <span className="cp-error">{errors.name}</span> : null}
                        </div>

                        <div className="ptm-form-row">
                            <div className={`cp-field${errors.semester ? ' has-error' : ''}`}>
                                <label htmlFor="ptm-semester">Semester No.</label>
                                <div className="cp-input-wrap">
                                    <select
                                        ref={semesterSelectRef}
                                        id="ptm-semester"
                                        name="semester"
                                        value={semester}
                                        onChange={(e) => {
                                            setSemester(e.target.value);
                                            if (errors.semester) {
                                                setErrors((prev) => ({ ...prev, semester: '' }));
                                            }
                                        }}
                                    >
                                        <option value="" disabled>
                                            Select Semester
                                        </option>
                                        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                                            <option key={n} value={String(n)}>
                                                {n}
                                            </option>
                                        ))}
                                    </select>
                                    <i
                                        className="fa-solid fa-chevron-down right-icon"
                                        aria-hidden="true"
                                    ></i>
                                </div>
                                {errors.semester ? (
                                    <span className="cp-error">{errors.semester}</span>
                                ) : null}
                            </div>

                            <div className={`cp-field${errors.hours ? ' has-error' : ''}`}>
                                <label htmlFor="ptm-hours">Required Hours</label>
                                <div className="cp-input-wrap">
                                    <input
                                        id="ptm-hours"
                                        name="hours"
                                        type="text"
                                        className="ptm-hours-input"
                                        placeholder="Hours"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        autoComplete="off"
                                        aria-describedby="ptm-hours-hint"
                                        value={hours}
                                        onChange={(e) => {
                                            const cleaned = e.target.value.replace(/\D/g, '');
                                            setHours(cleaned);
                                            if (errors.hours) {
                                                setErrors((prev) => ({ ...prev, hours: '' }));
                                            }
                                        }}
                                    />
                                </div>
                                {errors.hours ? (
                                    <span className="cp-error">{errors.hours}</span>
                                ) : null}
                            </div>
                        </div>
                    </div>

                    <div className="cp-actions ptm-actions">
                        <button type="submit" className="cp-btn cp-btn-save">
                            {isEditing ? 'Save Changes' : 'Register Type'}
                        </button>
                        <button
                            type="button"
                            className="cp-btn cp-btn-cancel"
                            id="ptm-btn-cancel"
                            onClick={resetForm}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>

            <div
                id="ptm-panel-list"
                className="ptm-panel"
                style={{ display: activeTab === 'ptm-panel-list' ? 'block' : 'none' }}
            >
                <div
                    className="ptm-type-list"
                    id="ptm-type-list"
                    aria-label="List of practice types"
                >
                    {practiceTypes.length === 0 ? (
                        <p style={{ padding: '16px', opacity: 0.7 }}>
                            There are no practice types registered yet.
                        </p>
                    ) : (
                        practiceTypes.map((type) => {
                            const hasActivePractice = allPractices.some(
                                (p) =>
                                    p.status === 'active' &&
                                    String(p.typeId) === String(type.id)
                            );
                            const menuOpen = String(openMenuId) === String(type.id);
                            const isHighlighted = String(highlightId) === String(type.id);
                            return (
                                <article
                                    key={type.id}
                                    className={`ev-card ptm-type-card${
                                        isHighlighted ? ' spp-card-highlight' : ''
                                    }`}
                                    data-id={type.id}
                                    data-code={type.code}
                                >
                                    <div className="ev-card-body ptm-type-card-body">
                                        <p className="ptm-type-label">Practice type</p>
                                        <p className="ev-card-title ptm-type-name">{type.name}</p>
                                        <p className="ptm-type-meta">
                                            <span className="ptm-meta-item">
                                                <span className="ptm-meta-key">Practice Code</span>{' '}
                                                {type.code}
                                            </span>
                                            <span className="ptm-meta-sep" aria-hidden="true">
                                                |
                                            </span>
                                            <span className="ptm-meta-item">
                                                <span className="ptm-meta-key">Semester</span>{' '}
                                                {type.semester}
                                            </span>
                                            <span className="ptm-meta-sep" aria-hidden="true">
                                                |
                                            </span>
                                            <span className="ptm-meta-item">
                                                <span className="ptm-meta-key">Hours</span>{' '}
                                                {type.hours}
                                            </span>
                                        </p>
                                    </div>
                                    <div className="ev-menu-wrapper">
                                        <button
                                            type="button"
                                            className="ev-menu-btn"
                                            aria-label="Practice type options"
                                            aria-expanded={menuOpen ? 'true' : 'false'}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setOpenMenuId(menuOpen ? null : type.id);
                                            }}
                                        >
                                            <i
                                                className="fa-solid fa-ellipsis"
                                                aria-hidden="true"
                                            ></i>
                                        </button>
                                        <div
                                            className={`ev-dropdown${
                                                menuOpen ? ' is-open' : ''
                                            }`}
                                            role="menu"
                                        >
                                            <button
                                                type="button"
                                                className="ev-dropdown-item ev-item--view"
                                                role="menuitem"
                                                onClick={() => handleView(type)}
                                            >
                                                <i
                                                    className="fa-solid fa-eye"
                                                    aria-hidden="true"
                                                ></i>{' '}
                                                View
                                            </button>
                                            <button
                                                type="button"
                                                className="ev-dropdown-item ev-item--edit"
                                                role="menuitem"
                                                onClick={() => handleEdit(type)}
                                            >
                                                <i
                                                    className="fa-solid fa-pen-to-square"
                                                    aria-hidden="true"
                                                ></i>{' '}
                                                Edit
                                            </button>
                                            <button
                                                type="button"
                                                className={`ev-dropdown-item ev-item--delete${
                                                    hasActivePractice ? ' is-disabled' : ''
                                                }`}
                                                role="menuitem"
                                                title={
                                                    hasActivePractice
                                                        ? 'Cannot delete type with active practices'
                                                        : undefined
                                                }
                                                style={
                                                    hasActivePractice
                                                        ? {
                                                              pointerEvents: 'none',
                                                              opacity: 0.5,
                                                              cursor: 'not-allowed'
                                                          }
                                                        : undefined
                                                }
                                                onClick={() =>
                                                    !hasActivePractice && handleDelete(type)
                                                }
                                            >
                                                <i
                                                    className="fa-solid fa-trash"
                                                    aria-hidden="true"
                                                ></i>{' '}
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                </article>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
