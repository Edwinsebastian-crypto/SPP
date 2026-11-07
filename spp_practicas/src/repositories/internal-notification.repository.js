'use strict';
const BaseRepository = require('./base.repository');
const schemaResolver = require('../infrastructure/schema-resolver');

class InternalNotificationRepository extends BaseRepository {
  constructor() {
    super('practice');
  }

  #userColumns(table) {
    const email = {
      estudiante: ['correoinst', 'correinst'],
      tutor_academico: ['correoinst', 'correinst'],
      asesor_pedagogico: ['correinst', 'correoinst'],
      director: ['correinst', 'correoinst']
    }[table];
    return { email: schemaResolver.column(table, ...email) };
  }

  async findPerson(role, documentNumber) {
    const tableMap = {
      student: 'estudiante',
      tutor: 'tutor_academico',
      advisor: 'asesor_pedagogico',
      director: 'director'
    };
    const table = tableMap[role];
    if (!table) return null;
    const { email } = this.#userColumns(table);
    const row = await this.queryOne(
      `SELECT "numDocumento" AS "documentNumber", nombre AS "firstName", apellido AS "lastName", ${email} AS email,
              lower(trim(estado)) AS status FROM ${table} WHERE "numDocumento" = $1`,
      [documentNumber]
    );
    return row ? { ...row, fullName: `${row.firstName} ${row.lastName}`.trim() } : null;
  }

  async listActiveDirectors() {
    const { email } = this.#userColumns('director');
    const rows = await this.query(
      `SELECT "numDocumento" AS "documentNumber", nombre AS "firstName", apellido AS "lastName", ${email} AS email
         FROM director WHERE lower(trim(estado)) = 'activo'`
    );
    return rows.map((r) => ({ ...r, fullName: `${r.firstName} ${r.lastName}`.trim() }));
  }

  async findPractice(id) {
    const s = this.#userColumns('estudiante');
    const t = this.#userColumns('tutor_academico');
    const a = this.#userColumns('asesor_pedagogico');
    const statusCol = schemaResolver.column('practica', 'estado');
    const row = await this.queryOne(
      `SELECT p."idPractica" AS id, p."fechaInicio" AS "startDate", p."fechaFinal" AS "endDate",
              p."notaFinal"::float AS "finalGrade", p."observacionFinal" AS "finalObservation",
              lower(trim(p.${statusCol})) AS status, p."idTipoPractica" AS "typeId", p."nitInstitucion" AS "institutionId",
              p."numDocEstudiante" AS "studentDocument", p."numDocTutor" AS "tutorDocument", p."numDocAsesor" AS "advisorDocument",
              tp.nombre AS "typeName", i.nombre AS "institutionName",
              e.nombre || ' ' || e.apellido AS "studentName", e.${s.email} AS "studentEmail", lower(trim(e.estado)) AS "studentStatus",
              t.nombre || ' ' || t.apellido AS "tutorName", t.${t.email} AS "tutorEmail", lower(trim(t.estado)) AS "tutorStatus",
              a.nombre || ' ' || a.apellido AS "advisorName", a.${a.email} AS "advisorEmail", lower(trim(a.estado)) AS "advisorStatus"
         FROM practica p
         JOIN estudiante e ON e."numDocumento" = p."numDocEstudiante"
         LEFT JOIN tipopractica tp ON tp."idTipoPractica" = p."idTipoPractica"
         LEFT JOIN institucion i ON i."nitEntidad" = p."nitInstitucion"
         LEFT JOIN tutor_academico t ON t."numDocumento" = p."numDocTutor"
         LEFT JOIN asesor_pedagogico a ON a."numDocumento" = p."numDocAsesor"
        WHERE p."idPractica" = $1`,
      [id]
    );
    return row || null;
  }

  async findActivity(id) {
    const row = await this.queryOne(
      `SELECT "idActividad" AS id, "idPractica" AS "practiceId", nombre AS title, "notaObtenida"::float AS grade,
              to_char("fechaLimite"::timestamp, 'YYYY-MM-DD"T"HH24:MI:SS') AS "dueLocal"
         FROM actividad WHERE "idActividad" = $1`,
      [id]
    );
    return row || null;
  }

  async listActivitiesDueSoon(hours = 24, timezone = 'America/Bogota') {
    const s = this.#userColumns('estudiante');
    const statusCol = schemaResolver.column('practica', 'estado');
    return this.query(
      `WITH ahora AS (SELECT (now() AT TIME ZONE $1) AS t)
       SELECT a."idActividad" AS "activityId", a.nombre AS "activityTitle", a."idPractica" AS "practiceId",
              to_char(a."fechaLimite"::timestamp, 'YYYY-MM-DD"T"HH24:MI:SS') AS "dueLocal",
              e."numDocumento" AS "studentDocument", e.nombre || ' ' || e.apellido AS "studentName", e.${s.email} AS "studentEmail"
         FROM actividad a
         JOIN practica p ON p."idPractica" = a."idPractica"
         JOIN estudiante e ON e."numDocumento" = p."numDocEstudiante", ahora
        WHERE lower(trim(p.${statusCol})) = 'activa' AND lower(trim(e.estado)) = 'activo'
          AND a."fechaLimite" IS NOT NULL
          AND a."fechaLimite"::timestamp > ahora.t
          AND a."fechaLimite"::timestamp <= ahora.t + make_interval(hours => $2::int)
          AND COALESCE(a."notaObtenida", 0) <= 0
          AND NOT EXISTS (SELECT 1 FROM evidenciaactividad ev WHERE ev."idActividad" = a."idActividad")`,
      [timezone, hours]
    );
  }

  async listActivitiesAwaitingReview() {
    const t = this.#userColumns('tutor_academico');
    const a = this.#userColumns('asesor_pedagogico');
    const statusCol = schemaResolver.column('practica', 'estado');
    return this.query(
      `SELECT act."idActividad" AS "activityId", act.nombre AS "activityTitle", p."idPractica" AS "practiceId",
              p."numDocTutor" AS "tutorDocument", p."numDocAsesor" AS "advisorDocument",
              s.nombre || ' ' || s.apellido AS "studentName",
              (COALESCE(act."notaObtenida", 0) <= 0) AS "needsGrade",
              EXISTS (SELECT 1 FROM evidenciaactividad ev WHERE ev."idActividad" = act."idActividad"
                        AND NOT EXISTS (SELECT 1 FROM retroalimentacion_t rt WHERE rt."idEvidencia" = ev."idEvidencia")) AS "needsTutorFeedback",
              EXISTS (SELECT 1 FROM evidenciaactividad ev WHERE ev."idActividad" = act."idActividad"
                        AND NOT EXISTS (SELECT 1 FROM retroalimentacion_a ra WHERE ra."idEvidencia" = ev."idEvidencia")) AS "needsAdvisorFeedback",
              t.nombre || ' ' || t.apellido AS "tutorName", t.${t.email} AS "tutorEmail", lower(trim(t.estado)) AS "tutorStatus",
              ad.nombre || ' ' || ad.apellido AS "advisorName", ad.${a.email} AS "advisorEmail", lower(trim(ad.estado)) AS "advisorStatus"
         FROM actividad act
         JOIN practica p ON p."idPractica" = act."idPractica"
         JOIN estudiante s ON s."numDocumento" = p."numDocEstudiante"
         LEFT JOIN tutor_academico t ON t."numDocumento" = p."numDocTutor"
         LEFT JOIN asesor_pedagogico ad ON ad."numDocumento" = p."numDocAsesor"
        WHERE lower(trim(p.${statusCol})) IN ('activa', 'evaluando', 'calificando')
          AND EXISTS (SELECT 1 FROM evidenciaactividad ev WHERE ev."idActividad" = act."idActividad")
        ORDER BY p."idPractica", act."idActividad"`
    );
  }

  async listUngradedPractices(timezone = 'America/Bogota') {
    const t = this.#userColumns('tutor_academico');
    const statusCol = schemaResolver.column('practica', 'estado');
    return this.query(
      `SELECT p."idPractica" AS id, p."fechaInicio" AS "startDate", p."fechaFinal" AS "endDate", p."numDocTutor" AS "tutorDocument",
              s.nombre || ' ' || s.apellido AS "studentName", tp.nombre AS "typeName",
              t.nombre || ' ' || t.apellido AS "tutorName", t.${t.email} AS "tutorEmail", lower(trim(t.estado)) AS "tutorStatus"
         FROM practica p
         JOIN estudiante s ON s."numDocumento" = p."numDocEstudiante"
         LEFT JOIN tipopractica tp ON tp."idTipoPractica" = p."idTipoPractica"
         LEFT JOIN tutor_academico t ON t."numDocumento" = p."numDocTutor"
        WHERE lower(trim(p.${statusCol})) IN ('activa', 'evaluando', 'calificando')
          AND COALESCE(p."notaFinal", 0) <= 0
          AND p."fechaFinal" <= (now() AT TIME ZONE $1)::date
        ORDER BY p."fechaFinal", p."idPractica"`,
      [timezone]
    );
  }
}

module.exports = InternalNotificationRepository;
