import { RESULTADOS } from '../data/resultados.js';

const escapeHtml = (valor) => String(valor ?? '').replace(/[&<>'"]/g, (caracter) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[caracter]);
const formatoFecha = (fecha) => new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(fecha));

function renderResultados(categoria, busqueda) {
  const contenedor = document.querySelector('#resultados-contenido');
  const encontrados = categoria.corredores.filter((corredor) => `${corredor.dorsal} ${corredor.nombre}`.toLocaleLowerCase('es-MX').includes(busqueda));
  if (!encontrados.length) { contenedor.innerHTML = '<div class="vacio">Los resultados se publican el mismo día del evento, en cuanto el equipo de cronometraje los valide.</div>'; return; }
  const podio = encontrados.filter((corredor) => corredor.estado === 'OK' && corredor.posicion <= 3).sort((a, b) => a.posicion - b.posicion);
  contenedor.innerHTML = `<section><p class="kicker">${categoria.grupo} · Ruta ${categoria.ruta === 'infantil' ? 'infantil' : `${categoria.ruta} KM`}</p><h2 class="titulo titulo--medio">${categoria.clave} · ${categoria.nombre}</h2>${podio.length ? `<div class="podios">${podio.map((corredor) => `<article class="podio"><span class="placa"><b>${corredor.posicion}</b><small>lugar</small></span><h3>${escapeHtml(corredor.nombre)}</h3><p class="dato">#${corredor.dorsal} · ${corredor.tiempo ?? '—'}</p><p>${escapeHtml(corredor.equipo || 'Independiente')}</p></article>`).join('')}</div>` : ''}<div class="tarjeta" style="margin-top:1.5rem"><table class="tabla-resultados"><thead><tr><th>Pos.</th><th>Dorsal</th><th>Nombre</th><th>Equipo</th><th>Tiempo</th><th>Estado</th></tr></thead><tbody>${encontrados.map((corredor) => `<tr><td data-etiqueta="Posición">${corredor.posicion ? `<span class="placa" style="min-width:44px;min-height:44px;padding:.4rem"><b>${corredor.posicion}</b></span>` : '—'}</td><td data-etiqueta="Dorsal" class="dato">#${corredor.dorsal}</td><td data-etiqueta="Nombre">${escapeHtml(corredor.nombre)}</td><td data-etiqueta="Equipo">${escapeHtml(corredor.equipo || 'Independiente')}</td><td data-etiqueta="Tiempo" class="dato">${corredor.tiempo ?? '—'}</td><td data-etiqueta="Estado"><span class="estado estado--${corredor.estado}">${corredor.estado}</span></td></tr>`).join('')}</tbody></table></div></section>`;
}

function csvSeguro(valor) { const texto = String(valor ?? ''); return /[,"\n]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto; }
document.addEventListener('DOMContentLoaded', () => {
  const selector = document.querySelector('#resultado-categoria'); const buscar = document.querySelector('#resultado-buscar'); const actualizado = document.querySelector('#resultado-actualizado');
  selector.innerHTML = RESULTADOS.categorias.map((categoria, indice) => `<option value="${indice}">${categoria.clave} · ${categoria.nombre}</option>`).join('');
  actualizado.textContent = `Actualizado: ${formatoFecha(RESULTADOS.generado_en)}`;
  const actualizar = () => renderResultados(RESULTADOS.categorias[Number(selector.value)], buscar.value.trim().toLocaleLowerCase('es-MX'));
  selector.addEventListener('change', actualizar); buscar.addEventListener('input', actualizar); actualizar();
  document.querySelector('#descargar-csv').addEventListener('click', () => {
    const categoria = RESULTADOS.categorias[Number(selector.value)]; const filas = [['Posición', 'Dorsal', 'Nombre', 'Equipo', 'Tiempo', 'Estado'], ...categoria.corredores.map((corredor) => [corredor.posicion ?? '', corredor.dorsal, corredor.nombre, corredor.equipo || 'Independiente', corredor.tiempo || '', corredor.estado])];
    const blob = new Blob([`\ufeff${filas.map((fila) => fila.map(csvSeguro).join(',')).join('\n')}`], { type: 'text/csv;charset=utf-8' }); const enlace = document.createElement('a'); enlace.href = URL.createObjectURL(blob); enlace.download = `resultados-${categoria.clave.toLocaleLowerCase('es-MX')}.csv`; enlace.click(); URL.revokeObjectURL(enlace.href);
  });
});
