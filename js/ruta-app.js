/* =========================================================================
   RETO PUMA BIKE - Roadbook de la página de Ruta
   Dibuja el perfil de elevación real (assets/data/perfil-*.json) en el riel
   fijo, mueve la huella de puma con el scroll, expande el eje de ancho de los
   títulos al entrar en vista, actualiza la barra inferior móvil y carga el
   mapa Komoot con el patrón de fachada (data-facade). Sin dependencias.
   Requiere servirse por HTTP (el sitio ya usa módulos ES).
   ========================================================================= */

const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Descripciones curadas por punto de paso (es-MX, contexto hñähñu del Mezquital).
const DESCRIPCIONES = {
  'salida': 'El pelotón se forma cuando todavía está oscuro. A las ocho en punto la carretera se abre, el polvo se levanta y arranca la jornada.',
  'meta': 'Cruzas de vuelta al Pabellón Gastronómico. Barbacoa, ximbo y la medalla que confirma que te atreviste a recorrerlo.',
  'abasto': 'Agua, fruta y electrolitos. Rellena aquí: el siguiente tramo es largo y el sol del Mezquital no perdona.',
  'Santiago de El Jaguey': 'Primer poblado del recorrido. El asfalto cede a la terracería y el Valle empieza a mostrar el mezquite y el maguey.',
  'Boxaxni': 'Nombre hñähñu del territorio. Tramo rodador entre parcelas, con el tepetate blanco marcando el camino.',
  'Dajiedhi': 'La primera subida seria de la ruta. Administra la fuerza: lo que se gana aquí se cobra más adelante.',
  'La Estancia': 'Respiro antes del último tercio. Caminos anchos y firmes para recuperar el ritmo.',
  'El Rincón': 'El giro que anuncia el regreso. De aquí en adelante el perfil afloja y la meta se siente cerca.',
};
const descripcion = (punto) =>
  DESCRIPCIONES[punto.nombre] || DESCRIPCIONES[punto.tipo] ||
  'Tramo de camino ancho y rodable por el Valle del Mezquital.';

const nf = new Intl.NumberFormat('es-MX');

// Estado
const rutas = { larga: null, corta: null };
let rutaActual = 'larga';
let longitudTrazo = 0;   // getTotalLength del perfil dibujado en el riel

/* ---- Carga de datos ----------------------------------------------------- */
async function cargarRuta(id) {
  if (rutas[id]) return rutas[id];
  const resp = await fetch(`assets/data/perfil-${id}.json`, { cache: 'no-cache' });
  if (!resp.ok) throw new Error(`No se pudo cargar perfil-${id}.json (${resp.status})`);
  rutas[id] = await resp.json();
  return rutas[id];
}

// Ascenso positivo acumulado (m) hasta cierto km, a partir del perfil.
function desnivelHastaKm(ruta, kmObjetivo) {
  const p = ruta.perfil;
  let acc = 0;
  for (let i = 1; i < p.length; i++) {
    if (p[i][0] > kmObjetivo) break;
    const d = p[i][1] - p[i - 1][1];
    if (d > 0) acc += d;
  }
  return Math.round(acc);
}

/* ---- Métricas del hero -------------------------------------------------- */
function pintarMetricas(ruta) {
  const dificultad = ruta.ruta === 'larga' ? 'Exigente' : 'Media';
  const metricas = [
    { num: nf.format(ruta.kmTotal), unidad: 'km', rot: 'distancia', medido: true },
    { num: `+${nf.format(ruta.desnivelOficial)}`, unidad: 'm', rot: 'desnivel', medido: true },
    { valor: dificultad, rot: 'dificultad' },
    { valor: '100% rodable', rot: 'terreno' },
  ];
  $('[data-metricas]').innerHTML = metricas.map((m) => {
    const cuerpo = m.medido
      ? `<span class="num">${m.num}<span class="rot" style="display:inline;font-size:.5em;margin-left:.3em">${m.unidad}</span></span>`
      : `<span class="num" style="color:var(--cal);font-family:var(--display);font-stretch:82%">${m.valor}</span>`;
    return `<div class="metrica">${cuerpo}<span class="rot">${m.rot}</span></div>`;
  }).join('');
}

/* ---- Notas del roadbook ------------------------------------------------- */
function fachadaMapa(ruta) {
  const src = `https://www.komoot.com/tour/${ruta.komootId}/embed?layout=classic&profile=1`;
  return `<div class="facade" data-facade data-src="${src}" data-title="Mapa Komoot de la ruta ${ruta.etiqueta}" style="--img:url('src/assets/Ruta/${ruta.ruta === 'larga' ? 'RutaC' : 'RutaI'}.webp')">
      <span class="facade__nota">Mapa interactivo · Komoot</span>
      <button class="boton boton--linea" type="button">Cargar mapa</button>
    </div>`;
}
function fotoTerraceria() {
  return `<figure class="foto">
      <img src="src/assets/img/img_3.webp" alt="Ciclistas subiendo por terracería entre mezquites del Valle del Mezquital." loading="lazy" width="2048" height="1827">
      <figcaption>Camino ancho y rodable: terracería y tepetate del Valle.</figcaption>
    </figure>`;
}

