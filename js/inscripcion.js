import { CONFIG, MAPA_RUTAS } from './config.js';
import { CATEGORIAS } from '../data/categorias.js';

const ramaDesdeSexo = (sexo) => sexo === 'M' ? 'V' : sexo;
const limiteInferior = (categoria) => categoria.edadMin ?? -Infinity;
const limiteSuperior = (categoria) => categoria.edadMax ?? Infinity;

export function edadNominal(fechaNacimiento) {
  const coincidencia = String(fechaNacimiento).match(/^(\d{4})-\d{2}-\d{2}$/);
  return coincidencia ? CONFIG.anioEvento - Number(coincidencia[1]) : null;
}

export function formatearFechaParaPayload(fecha) {
  const coincidencia = String(fecha).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return coincidencia ? `${coincidencia[3]}/${coincidencia[2]}/${coincidencia[1]}` : '';
}

export function categoriasElegibles({ edadNominal: edad, sexo, tipoBicicleta = 'MTB', peso90mas = false }) {
  const rama = ramaDesdeSexo(sexo);
  const deLaRama = CATEGORIAS.filter((categoria) => categoria.rama === rama);
  const infantiles = edad !== null && edad <= 12;
  const porGrupo = infantiles ? deLaRama.filter((categoria) => categoria.grupo === 'Infantiles') : deLaRama.filter((categoria) => categoria.grupo !== 'Infantiles');

  if (!rama || edad === null || edad < 3 || edad > 99) return { recomendada: null, alternativas: [], sinCoincidencia: false, infantiles: false };

  if (infantiles) {
    const recomendada = porGrupo.find((categoria) => !categoria.abierta && edad >= limiteInferior(categoria) && edad <= limiteSuperior(categoria)) ?? null;
    return { recomendada, alternativas: [], sinCoincidencia: !recomendada, infantiles: true };
  }

  if (tipoBicicleta === 'E-Bike') {
    const alternativas = porGrupo.filter((categoria) => categoria.requiereEbike === true);
    return { recomendada: null, alternativas, sinCoincidencia: alternativas.length === 0, infantiles: false, soloEbike: true };
  }

  const recomendadas = porGrupo
    .filter((categoria) => !categoria.abierta && edad >= limiteInferior(categoria) && edad <= limiteSuperior(categoria))
    .sort((a, b) => (limiteSuperior(a) - limiteInferior(a)) - (limiteSuperior(b) - limiteInferior(b)));
  const recomendada = recomendadas[0] ?? null;
  const alternativas = porGrupo.filter((categoria) => {
    if (!categoria.abierta || categoria.requiereEbike) return false;
    if (categoria.requierePeso && !peso90mas) return false;
    if (categoria.clave.startsWith('E') && categoria.requiereEbike) return false;
    if (categoria.clave === 'M' && !peso90mas) return false;
    if (categoria.nombre.startsWith('Elite') && edad < 16) return false;
    if (categoria.nombre.startsWith('Rodadores') && edad < 13) return false;
    return true;
  });
  return { recomendada, alternativas, sinCoincidencia: !recomendada, infantiles: false };
}

export function rutaPermitida(grupo, rutaActual) {
  const opciones = MAPA_RUTAS[grupo] ?? [];
  return opciones.includes(rutaActual) ? rutaActual : (opciones[0] ?? '');
}

export function validarRegistro(datos) {
  const errores = {};
  const letras = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'\s-]+$/;
  const telefono = /^\d{10}$/;
  const fecha = new Date(`${datos.fecha_nacimiento}T12:00:00`);
  const edad = edadNominal(datos.fecha_nacimiento);
  if (!datos.nombre?.trim() || !letras.test(datos.nombre.trim())) errores.nombre = 'Escribe tu nombre sin números.';
  if (!datos.apellido_paterno?.trim() || !letras.test(datos.apellido_paterno.trim())) errores.apellido_paterno = 'Escribe tu apellido paterno sin números.';
  if (datos.apellido_materno?.trim() && !letras.test(datos.apellido_materno.trim())) errores.apellido_materno = 'El apellido materno no lleva números.';
  if (Number.isNaN(fecha.getTime()) || fecha > new Date() || edad === null || edad < 3 || edad > 99) errores.fecha_nacimiento = 'Escribe una fecha válida; la edad debe estar entre 3 y 99 años.';
  if (!['M', 'F'].includes(datos.sexo)) errores.sexo = 'Elige una rama para continuar.';
  if (!/^\S+@\S+\.\S+$/.test(datos.email ?? '')) errores.email = 'Escribe un correo electrónico válido.';
  if (!telefono.test(String(datos.telefono ?? '').replace(/\D/g, ''))) errores.telefono = 'Escribe los 10 dígitos de tu teléfono.';
  if (!['40', '80', 'infantil'].includes(datos.ruta)) errores.ruta = 'Elige una ruta.';
  if (!['MTB', 'E-Bike'].includes(datos.tipo_bicicleta)) errores.tipo_bicicleta = 'Elige el tipo de bicicleta.';
  if (!datos.categoria_id) errores.categoria_id = 'Elige una categoría para competir.';
  if (!datos.kit) errores.kit = 'Elige el kit que quieres apartar.';
  if (datos.kit === 'Kit Puma' && !datos.talla_jersey) errores.talla_jersey = 'Elige la talla de tu jersey.';
  if (!datos.contacto_emergencia_nombre?.trim()) errores.contacto_emergencia_nombre = 'Escribe el nombre de tu contacto de emergencia.';
  if (!telefono.test(String(datos.contacto_emergencia_tel ?? '').replace(/\D/g, ''))) errores.contacto_emergencia_tel = 'Escribe los 10 dígitos del contacto de emergencia.';
  if (!datos.deslinde || !datos.privacidad) errores.deslinde = 'Necesitamos tu consentimiento para registrar tu participación.';
  return errores;
}

