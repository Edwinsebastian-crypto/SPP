# Monolito SPP · Software de Prácticas Pedagógicas

Servicio central del ecosistema SPP encargado de la gestión integral, seguimiento pedagógico, registro de actividades y control administrativo de las prácticas académicas universitarias.

Construido en **Node.js 18+ (Express)** con frontend reactivo en **React 19 + Vite 6**, autenticación mediante **Supabase Auth**, persistencia relacional en **PostgreSQL (Supabase)**, almacenamiento documental en **MongoDB Atlas** y subida de evidencias en la nube con **Cloudinary**.

---

## 🎯 ¿Qué hace este servicio?

El monolito es el núcleo transaccional del sistema y coordina todo el ciclo de vida de la práctica pedagógica:

1. **Gestión de Prácticas y Matrículas**:
   - Registro y vinculación entre estudiante, tutor académico, asesor de la institución educativa y director de programa.
   - Control de estados (Borrador, Asignada, En Curso, Culminada, Cancelada).
   - Contabilización automática de horas acumuladas por práctica.

2. **Seguimiento de Actividades y Evidencias**:
   - Módulo de 6 actividades pedagógicas reglamentarias por práctica.
   - Carga segura de evidencias documentales y multimedia asociadas a cada actividad con almacenamiento en Cloudinary.
   - Registro de horas de labor formativa por evidencia.

3. **Retroalimentación y Calificación (Bitácora / Logbook)**:
   - Panel de retroalimentación pedagógica para tutores y asesores.
   - Calificación de actividades y asignación de la nota final de la práctica con observaciones formativas.

4. **Administración y Acreditación (Panel del Director)**:
   - Aprobación, activación, edición y gestión de perfiles de usuarios.
   - Administración de instituciones educativas aliadas y tipos de práctica.
   - Tablero con indicadores cuantitativos de acreditación institucional (porcentaje de aprobación, cumplimiento de horas, reportes agregados).
   - Exportación de auditoría y reportes consolidados en formatos **Excel (XLSX)**, **CSV** y paquetes **ZIP**.

5. **Integración con Microservicios (Orquestador)**:
   - **Pasarela hacia Evaluación (`servicio_evaluacion`)**: Enruta de forma segura peticiones autenticadas mediante tokens HMAC (HS256) de corta duración, garantizando que los usuarios solo accedan a las evaluaciones de sus prácticas.
   - **Despachador de Eventos hacia Notificaciones (`servicio_notificaciones`)**: Emite eventos del ciclo de vida (registro, asignación, calificación) para el envío de correos y alimenta la campana de notificaciones de cada panel.

---

## 👥 Paneles y Roles de Usuario

Cada rol dispone de una interfaz dedicada protegida por control de acceso (RBAC):

| Rol | Vista Principal | Responsabilidades |
| :--- | :--- | :--- |
| **Estudiante** (`student`) | `student.html` | Consulta de práctica, registro de horas, subida de archivos de evidencia, realización de evaluaciones y revisión de retroalimentaciones. |
| **Tutor Académico** (`tutor`) | `tutor.html` | Seguimiento directo al estudiante, revisión y calificación de evidencias, emisión de retroalimentación pedagógica, calificación de bitácora y gestión de evaluaciones con IA. |
| **Asesor Pedagógico** (`advisor`) | `advisor.html` | Acompañamiento institucional in situ, revisión de evidencias y aportes de retroalimentación formativa. |
| **Director** (`director`) | `director.html` | Configuración de la plataforma, aprobación de cuentas, vinculación de prácticas, gestión de instituciones, métricas de acreditación y auditoría. |

---

## 🏛️ Arquitectura del Software

El servicio sigue una arquitectura en capas desacopladas (Clean Layered Architecture / MVC):

```text
[ Cliente Web / React 19 ]
           │ (HTTP / JSON / Cookies HttpOnly)
           ▼
[ Middlewares de Seguridad ] ── (Helmet, CSP, CORS, Rate Limit, Auth Supabase)
           │
[ Rutas & Enrutamiento ] ── (Definición de endpoints y control de roles)
           │
[ Controladores (Controllers) ] ── (Validación de entrada y orquestación HTTP)
           │
[ Capa de Servicios (Services) ] ── (Lógica de negocio, autorizaciones, reglas y cálculos)
      ├── Gateway Proxies ──▶ [ Microservicio de Evaluación (FastAPI) ]
      ├── Event Dispatcher ─▶ [ Microservicio de Notificaciones (Express) ]
      └── Repositorios (Repositories)
                 ├── PostgreSQL (Pool con consultas SQL parametrizadas)
                 ├── MongoDB (Auditoría e indicadores de acreditación)
                 └── Cloudinary (Almacenamiento de archivos y evidencias)
```

