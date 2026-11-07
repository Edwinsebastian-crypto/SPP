import React, { useState, useEffect, useRef } from 'react';
import { getConfig, request } from '../../core/api';
import { useCustomSelect } from '../../hooks/useCustomSelect';

const ROLES = {
    student: { name: 'Student', icon: 'fa-graduation-cap' },
    tutor: { name: 'Academic Tutor', icon: 'fa-user' },
    advisor: { name: 'Pedagogical Advisor', icon: 'fa-user-group' },
};

const STEPS = [
    { step: 1, title: 'Identity' },
    { step: 2, title: 'Role' },
    { step: 3, title: 'Access' },
    { step: 4, title: 'Confirmation' },
];

function stripAccents(text) {
    return String(text || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

export default function RegisterApp() {
    const [institutionalDomain, setInstitutionalDomain] = useState('udi.edu.co');

    useEffect(() => {
        getConfig()
            .then((cfg) => {
                if (cfg && cfg.institutionalDomain) {
                    setInstitutionalDomain(cfg.institutionalDomain);
                }
            })
            .catch(() => {});
    }, []);

    const domain = '@' + institutionalDomain;

    const [currentStep, setCurrentStep] = useState(1);
    const [programs, setPrograms] = useState([]);
    const [documentType, setDocumentType] = useState('');
    const [documentNumber, setDocumentNumber] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [role, setRole] = useState('student');
    const [program, setProgram] = useState('');
    const [faculty, setFaculty] = useState('');
    const [emailUser, setEmailUser] = useState('');
    const [emailEditedByHand, setEmailEditedByHand] = useState(false);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const [errors, setErrors] = useState({});
    const [errorBanner, setErrorBanner] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);

    const docTypeRef = useRef(null);
    const programRef = useRef(null);
    const docNumRef = useRef(null);
    const firstRef = useRef(null);
    const lastRef = useRef(null);
    const emailRef = useRef(null);
    const passRef = useRef(null);
    const pass2Ref = useRef(null);

    const needsProgram = role === 'student' || role === 'tutor';

    useEffect(() => {
        async function loadPrograms() {
            try {
                const res = await request('/api/auth/programs', {
                    skipRedirect: true,
                });
                const list = res.programs || [];
                setPrograms(list);
            } catch (err) {
                console.error('Could not load programs:', err);
            }
        }
        loadPrograms();
    }, []);

    useCustomSelect(
        ['#reg-wizard-container', docTypeRef, programRef],
        [programs, documentType, program, role, currentStep]
    );

    // Auto-suggest email when firstName or lastName changes
    useEffect(() => {
        if (emailEditedByHand) return;
        const first = stripAccents(firstName.trim().split(/\s+/)[0] || '');
        const last = stripAccents(lastName.trim().split(/\s+/)[0] || '');
        if (!first && !last) return;
        setEmailUser((first ? first.charAt(0) + '.' : '') + last);
    }, [firstName, lastName, emailEditedByHand]);

    const handleProgramChange = (e) => {
        const val = e.target.value;
        setProgram(val);
        const found = programs.find((p) => p.name === val);
        setFaculty(found?.faculty || '');
        setErrors((prev) => ({ ...prev, program: '' }));
    };

    const handleRoleChange = (newRole) => {
        setRole(newRole);
        if (newRole === 'advisor') {
            setProgram('');
            setFaculty('');
        }
    };

    const handleGeneratePassword = () => {
        const letters = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
        const digits = '23456789';
        const symbols = '!@#$%*';
        let pass = '';
        for (let i = 0; i < 10; i++) {
            pass += letters.charAt(Math.floor(Math.random() * letters.length));
        }
        for (let i = 0; i < 3; i++) {
            pass += digits.charAt(Math.floor(Math.random() * digits.length));
        }
        pass += symbols.charAt(Math.floor(Math.random() * symbols.length));
        setPassword(pass);
        setConfirmPassword(pass);
        setErrors((prev) => ({ ...prev, password: '', confirmPassword: '' }));
    };

    const validateStep = (step) => {
        const nextErrors = { ...errors };
        let valid = true;
        let firstFocus = null;

        const fail = (key, ref, msg) => {
            nextErrors[key] = msg;
            if (valid && ref?.current) firstFocus = ref.current;
            valid = false;
        };

        if (step === 1) {
            nextErrors.documentType = '';
            nextErrors.documentNumber = '';
            nextErrors.firstName = '';
            nextErrors.lastName = '';

            if (!documentType) {
                fail('documentType', docTypeRef, 'Select a document type.');
            }
            const docNum = documentNumber.trim();
            if (!/^\d{6,15}$/.test(docNum)) {
                fail(
                    'documentNumber',
                    docNumRef,
                    'Enter a valid document number (digits only, at least 6).'
                );
            }
            if (lastName.trim().length < 2) {
                fail('lastName', lastRef, 'Enter the full last names.');
            }
            if (firstName.trim().length < 2) {
                fail('firstName', firstRef, 'Enter the first names.');
            }
        }

        if (step === 2) {
            nextErrors.program = '';
            if (needsProgram && !program) {
                fail('program', programRef, 'Select your academic program.');
            }
        }

        if (step === 3) {
            nextErrors.email = '';
            nextErrors.password = '';
            nextErrors.confirmPassword = '';

            const emailVal = emailUser.trim();
            const cleanUser = emailVal.replace(/@.*$/, '');
            if (
                !cleanUser ||
                !/^[a-z0-9]+([._-][a-z0-9]+)*$/i.test(cleanUser)
            ) {
                fail(
                    'email',
                    emailRef,
                    'Use letters, numbers, dot, hyphen or underscore.'
                );
            }

            if (
                password.length < 8 ||
                !/[a-z]/.test(password) ||
                !/[A-Z]/.test(password) ||
                !/\d/.test(password)
            ) {
                fail(
                    'password',
                    passRef,
                    'At least 8 characters, with an uppercase letter, a lowercase letter and a number.'
                );
            }

            if (confirmPassword !== password) {
                fail(
                    'confirmPassword',
                    pass2Ref,
                    'The passwords do not match.'
                );
            }
        }

        setErrors(nextErrors);
        if (firstFocus) {
            try {
                firstFocus.focus();
            } catch (_) {
                /* ignore focus error */
            }
        }
        return valid;
    };

    const showStep = (n) => {
        const clamped = Math.min(Math.max(n, 1), STEPS.length);
        setCurrentStep(clamped);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleNext = () => {
        setErrorBanner('');
        if (!validateStep(currentStep)) return;
        showStep(currentStep + 1);
    };

    const handlePrev = () => {
        setErrorBanner('');
        showStep(currentStep - 1);
    };

    const handleReset = () => {
        setDocumentType('');
        setDocumentNumber('');
        setFirstName('');
        setLastName('');
        setRole('student');
        setProgram('');
        setFaculty('');
        setEmailUser('');
        setEmailEditedByHand(false);
        setPassword('');
        setConfirmPassword('');
        setErrors({});
        setErrorBanner('');
        showStep(1);
    };

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    const cleanEmail = emailUser.trim()
        ? emailUser.trim().includes('@')
            ? emailUser.trim()
            : emailUser.trim() + domain
        : '';
    const roleMeta = ROLES[role] || ROLES.student;
    const year = new Date().getFullYear();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorBanner('');

        if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
            setErrorBanner('Please complete all required fields correctly.');
            return;
        }

        setSubmitting(true);
        try {
            await request('/api/auth/register', {
                method: 'POST',
                skipRedirect: true,
                body: {
                    role,
                    program: needsProgram ? program : '',
                    documentType,
                    documentNumber: documentNumber.trim(),
                    firstName: firstName.trim(),
                    lastName: lastName.trim(),
                    email: cleanEmail,
                    password,
                },
            });
            setDone(true);
        } catch (err) {
            let msg =
                err.message ||
                'Could not complete registration. Please try again.';
            if (
                /already exists|already has an access account|document.*not available/i.test(
                    msg
                )
            ) {
                msg =
                    'The document or email entered is not available for registration';
            }
            setErrorBanner(msg);
            setSubmitting(false);
        }
    };

    return (
        <>
            <div className="reg-top-bar">
                <header className="reg-header">
                    <h2 id="reg-form-title">
                        {done ? 'Registration submitted' : 'Register new user'}
                    </h2>
                    <p id="reg-form-desc">
                        {done
                            ? 'Your request has been received by the institutional software.'
                            : 'Complete the four steps to register the user in the institutional software.'}
                    </p>
                </header>
                <a
                    href="index.html"
                    className="reg-back-link"
                    aria-label="Return to login page"
                >
                    <i className="fa-solid fa-arrow-left" aria-hidden="true" />
                    <span>Back to sign in</span>
                </a>
            </div>

            <div id="reg-done" className="reg-done-container" hidden={!done}>
                <div className="reg-done-card">
                    <div className="reg-done-icon">
                        <i
                            className="fa-solid fa-circle-check"
                            aria-hidden="true"
                        />
                    </div>
                    <h3>Registration received</h3>
                    <p>
                        Your account request has been registered in the system.
                        The Director will review and accept your account before
                        you can sign in.
                    </p>
                    <a className="cp-btn cp-btn-save" href="index.html">
                        <span>Back to sign in</span>
                        <i
                            className="fa-solid fa-arrow-right"
                            aria-hidden="true"
                        />
                    </a>
                </div>
            </div>

            <div
                id="reg-wizard-container"
                className="um-wizard-layout"
                data-step={String(currentStep)}
                style={{ display: done ? 'none' : '' }}
            >
                <div className="um-wizard-main">
                    <ol className="um-steps">
                        {STEPS.map((s, idx) => {
                            const isCurrent = s.step === currentStep;
                            const isDone = s.step < currentStep;
                            return (
                                <React.Fragment key={s.step}>
                                    {idx > 0 && (
                                        <li
                                            className={`um-step-bar ${
                                                s.step - 1 < currentStep
                                                    ? 'is-done'
                                                    : ''
                                            }`}
                                            aria-hidden="true"
                                        />
                                    )}
                                    <li
                                        className={`um-step-item ${
                                            isCurrent ? 'is-current' : ''
                                        } ${isDone ? 'is-done' : ''}`}
                                        aria-current={
                                            isCurrent ? 'step' : 'false'
                                        }
                                    >
                                        <span className="um-step-dot">
                                            {s.step}
                                        </span>
                                        <span className="um-step-text">
                                            <small>Step {s.step}</small>
                                            <strong>{s.title}</strong>
                                        </span>
                                    </li>
                                </React.Fragment>
                            );
                        })}
                    </ol>

                    <form
                        id="reg-form"
                        action="#"
                        method="post"
                        noValidate
                        autoComplete="off"
                        onSubmit={handleSubmit}
                    >
                        {/* STEP 1: IDENTITY */}
                        <div
                            className={`cp-card um-step-panel ${
                                currentStep === 1 ? 'is-active' : ''
                            }`}
                            data-step="1"
                        >
                            <div className="um-step-head">
                                <div>
                                    <h3>Personal data and identity</h3>
                                    <p>
                                        Enter the names and the document exactly
                                        as they appear in the official record.
                                    </p>
                                </div>
                                <span className="um-tag">Required</span>
                            </div>

                            <div className="um-grid">
                                <div
                                    className={`um-field ${
                                        errors.documentType ? 'has-error' : ''
                                    }`}
                                >
                                    <label htmlFor="reg-doctype">
                                        Document type
                                    </label>
                                    <div className="cp-input-wrap">
                                        <select
                                            id="reg-doctype"
                                            name="doctype"
                                            ref={docTypeRef}
                                            value={documentType}
                                            onChange={(e) => {
                                                setDocumentType(e.target.value);
                                                setErrors((prev) => ({
                                                    ...prev,
                                                    documentType: '',
                                                }));
                                            }}
                                        >
                                            <option value="" disabled>
                                                Select Document Type
                                            </option>
                                            <option value="CC">
                                                Citizenship card
                                            </option>
                                            <option value="CE">
                                                Foreigner ID card
                                            </option>
                                            <option value="PA">Passport</option>
                                        </select>
                                        <i
                                            className="fa-solid fa-chevron-down right-icon"
                                            aria-hidden="true"
                                        />
                                    </div>
                                    <span className="um-error">
                                        {errors.documentType || ''}
                                    </span>
                                </div>

                                <div
                                    className={`um-field ${
                                        errors.documentNumber ? 'has-error' : ''
                                    }`}
                                >
                                    <label htmlFor="reg-doc">
                                        Document number
                                    </label>
                                    <div className="um-control um-control--mono">
                                        <i
                                            className="fa-solid fa-hashtag"
                                            aria-hidden="true"
                                        />
                                        <input
                                            id="reg-doc"
                                            name="doc"
                                            type="text"
                                            inputMode="numeric"
                                            autoComplete="off"
                                            placeholder="1098234871"
                                            maxLength={30}
                                            required
                                            ref={docNumRef}
                                            value={documentNumber}
                                            onChange={(e) =>
                                                setDocumentNumber(
                                                    e.target.value
                                                )
                                            }
                                        />
                                    </div>
                                    <span className="um-error">
                                        {errors.documentNumber || ''}
                                    </span>
                                </div>

                                <div
                                    className={`um-field ${
                                        errors.firstName ? 'has-error' : ''
                                    }`}
                                >
                                    <label htmlFor="reg-first">
                                        First names
                                    </label>
                                    <div className="um-control">
                                        <i
                                            className="fa-solid fa-user"
                                            aria-hidden="true"
                                        />
                                        <input
                                            id="reg-first"
                                            name="first"
                                            type="text"
                                            autoComplete="given-name"
                                            placeholder="Mariana Sofía"
                                            maxLength={80}
                                            required
                                            ref={firstRef}
                                            value={firstName}
                                            onChange={(e) =>
                                                setFirstName(e.target.value)
                                            }
                                        />
                                    </div>
                                    <span className="um-error">
                                        {errors.firstName || ''}
                                    </span>
                                </div>

                                <div
                                    className={`um-field ${
                                        errors.lastName ? 'has-error' : ''
                                    }`}
                                >
                                    <label htmlFor="reg-last">Last names</label>
                                    <div className="um-control">
                                        <i
                                            className="fa-solid fa-users"
                                            aria-hidden="true"
                                        />
                                        <input
                                            id="reg-last"
                                            name="last"
                                            type="text"
                                            autoComplete="family-name"
                                            placeholder="Cárdenas Mendoza"
                                            maxLength={80}
                                            required
                                            ref={lastRef}
                                            value={lastName}
                                            onChange={(e) =>
                                                setLastName(e.target.value)
                                            }
                                        />
                                    </div>
                                    <span className="um-error">
                                        {errors.lastName || ''}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* STEP 2: ROLE */}
                        <div
                            className={`cp-card um-step-panel ${
                                currentStep === 2 ? 'is-active' : ''
                            }`}
                            data-step="2"
                        >
                            <div className="um-step-head">
                                <div>
                                    <h3>Institutional role and affiliation</h3>
                                    <p>
                                        The role defines which panel the person
                                        sees when entering the portal.
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
                                            name="role"
                                            value="student"
                                            checked={role === 'student'}
                                            onChange={() =>
                                                handleRoleChange('student')
                                            }
                                        />
                                        <span className="um-role-box">
                                            <i
                                                className="fa-solid fa-graduation-cap"
                                                aria-hidden="true"
                                            />
                                            <span>
                                                <strong>Student</strong>
                                                <span>
                                                    Records evidence and answers
                                                    the logbook.
                                                </span>
                                            </span>
                                        </span>
                                    </label>
                                    <label className="um-role">
                                        <input
                                            type="radio"
                                            name="role"
                                            value="tutor"
                                            checked={role === 'tutor'}
                                            onChange={() =>
                                                handleRoleChange('tutor')
                                            }
                                        />
                                        <span className="um-role-box">
                                            <i
                                                className="fa-solid fa-user"
                                                aria-hidden="true"
                                            />
                                            <span>
                                                <strong>Academic Tutor</strong>
                                                <span>
                                                    Reviews activities and
                                                    leaves feedback.
                                                </span>
                                            </span>
                                        </span>
                                    </label>
                                    <label className="um-role">
                                        <input
                                            type="radio"
                                            name="role"
                                            value="advisor"
                                            checked={role === 'advisor'}
                                            onChange={() =>
                                                handleRoleChange('advisor')
                                            }
                                        />
                                        <span className="um-role-box">
                                            <i
                                                className="fa-solid fa-user-group"
                                                aria-hidden="true"
                                            />
                                            <span>
                                                <strong>
                                                    Pedagogical Advisor
                                                </strong>
                                                <span>
                                                    Accompanies the practice at
                                                    the institution.
                                                </span>
                                            </span>
                                        </span>
                                    </label>
                                </div>
                            </div>

                            <div
                                className="um-grid"
                                id="reg-program-box"
                                style={{ display: needsProgram ? '' : 'none' }}
                            >
                                <div
                                    className={`um-field ${
                                        errors.program ? 'has-error' : ''
                                    }`}
                                >
                                    <label
                                        htmlFor="reg-program"
                                        id="reg-program-label"
                                    >
                                        Academic program
                                    </label>
                                    <div className="cp-input-wrap">
                                        <select
                                            id="reg-program"
                                            name="program"
                                            ref={programRef}
                                            value={program}
                                            onChange={handleProgramChange}
                                        >
                                            <option value="" disabled>
                                                Select a program
                                            </option>
                                            {programs.map((p) => (
                                                <option
                                                    key={p.name}
                                                    value={p.name}
                                                    data-faculty={
                                                        p.faculty || ''
                                                    }
                                                >
                                                    {p.name}
                                                </option>
                                            ))}
                                        </select>
                                        <i
                                            className="fa-solid fa-chevron-down right-icon"
                                            aria-hidden="true"
                                        />
                                    </div>
                                    <span className="um-error">
                                        {errors.program || ''}
                                    </span>
                                </div>

                                <div className="um-field">
                                    <label htmlFor="reg-faculty">
                                        Faculty or department
                                    </label>
                                    <div className="um-control um-control--locked">
                                        <i
                                            className="fa-solid fa-building-columns"
                                            aria-hidden="true"
                                        />
                                        <input
                                            id="reg-faculty"
                                            name="faculty"
                                            type="text"
                                            readOnly
                                            placeholder="Filled in automatically"
                                            tabIndex={-1}
                                            value={faculty}
                                        />
                                    </div>
                                    <span className="um-hint">
                                        <i
                                            className="fa-solid fa-wand-magic-sparkles"
                                            aria-hidden="true"
                                        />{' '}
                                        Filled in according to the chosen
                                        program.
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* STEP 3: ACCESS */}
                        <div
                            className={`cp-card um-step-panel ${
                                currentStep === 3 ? 'is-active' : ''
                            }`}
                            data-step="3"
                        >
                            <div className="um-step-head">
                                <div>
                                    <h3>Access credentials</h3>
                                    <p>
                                        With these details the person signs in
                                        to the portal for the first time.
                                    </p>
                                </div>
                                <span className="um-tag">Security</span>
                            </div>

                            <div
                                className={`um-field ${
                                    errors.email ? 'has-error' : ''
                                }`}
                            >
                                <label htmlFor="reg-email">
                                    Institutional e-mail
                                </label>
                                <div className="um-control">
                                    <i
                                        className="fa-solid fa-at"
                                        aria-hidden="true"
                                    />
                                    <input
                                        id="reg-email"
                                        name="email"
                                        type="text"
                                        autoComplete="off"
                                        placeholder="first.lastname"
                                        ref={emailRef}
                                        value={emailUser}
                                        onChange={(e) => {
                                            setEmailEditedByHand(true);
                                            setEmailUser(e.target.value);
                                        }}
                                    />
                                    <span
                                        className="um-suffix"
                                        id="reg-domain-suffix"
                                    >
                                        {domain}
                                    </span>
                                </div>
                                <span className="um-error">
                                    {errors.email || ''}
                                </span>
                                <span className="um-hint">
                                    <i
                                        className="fa-solid fa-circle-check"
                                        aria-hidden="true"
                                    />{' '}
                                    We suggest it from the name, but you can
                                    change it.
                                </span>
                            </div>

                            <div
                                className={`um-field ${
                                    errors.password ? 'has-error' : ''
                                }`}
                            >
                                <label htmlFor="reg-pass">Password</label>
                                <div className="um-control um-control--mono">
                                    <i
                                        className="fa-solid fa-key"
                                        aria-hidden="true"
                                    />
                                    <input
                                        id="reg-pass"
                                        name="pass"
                                        type={
                                            showPassword ? 'text' : 'password'
                                        }
                                        autoComplete="new-password"
                                        placeholder="8+ characters, upper, lower and number"
                                        ref={passRef}
                                        value={password}
                                        onChange={(e) =>
                                            setPassword(e.target.value)
                                        }
                                    />
                                    <button
                                        type="button"
                                        className="um-icon-btn"
                                        id="reg-pass-toggle"
                                        aria-label="Show password"
                                        onClick={() =>
                                            setShowPassword((prev) => !prev)
                                        }
                                    >
                                        <i
                                            className={`fa-regular ${
                                                showPassword
                                                    ? 'fa-eye'
                                                    : 'fa-eye-slash'
                                            }`}
                                            aria-hidden="true"
                                        />
                                    </button>
                                </div>
                                <span className="um-error">
                                    {errors.password || ''}
                                </span>
                                <button
                                    type="button"
                                    className="um-ghost-btn"
                                    id="reg-pass-generate"
                                    style={{
                                        alignSelf: 'flex-start',
                                        marginTop: 4,
                                    }}
                                    onClick={handleGeneratePassword}
                                >
                                    <i
                                        className="fa-solid fa-dice"
                                        aria-hidden="true"
                                    />{' '}
                                    Generate a secure one
                                </button>
                            </div>

                            <div
                                className={`um-field ${
                                    errors.confirmPassword ? 'has-error' : ''
                                }`}
                            >
                                <label htmlFor="reg-pass2">
                                    Confirm password
                                </label>
                                <div className="um-control um-control--mono">
                                    <i
                                        className="fa-solid fa-lock"
                                        aria-hidden="true"
                                    />
                                    <input
                                        id="reg-pass2"
                                        name="pass2"
                                        type={
                                            showPassword ? 'text' : 'password'
                                        }
                                        autoComplete="new-password"
                                        placeholder="Repeat your password"
                                        ref={pass2Ref}
                                        value={confirmPassword}
                                        onChange={(e) =>
                                            setConfirmPassword(e.target.value)
                                        }
                                    />
                                </div>
                                <span className="um-error">
                                    {errors.confirmPassword || ''}
                                </span>
                            </div>
                        </div>

                        {/* STEP 4: CONFIRMATION */}
                        <div
                            className={`cp-card um-step-panel ${
                                currentStep === 4 ? 'is-active' : ''
                            }`}
                            data-step="4"
                        >
                            <div className="um-step-head">
                                <div>
                                    <h3>Review before saving</h3>
                                    <p>
                                        This is how the user&apos;s credential
                                        will look inside the portal.
                                    </p>
                                </div>
                                <span className="um-tag">Last step</span>
                            </div>

                            <dl className="um-summary" id="reg-summary">
                                <div>
                                    <dt>Full name</dt>
                                    <dd>{fullName || '—'}</dd>
                                </div>
                                <div>
                                    <dt>Document</dt>
                                    <dd>
                                        {`${documentType} ${documentNumber.trim()}`.trim() ||
                                            '—'}
                                    </dd>
                                </div>
                                <div>
                                    <dt>Institutional role</dt>
                                    <dd>{roleMeta.name}</dd>
                                </div>
                                <div>
                                    <dt>Program</dt>
                                    <dd>
                                        {(needsProgram ? program : '') ||
                                            'Unassigned'}
                                    </dd>
                                </div>
                                <div>
                                    <dt>Faculty</dt>
                                    <dd>{faculty || '—'}</dd>
                                </div>
                                <div>
                                    <dt>Institutional e-mail</dt>
                                    <dd>{cleanEmail || '—'}</dd>
                                </div>
                                <div>
                                    <dt>Initial status</dt>
                                    <dd>Pending approval (Director)</dd>
                                </div>
                            </dl>
                        </div>

                        <div
                            id="reg-error-banner"
                            className="reg-error-banner"
                            role="alert"
                        >
                            {errorBanner}
                        </div>

                        {/* Wizard action buttons */}
                        <div className="um-wizard-actions">
                            <span
                                className="um-progress-text"
                                id="reg-progress-text"
                            >
                                Step {currentStep} of {STEPS.length}
                            </span>
                            <button
                                type="button"
                                className="cp-btn cp-btn-cancel"
                                id="reg-btn-reset"
                                onClick={handleReset}
                            >
                                Clear
                            </button>
                            <button
                                type="button"
                                className="cp-btn cp-btn-cancel"
                                id="reg-btn-prev"
                                style={{
                                    display: currentStep === 1 ? 'none' : '',
                                }}
                                onClick={handlePrev}
                            >
                                Previous
                            </button>
                            <button
                                type="button"
                                className="cp-btn cp-btn-save"
                                id="reg-btn-next"
                                style={{
                                    display:
                                        currentStep === STEPS.length
                                            ? 'none'
                                            : '',
                                }}
                                onClick={handleNext}
                            >
                                Next
                            </button>
                            <button
                                type="submit"
                                className="cp-btn cp-btn-save"
                                id="reg-btn-submit"
                                disabled={submitting}
                                style={{
                                    display:
                                        currentStep === STEPS.length
                                            ? ''
                                            : 'none',
                                }}
                            >
                                <i
                                    className="fa-solid fa-user-check"
                                    aria-hidden="true"
                                />{' '}
                                Register
                            </button>
                        </div>
                    </form>
                </div>

                {/* Live credential aside */}
                <aside className="um-preview" aria-label="Credential preview">
                    <div id="reg-preview-card">
                        <article className="um-cred">
                            <header className="um-cred-top">
                                <div className="um-cred-brand">
                                    <i
                                        className="fa-solid fa-shield-halved"
                                        aria-hidden="true"
                                    />
                                    <p>
                                        University
                                        <br />
                                        credential <em>{year}</em>
                                    </p>
                                </div>
                                <span className="um-cred-state um-cred-state--active">
                                    ACTIVE
                                </span>
                            </header>
                            <div className="um-cred-body">
                                <h3 className="um-cred-name">
                                    {fullName || 'User name'}
                                </h3>
                                <p className="um-cred-doc">
                                    {`${documentType || '-'}  •  ${
                                        documentNumber.trim() || '—'
                                    }`}
                                </p>
                                <span className="um-cred-role">
                                    <i
                                        className={`fa-solid ${roleMeta.icon}`}
                                        aria-hidden="true"
                                    />
                                    {roleMeta.name}
                                </span>
                                <dl className="um-cred-meta">
                                    <div>
                                        <dt>PROGRAMA ACADÉMICO</dt>
                                        <dd>
                                            {(needsProgram ? program : '') ||
                                                'Unassigned'}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt>CORREO</dt>
                                        <dd className="is-mono">
                                            {cleanEmail || `user${domain}`}
                                        </dd>
                                    </div>
                                </dl>
                            </div>
                        </article>
                    </div>
                    <div className="um-checklist">
                        <h4>
                            <i
                                className="fa-solid fa-circle-info"
                                aria-hidden="true"
                            />{' '}
                            How to use this card
                        </h4>
                        <ul>
                            <li className="is-ok">
                                <i
                                    className="fa-solid fa-circle-check"
                                    aria-hidden="true"
                                />
                                <span>It updates as you type in the form.</span>
                            </li>
                            <li className="is-ok">
                                <i
                                    className="fa-solid fa-circle-check"
                                    aria-hidden="true"
                                />
                                <span>
                                    Your registration will be submitted to the
                                    Director for approval.
                                </span>
                            </li>
                            <li className="is-ok">
                                <i
                                    className="fa-solid fa-circle-check"
                                    aria-hidden="true"
                                />
                                <span>
                                    The eye shows the temporary password so you
                                    can read it out.
                                </span>
                            </li>
                        </ul>
                    </div>
                </aside>
            </div>
        </>
    );
}
