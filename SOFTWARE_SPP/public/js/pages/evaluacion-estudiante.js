/* global EvalUI, EvalAPI */
/* =========================================================================
   evaluacion-estudiante.js — Pantalla del estudiante: ver evaluaciones asignadas,
   presentarlas pregunta por pregunta (autoguardado) y ver el resultado.
   Habla solo con window.EvalAPI.
   ========================================================================= */
document.addEventListener('DOMContentLoaded', () => {
    'use strict';
    if (!document.getElementById('view-lista') && !document.getElementById('lista-contenido')) return;

    const { h, icon, $, clear, toast, modal, confirmar, ocupado, badge, nota, fecha, plural, TIPOS } = EvalUI;
    const API = EvalAPI.estudiante;
    EvalUI.habilitarEnlacesExternos();

    const vistas = { lista: $('#view-lista'), quiz: $('#view-quiz'), resultado: $('#view-resultado') };
    function ver(n) {
        Object.entries(vistas).forEach(([k, el]) => { if (el) el.hidden = k !== n; });
        window.scrollTo(0, 0); const s = $('.app-shell'); if (s) s.scrollTop = 0; const w = $('.ev-wrapper'); if (w) w.scrollTop = 0;
    }

    /* ================================================================= LISTA */
    async function cargarLista() {
        const cont = clear($('#lista-contenido'));
        cont.appendChild(h('p', { class: 'ev-loading' }, 'Loading…'));
        try {
            const lista = await API.misEvaluaciones();
            clear(cont);
            if (!lista.length) return cont.appendChild(h('div', { class: 'ev-empty' }, icon('fa-regular fa-face-smile'), 'You do not have any assigned evaluations yet.'));
            lista.forEach((ev) => cont.appendChild(tarjeta(ev)));
        } catch (e) {
            clear(cont).appendChild(h('div', { class: 'ev-empty' }, icon('fa-solid fa-plug-circle-xmark'), e.message,
                h('div', { style: 'margin-top:16px' }, h('button', { type: 'button', class: 'ev-btn ev-btn--dark', onclick: cargarLista }, icon('fa-solid fa-rotate'), 'Retry'))));
        }
    }
    function tarjeta(ev) {
        const abierto = ev.id_intento_abierto !== null;
        const vencida = (() => {
            if (!ev.fecha_limite) return false;
            const lim = new Date(ev.fecha_limite).getTime();
            // Dar el minuto completo (hasta :59) + 60s de margen por desfase de reloj/segundos y red
            const finValido = lim + 59999 + 60000;
            return Date.now() > finValido;
        })();
        let accion;
        if (abierto) accion = ['Continue', 'fa-solid fa-play', 'ev-btn--gold', () => iniciar(ev.id_evaluacion)];
        else if (ev.puede_intentar) accion = [ev.intentos_usados ? 'New attempt' : 'Start', 'fa-solid fa-play', 'ev-btn--primary', () => confirmarInicio(ev)];
        const verRes = ev.id_ultimo_intento && !ev.puede_intentar && !abierto
            ? ['View result', 'fa-solid fa-chart-simple', 'ev-btn--dark', () => abrirResultado(ev.id_ultimo_intento)]
            : (vencida && !abierto && !ev.puede_intentar ? ['View questions', 'fa-solid fa-eye', 'ev-btn--dark', () => iniciar(ev.id_evaluacion)] : null);
        const estadoTxt = abierto ? badge('EN_CURSO') : (ev.ultimo_intento_estado && !ev.puede_intentar ? badge(ev.ultimo_intento_estado) : ev.estado === 'CERRADA' ? badge('CERRADA') : (vencida && !ev.puede_intentar ? badge('VENCIDA') : null));

        const abrirTarjeta = () => {
            if (abierto) {
                iniciar(ev.id_evaluacion);
            } else if (ev.puede_intentar) {
                confirmarInicio(ev);
            } else if (ev.id_ultimo_intento) {
                abrirResultado(ev.id_ultimo_intento);
            } else if (vencida) {
                iniciar(ev.id_evaluacion);
            }
        };

        const esClickeable = abierto || ev.puede_intentar || Boolean(ev.id_ultimo_intento) || vencida;

        return h('div', {
            class: 'ev-card',
            role: esClickeable ? 'button' : undefined,
            tabindex: esClickeable ? '0' : undefined,
            style: esClickeable ? 'cursor: pointer;' : undefined,
            onclick: esClickeable ? abrirTarjeta : undefined,
            onkeydown: esClickeable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirTarjeta(); } } : undefined
        },
            h('div', { class: 'ev-card-icon' }, icon('fa-solid fa-circle-question')),
            h('div', { class: 'ev-card-body' },
                h('div', { class: 'ev-card-title' }, ev.titulo),
                ev.descripcion ? h('p', { class: 'ev-sub' }, ev.descripcion) : null,
                h('div', { class: 'ev-badges', style: 'margin-top:8px' }, estadoTxt),
                h('div', { class: 'ev-card-meta' },
                    h('span', {}, icon('fa-regular fa-circle-question'), plural(ev.total_preguntas, 'question', 'questions')),
                    h('span', {}, icon('fa-solid fa-rotate-right'), `Attempts: ${ev.intentos_usados ?? 0} of ${ev.intentos_permitidos}`),
                    ev.fecha_limite ? h('span', {}, icon('fa-regular fa-calendar'), 'Deadline: ' + fecha(ev.fecha_limite)) : h('span', {}, icon('fa-regular fa-calendar'), 'No deadline'))),
            ev.nota_final !== null && !abierto && !ev.puede_intentar ? h('div', { class: 'ev-nota' }, nota(ev.nota_final), h('small', {}, 'of ' + ev.nota_maxima)) : null,
            h('div', { class: 'ev-toolbar', onclick: (e) => e.stopPropagation() },
                verRes && !abierto && !ev.puede_intentar ? btn(...verRes) : null,
                accion ? btn(...accion) : null
            )
        );
    }
    function btn(txt, ic, cls, fn) { const b = h('button', { type: 'button', class: 'ev-btn ev-btn--sm ' + cls }, icon(ic), txt); b.addEventListener('click', () => ocupado(b, fn)); return b; }
    async function confirmarInicio(ev) {
        const ok = await confirmar({ titulo: ev.titulo, ok: 'Start', mensaje: `You have ${plural(ev.total_preguntas, 'question', 'questions')}. Your answers are saved automatically and you can leave and continue later; only what you submit at the end will count.` + (ev.fecha_limite ? ` Remember: the deadline is ${fecha(ev.fecha_limite)}.` : '') });
        if (ok) await iniciar(ev.id_evaluacion);
    }
    async function iniciar(id) {
        ver('quiz');
        const cont = clear($('#quiz-contenido'));
        if (cont) cont.appendChild(h('p', { class: 'ev-loading' }, 'Loading questions…'));
        try {
            const it = await API.iniciarIntento(id);
            if (it.estado === 'EN_CURSO') abrirQuiz(it); else mostrarResultado(it);
        } catch (e) {
            ver('lista');
            const msg = e.message || '';
            const isDeadlineExpired = e.status === 409 && (
                msg.includes('fecha límite') || msg.includes('expirado') || msg.includes('venció') ||
                msg.includes('comunícate con tu tutor') || msg.toLowerCase().includes('deadline') ||
                msg.toLowerCase().includes('expired')
            );
            if (isDeadlineExpired) {
                modal({
                    titulo: 'Deadline expired',
                    cuerpo: h('p', { style: 'font-size:15px;line-height:1.5;margin:0;color:var(--text, #1f2937);' },
                        'The deadline for this evaluation has expired. Please contact your tutor to enable it again.'
                    ),
                    botones: [
                        h('button', {
                            type: 'button',
                            class: 'ev-btn ev-btn--dark',
                            onclick: (evBtn, close) => {
                                close();
                                cargarLista();
                            }
                        }, 'Understood')
                    ]
                });
            } else {
                EvalUI.error(e);
                cargarLista();
            }
        }
    }
    async function abrirResultado(id) {
        ver('resultado');
        const cont = clear($('#resultado-contenido'));
        if (cont) cont.appendChild(h('p', { class: 'ev-loading' }, 'Loading result…'));
        try {
            mostrarResultado(await API.verIntento(id));
        } catch (e) {
            ver('lista');
            EvalUI.error(e);
        }
    }

    /* ================================================================== QUIZ */
    let Q = null;   // { it, idx, resp: {id_pregunta: {id_opcion, respuesta}}, timers }
    function abrirQuiz(it) {
        Q = { it, idx: 0, resp: {}, timers: {}, pendientesGuardar: new Set() };
        it.respuestas.forEach((r) => { Q.resp[r.id_pregunta] = { id_opcion: r.id_opcion, respuesta: r.respuesta }; });
        const primera = it.preguntas.findIndex((p) => !contestada(p));
        Q.idx = primera === -1 ? 0 : primera;
        ver('quiz'); pintarQuiz();
    }
    const contestada = (p) => { const r = Q.resp[p.id_pregunta]; return !!r && (p.tipo_pregunta === 'ABIERTA' ? !!(r.respuesta && r.respuesta.trim()) : r.id_opcion !== null && r.id_opcion !== undefined); };

    function pintarQuiz() {
        const it = Q.it, total = it.preguntas.length, p = it.preguntas[Q.idx];
        const hechas = it.preguntas.filter(contestada).length;
        const cont = clear($('#quiz-contenido'));

        const progreso = h('div', { class: 'qz-progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(total), 'aria-valuenow': String(hechas) }, h('span', { style: `width:${total ? hechas / total * 100 : 0}%` }));
        const dots = h('div', { class: 'qz-dots', role: 'group', 'aria-label': 'Go to a question' }, it.preguntas.map((q, i) =>
            h('button', { type: 'button', class: 'qz-dot' + (contestada(q) ? ' is-done' : '') + (i === Q.idx ? ' is-now' : ''), 'aria-label': `Question ${i + 1}${contestada(q) ? ' (answered)' : ''}`, 'aria-current': i === Q.idx ? 'step' : null, onclick: () => ir(i) }, String(i + 1))));

        const tarjeta = h('div', { class: 'qz-card' },
            h('div', { class: 'qz-meta' }, h('span', { class: 'ev-badge' }, TIPOS[p.tipo_pregunta]), h('span', { class: 'ev-badge' }, icon('fa-regular fa-star'), `Worth ${p.valor_pregunta}`)),
            h('div', { class: 'qz-q', id: 'qz-enunciado' }, p.enunciado));
        const actual = Q.resp[p.id_pregunta] || {};
        if (p.tipo_pregunta === 'ABIERTA') {
            const ta = h('textarea', { class: 'ev-textarea', maxlength: '10000', 'aria-labelledby': 'qz-enunciado', placeholder: 'Write your answer here…' }, actual.respuesta || '');
            ta.addEventListener('input', () => { Q.resp[p.id_pregunta] = { id_opcion: null, respuesta: ta.value }; programarGuardado(p.id_pregunta); actualizarProgresoSuave(); });
            ta.addEventListener('blur', () => guardarYa(p.id_pregunta));
            tarjeta.appendChild(h('div', { class: 'qz-open' }, ta));
        } else {
            const vf = p.tipo_pregunta === 'VERDADERO_FALSO';
            tarjeta.appendChild(h('div', { class: 'qz-opts' + (vf ? ' qz-opts--vf' : ''), role: 'group', 'aria-labelledby': 'qz-enunciado' }, p.opciones.map((o, i) =>
                h('button', { type: 'button', class: 'qz-opt', 'aria-pressed': String(actual.id_opcion === o.id_opcion), onclick: () => elegir(p, o) },
                    vf ? null : h('span', { class: 'qz-opt-letter' }, String.fromCharCode(65 + i)), h('span', {}, o.texto)))));
        }

        const ultima = Q.idx === total - 1;
        const enviar = h('button', { type: 'button', class: 'ev-btn ev-btn--gold' }, icon('fa-solid fa-paper-plane'), 'Submit evaluation');
        enviar.addEventListener('click', () => ocupado(enviar, enviarTodo));
        EvalUI.add(cont, 
            h('div', { class: 'qz-top' }, h('button', { type: 'button', class: 'ev-btn ev-btn--sm ev-btn--ghost', onclick: salirDelQuiz }, icon('fa-solid fa-arrow-left'), 'Exit'),
                h('div', { class: 'qz-title' }, it.titulo), h('span', { class: 'qz-count' }, `Question ${Q.idx + 1} of ${total} · ${hechas} answered`)),
            progreso, dots, tarjeta,
            h('div', { class: 'qz-save', id: 'qz-save', 'aria-live': 'polite' }, ''),
            h('div', { class: 'qz-nav' },
                h('button', { type: 'button', class: 'ev-btn ev-btn--soft', disabled: Q.idx === 0, onclick: () => ir(Q.idx - 1) }, icon('fa-solid fa-arrow-left'), 'Previous'),
                ultima ? enviar : h('button', { type: 'button', class: 'ev-btn ev-btn--dark', onclick: () => ir(Q.idx + 1) }, 'Next', icon('fa-solid fa-arrow-right'))));
    }
    function actualizarProgresoSuave() {
        const total = Q.it.preguntas.length, hechas = Q.it.preguntas.filter(contestada).length;
        const bar = $('.qz-progress > span'); if (bar) bar.style.width = (total ? hechas / total * 100 : 0) + '%';
        const dots = document.querySelectorAll('.qz-dot'); Q.it.preguntas.forEach((q, i) => { if (dots[i]) dots[i].classList.toggle('is-done', contestada(q)); });
        const c = $('.qz-count'); if (c) c.textContent = `Question ${Q.idx + 1} of ${total} · ${hechas} answered`;
    }
    function estadoGuardado(t) { const el = $('#qz-save'); if (el) el.textContent = t; }

    function elegir(p, o) {
        Q.resp[p.id_pregunta] = { id_opcion: o.id_opcion, respuesta: o.texto };
        document.querySelectorAll('.qz-opt').forEach((b, i) => b.setAttribute('aria-pressed', String(p.opciones[i].id_opcion === o.id_opcion)));
        actualizarProgresoSuave();
        guardarYa(p.id_pregunta);
    }
    function programarGuardado(id) { clearTimeout(Q.timers[id]); estadoGuardado('Typing…'); Q.timers[id] = setTimeout(() => guardarYa(id), 900); }
    async function guardarYa(id) {
        clearTimeout(Q.timers[id]); delete Q.timers[id];
        const r = Q.resp[id]; if (!r) return;
        const intento = Q.it.id_intento;
        Q.pendientesGuardar.add(id); estadoGuardado('Saving…');
        try { await API.guardarRespuesta(intento, id, { id_opcion: r.id_opcion ?? null, respuesta: r.respuesta ?? null }); estadoGuardado('Saved ✓'); }
        catch (e) {
            estadoGuardado('Could not save');
            toast(e.message, 'error');
            if (e.status === 409) { Q = null; ver('lista'); cargarLista(); }
        } finally { if (Q) Q.pendientesGuardar.delete(id); }
    }
    async function guardarTodoPendiente() {
        if (!Q) return;
        const ids = Object.keys(Q.timers).filter((k) => Q.timers[k]);
        for (const k of Q.it.preguntas.map((p) => p.id_pregunta)) { if (Q.timers[k]) await guardarYa(k); }
        while (Q && Q.pendientesGuardar.size) await new Promise((r) => setTimeout(r, 60));
        return ids;
    }
    async function ir(i) { if (!Q) return; await guardarTodoPendiente(); if (!Q) return; Q.idx = Math.max(0, Math.min(Q.it.preguntas.length - 1, i)); pintarQuiz(); window.scrollTo(0, 0); }
    async function salirDelQuiz() { await guardarTodoPendiente(); Q = null; ver('lista'); cargarLista(); toast('Your progress has been saved. You can continue whenever you want.'); window.updateStudentQuestionsPill?.(); }

    async function enviarTodo() {
        await guardarTodoPendiente();
        if (!Q) return;
        const sin = Q.it.preguntas.filter((p) => !contestada(p)).length;
        const ok = await confirmar({ titulo: 'Submit evaluation', ok: 'Submit', mensaje: (sin ? `You have ${plural(sin, 'unanswered question', 'unanswered questions')} left (they will count as 0). ` : '') + 'Once submitted, you will not be able to change your answers. Submit now?' });
        if (!ok) return;
        try {
            const it = await API.enviarIntento(Q.it.id_intento);
            Q = null;
            mostrarResultado(it);
            toast('Evaluation submitted.');
            window.updateStudentQuestionsPill?.();
        } catch (e) {
            const msg = e.message || '';
            const isDeadlineExpired = e.status === 409 && (
                msg.includes('fecha límite') || msg.includes('expirado') || msg.includes('venció') ||
                msg.includes('comunícate con tu tutor') || msg.toLowerCase().includes('deadline') ||
                msg.toLowerCase().includes('expired')
            );
            if (isDeadlineExpired) {
                modal({
                    titulo: 'Deadline expired',
                    cuerpo: h('p', { style: 'font-size:15px;line-height:1.5;margin:0;color:var(--text, #1f2937);' },
                        'The deadline for this evaluation has expired. Please contact your tutor to enable it again.'
                    ),
                    botones: [
                        h('button', {
                            type: 'button',
                            class: 'ev-btn ev-btn--dark',
                            onclick: (evBtn, close) => {
                                close();
                                Q = null;
                                ver('lista');
                                cargarLista();
                                window.updateStudentQuestionsPill?.();
                            }
                        }, 'Understood')
                    ]
                });
            } else {
                EvalUI.error(e);
                if (e.status === 409) {
                    Q = null;
                    ver('lista');
                    cargarLista();
                    window.updateStudentQuestionsPill?.();
                }
            }
        }
    }

    /* ============================================================== RESULTADO */
    function mostrarResultado(it) {
        ver('resultado');
        const cont = clear($('#resultado-contenido'));
        const calificado = it.estado === 'CALIFICADO';
        const pendientes = it.respuestas.filter((r) => r.pendiente_revision).length;
        cont.appendChild(h('div', { class: 'qz-card qz-result' },
            h('h2', { class: 'ev-section-title', style: 'font-size:22px' }, it.titulo),
            calificado
                ? h('div', {},
                    h('div', { class: 'qz-score' }, nota(it.nota_obtenida), h('small', {}, ' / ' + it.nota_maxima)),
                    h('p', { class: 'ev-sub', style: 'margin-top:10px' },
                        !it.fecha_envio || it.numero_intento === 0
                            ? '0 attempts'
                            : `Attempt ${it.numero_intento} · submitted ${fecha(it.fecha_envio)}`
                    )
                  )
                : h('div', {}, h('div', { class: 'ev-badges', style: 'justify-content:center' }, badge('ENVIADO')),
                    h('p', { class: 'ev-sub', style: 'margin-top:12px;font-size:16px' }, `Your tutor is reviewing ${plural(pendientes, 'open response', 'open responses')}. Once completed, your grade will appear here.`)),
            h('div', { class: 'ev-actions', style: 'justify-content:center' }, h('button', { type: 'button', class: 'ev-btn ev-btn--dark', onclick: () => { ver('lista'); cargarLista(); } }, icon('fa-solid fa-arrow-left'), 'Back to my evaluations'))));

        const revision = h('div', { class: 'qz-review' });
        it.preguntas.forEach((p, n) => {
            const r = it.respuestas.find((x) => x.id_pregunta === p.id_pregunta) || {};
            const respondida = p.tipo_pregunta === 'ABIERTA'
                ? Boolean(r.respuesta && r.respuesta.trim())
                : (r.id_opcion !== null && r.id_opcion !== undefined);

            const valorNota = Number(r.nota_obtenida !== null && r.nota_obtenida !== undefined ? r.nota_obtenida : 0);
            const tieneNota = it.resultados_visibles && r.nota_obtenida !== null && r.nota_obtenida !== undefined;
            const esCero = valorNota <= 0;
            const esMal = !respondida || r.es_correcta === false || (tieneNota && !r.pendiente_revision && esCero);
            const esBien = respondida && r.es_correcta === true && !esCero;

            const badgeNota = tieneNota
                ? h('span', { class: 'ev-badge ' + (esCero || r.es_correcta === false ? 'ev-badge--rechazada ev-badge--score-zero' : 'ev-badge--calificado ev-badge--score-ok') },
                    h('b', { style: (esCero || r.es_correcta === false) ? 'color: #dc2626;' : 'color: #15803d;' }, nota(r.nota_obtenida)),
                    ` / ${p.valor_pregunta}`)
                : null;

            const tarj = h('article', { class: 'ev-q' },
                h('div', { class: 'ev-q-top' },
                    h('span', { class: 'ev-q-num' }, 'Question ' + (n + 1)),
                    h('span', { class: 'ev-badge' }, TIPOS[p.tipo_pregunta]),
                    badgeNota,
                    r.pendiente_revision ? badge('ENVIADO', 'To grade') : null),
                h('div', { class: 'ev-q-text' }, p.enunciado));

            if (p.tipo_pregunta === 'ABIERTA') {
                const ansClase = !respondida || (tieneNota && !r.pendiente_revision && esMal)
                    ? ' ev-ans--bad'
                    : (tieneNota && !r.pendiente_revision && esBien ? ' ev-ans--ok' : '');
                tarj.appendChild(h('div', { class: 'ev-ans' + ansClase }, respondida ? r.respuesta : '(unanswered)'));
                if (p.respuesta_esperada) tarj.appendChild(h('div', { class: 'ev-q-note' }, h('b', {}, 'Grading criteria: '), p.respuesta_esperada));
            } else if (it.resultados_visibles) {
                if (!respondida) {
                    tarj.appendChild(h('div', { class: 'ev-ans ev-ans--bad' }, '(unanswered)'));
                }
                tarj.appendChild(h('ul', { class: 'ev-q-opts' }, p.opciones.map((o) => {
                    const mia = r.id_opcion === o.id_opcion;
                    return h('li', { class: o.es_correcta ? 'is-ok' : (mia ? 'ev-ans--bad' : '') }, icon(o.es_correcta ? 'fa-solid fa-circle-check' : mia ? 'fa-solid fa-circle-xmark' : 'fa-regular fa-circle'), o.texto, mia ? h('b', {}, ' ← your answer') : null);
                })));
            } else {
                const ansClase = !respondida ? ' ev-ans--bad' : '';
                tarj.appendChild(h('div', { class: 'ev-ans' + ansClase }, r.respuesta || '(unanswered)'));
            }
            if (p.explicacion) tarj.appendChild(h('div', { class: 'ev-q-note' }, h('b', {}, 'Explanation: '), p.explicacion));
            (r.retroalimentacion || []).forEach((t) => tarj.appendChild(h('div', { class: 'ev-retro' }, h('b', {}, 'Your tutor: '), t)));
            revision.appendChild(tarj);
        });
        EvalUI.add(cont, h('h3', { class: 'ev-section-title' }, it.resultados_visibles ? 'Review of your answers' : 'Your answers'), revision);
    }

    // Si el estudiante cierra la pestaña a mitad de una pregunta abierta, se intenta guardar lo pendiente.
    window.addEventListener('pagehide', () => { if (Q) Object.keys(Q.timers).forEach((k) => { if (Q.timers[k]) guardarYa(k); }); });

    // Si está integrado en student.html, recarga la lista al entrar a la sección de preguntas
    const btnQuestions = document.getElementById('questions-btn');
    if (btnQuestions) {
        btnQuestions.addEventListener('click', () => {
            ver('lista');
            cargarLista();
        });
    }

    const qCardStudent = document.getElementById('lb-card-questions');
    if (qCardStudent) {
        qCardStudent.addEventListener('click', (e) => {
            if (!e.target.closest('#questions-btn') && !e.target.closest('.lb-action-btn')) {
                ver('lista');
                cargarLista();
            }
        });
    }

    const btnQuestionsBack = document.getElementById('questionsBack');
    if (btnQuestionsBack) {
        btnQuestionsBack.addEventListener('click', () => {
            ver('lista');
            window.updateStudentQuestionsPill?.();
        });
    }

    window.SPP_EVAL_ESTUDIANTE = {
        abrir: () => {
            ver('lista');
            cargarLista();
        },
        volverALista: () => {
            ver('lista');
        },
        recargar: () => {
            cargarLista();
        }
    };

    cargarLista();
});
