/* =========================================================================
   director.api.js — Connects the DIRECTOR panel with the API (/api):
   create practice, practice types, institutions, practice lookup and reports.
   Activities & Evidences are managed by React (ActivitiesAndEvidencesApp).
   (User management lives in users.js, also connected to the API.)
   Loaded AFTER director.js.
   ========================================================================= */
document.addEventListener('DOMContentLoaded', () => {
    const $ = (selector, root) => (root || document).querySelector(selector);
    const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));
    const esc = SPP.escapeHtml;
    const STATUS_COLORS = { active: '#265c48', completed: '#6b7280', cancelled: '#b3261e' };

    // =====================================================================
    // 1) CREATE PRACTICE
    // =====================================================================
    const createRoot = $('#create-practice');
    // the five selects, in order: type, institution, student, tutor, advisor
    const [typeSelect, institutionSelect, studentSelect, tutorSelect, advisorSelect] = $$('.cp-input-wrap select', createRoot);
    const [startInput, endInput] = $$('.cp-date-input', createRoot);
    let practiceTypes = [];
    let institutions = [];
    let editingPracticeId = null;
    let allPractices = [];
    let isNavigatingToEdit = false;

    function resetCreatePracticeForm() {
        editingPracticeId = null;
        const mainTitle = document.querySelector('.cp-main-title');
        if (mainTitle) mainTitle.textContent = 'Practice Management';

        if (startInput) {
            startInput.value = '';
            startInput.disabled = false;
            if (startInput.parentElement) startInput.parentElement.classList.remove('is-disabled');
        }
        if (endInput) {
            endInput.value = '';
            endInput.disabled = false;
            if (endInput.parentElement) endInput.parentElement.classList.remove('is-disabled');
        }

        [typeSelect, institutionSelect, studentSelect, tutorSelect, advisorSelect].forEach(sel => {
            if (sel) {
                sel.selectedIndex = 0;
                sel.disabled = false;
                if (sel.parentElement && sel.parentElement.classList.contains('cp-input-wrap')) {
                    sel.parentElement.classList.remove('is-disabled');
                }
            }
        });

        if (createRoot) {
            createRoot.querySelectorAll('.has-error').forEach(el => el.classList.remove('has-error'));
            createRoot.querySelectorAll('.cp-error').forEach(el => el.textContent = '');
        }

        SPP.customSelect.resetIn(createRoot);
        loadCreateOptions();
    }

    async function loadCreateOptions() {
        try {
            const [typesResult, institutionsResult, usersResult, practicesResult] = await Promise.all([
                SPP.get('/api/practice-types'), SPP.get('/api/institutions'), SPP.get('/api/users?status=active'), SPP.get('/api/practices')
            ]);
            practiceTypes = typesResult.practiceTypes;
            institutions = institutionsResult.institutions;

            const activeUsers = usersResult.users.filter(u => u.status === 'active' || !u.status);
            allPractices = practicesResult.practices || [];

            const validStudents = activeUsers.filter(u => {
                if (u.role !== 'student') return false;
                const studentPractices = allPractices.filter(p => String(p.studentDocument) === String(u.documentNumber));
                return studentPractices.length === 0 || studentPractices.every(p => p.status === 'completed' || String(p.id) === String(editingPracticeId));
            });

            const byRole = (role) => activeUsers.filter((user) => user.role === role);
            const fullName = (user) => user.firstName + ' ' + user.lastName;
            SPP.fillSelect(typeSelect, practiceTypes, 'id', 'name', 'Select Practice Type');
            SPP.fillSelect(institutionSelect, institutions, 'id', 'name', 'Select the Institution');
            SPP.fillSelect(studentSelect, validStudents, 'documentNumber', fullName, 'Select the Student');
            SPP.fillSelect(tutorSelect, byRole('tutor'), 'documentNumber', fullName, 'Select the Tutor');
            SPP.fillSelect(advisorSelect, byRole('advisor'), 'documentNumber', fullName, 'Select the Advisor');
        } catch (e) { SPP.showError(e); }
    }

    window.addEventListener('spp:dataChanged', () => {
        loadCreateOptions();
    });

    function markError(input, message) {
        if (!input) return;
        const field = input.closest('.cp-field, .ptm-field, .practice-field, .institution-field, .inst-field');
        if (!field) return;
        let box = field.querySelector('.cp-error');
        if (!box) {
            box = document.createElement('span');
            box.className = 'cp-error';
            field.appendChild(box);
        }
        if (message) {
            field.classList.add('has-error');
            box.textContent = message;
        } else {
            field.classList.remove('has-error');
        }
    }

    /** Opens the Practices panel with `id` selected, i.e. back where the practice lives. */
    function goToPractice(id) {
        if (!practices || !practices.length || !id) return;
        const target = String(id);
        if (!practices.some((p) => String(p.id) === target)) return;
        practiceSelector.value = target;
        SPP.customSelect.sync(practiceSelector);
        showPractice(target);
        const practiceTab = document.querySelector('a[href="#practice"]');
        if (practiceTab) practiceTab.click();
        SPP.panels.resetScroll();
    }

    /** Switches to the list tab and flashes the card of `id` (create / edit feedback). */
    function revealCard(root, tabSelector, cardSelector, id) {
        if (!root || !id) return;
        const tab = $(tabSelector, root);
        if (tab) tab.click();
        const card = root.querySelector(cardSelector + '[data-id="' + String(id).replace(/"/g, '') + '"]');
        if (!card) return;

        const shell = document.querySelector('.app-shell');
        const isMobile = window.innerWidth <= 900 || window.innerHeight <= 500;

        if (isMobile && shell) {
            const topbar = root.querySelector('.app-topbar');
            const topbarHeight = topbar ? topbar.offsetHeight : 0;
            const cardTop = card.getBoundingClientRect().top - shell.getBoundingClientRect().top + shell.scrollTop;
            shell.scrollTo({ top: Math.max(0, cardTop - topbarHeight - 24), behavior: 'smooth' });
            window.scrollTo(0, 0);
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
        } else {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        card.classList.add('spp-card-highlight');
        setTimeout(() => card.classList.remove('spp-card-highlight'), 2400);
    }

    const saveButton = $('.cp-btn-save', createRoot);
    saveButton.addEventListener('click', async () => {
        const practice = {
            typeId: typeSelect.value, institutionId: institutionSelect.value, studentDocument: studentSelect.value,
            tutorDocument: tutorSelect.value, advisorDocument: advisorSelect.value, startDate: startInput.value, endDate: endInput.value
        };

        let hasError = false;
        [typeSelect, institutionSelect, studentSelect, tutorSelect, advisorSelect, startInput, endInput].forEach(inp => markError(inp, ''));

        if (!practice.typeId) { markError(typeSelect, 'Select a practice type'); hasError = true; }
        if (!practice.institutionId) { markError(institutionSelect, 'Select an institution'); hasError = true; }
        if (!practice.studentDocument) { markError(studentSelect, 'Select a student'); hasError = true; }
        if (!practice.tutorDocument) { markError(tutorSelect, 'Select a tutor'); hasError = true; }
        if (!practice.advisorDocument) { markError(advisorSelect, 'Select an advisor'); hasError = true; }
        if (!practice.startDate) {
            markError(startInput, 'Select a start date');
            hasError = true;
        } else {
            const startYear = parseInt(practice.startDate.split('-')[0], 10);
            if (isNaN(startYear) || startYear < 2000 || startYear > 2100) {
                markError(startInput, 'Please select a valid start date');
                hasError = true;
            }
        }

        if (!practice.endDate) {
            markError(endInput, 'Select an end date');
            hasError = true;
        } else {
            const endYear = parseInt(practice.endDate.split('-')[0], 10);
            if (isNaN(endYear) || endYear < 2000 || endYear > 2100) {
                markError(endInput, 'Please select a valid end date');
                hasError = true;
            } else if (practice.startDate && practice.endDate < practice.startDate) {
                markError(endInput, 'The end date cannot be earlier than the start date');
                hasError = true;
            }
        }

        if (hasError) return;
        saveButton.disabled = true;
        try {
            const isEdit = Boolean(editingPracticeId);
            let savedId = editingPracticeId;
            if (isEdit) {
                await SPP.put(`/api/practices/${editingPracticeId}`, practice);
                editingPracticeId = null;
            } else {
                const created = await SPP.post('/api/practices', practice);
                savedId = created && created.practice ? created.practice.id : null;
            }
            await loadPractices();
            loadDashboard();

            const title = isEdit ? 'Practice updated' : 'Practice created';
            const msg = isEdit ? 'The practice was updated successfully and already appears in the list.' : 'The practice was registered successfully and already appears in the list.';
            await SPP.modals.alert({ title, message: msg });

            resetCreatePracticeForm();
            if (savedId) goToPractice(savedId);
        } catch (e) { SPP.showError(e); }
        saveButton.disabled = false;
    });

    const cancelCreateButton = $('.cp-btn-cancel', createRoot);
    if (cancelCreateButton) {
        cancelCreateButton.addEventListener('click', () => {
            resetCreatePracticeForm();
        });
    }

    const createPracticeNavLink = document.querySelector('a[href="#create-practice"]');
    if (createPracticeNavLink) {
        createPracticeNavLink.addEventListener('click', () => {
            if (!isNavigatingToEdit) {
                resetCreatePracticeForm();
            }
        });
    }

    // =====================================================================
    // 2) PRACTICE TYPES
    // =====================================================================
    const typesRoot = $('#manage-practices');
    const typeForm = $('#ptm-form-register');
    const typeList = $('#ptm-type-list');
    const typeCardTemplate = $('.ptm-type-card', typeList) ? $('.ptm-type-card', typeList).cloneNode(true) : null;
    let editingTypeId = null;

    function typeCard(type) {
        const card = typeCardTemplate.cloneNode(true);
        card.dataset.id = type.id;
        card.dataset.code = type.code;
        $('.ptm-type-name', card).textContent = type.name;
        const items = $$('.ptm-meta-item', card);
        if (items[0]) items[0].innerHTML = '<span class="ptm-meta-key">Practice Code</span> ' + esc(type.code);
        if (items[1]) items[1].innerHTML = '<span class="ptm-meta-key">Semester</span> ' + esc(type.semester);
        if (items[2]) items[2].innerHTML = '<span class="ptm-meta-key">Hours</span> ' + esc(type.hours);

        const hasActivePractice = allPractices.some(p => p.status === 'active' && String(p.typeId) === String(type.id));
        const deleteItem = card.querySelector('.ev-item--delete');
        if (deleteItem && hasActivePractice) {
            deleteItem.classList.add('is-disabled');
            deleteItem.style.pointerEvents = 'none';
            deleteItem.style.opacity = '0.5';
            deleteItem.style.cursor = 'not-allowed';
            deleteItem.title = 'Cannot delete type with active practices';
        }
        return card;
    }

    async function loadTypes() {
        try {
            const [typeRes, pracRes] = await Promise.all([SPP.get('/api/practice-types'), SPP.get('/api/practices')]);
            practiceTypes = typeRes.practiceTypes;
            allPractices = pracRes.practices || [];
        } catch (e) { SPP.showError(e); return; }
        const pill = $('#ptm-total-pill'); if (pill) pill.textContent = practiceTypes.length + (practiceTypes.length === 1 ? ' practice types registered' : ' practice types registered');
        typeList.innerHTML = '';
        if (!practiceTypes.length) typeList.innerHTML = '<p style="padding:16px;opacity:.7">There are no practice types registered yet.</p>';
        practiceTypes.forEach((type) => typeList.appendChild(typeCard(type)));
    }

    function resetTypeForm() {
        typeForm.reset();
        editingTypeId = null;
        $$('.cp-input-wrap select', typesRoot).forEach((select) => { select.selectedIndex = 0; SPP.customSelect.rebuild(select); });
        typeForm.querySelectorAll('.has-error').forEach(el => el.classList.remove('has-error'));

        const registerTab = $('[data-ptm-panel="ptm-panel-register"]', typesRoot);
        if (registerTab) {
            registerTab.innerHTML = '<i class="fa-solid fa-circle-plus" aria-hidden="true"></i> <span class="ptm-tab-title">Register Practice Type</span>';
        }
        const mainHeader = $('#ptm-main-title');
        if (mainHeader) mainHeader.textContent = 'Manage practice types';
        const submitBtn = $('.cp-btn-save', typeForm);
        if (submitBtn) submitBtn.textContent = 'Register Type';
    }
    $('#ptm-btn-cancel').addEventListener('click', resetTypeForm);

    const managePracticesNavLink = document.querySelector('a[href="#manage-practices"]');
    if (managePracticesNavLink) {
        managePracticesNavLink.addEventListener('click', () => {
            resetTypeForm();
        });
    }
    typeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = { name: $('#ptm-name').value, semester: $('#ptm-semester').value, hours: $('#ptm-hours').value };
        const nameInput = $('#ptm-name');
        const semesterInput = $('#ptm-semester');
        const hoursInput = $('#ptm-hours');
        [nameInput, semesterInput, hoursInput].forEach(inp => markError(inp, ''));

        let hasError = false;
        if (!body.name.trim()) { markError(nameInput, 'Enter the name of the practice type'); hasError = true; }
        if (!body.semester) { markError(semesterInput, 'Select a semester'); hasError = true; }
        if (!body.hours) { markError(hoursInput, 'Enter the hours'); hasError = true; }
        if (hasError) return;

        const isTypeEdit = Boolean(editingTypeId);
        try {
            let savedId = editingTypeId;
            if (isTypeEdit) await SPP.put(`/api/practice-types/${editingTypeId}`, body);
            else savedId = (await SPP.post('/api/practice-types', body)).practiceType.id;
            resetTypeForm();
            await loadTypes();
            await loadCreateOptions();
            loadDashboard();
            revealCard(typesRoot, '[data-ptm-panel="ptm-panel-list"]', '.ptm-type-card', savedId);
            await SPP.modals.alert({
                title: isTypeEdit ? 'Practice type updated' : 'Practice type created',
                message: isTypeEdit
                    ? 'The changes were saved and the practice type now appears in the list.'
                    : 'The practice type was registered successfully and already appears in the list.'
            });
        } catch (err) { SPP.showError(err); }
    });

    SPP.panels.bindCardList(typesRoot, '.ptm-type-card', {
        view: (card) => {
            const type = practiceTypes.find((x) => String(x.id) === card.dataset.id);
            if (type) SPP.modals.alert({
                title: type.name,
                icon: 'info',
                rows: [
                    { label: 'Practice Code', value: type.code },
                    { label: 'Semester', value: type.semester },
                    { label: 'Hours', value: type.hours }
                ]
            });
        },
        edit: (card) => {
            const type = practiceTypes.find((x) => String(x.id) === card.dataset.id);
            if (!type) return;
            editingTypeId = type.id;
            $('#ptm-name').value = type.name;
            $('#ptm-semester').value = String(type.semester);
            $('#ptm-hours').value = type.hours;
            SPP.customSelect.rebuild($('#ptm-semester'));
            const trigger = $('#ptm-semester').parentElement.querySelector('.custom-select-trigger');
            if (trigger) { trigger.textContent = String(type.semester); trigger.classList.remove('is-placeholder'); }

            const registerTab = $('[data-ptm-panel="ptm-panel-register"]', typesRoot);
            if (registerTab) {
                registerTab.innerHTML = '<i class="fa-solid fa-pen-to-square" aria-hidden="true"></i> <span class="ptm-tab-title">Edit Practice Type</span>';
            }
            const mainHeader = $('#ptm-main-title');
            if (mainHeader) mainHeader.textContent = 'Edit Practice Type';
            const submitBtn = $('.cp-btn-save', typeForm);
            if (submitBtn) submitBtn.textContent = 'Save Changes';

            if (registerTab) registerTab.click();
            if (window.SPP && window.SPP.panels && window.SPP.panels.resetScroll) {
                window.SPP.panels.resetScroll();
            } else {
                window.scrollTo(0, 0);
            }
        },
        delete: async (card) => {
            const type = practiceTypes.find((x) => String(x.id) === card.dataset.id);
            const confirmed = await SPP.modals.confirm({
                title: 'Delete practice type',
                message: 'The practice type "' + (type ? type.name : '') + '" will be permanently deleted.\n\nThis action cannot be undone.',
                confirmLabel: 'Delete'
            });
            if (!confirmed) return;
            try {
                await SPP.del(`/api/practice-types/${card.dataset.id}`);
                await loadTypes();
                await loadCreateOptions();
                loadDashboard();
                await SPP.modals.alert({ title: 'Practice type deleted', message: 'The practice type was deleted successfully.' });
            } catch (err) { SPP.showError(err); }
        }
    });

    // =====================================================================
    // 3) INSTITUTIONS
    // =====================================================================
    const institutionsRoot = $('#manage-institutions');
    const institutionForm = $('#inst-form-register');
    const institutionList = $('#inst-entity-list');
    const institutionCardTemplate = $('.inst-entity-card', institutionList) ? $('.inst-entity-card', institutionList).cloneNode(true) : null;
    const taxIdInput = $('#inst-taxid');
    let editingInstitutionId = null;

    function institutionCard(institution) {
        const card = institutionCardTemplate.cloneNode(true);
        card.dataset.id = institution.id;
        $('.ev-card-title', card).textContent = institution.name;
        const items = $$('.entity-meta-item', card);
        if (items[0]) items[0].innerHTML = '<span class="entity-meta-key">Tax ID</span> ' + esc(institution.taxId);
        if (items[1]) items[1].innerHTML = '<span class="entity-meta-key">Manager</span> ' + esc(institution.manager);
        if (items[2]) items[2].innerHTML = '<span class="entity-meta-key">Email</span> ' + esc(institution.email);
        $('.entity-card-desc', card).textContent = institution.address;

        const hasActivePractice = allPractices.some(p => p.status === 'active' && String(p.institutionId) === String(institution.id));
        const deleteItem = card.querySelector('.ev-item--delete');
        if (deleteItem && hasActivePractice) {
            deleteItem.classList.add('is-disabled');
            deleteItem.style.pointerEvents = 'none';
            deleteItem.style.opacity = '0.5';
            deleteItem.style.cursor = 'not-allowed';
            deleteItem.title = 'Cannot delete institution with active practices';
        }

        return card;
    }

    async function loadInstitutions() {
        try {
            const [instRes, pracRes] = await Promise.all([SPP.get('/api/institutions'), SPP.get('/api/practices')]);
            institutions = instRes.institutions;
            allPractices = pracRes.practices || [];
        } catch (e) { SPP.showError(e); return; }
        const pill = $('#inst-total-pill'); if (pill) pill.textContent = institutions.length + (institutions.length === 1 ? ' institutions registered' : ' institutions registered');
        institutionList.innerHTML = '';
        if (!institutions.length) institutionList.innerHTML = '<p style="padding:16px;opacity:.7">There are no institutions registered yet.</p>';
        institutions.forEach((institution) => institutionList.appendChild(institutionCard(institution)));
    }

    function resetInstitutionForm() {
        institutionForm.reset();
        editingInstitutionId = null;
        taxIdInput.readOnly = false;
        institutionForm.querySelectorAll('.has-error').forEach(el => el.classList.remove('has-error'));

        const registerTab = $('[data-inst-panel="inst-panel-register"]', institutionsRoot);
        if (registerTab) {
            registerTab.innerHTML = '<i class="fa-solid fa-circle-plus" aria-hidden="true"></i> <span class="inst-tab-title">Register Institution</span>';
        }
        const mainHeader = $('#inst-main-title');
        if (mainHeader) mainHeader.textContent = 'Manage institutions';
        const submitBtn = $('.cp-btn-save', institutionForm);
        if (submitBtn) submitBtn.textContent = 'Register Institution';
    }
    $('#inst-btn-cancel').addEventListener('click', resetInstitutionForm);

    const manageInstitutionsNavLink = document.querySelector('a[href="#manage-institutions"]');
    if (manageInstitutionsNavLink) {
        manageInstitutionsNavLink.addEventListener('click', () => {
            resetInstitutionForm();
        });
    }

    institutionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = {
            taxId: taxIdInput.value, manager: $('#inst-manager').value, address: $('#inst-address').value,
            name: $('#inst-name').value, email: $('#inst-email').value
        };

        const managerInput = $('#inst-manager');
        const addressInput = $('#inst-address');
        const nameInput = $('#inst-name');
        const emailInput = $('#inst-email');
        [taxIdInput, managerInput, addressInput, nameInput, emailInput].forEach(inp => markError(inp, ''));

        let hasError = false;
        if (!body.taxId.trim()) { markError(taxIdInput, 'Enter the Tax ID'); hasError = true; }
        if (!body.manager.trim()) { markError(managerInput, 'Enter the manager name'); hasError = true; }
        if (!body.address.trim()) { markError(addressInput, 'Enter the address'); hasError = true; }
        if (!body.name.trim()) { markError(nameInput, 'Enter the institution name'); hasError = true; }
        if (!body.email.trim()) { markError(emailInput, 'Enter the email'); hasError = true; }
        if (hasError) return;

        try {
            const isInstitutionEdit = Boolean(editingInstitutionId);
            let savedId = editingInstitutionId;
            if (isInstitutionEdit) await SPP.put(`/api/institutions/${editingInstitutionId}`, body);
            else savedId = (await SPP.post('/api/institutions', body)).institution.id;
            resetInstitutionForm();
            await loadInstitutions();
            await loadCreateOptions();
            loadDashboard();
            revealCard(institutionsRoot, '[data-inst-panel="inst-panel-list"]', '.inst-entity-card', savedId);
            await SPP.modals.alert({
                title: isInstitutionEdit ? 'Institution updated' : 'Institution created',
                message: isInstitutionEdit
                    ? 'The changes were saved and the institution now appears in the list.'
                    : 'The institution was registered successfully and already appears in the list.'
            });
        } catch (err) { SPP.showError(err); }
    });

    SPP.panels.bindCardList(institutionsRoot, '.inst-entity-card', {
        view: (card) => {
            const institution = institutions.find((x) => String(x.id) === card.dataset.id);
            if (institution) SPP.modals.alert({
                title: institution.name,
                icon: 'info',
                rows: [
                    { label: 'Tax ID', value: institution.taxId },
                    { label: 'Manager', value: institution.manager },
                    { label: 'Email', value: institution.email },
                    { label: 'Address', value: institution.address }
                ]
            });
        },
        edit: (card) => {
            const institution = institutions.find((x) => String(x.id) === card.dataset.id);
            if (!institution) return;
            editingInstitutionId = institution.id;
            taxIdInput.readOnly = true;
            taxIdInput.value = institution.taxId;
            $('#inst-manager').value = institution.manager;
            $('#inst-address').value = institution.address;
            $('#inst-name').value = institution.name;
            $('#inst-email').value = institution.email;

            const registerTab = $('[data-inst-panel="inst-panel-register"]', institutionsRoot);
            if (registerTab) {
                registerTab.innerHTML = '<i class="fa-solid fa-pen-to-square" aria-hidden="true"></i> <span class="inst-tab-title">Edit Institution</span>';
            }
            const mainHeader = $('#inst-main-title');
            if (mainHeader) mainHeader.textContent = 'Edit Institution';
            const submitBtn = $('.cp-btn-save', institutionForm);
            if (submitBtn) submitBtn.textContent = 'Save Changes';

            if (registerTab) registerTab.click();
            if (window.SPP && window.SPP.panels && window.SPP.panels.resetScroll) {
                window.SPP.panels.resetScroll();
            } else {
                window.scrollTo(0, 0);
            }
        },
        delete: async (card) => {
            const institution = institutions.find((x) => String(x.id) === card.dataset.id);
            const confirmed = await SPP.modals.confirm({
                title: 'Delete institution',
                message: 'The institution "' + (institution ? institution.name : '') + '" will be permanently deleted.\n\nThis action cannot be undone.',
                confirmLabel: 'Delete'
            });
            if (!confirmed) return;
            try {
                await SPP.del(`/api/institutions/${card.dataset.id}`);
                await loadInstitutions();
                await loadCreateOptions();
                loadDashboard();
                await SPP.modals.alert({ title: 'Institution deleted', message: 'The institution was deleted successfully.' });
            } catch (err) { SPP.showError(err); }
        }
    });

    // =====================================================================
    // 4) PRACTICES (Director "Practices" panel: look up any practice)
    // =====================================================================
    const setField = (id, value) => {
        const el = document.getElementById(id);
        if (el) {
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
                el.value = value == null ? '' : value; el.readOnly = true;
            } else {
                el.textContent = value == null ? '' : value;
            }
        }
    };
    const practicePanel = $('#practice .practice-panel');
    let practices = [];
    const selectorBox = document.createElement('div');
    selectorBox.id = 'practice-selector-box';
    selectorBox.className = 'practice-field';
    selectorBox.style.marginBottom = '24px';
    selectorBox.innerHTML = '<label for="practice-selector">Assigned student</label>' +
        '<div class="cp-input-wrap">' +
        '<select id="practice-selector" aria-label="Assigned student" data-sheet-title="Assigned student"></select>' +
        '<i class="fa-solid fa-chevron-down right-icon" aria-hidden="true"></i>' +
        '</div>';
    $('.practice-form', practicePanel).insertAdjacentElement('beforebegin', selectorBox);
    SPP.customSelect.init('#practice-selector-box');
    const practiceSelector = $('#practice-selector', selectorBox);

    function updateDirectorLogbookHero(logbook) {
        const lb = logbook || {};
        const scoreValEl = document.querySelector('#practice #lb-score-val') || document.getElementById('lb-score-val');
        const scoreTitleEl = document.querySelector('#practice #lb-grade-title') || document.getElementById('lb-grade-title');
        const ringFillEl = document.querySelector('#practice #lb-ring-fill') || document.getElementById('lb-ring-fill');
        const obsTextEl = document.querySelector('#practice #lb-obs-text') || document.getElementById('lb-obs-text');

        const rawGrade = lb.finalGrade;
        const gradeNum = rawGrade != null && rawGrade !== '' ? parseFloat(rawGrade) : null;
        const hasGrade = gradeNum !== null && !isNaN(gradeNum);

        if (scoreValEl) scoreValEl.textContent = hasGrade ? gradeNum.toFixed(1) : '—';

        let gradeTitle;
        if (!hasGrade) gradeTitle = '—';
        else if (gradeNum >= 4.5) gradeTitle = 'Excellent';
        else if (gradeNum >= 4.0) gradeTitle = 'Outstanding';
        else if (gradeNum >= 3.0) gradeTitle = 'Passed';
        else if (gradeNum > 0) gradeTitle = 'Failed';
        else gradeTitle = '—';

        if (scoreTitleEl) scoreTitleEl.textContent = gradeTitle;

        if (ringFillEl) {
            const circumference = 226.2;
            const pct = hasGrade ? Math.max(0, Math.min(1, gradeNum / 5.0)) : 0;
            ringFillEl.style.strokeDasharray = `${circumference}`;
            ringFillEl.style.strokeDashoffset = `${circumference * (1 - pct)}`;
        }

        if (obsTextEl) {
            const obsText = lb.generalObservation && lb.generalObservation.trim()
                ? lb.generalObservation.trim()
                : '—';
            obsTextEl.textContent = obsText;
            obsTextEl.title = obsText;
            obsTextEl.dataset.fullObs = obsText;
        }
        const heroBanner = document.querySelector('#practice #lb-hero-banner') || document.getElementById('lb-hero-banner');
        if (heroBanner) heroBanner.classList.remove('is-loading');
    }

    let currentDirectorPractice = null;
    window.SPP_DIRECTOR = window.SPP_DIRECTOR || {};
    window.SPP_DIRECTOR.getCurrentPractice = () => currentDirectorPractice;

    async function updateDirectorQuestionsPill() {
        const qPill = document.querySelector('#practice #lb-questions-pill') || document.getElementById('lb-questions-pill');
        if (!qPill) return;

        const setPill = (text, isWarning) => {
            qPill.textContent = text;
            qPill.className = isWarning ? 'lb-card-pill lb-card-pill--warning' : 'lb-card-pill lb-card-pill--uptodate';
        };

        if (!currentDirectorPractice) {
            setPill('Up to date', false);
            return;
        }

        try {
            const evalApi = window.EvalAPI || (window.SPP && window.SPP.EvalAPI);
            if (!evalApi || !evalApi.director || typeof evalApi.director.listar !== 'function') {
                setPill('Up to date', false);
                return;
            }

            const practiceId = String(currentDirectorPractice.id || currentDirectorPractice.code || '');
            if (!practiceId) {
                setPill('Up to date', false);
                return;
            }

            const r = await evalApi.director.listar({ id_practica: practiceId });
            const evs = r?.items || (Array.isArray(r) ? r : []);
            if (!Array.isArray(evs) || evs.length === 0) {
                setPill('Up to date', false);
                return;
            }

            let pendingCount = 0;
            let pendingEvaluations = 0;

            for (const ev of evs) {
                if (ev.estado !== 'PUBLICADA') continue;

                const enviados = Number(ev.intentos_enviados) || 0;
                const calificados = Number(ev.intentos_calificados) || 0;
                const totalPreguntas = Number(ev.total_preguntas) || 0;

                if (enviados === 0 && calificados === 0) {
                    pendingCount += totalPreguntas;
                    pendingEvaluations++;
                } else if (Number(ev.intentos_iniciados) > enviados) {
                    pendingCount += totalPreguntas;
                    pendingEvaluations++;
                }
            }

            if (pendingCount > 0) {
                setPill(`${pendingCount} ${pendingCount === 1 ? 'question' : 'questions'}`, true);
            } else if (pendingEvaluations > 0) {
                setPill(`${pendingEvaluations} ${pendingEvaluations === 1 ? 'evaluation' : 'evaluations'}`, true);
            } else {
                setPill('Up to date', false);
            }
        } catch (_) {
            setPill('Up to date', false);
        }
    }

    async function showPractice(id) {
        const practice = practices.find((x) => String(x.id) === String(id));
        if (!practice) return;
        const isSwitching = currentDirectorPractice && String(currentDirectorPractice.id) !== String(practice.id);
        if (isSwitching) {
            ['#practice #lb-hours-pill', '#practice #lb-pending-pill', '#practice #lb-questions-pill'].forEach((sel) => {
                const el = document.querySelector(sel);
                if (el) el.classList.add('is-skel-pill');
            });
        }
        setField('practice-name', practice.name); setField('tutor', practice.tutor); setField('hours', practice.hours);
        setField('institution', practice.institution); setField('advisor', practice.advisor); setField('semester', practice.semester);
        setField('start-date', SPP.formatDate(practice.startDate)); setField('end-date', SPP.formatDate(practice.endDate));
        setField('code', practice.code);
        const badge = $('#practice .status-badge');
        if (badge) { badge.title = practice.status; badge.textContent = practice.status; badge.style.backgroundColor = STATUS_COLORS[practice.status] || ''; }
        const pPanel = $('#practice .practice-panel');
        if (pPanel) pPanel.classList.remove('is-loading');

        currentDirectorPractice = practice;
        window.SPP_DIRECTOR = window.SPP_DIRECTOR || {};
        window.SPP_DIRECTOR.currentPractice = practice;
        window.dispatchEvent(new CustomEvent('spp:director-practice-changed', { detail: { practice } }));
        updateDirectorLogbookHero(practice.logbook);
        await updateDirectorQuestionsPill();

        const studentName = $('#practice .lb-student-name'); if (studentName) studentName.textContent = '- ' + practice.student;
        window.SPP_CURRENT_STUDENT = {
            fullName: practice.student,
            documentType: practice.studentDetails.documentType,
            documentNumber: practice.studentDocument,
            status: practice.studentDetails.status,
            program: practice.studentDetails.program,
            email: practice.studentDetails.email
        };
    }

    const panelLogbook = document.getElementById('logbook-panel');
    const panelAct = document.getElementById('activities-panel');

    // Bind cards to trigger navigation buttons when whole card is clicked
    const dirCardActivities = document.querySelector('#practice #lb-card-activities') || document.getElementById('lb-card-activities');
    const dirActBtn = document.querySelector('#practice #activities-btn') || document.getElementById('activities-btn');
    if (dirCardActivities && dirActBtn) {
        dirCardActivities.addEventListener('click', (e) => {
            if (!e.target.closest('#activities-btn') && !e.target.closest('.lb-action-btn')) dirActBtn.click();
        });
        dirCardActivities.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                dirActBtn.click();
            }
        });
    }

    const dirCardQuestions = document.querySelector('#practice #lb-card-questions') || document.getElementById('lb-card-questions');
    const dirQBtn = document.querySelector('#practice #questions-btn') || document.getElementById('questions-btn');
    if (dirCardQuestions && dirQBtn) {
        dirCardQuestions.addEventListener('click', (e) => {
            if (!e.target.closest('#questions-btn') && !e.target.closest('.lb-action-btn')) dirQBtn.click();
        });
        dirCardQuestions.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                dirQBtn.click();
            }
        });
    }

    if (dirQBtn && !dirQBtn.dataset.directorBound) {
        dirQBtn.addEventListener('click', () => {
            if (panelLogbook) panelLogbook.style.display = 'none';
            const questionsPanel = document.getElementById('questions-panel');
            if (questionsPanel) questionsPanel.style.display = 'block';
            window.scrollTo(0, 0);
            if (window.SPP_EVAL_DIRECTOR && typeof window.SPP_EVAL_DIRECTOR.abrir === 'function') {
                window.SPP_EVAL_DIRECTOR.abrir();
            }
        });
        dirQBtn.dataset.directorBound = 'true';
    }

    const dirQBack = document.getElementById('questionsBack');
    if (dirQBack && !dirQBack.dataset.directorBound) {
        dirQBack.addEventListener('click', () => {
            const questionsPanel = document.getElementById('questions-panel');
            if (questionsPanel) questionsPanel.style.display = 'none';
            if (panelLogbook) panelLogbook.style.display = 'block';
            window.scrollTo(0, 0);
            if (window.SPP_EVAL_DIRECTOR && typeof window.SPP_EVAL_DIRECTOR.volverALista === 'function') {
                window.SPP_EVAL_DIRECTOR.volverALista();
            }
        });
        dirQBack.dataset.directorBound = 'true';
    }

    async function loadPractices() {
        try { practices = (await SPP.get('/api/practices')).practices; } catch (e) { SPP.showError(e); return; }
        const enterButton = $('#practice .practice-submit');
        if (!practices.length) {
            practiceSelector.innerHTML = '<option>No practices have been created</option>';
            practiceSelector.disabled = true;
            if (enterButton) enterButton.disabled = true;
            const pPanel = $('#practice .practice-panel');
            if (pPanel) pPanel.classList.remove('is-loading');
            SPP.customSelect.rebuild(practiceSelector);
            return;
        }
        practiceSelector.disabled = false; if (enterButton) enterButton.disabled = false;
        const previous = practiceSelector.value;
        practiceSelector.innerHTML = practices
            .map((p) => `<option value="${p.id}">${esc(p.student)} — ${esc(p.code)}</option>`).join('');
        if (previous && practices.some((p) => String(p.id) === previous)) practiceSelector.value = previous;
        SPP.customSelect.rebuild(practiceSelector);
        SPP.customSelect.sync(practiceSelector);
        showPractice(practiceSelector.value);
    }
    practiceSelector.addEventListener('change', () => showPractice(practiceSelector.value));

    window.addEventListener('spp:open-practice', (e) => {
        if (!practices || !practices.length) return;
        const id = String(e.detail.id);
        if (practices.some((p) => String(p.id) === id)) {
            practiceSelector.value = id;
            SPP.customSelect.sync(practiceSelector);
            showPractice(id);
            const enterButton = $('#practice .practice-submit');
            if (enterButton) {
                enterButton.click();
            }
        }
    });

    const practiceOptionsMenu = document.getElementById('practice-options-menu');
    if (practiceOptionsMenu) {
        SPP.bindMenu(practiceOptionsMenu);
    }

    const btnEditPractice = document.getElementById('btn-edit-practice');
    if (btnEditPractice) {
        btnEditPractice.addEventListener('click', async () => {
            const id = practiceSelector.value;
            const practice = practices.find((x) => String(x.id) === String(id));
            if (!practice) return;

            const dd = practiceOptionsMenu.querySelector('.ev-dropdown');
            if (dd) dd.classList.remove('is-open');

            editingPracticeId = practice.id;
            await loadCreateOptions();

            typeSelect.value = practice.typeId || '';
            institutionSelect.value = practice.institutionId || '';
            studentSelect.value = practice.studentDocument || '';
            tutorSelect.value = practice.tutorDocument || '';
            advisorSelect.value = practice.advisorDocument || '';

            startInput.value = practice.startDate ? String(practice.startDate).split('T')[0] : '';
            endInput.value = practice.endDate ? String(practice.endDate).split('T')[0] : '';

            typeSelect.disabled = true;
            institutionSelect.disabled = true;
            studentSelect.disabled = true;

            startInput.disabled = false;
            if (startInput.parentElement) startInput.parentElement.classList.remove('is-disabled');

            tutorSelect.disabled = false;
            advisorSelect.disabled = false;

            endInput.disabled = false;
            if (endInput.parentElement) endInput.parentElement.classList.remove('is-disabled');

            [typeSelect, institutionSelect, studentSelect, tutorSelect, advisorSelect].forEach(sel => SPP.customSelect.sync(sel));

            const mainTitle = document.querySelector('.cp-main-title');
            if (mainTitle) mainTitle.textContent = 'Edit Practice';

            const createPracticeTab = document.querySelector('a[href="#create-practice"]');
            if (createPracticeTab) {
                isNavigatingToEdit = true;
                createPracticeTab.click();
                isNavigatingToEdit = false;
            }
            if (window.SPP && window.SPP.panels && window.SPP.panels.resetScroll) {
                window.SPP.panels.resetScroll();
            } else {
                window.scrollTo(0, 0);
            }
        });
    }

    const btnDeletePractice = document.getElementById('btn-delete-practice');
    if (btnDeletePractice) {
        btnDeletePractice.addEventListener('click', async () => {
            const id = practiceSelector.value;
            if (!id) return;

            const dd = practiceOptionsMenu.querySelector('.ev-dropdown');
            if (dd) dd.classList.remove('is-open');

            const confirmed = await SPP.modals.confirm({
                title: 'Delete practice',
                message: 'Are you sure you want to delete this practice? will be permanently deleted.\n\nThis action cannot be undone.',
                confirmLabel: 'Delete'
            });
            if (!confirmed) return;
            try {
                await SPP.del(`/api/practices/${id}`);
                await loadPractices();
                loadDashboard();
                await SPP.modals.alert({ title: 'Practice deleted', message: 'The practice was deleted successfully.' });
            } catch (err) {
                SPP.showError(err);
            }
        });
    }

    // =====================================================================
    // 5) REPORTS  ->  React ReportsDashboardApp & AccreditationApp
    // =====================================================================
    function loadDashboard() {
        if (window.SPP_REPORTS) window.SPP_REPORTS.reload();
    }

    // =====================================================================
    // 6) NAVIGATION (Activities & Evidences are managed by React)
    // =====================================================================
    const btnActs = $$('#activities-btn, #questions-activities-btn');
    btnActs.forEach(btn => {
        if (btn) btn.addEventListener('click', () => {
            if (panelLogbook && panelAct) {
                panelLogbook.style.display = 'none';
                panelAct.style.display = 'flex';
                const questionsPanel = document.getElementById('questions-panel');
                if (questionsPanel) questionsPanel.style.display = 'none';
                window.scrollTo(0, 0);
            }
        });
    });

    // ---------- start-up ----------
    loadCreateOptions();
    loadTypes();
    loadInstitutions();
    loadPractices();
});