export function crearPayload({ folio, creadoEn, datos }) {
  const categoria = CATEGORIAS.find((item) => item.id === Number(datos.categoria_id));
  const kit = CONFIG.kits.find((item) => item.nombre === datos.kit);
  if (!categoria || !kit) throw new Error('No fue posible construir el registro: falta categoría o kit.');
  return {
    folio,
    creado_en: creadoEn,
    participante: {
      nombre: capitalizar(datos.nombre), apellido_paterno: capitalizar(datos.apellido_paterno), apellido_materno: capitalizar(datos.apellido_materno || ''),
      fecha_nacimiento: formatearFechaParaPayload(datos.fecha_nacimiento), edad_nominal: edadNominal(datos.fecha_nacimiento), sexo: datos.sexo,
      equipo: datos.equipo?.trim() || 'Independiente', email: datos.email.trim(), telefono: String(datos.telefono).replace(/\D/g, ''),
    },
    competencia: { categoria_id: categoria.id, categoria_clave: categoria.clave, categoria_nombre: categoria.nombre, ruta: datos.ruta, tipo_bicicleta: datos.tipo_bicicleta },
    kit: { nombre: kit.nombre, precio: kit.precio, talla_jersey: kit.nombre === 'Kit Puma' ? datos.talla_jersey : null },
    emergencia: { nombre: capitalizar(datos.contacto_emergencia_nombre), telefono: String(datos.contacto_emergencia_tel).replace(/\D/g, ''), tipo_sangre: datos.tipo_sangre || null },
    consentimiento: { deslinde: Boolean(datos.deslinde), privacidad: Boolean(datos.privacidad) },
    origen: 'web',
  };
}

