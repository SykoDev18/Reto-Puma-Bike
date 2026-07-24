import test from 'node:test';
import assert from 'node:assert/strict';
import {
  edadNominal,
  categoriasElegibles,
  rutaPermitida,
  formatearFechaParaPayload,
  crearPayload,
} from '../js/inscripcion.js';

test('calcula la edad nominal usando el año del evento', () => {
  assert.equal(edadNominal('1992-08-14'), 34);
});

test('recomienda Máster 30 Varonil a un hombre nacido en 1992', () => {
  const resultado = categoriasElegibles({
    edadNominal: 34,
    sexo: 'V',
    tipoBicicleta: 'MTB',
    peso90mas: false,
  });

  assert.equal(resultado.recomendada.clave, 'N');
  assert.equal(resultado.recomendada.nombre, 'Máster 30 Varonil');
});

test('restringe una E-Bike a categorías E-Bike de la misma rama', () => {
  const resultado = categoriasElegibles({
    edadNominal: 34,
    sexo: 'V',
    tipoBicicleta: 'E-Bike',
    peso90mas: true,
  });

  assert.equal(resultado.recomendada, null);
  assert.deepEqual(resultado.alternativas.map((categoria) => categoria.clave), ['EBV']);
});

test('ofrece alternativas para una mujer de 17 años sin categoría por edad', () => {
  const resultado = categoriasElegibles({
    edadNominal: 17,
    sexo: 'F',
    tipoBicicleta: 'MTB',
    peso90mas: false,
  });

  assert.equal(resultado.recomendada, null);
  assert.deepEqual(resultado.alternativas.map((categoria) => categoria.clave), ['RF', 'Y']);
});

test('aplica la ruta infantil y el formato de fecha del contrato', () => {
  assert.equal(rutaPermitida('Infantiles', '80'), 'infantil');
  assert.equal(formatearFechaParaPayload('2015-05-10'), '10/05/2015');
});

test('crea el payload con la estructura del contrato de cronometraje', () => {
  const payload = crearPayload({
    folio: 'RPB2026-000123',
    creadoEn: '2026-03-15T10:22:31-06:00',
    datos: {
      nombre: 'Juan Carlos', apellido_paterno: 'Hernández', apellido_materno: 'Vargas',
      fecha_nacimiento: '1992-08-14', sexo: 'M', equipo: 'Club Ciclista Ninis',
      email: 'juan@correo.com', telefono: '7721234567', categoria_id: '26', ruta: '80',
      tipo_bicicleta: 'MTB', kit: 'Kit Puma', talla_jersey: 'L',
      contacto_emergencia_nombre: 'María Vargas', contacto_emergencia_tel: '7729876543',
      tipo_sangre: 'O+', deslinde: true, privacidad: true,
    },
  });

  assert.deepEqual(payload.competencia, {
    categoria_id: 26,
    categoria_clave: 'N',
    categoria_nombre: 'Máster 30 Varonil',
    ruta: '80',
    tipo_bicicleta: 'MTB',
  });
  assert.equal(payload.participante.fecha_nacimiento, '14/08/1992');
  assert.equal(payload.kit.precio, 750);
});
