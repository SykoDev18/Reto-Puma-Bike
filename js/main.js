import { CONFIG } from './config.js';
import { CATEGORIAS } from '../data/categorias.js';
import { PATROCINADORES } from '../data/patrocinadores.js';

const paginas = [
  ['inicio', 'index.html', 'Inicio'], ['rutas', 'rutas.html', 'Ruta'], ['categorias', 'categorias.html', 'Categorías'],
  ['inscripciones', 'inscripciones.html', 'Inscripciones'], ['resultados', 'resultados.html', 'Resultados'], ['coleccion', 'coleccion.html', 'Colección'], ['hoteles', 'hoteles.html', 'Hoteles'],
];

const waUrl = (mensaje) => `https://wa.me/${CONFIG.contacto.whatsapp}?text=${encodeURIComponent(mensaje)}`;

function renderEstructura() {
  const pagina = document.body.dataset.page;
  const nav = paginas.map(([id, href, nombre]) => `<a href="${href}" ${pagina === id ? "aria-current=\"page\"" : ''} class="${CONFIG.estado === 'postevento' && id === 'resultados' ? 'nav-destacado' : ''}">${nombre.toUpperCase()}</a>`).join('');
  const ctaHref = CONFIG.estado === 'postevento' ? 'resultados.html' : 'inscripciones.html';
  const ctaTexto = CONFIG.estado === 'postevento' ? 'Ver resultados' : 'Inscríbete';
  const cabecera = document.querySelector('[data-site-header]');
  if (cabecera) cabecera.innerHTML = `<a class="skip-link" href="#contenido">Saltar al contenido</a><nav class="nav" aria-label="Navegación principal"><a class="marca" href="index.html"><img src="assets/img/logo-reto-puma-bike.svg" alt=""><span>RETO PUMA BIKE</span></a><button class="nav-toggle" type="button" aria-expanded="false" aria-controls="navegacion">☰<span class="visually-hidden">Abrir menú</span></button><div class="nav-links" id="navegacion">${nav}</div><a class="boton boton--chico" href="${ctaHref}">${ctaTexto}</a></nav>`;
  const footer = document.querySelector('[data-site-footer]');
  if (footer) footer.innerHTML = `<div class="contenedor footer-grid"><div><h2>Reto Puma Bike</h2><p>Más que una competencia: es un desafío, una conexión y una celebración de cada kilómetro recorrido.</p></div><div><h3>Navega</h3><ul>${paginas.map(([, href, nombre]) => `<li><a href="${href}">${nombre}</a></li>`).join('')}</ul></div><div><h3>Contacto</h3><ul><li><a href="mailto:${CONFIG.contacto.email}">${CONFIG.contacto.email}</a></li><li>${CONFIG.contacto.direccion}</li><li><a href="${CONFIG.redes.instagram}" target="_blank" rel="noreferrer">Instagram</a> · <a href="${CONFIG.redes.facebook}" target="_blank" rel="noreferrer">Facebook</a> · <a href="${CONFIG.redes.youtube}" target="_blank" rel="noreferrer">YouTube</a></li></ul></div></div><div class="contenedor footer-final">© <span data-anio></span> Reto Puma Bike. Todos los derechos reservados.</div>`;
}

function iniciarNavegacion() {
  const header = document.querySelector('.site-header');
  const boton = document.querySelector('.nav-toggle');
  const enlaces = document.querySelector('.nav-links');
  const cerrar = () => { enlaces?.classList.remove('abierto'); boton?.setAttribute('aria-expanded', 'false'); };
  boton?.addEventListener('click', () => { const abierto = enlaces.classList.toggle('abierto'); boton.setAttribute('aria-expanded', String(abierto)); });
  enlaces?.addEventListener('click', (event) => { if (event.target.matches('a')) cerrar(); });
  window.addEventListener('scroll', () => header?.classList.toggle('scrolled', window.scrollY > 12), { passive: true });
  window.addEventListener('keydown', (event) => { if (event.key === 'Escape') cerrar(); });
}

