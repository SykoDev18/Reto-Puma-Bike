import { CATEGORIAS } from '../data/categorias.js';
import { edadNominal, categoriasElegibles } from './inscripcion.js';

const tarjeta = (categoria) => `<article class="tarjeta categoria revelar"><span class="placa"><b>${categoria.clave}</b></span><div><p class="kicker">${categoria.grupo} · ${categoria.rama === 'V' ? 'Varonil' : 'Femenil'}</p><h3>${categoria.nombre}</h3><p class="texto-gris">${categoria.descripcionEdad} · ${categoria.vueltas} vueltas${categoria.rodadas ? ` · rodada ${categoria.rodadas}` : ''}</p></div></article>`;
document.addEventListener('DOMContentLoaded', () => {
  const rama = document.querySelector('#filtro-rama'); const grupo = document.querySelector('#filtro-grupo'); const texto = document.querySelector('#filtro-texto'); const lista = document.querySelector('#lista-categorias'); const contador = document.querySelector('#contador-categorias');
  const render = () => {
    const buscado = texto.value.trim().toLocaleLowerCase('es-MX');
    const visibles = CATEGORIAS.filter((categoria) => (!rama.value || categoria.rama === rama.value) && (!grupo.value || categoria.grupo === grupo.value) && (!buscado || `${categoria.nombre} ${categoria.clave}`.toLocaleLowerCase('es-MX').includes(buscado)));
    lista.innerHTML = visibles.map(tarjeta).join('') || '<p class="vacio">No encontramos una categoría con esos filtros.</p>';
    contador.textContent = `${visibles.length} de ${CATEGORIAS.length} categorías`;
  };
  [rama, grupo, texto].forEach((control) => control.addEventListener('input', render)); render();
  const fecha = document.querySelector('#buscador-fecha'); const sexo = document.querySelector('#buscador-sexo'); const resultado = document.querySelector('#resultado-buscador');
  const consultar = () => {
    const edad = edadNominal(fecha.value);
    if (edad === null || !sexo.value || edad < 3 || edad > 99) { resultado.innerHTML = '<p>Escribe tu fecha de nacimiento y elige tu sexo para ver tus categorías.</p>'; return; }
    const elegibles = categoriasElegibles({ edadNominal: edad, sexo: sexo.value, tipoBicicleta: 'MTB', peso90mas: false });
    const categoria = elegibles.recomendada ?? elegibles.alternativas[0];
    if (!categoria) { resultado.innerHTML = '<p>No encontramos una categoría para esos datos. Escríbenos y te ayudamos.</p>'; return; }
    const mensaje = elegibles.recomendada ? 'Te toca esta categoría.' : 'No hay categoría por edad: esta es una alternativa abierta.';
    resultado.innerHTML = `<p><span class="badge">${mensaje}</span></p><p><strong>${categoria.clave} · ${categoria.nombre}</strong><br>Edad para efectos de categoría: ${edad} años.</p><a class="boton boton--chico boton--linea" href="inscripciones.html?categoria=${categoria.id}">Continuar al formulario</a>`;
  };
  [fecha, sexo].forEach((control) => control.addEventListener('input', consultar)); consultar();
});
