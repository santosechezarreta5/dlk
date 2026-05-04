# BonosCorp AR · Dollar Linked — Checkpoint del proyecto

Versión: **v2.0** (Supabase backend + GitHub Pages ready)
Base: clonado de `bonoscorp-ar-v25` (proyecto Hard Dollar)

---

## Cambios v2.0 — Migración a backend compartido ✅

### Arquitectura
- **Frontend**: estático, deployable en GitHub Pages.
- **Backend**: Supabase (Postgres + Auth + Realtime).
- **Local (LocalStorage)**: precios manuales por usuario, override A3500, alertas, columnas elegidas.
- **Compartido (Supabase)**: catálogo de bonos (BASE_META compartido + editado por admin).

### Capa Catalog (módulo IIFE)
- `Catalog.loadAll()` — fetch del catálogo (Supabase si configurado, BASE_META hardcodeado como fallback).
- `Catalog.upsert(bond)` — crear/editar (requiere sesión admin).
- `Catalog.remove(ticker)` — eliminar (requiere sesión admin).
- `Catalog.login(email, pass)` / `Catalog.logout()` — auth con email+password.
- `Catalog.onCatalogChange(fn)` — Supabase Realtime: cambios de otros admins se reflejan en vivo sin recargar.

### UI
- Botón **🔒 Admin** en el header (solo visible si Supabase configurado).
- Modal de login con email+password. Sesión persistida en localStorage por Supabase SDK.
- En modo "remote-only" (Supabase activo, sin sesión): se ocultan botones Editar / Eliminar / Nuevo bono.
- Toast notifications: éxito en verde, error en rojo, info de cambios remotos en amarillo.

### Compatibilidad
- Si `SUPABASE_CONFIG` está vacío → la app sigue funcionando 100% offline con BASE_META hardcodeado. Cambios solo en LocalStorage.
- Si Supabase está configurado pero el SDK no carga → fallback automático a BASE_META.

### Archivos generados
- `supabase_migration.sql` — schema + RLS + 64 INSERTs. Correr una vez en Supabase SQL Editor.
- `SETUP.md` — guía paso a paso para deployar.

### Tests
- Modo offline (sin Supabase configurado): 64 bonos cargados desde BASE_META, botón Admin oculto, body sin clase `remote-only`.
- Pendiente: testear con instancia Supabase real (lo hacés vos siguiendo `SETUP.md`).

---

## Cambios v1.7 (esta versión) ✅

### 1. Eliminados filtros y columnas de Legislación / Jurisdicción

Para los DL no aportan valor — todos son ARG/ARG. Se quitaron:
- Filtros laterales "Legislación" y "Jurisdicción"
- Columnas en la tabla principal (`leg`, `jur`)
- Inputs en el panel calculadora (sección "Datos del bono")
- Inputs en el modal "Agregar bono"
- Campos en el engine de alertas

La metadata `b.leg` y `b.jur` se mantiene en memoria con default `'Argentina'` para no romper la persistencia ni futuros cambios.

### 2. Generador rápido de cronograma de amortizaciones

Cuando el bono está en modo "cuotas" y entra en modo edit, aparece un panel "⚡ Generador rápido" con 3 inputs:

- **Fecha 1° pago** — pre-llenada con `inicio_int` del bono
- **Periodicidad** — Mensual / Trimestral / Semestral / Anual
- **N° de pagos** — entre 1 y 120

Al apretar "▶ Generar cronograma":
- Se distribuye 100% en N cuotas iguales
- La última cuota absorbe el redondeo (ej. 100/3 = 33.33% / 33.33% / 33.34%)
- Las filas generadas son **totalmente editables** (no readonly): podés ajustar fechas o porcentajes uno por uno después
- Si ya hay cuotas, pide confirmación antes de reemplazar
- Feedback verde "✓ N cuotas generadas..." durante 4s

### Tests funcionales pasados v1.7
- 0 filtros de leg/jur, 3 de callable
- Generador visible solo en edit mode
- 4 cuotas trimestrales 25% c/u → suma 100% → flujos correctos
- Pre-llenado de fecha funciona

---

## Cambios v1.6 (esta versión) ✅

### A3500 editable manualmente

Ahora el panel FX permite pisar el valor del A3500 que llega de dolarapi.com con un valor manual:

- **Click en el A3500** (con icono ✎) abre el modo edición con dos inputs (bid / ask).
- Botón **OK** guarda el valor y aplica inmediatamente. Aparece el badge **"MANUAL"** y un botón ↺ para volver al valor de mercado.
- El valor manual se persiste en `localStorage` (clave `bonosdl_manual_a3500`) — sobrevive a recargas y refrescos automáticos cada 30s.
- Mientras el override esté activo, los refrescos de `fetchFX()` siguen capturando el A3500 de mercado pero sin pisarlo en pantalla. Al resetear, vuelve al último valor de mercado conocido.

