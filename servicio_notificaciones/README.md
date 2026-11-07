# Microservicio de Notificaciones · SPP

Microservicio asíncrono desarrollado en **Node.js 18+ (Express)** encargado del despacho centralizado de **notificaciones por correo electrónico** y del suministro de la **bandeja de notificaciones en tiempo real (campana)** para el Sistema de Prácticas Pedagógicas (SPP).

Utiliza **MongoDB** como almacén persistente de la cola y el historial de notificaciones, y **Nodemailer** para la entrega de correos mediante protocolo SMTP con plantillas HTML responsivas.

---

## 🎯 ¿Qué hace este servicio?

1. **Despacho Inmediato de Notificaciones (Event-Driven)**:
   - Escucha eventos emitidos por el Monolito (`spp_practicas`) y los encola de inmediato en MongoDB.
   - Envío de correos automáticos ante eventos clave del ciclo académico:
     - **Cuentas de Usuario**: Registro de nuevo usuario y notificación de aprobación/activación de cuenta por el Director.
     - **Prácticas**: Asignación de nueva práctica a estudiante, tutor y asesor.
     - **Actividades y Evidencias**: Emisión de retroalimentación pedagógica y calificación de evidencias.
     - **Calificación Final**: Notificación de nota final de la práctica registrada en la bitácora.
     - **Evaluaciones**: Notificación al estudiante cuando una evaluación es publicada y cuando es calificada por el tutor.

2. **Planificador y Tareas Programadas (Cron Scheduler)**:
   - **Recordatorios de Vencimiento (24 Horas Antes)**:
     - Recordatorio al estudiante de actividades próximas a vencer que aún no cuentan con evidencia cargada.
     - Recordatorio al estudiante de evaluaciones publicadas próximas a cerrar que aún no han sido presentadas.
   - **Resumen Diario de Pendientes (Daily Digest)**:
     - Consolidado diario a tutores y asesores con el listado de actividades y evaluaciones pendientes de retroalimentar o calificar.
     - Consolidado diario al Director con prácticas finalizadas que aún no tienen nota final registrada.

3. **Bandeja de Entrada en Plataforma (Campanita de Notificaciones)**:
   - Provee una API REST consultada por el Monolito para mostrar el contador de notificaciones no leídas, el historial reciente y la opción de marcar mensajes como leídos dentro de la interfaz de cada usuario.

4. **Idempotencia y Tolerancia a Fallos**:
   - Cada notificación cuenta con una `claveUnica` indexada en MongoDB. Esto garantiza que ante reintentos de red, reinicios de servicios o ejecuciones concurrentes, **nunca se envíen correos duplicados**.
   - Cola de reintentos automática con retroceso exponencial (*exponential backoff*) ante fallas temporales de servidores SMTP o problemas de red.

---

## 📋 Catálogo de Notificaciones

| Evento / Notificación | Destinatario | Disparador | Canal |
| :--- | :--- | :--- | :--- |
| `UsuarioRegistrado` | Estudiante, Tutor, Asesor | Registro completado | Correo + Campana |
| `UsuarioAprobado` | Estudiante, Tutor, Asesor | Director activa la cuenta | Correo + Campana |
| `PracticaAsignada` | Estudiante, Tutor, Asesor | Vinculación de práctica creada | Correo + Campana |
| `ActividadRetroalimentada` | Estudiante | Tutor/Asesor registra comentarios | Correo + Campana |
| `ActividadCalificada` | Estudiante | Calificación de actividad registrada | Correo + Campana |
| `PracticaCalificada` | Estudiante | Calificación final de práctica en bitácora | Correo + Campana |
| `EvaluacionDisponible` | Estudiante | Tutor publica evaluación | Correo + Campana |
| `EvaluacionCalificada` | Estudiante | Tutor completa la calificación de la evaluación | Correo + Campana |
| `RecordatorioActividad` | Estudiante | 24 h previas al límite sin evidencia enviada | Correo + Campana |
| `RecordatorioEvaluacion` | Estudiante | 24 h previas al cierre sin presentar | Correo + Campana |
| `PendientesRevision` | Tutor, Asesor | Resumen diario a las 07:00 con tareas pendientes | Correo |
| `PracticasSinCalificar` | Director | Resumen diario con prácticas concluidas sin nota | Correo |

---

## 🏛️ Arquitectura del Servicio

```text
[ Monolito SPP ] ──(Evento HTTP con Token HMAC)──▶ [ POST /api/v1/events ]
                                                              │
[ Planificador Interno (Cron 15 min) ] ──────────────────────┤
                                                              ▼
                                               [ Cola en MongoDB (notificaciones) ]
                                                              │
                                                              ▼
                                                   [ Dispatcher Worker ]
                                                              │
                                       ┌──────────────────────┴──────────────────────┐
                                       ▼                                             ▼
                             [ Nodemailer (SMTP) ]                        [ API Campanita ]
                             (Envío de Correos HTML)                 (GET /api/v1/notifications/inbox)
```