function pintarRoadbook(ruta) {
  const poblados = ruta.puntos.filter((p) => p.tipo === 'poblado');
  const pobladoConFoto = poblados[1] || poblados[0];

  const html = ruta.puntos.map((punto) => {
    const kmTxt = Number.isInteger(punto.km) ? punto.km : punto.km.toFixed(2);
    const desnivel = desnivelHastaKm(ruta, punto.km);
    const tipoRot = { salida: 'Salida', meta: 'Meta', abasto: 'Abastecimiento', poblado: 'Poblado' }[punto.tipo] || 'Punto';
    const flag = punto.supuesto ? `<span class="flag" title="Kilómetro por confirmar con el comité">km supuesto</span>` : '';

    let media = '';
    if (punto.tipo === 'salida') media = fachadaMapa(ruta);
    else if (punto === pobladoConFoto) media = fotoTerraceria();

    const nombreMostrado = punto.nombre.replace(' · Pabellón Gastronómico', '');
    const cuerpoInterno = `
      <div>
        <h2 class="display display--medio expandible">${nombreMostrado}</h2>
        ${punto.nombre.includes('Pabellón') ? '<p class="medida">Pabellón Gastronómico, Actopan.</p>' : ''}
        <p class="serif">${descripcion(punto)}</p>
      </div>
      ${media ? `<div>${media}</div>` : ''}`;

    return `<section class="nota${punto.supuesto ? ' supuesto' : ''}" data-km="${punto.km}">
        <div class="nota__km">
          <span class="placa placa--clave"><b>${kmTxt}</b><small>km</small></span>
          <span class="rotulo">
            <span class="tipo">${tipoRot}${flag}</span>
            <span class="desnivel">+${nf.format(desnivel)} m acumulados</span>
          </span>
        </div>
        <div class="nota__cuerpo" ${media ? '' : 'style="grid-template-columns:1fr"'}>
          ${cuerpoInterno}
        </div>
      </section>`;
  }).join('');

  $('[data-roadbook]').innerHTML = html;
  iniciarFachadas();
  observarTitulos();
}

/* ---- Riel: perfil, ticks, huella --------------------------------------- */
function pintarRiel(ruta) {
  const svg = $('[data-riel-svg]');
  if (!svg) return;
  const perfil = ruta.perfil;
  const kmTotal = ruta.kmTotal;
  const alts = perfil.map((p) => p[1]);
  const aMin = Math.min(...alts), aMax = Math.max(...alts);
  const W = 40, H = 1000, xIzq = 8, xDer = 34;

  const d = perfil.map((p, i) => {
    const y = (p[0] / kmTotal) * H;
    const x = xIzq + ((p[1] - aMin) / (aMax - aMin || 1)) * (xDer - xIzq);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');

  $('[data-riel-base]').setAttribute('d', d);
  const hecho = $('[data-riel-hecho]');
  hecho.setAttribute('d', d);
  longitudTrazo = hecho.getTotalLength();
  hecho.style.strokeDasharray = longitudTrazo;
  hecho.style.strokeDashoffset = reduce ? 0 : longitudTrazo;

  // Ticks de kilometraje cada 10 km, más el total.
  const marcas = [];
  for (let km = 0; km <= kmTotal; km += 10) marcas.push(km);
  if (marcas[marcas.length - 1] !== Math.round(kmTotal)) marcas.push(kmTotal);
  $('[data-riel-ticks]').innerHTML = marcas.map((km) => {
    const top = (km / kmTotal) * 100;
    const etq = Number.isInteger(km) ? km : km.toFixed(0);
    return `<div class="riel__tick" style="top:${top.toFixed(2)}%"><span>${etq}</span></div>`;
  }).join('');
}

/* ---- Progreso de scroll -> huella, trazo, lecturas --------------------- */
function progresoScroll() {
  const alto = document.documentElement.scrollHeight - window.innerHeight;
  return alto > 0 ? Math.min(1, Math.max(0, window.scrollY / alto)) : 0;
}

function actualizarProgreso() {
  const ruta = rutas[rutaActual];
  if (!ruta) return;
  const prog = progresoScroll();
  const kmActual = prog * ruta.kmTotal;

  // Riel (solo si visible / sin movimiento reducido para el trazo)
  const huella = $('[data-riel-huella]');
  if (huella && !reduce) {
    huella.style.top = `${(prog * 100).toFixed(2)}%`;
    const hecho = $('[data-riel-hecho]');
    if (hecho && longitudTrazo) hecho.style.strokeDashoffset = longitudTrazo * (1 - prog);
  }
  const kmRiel = $('[data-riel-km]');
  if (kmRiel) kmRiel.textContent = `KM ${kmActual.toFixed(0)}`;

  // Barra inferior móvil
  const desnivel = desnivelHastaKm(ruta, kmActual);
  const prox = ruta.puntos.find((p) => p.km > kmActual + 0.05);
  const proxNombre = prox ? prox.nombre.replace(' · Pabellón Gastronómico', '') : 'Meta';
  const setTxt = (sel, val) => { const el = $(sel); if (el) el.textContent = val; };
  setTxt('[data-barra-km]', kmActual.toFixed(0));
  setTxt('[data-barra-desnivel]', `+${nf.format(desnivel)}`);
  setTxt('[data-barra-prox]', proxNombre);
}

// Scroll pasivo + rAF (sin trabajo pesado por frame)
let ticking = false;
function alScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => { actualizarProgreso(); ticking = false; });
}

