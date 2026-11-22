# Pruebas de rendimiento de SPP con k6

Estas pruebas iniciales miden la disponibilidad y latencia HTTP del monolito Node/Express de SPP. No realizan inicios de sesión, escrituras ni operaciones destructivas.

## Antes de comenzar

1. Ejecuta SPP localmente y confirma que abre en `http://localhost:3000`.
2. Comprueba en el navegador `http://localhost:3000/healthz`; debe responder `{"status":"ok"}`.
3. Instala k6: https://grafana.com/docs/k6/latest/set-up/install-k6/
4. Abre una terminal en la raíz del repositorio.

> Ejecutar k6 y SPP en el mismo computador comparte CPU, memoria y red. El resultado mide la capacidad de esa máquina ejecutando aplicación y generador de carga juntos; no equivale a la capacidad de un servidor de producción. Cierra programas pesados y registra las especificaciones del equipo.

## 1. Smoke test

Verifica que los endpoints públicos básicos responden correctamente:

```powershell
k6 run .\k6\smoke.js
```

## 2. Prueba de carga gradual

Sube hasta 50 usuarios virtuales y mantiene cada nivel para observar latencia y errores:

```powershell
k6 run .\k6\load.js
```

## 3. Prueba de estrés

Aumenta progresivamente hasta 200 usuarios virtuales. Úsala después de que el smoke y load test pasen:

```powershell
k6 run .\k6\stress.js
```

## Cambiar la URL

Por defecto se usa `http://localhost:3000`. Para otro puerto, en PowerShell:

```powershell
$env:BASE_URL = "http://localhost:3001"
k6 run .\k6\load.js
```

## Interpretación inicial

- `vus`: usuarios virtuales activos (no necesariamente personas conectadas o sesiones reales).
- `http_req_duration p(95)`: el 95 % de las solicitudes terminó en ese tiempo o menos.
- `http_req_failed`: proporción de solicitudes HTTP fallidas.
- `checks`: proporción de validaciones funcionales que pasaron.

Objetivo inicial para la prueba de carga: menos del 1 % de solicitudes fallidas y p95 menor de 2 segundos. Son umbrales de evaluación, no una garantía de capacidad. En estrés se permiten umbrales más amplios para identificar el punto de degradación.

## Alcance y siguiente etapa

Estos scripts son una línea base HTTP sobre `/healthz` y `/api/config`; no prueban todavía autenticación, consultas PostgreSQL/MongoDB, carga de archivos, ni los microservicios FastAPI (8000) y notificaciones (4000). Esas pruebas requieren diseñar escenarios de lectura/autenticación con cuentas de prueba y medir cada servicio por separado. No apuntes pruebas de escritura o estrés a datos reales.
