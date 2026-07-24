const nombres = [
  'Agua Select La Esperanza', 'CleanSofá El Tío', 'CPGAS', 'Dirección del Deporte Actopan', 'GTZ Team', 'Clínica San Ángel', 'DUAR Aditivos Profesionales', 'Dulcería El Paletón',
  'Farmacia Magdalena', 'Fraternidad Ciclista', 'Potts', 'Arquitectura KIS-BAC', 'Miguel Moreno', 'Gobierno Municipal de Actopan', 'Club Ciclista Ninis', 'NotiLive Hidalgo', 'Veterinaria Vázquez', 'Pastes San Nicolás', 'Peluquería D’Angelo', 'Taller Pérez', "Pillo's Bike MTB", 'Diamante Pinturas Actopan', 'Rancho el CruZero', 'Radiología Digital Rayos X', 'RCC Rodada Cruz Ciclista', "Frutas Rubén's", 'Servicio Automotriz SAM S.A.S.', 'San Francisco', 'Barbacoa y Ximbo Don Leo', 'R Suspensiones', 'Grupo Tollan', 'Gym Ciclismo y Atletismo Valle del Mezquital', 'Xica Gym Center',
];

export const PATROCINADORES = nombres.map((nombre, index) => ({
  nombre,
  slug: `patrocinador-${String(index + 1).padStart(2, '0')}`,
  nivel: index < 8 ? 'principal' : 'aliado',
}));
