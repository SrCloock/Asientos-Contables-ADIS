# Handoff — Asientos Contables ADIS

## Objetivo
App web para crear asientos contables en Sage200 (facturas proveedor, pagos, ingresos/gastos de caja). Objetivo inmediato: corregir vulnerabilidades de seguridad críticas antes de seguir añadiendo funcionalidad.

## Estado actual
- App funcional con 4 formularios (Form4–7) + historial
- Sin modificaciones de código en esta sesión — solo revisión
- Pendiente: aplicar correcciones de seguridad identificadas

## Archivos activos
- [Backend/server.js](Backend/server.js) — ~3.000 líneas, monolítico, contiene toda la lógica backend
- [Backend/.env](Backend/.env) — configuración de entorno (incompleta: faltan credenciales DB)
- [frontend/src/config/config.js](frontend/src/config/config.js) — URL del backend hardcodeada a IP fija
- [frontend/src/context/AuthContext.js](frontend/src/context/AuthContext.js) — manejo global de sesión
- [frontend/src/pages/FormPage4.jsx](frontend/src/pages/FormPage4.jsx) — Facturas proveedor IVA no deducible
- [frontend/src/pages/FormPage5.jsx](frontend/src/pages/FormPage5.jsx) — Pagos a proveedor
- [frontend/src/pages/FormPage6.jsx](frontend/src/pages/FormPage6.jsx) — Ingresos de caja
- [frontend/src/pages/FormPage7.jsx](frontend/src/pages/FormPage7.jsx) — Gastos directos de caja
- [frontend/src/pages/HistorialAsientos.jsx](frontend/src/pages/HistorialAsientos.jsx) — Historial con filtros y paginación

## Cambios recientes
- Ninguno en código. Se realizó revisión completa en sesión 2026-06-22.

## Intentos realizados
- Revisión de arquitectura y seguridad (completa, sin tocar código aún)

## Problemas / bloqueos

**Críticos (sin corregir):**
- Credenciales DB hardcodeadas en `server.js` línea ~98: `user: 'logic'`, `password: 'admin2025'`
- Interpolación directa en query `/api/contador` → riesgo SQL injection
- Sin HTTPS → cookies de sesión en texto plano
- Sin rate limiting en `/login` → vulnerable a fuerza bruta

**Altos (sin corregir):**
- Sin validación server-side — cualquiera puede llamar la API con datos arbitrarios
- Sin protección CSRF
- URL backend hardcodeada: `http://192.168.200.236:5000` en `config.js`

**Deuda técnica:**
- `server.js` con ~3.000 líneas sin separar en módulos
- FormPage4/5 con ~700 líneas c/u y lógica duplicada
- Sin tests
- Números mágicos sin nombre (`'40000000'`, `'4100'`, etc.)

## Próximos pasos
1. Mover credenciales DB a variables de entorno en `.env` y actualizarlas en `server.js`
2. Corregir interpolación SQL en endpoint `/api/contador` → usar parámetro `@ejercicio`
3. Agregar rate limiting en `/login` (instalar `express-rate-limit`)
4. Agregar validación server-side con `express-validator` en endpoints POST
5. Cambiar URL del backend en `config.js` a variable de entorno (`REACT_APP_API_URL`)
6. (Posterior) Dividir `server.js` en rutas/controladores/servicios
