# Microservicio de Evaluación · SPP

Microservicio asíncrono desarrollado en **Python (FastAPI + SQLAlchemy)** encargado de la creación, gestión, presentación y calificación de evaluaciones académicas en el Sistema de Prácticas Pedagógicas (SPP). Cuenta con soporte para preguntas manuales y un motor de **generación de cuestionarios asistido por Inteligencia Artificial (IA)** a partir de temas libres o evidencias reales de los estudiantes.

---

## 🎯 ¿Qué hace este servicio?

1. **Gestión de Evaluaciones y Cuestionarios**:
   - Creación de evaluaciones vinculadas a una práctica pedagógica y actividad específica.
   - Parámetros configurables: fecha de apertura, fecha de cierre, tiempo límite en minutos, número máximo de intentos permitidos y nota máxima ponderada.
   - Ciclo de vida de la evaluación: `Borrador` ➔ `Publicada` ➔ `Cerrada`.

2. **Tipos de Preguntas Soportadas**:
   - **Opción múltiple con única respuesta**: Calificación automática inmediata.
   - **Verdadero o Falso**: Calificación automática inmediata.
   - **Preguntas Abiertas de desarrollo**: Calificación manual con rúbrica y retroalimentación pedagógica por parte del tutor.

3. **Motor de Generación de Preguntas con Inteligencia Artificial**:
   - Generación automática de preguntas basada en **temas pedagógicos específicos** o mediante el **análisis directo de los archivos de evidencia** subidos por el estudiante (documentos PDF, archivos de Word `.docx`, presentaciones PowerPoint `.pptx` y texto plano).
   - **Trazabilidad y Control Docente**: Las preguntas generadas por IA quedan en estado `Borrador / Por Revisar`. El tutor tiene control total para aprobarlas, editarlas, ajustar la dificultad o descartarlas antes de que sean visibles para el estudiante.
   - **Compatibilidad de Modelos**:
     - Proveedores compatibles con la API de OpenAI (Google Gemini via AI Studio, Groq, Ollama local, OpenRouter).
     - Proveedor directo Anthropic (Claude 3.5 Sonnet / Haiku).
     - Modo simulado integrado (útil para pruebas y desarrollo sin necesidad de credenciales externas).

4. **Flujo de Presentación para Estudiantes**:
   - Gestión y control riguroso de intentos simultáneos.
   - **Autoguardado continuo de respuestas**: El estudiante guarda respuestas en tiempo real sin perder progreso ante interrupciones de conexión.
   - Cierre automático de intentos al expirar el tiempo límite o la fecha de la evaluación.
   - Cálculo automático de la nota final considerando el mejor intento calificado.

5. **Panel de Métricas para la Dirección de Prácticas**:
   - Indicadores agregados de rendimiento por tutor, práctica y programa.
   - Distribución de notas, tasa de aprobación institucional e índice de uso y aceptación de la IA.
   - Alertas preventivas tempranas (evaluaciones sin publicar, revisiones pendientes o calificaciones atrasadas).

---

## 🏛️ Arquitectura del Servicio

```text
                  [ Monolito SPP (Node.js) ]
                             │
            Tokens HMAC / HS256 (JWT temporal)
                             ▼
               [ FastAPI Application (:8000) ]
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
   [ Router Tutor ]  [ Router Estudiante ]  [ Router Director ]
        │                    │                    │
        └────────────────────┼────────────────────┘
                             ▼
                     [ Capa de Servicios ]
          ├── Motor de Evaluación y Calificación
          ├── Motor de IA (services/llm.py)
          ├── Extractor de Documentos (PDF, Word, PPTX)
          └── Cliente de Evidencias (practice_db / HTTP)
                             │
                             ▼
               [ PostgreSQL (Esquema Evaluación) ]
```

### Estructura de Directorios

```text
servicio_evaluacion/
├── backend/
│   ├── app/
│   │   ├── main.py              # Inicialización de la aplicación FastAPI y middlewares
│   │   ├── api/                 # Endpoints REST agrupados por rol (/tutor, /estudiante, /director)
│   │   ├── core/                # Configuración de variables de entorno y validación de seguridad (JWT/HMAC)
│   │   ├── models/              # Modelos declarativos SQLAlchemy (evaluación, pregunta, intento, respuesta)
│   │   ├── schemas/             # Esquemas de validación y serialización Pydantic
│   │   └── services/            # Lógica de negocio (calificación, LLM, extracción de texto, estadísticas)
│   ├── tests/                   # Pruebas automatizadas con pytest
│   ├── requirements.txt         # Dependencias de producción
│   └── requirements-dev.txt     # Dependencias de desarrollo y testing
├── db/
│   └── schema.sql               # Esquema DDL para PostgreSQL
└── docker-compose.yml           # Configuración para ejecución en contenedores
```

---