/* ---- Títulos: expandir eje de ancho al entrar en vista (§7-3) ---------- */
let observadorTitulos = null;
function observarTitulos() {
  if (reduce) { $$('.expandible').forEach((el) => el.classList.add('en-vista')); return; }
  if (!('IntersectionObserver' in window)) { $$('.expandible').forEach((el) => el.classList.add('en-vista')); return; }
  observadorTitulos?.disconnect();
  observadorTitulos = new IntersectionObserver((entradas) => {
    entradas.forEach((e) => { if (e.isIntersecting) e.target.classList.add('en-vista'); });
  }, { threshold: 0.2 });
  $$('.expandible').forEach((el) => observadorTitulos.observe(el));
}

/* ---- Fachada del mapa Komoot (carga diferida) -------------------------- */
function iniciarFachadas() {
  $$('[data-facade]').forEach((facade) => {
    const boton = facade.querySelector('button');
    boton?.addEventListener('click', () => {
      const iframe = document.createElement('iframe');
      iframe.src = facade.dataset.src;
      iframe.title = facade.dataset.title || 'Mapa del recorrido';
      iframe.loading = 'lazy';
      iframe.allowFullscreen = true;
      iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      facade.replaceChildren(iframe);
    }, { once: true });
  });
}

/* ---- Selector de ruta --------------------------------------------------- */
async function cambiarRuta(id) {
  if (id === rutaActual && rutas[id]) return;
  const ruta = await cargarRuta(id);
  rutaActual = id;
  $$('[data-ruta-btn]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.rutaBtn === id)));
  pintarMetricas(ruta);
  pintarRoadbook(ruta);
  pintarRiel(ruta);
  actualizarProgreso();
}

/* ---- Navegación móvil --------------------------------------------------- */
function iniciarNav() {
  const toggle = $('[data-nav-toggle]');
  const nav = $('#nav-indice');
  toggle?.addEventListener('click', () => {
    const abierto = nav.classList.toggle('abierto');
    toggle.setAttribute('aria-expanded', String(abierto));
  });
  nav?.addEventListener('click', (e) => {
    if (e.target.closest('a')) { nav.classList.remove('abierto'); toggle?.setAttribute('aria-expanded', 'false'); }
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { nav?.classList.remove('abierto'); toggle?.setAttribute('aria-expanded', 'false'); }
  });
}

/* ---- Arranque ----------------------------------------------------------- */
async function iniciar() {
  $$('[data-anio]').forEach((el) => { el.textContent = new Date().getFullYear(); });
  iniciarNav();
  $$('[data-ruta-btn]').forEach((b) => b.addEventListener('click', () => cambiarRuta(b.dataset.rutaBtn)));
  observarTitulos(); // para el título del hero antes de cargar datos

  try {
    await cambiarRuta('larga');
  } catch (err) {
    console.error(err);
    const cont = $('[data-roadbook]');
    if (cont) cont.innerHTML = `<section class="nota"><div class="nota__cuerpo" style="grid-template-columns:1fr"><div><h2 class="display display--medio">No pudimos cargar el perfil</h2><p class="serif medida">Sirve el sitio con un servidor estático (no lo abras con file://) para ver el roadbook. Error: ${err.message}</p></div></div></section>`;
  }

  window.addEventListener('scroll', alScroll, { passive: true });
  window.addEventListener('resize', () => { pintarRiel(rutas[rutaActual]); actualizarProgreso(); }, { passive: true });
  actualizarProgreso();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
else iniciar();