function iniciarEstado() {
  document.body.classList.toggle('postevento', CONFIG.estado === 'postevento');
  document.querySelectorAll('[data-anio]').forEach((elemento) => { elemento.textContent = new Date().getFullYear(); });
  document.querySelectorAll('[data-fecha]').forEach((elemento) => { elemento.textContent = CONFIG.fechaTexto; });
  document.querySelectorAll('[data-edicion]').forEach((elemento) => { elemento.textContent = CONFIG.edicion; });
  document.querySelectorAll('[data-anio-evento]').forEach((elemento) => { elemento.textContent = CONFIG.anioEvento; });
  document.querySelectorAll('[data-sede]').forEach((elemento) => { elemento.textContent = CONFIG.sede; });
  document.querySelectorAll('[data-hora]').forEach((elemento) => { elemento.textContent = CONFIG.horaArranque; });
  document.querySelectorAll('[data-whatsapp-inscripcion]').forEach((elemento) => { elemento.href = waUrl(`Hola, quiero inscribirme al Reto Puma Bike ${CONFIG.anioEvento}. Nombre: ___ / Fecha de nacimiento: ___ / Sexo: ___ / Ruta: ___ / Kit: ___`); });
  const titulo = document.querySelector('[data-hero-titulo]');
  if (titulo && CONFIG.estado === 'postevento') titulo.innerHTML = 'RESULTADOS<em>4ª EDICIÓN</em>';
  const contador = document.querySelector('[data-countdown]');
  if (contador) {
    if (CONFIG.estado === 'postevento') contador.innerHTML = `<div><b class="dato">—</b><span>finishers</span></div><div><b class="dato">${CATEGORIAS.length}</b><span>categorías</span></div>`;
    else actualizarContador(contador);
  }
}

function actualizarContador(contenedor) {
  const destino = new Date(`${CONFIG.fecha}T08:00:00-06:00`).getTime();
  const pintar = () => {
    const restante = Math.max(0, destino - Date.now());
    const dias = Math.floor(restante / 86400000); const horas = Math.floor(restante % 86400000 / 3600000); const minutos = Math.floor(restante % 3600000 / 60000);
    contenedor.innerHTML = [[dias, 'días'], [horas, 'horas'], [minutos, 'minutos']].map(([numero, etiqueta]) => `<div><b>${String(numero).padStart(2, '0')}</b><span>${etiqueta}</span></div>`).join('');
  };
  pintar(); window.setInterval(pintar, 60000);
}