### Estructura de Directorios

```text
spp_practicas/
├── src/
│   ├── server.js            # Punto de entrada principal y levantamiento del servidor HTTP
│   ├── app.js               # Ensamblado de Express, middlewares globales y rutas
│   ├── container.js         # Contenedor de inyección de dependencias
│   ├── config/              # Variables de entorno validadas y constantes del sistema
│   ├── routes/              # Declaración de endpoints protegidos por guardas de rol
│   ├── controllers/         # Controladores HTTP de entrada y salida
│   ├── services/            # Casos de uso y reglas de negocio del dominio
│   ├── repositories/        # Consultas de acceso a datos a PostgreSQL y MongoDB
│   ├── middlewares/         # Autenticación, control RBAC, CSP, subida de archivos y auditoría
│   └── infrastructure/      # Conexiones a bases de datos y proveedores externos
│
├── frontend/                # Aplicación Frontend React 19
│   ├── src/
│   │   ├── components/      # Componentes UI organizados por dominio
│   │   ├── core/            # Estado global (practiceStore), bus de eventos (events) y API
│   │   ├── entries/         # Puntos de entrada Vite por cada vista/rol
│   │   └── hooks/           # Hooks personalizados de React
│   └── vite.config.js       # Configuración de compilación dirigida a public/dist/
│
├── public/                  # Archivos estáticos y plantillas del navegador
│   ├── dist/                # Bundles de JavaScript/CSS generados por Vite
│   ├── pages/               # Vistas HTML contenedor (App Shell) por rol
│   ├── css/                 # Estilos institucionales CSS
│   └── index.html           # Vista de inicio de sesión
│
├── scripts/                 # Scripts operacionales y de automatización
├── tests/                   # Suite de pruebas unitarias, repositorios e integración E2E
└── package.json             # Dependencias del proyecto y scripts npm
```

---

## 🔒 Mecanismos de Seguridad

- **Sesiones y Cookies**: Cookies `HttpOnly`, con atributos `SameSite=Lax` y bandera `Secure` en producción.
- **Validación de Identidad**: Integración con Supabase Auth restringida a cuentas creadas por el sistema institucional.
- **Protección contra Inyecciones**: Todas las consultas a PostgreSQL utilizan consultas SQL parametrizadas (`$1, $2, ...`).
- **Políticas de Contenido (CSP)**: Cabeceras `Content-Security-Policy` estrictas sin scripts inline arbitrarios.
- **Control de Carga de Archivos**: Validación de tipos MIME y límite de tamaño a 10 MB antes del procesamiento hacia Cloudinary.
- **Trazabilidad y Auditoría**: Registro persistente en MongoDB de modificaciones sobre prácticas, evidencias, notas y usuarios.

---

## ⚙️ Puesta en Marcha

### Requisitos Previos
- **Node.js** >= 18.x
- **PostgreSQL** (local o base de datos en Supabase)
- **MongoDB** (local o cluster en MongoDB Atlas)

### 1. Instalación de Dependencias
```bash
npm install
```

### 2. Configurar Variables de Entorno
Copia el archivo base y ajusta las credenciales:
```bash
cp .env.example .env
```

Parámetros clave en `.env`:
- `PORT`: Puerto de escucha del servidor (por defecto: `3000`).
- `DATABASE_URL_PRACTICE`: Cadena de conexión a PostgreSQL.
- `MONGO_URI_PRIMARY`: Cadena de conexión a MongoDB para auditoría e indicadores.
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`: Credenciales de autenticación.
- `CLOUDINARY_*`: Credenciales de almacenamiento de archivos.
- `EVALUATION_SERVICE_URL` / `EVALUATION_SERVICE_SECRET`: Enlace al microservicio de evaluación.
- `NOTIFICATION_SERVICE_URL` / `NOTIFICATION_SERVICE_SECRET`: Enlace al microservicio de notificaciones.

### 3. Compilar el Frontend React
```bash
npm run build
```
Genera los paquetes optimizados en `public/dist/`.

### 4. Iniciar el Servidor
- **Modo Desarrollo (con reinicio automático):**
  ```bash
  npm run dev
  ```
- **Modo Producción:**
  ```bash
  npm start
  ```
El servicio estará disponible en: [http://localhost:3000](http://localhost:3000)

### 5. Iniciar Todo el Ecosistema en Simultáneo
Para arrancar el monolito junto con los microservicios de evaluación y notificaciones:
```bash
npm run start:all
```

---

## 🧪 Pruebas Automatizadas

```bash
# Ejecutar toda la suite de pruebas
npm test

# Ejecutar suites específicas
npm run test:unit
npm run test:repositories
npm run test:e2e
```
