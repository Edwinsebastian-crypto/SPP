# SPP · Servicio de notificaciones

Microservicio (Node 18+ / Express) que avisa por **correo** a estudiantes, tutores, asesores y director.
Su base de datos es **MongoDB** (colección `notificaciones`, diccionario TB-0001). Consulta la información de prácticas y evaluaciones a través de los APIs HTTP internos de los servicios dueños de cada base de datos (`SOFTWARE_SPP` y `servicio_evaluacion`).

```
Monolito ──evento firmado──▶ POST /api/v1/events ─┐
                                                  ├─▶ cola en MongoDB ─▶ Dispatcher ─▶ SMTP ─▶ correo
Planificador (cada 15 min) ── consulta HTTP monolito/eval ─┘                       (reintentos)
```

## Qué notifica

| A quién | Cuándo | Tipo (`tipo`) | Origen |
|---|---|---|---|
| Estudiante, tutor, asesor | Se registra / lo registran | `UsuarioRegistrado` | evento |
| Estudiante, tutor, asesor | El director **aprueba** su cuenta (pendiente → activa) | `UsuarioAprobado` | evento |
| Estudiante, tutor, asesor | Se le asigna una práctica | `PracticaAsignada` | evento |
| **Estudiante** | Tutor o asesor **retroalimenta** su actividad | `ActividadRetroalimentada` | evento |
| **Estudiante** | Tutor o asesor **califica** su actividad | `ActividadCalificada` | evento |
| **Estudiante** | Le **califican la práctica** (nota final) | `PracticaCalificada` | evento |
| **Estudiante** | Su **evaluación está disponible** (el tutor la publica) | `EvaluacionDisponible` | evento |
| **Estudiante** | Su evaluación fue **calificada** por el tutor | `EvaluacionCalificada` | evento |
| **Estudiante** | **24 h antes** de la fecha límite de una actividad sin entregar (sin evidencia) | `RecordatorioActividad` | planificador |
| **Estudiante** | **24 h antes** del límite de una evaluación sin presentar | `RecordatorioEvaluacion` | planificador |
| **Tutor** | Resumen diario: actividades por retroalimentar / calificar, evaluaciones por calificar, prácticas por calificar | `PendientesRevision` | planificador |
| **Asesor** | Resumen diario: actividades por retroalimentar / calificar | `PendientesRevision` | planificador |
| **Director** | Resumen diario: prácticas terminadas (fecha final vencida) sin nota final | `PracticasSinCalificar` | planificador |

Reglas: todo es **idempotente** (`claveUnica` con índice único: reiniciar, reejecutar o tener réplicas no duplica correos);
los resúmenes salen **una vez al día** desde `DIGEST_HOUR` (7:00, hora `TZ`) y solo si hay algo pendiente; solo se consideran
prácticas **activas**; tutores/asesores/directores/estudiantes inactivos no reciben avisos programados.
El asesor no recibe «prácticas por calificar» porque el monolito solo deja calificar la práctica al tutor o al director.

## Campanita (bandeja dentro del SPP)

Cada notificación creada por este servicio también aparece en la campanita del encabezado de los paneles de estudiante,
tutor, asesor y director (contador de no leídas, lista, «marcar como leída»), aunque el correo no se haya enviado (`MAIL_MODE=log`).
El monolito la consulta con `GET /api/notifications` (cada usuario solo ve las suyas; el documento sale de la sesión) y esta llama a
`GET /api/v1/notifications/inbox?documento=…` y `POST /api/v1/notifications/read` del servicio. Solo se muestran las notificaciones creadas
por este servicio (con `claveUnica`); el histórico antiguo del monolito no se muestra ni se reenvía (`LEGACY_QUEUE=false`).

## Inicio rápido sin Docker (para probar)

```bash
npm install
npm run setup   # crea los .env a partir de SOFTWARE_SPP/.env (correo en modo prueba)
npm start
```

## Puesta en marcha (Docker Compose)

```bash
cd servicio_notificaciones
cp .env.example .env
#  edita .env: NOTIFICATION_SERVICE_SECRET (node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"),
#              DATABASE_URL_PRACTICE (la misma del monolito), MONGO_PASSWORD
docker compose up --build -d
curl http://localhost:4000/health
```