## 🔒 Seguridad y Comunicación con el Monolito

El servicio de evaluación funciona como un **servicio interno desacoplado**:

- **Autenticación HMAC/JWT**: Las peticiones originadas desde el navegador pasan por el Monolito (`spp_practicas`), el cual valida la sesión del usuario y genera un token JWT firmado de corta duración (HS256) con el secreto compartido `EVALUATION_SERVICE_SECRET`.
- **Aislamiento de Recursos**: El servicio valida en cada transacción que el usuario tenga el rol autorizado y que el tutor o estudiante pertenezcan estrictamente a la práctica evaluada.
- **Seguridad en Evidencias**: La extracción de archivos de evidencias solo descarga contenidos de hosts expresamente permitidos (`ALLOWED_FILE_HOSTS`), impidiendo accesos arbitrarios a la red.

---

## 🚀 Puesta en Marcha

### Requisitos
- **Python** >= 3.10
- **PostgreSQL** >= 14

### Opción 1: Ejecución con Docker (Recomendada)
```bash
cd servicio_evaluacion
docker compose up --build -d
```
El servicio estará disponible en: `http://localhost:8000`  
Documentación Swagger interactiva: `http://localhost:8000/docs`

### Opción 2: Instalación Manual

1. **Crear y aplicar la base de datos:**
   ```bash
   createdb spp_evaluacion
   psql -d spp_evaluacion -f db/schema.sql
   ```

2. **Crear entorno virtual e instalar dependencias:**
   ```bash
   cd servicio_evaluacion/backend
   python -m venv .venv
   
   # En Windows:
   .venv\Scripts\activate
   # En Linux/macOS:
   source .venv/bin/activate

   pip install -r requirements.txt
   ```

3. **Configurar variables de entorno (`backend/.env`):**
   Copia el archivo base:
   ```bash
   cp .env.example .env
   ```
   Valores indispensables:
   ```ini
   DATABASE_URL=postgresql+psycopg://usuario:password@localhost:5432/spp_evaluacion
   AUTH_MODE=jwt
   JWT_SECRET=tu_clave_secreta_compartida_con_el_monolito
   EVIDENCIAS_MODE=practice_db
   PRACTICE_DATABASE_URL=postgresql://usuario:password@localhost:5432/spp_practicas
   ```

4. **Configuración de Inteligencia Artificial (Opcional):**
   - **Google Gemini (Gratis en AI Studio):**
     ```ini
     LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
     LLM_API_KEY=tu_api_key_de_gemini
     LLM_MODEL=gemini-2.0-flash
     ```
   - **Anthropic Claude:**
     ```ini
     ANTHROPIC_API_KEY=tu_api_key_de_anthropic
     ```
   - *Nota:* Si no configuras ninguna API Key, el servicio utilizará automáticamente el **motor simulado interno** sin arrojar errores.

5. **Iniciar el servidor:**
   ```bash
   uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```

---

## 📡 Referencia de Endpoints Principales (`/api/v1`)

| Rol | Método y Ruta | Descripción |
| :--- | :--- | :--- |
| **Tutor** | `GET /tutor/evaluaciones` | Lista de evaluaciones creadas por el tutor |
| **Tutor** | `POST /tutor/evaluaciones` | Crear nueva evaluación para una práctica |
| **Tutor** | `POST /tutor/evaluaciones/{id}/generar` | Generar preguntas con Inteligencia Artificial |
| **Tutor** | `POST /tutor/evaluaciones/{id}/preguntas` | Agregar pregunta manual |
| **Tutor** | `POST /tutor/preguntas/{id}/aprobar` | Aprobar pregunta generada por IA |
| **Tutor** | `POST /tutor/evaluaciones/{id}/publicar` | Publicar evaluación para el estudiante |
| **Tutor** | `POST /tutor/respuestas/{id}/calificar` | Calificar respuesta abierta y emitir retroalimentación |
| **Estudiante** | `GET /estudiante/evaluaciones` | Evaluaciones asignadas y disponibles |
| **Estudiante** | `POST /estudiante/evaluaciones/{id}/intentos` | Iniciar un nuevo intento |
| **Estudiante** | `PUT /estudiante/intentos/{id}/respuestas/{pregunta_id}` | Autoguardado de respuesta |
| **Estudiante** | `POST /estudiante/intentos/{id}/enviar` | Entrega y finalización del intento |
| **Director** | `GET /director/resumen` | Estadísticas globales e indicadores de evaluación |
| **Director** | `GET /director/evaluaciones` | Monitoreo general de todas las evaluaciones |
| **Sistema** | `GET /health` | Chequeo de estado y conectividad del servicio |

---

## 🧪 Pruebas Automatizadas

```bash
cd servicio_evaluacion/backend
pytest
```
Ejecuta la suite de pruebas unitarias y de integración que validan los algoritmos de calificación, extracción y control de intentos.
