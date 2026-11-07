import React, { useEffect, useState, useRef, useCallback } from 'react';
import CustomDateTimePicker from '../common/CustomDateTimePicker';
import { get, post, put, showError } from '../../core/api';
import { alert as alertModal } from '../../core/modals';
import { resetScroll } from '../../core/panels';
import { activateNav, onNavClick } from '../../core/shell';
import { useCustomSelect } from '../../hooks/useCustomSelect';
import { EVENTS, emit, on } from '../../core/events';
import { inject } from '../../core/registry';

export default function CreatePracticeApp() {
    const [practiceTypes, setPracticeTypes] = useState([]);
    const [institutions, setInstitutions] = useState([]);
    const [activeUsers, setActiveUsers] = useState([]);
    const [allPractices, setAllPractices] = useState([]);

    const [editingId, setEditingId] = useState(null);
    const [typeId, setTypeId] = useState('');
    const [institutionId, setInstitutionId] = useState('');
    const [studentDoc, setStudentDoc] = useState('');
    const [tutorDoc, setTutorDoc] = useState('');
    const [advisorDoc, setAdvisorDoc] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);

    const rootRef = useRef(null);
    const typeSelectRef = useRef(null);
    const instSelectRef = useRef(null);
    const studentSelectRef = useRef(null);
    const tutorSelectRef = useRef(null);
    const advisorSelectRef = useRef(null);
    const isNavigatingToEditRef = useRef(false);

    const loadOptions = useCallback(async () => {
        try {
            const [typesRes, instRes, usersRes, pracRes] = await Promise.all([
                get('/api/practice-types'),
                get('/api/institutions'),
                get('/api/users?status=active'),
                get('/api/practices')
            ]);
            setPracticeTypes(typesRes.practiceTypes || []);
            setInstitutions(instRes.institutions || []);
            const users = (usersRes.users || []).filter((u) => u.status === 'active' || !u.status);
            setActiveUsers(users);
            setAllPractices(pracRes.practices || []);
        } catch (err) {
            showError(err);
        }
    }, []);

    const resetForm = useCallback(() => {
        setEditingId(null);
        setTypeId('');
        setInstitutionId('');
        setStudentDoc('');
        setTutorDoc('');
        setAdvisorDoc('');
        setStartDate('');
        setEndDate('');
        setErrors({});
        loadOptions();
    }, [loadOptions]);

    // Sync customSelect whenever options, values, or editingId change
    useCustomSelect(
        [
            rootRef,
            typeSelectRef,
            instSelectRef,
            studentSelectRef,
            tutorSelectRef,
            advisorSelectRef
        ],
        [
            practiceTypes,
            institutions,
            activeUsers,
            allPractices,
            editingId,
            typeId,
            institutionId,
            studentDoc,
            tutorDoc,
            advisorDoc
        ]
    );

    useEffect(() => {
        loadOptions();

        const handleDataChanged = () => {
            loadOptions();
        };

        const handleEditPractice = async (e) => {
            const practice = e.detail && e.detail.practice;
            if (!practice) return;
            await loadOptions();
            setEditingId(practice.id);
            setTypeId(String(practice.typeId || ''));
            setInstitutionId(String(practice.institutionId || ''));
            setStudentDoc(String(practice.studentDocument || ''));
            setTutorDoc(String(practice.tutorDocument || ''));
            setAdvisorDoc(String(practice.advisorDocument || ''));
            setStartDate(practice.startDate ? String(practice.startDate).split('T')[0] : '');
            setEndDate(practice.endDate ? String(practice.endDate).split('T')[0] : '');
            setErrors({});

            isNavigatingToEditRef.current = true;
            activateNav('#create-practice');
            isNavigatingToEditRef.current = false;
            resetScroll();
        };

        const handleNavClick = () => {
            if (!isNavigatingToEditRef.current) {
                resetForm();
            }
        };

        const unsubData = on(EVENTS.DATA_CHANGED, handleDataChanged);
        const unsubEdit = on(EVENTS.EDIT_PRACTICE, (detail) => handleEditPractice({ detail }));
        const unsubNav = onNavClick('#create-practice', handleNavClick);

        return () => {
            unsubData();
            unsubEdit();
            unsubNav();
        };
    }, [loadOptions, resetForm]);

    const validStudents = activeUsers.filter((u) => {
        if (u.role !== 'student') return false;
        const studentPractices = allPractices.filter(
            (p) => String(p.studentDocument) === String(u.documentNumber)
        );
        return (
            studentPractices.length === 0 ||
            studentPractices.every(
                (p) =>
                    p.status === 'completed' ||
                    p.status === 'finalizada' ||
                    p.status === 'cancelled' ||
                    p.status === 'cancelada' ||
                    String(p.id) === String(editingId)
            )
        );
    });

    const tutors = activeUsers.filter((u) => u.role === 'tutor');
    const advisors = activeUsers.filter((u) => u.role === 'advisor');

    const handleSave = async () => {
        const nextErrors = {};
        if (!typeId) nextErrors.typeId = 'Select a practice type';
        if (!institutionId) nextErrors.institutionId = 'Select an institution';
        if (!studentDoc) nextErrors.studentDoc = 'Select a student';
        if (!tutorDoc) nextErrors.tutorDoc = 'Select a tutor';
        if (!advisorDoc) nextErrors.advisorDoc = 'Select an advisor';

        if (!startDate) {
            nextErrors.startDate = 'Select a start date';
        } else {
            const startYear = parseInt(String(startDate).split('-')[0], 10);
            if (isNaN(startYear) || startYear < 2000 || startYear > 2100) {
                nextErrors.startDate = 'Please select a valid start date';
            }
        }

        if (!endDate) {
            nextErrors.endDate = 'Select an end date';
        } else {
            const endYear = parseInt(String(endDate).split('-')[0], 10);
            if (isNaN(endYear) || endYear < 2000 || endYear > 2100) {
                nextErrors.endDate = 'Please select a valid end date';
            } else if (startDate && endDate < startDate) {
                nextErrors.endDate = 'The end date cannot be earlier than the start date';
            }
        }

        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) return;

        setSaving(true);
        try {
            const payload = {
                typeId,
                institutionId,
                studentDocument: studentDoc,
                tutorDocument: tutorDoc,
                advisorDocument: advisorDoc,
                startDate,
                endDate
            };
            const isEdit = Boolean(editingId);
            let savedId = editingId;
            if (isEdit) {
                await put(`/api/practices/${editingId}`, payload);
            } else {
                const created = await post('/api/practices', payload);
                savedId = created && created.practice ? created.practice.id : null;
            }

            if (isEdit) {
                emit(EVENTS.PRACTICES_CHANGED, { id: savedId });
            } else {
                emit(EVENTS.PRACTICES_CHANGED);
            }
            emit(EVENTS.DATA_CHANGED);
            emit(EVENTS.HOME_REFRESH);
            inject('reports')?.reload?.();

            const title = isEdit ? 'Practice updated' : 'Practice created';
            const msg = isEdit
                ? 'The practice was updated successfully and already appears in the list.'
                : 'The practice was registered successfully and already appears in the list.';
            await alertModal({ title, message: msg });

            resetForm();
            if (isEdit && savedId) {
                activateNav('#practice');
                resetScroll();
            }
        } catch (err) {
            showError(err);
        } finally {
            setSaving(false);
        }
    };

    const isEditing = Boolean(editingId);

    return (
        <div ref={rootRef}>
            <h2 className="cp-main-title">
                {isEditing ? 'Edit Practice' : 'Practice Management'}
            </h2>

            <div className="cp-layout">
                {/* Left column */}
                <div className="cp-card">
                    <div className={`cp-field${errors.typeId ? ' has-error' : ''}`}>
                        <label>Practice Type</label>
                        <div className={`cp-input-wrap${isEditing ? ' is-disabled' : ''}`}>
                            <select
                                ref={typeSelectRef}
                                value={typeId}
                                disabled={isEditing}
                                onChange={(e) => {
                                    setTypeId(e.target.value);
                                    if (errors.typeId) {
                                        setErrors((prev) => ({ ...prev, typeId: '' }));
                                    }
                                }}
                            >
                                <option value="" disabled>
                                    Select Practice Type
                                </option>
                                {practiceTypes.map((pt) => (
                                    <option key={pt.id} value={pt.id}>
                                        {pt.name}
                                    </option>
                                ))}
                            </select>
                            <i className="fa-solid fa-chevron-down right-icon"></i>
                        </div>
                        {errors.typeId ? <span className="cp-error">{errors.typeId}</span> : null}
                    </div>

                    <div className={`cp-field${errors.institutionId ? ' has-error' : ''}`}>
                        <label>Entity / Institution</label>
                        <div className={`cp-input-wrap${isEditing ? ' is-disabled' : ''}`}>
                            <select
                                ref={instSelectRef}
                                value={institutionId}
                                disabled={isEditing}
                                onChange={(e) => {
                                    setInstitutionId(e.target.value);
                                    if (errors.institutionId) {
                                        setErrors((prev) => ({ ...prev, institutionId: '' }));
                                    }
                                }}
                            >
                                <option value="" disabled>
                                    Select the Institution
                                </option>
                                {institutions.map((inst) => (
                                    <option key={inst.id} value={inst.id}>
                                        {inst.name}
                                    </option>
                                ))}
                            </select>
                            <i className="fa-solid fa-chevron-down right-icon"></i>
                        </div>
                        {errors.institutionId ? (
                            <span className="cp-error">{errors.institutionId}</span>
                        ) : null}
                    </div>

                    <div className={`cp-field${errors.startDate ? ' has-error' : ''}`}>
                        <label>Start Date</label>
                        <div className="cp-input-wrap">
                            <div className="cdp-bridge-container" style={{ width: '100%' }}>
                                <CustomDateTimePicker
                                    type="date"
                                    value={startDate}
                                    required
                                    onChange={(e) => {
                                        setStartDate(e.target.value);
                                        if (errors.startDate) {
                                            setErrors((prev) => ({ ...prev, startDate: '' }));
                                        }
                                    }}
                                />
                            </div>
                        </div>
                        {errors.startDate ? (
                            <span className="cp-error">{errors.startDate}</span>
                        ) : null}
                    </div>

                    <div className={`cp-field${errors.endDate ? ' has-error' : ''}`}>
                        <label>End Date</label>
                        <div className="cp-input-wrap">
                            <div className="cdp-bridge-container" style={{ width: '100%' }}>
                                <CustomDateTimePicker
                                    type="date"
                                    value={endDate}
                                    required
                                    onChange={(e) => {
                                        setEndDate(e.target.value);
                                        if (errors.endDate) {
                                            setErrors((prev) => ({ ...prev, endDate: '' }));
                                        }
                                    }}
                                />
                            </div>
                        </div>
                        {errors.endDate ? <span className="cp-error">{errors.endDate}</span> : null}
                    </div>
                </div>

                {/* Right column */}
                <div className="cp-card">
                    <div className={`cp-field${errors.studentDoc ? ' has-error' : ''}`}>
                        <label>Assigned Student</label>
                        <div className={`cp-input-wrap${isEditing ? ' is-disabled' : ''}`}>
                            <select
                                ref={studentSelectRef}
                                value={studentDoc}
                                disabled={isEditing}
                                onChange={(e) => {
                                    setStudentDoc(e.target.value);
                                    if (errors.studentDoc) {
                                        setErrors((prev) => ({ ...prev, studentDoc: '' }));
                                    }
                                }}
                            >
                                <option value="" disabled>
                                    Select the Student
                                </option>
                                {validStudents.map((u) => (
                                    <option key={u.documentNumber} value={u.documentNumber}>
                                        {`${u.firstName} ${u.lastName}`}
                                    </option>
                                ))}
                            </select>
                            <i className="fa-solid fa-chevron-down right-icon"></i>
                        </div>
                        {errors.studentDoc ? (
                            <span className="cp-error">{errors.studentDoc}</span>
                        ) : null}
                    </div>

                    <div className={`cp-field${errors.tutorDoc ? ' has-error' : ''}`}>
                        <label>Assigned Tutor</label>
                        <div className="cp-input-wrap">
                            <select
                                ref={tutorSelectRef}
                                value={tutorDoc}
                                onChange={(e) => {
                                    setTutorDoc(e.target.value);
                                    if (errors.tutorDoc) {
                                        setErrors((prev) => ({ ...prev, tutorDoc: '' }));
                                    }
                                }}
                            >
                                <option value="" disabled>
                                    Select the Tutor
                                </option>
                                {tutors.map((u) => (
                                    <option key={u.documentNumber} value={u.documentNumber}>
                                        {`${u.firstName} ${u.lastName}`}
                                    </option>
                                ))}
                            </select>
                            <i className="fa-solid fa-chevron-down right-icon"></i>
                        </div>
                        {errors.tutorDoc ? (
                            <span className="cp-error">{errors.tutorDoc}</span>
                        ) : null}
                    </div>

                    <div className={`cp-field${errors.advisorDoc ? ' has-error' : ''}`}>
                        <label>Assigned Advisor</label>
                        <div className="cp-input-wrap">
                            <select
                                ref={advisorSelectRef}
                                value={advisorDoc}
                                onChange={(e) => {
                                    setAdvisorDoc(e.target.value);
                                    if (errors.advisorDoc) {
                                        setErrors((prev) => ({ ...prev, advisorDoc: '' }));
                                    }
                                }}
                            >
                                <option value="" disabled>
                                    Select the Advisor
                                </option>
                                {advisors.map((u) => (
                                    <option key={u.documentNumber} value={u.documentNumber}>
                                        {`${u.firstName} ${u.lastName}`}
                                    </option>
                                ))}
                            </select>
                            <i className="fa-solid fa-chevron-down right-icon"></i>
                        </div>
                        {errors.advisorDoc ? (
                            <span className="cp-error">{errors.advisorDoc}</span>
                        ) : null}
                    </div>
                </div>
            </div>

            <div className="cp-actions">
                <button
                    type="button"
                    className="cp-btn cp-btn-save"
                    disabled={saving}
                    onClick={handleSave}
                >
                    Save
                </button>
                <button type="button" className="cp-btn cp-btn-cancel" onClick={resetForm}>
                    Cancel
                </button>
            </div>
        </div>
    );
}