Levanta tres contenedores: **mongo** (con volumen), **mailpit** (SMTP de pruebas; los correos se ven en
http://localhost:8025, no salen a Internet) y **notificaciones** (puerto 4000, solo en `127.0.0.1`).
Para correo real define `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` en `.env`.
Para usar MongoDB Atlas define `MONGO_URI_NOTIFICATIONS` (tiene prioridad sobre el Mongo del compose).

**Monolito** (`SOFTWARE_SPP/.env`):
```
NOTIFICATION_SERVICE_URL=http://localhost:4000
NOTIFICATION_SERVICE_SECRET=<el mismo secreto>
```
Reinícialo. El servicio debe ser **privado**: quien tenga el secreto puede publicar eventos.

Sin Docker: `npm install && npm start` (exige `MONGO_URI_NOTIFICATIONS` o `MONGO_HOST`, `DATABASE_URL_PRACTICE` y el secreto).

## Probar sin esperar

Con un token del monolito (o `NotificationServiceClient.signToken()`):
```
POST /api/v1/jobs/run  { "job": "all", "forceDigest": true }   # recordatorios + resúmenes + envío ahora
GET  /api/v1/notifications?documento=…&estadoEnvio=Fallida
POST /api/v1/notifications/retry-failed
```
Con `MAIL_MODE=log` no hace falta SMTP: imprime el correo y lo marca como enviado.

## Diccionario de datos · TB-0001 `notificaciones` (MongoDB)

| Campo | Tipo | Req. | Descripción |
|---|---|---|---|
| `_id` | ObjectId | Sí | Código único generado por MongoDB |
| `tipo` | String (enum, 12 valores — ver tabla) | Sí | Motivo del correo |
| `destinatario` | Object{numDocumento, correo, nombreCompleto, **rol**} | Sí | Quién recibe el correo (`rol` es nuevo) |
| `Practica` | Object{idPractica, fechainicio, fechafinal, notaFinal, observacionFinal, estado, idTipoPractica, numDocEstudiante, numDocTutor, numDocAsesor, nitEntidad} | **No*** | Práctica que originó la notificación |
| `asunto` | String | Sí | Asunto del correo |
| `contenido` | String | Sí | Texto completo del correo |
| `fechaCreacion` | Date | Sí | Cuándo se generó (antes de intentar enviarla) |
| `fechaEnvio` | Date | **No*** | Cuándo salió correctamente; vacío mientras no se envía |
| `estadoEnvio` | String (`Pendiente`·`Enviando`·`Enviada`·`Fallida`) | Sí (nuevo) | Estado en la cola |
| `intentos`, `ultimoError`, `proximoIntento`, `bloqueadoHasta` | Number/String/Date | (nuevo) | Control de reintentos y reservas |
| `claveUnica` | String (índice único) | (nuevo) | Evita duplicados |

\* **Cambios que conviene reflejar en el diccionario:** `Practica` pasa de «Sí» a «No» porque el registro de usuarios y los
resúmenes del director/tutor no nacen de una sola práctica; `fechaEnvio` es «No» (queda vacía hasta el envío).
Los documentos antiguos del monolito (con `idPractica` suelto y sin `estadoEnvio`) también se envían.

## Variables de entorno

Ver `.env.example`. Las principales: `NOTIFICATION_SERVICE_SECRET`, `DATABASE_URL_PRACTICE`, `DATABASE_URL_EVALUATION` (opcional),
`MONGO_*`, `SMTP_*`, `MAIL_FROM`, `APP_URL`, `DIGEST_HOUR`, `REMINDER_HOURS`.

## Pruebas

```bash
npm install && npm test        # 68 pruebas; las de SQL se omiten si no defines TEST_PRACTICE_DB_URL
```
Cubren plantillas, escapado del HTML, autenticación, modelo, eventos, planificador, reintentos del envío, API HTTP y las
consultas reales contra una copia del esquema heredado (`tests/*.sql`).

## Estado de verificación (honesto)

Probado: toda la lógica, la API HTTP, las consultas SQL contra PostgreSQL 16 con el esquema heredado y el flujo
monolito → servicio → correo con la cola en memoria. **Sin ejecutar** (no había Docker, MongoDB ni SMTP en el entorno de desarrollo):
`docker compose up`, las consultas Mongoose reales de `notification.repository.js` (índice único, `findOneAndUpdate`) y el envío SMTP real.
Si algo falla al primer arranque, mira primero eso.
