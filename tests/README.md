# Tests de regresión del cálculo de bonos

Cubren el cronograma de flujos y, sobre todo, el **rescate anticipado (call)**: es la parte
con más convenciones implícitas y la que más caro sale equivocar.

## Correr

```bash
# desde web/
node --test "tests/**/*.test.mjs"
```

Node 18+ y nada más: sin dependencias, sin build, sin red. Las comillas importan — así el
glob lo expande Node y funciona igual en bash, PowerShell y cmd.

> `node --test tests` (la forma con directorio) **no** funciona en Windows: Node intenta
> resolver la carpeta como si fuera un módulo. Usar el glob.

## Cómo funciona

`index.html` es un único archivo de ~500 KB sin build ni `import`, así que no hay forma de
importar sus funciones. [extract.mjs](extract.mjs) las **recorta del archivo real**
contando llaves y las importa como módulo en memoria (una `data:` URL, sin archivos
temporales).

Esto es deliberado: testear una copia pegada de las funciones no probaría nada: el día que
alguien tocara `index.html` los tests seguirían pasando sobre código viejo.

La contra es que la extracción depende de los **nombres** de las funciones. Si renombrás o
borrás alguna de estas, la extracción falla con un error explícito en vez de dejar los tests
pasando sobre nada:

```
buildSchedule · buildCallCF · activeCallScenarios · applySettlement
calcTIR · tirToTNA · tnaToTIR · tnaBase · _tnaModo · callYield · _rankYTC
adjustDate · yearFrac · dkey · isHoliday · esFinDeMes · addMonths · primerCupon
```

## Qué cubre

| Suite | Qué fija |
|---|---|
| **cronograma base** | cupones, amortización final, interés nunca negativo, y que el corrimiento a día hábil *redistribuya* interés entre períodos sin cambiar el total del bono |
| **devengo con amortización intra-período** | una cuota fuera de fecha de cupón prorratea por tramos de capital (no usa el capital ya reducido para todo el período) |
| **cashflow al call** | stub de interés corrido exacto, precio de call aplicado sobre el capital *vigente*, cuotas posteriores al rescate no se pagan |
| **cuota en la fecha de rescate** | se paga a la **par** y el call redime sólo el remanente; el resultado no depende de que ese día sea feriado |
| **base de anualización** | `diasPeriodo` sale del período nominal del bono, no del stub del call (si no, un bono de cupón anual se anualiza en base 1 en vez de semestral) |
| **rendimiento del call en horizonte corto** | siempre hay retorno simple del período; a pocos días la TIR no converge y aun así el escenario **no** se descarta |
| **escenarios de call vigentes** | ventana futura vs. abierta, condiciones superadas, condiciones inválidas |
| **fechas en días 29-31** ([fechas.test.mjs](fechas.test.mjs)) | sumar meses no desborda (31/01 + 1 → 28/02), un cupón del 29 no queda corrido después de febrero, 30/09 con vto 31/03 paga los 31/03 sin stub de un día, y un ancla del 28 o del 30 se respeta |
| **base de la TNA** ([tna.test.mjs](tna.test.mjs)) | "según cupón" da lo mismo que antes del selector, 180/360 y 90/360 igualan frecuencias, plazo remanente = [(1+TIR)^(d/365) − 1] × 365/d, y cada base es su propia inversa (TNA → TIR → TNA) |

## Si un test falla

Los valores esperados están calculados a mano en los comentarios de cada caso. Antes de
tocar el test, mirá la cuenta: la pregunta es si **cambió el código** o si **cambió la
convención a propósito**. En el segundo caso se actualiza el número *y* el comentario que lo
justifica.

Varios de estos casos vienen de bugs reales encontrados en septiembre de 2026 sobre los
bonos cargados en producción; el historial de `git log` sobre `index.html` tiene el detalle
de cada uno.
