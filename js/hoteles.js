import { HOTELES } from '../data/hoteles.js';
document.addEventListener('DOMContentLoaded', () => {
  const lista = document.querySelector('#lista-hoteles'); if (!lista) return;
  lista.innerHTML = HOTELES.map((hotel) => `<article class="tarjeta hotel"><img src="src/assets/Hoteles/${hotel.imagen}" width="700" height="394" alt="Fachada o habitación de ${hotel.nombre}" loading="lazy"><p class="kicker">${hotel.zona}</p><h2>${hotel.nombre}</h2><p class="texto-gris">${hotel.telefono}</p><a class="boton boton--linea boton--chico" href="${hotel.maps}" target="_blank" rel="noreferrer">Ver en Google Maps</a></article>`).join('');
});