### Estructura del Proyecto

```text
servicio_notificaciones/
├── src/
│   ├── config/              # Variables de entorno y constantes de configuración
│   ├── infrastructure/      # Conexiones a MongoDB (Mongoose) y transporte SMTP (Nodemailer)
│   ├── repositories/        # Repositorio de acceso a datos de notificaciones
│   ├── services/            # Lógica de despacho, plantillas HTML, planificador y reintentos
│   ├── routes/              # Definición de rutas y endpoints de la API
│   ├── middlewares/         # Validación de tokens HMAC y control de acceso interno
│   ├── app.js               # Ensamblado de Express y configuración de rutas
│   └── server.js            # Punto de entrada y arranque del servidor (:4000)
├── docker-compose.yml       # Orquestación con MongoDB y servidor Mailpit para pruebas
├── package.json             # Dependencias y scripts npm
└── README.md
```

---

## 🔒 Seguridad y Autenticación

- **Canal Seguro Inter-Servicios**: El servicio es exclusivamente interno. Toda comunicación proveniente del Monolito requiere una cabecera de autorización con token JWT/HMAC firmado con `NOTIFICATION_SERVICE_SECRET`.
- **Sanitización de Contenido**: Las plantillas HTML realizan escapado riguroso de variables para prevenir ataques de inyección HTML en clientes de correo.
- **Aislamiento de Bandeja**: Los endpoints de bandeja de entrada verifican el número de documento del usuario autenticado para asegurar privacidad absoluta en las consultas.

---

## 🚀 Puesta en Marcha

### Requisitos Previos
- **Node.js** >= 18.x
- **MongoDB** (local o cluster en MongoDB Atlas)
- **Servidor SMTP** (Gmail, SendGrid, Amazon SES o contenedor Mailpit para desarrollo local)

### Opción 1: Ejecución con Docker Compose (Recomendada para Desarrollo)
Levanta de forma automática el servicio junto a un contenedor de **MongoDB** y el servidor de pruebas **Mailpit** (SMTP local con bandeja web):

```bash
cd servicio_notificaciones
cp .env.example .env
docker compose up --build -d
```

- **API de Notificaciones**: [http://localhost:4000](http://localhost:4000)
- **Bandeja de Correos Local (Mailpit)**: [http://localhost:8025](http://localhost:8025)

### Opción 2: Instalación Manual

1. **Instalar dependencias:**
   ```bash
   cd servicio_notificaciones
   npm install
   ```

2. **Configurar variables de entorno (`.env`):**
   ```bash
   cp .env.example .env
   ```
   Variables principales:
   ```ini
   PORT=4000
   NODE_ENV=development
   NOTIFICATION_SERVICE_SECRET=clave_secreta_compartida_con_el_monolito
   
   # Conexión a MongoDB
   MONGO_URI_NOTIFICATIONS=mongodb://localhost:27017/spp_notificaciones
   
   # Configuración de Correo SMTP
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=tu_correo@institucion.edu.co
   SMTP_PASS=tu_contrasena_de_aplicacion
   MAIL_FROM="Sistema SPP <no-reply@institucion.edu.co>"
   
   # Modo de envío: 'smtp' para envío real, 'log' para imprimir en consola sin enviar
   MAIL_MODE=smtp
   ```

3. **Iniciar el servicio:**
   ```bash
   # Modo desarrollo (con recarga automática)
   npm run dev

   # Modo producción
   npm start
   ```

---

## 📡 Endpoints de la API (`/api/v1`)

| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `POST` | `/api/v1/events` | Recepción de eventos desde el Monolito para encolar notificaciones |
| `GET` | `/api/v1/notifications/inbox` | Consulta de notificaciones para la campana del usuario |
| `POST` | `/api/v1/notifications/read` | Marcar una o todas las notificaciones como leídas |
| `POST` | `/api/v1/jobs/run` | Ejecución manual inmediata de tareas del planificador (recordatorios / digest) |
| `POST` | `/api/v1/notifications/retry-failed` | Reintentar el despacho de notificaciones fallidas |
| `GET` | `/health` | Verificación de salud y estado de conexión a MongoDB |

---

## 🧪 Pruebas Automatizadas

```bash
npm test
```
Ejecuta la suite de pruebas que valida el formateo de plantillas, la lógica de idempotencia, el control de reintentos y la autenticación inter-servicios.
