export const CONFIG = {
  evento: 'Reto Puma Bike',
  edicion: 'Cuarta Edición',
  anioEvento: 2026,
  fecha: '2026-07-05',
  fechaTexto: '5 de julio, 2026',
  horaArranque: '8:00 AM',
  sede: 'Actopan, Hidalgo',
  salidaMeta: 'Pabellón Gastronómico',
  estado: 'preevento',
  contacto: {
    email: 'retopumabike@gmail.com',
    direccion: 'Libertad 1, Aviación, 42506 Actopan, Hgo.',
    whatsapp: '527721199093', // SUPUESTO: número vigente tomado del sitio anterior.
  },
  redes: {
    facebook: 'https://www.facebook.com/people/RETO-PUMA-BIKE/100092370199634/',
    instagram: 'https://www.instagram.com/reto_puma_bike_/',
    whatsapp: 'https://wa.me/527721199093',
    youtube: 'https://www.youtube.com/@RetoPumaBike-v8h',
  },
  videoHeroId: 'iGJ1h3ychoo',
  rutas: {
    corta: { etiqueta: '40 KM', km: 48.98, desnivel: 1457, komootId: '2986084630' },
    larga: { etiqueta: '80 KM', km: 74.48, desnivel: 2130, komootId: '2985431690' },
  },
  kits: [
    { nombre: 'Kit Huellita', precio: 350, incluye: ['Número de competidor', 'Placa para bicicleta', 'Medalla', 'Abastecimientos'] },
    { nombre: 'Kit Puma', precio: 750, incluye: ['Número de competidor', 'Placa para bicicleta', 'Medalla', 'Abastecimientos', 'Jersey de la edición'] },
  ],
};

// REGLA DE NEGOCIO A CONFIRMAR CON EL COMITÉ.
export const MAPA_RUTAS = {
  Infantiles: ['infantil'],
  'Grupo Menor': ['40'],
  'Grupo Mayor': ['80', '40'],
};
