import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import LoginApp from './components/auth/LoginApp';
import RegisterApp from './components/auth/RegisterApp';
import HomeApp from './components/home/HomeApp';
import StudentEvaluationApp from './components/student/StudentEvaluationApp';
import TutorEvaluationApp from './components/tutor/TutorEvaluationApp';
import DirectorPracticeEvaluationsApp from './components/director/DirectorPracticeEvaluationsApp';
import DirectorEvaluationsDashboardApp from './components/director/DirectorEvaluationsDashboardApp';
import CreatePracticeApp from './components/director/CreatePracticeApp';
import PracticeTypesApp from './components/director/PracticeTypesApp';
import InstitutionsApp from './components/director/InstitutionsApp';
import ManageUsersApp from './components/director/ManageUsersApp';
import AccreditationApp from './components/reports/AccreditationApp';

function DevPreviewApp() {
    const [view, setView] = useState('home');
    return (
        <div style={{ padding: 20, fontFamily: 'Inter, sans-serif' }}>
            <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <strong>SPP Full React Frontend Preview:</strong>
                {[
                    ['login', 'Login'],
                    ['register', 'Register'],
                    ['home', 'Home Dashboard'],
                    ['student', 'Student Evals'],
                    ['tutor', 'Tutor Evals'],
                    ['director-practice', 'Director Practice Evals'],
                    ['director-dashboard', 'Director Evals Dashboard'],
                    ['create-practice', 'Create Practice'],
                    ['manage-users', 'Manage Users'],
                    ['practice-types', 'Practice Types'],
                    ['institutions', 'Institutions'],
                    ['accreditation', 'Accreditation']
                ].map(([key, label]) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => setView(key)}
                        disabled={view === key}
                    >
                        {label}
                    </button>
                ))}
            </div>
            <div className="ev-wrapper dv-wrapper">
                {view === 'login' && <LoginApp />}
                {view === 'register' && <RegisterApp />}
                {view === 'home' && <HomeApp />}
                {view === 'student' && <StudentEvaluationApp />}
                {view === 'tutor' && <TutorEvaluationApp />}
                {view === 'director-practice' && <DirectorPracticeEvaluationsApp />}
                {view === 'director-dashboard' && <DirectorEvaluationsDashboardApp />}
                {view === 'create-practice' && <CreatePracticeApp />}
                {view === 'manage-users' && <ManageUsersApp />}
                {view === 'practice-types' && <PracticeTypesApp />}
                {view === 'institutions' && <InstitutionsApp />}
                {view === 'accreditation' && <AccreditationApp />}
            </div>
        </div>
    );
}

const rootEl = document.getElementById('root');
if (rootEl) {
    createRoot(rootEl).render(<DevPreviewApp />);
}
