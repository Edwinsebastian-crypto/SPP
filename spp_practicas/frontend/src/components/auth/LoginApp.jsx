import React, { useState, useEffect } from 'react';
import { request } from '../../core/api';
import { initLoginSplash } from '../../core/shell';

export default function LoginApp() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        return initLoginSplash();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);
        document.body.style.cursor = 'wait';
        try {
            const result = await request('/api/auth/login', {
                method: 'POST',
                skipRedirect: true,
                body: {
                    username,
                    password,
                },
            });
            window.location.href = result.redirectTo;
        } catch (err) {
            setError(err.message || 'Could not sign in');
            setSubmitting(false);
            document.body.style.cursor = '';
        }
    };

    return (
        <>
            <section
                className="login-hero"
                aria-label="Pedagogical Practice Software"
            >
                <div className="hero-header">
                    <div className="logo-box" aria-hidden="true">
                        <i className="fa-solid fa-graduation-cap" />
                        <span>SP</span>
                    </div>
                    <div className="hero-titles">
                        <h1>SPP</h1>
                        <p>Pedagogical Practice Software</p>
                        <span className="title-underline" />
                    </div>
                </div>
                <div className="hero-illustration" aria-hidden="true">
                    <img
                        className="education-illustration"
                        src="img/logo-emblem.png"
                        alt=""
                    />
                </div>
            </section>
            <section className="login-form-section">
                <header className="form-header">
                    <h2 className="form-title">Sign in</h2>
                    <span className="form-title-underline" aria-hidden="true" />
                    <p>Enter your institutional credentials.</p>
                </header>
                <form
                    className="login-form"
                    action="#"
                    method="post"
                    autoComplete="off"
                    onSubmit={handleSubmit}
                >
                    <div className="input-group">
                        <label htmlFor="username">Username</label>
                        <div className="input-wrapper">
                            <i className="fa-regular fa-user icon-left" />
                            <input
                                id="username"
                                name="username"
                                type="text"
                                placeholder="Enter your institutional username"
                                required
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="input-group password-group">
                        <label htmlFor="password">Password</label>
                        <div className="input-wrapper">
                            <i className="fa-solid fa-lock icon-left" />
                            <input
                                id="password"
                                name="password"
                                type={showPassword ? 'text' : 'password'}
                                autoComplete="current-password"
                                placeholder="Enter your password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <button
                                className="btn-visibility"
                                type="button"
                                aria-label="Show password"
                                onClick={() =>
                                    setShowPassword((prev) => !prev)
                                }
                            >
                                <i
                                    className={`fa-regular ${
                                        showPassword ? 'fa-eye' : 'fa-eye-slash'
                                    }`}
                                />
                            </button>
                        </div>
                    </div>
                    <p
                        className="login-error"
                        role="alert"
                        style={{
                            color: '#b3261e',
                            fontSize: 14,
                            fontWeight: 600,
                            margin: '8px 0 0',
                            minHeight: 18,
                        }}
                    >
                        {error}
                    </p>
                    <button
                        className="btn-submit"
                        type="submit"
                        disabled={submitting}
                        aria-busy={submitting}
                    >
                        {submitting ? (
                            <span className="btn-loading-content">
                                <i className="fa-solid fa-spinner fa-spin btn-spinner" aria-hidden="true" />
                                <span>Loading...</span>
                            </span>
                        ) : (
                            <>
                                <span>Enter</span>
                                <svg
                                    className="btn-arrow"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                >
                                    <line x1="4" y1="12" x2="20" y2="12" />
                                    <polyline points="14 6 20 12 14 18" />
                                </svg>
                            </>
                        )}
                    </button>
                    <p className="auth-switch">
                        Don&apos;t have an account?{' '}
                        <a href="register.html">Register here</a>
                    </p>
                </form>
            </section>
        </>
    );
}
