import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

const ROLES = {
    student: { name: 'Student', icon: 'fa-graduation-cap', cssClass: '' },
    tutor: { name: 'Academic Tutor', icon: 'fa-user', cssClass: 'um-pill--tutor' },
    advisor: {
        name: 'Pedagogical Advisor',
        icon: 'fa-user-group',
        cssClass: 'um-pill--advisor'
    },
    director: { name: 'Director', icon: 'fa-briefcase', cssClass: 'um-pill--director' }
};

const STATUS_LABELS = {
    active: 'Active',
    pending: 'Pending',
    inactive: 'Inactive'
};

function stripAccents(text) {
    return String(text || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function fullName(user) {
    if (!user) return '';
    return ((user.firstName || '') + ' ' + (user.lastName || '')).trim();
}

function initials(user) {
    const a = (user.firstName || '').trim().charAt(0);
    const b = (user.lastName || '').trim().charAt(0);
    return (a + b).toUpperCase() || '··';
}

function CredentialCard({
    user,
    domain,
    activePracticeId,
    onOpenLogbook,
    onApprove,
    onReject
}) {
    const role = ROLES[user.role] || ROLES.student;
    const name = fullName(user) || user.name || 'User name';
    const doc = `${user.documentType || '-'}  •  ${user.documentNumber || '—'}`;
    const status = user.status || 'active';
    const year = new Date().getFullYear();
    const uid = user.id || user.documentNumber;

    return (
        <>
            <article className="um-cred">
                <header className="um-cred-top">
                    <div className="um-cred-brand">
                        <i className="fa-solid fa-shield-halved" aria-hidden="true"></i>
                        <p>
                            University
                            <br />
                            credential <em>{year}</em>
                        </p>
                    </div>
                    <span className={`um-cred-state um-cred-state--${status}`}>
                        {(STATUS_LABELS[status] || 'Active').toUpperCase()}
                    </span>
                </header>
                {activePracticeId ? (
                    <button
                        type="button"
                        className="um-cred-cta"
                        data-um-logbook={activePracticeId}
                        onClick={() => onOpenLogbook && onOpenLogbook(activePracticeId)}
                    >
                        View practice <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
                    </button>
                ) : null}
                <div className="um-cred-body">
                    <h3 className="um-cred-name">{name}</h3>
                    <p className="um-cred-doc">{doc}</p>
                    <span className="um-cred-role">
                        <i className={`fa-solid ${role.icon}`} aria-hidden="true"></i>
                        {role.name}
                    </span>
                    <dl className="um-cred-meta">
                        <div>
                            <dt>PROGRAMA ACADÉMICO</dt>
                            <dd>{user.program || 'Unassigned'}</dd>
                        </div>
                        <div>
                            <dt>CORREO</dt>
                            <dd className="is-mono">{user.email || `user${domain}`}</dd>
                        </div>
                    </dl>
                </div>
            </article>
            {status === 'pending' && uid && (onApprove || onReject) ? (
                <div
                    className="um-cred-modal-actions"
                    style={{
                        marginTop: '14px',
                        display: 'flex',
                        gap: '10px',
                        width: '100%'
                    }}
                >
                    <button
                        type="button"
                        className="um-btn-reject"
                        data-act="reject"
                        data-id={uid}
                        style={{
                            flex: 1,
                            height: '44px',
                            border: 'none',
                            borderRadius: '12px',
                            background: '#b3261e',
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: '14px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            boxShadow: '0 4px 12px rgba(179,38,30,0.3)',
                            transition: 'transform .12s ease'
                        }}
                        onClick={() => onReject && onReject(user)}
                    >
                        <i className="fa-solid fa-user-xmark" aria-hidden="true"></i> Reject
                    </button>
                    <button
                        type="button"
                        className="um-btn-approve"
                        data-act="approve"
                        data-id={uid}
                        style={{
                            flex: 1,
                            height: '44px',
                            border: 'none',
                            borderRadius: '12px',
                            background: '#1f7a63',
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: '14px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            boxShadow: '0 4px 12px rgba(31,122,99,0.3)',
                            transition: 'transform .12s ease'
                        }}
                        onClick={() => onApprove && onApprove(user)}
                    >
                        <i className="fa-solid fa-user-check" aria-hidden="true"></i> Accept
                    </button>
                </div>
            ) : null}
        </>
    );
}

export default function ManageUsersApp() {
    const domain = '@' + (window.SPP_DOMAIN || 'university.edu');

    const [activeTab, setActiveTab] = useState('um-panel-register');
    const [users, setUsers] = useState([]);
    const [allPractices, setAllPractices] = useState([]);
    const [programs, setPrograms] = useState([]);

    // Wizard state
    const [currentStep, setCurrentStep] = useState(1);
    const [editingId, setEditingId] = useState(null);
    const [documentType, setDocumentType] = useState('');
    const [documentNumber, setDocumentNumber] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [role, setRole] = useState('student');
    const [program, setProgram] = useState('');
    const [accountStatus, setAccountStatus] = useState('active');
    const [emailUser, setEmailUser] = useState('');
    const [password, setPassword] = useState('');
    const [showPassInput, setShowPassInput] = useState(false);
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);

    // List state
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [page, setPage] = useState(1);
    const [selectedIds, setSelectedIds] = useState(new Set());

    // Modal state
    const [modalBodyEl, setModalBodyEl] = useState(null);
    const [modalUser, setModalUser] = useState(null);
    const [modalPracticeId, setModalPracticeId] = useState(null);

    const rootRef = useRef(null);
    const docTypeSelectRef = useRef(null);
    const programSelectRef = useRef(null);
    const roleFilterSelectRef = useRef(null);
    const statusFilterSelectRef = useRef(null);
    const rowsSelectRef = useRef(null);
    const selectAllRef = useRef(null);
    const emailEditedRef = useRef(false);

    // Load programs & users
    const loadPrograms = useCallback(async () => {
        const SPP = window.SPP;
        if (!SPP) return;
        try {
            const res = await SPP.get('/api/users/programs');
            setPrograms((res && res.programs) || []);
        } catch (_) {
            // fallback
        }
    }, []);

    const loadUsers = useCallback(async () => {
        const SPP = window.SPP;
        if (!SPP) return;
        try {
            const [res, pracRes] = await Promise.all([
                SPP.get('/api/users'),
                SPP.get('/api/practices')
            ]);
            const list = res && res.users ? res.users.filter((u) => u.role !== 'director') : [];
            setUsers(list);
            setAllPractices((pracRes && pracRes.practices) || []);
            window.dispatchEvent(new Event('spp:dataChanged'));
        } catch (_) {
            setUsers([]);
            setAllPractices([]);
        }
    }, []);

    useEffect(() => {
        loadPrograms();
        loadUsers();

        const handlePracticesChanged = () => loadUsers();
        window.addEventListener('spp:practices-changed', handlePracticesChanged);
        return () => window.removeEventListener('spp:practices-changed', handlePracticesChanged);
    }, [loadPrograms, loadUsers]);

    // Sync customSelects
    useEffect(() => {
        const SPP = window.SPP;
        if (!SPP || !SPP.customSelect || !rootRef.current) return;
        SPP.customSelect.init(rootRef.current);
        [
            docTypeSelectRef.current,
            programSelectRef.current,
            roleFilterSelectRef.current,
            statusFilterSelectRef.current,
            rowsSelectRef.current
        ].forEach((sel) => {
            if (sel) {
                SPP.customSelect.rebuild(sel);
                SPP.customSelect.sync(sel);
            }
        });
    }, [
        programs,
        documentType,
        program,
        role,
        roleFilter,
        statusFilter,
        rowsPerPage,
        activeTab,
        editingId
    ]);

    // Credential modal setup
    const closeModals = useCallback(() => {
        setModalUser(null);
        setModalPracticeId(null);
        const modal = document.getElementById('um-modal-credential');
        if (modal) modal.style.display = 'none';
    }, []);

    const openCredential = useCallback(async (user) => {
        if (!user) return;
        const normalized = { ...user, id: user.id || user.documentNumber };
        let activePid = null;
        try {
            if (normalized.role === 'student' && normalized.id && window.SPP) {
                const res = await window.SPP.get('/api/practices');
                if (res && res.practices) {
                    const userPractices = res.practices.filter(
                        (p) => String(p.studentDocument) === String(normalized.id)
                    );
                    const active = userPractices.find((p) => p.status === 'active');
                    if (active) activePid = active.id;
                }
            }
        } catch (_) {
            // ignore
        }
        setModalUser(normalized);
        setModalPracticeId(activePid);
        const modal = document.getElementById('um-modal-credential');
        if (modal) modal.style.display = 'flex';
    }, []);

    useEffect(() => {
        const body = document.getElementById('um-modal-credential-body');
        if (body) {
            body.innerHTML = '';
            setModalBodyEl(body);
        }

        if (window.SPP) {
            window.SPP.openUserModal = openCredential;
        }
        const handleOpenModalEvent = (e) => {
            if (e.detail && e.detail.user) openCredential(e.detail.user);
        };
        window.addEventListener('spp:open-user-modal', handleOpenModalEvent);

        const closeBtns = Array.from(document.querySelectorAll('[data-um-close]'));
        closeBtns.forEach((b) => b.addEventListener('click', closeModals));

        const modal = document.getElementById('um-modal-credential');
        const handleOverlayClick = (e) => {
            if (e.target === modal) closeModals();
        };
        if (modal) modal.addEventListener('click', handleOverlayClick);

        const handleKey = (e) => {
            if (e.key === 'Escape') closeModals();
        };
        document.addEventListener('keydown', handleKey);

        return () => {
            window.removeEventListener('spp:open-user-modal', handleOpenModalEvent);
            closeBtns.forEach((b) => b.removeEventListener('click', closeModals));
            if (modal) modal.removeEventListener('click', handleOverlayClick);
            document.removeEventListener('keydown', handleKey);
        };
    }, [openCredential, closeModals]);

    // Faculty derived from selected program
    const selectedProgramObj = programs.find((p) => p.name === program);
    const faculty = selectedProgramObj ? selectedProgramObj.faculty || '' : '';

    // Suggest email from first/last name
    const suggestEmail = () => {
        if (emailEditedRef.current) return;
        const first = stripAccents(firstName.trim().split(/\s+/)[0] || '');
        const last = stripAccents(lastName.trim().split(/\s+/)[0] || '');
        if (!first && !last) return;
        setEmailUser((first ? first.charAt(0) + '.' : '') + last);
    };

    const validateStep = (step) => {
        const nextErrors = { ...errors };
        let valid = true;

        if (step === 1) {
            delete nextErrors.documentType;
            delete nextErrors.documentNumber;
            delete nextErrors.firstName;
            delete nextErrors.lastName;

            if (!documentType) {
                nextErrors.documentType = 'Select a document type.';
                valid = false;
            }
            if (!/^\d{6,15}$/.test(documentNumber.trim())) {
                nextErrors.documentNumber =
                    'Enter the document number (digits only, at least 6).';
                valid = false;
            }
            if (lastName.trim().length < 2) {
                nextErrors.lastName = 'Enter the full last names.';
                valid = false;
            }
            if (firstName.trim().length < 2) {
                nextErrors.firstName = 'Enter the first names of the user.';
                valid = false;
            }
            const duplicate = users.find(
                (u) =>
                    String(u.documentNumber) === documentNumber.trim() &&
                    String(u.id) !== String(editingId)
            );
            if (duplicate) {
                nextErrors.documentNumber = 'A user with this document already exists.';
                valid = false;
            }
        }

        if (step === 2) {
            delete nextErrors.program;
            if (role !== 'advisor' && !program) {
                nextErrors.program = 'Select the program or department.';
                valid = false;
            }
        }

        if (step === 3) {
            delete nextErrors.emailUser;
            delete nextErrors.password;

            const passwordOptional = Boolean(editingId) && password === '';
            if (
                !passwordOptional &&
                (password.length < 8 ||
                    !/[a-z]/.test(password) ||
                    !/[A-Z]/.test(password) ||
                    !/\d/.test(password))
            ) {
                nextErrors.password = editingId
                    ? 'Leave it empty to keep it, or use 8+ characters with an uppercase letter, a lowercase letter and a number.'
                    : 'At least 8 characters, with an uppercase letter, a lowercase letter and a number.';
                valid = false;
            }
            if (!/^[a-z0-9]+([._-][a-z0-9]+)*$/i.test(emailUser.trim())) {
                nextErrors.emailUser = 'Use letters, numbers, dot, hyphen or underscore.';
                valid = false;
            }
            const duplicateEmail = users.find(
                (u) =>
                    u.email === emailUser.trim() + domain && String(u.id) !== String(editingId)
            );
            if (duplicateEmail) {
                nextErrors.emailUser = 'This institutional e-mail is already assigned.';
                valid = false;
            }
        }

        setErrors(nextErrors);
        return valid;
    };

    const goToStep = (target) => {
        const clamped = Math.min(Math.max(target, 1), 4);
        setCurrentStep(clamped);
        if (window.SPP && window.SPP.panels && window.SPP.panels.resetScroll) {
            window.SPP.panels.resetScroll();
        }
    };

    const handleNextStep = () => {
        if (!validateStep(currentStep)) return;
        if (currentStep === 1) suggestEmail();
        goToStep(currentStep + 1);
    };

    const handleStepHeaderClick = (target) => {
        if (target <= currentStep) {
            goToStep(target);
            return;
        }
        for (let s = currentStep; s < target; s++) {
            if (!validateStep(s)) {
                goToStep(s);
                return;
            }
        }
        if (currentStep === 1 && target > 1) suggestEmail();
        goToStep(target);
    };

    const generatePassword = () => {
        const letters = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
        const digits = '23456789';
        const symbols = '!@#$%*';
        let nextPass = '';
        for (let i = 0; i < 10; i++) {
            nextPass += letters.charAt(Math.floor(Math.random() * letters.length));
        }
        for (let i = 0; i < 3; i++) {
            nextPass += digits.charAt(Math.floor(Math.random() * digits.length));
        }
        nextPass += symbols.charAt(Math.floor(Math.random() * symbols.length));
        setPassword(nextPass);
        setErrors((prev) => ({ ...prev, password: '' }));
    };

    const clearForm = useCallback(() => {
        setEditingId(null);
        emailEditedRef.current = false;
        setDocumentType('');
        setDocumentNumber('');
        setFirstName('');
        setLastName('');
        setRole('student');
        setProgram('');
        setAccountStatus('active');
        setEmailUser('');
        setPassword('');
        setShowPassInput(false);
        setErrors({});
        setCurrentStep(1);
        if (window.SPP && window.SPP.panels && window.SPP.panels.resetScroll) {
            window.SPP.panels.resetScroll();
        }
    }, []);

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        for (let s = 1; s <= 3; s++) {
            if (!validateStep(s)) {
                goToStep(s);
                return;
            }
        }
        const SPP = window.SPP;
        if (!SPP) return;

        const body = {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            documentType,
            documentNumber: documentNumber.trim(),
            role,
            program,
            status: accountStatus,
            email: emailUser.trim(),
            password
        };

        setSubmitting(true);
        try {
            if (editingId) {
                await SPP.put('/api/users/' + encodeURIComponent(editingId), body);
                await SPP.modals.alert({
                    title: 'User updated',
                    message: 'User updated successfully'
                });
            } else {
                await SPP.post('/api/users', body);
                await SPP.modals.alert({
                    title: 'User registered',
                    message: 'User registered successfully'
                });
            }
            clearForm();
            await loadUsers();
            window.dispatchEvent(new CustomEvent('spp:home-refresh'));
        } catch (err) {
            await SPP.modals.alert({
                title: 'Could not save',
                message: err.message || 'Error saving user'
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleEditUser = (user) => {
        setEditingId(user.id);
        emailEditedRef.current = true;
        setFirstName(user.firstName || '');
        setLastName(user.lastName || '');
        setDocumentType(user.documentType || '');
        setDocumentNumber(user.documentNumber || '');
        setEmailUser((user.email || '').split('@')[0]);
        setPassword('');
        setRole(user.role || 'student');
        if (user.program && !programs.some((p) => p.name === user.program)) {
            setPrograms((prev) => [
                ...prev,
                { name: user.program, faculty: user.faculty || '' }
            ]);
        }
        setProgram(user.program || '');
        setAccountStatus(user.status || 'active');
        setErrors({});
        setActiveTab('um-panel-register');
        setCurrentStep(1);
        if (window.SPP && window.SPP.panels && window.SPP.panels.resetScroll) {
            window.SPP.panels.resetScroll();
        }
    };

    const handleApproveUser = async (user, fromModal = false) => {
        const SPP = window.SPP;
        if (!SPP) return;
        const uid = user.id || user.documentNumber;
        try {
            await SPP.patch('/api/users/' + encodeURIComponent(uid) + '/status', {
                status: 'active'
            });
            if (fromModal) closeModals();
            await loadUsers();
            window.dispatchEvent(new CustomEvent('spp:home-refresh'));
            if (fromModal) {
                await SPP.modals.alert({
                    title: 'User accepted',
                    message: 'The user has been activated successfully.'
                });
            }
        } catch (err) {
            await SPP.modals.alert({
                title: 'Could not accept the registration',
                message: err.message
            });
        }
    };

    const handleRejectUser = async (user, fromModal = false) => {
        const SPP = window.SPP;
        if (!SPP) return;
        const uid = user.id || user.documentNumber;
        const name = user.name || fullName(user) || 'user';
        const rejected = await SPP.modals.confirm({
            title: 'Reject ' + name,
            message: 'The registration request and its access account will be deleted.',
            confirmLabel: 'Yes, reject',
            isDestructive: true
        });
        if (!rejected) return;
        try {
            await SPP.del('/api/users/' + encodeURIComponent(uid));
            if (fromModal) closeModals();
            setSelectedIds((prev) => {
                const next = new Set(prev);
                next.delete(uid);
                return next;
            });
            await loadUsers();
            window.dispatchEvent(new CustomEvent('spp:home-refresh'));
            if (fromModal) {
                await SPP.modals.alert({
                    title: 'Registration rejected',
                    message: 'The user registration has been rejected and deleted.'
                });
            }
        } catch (err) {
            await SPP.modals.alert({
                title: 'Could not reject the registration',
                message: err.message
            });
        }
    };

    const handleDeleteUser = async (user) => {
        const SPP = window.SPP;
        if (!SPP) return;
        const confirmed = await SPP.modals.confirm({
            title: 'Delete ' + fullName(user),
            message:
                'The user will lose access to the portal and will be removed from the list.',
            confirmLabel: 'Yes, delete',
            isDestructive: true
        });
        if (!confirmed) return;
        try {
            await SPP.del('/api/users/' + encodeURIComponent(user.id));
            setSelectedIds((prev) => {
                const next = new Set(prev);
                next.delete(user.id);
                return next;
            });
            await loadUsers();
            window.dispatchEvent(new CustomEvent('spp:home-refresh'));
        } catch (err) {
            await SPP.modals.alert({ title: 'Could not delete', message: err.message });
        }
    };

    const handleBulkAction = async (action) => {
        const SPP = window.SPP;
        if (!SPP) return;
        const ids = Array.from(selectedIds);
        if (action === 'cancel') {
            setSelectedIds(new Set());
            return;
        }
        if (action === 'delete') {
            const confirmed = await SPP.modals.confirm({
                title: `Delete ${ids.length} user(s)`,
                message:
                    'They will lose access to the portal and will be removed from the list.',
                confirmLabel: 'Yes, delete',
                isDestructive: true
            });
            if (!confirmed) return;
            try {
                for (const id of ids) {
                    await SPP.del('/api/users/' + encodeURIComponent(id));
                }
                setSelectedIds(new Set());
                await loadUsers();
                window.dispatchEvent(new CustomEvent('spp:home-refresh'));
            } catch (err) {
                await SPP.modals.alert({ title: 'Could not delete', message: err.message });
            }
            return;
        }

        const nextStatus = action === 'activate' ? 'active' : 'inactive';
        try {
            for (const id of ids) {
                await SPP.patch('/api/users/' + encodeURIComponent(id) + '/status', {
                    status: nextStatus
                });
            }
            setSelectedIds(new Set());
            await loadUsers();
            window.dispatchEvent(new CustomEvent('spp:home-refresh'));
        } catch (err) {
            await SPP.modals.alert({ title: 'Could not update', message: err.message });
        }
    };

    // Filtering & pagination
    const queryNorm = stripAccents(searchQuery.trim());
    const filteredList = users.filter((u) => {
        if (roleFilter && u.role !== roleFilter) return false;
        if (statusFilter && u.status !== statusFilter) return false;
        if (!queryNorm) return true;
        return stripAccents(`${fullName(u)} ${u.documentNumber} ${u.email}`).includes(
            queryNorm
        );
    });

    const perPage = Number(rowsPerPage) || 10;
    const totalPages = Math.max(Math.ceil(filteredList.length / perPage), 1);
    const safePage = Math.min(page, totalPages);
    const startIdx = (safePage - 1) * perPage;
    const visibleUsers = filteredList.slice(startIdx, startIdx + perPage);

    // Sync indeterminate state on selectAll checkbox
    useEffect(() => {
        if (!selectAllRef.current) return;
        const visibleIds = visibleUsers.map((u) => u.id);
        const markedCount = visibleIds.filter((id) => selectedIds.has(id)).length;
        selectAllRef.current.checked =
            visibleIds.length > 0 && markedCount === visibleIds.length;
        selectAllRef.current.indeterminate =
            markedCount > 0 && markedCount < visibleIds.length;
    }, [visibleUsers, selectedIds]);

    const toggleRowSelection = (id, checked) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (checked) next.add(id);
            else next.delete(id);
            return next;
        });
    };

    const toggleSelectAllVisible = (checked) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            visibleUsers.forEach((u) => {
                if (checked) next.add(u.id);
                else next.delete(u.id);
            });
            return next;
        });
    };

    const hasUserActivePractice = (u) =>
        allPractices.some(
            (p) =>
                p.status === 'active' &&
                (String(p.studentDocument) === String(u.documentNumber) ||
                    String(p.tutorDocument) === String(u.documentNumber) ||
                    String(p.advisorDocument) === String(u.documentNumber))
        );

    const renderRowActions = (u) => {
        const activePrac = hasUserActivePractice(u);
        return (
            <div className="um-row-actions">
                {u.status === 'pending' ? (
                    <>
                        <button
                            type="button"
                            data-act="approve"
                            data-id={u.id}
                            title="Accept registration"
                            aria-label="Accept registration"
                            style={{ color: '#2f7d5b' }}
                            onClick={() => handleApproveUser(u, false)}
                        >
                            <i className="fa-solid fa-user-check" aria-hidden="true"></i>
                        </button>
                        <button
                            type="button"
                            data-act="reject"
                            data-id={u.id}
                            title="Reject registration"
                            aria-label="Reject registration"
                            style={{ color: '#b3261e' }}
                            onClick={() => handleRejectUser(u, false)}
                        >
                            <i className="fa-solid fa-user-xmark" aria-hidden="true"></i>
                        </button>
                    </>
                ) : null}
                <button
                    type="button"
                    data-act="view"
                    data-id={u.id}
                    title="View credential"
                    aria-label="View credential"
                    onClick={() => openCredential(u)}
                >
                    <i className="fa-solid fa-id-card" aria-hidden="true"></i>
                </button>
                <button
                    type="button"
                    data-act="edit"
                    data-id={u.id}
                    title="Edit user"
                    aria-label="Edit user"
                    onClick={() => handleEditUser(u)}
                >
                    <i className="fa-solid fa-pen-to-square" aria-hidden="true"></i>
                </button>
                <button
                    type="button"
                    data-act={activePrac ? undefined : 'delete'}
                    data-id={u.id}
                    disabled={activePrac}
                    style={
                        activePrac ? { cursor: 'not-allowed', opacity: 0.5 } : undefined
                    }
                    title={
                        activePrac
                            ? 'Cannot delete user with active practices'
                            : 'Delete user'
                    }
                    aria-label="Delete user"
                    onClick={() => !activePrac && handleDeleteUser(u)}
                >
                    <i className="fa-solid fa-trash" aria-hidden="true"></i>
                </button>
            </div>
        );
    };

    const previewData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        documentType,
        documentNumber: documentNumber.trim(),
        role,
        program,
        status: accountStatus,
        email: emailUser.trim() ? emailUser.trim() + domain : '',
        password
    };

    const kpiStudents = users.filter((u) => u.role === 'student').length;
    const kpiTutors = users.filter((u) => u.role === 'tutor').length;
    const kpiAdvisors = users.filter((u) => u.role === 'advisor').length;
    const kpiPending = users.filter((u) => u.status === 'pending').length;

    const pageFrom = Math.max(1, Math.min(safePage - 2, totalPages - 4));
    const pageTo = Math.min(totalPages, Math.max(safePage + 2, 5));
    const pageNums = [];
    for (let p = pageFrom; p <= pageTo; p++) pageNums.push(p);

    const stepLabels = [
        [1, 'Identity'],
        [2, 'Role'],
        [3, 'Access'],
        [4, 'Confirmation']
    ];

    return (
        <div ref={rootRef}>
            <header className="um-header">
                <h1>
                    Manage Users{' '}
                    <span className="um-count-pill" id="um-total-pill">
                        {`${users.length} registered users`}
                    </span>
                </h1>
            </header>

            <nav className="reports-tabs um-tabs" aria-label="User management">
                <button
                    type="button"
                    className={`reports-tab-btn um-tab-btn${
                        activeTab === 'um-panel-register' ? ' active' : ''
                    }`}
                    data-um-panel="um-panel-register"
                    onClick={() => {
                        setActiveTab('um-panel-register');
                        if (
                            window.SPP &&
                            window.SPP.panels &&
                            window.SPP.panels.resetScroll
                        ) {
                            window.SPP.panels.resetScroll();
                        }
                    }}
                >
                    <i className="fa-solid fa-user-plus" aria-hidden="true"></i> Register User
                </button>
                <button
                    type="button"
                    className={`reports-tab-btn um-tab-btn${
                        activeTab === 'um-panel-list' ? ' active' : ''
                    }`}
                    data-um-panel="um-panel-list"
                    onClick={() => {
                        setActiveTab('um-panel-list');
                        if (
                            window.SPP &&
                            window.SPP.panels &&
                            window.SPP.panels.resetScroll
                        ) {
                            window.SPP.panels.resetScroll();
                        }
                    }}
                >
                    <i className="fa-solid fa-list" aria-hidden="true"></i> List Users
                </button>
            </nav>

            {/* ============ TAB 1: STEP-BY-STEP REGISTRATION ============ */}
            <div
                id="um-panel-register"
                className="um-panel"
                style={{ display: activeTab === 'um-panel-register' ? '' : 'none' }}
            >
                <div className="um-wizard-layout" data-step={String(currentStep)}>
                    <div className="um-wizard-main">
                        <header className="um-header">
                            <h2 id="um-form-title">
                                {editingId ? 'Edit user' : 'Register new user'}
                            </h2>
                            <p id="um-form-desc">
                                {editingId
                                    ? `Review the four steps and save the changes of ${fullName(
                                          previewData
                                      )}.`
                                    : 'Complete the four steps to register the user in the institutional software.'}
                            </p>
                        </header>

                        <ol className="um-steps">
                            {stepLabels.map(([num, label], idx) => (
                                <React.Fragment key={num}>
                                    <li
                                        className={`um-step-item${
                                            currentStep === num ? ' is-current' : ''
                                        }${currentStep > num ? ' is-done' : ''}`}
                                        aria-current={currentStep === num ? 'step' : 'false'}
                                        onClick={() => handleStepHeaderClick(num)}
                                    >
                                        <span className="um-step-dot">{num}</span>
                                        <span className="um-step-text">
                                            <small>Step {num}</small>
                                            <strong>{label}</strong>
                                        </span>
                                    </li>
                                    {idx < stepLabels.length - 1 ? (
                                        <li
                                            className={`um-step-bar${
                                                currentStep > num ? ' is-done' : ''
                                            }`}
                                            aria-hidden="true"
                                        ></li>
                                    ) : null}
                                </React.Fragment>
                            ))}
                        </ol>

                        <form
                            id="um-form"
                            action="#"
                            method="post"
                            noValidate
                            onSubmit={handleFormSubmit}
                        >
                            {/* STEP 1 */}
                            <div
                                className={`cp-card um-step-panel${
                                    currentStep === 1 ? ' is-active' : ''
                                }`}
                                data-step="1"
                            >
                                <div className="um-step-head">
                                    <div>
                                        <h3>Personal data and identity</h3>
                                        <p>
                                            Enter the names and the document exactly as they
                                            appear in the official record.
                                        </p>
                                    </div>
                                    <span className="um-tag">Required</span>
                                </div>

                                <div className="um-grid">
                                    <div
                                        className={`um-field${
                                            errors.documentType ? ' has-error' : ''
                                        }`}
                                    >
                                        <label htmlFor="um-doc-type">Document type</label>
                                        <div className="cp-input-wrap">
                                            <select
                                                ref={docTypeSelectRef}
                                                id="um-doc-type"
                                                name="doc-type"
                                                value={documentType}
                                                onChange={(e) => {
                                                    setDocumentType(e.target.value);
                                                    if (errors.documentType) {
                                                        setErrors((prev) => ({
                                                            ...prev,
                                                            documentType: ''
                                                        }));
                                                    }
                                                }}
                                            >
                                                <option value="" disabled>
                                                    Select Document Type
                                                </option>
                                                <option value="CC">Citizenship card</option>
                                                <option value="CE">Foreigner ID card</option>
                                                <option value="PAS">Passport</option>
                                            </select>
                                            <i
                                                className="fa-solid fa-chevron-down right-icon"
                                                aria-hidden="true"
                                            ></i>
                                        </div>
                                        <span className="um-error">
                                            {errors.documentType || ''}
                                        </span>
                                    </div>

                                    <div
                                        className={`um-field${
                                            errors.documentNumber ? ' has-error' : ''
                                        }`}
                                    >
                                        <label htmlFor="um-doc-number">Document number</label>
                                        <div className="um-control um-control--mono">
                                            <i
                                                className="fa-solid fa-hashtag"
                                                aria-hidden="true"
                                            ></i>
                                            <input
                                                id="um-doc-number"
                                                name="doc-number"
                                                type="text"
                                                inputMode="numeric"
                                                autoComplete="off"
                                                placeholder="1098234871"
                                                value={documentNumber}
                                                onChange={(e) => {
                                                    const cleaned = e.target.value.replace(
                                                        /\D/g,
                                                        ''
                                                    );
                                                    setDocumentNumber(cleaned);
                                                    if (errors.documentNumber) {
                                                        setErrors((prev) => ({
                                                            ...prev,
                                                            documentNumber: ''
                                                        }));
                                                    }
                                                }}
                                            />
                                        </div>
                                        <span className="um-error">
                                            {errors.documentNumber || ''}
                                        </span>
                                    </div>

                                    <div
                                        className={`um-field${
                                            errors.firstName ? ' has-error' : ''
                                        }`}
                                    >
                                        <label htmlFor="um-names">First names</label>
                                        <div className="um-control">
                                            <i
                                                className="fa-solid fa-user"
                                                aria-hidden="true"
                                            ></i>
                                            <input
                                                id="um-names"
                                                name="names"
                                                type="text"
                                                autoComplete="given-name"
                                                placeholder="Mariana Sofía"
                                                value={firstName}
                                                onChange={(e) => {
                                                    setFirstName(e.target.value);
                                                    if (errors.firstName) {
                                                        setErrors((prev) => ({
                                                            ...prev,
                                                            firstName: ''
                                                        }));
                                                    }
                                                }}
                                            />
                                        </div>
                                        <span className="um-error">{errors.firstName || ''}</span>
                                    </div>

                                    <div
                                        className={`um-field${
                                            errors.lastName ? ' has-error' : ''
                                        }`}
                                    >
                                        <label htmlFor="um-surnames">Last names</label>
                                        <div className="um-control">
                                            <i
                                                className="fa-solid fa-users"
                                                aria-hidden="true"
                                            ></i>
                                            <input
                                                id="um-surnames"
                                                name="surnames"
                                                type="text"
                                                autoComplete="family-name"
                                                placeholder="Cárdenas Mendoza"
                                                value={lastName}
                                                onChange={(e) => {
                                                    setLastName(e.target.value);
                                                    if (errors.lastName) {
                                                        setErrors((prev) => ({
                                                            ...prev,
                                                            lastName: ''
                                                        }));
                                                    }
                                                }}
                                            />
                                        </div>
                                        <span className="um-error">{errors.lastName || ''}</span>
                                    </div>
                                </div>
                            </div>

                            {/* STEP 2 */}
                            <div
                                className={`cp-card um-step-panel${
                                    currentStep === 2 ? ' is-active' : ''
                                }`}
                                data-step="2"
                            >
                                <div className="um-step-head">
                                    <div>
                                        <h3>Institutional role and affiliation</h3>
                                        <p>
                                            The role defines which panel the person sees when
                                            entering the portal.
                                        </p>
                                    </div>
                                    <span className="um-tag">Permissions</span>
                                </div>

                                <div className="um-field">
                                    <label>Assigned role</label>
                                    <div className="um-roles">
                                        <label className="um-role">
                                            <input
                                                type="radio"
                                                name="um-role"
                                                value="student"
                                                checked={role === 'student'}
                                                onChange={() => setRole('student')}
                                            />
                                            <span className="um-role-box">
                                                <i
                                                    className="fa-solid fa-graduation-cap"
                                                    aria-hidden="true"
                                                ></i>
                                                <span>
                                                    <strong>Student</strong>
                                                    <span>
                                                        Records evidence and answers the
                                                        logbook.
                                                    </span>
                                                </span>
                                            </span>
                                        </label>
                                        <label className="um-role">
                                            <input
                                                type="radio"
                                                name="um-role"
                                                value="tutor"
                                                checked={role === 'tutor'}
                                                onChange={() => setRole('tutor')}
                                            />
                                            <span className="um-role-box">
                                                <i
                                                    className="fa-solid fa-user"
                                                    aria-hidden="true"
                                                ></i>
                                                <span>
                                                    <strong>Academic Tutor</strong>
                                                    <span>
                                                        Reviews activities and leaves feedback.
                                                    </span>
                                                </span>
                                            </span>
                                        </label>
                                        <label className="um-role">
                                            <input
                                                type="radio"
                                                name="um-role"
                                                value="advisor"
                                                checked={role === 'advisor'}
                                                onChange={() => {
                                                    setRole('advisor');
                                                    setProgram('');
                                                }}
                                            />
                                            <span className="um-role-box">
                                                <i
                                                    className="fa-solid fa-user-group"
                                                    aria-hidden="true"
                                                ></i>
                                                <span>
                                                    <strong>Pedagogical Advisor</strong>
                                                    <span>
                                                        Accompanies the practice at the
                                                        institution.
                                                    </span>
                                                </span>
                                            </span>
                                        </label>
                                    </div>
                                </div>

                                <div className="um-grid">
                                    <div
                                        className={`um-field${
                                            errors.program ? ' has-error' : ''
                                        }`}
                                    >
                                        <label htmlFor="um-program" id="um-program-label">
                                            Academic program
                                        </label>
                                        <div className="cp-input-wrap">
                                            <select
                                                ref={programSelectRef}
                                                id="um-program"
                                                name="program"
                                                value={program}
                                                disabled={role === 'advisor'}
                                                onChange={(e) => {
                                                    setProgram(e.target.value);
                                                    if (errors.program) {
                                                        setErrors((prev) => ({
                                                            ...prev,
                                                            program: ''
                                                        }));
                                                    }
                                                }}
                                            >
                                                <option value="" disabled>
                                                    Select a program
                                                </option>
                                                {programs.map((prog) => (
                                                    <option
                                                        key={prog.name}
                                                        value={prog.name}
                                                        data-faculty={prog.faculty || ''}
                                                    >
                                                        {prog.name}
                                                    </option>
                                                ))}
                                            </select>
                                            <i
                                                className="fa-solid fa-chevron-down right-icon"
                                                aria-hidden="true"
                                            ></i>
                                        </div>
                                        <span className="um-error">{errors.program || ''}</span>
                                    </div>

                                    <div className="um-field">
                                        <label htmlFor="um-faculty">Faculty or department</label>
                                        <div className="um-control um-control--locked">
                                            <i
                                                className="fa-solid fa-building-columns"
                                                aria-hidden="true"
                                            ></i>
                                            <input
                                                id="um-faculty"
                                                name="faculty"
                                                type="text"
                                                readOnly
                                                placeholder="Filled in automatically"
                                                value={faculty}
                                            />
                                        </div>
                                        <span className="um-hint">
                                            <i
                                                className="fa-solid fa-wand-magic-sparkles"
                                                aria-hidden="true"
                                            ></i>{' '}
                                            Filled in according to the chosen program.
                                        </span>
                                    </div>
                                </div>

                                <div className="um-status-row">
                                    <div className="um-status-copy">
                                        <strong>Account status</strong>
                                    </div>
                                    <div
                                        className="um-switch"
                                        role="group"
                                        aria-label="Account status"
                                    >
                                        <button
                                            type="button"
                                            data-status="active"
                                            className={accountStatus === 'active' ? 'is-on' : ''}
                                            onClick={() => setAccountStatus('active')}
                                        >
                                            Active
                                        </button>
                                        <button
                                            type="button"
                                            data-status="inactive"
                                            className={
                                                accountStatus === 'inactive' ? 'is-on' : ''
                                            }
                                            onClick={() => setAccountStatus('inactive')}
                                        >
                                            Inactive
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* STEP 3 */}
                            <div
                                className={`cp-card um-step-panel${
                                    currentStep === 3 ? ' is-active' : ''
                                }`}
                                data-step="3"
                            >
                                <div className="um-step-head">
                                    <div>
                                        <h3>Access credentials</h3>
                                        <p>
                                            With these details the person signs in to the portal
                                            for the first time.
                                        </p>
                                    </div>
                                    <span className="um-tag">Security</span>
                                </div>

                                <div
                                    className={`um-field${
                                        errors.emailUser ? ' has-error' : ''
                                    }`}
                                >
                                    <label htmlFor="um-email">Institutional e-mail</label>
                                    <div className="um-control">
                                        <i className="fa-solid fa-at" aria-hidden="true"></i>
                                        <input
                                            id="um-email"
                                            name="email"
                                            type="text"
                                            autoComplete="off"
                                            placeholder="first.lastname"
                                            value={emailUser}
                                            onChange={(e) => {
                                                emailEditedRef.current = true;
                                                setEmailUser(e.target.value);
                                                if (errors.emailUser) {
                                                    setErrors((prev) => ({
                                                        ...prev,
                                                        emailUser: ''
                                                    }));
                                                }
                                            }}
                                        />
                                        <span className="um-suffix">{domain}</span>
                                    </div>
                                    <span className="um-error">{errors.emailUser || ''}</span>
                                    <span className="um-hint">
                                        <i
                                            className="fa-solid fa-circle-check"
                                            aria-hidden="true"
                                        ></i>{' '}
                                        We suggest it from the name, but you can change it.
                                    </span>
                                </div>

                                <div
                                    className={`um-field${errors.password ? ' has-error' : ''}`}
                                >
                                    <label htmlFor="um-pass">Password</label>
                                    <div className="um-control um-control--mono">
                                        <i className="fa-solid fa-key" aria-hidden="true"></i>
                                        <input
                                            id="um-pass"
                                            name="pass"
                                            type={showPassInput ? 'text' : 'password'}
                                            autoComplete="new-password"
                                            placeholder={
                                                editingId
                                                    ? 'Leave empty to keep the current one'
                                                    : ''
                                            }
                                            value={password}
                                            onChange={(e) => {
                                                setPassword(e.target.value);
                                                if (errors.password) {
                                                    setErrors((prev) => ({
                                                        ...prev,
                                                        password: ''
                                                    }));
                                                }
                                            }}
                                        />
                                        <button
                                            type="button"
                                            className="um-icon-btn"
                                            id="um-pass-toggle"
                                            aria-label="Show password"
                                            onClick={() => setShowPassInput((prev) => !prev)}
                                        >
                                            <i
                                                className={`fa-regular ${
                                                    showPassInput ? 'fa-eye' : 'fa-eye-slash'
                                                }`}
                                                aria-hidden="true"
                                            ></i>
                                        </button>
                                    </div>
                                    <span className="um-error">{errors.password || ''}</span>
                                    <button
                                        type="button"
                                        className="um-ghost-btn"
                                        id="um-pass-generate"
                                        style={{ alignSelf: 'flex-start', marginTop: '4px' }}
                                        onClick={generatePassword}
                                    >
                                        <i className="fa-solid fa-dice" aria-hidden="true"></i>{' '}
                                        Generate a secure one
                                    </button>
                                </div>
                            </div>

                            {/* STEP 4 */}
                            <div
                                className={`cp-card um-step-panel${
                                    currentStep === 4 ? ' is-active' : ''
                                }`}
                                data-step="4"
                            >
                                <div className="um-step-head">
                                    <div>
                                        <h3>Review before saving</h3>
                                        <p>
                                            This is how the user's credential will look inside
                                            the portal.
                                        </p>
                                    </div>
                                    <span className="um-tag">Last step</span>
                                </div>

                                <dl className="um-summary" id="um-summary">
                                    <div>
                                        <dt>Full name</dt>
                                        <dd>{fullName(previewData) || '—'}</dd>
                                    </div>
                                    <div>
                                        <dt>Document</dt>
                                        <dd>
                                            {`${previewData.documentType} ${previewData.documentNumber}`.trim() ||
                                                '—'}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt>Institutional role</dt>
                                        <dd>
                                            {(ROLES[previewData.role] &&
                                                ROLES[previewData.role].name) ||
                                                '—'}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt>Program</dt>
                                        <dd>{previewData.program || '—'}</dd>
                                    </div>
                                    <div>
                                        <dt>Faculty</dt>
                                        <dd>{faculty || '—'}</dd>
                                    </div>
                                    <div>
                                        <dt>Institutional e-mail</dt>
                                        <dd>{previewData.email || '—'}</dd>
                                    </div>
                                    <div>
                                        <dt>Initial status</dt>
                                        <dd>{STATUS_LABELS[previewData.status] || '—'}</dd>
                                    </div>
                                </dl>
                            </div>

                            <div className="um-wizard-actions">
                                <span className="um-progress-text" id="um-progress-text">
                                    {`Step ${currentStep} of 4`}
                                </span>
                                <button
                                    type="button"
                                    className="cp-btn cp-btn-cancel"
                                    id="um-btn-reset"
                                    onClick={clearForm}
                                >
                                    Clear
                                </button>
                                {currentStep > 1 ? (
                                    <button
                                        type="button"
                                        className="cp-btn cp-btn-cancel"
                                        id="um-btn-prev"
                                        onClick={() => goToStep(currentStep - 1)}
                                    >
                                        Previous
                                    </button>
                                ) : null}
                                {currentStep < 4 ? (
                                    <button
                                        type="button"
                                        className="cp-btn cp-btn-save"
                                        id="um-btn-next"
                                        onClick={handleNextStep}
                                    >
                                        Next
                                    </button>
                                ) : (
                                    <button
                                        type="submit"
                                        className="cp-btn cp-btn-save"
                                        id="um-btn-submit"
                                        disabled={submitting}
                                    >
                                        <i
                                            className={`fa-solid ${
                                                editingId ? 'fa-floppy-disk' : 'fa-user-check'
                                            }`}
                                            aria-hidden="true"
                                        ></i>{' '}
                                        {editingId ? 'Save changes' : 'Register'}
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>

                    {/* Live credential */}
                    <aside className="um-preview" aria-label="Credential preview">
                        <div id="um-preview-card">
                            <CredentialCard user={previewData} domain={domain} />
                        </div>
                        <div className="um-checklist">
                            <h4>
                                <i className="fa-solid fa-circle-info" aria-hidden="true"></i>{' '}
                                How to use this card
                            </h4>
                            <ul>
                                <li className="is-ok">
                                    <i
                                        className="fa-solid fa-circle-check"
                                        aria-hidden="true"
                                    ></i>
                                    <span>It updates as you type in the form.</span>
                                </li>
                                <li className="is-ok">
                                    <i
                                        className="fa-solid fa-circle-check"
                                        aria-hidden="true"
                                    ></i>
                                    <span>
                                        From "View logbook" you jump to the user's practice.
                                    </span>
                                </li>
                                <li className="is-ok">
                                    <i
                                        className="fa-solid fa-circle-check"
                                        aria-hidden="true"
                                    ></i>
                                    <span>
                                        The eye shows the temporary password so you can read it
                                        out.
                                    </span>
                                </li>
                            </ul>
                        </div>
                    </aside>
                </div>
            </div>

            {/* ============ TAB 2: LIST ============ */}
            <div
                id="um-panel-list"
                className="um-panel"
                style={{ display: activeTab === 'um-panel-list' ? '' : 'none' }}
            >
                <div className="stats-grid">
                    <article className="stat-card">
                        <div className="stat-icon">
                            <i className="fa-solid fa-graduation-cap"></i>
                        </div>
                        <div className="stat-info">
                            <span className="stat-value" id="um-kpi-students">
                                {kpiStudents}
                            </span>
                            <span className="stat-label">Students</span>
                        </div>
                    </article>
                    <article className="stat-card">
                        <div className="stat-icon">
                            <i className="fa-solid fa-user"></i>
                        </div>
                        <div className="stat-info">
                            <span className="stat-value" id="um-kpi-tutors">
                                {kpiTutors}
                            </span>
                            <span className="stat-label">Academic tutors</span>
                        </div>
                    </article>
                    <article className="stat-card">
                        <div className="stat-icon">
                            <i className="fa-solid fa-user-group"></i>
                        </div>
                        <div className="stat-info">
                            <span className="stat-value" id="um-kpi-advisors">
                                {kpiAdvisors}
                            </span>
                            <span className="stat-label">Pedagogical advisors</span>
                        </div>
                    </article>
                    <article className="stat-card">
                        <div className="stat-icon">
                            <i className="fa-solid fa-triangle-exclamation"></i>
                        </div>
                        <div className="stat-info">
                            <span className="stat-value" id="um-kpi-pending">
                                {kpiPending}
                            </span>
                            <span className="stat-label">Without active access</span>
                        </div>
                    </article>
                </div>

                <div className="um-toolbar">
                    <div className="um-search">
                        <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
                        <label className="sr-only" htmlFor="um-search">
                            Search user
                        </label>
                        <input
                            id="um-search"
                            type="search"
                            placeholder="Search by name, document or e-mail"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setPage(1);
                            }}
                        />
                    </div>

                    <div className="cp-input-wrap um-filter-wrap">
                        <label className="sr-only" htmlFor="um-filter-role">
                            Filter by role
                        </label>
                        <select
                            ref={roleFilterSelectRef}
                            id="um-filter-role"
                            value={roleFilter}
                            onChange={(e) => {
                                setRoleFilter(e.target.value);
                                setPage(1);
                            }}
                        >
                            <option value="">All</option>
                            <option value="student">Students</option>
                            <option value="tutor">Academic tutors</option>
                            <option value="advisor">Pedagogical advisors</option>
                        </select>
                        <i className="fa-solid fa-chevron-down right-icon" aria-hidden="true"></i>
                    </div>

                    <div className="cp-input-wrap um-filter-wrap">
                        <label className="sr-only" htmlFor="um-filter-status">
                            Filter by status
                        </label>
                        <select
                            ref={statusFilterSelectRef}
                            id="um-filter-status"
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value);
                                setPage(1);
                            }}
                        >
                            <option value="">All</option>
                            <option value="active">Active</option>
                            <option value="pending">Pending</option>
                            <option value="inactive">Inactive</option>
                        </select>
                        <i className="fa-solid fa-chevron-down right-icon" aria-hidden="true"></i>
                    </div>

                    <button
                        type="button"
                        className="um-ghost-btn"
                        id="um-btn-clear"
                        onClick={() => {
                            setSearchQuery('');
                            setRoleFilter('');
                            setStatusFilter('');
                            setPage(1);
                        }}
                    >
                        <i className="fa-solid fa-rotate-left" aria-hidden="true"></i> Clear
                    </button>
                </div>

                <div className="um-bulk" id="um-bulk" hidden={selectedIds.size === 0}>
                    <p className="um-bulk-info">
                        <i className="fa-solid fa-circle-check" aria-hidden="true"></i>{' '}
                        <span id="um-selected-count">{selectedIds.size}</span> users selected
                    </p>
                    <div className="um-bulk-actions">
                        <button
                            type="button"
                            data-bulk="activate"
                            onClick={() => handleBulkAction('activate')}
                        >
                            <i className="fa-solid fa-unlock" aria-hidden="true"></i> Activate
                        </button>
                        <button
                            type="button"
                            data-bulk="suspend"
                            onClick={() => handleBulkAction('suspend')}
                        >
                            <i className="fa-solid fa-ban" aria-hidden="true"></i> Suspend
                        </button>
                        <button
                            type="button"
                            data-bulk="delete"
                            onClick={() => handleBulkAction('delete')}
                        >
                            <i className="fa-solid fa-trash" aria-hidden="true"></i> Delete
                        </button>
                        <button
                            type="button"
                            data-bulk="cancel"
                            aria-label="Cancel selection"
                            onClick={() => handleBulkAction('cancel')}
                        >
                            <i className="fa-solid fa-xmark" aria-hidden="true"></i>
                        </button>
                    </div>
                </div>

                <div className="um-table-panel">
                    <div className="um-table-scroll">
                        <table className="um-table" aria-label="User list">
                            <thead>
                                <tr>
                                    <th scope="col" className="um-col-check">
                                        <label className="sr-only" htmlFor="um-select-all">
                                            Select all
                                        </label>
                                        <input
                                            ref={selectAllRef}
                                            type="checkbox"
                                            id="um-select-all"
                                            onChange={(e) =>
                                                toggleSelectAllVisible(e.target.checked)
                                            }
                                        />
                                    </th>
                                    <th scope="col">User</th>
                                    <th scope="col">Document</th>
                                    <th scope="col">Institutional role</th>
                                    <th scope="col">Program</th>
                                    <th scope="col">Status</th>
                                    <th scope="col" className="um-col-actions">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody id="um-tbody">
                                {visibleUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan={7}>
                                            <div className="um-empty">
                                                <i
                                                    className="fa-solid fa-user-slash"
                                                    aria-hidden="true"
                                                ></i>
                                                <strong>No user matches the search</strong>
                                                <span>
                                                    Change the filters or register a new user
                                                    from the first tab.
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    visibleUsers.map((u) => {
                                        const rObj = ROLES[u.role] || ROLES.student;
                                        return (
                                            <tr key={u.id} data-id={u.id}>
                                                <td className="um-col-check">
                                                    <input
                                                        type="checkbox"
                                                        className="um-check-row"
                                                        data-id={u.id}
                                                        aria-label={`Select ${fullName(u)}`}
                                                        checked={selectedIds.has(u.id)}
                                                        onChange={(e) =>
                                                            toggleRowSelection(
                                                                u.id,
                                                                e.target.checked
                                                            )
                                                        }
                                                    />
                                                </td>
                                                <td>
                                                    <div className="um-user-cell">
                                                        <span
                                                            className="um-avatar"
                                                            aria-hidden="true"
                                                        >
                                                            {initials(u)}
                                                        </span>
                                                        <div>
                                                            <strong>{fullName(u)}</strong>
                                                            <small>{u.email}</small>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="um-doc">{`${
                                                    u.documentType || '-'
                                                } ${u.documentNumber}`}</td>
                                                <td>
                                                    <span className={`um-pill ${rObj.cssClass}`}>
                                                        <i
                                                            className={`fa-solid ${rObj.icon}`}
                                                            aria-hidden="true"
                                                        ></i>
                                                        {rObj.name}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="um-dep">
                                                        <strong>
                                                            {u.program || 'Unassigned'}
                                                        </strong>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span
                                                        className={`um-state um-state--${u.status}`}
                                                    >
                                                        {STATUS_LABELS[u.status] || 'Active'}
                                                    </span>
                                                </td>
                                                <td className="um-col-actions">
                                                    {renderRowActions(u)}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="um-cards" id="um-cards">
                        {visibleUsers.length === 0 ? (
                            <div className="um-empty">
                                <i className="fa-solid fa-user-slash" aria-hidden="true"></i>
                                <strong>No user matches the search</strong>
                                <span>
                                    Change the filters or register a new user from the first
                                    tab.
                                </span>
                            </div>
                        ) : (
                            visibleUsers.map((u) => {
                                const rObj = ROLES[u.role] || ROLES.student;
                                return (
                                    <article
                                        key={u.id}
                                        className="um-user-card"
                                        data-id={u.id}
                                    >
                                        <div className="um-user-card-top">
                                            <input
                                                type="checkbox"
                                                className="um-check-row"
                                                data-id={u.id}
                                                aria-label={`Select ${fullName(u)}`}
                                                checked={selectedIds.has(u.id)}
                                                onChange={(e) =>
                                                    toggleRowSelection(u.id, e.target.checked)
                                                }
                                            />
                                            <div className="um-user-cell">
                                                <span className="um-avatar" aria-hidden="true">
                                                    {initials(u)}
                                                </span>
                                                <div>
                                                    <strong>{fullName(u)}</strong>
                                                    <small>{u.email}</small>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="um-user-card-meta">
                                            <span className={`um-pill ${rObj.cssClass}`}>
                                                <i
                                                    className={`fa-solid ${rObj.icon}`}
                                                    aria-hidden="true"
                                                ></i>
                                                {rObj.name}
                                            </span>
                                            <span className={`um-state um-state--${u.status}`}>
                                                {STATUS_LABELS[u.status] || 'Active'}
                                            </span>
                                        </div>
                                        <dl>
                                            <div>
                                                <dt>Document:</dt>
                                                <dd>{`${u.documentType || '-'} ${
                                                    u.documentNumber
                                                }`}</dd>
                                            </div>
                                            <div>
                                                <dt>Program:</dt>
                                                <dd>{u.program || 'Unassigned'}</dd>
                                            </div>
                                        </dl>
                                        {renderRowActions(u)}
                                    </article>
                                );
                            })
                        )}
                    </div>

                    <div className="um-pagination">
                        <div className="um-pagination-info">
                            <span id="um-range">
                                {filteredList.length === 0 ? (
                                    'No results'
                                ) : (
                                    <>
                                        Showing{' '}
                                        <b>{`${startIdx + 1}–${
                                            startIdx + visibleUsers.length
                                        }`}</b>{' '}
                                        of <b>{filteredList.length}</b> users
                                    </>
                                )}
                            </span>
                            <span className="um-rows">
                                <label htmlFor="um-rows">Rows:</label>
                                <select
                                    ref={rowsSelectRef}
                                    id="um-rows"
                                    value={String(rowsPerPage)}
                                    onChange={(e) => {
                                        setRowsPerPage(Number(e.target.value) || 10);
                                        setPage(1);
                                    }}
                                >
                                    <option value="5">5</option>
                                    <option value="10">10</option>
                                    <option value="25">25</option>
                                    <option value="50">50</option>
                                </select>
                            </span>
                        </div>
                        <div className="um-pages" id="um-pages">
                            <button
                                type="button"
                                data-page="prev"
                                aria-label="Previous page"
                                disabled={safePage === 1}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                            >
                                <i
                                    className="fa-solid fa-chevron-left"
                                    aria-hidden="true"
                                ></i>
                            </button>
                            {pageNums.map((p) => (
                                <button
                                    key={p}
                                    type="button"
                                    data-page={p}
                                    className={p === safePage ? 'is-current' : ''}
                                    aria-current={p === safePage ? 'page' : undefined}
                                    onClick={() => setPage(p)}
                                >
                                    {p}
                                </button>
                            ))}
                            <button
                                type="button"
                                data-page="next"
                                aria-label="Next page"
                                disabled={safePage === totalPages}
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            >
                                <i
                                    className="fa-solid fa-chevron-right"
                                    aria-hidden="true"
                                ></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {modalBodyEl && modalUser
                ? createPortal(
                      <CredentialCard
                          user={modalUser}
                          domain={domain}
                          activePracticeId={modalPracticeId}
                          onOpenLogbook={(practiceId) => {
                              closeModals();
                              window.dispatchEvent(
                                  new CustomEvent('spp:open-practice', {
                                      detail: { id: practiceId }
                                  })
                              );
                              const link = document.querySelector(
                                  '.app-nav-link[href="#practice"]'
                              );
                              if (link) link.click();
                          }}
                          onApprove={(u) => handleApproveUser(u, true)}
                          onReject={(u) => handleRejectUser(u, true)}
                      />,
                      modalBodyEl
                  )
                : null}
        </div>
    );
}
