import { CONFIG } from './config.js';
import { iniciarFacades } from './main.js';

const datos = [
  { id: 'corta', nombre: 'Ruta corta', terreno: '100% camino ancho y rodable', dificultad: '★★★☆☆', poblados: 'Dajiedhi, La Estancia y El Rincón', imagen: 'src/assets/Ruta/RutaI.webp' },
  { id: 'larga', nombre: 'Ruta larga', terreno: '100% camino ancho y rodable', dificultad: '★★★★☆', poblados: 'Santiago de El Jaguey, Boxaxni, Dajiedhi, La Estancia y El Rincón', imagen: 'src/assets/Ruta/RutaC.webp' },
];
document.addEventListener('DOMContentLoaded', () => {
  const contenedor = document.querySelector('[data-rutas-detalle]');
  if (!contenedor) return;
  contenedor.innerHTML = datos.map((ruta) => {
    const config = CONFIG.rutas[ruta.id];
    const src = `https://www.komoot.com/tour/${config.komootId}/embed?layout=classic&profile=1`;
    return `<article class="section revelar"><div class="grid grid--2"><div><p class="kicker">${ruta.nombre}</p><h2 class="titulo titulo--medio">${config.etiqueta}</h2><div class="placas"><span class="placa placa--dato"><b>${config.km} km</b><small>distancia</small></span><span class="placa placa--dato"><b>${config.desnivel.toLocaleString('es-MX')} m</b><small>desnivel positivo</small></span></div><p>${ruta.terreno}. Dificultad <span class="dato">${ruta.dificultad}</span>.</p><p class="texto-gris"><strong>Poblados:</strong> ${ruta.poblados}.</p></div><div class="facade facade--mapa" style="--imagen-facade:url('${ruta.imagen}')" data-facade data-title="Mapa de ${ruta.nombre}" data-src="${src}"><button class="boton boton--blanco" type="button">Cargar mapa Komoot</button></div></div></article>`;
  }).join('');
  iniciarFacades();
});