Al cambiar el A3500:
1. Se recalcula `precio_usd_eq` para todos los bonos
2. Se recalcula la TIR de todos los bonos
3. Se actualiza la brecha MEP/A3500 del panel FX
4. Se re-renderiza la tabla principal y stats globales
5. Si hay un bono abierto en el panel, se vuelven a calcular sus flujos

### Tests funcionales pasados v1.6
- Override 1380→1500: precio_usd_eq AER5O bajó de 100.36 → 92.22, TIR subió de -0.06% → 1.40%
- Persistencia en localStorage verificada
- Reset vuelve a valor de mercado y restaura TIRs originales

---

## Cambios v1.5 (esta versión) ✅

### Bug fix crítico: amortizaciones que no caen en fecha de cupón

Antes: si una cuota de amortización (ej. 33.33% al 19/05) no coincidía con ninguna fecha de cupón teórica (19/02, 19/08), se asignaba al cupón más cercano hasta 15 días o se descartaba — **provocando que la cuota intermedia se "perdiera" y se acumulara en el último flujo**, dando resultados incorrectos.

Ahora: nueva función `buildSchedule()` que **fusiona en una única lista ordenada de eventos** los cupones teóricos y las amortizaciones manuales:
- Si la amort cae ±5 días de un cupón → se suma a ese cupón
- Si la amort NO coincide con ningún cupón → genera un evento independiente "amort_only" sin interés
- En el venc final, se paga el capital remanente automáticamente
- Tope de seguridad: 240 cupones máximo (anti-loop)

`generateCashflows()` y `generateScheduleAll()` ahora son wrappers de `buildSchedule()`.

### Mejora visual
- Filas con `interes=0 && amort=0` se filtran del render del CF (antes mostraban basura).

### Tests funcionales pasados v1.5
- AER9O con 3 cuotas (19/02, 19/05, 19/08 al 33.33% c/u): las 3 aparecen, capital vigente decrece 100→67→33, TIR 1.66%, suma VP coincide con precio sucio.

---

## Cambios v1.4 (esta versión) ✅

### Cambios solicitados
1. **Cronograma de Pagos eliminado** — duplicaba los Flujos de Caja. Toda la información ahora se muestra en una única tabla.
2. **Flujos de Caja muestra todos los pagos** — incluyendo los ya cobrados (en gris, marcados "(pagado)"). Los pagos futuros llevan VP descontado por TIR; los pasados muestran "—" en VP.
3. **Auto-render al abrir bono** — la tabla de Flujos de Caja aparece automáticamente al abrir un bono con precio cargado, sin necesidad de presionar "Calcular".
4. **Auto-recalc al editar precio o amortización** — debounced 350ms.
5. **Encabezado de la tabla muestra el precio usado** — "Precio usado para descuento: $145.000 ARS · 104.50 %VN (USD-eq)".
6. **Auto-fill del cronograma de amortización** — al pasar a tipo "cuotas" y agregar filas manuales, se inserta automáticamente una fila final al vencimiento con `100% - suma_manual`. Esa fila auto está marcada con `data-auto="1"`, disabled, fondo verde tenue, y badge "AUTO".

### Tests funcionales pasados v1.4
- EAC1O abre y muestra automáticamente 6 cupones + suma VP
- Precio ref correcto: $145.000 ARS · 104.50 %VN
- Pagos pasados en gris con VP "—"
- Auto-fill amort: agregue cuota 30% al 12/4/2026 → apareció auto-row 70% al venc 12/10/2026 con disabled=true

---

## Cambios v1.3 (esta versión) ✅

### Nueva sección: Cronograma de Pagos

Después de la sección "Flujos de Caja" en la calculadora, ahora aparece "Cronograma de Pagos" con tres columnas:
- **Fecha**: del cupón ajustado por feriados
- **Amortización** (en ARS proyectados al A3500 spot)
- **Interés** (en ARS proyectados al A3500 spot)

Características:
- Muestra **TODOS los pagos** del bono — incluyendo los ya cobrados (vencidos antes de hoy)
- Los pagos pasados se renderizan en gris con etiqueta "(pagado)"
- Fila final con totales acumulados de amortización e interés
- Función nueva `generateScheduleAll()` — variante de `generateCashflows` sin filtro de pasados, con guarda anti-loop infinito (cap a 200 cupones)