export function capitalizar(valor = '') {
  return valor.trim().toLocaleLowerCase('es-MX').replace(/(^|\s|')([\p{L}])/gu, (_, inicio, letra) => `${inicio}${letra.toLocaleUpperCase('es-MX')}`);
}

const CLAVE_BORRADOR = 'reto-puma-bike-registro-2026';
const obtenerDatosFormulario = (formulario) => {
  const formData = new FormData(formulario);
  return Object.fromEntries([...formData.entries(), ['peso_90_mas', formulario.elements.peso_90_mas?.checked ?? false], ['deslinde', formulario.elements.deslinde.checked], ['privacidad', formulario.elements.privacidad.checked]]);
};
const escapeHtml = (valor) => String(valor ?? '').replace(/[&<>'"]/g, (caracter) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[caracter]);

function iniciarFormulario() {
  const formulario = document.querySelector('#formulario-inscripcion');
  if (!formulario) return;
  const panel = document.querySelector('#panel-categorias'); const pesoWrapper = document.querySelector('#peso-wrapper'); const tallaWrapper = document.querySelector('#talla-wrapper'); const avisoRuta = document.querySelector('#aviso-ruta'); const dialogo = document.querySelector('#modal-confirmacion'); const resumen = document.querySelector('#resumen-registro');
  const kitsForm = document.querySelector('[data-kits-form]');
  kitsForm.innerHTML = CONFIG.kits.map((kit) => `<label class="opcion"><input type="radio" name="kit" value="${kit.nombre}"> ${kit.nombre} · $${kit.precio} MXN</label>`).join('');
  const seleccionQuery = new URLSearchParams(window.location.search).get('categoria');

  const mostrarErrores = (errores) => {
    formulario.querySelectorAll('.error').forEach((nodo) => { nodo.textContent = ''; });
    formulario.querySelectorAll('[aria-invalid]').forEach((nodo) => nodo.removeAttribute('aria-invalid'));
    Object.entries(errores).forEach(([nombre, mensaje]) => {
      const error = formulario.querySelector(`#error-${nombre}`); if (error) error.textContent = mensaje;
      const campo = formulario.elements[nombre]; if (campo?.setAttribute) campo.setAttribute('aria-invalid', 'true');
    });
  };
  const guardar = () => { sessionStorage.setItem(CLAVE_BORRADOR, JSON.stringify(obtenerDatosFormulario(formulario))); };
  const ajustarTalla = () => { const esPuma = obtenerDatosFormulario(formulario).kit === 'Kit Puma'; tallaWrapper.hidden = !esPuma; formulario.elements.talla_jersey.disabled = !esPuma; if (!esPuma) formulario.elements.talla_jersey.value = ''; };
  const ajustarRuta = (categoria, antes) => {
    const ruta = rutaPermitida(categoria.grupo, antes);
    const radio = formulario.querySelector(`[name="ruta"][value="${ruta}"]`);
    if (radio) radio.checked = true;
    avisoRuta.textContent = ruta !== antes ? `Ajustamos tu ruta a ${ruta === 'infantil' ? 'circuito infantil' : `${ruta} KM`} porque corresponde a ${categoria.grupo}.` : '';
  };
  const renderElegibilidad = () => {
    const datos = obtenerDatosFormulario(formulario); const edad = edadNominal(datos.fecha_nacimiento);
    pesoWrapper.hidden = datos.sexo !== 'M'; if (pesoWrapper.hidden) formulario.elements.peso_90_mas.checked = false;
    if (edad === null || !datos.sexo || edad < 3 || edad > 99) { panel.classList.remove('activa'); panel.innerHTML = '<p>Escribe tu fecha de nacimiento y elige tu sexo para ver tus categorías.</p>'; return; }
    const elegibles = categoriasElegibles({ edadNominal: edad, sexo: datos.sexo, tipoBicicleta: datos.tipo_bicicleta, peso90mas: Boolean(datos.peso_90_mas) });
    const opciones = [elegibles.recomendada, ...elegibles.alternativas].filter(Boolean).filter((categoria, indice, arreglo) => arreglo.findIndex((item) => item.id === categoria.id) === indice);
    const seleccionActual = Number(datos.categoria_id); const categoriaSeleccionada = opciones.find((categoria) => categoria.id === seleccionActual) ?? elegibles.recomendada ?? opciones[0] ?? null;
    if (!categoriaSeleccionada) { panel.classList.add('activa'); panel.innerHTML = `<p>Por ahora no encontramos una categoría compatible. Escríbenos por WhatsApp y te ubicamos.</p><a class="boton boton--chico" href="https://wa.me/${CONFIG.contacto.whatsapp}" target="_blank" rel="noreferrer">Abrir WhatsApp</a>`; return; }
    const explicacion = elegibles.recomendada ? `Porque tu edad para ${CONFIG.anioEvento} es ${edad} y esta categoría va de ${categoriaSeleccionada.descripcionEdad}.` : (datos.tipo_bicicleta === 'E-Bike' ? 'Al competir con E-Bike, solo se ofrecen las categorías E-Bike de tu rama.' : 'Todavía no hay categoría por edad para tu rango; puedes elegir una alternativa abierta.');
    panel.classList.add('activa'); panel.innerHTML = `<p><strong>Edad para efectos de categoría: ${edad} años.</strong> Se calcula con el año de nacimiento, no con tu cumpleaños.</p><label class="control" for="categoria_id">Categoría</label><select id="categoria_id" name="categoria_id">${opciones.map((categoria) => `<option value="${categoria.id}" ${categoria.id === categoriaSeleccionada.id ? 'selected' : ''}>${categoria.clave} · ${categoria.nombre}</option>`).join('')}</select><div class="opcion-categoria"><span class="placa"><b>${categoriaSeleccionada.clave}</b></span><div><span class="badge">${elegibles.recomendada?.id === categoriaSeleccionada.id ? 'Te toca esta' : 'Alternativa'}</span><p><strong>${categoriaSeleccionada.nombre}</strong></p><p>${categoriaSeleccionada.grupo} · ${categoriaSeleccionada.vueltas} vueltas. ${explicacion}</p></div></div>${elegibles.recomendada && categoriaSeleccionada.id !== elegibles.recomendada.id ? '<p class="texto-gris">Vas a competir fuera de tu grupo de edad. Está permitido, pero no podrás premiar en tu categoría Máster correspondiente.</p>' : ''}`;
    ajustarRuta(categoriaSeleccionada, datos.ruta);
    panel.querySelector('select').addEventListener('change', (evento) => { const elegida = opciones.find((categoria) => categoria.id === Number(evento.target.value)); if (elegida) { ajustarRuta(elegida, obtenerDatosFormulario(formulario).ruta); renderElegibilidad(); } });
  };
  const validarCampo = () => { const errores = validarRegistro(obtenerDatosFormulario(formulario)); mostrarErrores(errores); };
  formulario.addEventListener('input', (evento) => { if (['telefono', 'contacto_emergencia_tel'].includes(evento.target.name)) evento.target.value = evento.target.value.replace(/\D/g, '').slice(0, 10).replace(/(\d{2})(?=\d)/, '$1 ').replace(/(\d{4})(?=\d)/, '$1 '); if (['nombre', 'apellido_paterno', 'apellido_materno', 'contacto_emergencia_nombre'].includes(evento.target.name)) evento.target.value = capitalizar(evento.target.value); if (['fecha_nacimiento', 'sexo', 'tipo_bicicleta', 'peso_90_mas'].includes(evento.target.name)) renderElegibilidad(); if (evento.target.name === 'kit') ajustarTalla(); guardar(); });
  formulario.addEventListener('blur', (evento) => { if (evento.target.matches('input, select')) validarCampo(); }, true);
  document.querySelector('[data-recuperar]')?.addEventListener('click', () => { const guardado = JSON.parse(sessionStorage.getItem(CLAVE_BORRADOR) || '{}'); Object.entries(guardado).forEach(([nombre, valor]) => { const campo = formulario.elements[nombre]; if (!campo) return; if (campo.type === 'radio') formulario.querySelector(`[name="${nombre}"][value="${valor}"]`)?.click(); else if (campo.type === 'checkbox') campo.checked = Boolean(valor); else campo.value = valor; }); ajustarTalla(); renderElegibilidad(); });
  if (sessionStorage.getItem(CLAVE_BORRADOR)) document.querySelector('[data-recuperar]').hidden = false;
  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault(); const datos = obtenerDatosFormulario(formulario); const errores = validarRegistro(datos); mostrarErrores(errores); if (Object.keys(errores).length) { formulario.querySelector('[aria-invalid="true"]')?.focus(); return; }
    const payload = crearPayload({ folio: `RPB${CONFIG.anioEvento}-${String(Math.floor(Math.random() * 999999) + 1).padStart(6, '0')}`, creadoEn: new Date().toISOString(), datos });
    // TODO BACKEND: POST /api/registros
    console.log(payload); guardar();
    resumen.innerHTML = `<dl><dt>Folio</dt><dd><span class="placa"><b>${payload.folio}</b></span></dd><dt>Competidor</dt><dd>${escapeHtml(`${payload.participante.nombre} ${payload.participante.apellido_paterno} ${payload.participante.apellido_materno}`)}</dd><dt>Edad nominal</dt><dd>${payload.participante.edad_nominal} años</dd><dt>Categoría</dt><dd>${payload.competencia.categoria_clave} · ${payload.competencia.categoria_nombre}</dd><dt>Ruta</dt><dd>${payload.competencia.ruta === 'infantil' ? 'Circuito infantil' : `${payload.competencia.ruta} KM`}</dd><dt>Kit</dt><dd>${payload.kit.nombre} · $${payload.kit.precio} MXN</dd></dl>`;
    const mensaje = `Hola, comparto mi registro ${payload.folio} para Reto Puma Bike ${CONFIG.anioEvento}. ${payload.participante.nombre} ${payload.participante.apellido_paterno}; categoría ${payload.competencia.categoria_clave}; ruta ${payload.competencia.ruta}; ${payload.kit.nombre}.`;
    document.querySelector('[data-enviar-whatsapp]').href = `https://wa.me/${CONFIG.contacto.whatsapp}?text=${encodeURIComponent(mensaje)}`;
    document.querySelector('[data-copiar-registro]').onclick = async () => { await navigator.clipboard?.writeText(JSON.stringify(payload, null, 2)); };
    dialogo.showModal();
  });
  document.querySelectorAll('[data-cerrar-modal]').forEach((boton) => boton.addEventListener('click', () => dialogo.close()));
  if (seleccionQuery) { const categoria = CATEGORIAS.find((item) => item.id === Number(seleccionQuery)); if (categoria) { const sexo = formulario.querySelector(`[name="sexo"][value="${categoria.rama === 'V' ? 'M' : 'F'}"]`); sexo.checked = true; } }
  ajustarTalla(); renderElegibilidad();
}

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', iniciarFormulario);
