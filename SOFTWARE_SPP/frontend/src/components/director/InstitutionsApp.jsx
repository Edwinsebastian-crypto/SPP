import React, { useEffect, useState, useRef, useCallback } from 'react';
import { get, post, put, del, showError } from '../../core/api';
import { alert as alertModal, confirm as confirmModal } from '../../core/modals';
import { resetScroll } from '../../core/panels';
import { EVENTS, emit, on } from '../../core/events';

export default function InstitutionsApp() {
    const [activeTab, setActiveTab] = useState('inst-panel-register');
    const [institutions, setInstitutions] = useState([]);
    const [allPractices, setAllPractices] = useState([]);

    const [editingId, setEditingId] = useState(null);
    const [taxId, setTaxId] = useState('');
    const [manager, setManager] = useState('');
    const [address, setAddress] = useState('');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [errors, setErrors] = useState({});

    const [openMenuId, setOpenMenuId] = useState(null);
    const [highlightId, setHighlightId] = useState(null);

    const rootRef = useRef(null);

    const loadInstitutions = useCallback(async () => {
        try {
            const [instRes, pracRes] = await Promise.all([
                get('/api/institutions'),
                get('/api/practices')
            ]);
            setInstitutions(instRes.institutions || []);
            setAllPractices(pracRes.practices || []);
        } catch (err) {
            showError(err);
        }
    }, []);

    const resetForm = useCallback(() => {
        setEditingId(null);
        setTaxId('');
        setManager('');
        setAddress('');
        setName('');
        setEmail('');
        setErrors({});
    }, []);

    useEffect(() => {
        loadInstitutions();

        const navLink = document.querySelector('a[href="#manage-institutions"]');
        const handleNavClick = () => {
            resetForm();
        };
        const handlePracticesChanged = () => {
            loadInstitutions();
        };

        if (navLink) navLink.addEventListener('click', handleNavClick);
        const unsubPractices = on(EVENTS.PRACTICES_CHANGED, handlePracticesChanged);

        return () => {
            if (navLink) navLink.removeEventListener('click', handleNavClick);
            unsubPractices();
        };
    }, [loadInstitutions, resetForm]);

    // Close 3-dot card menus on outside click
    useEffect(() => {
        if (!openMenuId) return;
        const handleDocClick = () => setOpenMenuId(null);
        document.addEventListener('click', handleDocClick);
        return () => document.removeEventListener('click', handleDocClick);
    }, [openMenuId]);

    const revealCard = (id) => {
        if (!id) return;
        setActiveTab('inst-panel-list');
        setHighlightId(String(id));
        setTimeout(() => {
            const card =
                rootRef.current &&
                rootRef.current.querySelector(
                    `.inst-entity-card[data-id="${String(id).replace(/"/g, '')}"]`
                );
            if (!card) return;
            const shell = document.querySelector('.app-shell');
            const isMobile = window.innerWidth <= 900 || window.innerHeight <= 500;
            if (isMobile && shell) {
                const sectionEl = document.getElementById('manage-institutions');
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
        if (!taxId.trim()) nextErrors.taxId = 'Enter the Tax ID';
        if (!manager.trim()) nextErrors.manager = 'Enter the manager name';
        if (!address.trim()) nextErrors.address = 'Enter the address';
        if (!name.trim()) nextErrors.name = 'Enter the institution name';
        if (!email.trim()) nextErrors.email = 'Enter the email';

        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) return;

        const isEdit = Boolean(editingId);
        const body = { taxId, manager, address, name, email };
        try {
            let savedId = editingId;
            if (isEdit) {
                await put(`/api/institutions/${editingId}`, body);
            } else {
                const res = await post('/api/institutions', body);
                savedId = res && res.institution ? res.institution.id : null;
            }
            resetForm();
            await loadInstitutions();
            emit(EVENTS.DATA_CHANGED);
            if (window.SPP_REPORTS && window.SPP_REPORTS.reload) {
                window.SPP_REPORTS.reload();
            }
            revealCard(savedId);
            await alertModal({
                title: isEdit ? 'Institution updated' : 'Institution created',
                message: isEdit
                    ? 'The changes were saved and the institution now appears in the list.'
                    : 'The institution was registered successfully and already appears in the list.'
            });
        } catch (err) {
            showError(err);
        }
    };

    const handleView = (inst) => {
        setOpenMenuId(null);
        alertModal({
            title: inst.name,
            icon: 'info',
            rows: [
                { label: 'Tax ID', value: inst.taxId },
                { label: 'Manager', value: inst.manager },
                { label: 'Email', value: inst.email },
                { label: 'Address', value: inst.address }
            ]
        });
    };

    const handleEdit = (inst) => {
        setOpenMenuId(null);
        setEditingId(inst.id);
        setTaxId(inst.taxId || '');
        setManager(inst.manager || '');
        setAddress(inst.address || '');
        setName(inst.name || '');
        setEmail(inst.email || '');
        setErrors({});
        setActiveTab('inst-panel-register');
        resetScroll();
    };

    const handleDelete = async (inst) => {
        setOpenMenuId(null);
        const confirmed = await confirmModal({
            title: 'Delete institution',
            message: `The institution "${inst.name}" will be permanently deleted.\n\nThis action cannot be undone.`,
            confirmLabel: 'Delete'
        });
        if (!confirmed) return;
        try {
            await del(`/api/institutions/${inst.id}`);
            await loadInstitutions();
            emit(EVENTS.DATA_CHANGED);
            if (window.SPP_REPORTS && window.SPP_REPORTS.reload) {
                window.SPP_REPORTS.reload();
            }
            await alertModal({
                title: 'Institution deleted',
                message: 'The institution was deleted successfully.'
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
                    <span id="inst-main-title">
                        {isEditing ? 'Edit Institution' : 'Manage institutions'}
                    </span>{' '}
                    <span className="um-count-pill" id="inst-total-pill">
                        {`${institutions.length} institutions registered`}
                    </span>
                </h1>
            </header>

            <nav className="reports-tabs inst-tabs" aria-label="Institution management">
                <button
                    type="button"
                    className={`reports-tab-btn inst-tab-btn${
                        activeTab === 'inst-panel-register' ? ' active' : ''
                    }`}
                    data-inst-panel="inst-panel-register"
                    onClick={() => setActiveTab('inst-panel-register')}
                >
                    <i
                        className={`fa-solid ${
                            isEditing ? 'fa-pen-to-square' : 'fa-circle-plus'
                        }`}
                        aria-hidden="true"
                    ></i>{' '}
                    <span className="inst-tab-title">
                        {isEditing ? 'Edit Institution' : 'Register Institution'}
                    </span>
                </button>
                <button
                    type="button"
                    className={`reports-tab-btn inst-tab-btn${
                        activeTab === 'inst-panel-list' ? ' active' : ''
                    }`}
                    data-inst-panel="inst-panel-list"
                    onClick={() => setActiveTab('inst-panel-list')}
                >
                    <i className="fa-solid fa-list" aria-hidden="true"></i> List institutions
                </button>
            </nav>

            <div
                id="inst-panel-register"
                className="inst-panel"
                style={{ display: activeTab === 'inst-panel-register' ? 'block' : 'none' }}
            >
                <form
                    id="inst-form-register"
                    className="inst-form"
                    action="#"
                    method="post"
                    noValidate
                    onSubmit={handleSubmit}
                >
                    <div className="cp-layout inst-layout">
                        <div className="cp-card">
                            <div className={`cp-field${errors.taxId ? ' has-error' : ''}`}>
                                <label htmlFor="inst-taxid">Institution Tax ID</label>
                                <div className="cp-input-wrap">
                                    <input
                                        id="inst-taxid"
                                        name="taxid"
                                        type="text"
                                        placeholder="Tax ID"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        autoComplete="off"
                                        maxLength={10}
                                        readOnly={isEditing}
                                        value={taxId}
                                        onChange={(e) => {
                                            const cleaned = e.target.value
                                                .replace(/[^\d-]/g, '')
                                                .slice(0, 10);
                                            setTaxId(cleaned);
                                            if (errors.taxId) {
                                                setErrors((prev) => ({ ...prev, taxId: '' }));
                                            }
                                        }}
                                    />
                                </div>
                                {errors.taxId ? (
                                    <span className="cp-error">{errors.taxId}</span>
                                ) : null}
                            </div>

                            <div className={`cp-field${errors.manager ? ' has-error' : ''}`}>
                                <label htmlFor="inst-manager">Manager</label>
                                <div className="cp-input-wrap">
                                    <input
                                        id="inst-manager"
                                        name="manager"
                                        type="text"
                                        placeholder="Manager name"
                                        autoComplete="name"
                                        value={manager}
                                        onChange={(e) => {
                                            setManager(e.target.value);
                                            if (errors.manager) {
                                                setErrors((prev) => ({ ...prev, manager: '' }));
                                            }
                                        }}
                                    />
                                </div>
                                {errors.manager ? (
                                    <span className="cp-error">{errors.manager}</span>
                                ) : null}
                            </div>

                            <div className={`cp-field${errors.address ? ' has-error' : ''}`}>
                                <label htmlFor="inst-address">Address</label>
                                <div className="cp-input-wrap">
                                    <input
                                        id="inst-address"
                                        name="address"
                                        type="text"
                                        placeholder="Institution address"
                                        autoComplete="street-address"
                                        value={address}
                                        onChange={(e) => {
                                            setAddress(e.target.value);
                                            if (errors.address) {
                                                setErrors((prev) => ({ ...prev, address: '' }));
                                            }
                                        }}
                                    />
                                </div>
                                {errors.address ? (
                                    <span className="cp-error">{errors.address}</span>
                                ) : null}
                            </div>
                        </div>

                        <div className="cp-card">
                            <div className={`cp-field${errors.name ? ' has-error' : ''}`}>
                                <label htmlFor="inst-name">Institution Name</label>
                                <div className="cp-input-wrap">
                                    <input
                                        id="inst-name"
                                        name="name"
                                        type="text"
                                        placeholder="Institution name"
                                        autoComplete="organization"
                                        value={name}
                                        onChange={(e) => {
                                            setName(e.target.value);
                                            if (errors.name) {
                                                setErrors((prev) => ({ ...prev, name: '' }));
                                            }
                                        }}
                                    />
                                </div>
                                {errors.name ? (
                                    <span className="cp-error">{errors.name}</span>
                                ) : null}
                            </div>

                            <div className={`cp-field${errors.email ? ' has-error' : ''}`}>
                                <label htmlFor="inst-email">E-mail</label>
                                <div className="cp-input-wrap">
                                    <input
                                        id="inst-email"
                                        name="email"
                                        type="email"
                                        placeholder="email@institution.edu"
                                        autoComplete="email"
                                        value={email}
                                        onChange={(e) => {
                                            setEmail(e.target.value);
                                            if (errors.email) {
                                                setErrors((prev) => ({ ...prev, email: '' }));
                                            }
                                        }}
                                    />
                                </div>
                                {errors.email ? (
                                    <span className="cp-error">{errors.email}</span>
                                ) : null}
                            </div>
                        </div>
                    </div>

                    <div className="cp-actions inst-actions">
                        <button type="submit" className="cp-btn cp-btn-save">
                            {isEditing ? 'Save Changes' : 'Register Institution'}
                        </button>
                        <button
                            type="button"
                            className="cp-btn cp-btn-cancel"
                            id="inst-btn-cancel"
                            onClick={resetForm}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>

            <div
                id="inst-panel-list"
                className="inst-panel"
                style={{ display: activeTab === 'inst-panel-list' ? 'block' : 'none' }}
            >
                <div
                    className="entity-list inst-entity-list"
                    id="inst-entity-list"
                    aria-label="List of institutions"
                >
                    {institutions.length === 0 ? (
                        <p style={{ padding: '16px', opacity: 0.7 }}>
                            There are no institutions registered yet.
                        </p>
                    ) : (
                        institutions.map((inst) => {
                            const hasActivePractice = allPractices.some(
                                (p) =>
                                    p.status === 'active' &&
                                    String(p.institutionId) === String(inst.id)
                            );
                            const menuOpen = String(openMenuId) === String(inst.id);
                            const isHighlighted = String(highlightId) === String(inst.id);
                            return (
                                <article
                                    key={inst.id}
                                    className={`ev-card inst-entity-card${
                                        isHighlighted ? ' spp-card-highlight' : ''
                                    }`}
                                    data-id={inst.id}
                                    data-taxid={inst.taxId}
                                >
                                    <div className="ev-card-body">
                                        <p className="entity-card-label">Institution</p>
                                        <p className="ev-card-title">{inst.name}</p>
                                        <p className="entity-card-meta">
                                            <span className="entity-meta-item">
                                                <span className="entity-meta-key">Tax ID</span>{' '}
                                                {inst.taxId}
                                            </span>
                                            <span className="entity-meta-sep" aria-hidden="true">
                                                |
                                            </span>
                                            <span className="entity-meta-item">
                                                <span className="entity-meta-key">Manager</span>{' '}
                                                {inst.manager}
                                            </span>
                                            <span className="entity-meta-sep" aria-hidden="true">
                                                |
                                            </span>
                                            <span className="entity-meta-item">
                                                <span className="entity-meta-key">Email</span>{' '}
                                                {inst.email}
                                            </span>
                                        </p>
                                        <p className="entity-card-desc">{inst.address}</p>
                                    </div>
                                    <div className="ev-menu-wrapper">
                                        <button
                                            type="button"
                                            className="ev-menu-btn"
                                            aria-label="Institution options"
                                            aria-expanded={menuOpen ? 'true' : 'false'}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setOpenMenuId(menuOpen ? null : inst.id);
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
                                                onClick={() => handleView(inst)}
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
                                                onClick={() => handleEdit(inst)}
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
                                                        ? 'Cannot delete institution with active practices'
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
                                                    !hasActivePractice && handleDelete(inst)
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