### Tests funcionales pasados v1.3
- EAC1O (cupón 1%, venc 2026-10): 6 cupones → 5 marcados como pagados, 1 futuro
- AER5O (cupón 0%, bullet): 1 fila al venc con solo amortización
- Total acumulado de interés calculado correctamente

---

## Cambios v1.2 (esta versión) ✅

### Correcciones críticas
1. **Operación 100% en ARS** — eliminada la pestaña "USD eq.". El usuario ve y edita precios en pesos. La conversión a USD-eq sucede internamente para calcular TIR/TNA.
2. **Fórmula de conversión ARS → USD-eq corregida** — la versión anterior tenía un factor /1000 incorrecto que daba TIRs absurdas (228.35%). Ahora: `precio_USD_eq = precio_ARS / A3500` (resultado en %VN, ej: 100.36%).
3. **TIR promedio: 2 decimales** — `.toFixed(1)` → `.toFixed(2)` con `Number(b.tir)` para evitar concatenación de string.
4. **Precio promedio: formato ARS con miles** — antes mostraba `% val. nominal`. Ahora `$ 140.917 · ARS · VN 100k`.
5. **Cupón=0 permitido en calculadora** — antes el guard `isNaN(cupon)` bloqueaba el botón Calcular cuando el campo estaba vacío. Ahora trata vacío como 0.
6. **Banner file:// + auto-stop refresh** — detecta cuando se abre sin servidor y avisa al usuario; detiene los reintentos automáticos para evitar OOM.

### Inputs y outputs de la calculadora
- Input "Precio ARS (por VN 100k)" — ej: 138500
- Mini panel: muestra USD-eq derivado (% VN) y A3500 spot
- Resultados: TIR/TNA en USD-eq · T+1, Precio limpio/sucio en ARS con formato miles
- Cashflows en ARS (proyectados al A3500 spot)

### Tests funcionales pasados
- Carga de la página sin errores JS
- Click en bono abre el panel con título y datos correctos
- Mini panel dl-equiv muestra USD-eq correctamente (139250 ARS / 1387.5 → 100.36%)
- Boton Calcular produce: TIR -0.06%, TNA -0.06%, Precio limpio/sucio $139.250
- Cashflow muestra fila final con Amort=$138.750, Total=$138.750, VP=$139.250
- Suma VP coincide con precio sucio
- Stats globales: TIR Promedio -6.76%, Precio Prom $140.917

---

## Versiones anteriores

### v1.1 (correcciones de robustez)
- Deteccion de file:// con banner
- Auto-stop del refresh interval tras 5 fallos
- Skip del fallback /api/oficial cuando es file://

### v1.0 (primer entregable)
- 64 ONs DL del screener cargados en BASE_META
- Panel FX: A3500 + MEP + Brecha
- fetchAll usa ticker O (ARS) en vez de D (USD MEP)
- server.js con proxy /api/oficial a dolarapi.com

---

## Estructura de archivos

```
/bonosdl_v1/
- CHECKPOINT.md           - este archivo
- index.html              - ~3825 lineas
- server.js
- package.json
- bonos_template.xlsx     - sin actualizar (TODO)
```

## Para correr

```bash
# Opcion A (recomendado): con servidor
unzip bonosdl-ar-v1.2.zip
cd bonosdl_v1
node server.js
# - abrir http://localhost:3000

# Opcion B (sin datos en vivo, solo UI):
# Extraer ZIP a carpeta normal (NO Temp/dentro del ZIP)
# Doble click en index.html
```

## Pendientes (para proxima ronda)

- **Filas vacias en cashflow** - para bonos cupon=0, las filas intermedias muestran todo "-". Considerar esconderlas u ocultarlas en un toggle.
- **Excel template** - sigue siendo del proyecto HD, columnas no aplican a DL.
- **Vista Pagos** - calendario de pagos proximos: verificar que muestre montos en ARS.
- **Curva de rendimientos** - eje Y dice "TIR %"; aclarar "TIR USD-eq %".
- **Bonos sin operar (37/64)** - verificar comportamiento visual cuando no hay precio.
- **Cupon=0 + ZC puro** - la rama de recalcTIR para bonos sin cupon usa formula simplificada que no es exacta para DL con amortizaciones intermedias. Para AER5O con bullet 100% al venc funciona. Para bonos con valor_residual<1 (ya amortizo parte) puede no ser exacta.

## Notas tecnicas

### Formulas USD-eq
```
precio_USD_eq (%VN) = precio_ARS / A3500
precio_ARS = precio_USD_eq * A3500
```

- **Bid/Ask de la tabla**: b.bid y b.ask estan en ARS. b.precio_usd_eq es derivado para TIR.
- **MONEDA_TAB fijo en 'ars'**: la variable se mantiene por compatibilidad con codigo legacy pero no cambia.