export function iniciarFacades() {
  document.querySelectorAll('[data-facade]').forEach((facade) => {
    const boton = facade.querySelector('button');
    boton?.addEventListener('click', () => {
      const iframe = document.createElement('iframe');
      iframe.src = facade.dataset.src; iframe.title = facade.dataset.title || 'Contenido del evento'; iframe.loading = 'lazy'; iframe.allowFullscreen = true;
      iframe.setAttribute('frameborder', '0'); iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      if (facade.dataset.kind === 'youtube') { iframe.width = '560'; iframe.height = '315'; iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'); }
      if (facade.classList.contains('facade--mapa')) { iframe.width = '100%'; iframe.height = '700'; }
      facade.replaceChildren(iframe);
    }, { once: true });
  });
}

function iniciarRevelados() {
  const elementos = document.querySelectorAll('.revelar');
  if (!('IntersectionObserver' in window)) return elementos.forEach((elemento) => elemento.classList.add('visible'));
  const observador = new IntersectionObserver((entradas) => entradas.forEach((entrada) => { if (entrada.isIntersecting) { entrada.target.classList.add('visible'); observador.unobserve(entrada.target); } }), { threshold: .12 });
  elementos.forEach((elemento) => observador.observe(elemento));
}

function iniciarCarrusel() {
  const slides = [...document.querySelectorAll('[data-aviso-slide]')];
  const puntos = [...document.querySelectorAll('[data-aviso-punto]')];
  const mostrar = (indice) => { slides.forEach((slide, i) => slide.classList.toggle('activo', i === indice)); puntos.forEach((punto, i) => punto.setAttribute('aria-current', String(i === indice))); };
  puntos.forEach((punto, indice) => punto.addEventListener('click', () => mostrar(indice)));
}

function renderDatosComunes() {
  const patrocinadores = document.querySelector('[data-patrocinadores]');
  if (patrocinadores) patrocinadores.innerHTML = PATROCINADORES.map((patrocinador) => `<article class="patrocinador"><span>${patrocinador.nombre}</span></article>`).join('');
  const principales = document.querySelector('[data-patrocinadores-principales]');
  if (principales) principales.innerHTML = PATROCINADORES.filter((item) => item.nivel === 'principal').map((item) => `<article class="patrocinador"><span>${item.nombre}</span></article>`).join('');
  const destacadas = document.querySelector('[data-categorias-destacadas]');
  if (destacadas) destacadas.innerHTML = CATEGORIAS.filter((categoria) => ['X', 'Y', 'N', 'H', 'EBV', 'CF'].includes(categoria.clave)).map((categoria) => `<article class="tarjeta categoria"><span class="placa"><b>${categoria.clave}</b></span><div><p class="kicker">${categoria.grupo}</p><h3>${categoria.nombre}</h3><p class="texto-gris">${categoria.descripcionEdad} · ${categoria.vueltas} vueltas</p></div></article>`).join('');
  const kits = document.querySelector('[data-kits]');
  if (kits) kits.innerHTML = CONFIG.kits.map((kit) => `<article class="tarjeta ${kit.nombre === 'Kit Puma' ? 'tarjeta--oro' : ''}"><p class="kicker">${kit.nombre}</p><p class="dato">$${kit.precio} MXN</p><ul>${kit.incluye.map((item) => `<li>${item}</li>`).join('')}</ul></article>`).join('');
  const rutas = document.querySelector('[data-rutas-destacadas]');
  if (rutas) rutas.innerHTML = [
    ['corta', 'Ruta corta', 'Terracería, caminos rurales y vistas para rodar con cabeza fría.', '★★★☆☆'],
    ['larga', 'Ruta larga', 'Más desnivel, más territorio y una jornada para medir tu fuerza.', '★★★★☆'],
  ].map(([id, nombre, descripcion, dificultad]) => { const ruta = CONFIG.rutas[id]; return `<article class="tarjeta ruta-tarjeta"><span class="placa"><b>${ruta.etiqueta}</b><small>${nombre}</small></span><div><p class="kicker">${nombre}</p><h3>${descripcion}</h3><div class="metricas"><span class="metrica"><strong>${ruta.km} km</strong> distancia</span><span class="metrica"><strong>${ruta.desnivel.toLocaleString('es-MX')} m</strong> desnivel+</span><span class="metrica dato">${dificultad}</span></div><a href="rutas.html">Conocer recorrido</a></div></article>`; }).join('');
  document.querySelectorAll('[data-total-categorias]').forEach((elemento) => { elemento.textContent = CATEGORIAS.length; });
}

function iniciarSeo() {
  const descripcion = document.querySelector('meta[name="description"]')?.content || `${CONFIG.evento} en ${CONFIG.sede}.`;
  const asegurarMeta = (atributo, valor, contenido) => { if (document.head.querySelector(`meta[${atributo}="${valor}"]`)) return; const meta = document.createElement('meta'); meta.setAttribute(atributo, valor); meta.content = contenido; document.head.append(meta); };
  asegurarMeta('property', 'og:description', descripcion); asegurarMeta('property', 'og:image', new URL('src/assets/portada.webp', window.location.href).href); asegurarMeta('name', 'twitter:card', 'summary_large_image');
  if (document.body.dataset.page !== 'inicio') return;
  const schema = { '@context': 'https://schema.org', '@type': 'SportsEvent', name: CONFIG.evento, startDate: CONFIG.fecha, location: { '@type': 'Place', name: CONFIG.salidaMeta, address: { '@type': 'PostalAddress', addressLocality: 'Actopan', addressRegion: 'Hidalgo', addressCountry: 'MX' } }, organizer: { '@type': 'Organization', name: CONFIG.evento }, url: new URL('inscripciones.html', window.location.href).href };
  const script = document.createElement('script'); script.type = 'application/ld+json'; script.textContent = JSON.stringify(schema); document.head.append(script);
}

document.addEventListener('DOMContentLoaded', () => { renderEstructura(); iniciarNavegacion(); iniciarEstado(); iniciarFacades(); iniciarRevelados(); iniciarCarrusel(); renderDatosComunes(); iniciarSeo(); });

export { waUrl };
