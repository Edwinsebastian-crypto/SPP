/* global EvalUI, EvalAPI */
/* =========================================================================
   evaluacion-tutor.js — Pantalla del tutor: crear evaluaciones, agregar preguntas
   (manual o generadas con IA a partir de tema/evidencias), revisar, publicar y
   calificar. Habla solo con window.EvalAPI.
   ========================================================================= */
document.addEventListener('DOMContentLoaded', () => {
    'use strict';
    if (!document.getElementById('view-lista') && !document.getElementById('lista-contenido')) return;

    const { h, icon, $, clear, toast, modal, confirmar, ocupado, badge, badgeOrigen, nota, fecha, plural, TIPOS } = EvalUI;
    const API = EvalAPI.tutor;
    EvalUI.habilitarEnlacesExternos();

    const qs = new URLSearchParams(location.search);
    let PRACTICA = qs.get('practica') || '';
    let ESTUDIANTE = qs.get('estudiante') || '';

    /** Detecta la práctica activa seleccionada en el panel de tutor, o la primera si no hay parámetro. */
    async function resolverPractica() {
        const actual = window.SPP_TEACHER?.state?.practice;
        if (actual && (actual.id || actual.code)) {
            PRACTICA = String(actual.id || actual.code || '');
            ESTUDIANTE = String(actual.student || actual.studentName || ESTUDIANTE || '');
        } else if (!PRACTICA || !ESTUDIANTE) {
            const r = await fetch('/api/practices', { credentials: 'same-origin' });
            const lista = r.ok ? (await r.json()).practices || [] : [];
            const p = (PRACTICA ? lista.find((x) => String(x.id) === String(PRACTICA) || String(x.code) === String(PRACTICA)) : null) || lista.find((x) => x.status === 'active') || lista[0];
            if (p) { PRACTICA = p.id; ESTUDIANTE = p.student || p.studentName || ESTUDIANTE; }
        }
        const ctxEl = $('#lista-contexto');
        if (ctxEl) ctxEl.textContent = ESTUDIANTE ? ESTUDIANTE : (PRACTICA ? 'Practice evaluations' : 'You do not have assigned practices.');
    }

    const vistas = { lista: $('#view-lista'), editor: $('#view-editor'), intento: $('#view-intento') };
    function ver(nombre) {
        Object.entries(vistas).forEach(([k, el]) => { if (el) el.hidden = k !== nombre; });
        const shell = $('.app-shell'); window.scrollTo(0, 0); if (shell) shell.scrollTop = 0;
        const w = $('.ev-wrapper'); if (w) w.scrollTop = 0;
    }
    const estado = { ev: null, tab: 'preguntas' };

    /* ------------------------------------------------------------ avisos de modo */
    (async () => {
        try {
            const s = await EvalAPI.health();
            if (s && s.ia && s.ia.proveedor === 'mock') EvalUI.banner('The backend is using SIMULATED AI (no ANTHROPIC_API_KEY). Generated questions will be simple; configure the API key to use real AI.', 'fa-solid fa-flask', 'ev-banner--info');
        } catch (e) { /* si no hay backend, el error se muestra al cargar la lista */ }
    })();

    /* ================================================================= LISTA */
    const ctxEl = $('#lista-contexto');
    if (ctxEl && PRACTICA) ctxEl.textContent = ESTUDIANTE ? ESTUDIANTE : '';
    const btnNueva = $('#btn-nueva');
    if (btnNueva) btnNueva.addEventListener('click', () => modalEvaluacion());

    let estaCargandoLista = false;
    async function cargarLista() {
        if (estaCargandoLista) return;
        estaCargandoLista = true;
        const cont = clear($('#lista-contenido'));
        cont.appendChild(h('p', { class: 'ev-loading' }, 'Loading…'));
        try {
            const lista = await API.listarEvaluaciones({ id_practica: PRACTICA });
            clear(cont);
            if (!lista.length) {
                cont.appendChild(h('div', { class: 'ev-empty' }, icon('fa-regular fa-clipboard'), 'There are no evaluations for this practice yet.', h('br'), 'Create the first one with «New evaluation».'));
                window.SPP_TEACHER?.updateQuestionsPill?.([], true);
                return;
            }
            lista.forEach((ev) => cont.appendChild(tarjeta(ev)));
            window.SPP_TEACHER?.updateQuestionsPill?.(lista, true);
        } catch (e) {
            clear(cont);
            cont.appendChild(h('div', { class: 'ev-empty' }, icon('fa-solid fa-plug-circle-xmark'), e.message,
                h('div', { style: 'margin-top:16px' }, h('button', { type: 'button', class: 'ev-btn ev-btn--dark', onclick: cargarLista }, icon('fa-solid fa-rotate'), 'Retry'))));
        } finally {
            estaCargandoLista = false;
        }
    }
    function tarjeta(ev) {
        const abrir = () => abrirEditor(ev.id_evaluacion);
        return h('div', {
            class: 'ev-card',
            role: 'button',
            tabindex: '0',
            style: 'cursor: pointer;',
            onclick: abrir,
            onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); } }
        },
            h('div', { class: 'ev-card-icon' }, icon('fa-solid fa-circle-question')),
            h('div', { class: 'ev-card-body' },
                h('div', { class: 'ev-card-title' }, ev.titulo),
                h('div', { class: 'ev-badges', style: 'margin-top:8px' }, badge(ev.estado),
                    ev.preguntas_pendientes ? badge('BORRADOR', plural(ev.preguntas_pendientes, 'to review', 'to review')) : null),
                h('div', { class: 'ev-card-meta' },
                    h('span', {}, icon('fa-regular fa-circle-question'), plural(ev.preguntas_aprobadas, 'approved question', 'approved questions')),
                    h('span', {}, icon('fa-regular fa-user'), `${ev.intentos_presentados || 0} / ${ev.intentos_permitidos} ${ev.intentos_permitidos === 1 ? 'attempt' : 'attempts'}`),
                    ev.fecha_limite ? h('span', {}, icon('fa-regular fa-calendar'), 'Deadline: ' + fecha(ev.fecha_limite)) : h('span', {}, icon('fa-regular fa-calendar'), 'No deadline'))),
            ev.nota_final !== null ? h('div', { class: 'ev-nota' }, nota(ev.nota_final), h('small', {}, 'of ' + ev.nota_maxima)) : null,
            h('button', {
                type: 'button',
                class: 'ev-go',
                'aria-label': 'Open ' + ev.titulo,
                onclick: (e) => { e.stopPropagation(); abrir(); }
            }, icon('fa-solid fa-arrow-right')));
    }

    /* ----------------------------------------------- modal: crear / editar evaluación */
    function modalEvaluacion(ev) {
        const edit = !!ev;
        const bloqueado = edit && ev.intentos_presentados > 0;
        const fechaLimitePasada = edit && Boolean(ev.fecha_limite && (new Date(ev.fecha_limite).getTime() + 59999 + 60000 < Date.now()));
        const limiteBloqueado = edit && ev.intentos_presentados > 0 && fechaLimitePasada;

        const titulo = h('input', { class: 'ev-input', type: 'text', maxlength: '200', value: edit ? ev.titulo : '', placeholder: 'e.g. Lesson planning evaluation' });
        const desc = h('textarea', { class: 'ev-textarea', maxlength: '4000', placeholder: 'Instructions or context for the student (optional)' }, edit ? ev.descripcion || '' : '');
        const intentos = h('input', { class: 'ev-input', type: 'number', min: '1', max: '10', value: edit ? ev.intentos_permitidos : 1, disabled: bloqueado });
        const maxima = h('input', { class: 'ev-input', type: 'number', min: '1', max: '100', step: '0.5', value: edit ? ev.nota_maxima : 5, disabled: bloqueado });
        const limite = h('input', { class: 'ev-input', type: 'datetime-local', value: edit && ev.fecha_limite ? aLocal(ev.fecha_limite) : '', disabled: limiteBloqueado });
        const mostrar = h('input', { type: 'checkbox', checked: edit ? ev.mostrar_resultados : true });
        const guardar = h('button', { type: 'button', class: 'ev-btn ev-btn--dark' }, edit ? 'Save changes' : 'Create evaluation');
        const m = modal({ titulo: edit ? 'Edit evaluation' : 'New evaluation', ancho: 600, contenido: h('form', { class: 'ev-form', novalidate: true, onsubmit: (e) => { e.preventDefault(); guardar.click(); } },
            h('div', { class: 'ev-field' }, h('label', {}, 'Title'), titulo),
            h('div', { class: 'ev-field' }, h('label', {}, 'Description'), desc),
            h('div', { class: 'ev-row' },
                h('div', { class: 'ev-field' }, h('label', {}, 'Allowed attempts'), intentos),
                h('div', { class: 'ev-field' }, h('label', {}, 'Maximum grade'), maxima)),
            bloqueado ? h('p', { class: 'ev-hint' }, 'Attempts have already been submitted: maximum grade and attempts cannot be changed.') : null,
            h('div', { class: 'ev-field' }, h('label', {}, 'Deadline (optional)'), limite, h('span', { class: 'ev-hint' }, 'Past this date, the student can no longer start or submit.')),
            h('label', { class: 'ev-check' }, mostrar, 'Show the student the correct answers upon completion'),
            h('div', { class: 'ev-actions' }, h('button', { type: 'button', class: 'ev-btn ev-btn--soft', onclick: () => m.close() }, 'Cancel'), guardar)) });
        guardar.addEventListener('click', () => ocupado(guardar, async () => {
            titulo.classList.remove('is-error');
            if (titulo.value.trim().length < 3) { titulo.classList.add('is-error'); titulo.focus(); return toast('Title must have at least 3 characters.', 'error'); }
            const cuerpo = {
                titulo: titulo.value.trim(),
                descripcion: desc.value.trim() || null,
                fecha_limite: limiteBloqueado ? ev.fecha_limite : (limite.value ? new Date(limite.value).toISOString() : null),
                mostrar_resultados: mostrar.checked
            };
            if (!bloqueado) { cuerpo.intentos_permitidos = Number(intentos.value) || 1; cuerpo.nota_maxima = Number(maxima.value) || 5; }
            try {
                if (edit) { estado.ev = await API.editarEvaluacion(ev.id_evaluacion, cuerpo); m.close(); renderEditor(); toast('Evaluation updated.'); }
                else { const nuevo = await API.crearEvaluacion({ ...cuerpo, id_practica: PRACTICA, id_estudiante: ESTUDIANTE }); m.close(); toast('Evaluation created. Add questions manually or generate them with AI.'); await abrirEditor(nuevo.id_evaluacion); }
            } catch (e) { EvalUI.error(e); }
        }));
    }
    function aLocal(iso) { const d = new Date(iso); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; }

    /* ================================================================= EDITOR */
    async function abrirEditor(id, tab) {
        estado.tab = tab || 'preguntas';
        ver('editor');
        $('#editor-title').textContent = 'Loading evaluation…';
        clear($('#editor-badges'));
        clear($('#editor-acciones'));
        clear($('#editor-stats'));
        clear($('#editor-agregar'));
        const tabPreguntas = $('#tabpanel-preguntas');
        if (tabPreguntas) clear(tabPreguntas).appendChild(h('p', { class: 'ev-loading' }, 'Loading questions…'));
        clear($('#tabpanel-resultados'));
        try {
            estado.ev = await API.obtenerEvaluacion(id);
            renderEditor();
        } catch (e) {
            ver('lista');
            return EvalUI.error(e);
        }
    }
    $('#btn-volver-lista').addEventListener('click', () => { ver('lista'); cargarLista(); });
    $('#tab-preguntas').addEventListener('click', () => cambiarTab('preguntas'));
    $('#tab-resultados').addEventListener('click', () => cambiarTab('resultados'));
    function cambiarTab(t) {
        estado.tab = t;
        $('#tab-preguntas').setAttribute('aria-selected', String(t === 'preguntas'));
        $('#tab-resultados').setAttribute('aria-selected', String(t === 'resultados'));
        $('#tabpanel-preguntas').hidden = t !== 'preguntas';
        $('#tabpanel-resultados').hidden = t !== 'resultados';
        if (t === 'resultados') cargarResultados();
    }
    const editable = (ev) => ev.estado !== 'CERRADA' && ev.intentos_presentados === 0;

    function renderEditor() {
        const ev = estado.ev;
        $('#editor-title').textContent = ev.titulo;
        const bs = clear($('#editor-badges'));
        EvalUI.add(bs, badge(ev.estado), h('span', { class: 'ev-badge' }, icon('fa-regular fa-star'), `Max grade ${ev.nota_maxima}`),
            h('span', { class: 'ev-badge' }, icon('fa-solid fa-rotate-right'), plural(ev.intentos_permitidos, 'attempt', 'attempts')),
            ev.fecha_limite ? h('span', { class: 'ev-badge' }, icon('fa-regular fa-calendar'), fecha(ev.fecha_limite)) : h('span', { class: 'ev-badge' }, icon('fa-regular fa-calendar'), 'No deadline'));

        // acciones principales
        const acc = clear($('#editor-acciones'));
        const btn = (txt, ic, cls, fn) => { const b = h('button', { type: 'button', class: 'ev-btn ev-btn--sm ' + cls }, icon(ic), txt); b.addEventListener('click', () => ocupado(b, fn)); return b; };
        if (ev.estado !== 'CERRADA') acc.appendChild(h('button', { type: 'button', class: 'ev-btn ev-btn--sm ev-btn--ghost', onclick: () => modalEvaluacion(ev) }, icon('fa-solid fa-pen'), 'Edit'));
        if (ev.estado === 'BORRADOR') {
            const puedePublicar = (ev.preguntas_aprobadas || 0) > 0;
            const bPub = btn('Publish to student', 'fa-solid fa-paper-plane', puedePublicar ? 'ev-btn--primary' : 'ev-btn--disabled', async () => {
                if (!puedePublicar) {
                    return toast('You must approve at least one question before publishing the evaluation.', 'aviso');
                }
                if (ev.preguntas_pendientes && !(await confirmar({ titulo: 'Unreviewed questions remain', mensaje: `${plural(ev.preguntas_pendientes, 'question remains', 'questions remain')} in draft and will NOT be visible to the student. Publish anyway?`, ok: 'Publish' }))) return;
                try { estado.ev = await API.publicar(ev.id_evaluacion); renderEditor(); toast('Evaluation published: the student can now take it.'); } catch (e) { EvalUI.error(e); }
            });
            if (!puedePublicar) {
                bPub.disabled = true;
                bPub.title = 'Approve at least one question before publishing';
                bPub.style.cursor = 'not-allowed';
            }
            acc.appendChild(bPub);
        }
        if (ev.estado === 'PUBLICADA' && ev.intentos_presentados === 0) acc.appendChild(btn('Revert to draft', 'fa-solid fa-eye-slash', 'ev-btn--soft', async () => {
            try { estado.ev = await API.despublicar(ev.id_evaluacion); renderEditor(); toast('The evaluation was reverted to draft.'); } catch (e) { EvalUI.error(e); }
        }));
        if (ev.estado === 'PUBLICADA') acc.appendChild(btn('Close', 'fa-solid fa-lock', 'ev-btn--dark', async () => {
            if (!(await confirmar({ titulo: 'Close evaluation', mensaje: 'The student will no longer be able to take it and ongoing attempts will be submitted with their current answers.', ok: 'Close evaluation' }))) return;
            try { estado.ev = await API.cerrar(ev.id_evaluacion); renderEditor(); toast('Evaluation closed.'); } catch (e) { EvalUI.error(e); }
        }));
        if (ev.intentos_presentados === 0) acc.appendChild(btn('Delete', 'fa-solid fa-trash', 'ev-btn--danger', async () => {
            if (!(await confirmar({ titulo: 'Delete evaluation', mensaje: 'The evaluation and all of its questions will be deleted. This action cannot be undone.', ok: 'Delete', peligro: true }))) return;
            try { await API.eliminarEvaluacion(ev.id_evaluacion); toast('Evaluation deleted.'); ver('lista'); cargarLista(); } catch (e) { EvalUI.error(e); }
        }));

        // estadísticas
        const st = clear($('#editor-stats'));
        [[ev.preguntas_aprobadas, 'Approved questions'], [ev.preguntas_pendientes, 'To review'], [`${ev.intentos_presentados || 0} / ${ev.intentos_permitidos}`, 'Attempts'], [ev.nota_final === null ? '—' : nota(ev.nota_final), 'Final grade']]
            .forEach(([v, t]) => st.appendChild(h('div', { class: 'ev-stat' }, h('b', {}, v), h('span', {}, t))));

        // agregar preguntas
        const ag = clear($('#editor-agregar'));
        if (editable(ev)) {
            EvalUI.add(ag, 
                h('button', { type: 'button', class: 'ev-btn ev-btn--gold', onclick: () => modalGenerar() }, icon('fa-solid fa-wand-magic-sparkles'), 'Generate with AI'),
                h('button', { type: 'button', class: 'ev-btn ev-btn--dark', onclick: () => modalPregunta() }, icon('fa-solid fa-plus'), 'Add manual question'));
        } else {
            ag.appendChild(h('p', { class: 'ev-hint' }, ev.estado === 'CERRADA' ? 'The evaluation is closed.' : 'Attempts have already been submitted: questions cannot be modified.'));
        }
        renderPreguntas();
        cambiarTab(estado.tab);
    }

    /* ---------------------------------------------------------- lista de preguntas */
    function renderPreguntas() {
        const ev = estado.ev, cont = clear($('#tabpanel-preguntas'));
        if (editable(ev) && ev.preguntas_pendientes) {
            const b = h('button', { type: 'button', class: 'ev-btn ev-btn--sm ev-btn--dark' }, icon('fa-solid fa-check-double'), 'Approve all');
            b.addEventListener('click', () => ocupado(b, async () => { try { const r = await API.aprobarTodas(ev.id_evaluacion); toast(`${plural(r.aprobadas, 'question approved', 'questions approved')}.`); await recargar(); } catch (e) { EvalUI.error(e); } }));
            cont.appendChild(h('div', { class: 'ev-revision' }, icon('fa-solid fa-triangle-exclamation'), `${plural(ev.preguntas_pendientes, 'AI-generated question is waiting for', 'AI-generated questions are waiting for')} your review. Only approved questions will be seen by the student.`, b));
        }
        if (!ev.preguntas.length) {
            cont.appendChild(h('div', { class: 'ev-empty' }, icon('fa-regular fa-circle-question'), 'This evaluation does not have any questions yet.'));
            return;
        }
        const lista = h('div', { class: 'ev-stack' });
        ev.preguntas.forEach((p, i) => lista.appendChild(tarjetaPregunta(p, i + 1)));
        cont.appendChild(lista);
    }
    async function recargar() { estado.ev = await API.obtenerEvaluacion(estado.ev.id_evaluacion); renderEditor(); }

    function tarjetaPregunta(p, n) {
        const ed = editable(estado.ev);
        const accion = (ic, tit, cls, fn) => h('button', { type: 'button', class: 'ev-icon-btn ' + cls, title: tit, 'aria-label': tit, onclick: fn }, icon(ic));
        const revisar = (fn, msg) => async () => { try { await fn(p.id_pregunta); toast(msg); await recargar(); } catch (e) { EvalUI.error(e); } };
        const tools = h('div', { class: 'ev-q-tools' });
        if (ed) {
            if (p.estado_revision !== 'APROBADA') tools.appendChild(accion('fa-solid fa-check', 'Approve', 'ev-icon-btn--ok', revisar(API.aprobarPregunta, 'Question approved.')));
            if (p.estado_revision !== 'RECHAZADA') tools.appendChild(accion('fa-solid fa-ban', 'Reject', 'ev-icon-btn--bad', revisar(API.rechazarPregunta, 'Question rejected.')));
            tools.appendChild(accion('fa-solid fa-pen', 'Edit', '', () => modalPregunta(p)));
            tools.appendChild(accion('fa-solid fa-trash', 'Delete', 'ev-icon-btn--bad', async () => {
                if (!(await confirmar({ titulo: 'Delete question', mensaje: 'Delete this question?', ok: 'Delete', peligro: true }))) return;
                try { await API.eliminarPregunta(p.id_pregunta); toast('Question deleted.'); await recargar(); } catch (e) { EvalUI.error(e); }
            }));
        }
        return h('article', { class: 'ev-q' + (p.origen === 'IA' ? ' ev-q--ia' : '') + (p.estado_revision === 'RECHAZADA' ? ' ev-q--rechazada' : '') },
            h('div', { class: 'ev-q-top' },
                h('span', { class: 'ev-q-num' }, 'Question ' + n), badgeOrigen(p.origen),
                p.estado_revision !== 'APROBADA' || p.origen === 'IA' ? badge(p.estado_revision === 'BORRADOR' ? 'BORRADOR' : p.estado_revision, p.estado_revision === 'BORRADOR' ? 'To review' : null) : null,
                h('span', { class: 'ev-badge' }, TIPOS[p.tipo_pregunta]), h('span', { class: 'ev-badge' }, 'Points ' + p.valor_pregunta), tools),
            h('div', { class: 'ev-q-text' }, p.enunciado),
            p.opciones.length ? h('ul', { class: 'ev-q-opts' }, p.opciones.map((o) => h('li', { class: o.es_correcta ? 'is-ok' : '' }, icon(o.es_correcta ? 'fa-solid fa-circle-check' : 'fa-regular fa-circle'), o.texto))) : null,
            p.respuesta_esperada ? h('div', { class: 'ev-q-note' }, h('b', {}, 'Grading criteria: '), p.respuesta_esperada) : null,
            p.explicacion ? h('div', { class: 'ev-q-note' }, h('b', {}, 'Explanation: '), p.explicacion) : null);
    }

    /* -------------------------------------------------- modal: pregunta manual / edición */
    function modalPregunta(p) {
        const edit = !!p;
        let tipo = edit ? p.tipo_pregunta : 'OPCION_MULTIPLE';
        let ops = edit && p.opciones.length ? p.opciones.map((o) => ({ texto: o.texto, es_correcta: o.es_correcta })) : [];
        const enun = h('textarea', { class: 'ev-textarea', maxlength: '4000', placeholder: 'Write the question…' }, edit ? p.enunciado : '');
        const valor = h('input', { class: 'ev-input', type: 'number', min: '0.5', max: '100', step: '0.5', value: edit ? p.valor_pregunta : 1 });
        const expl = h('textarea', { class: 'ev-textarea', style: 'height:64px', maxlength: '4000', placeholder: 'Why the answer is correct (optional, shown to the student at the end)' }, edit ? p.explicacion || '' : '');
        const rubrica = h('textarea', { class: 'ev-textarea', style: 'height:80px', maxlength: '4000', placeholder: 'Criteria or model answer for grading (optional)' }, edit ? p.respuesta_esperada || '' : '');
        const zonaOps = h('div', { class: 'ev-field' });
        const zonaRub = h('div', { class: 'ev-field' }, h('label', {}, 'Grading criteria'), rubrica);
        const seg = h('div', { class: 'ev-seg', role: 'group', 'aria-label': 'Question type' });

        function pintarOpciones() {
            clear(zonaOps);
            if (tipo === 'ABIERTA') { zonaOps.hidden = true; zonaRub.hidden = false; return; }
            zonaOps.hidden = true; zonaOps.hidden = false; zonaRub.hidden = true;
            if (tipo === 'VERDADERO_FALSO') {
                const v = ops.length === 2 && (ops[0].texto === 'True' || ops[0].texto === 'Verdadero') ? ops : [{ texto: 'True', es_correcta: true }, { texto: 'False', es_correcta: false }];
                ops = v;
            } else {
                if (ops.length < 2 || (ops.length === 2 && (ops[0].texto === 'True' || ops[0].texto === 'Verdadero'))) ops = [{ texto: '', es_correcta: true }, { texto: '', es_correcta: false }, { texto: '', es_correcta: false }, { texto: '', es_correcta: false }];
            }
            zonaOps.appendChild(h('label', {}, tipo === 'VERDADERO_FALSO' ? 'Correct answer' : 'Options (select the correct one)'));
            ops.forEach((o, i) => {
                const radio = h('input', { type: 'radio', name: 'correcta', checked: o.es_correcta, 'aria-label': 'Is correct', onchange: () => { ops.forEach((x, j) => { x.es_correcta = j === i; }); } });
                if (tipo === 'VERDADERO_FALSO') { zonaOps.appendChild(h('label', { class: 'ev-check' }, radio, o.texto)); return; }
                const t = h('input', { class: 'ev-input', type: 'text', maxlength: '1000', placeholder: 'Option ' + String.fromCharCode(65 + i), value: o.texto, oninput: (e) => { o.texto = e.target.value; } });
                const quitar = h('button', { type: 'button', class: 'ev-icon-btn ev-icon-btn--bad', title: 'Remove option', 'aria-label': 'Remove option', disabled: ops.length <= 2, onclick: () => { const eraCorrecta = o.es_correcta; ops.splice(i, 1); if (eraCorrecta) ops[0].es_correcta = true; pintarOpciones(); } }, icon('fa-solid fa-xmark'));
                zonaOps.appendChild(h('div', { class: 'ev-opt-edit' }, radio, t, quitar));
            });
            if (tipo === 'OPCION_MULTIPLE' && ops.length < 6) zonaOps.appendChild(h('button', { type: 'button', class: 'ev-btn ev-btn--sm ev-btn--ghost', style: 'width:fit-content', onclick: () => { ops.push({ texto: '', es_correcta: false }); pintarOpciones(); } }, icon('fa-solid fa-plus'), 'Add option'));
        }
        function pintarTipo() {
            clear(seg);
            Object.entries(TIPOS).forEach(([k, v]) => seg.appendChild(h('button', { type: 'button', 'aria-pressed': String(k === tipo), onclick: () => { if (k !== tipo) { tipo = k; ops = []; pintarTipo(); pintarOpciones(); } } }, v)));
        }
        pintarTipo(); pintarOpciones();

        const guardar = h('button', { type: 'button', class: 'ev-btn ev-btn--dark' }, edit ? 'Save changes' : 'Add question');
        const m = modal({ titulo: edit ? 'Edit question' : 'New question', contenido: h('div', { class: 'ev-form' },
            h('div', { class: 'ev-field' }, h('label', {}, 'Type'), seg),
            h('div', { class: 'ev-field' }, h('label', {}, 'Question statement'), enun),
            zonaOps, zonaRub,
            h('div', { class: 'ev-field' }, h('label', {}, 'Explanation'), expl),
            h('div', { class: 'ev-field', style: 'max-width:200px' }, h('label', {}, 'Points (weight)'), valor, h('span', { class: 'ev-hint' }, 'Relative weight in the final grade.')),
            h('div', { class: 'ev-actions' }, h('button', { type: 'button', class: 'ev-btn ev-btn--soft', onclick: () => m.close() }, 'Cancel'), guardar)) });
        guardar.addEventListener('click', () => ocupado(guardar, async () => {
            if (enun.value.trim().length < 3) return toast('Write the question statement.', 'error');
            if (tipo !== 'ABIERTA' && ops.some((o) => !o.texto.trim())) return toast('Complete the text for all options or remove extra ones.', 'error');
            const cuerpo = {
                tipo_pregunta: tipo, enunciado: enun.value.trim(), valor_pregunta: Number(valor.value) || 1,
                explicacion: expl.value.trim() || null, respuesta_esperada: tipo === 'ABIERTA' ? (rubrica.value.trim() || null) : null,
                opciones: tipo === 'ABIERTA' ? [] : ops.map((o) => ({ texto: o.texto.trim(), es_correcta: !!o.es_correcta })),
            };
            try {
                if (edit) await API.editarPregunta(p.id_pregunta, cuerpo); else await API.crearPregunta(estado.ev.id_evaluacion, cuerpo);
                m.close(); toast(edit ? 'Question updated.' : 'Question added.'); await recargar();
            } catch (e) { EvalUI.error(e); }
        }));
    }

    /* ----------------------------------------------------- modal: generar con IA */
    function modalGenerar() {
        let tipos = new Set(['OPCION_MULTIPLE']);
        let dificultad = 'MEDIA';
        const tema = h('textarea', { class: 'ev-textarea', maxlength: '30000', placeholder: 'Enter a topic or paste context text (optional if selecting evidences). E.g. "Formative assessment strategies in elementary school".' });
        const evidBox = h('div', { class: 'ev-evid' }, h('p', { class: 'ev-hint' }, 'Loading evidences…'));
        const cantidad = h('input', { type: 'number', min: '1', max: '30', value: '5', 'aria-label': 'Number of questions' });
        const stepper = h('div', { class: 'ev-stepper' },
            h('button', { type: 'button', 'aria-label': 'Decrease', onclick: () => { cantidad.value = Math.max(1, (Number(cantidad.value) || 1) - 1); } }, '−'), cantidad,
            h('button', { type: 'button', 'aria-label': 'Increase', onclick: () => { cantidad.value = Math.min(30, (Number(cantidad.value) || 1) + 1); } }, '+'));
        const chips = h('div', { class: 'ev-chips' });
        const pintarChips = () => { clear(chips); Object.entries(TIPOS).forEach(([k, v]) => chips.appendChild(h('button', { type: 'button', class: 'ev-chip', 'aria-pressed': String(tipos.has(k)), onclick: () => { if (tipos.has(k)) { if (tipos.size > 1) tipos.delete(k); } else tipos.add(k); pintarChips(); } }, icon(tipos.has(k) ? 'fa-solid fa-check' : 'fa-regular fa-circle'), v))); };
        pintarChips();
        const seg = h('div', { class: 'ev-seg' });
        const pintarDif = () => { clear(seg); [['FACIL', 'Easy'], ['MEDIA', 'Medium'], ['DIFICIL', 'Hard'], ['MIXTA', 'Mixed']].forEach(([k, v]) => seg.appendChild(h('button', { type: 'button', 'aria-pressed': String(k === dificultad), onclick: () => { dificultad = k; pintarDif(); } }, v))); };
        pintarDif();
        const instr = h('textarea', { class: 'ev-textarea', style: 'height:64px', maxlength: '1000', placeholder: 'Optional. E.g. "Focus on pedagogical reflection" or "application questions, not rote memory".' });
        const valor = h('input', { class: 'ev-input', type: 'number', min: '0.5', max: '100', step: '0.5', value: '1' });
        const generar = h('button', { type: 'button', class: 'ev-btn ev-btn--gold' }, icon('fa-solid fa-wand-magic-sparkles'), 'Generate questions');
        const cuerpo = h('div', { class: 'ev-form' });
        const formulario = h('div', { class: 'ev-form' },
            h('div', { class: 'ev-field' }, h('label', {}, 'Topic or context'), tema),
            h('div', { class: 'ev-field' }, h('label', {}, 'Student evidences as context'), evidBox,
                h('span', { class: 'ev-hint' }, 'Reads evidence text and attached files (PDF, Word, PowerPoint, text, and images).')),
            h('div', { class: 'ev-row' },
                h('div', { class: 'ev-field' }, h('label', {}, 'Number of questions'), stepper),
                h('div', { class: 'ev-field' }, h('label', {}, 'Points per question'), valor)),
            h('div', { class: 'ev-field' }, h('label', {}, 'Question types'), chips),
            h('div', { class: 'ev-field' }, h('label', {}, 'Difficulty'), seg),
            h('div', { class: 'ev-field' }, h('label', {}, 'Additional instructions'), instr),
            h('p', { class: 'ev-hint' }, 'Generated questions remain as "To review": you decide which to approve before publishing.'),
            h('div', { class: 'ev-actions' }, h('button', { type: 'button', class: 'ev-btn ev-btn--soft', onclick: () => m.close() }, 'Cancel'), generar));
        cuerpo.appendChild(formulario);
        const m = modal({ titulo: 'Generate questions with AI', ancho: 680, contenido: cuerpo });

        // evidencias
        const MAX_EVIDENCIAS = 3;
        API.listarEvidencias(PRACTICA).then((lista) => {
            clear(evidBox);
            if (!lista.length) return evidBox.appendChild(h('p', { class: 'ev-hint' }, 'This practice does not have any evidences yet.'));

            const contadorEl = h('div', { class: 'ev-hint', style: 'margin-bottom:6px;font-weight:600' }, `Select up to ${MAX_EVIDENCIAS} evidences (0/${MAX_EVIDENCIAS}):`);
            evidBox.appendChild(contadorEl);

            const actualizarLimite = () => {
                const checked = $$checks(evidBox);
                contadorEl.textContent = `Select up to ${MAX_EVIDENCIAS} evidences (${checked.length}/${MAX_EVIDENCIAS}):`;
                const inputs = evidBox.querySelectorAll('input[type=checkbox]');
                inputs.forEach((input) => {
                    if (!input.checked) {
                        input.disabled = checked.length >= MAX_EVIDENCIAS;
                    }
                });
            };

            lista.forEach((e, i) => {
                const nombreLimpio = (e.descripcion && e.descripcion.trim()) || `Evidence ${i + 1}`;
                const check = h('input', {
                    type: 'checkbox',
                    value: e.id_evidencia,
                    'data-nombre': nombreLimpio,
                    onchange: () => {
                        const checked = $$checks(evidBox);
                        if (checked.length > MAX_EVIDENCIAS) {
                            check.checked = false;
                            toast(`Maximum ${MAX_EVIDENCIAS} evidences as context to optimize generation.`, 'aviso');
                        }
                        actualizarLimite();
                    }
                });

                const subtitulo = [
                    e.nombre_actividad && e.nombre_actividad.toLowerCase() !== 'activity' ? e.nombre_actividad : null,
                    e.horas_realizadas ? e.horas_realizadas + ' h' : null,
                    e.archivos && e.archivos.length ? (e.archivos.map((a) => a.nombre).join(', ') || plural(e.archivos.length, 'file', 'files')) : null,
                ].filter(Boolean).join(' · ');

                evidBox.appendChild(h('label', {}, check,
                    h('span', {}, nombreLimpio, subtitulo ? h('small', {}, subtitulo) : null)));
            });
        }).catch((e) => { clear(evidBox); evidBox.appendChild(h('p', { class: 'ev-hint' }, 'Could not load evidences: ' + e.message)); });

        generar.addEventListener('click', async () => {
            const fuentes = [];
            if (tema.value.trim()) fuentes.push({ tipo: 'TEMA_LIBRE', texto: tema.value.trim() });
            const checksEv = $$checks(evidBox);
            if (checksEv.length > MAX_EVIDENCIAS) return toast(`You can select at most ${MAX_EVIDENCIAS} evidences as context.`, 'error');
            checksEv.forEach((c) => fuentes.push({ tipo: 'EVIDENCIA', id_referencia: c.value, nombre: c.dataset.nombre }));
            if (!fuentes.length) return toast('Enter a topic or select at least one evidence.', 'error');
            if (tema.value.trim() && tema.value.trim().length < 10) return toast('The topic is too short: describe a bit more.', 'error');
            const cant = Math.min(30, Math.max(1, Number(cantidad.value) || 1));
            clear(cuerpo).appendChild(h('div', { class: 'ev-generando', role: 'status' }, icon('fa-solid fa-wand-magic-sparkles fa-beat'),
                h('p', {}, 'Reading content and drafting ' + plural(cant, 'question', 'questions') + '…'), h('p', { class: 'ev-hint' }, 'This may take up to a minute. Do not close this window.')));
            try {
                const r = await API.generar(estado.ev.id_evaluacion, { fuentes, cantidad: cant, tipos: [...tipos], dificultad, instrucciones: instr.value.trim() || null, valor_por_pregunta: Number(valor.value) || 1 });
                m.close();
                toast(`Generated ${plural(r.cantidad_generada, 'question', 'questions')}. Review and approve them.`);
                (r.advertencias || []).forEach((a) => toast(a, 'aviso'));
                await recargar();
            } catch (e) {
                clear(cuerpo).appendChild(formulario); EvalUI.error(e);
            }
        });
    }
    const $$checks = (box) => Array.from(box.querySelectorAll('input[type=checkbox]:checked'));

    /* ============================================================== RESULTADOS */
    async function cargarResultados() {
        const cont = clear($('#tabpanel-resultados'));
        cont.appendChild(h('p', { class: 'ev-loading' }, 'Loading…'));
        try {
            const lista = await API.listarIntentos(estado.ev.id_evaluacion);
            clear(cont);
            if (!lista.length) return cont.appendChild(h('div', { class: 'ev-empty' }, icon('fa-regular fa-hourglass-half'), 'No one has taken this evaluation yet.'));
            const filas = lista.map((i) => {
                const btnVer = h('button', {
                    type: 'button',
                    class: 'ev-btn ev-btn--sm ev-btn--dark',
                    disabled: i.estado === 'EN_CURSO'
                }, 'View and grade');
                btnVer.addEventListener('click', () => ocupado(btnVer, async () => {
                    await abrirIntento(i.id_intento);
                }, 'Loading…'));
                return h('tr', {},
                    h('td', {}, 'Attempt ' + i.numero_intento),
                    h('td', {}, badge(i.estado, i.estado === 'ENVIADO' ? plural(i.respuestas_pendientes, 'to grade', 'to grade') : null)),
                    h('td', {}, i.fecha_inicio ? fecha(i.fecha_inicio) : '—'),
                    h('td', {}, i.fecha_envio ? fecha(i.fecha_envio) : 'In progress'),
                    h('td', {}, h('b', {}, nota(i.nota_obtenida)), ' / ' + estado.ev.nota_maxima),
                    h('td', {}, btnVer));
            });
            cont.appendChild(h('table', { class: 'ev-table' }, h('thead', {}, h('tr', {}, ['Attempt', 'Status', 'Started', 'Submitted', 'Grade', ''].map((t) => h('th', {}, t)))), h('tbody', {}, filas)));
        } catch (e) { clear(cont).appendChild(h('div', { class: 'ev-empty' }, icon('fa-solid fa-plug-circle-xmark'), e.message)); }
    }
    $('#btn-volver-editor').addEventListener('click', () => { ver('editor'); estado.tab = 'resultados'; recargar(); });

    async function abrirIntento(id) {
        try { renderIntento(await API.verIntento(id)); ver('intento'); } catch (e) { EvalUI.error(e); }
    }
    function renderIntento(it) {
        const nombre = ESTUDIANTE ? ESTUDIANTE : `Student #${it.id_estudiante}`;
        $('#intento-title').textContent = `${nombre} · attempt ${it.numero_intento}`;
        const bs = clear($('#intento-badges'));
        EvalUI.add(bs,
            badge(it.estado),
            h('span', { class: 'ev-badge' }, icon('fa-regular fa-star'), `Grade ${nota(it.nota_obtenida)} / ${it.nota_maxima}`),
            it.fecha_envio ? h('span', { class: 'ev-badge' }, icon('fa-regular fa-clock'), 'Submitted: ' + fecha(it.fecha_envio)) : h('span', { class: 'ev-badge' }, icon('fa-solid fa-hourglass-half'), 'In progress'),
            it.fecha_inicio ? h('span', { class: 'ev-badge' }, icon('fa-regular fa-calendar'), 'Started: ' + fecha(it.fecha_inicio)) : null
        );
        const cont = clear($('#intento-contenido'));
        it.respuestas.forEach((r, n) => cont.appendChild(filaRespuesta(it, r, n + 1)));
    }
    function filaRespuesta(it, r, n) {
        const abierta = r.tipo_pregunta === 'ABIERTA';
        const valorNota = Number(r.nota_obtenida !== null && r.nota_obtenida !== undefined ? r.nota_obtenida : 0);
        const esCero = valorNota <= 0;
        const clase = r.pendiente ? '' : (!esCero && r.es_correcta === true ? ' ev-ans--ok' : (esCero || r.es_correcta === false ? ' ev-ans--bad' : ''));
        const badgeNota = r.pendiente
            ? badge('ENVIADO', 'To grade')
            : h('span', { class: 'ev-badge ' + (esCero ? 'ev-badge--score-zero' : 'ev-badge--score-ok') },
                h('b', { style: esCero ? 'color: #dc2626;' : 'color: #15803d;' }, nota(r.nota_obtenida)),
                ` / ${r.valor_pregunta}`);

        const caja = h('article', { class: 'ev-q' },
            h('div', { class: 'ev-q-top' },
                h('span', { class: 'ev-q-num' }, 'Question ' + n),
                h('span', { class: 'ev-badge' }, TIPOS[r.tipo_pregunta]),
                h('span', { class: 'ev-badge' }, 'Points ' + r.valor_pregunta),
                badgeNota),
            h('div', { class: 'ev-q-text' }, r.enunciado),
            h('div', { class: 'ev-ans' + clase }, r.respuesta && r.respuesta.trim() ? r.respuesta : '(unanswered)'));
        if (!abierta && r.es_correcta === false && r.opcion_correcta) caja.appendChild(h('div', { class: 'ev-q-note' }, h('b', {}, 'Correct answer: '), r.opcion_correcta));
        if (abierta && r.respuesta_esperada) caja.appendChild(h('div', { class: 'ev-q-note' }, h('b', {}, 'Grading criteria: '), r.respuesta_esperada));
        (r.retros || []).forEach((x) => caja.appendChild(h('div', { class: 'ev-retro' }, x.comentario)));
        if (r.id_respuesta) {
            const com = h('input', { class: 'ev-input', type: 'text', maxlength: '4000', placeholder: abierta ? 'Feedback for the student (optional)' : 'Add a comment for the student' });
            if (abierta) {
                const val = h('input', { class: 'ev-input', type: 'number', min: '0', max: r.valor_pregunta, step: '0.25', value: r.nota_obtenida === null ? '' : r.nota_obtenida });
                const b = h('button', { type: 'button', class: 'ev-btn ev-btn--sm ev-btn--primary' }, icon('fa-solid fa-floppy-disk'), r.pendiente ? 'Grade' : 'Update grade');
                b.addEventListener('click', () => ocupado(b, async () => {
                    if (val.value === '') return toast('Enter the score for this question.', 'error');
                    try { renderIntento(await API.calificar(r.id_respuesta, { nota_obtenida: Number(val.value), comentario: com.value.trim() || null })); toast('Grade saved.'); } catch (e) { EvalUI.error(e); }
                }));
                caja.appendChild(h('div', { class: 'ev-grade' }, h('div', { class: 'ev-field', style: 'max-width:160px;flex:none' }, h('label', {}, `Score (0 – ${r.valor_pregunta})`), val), h('div', { class: 'ev-field' }, h('label', {}, 'Comment'), com), b));
            } else {
                const b = h('button', { type: 'button', class: 'ev-btn ev-btn--sm ev-btn--dark' }, 'Comment');
                b.addEventListener('click', () => ocupado(b, async () => {
                    if (!com.value.trim()) return toast('Enter the comment.', 'error');
                    try { renderIntento(await API.comentar(r.id_respuesta, com.value.trim())); toast('Comment submitted.'); } catch (e) { EvalUI.error(e); }
                }));
                caja.appendChild(h('div', { class: 'ev-grade' }, h('div', { class: 'ev-field' }, com), b));
            }
        }
        return caja;
    }

    // Si NO está gestionado por SPP_TEACHER / tutor.js, enlazar clics de apertura para evitar listeners duplicados
    if (!window.SPP_TEACHER) {
        const btnPreguntas = document.getElementById('preguntas-preguntas-btn');
        if (btnPreguntas) {
            btnPreguntas.addEventListener('click', () => {
                resolverPractica().catch(() => {}).then(() => {
                    ver('lista');
                    cargarLista();
                });
            });
        }

        const qCardTutor = document.getElementById('lb-card-questions') || document.getElementById('lb-card-tutor-questions');
        if (qCardTutor) {
            qCardTutor.addEventListener('click', (e) => {
                if (!e.target.closest('#preguntas-preguntas-btn') && !e.target.closest('.lb-action-btn')) {
                    resolverPractica().catch(() => {}).then(() => {
                        ver('lista');
                        cargarLista();
                    });
                }
            });
        }
    }

    const btnQuestionsBack = document.getElementById('questionsBack');
    if (btnQuestionsBack) {
        btnQuestionsBack.addEventListener('click', () => {
            ver('lista');
            window.SPP_TEACHER?.updateQuestionsPill?.(null, true);
        });
    }

    // Escuchar cambio de práctica activa en el panel tutor
    document.addEventListener('spp:practice', (e) => {
        const p = e.detail;
        if (p && (p.id || p.code)) {
            PRACTICA = String(p.id || p.code || '');
            ESTUDIANTE = String(p.student || p.studentName || '');
            const ctxEl = $('#lista-contexto');
            if (ctxEl) ctxEl.textContent = ESTUDIANTE ? ESTUDIANTE : '';
            const qPanel = document.getElementById('questions-panel');
            if (qPanel && qPanel.style.display !== 'none' && !qPanel.hidden) {
                cargarLista();
            }
        }
    });

    window.SPP_EVAL_TUTOR = {
        abrir: () => {
            resolverPractica().catch(() => {}).then(() => {
                ver('lista');
                cargarLista();
            });
        },
        volverALista: () => {
            ver('lista');
        },
        recargar: () => {
            cargarLista();
        }
    };

    // Solo cargar la lista al inicio si el panel de preguntas ya está visible
    const qPanel = document.getElementById('questions-panel');
    if (!qPanel || (qPanel.style.display !== 'none' && !qPanel.hidden)) {
        resolverPractica().catch(() => {}).then(cargarLista);
    }
});
