# Pruebas de rendimiento de SPP con k6

Estas pruebas iniciales miden la disponibilidad y latencia HTTP del monolito Node/Express de SPP. No realizan inicios de sesión, escrituras ni operaciones destructivas.

## Interpretación inicial

- `vus`: usuarios virtuales activos (no necesariamente personas conectadas o sesiones reales).
- `http_req_duration p(95)`: el 95 % de las solicitudes terminó en ese tiempo o menos.
- `http_req_failed`: proporción de solicitudes HTTP fallidas.
- `checks`: proporción de validaciones funcionales que pasaron.

Objetivo inicial para la prueba de carga: menos del 1 % de solicitudes fallidas y p95 menor de 2 segundos. Son umbrales de evaluación, no una garantía de capacidad. En estrés se permiten umbrales más amplios para identificar el punto de degradación.

## Alcance y pruebas integrales

Los scripts `smoke.js`, `load.js` y `stress.js` son una línea base HTTP sobre `/healthz` y `/api/config`; no prueban autenticación, consultas PostgreSQL/MongoDB, carga de archivos ni los microservicios FastAPI (`8000`) y notificaciones (`4000`).

Para conocer la capacidad real del sistema completo se realizó además una **prueba integral *full-stack*** en escenario autenticado de solo lectura (`POST /api/auth/login` con rol `director` reutilizando la cookie de sesión), con los **3 servicios activos simultáneamente** (`spp_practicas` en `:3000`, `servicio_notificaciones` en `:4000` con MongoDB y `servicio_evaluacion` en `:8000` con PostgreSQL), escalando de **10 a 200 VUs** durante 7 min 30 s (+ 30 s de cierre). No apuntes pruebas de escritura o estrés a datos reales.

## Descripción de las pruebas ejecutadas

- **Prueba de humo (`smoke.js` — 1 VU, 5 iteraciones):** Verifica disponibilidad inicial y respuestas HTTP 200 en `/healthz` y `/api/config`.
- **Prueba de carga gradual (`load.js` — hasta 50 VUs, 11 min):** Evalúa estabilidad manteniendo niveles de 10, 25 y 50 VUs con umbral `p(95) < 2000 ms` y `< 1 %` de fallos.
- **Prueba de estrés (`stress.js` — hasta 200 VUs, 16 min):** Incrementa progresivamente de 10 a 200 VUs sobre `/healthz` para observar comportamiento HTTP bajo alta concurrencia.
- **Prueba integral *full-stack* (10 a 200 VUs, 7 min 30 s):** Ejercita en paralelo el monolito (`GET /api/home`, `GET /api/practices`), el servicio de notificaciones en MongoDB (`GET /api/notifications`) y el servicio de evaluaciones FastAPI en PostgreSQL (`GET /api/evaluations/director/evaluaciones` y `resumen`).

## Resultados de referencia obtenidos

**Equipo de prueba:** AMD Ryzen 5 5500U with Radeon Graphics (6 núcleos, 12 procesadores lógicos), 5.85 GB RAM, ejecutando `k6` y los servicios en la misma máquina.

### 1. Línea base HTTP (`spp_practicas`)

| Prueba | VUs máx. | Solicitudes | Fallos | `p(95)` | Máx. | Checks |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `smoke.js` | 1 | 10 (1.98 req/s) | 0.00 % | 3.32 ms | 3.89 ms | 100.00 % (15/15) |
| `load.js` | 50 | 36,494 (55.22 req/s) | 0.00 % | 1.64 ms | 78.59 ms | 100.00 % (36,494/36,494) |
| `stress.js` | 200 | 72,897 (75.87 req/s) | 0.00 % | 1.73 ms | 60.78 ms | 100.00 % (72,897/72,897) |

### 2. Prueba integral *full-stack* (6,232 solicitudes totales, 93.53 % checks exitosos)

| Módulo / Endpoint | Servicios y BD | Éxito (`HTTP 200`) | Promedio | `p(95)` | Máx. |
| :--- | :--- | :---: | :---: | :---: | :---: |
| `GET /api/practices` | Monolito + PostgreSQL | 100 % | 257.86 ms | 385.52 ms | 1.05 s |
| `GET /api/notifications` | Monolito → Notif. (`:4000`) → MongoDB | 100 % | 272.16 ms | 425.09 ms | 4.09 s |
| `GET /api/home` | Monolito + PostgreSQL / sesión | 100 % | 843.30 ms | 1.52 s | 2.02 s |
| `GET /api/evaluations/director/evaluaciones` | Monolito → FastAPI (`:8000`) → PostgreSQL | 85 % (163 fallos `504`) | 11.43 s | 1 min | 1 min |
| `GET /api/evaluations/director/resumen` | Monolito → FastAPI (`:8000`) → PostgreSQL | 80 % (240 fallos `504`) | 14.23 s | 1 min | 1 min |

### Capacidad real y cuello de botella identificado

- **Capacidad estable del sistema completo:** **~150 VUs simultáneos** sin errores. El primer `504 Gateway Timeout` ocurrió al alcanzar **154 VUs** (`6m06.8s` de la rampa) en el gateway de evaluaciones.
- **Monolito + Notificaciones (MongoDB):** Soportaron los **200 VUs** con **0 % de errores** y `p(95) <= 1.52 s`.
- **Causa del límite en `servicio_evaluacion`:** Corre con un solo proceso `uvicorn` y endpoints síncronos sobre el pool por defecto de SQLAlchemy en `servicio_evaluacion/backend/app/database.py` (5 conexiones + 10 de overflow = 15 conexiones máximo, más `pool_pre_ping=True`). Para escalar por encima de ~150 VUs concurrentes en evaluaciones, se recomienda aumentar `pool_size`/`max_overflow` y ejecutar múltiples workers en producción.
