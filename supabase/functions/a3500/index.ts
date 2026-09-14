// A3500 en vivo para la calculadora dlk.
//
// El A3500 es el tipo de cambio de referencia que el BCRA publica al CIERRE de
// cada rueda: durante el dia todavia no existe. Por eso esta funcion devuelve:
//
//   rueda abierta (lun-vie 10:00-15:00 ART) -> ultimo operado del mayorista
//   rueda cerrada                           -> PPN del indice ARS-MAE
//
// El PPN es el promedio ponderado del dia y su valor final es, literalmente, el
// A3500 que despues publica el BCRA (verificado: identico al centavo los 168
// dias habiles de 2026; durante 2025 diferian, hasta $20).
//
// Esta funcion existe porque la API del MAE no manda cabeceras CORS -- ni
// siquiera en el preflight -- asi que el browser no puede consultarla directo
// desde GitHub Pages. Aca se resuelve del lado servidor.

const MAE = "https://api.marketdata.mae.com.ar/api/mercado";
const BCRA = "https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/5";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Content-Type": "application/json; charset=utf-8",
  // La pagina refresca cada 30s y el MAE recalcula con esa misma cadencia. El
  // cache evita multiplicar los requests al MAE por cada visitante abierto.
  "Cache-Control": "public, max-age=30",
};

type Dato = { valor: number; fecha: string; tipo: string; fuente: string };

/** Hora de Buenos Aires: el runtime corre en UTC. */
function ahoraART(): { dow: number; minutos: number } {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const g = (t: string) => partes.find((p) => p.type === t)?.value ?? "";
  const dias = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return { dow: dias.indexOf(g("weekday")),
           minutos: parseInt(g("hour"), 10) * 60 + parseInt(g("minute"), 10) };
}

/** FOREX mayorista del MAE: lun-vie 10:00-15:00 ART (documentado por el MAE). */
function ruedaAbierta(): boolean {
  const { dow, minutos } = ahoraART();
  return dow >= 1 && dow <= 5 && minutos >= 600 && minutos < 900;
}

async function json(url: string): Promise<unknown | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

/** Ultimo precio operado del dolar mayorista contado inmediato. */
async function ultimoOperado(): Promise<Dato | null> {
  const rows = await json(`${MAE}/datos/FOR`);
  if (!Array.isArray(rows)) return null;
  // UST$T es el dolar transferencia contra pesos. De sus cuatro combinaciones,
  // plazo 000 (contado inmediato) en segmento Mayorista es la de mayor volumen
  // por lejos (~272M USD contra ~107M de la que le sigue).
  const x = rows.find((y: Record<string, unknown>) =>
    String(y?.ticker ?? "").trim().toUpperCase() === "UST$T" &&
    String(y?.plazo ?? "") === "000" &&
    String(y?.segmento ?? "").toLowerCase().startsWith("mayorista"));
  const v = Number((x as Record<string, unknown>)?.ultimo);
  // datos/FOR no trae timestamp propio y fechaLiquidacion viene en 0001-01-01,
  // asi que sellamos con la hora del fetch. El MAE recalcula cada ~30s, con un
  // retraso declarado de 5-15 min sobre la operacion real.
  return v > 0
    ? { valor: v, fecha: new Date().toISOString(), tipo: "operado", fuente: "MAE" }
    : null;
}

/** PPN del indice ARS-MAE: el ultimo del dia es el A3500 que publica el BCRA. */
async function ppnDelDia(): Promise<Dato | null> {
  const rows = await json(`${MAE}/indiceARS`);
  if (!Array.isArray(rows)) return null;
  const ppn = rows
    .filter((x: Record<string, unknown>) => x?.tipo === "PPN" && Number(x?.valor) > 0)
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  const u = ppn.at(-1) as Record<string, unknown> | undefined;
  return u ? { valor: Number(u.valor), fecha: String(u.fecha), tipo: "ppn", fuente: "MAE" } : null;
}

/** Respaldo: ultimo cierre publicado por el BCRA, si el MAE no responde. */
async function cierreBCRA(): Promise<Dato | null> {
  const desde = new Date(Date.now() - 15 * 864e5).toISOString().slice(0, 10);
  const hasta = new Date().toISOString().slice(0, 10);
  const j = await json(`${BCRA}?Desde=${desde}&Hasta=${hasta}&Limit=3000`) as
    { results?: { detalle?: { fecha: string; valor: number }[] }[] } | null;
  const det = j?.results?.[0]?.detalle ?? [];
  // El orden no esta garantizado, asi que nos quedamos con la fecha mayor.
  const u = det.reduce<{ fecha: string; valor: number } | null>(
    (a, b) => (!a || b.fecha > a.fecha ? b : a), null);
  return u && Number(u.valor) > 0
    ? { valor: Number(u.valor), fecha: u.fecha, tipo: "cierre", fuente: "BCRA" }
    : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const abierta = ruedaAbierta();
  // Si la rueda recien abrio y todavia no hubo operaciones, ultimoOperado() no
  // devuelve nada: ahi cae al PPN, y recien despues al cierre del BCRA.
  const dato = (abierta ? await ultimoOperado() : null)
    ?? await ppnDelDia()
    ?? await cierreBCRA();
  if (!dato) {
    return new Response(JSON.stringify({ error: "sin dato disponible" }),
                        { status: 502, headers: CORS });
  }
  return new Response(JSON.stringify({ ...dato, rueda_abierta: abierta }), { headers: CORS });
});
