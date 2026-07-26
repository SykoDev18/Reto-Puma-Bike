// Genera `compartido/casos-elegibilidad.json`: los casos de prueba del motor de
// categorías, con la salida ESPERADA calculada por el motor de TypeScript.
//
// El front es la fuente de verdad. Este archivo congela su comportamiento y
// luego los dos tests —el de TS y el de Python— se miden contra él:
//   · si cambia el front sin querer, falla el test de TS
//   · si el puerto de Python diverge, falla el test de Python
//
// Uso: node --experimental-strip-types backend/scripts/exportar_casos.ts
import { writeFileSync } from 'node:fs'
import { categoriasElegibles, edadNominal } from '../../src/lib/categorias.ts'
import type { Categoria } from '../../src/types/roadbook'

const ANIO_EVENTO = 2026

interface Caso {
  nombre: string
  /** DD/MM/AAAA, la forma en la que viaja en el payload. */
  fecha_nacimiento: string
  sexo: string
  tipo_bicicleta: 'MTB' | 'E-Bike'
  peso_90_mas: boolean
}

// Los cinco casos exigidos en la revisión de Fase 0, más los bordes que
// protegen las decisiones sutiles del motor.
const CASOS: Caso[] = [
  // --- exigidos ---
  { nombre: 'Máster 30 Varonil por edad nominal 34', fecha_nacimiento: '14/08/1992', sexo: 'M', tipo_bicicleta: 'MTB', peso_90_mas: false },
  { nombre: 'Infantil C Femenil por edad nominal 11', fecha_nacimiento: '10/05/2015', sexo: 'F', tipo_bicicleta: 'MTB', peso_90_mas: false },
  { nombre: 'HUECO: mujer de 17 nominales no tiene categoría por edad', fecha_nacimiento: '03/03/2009', sexo: 'F', tipo_bicicleta: 'MTB', peso_90_mas: false },
  { nombre: 'E-Bike varonil: solo categorías E-Bike', fecha_nacimiento: '14/08/1992', sexo: 'M', tipo_bicicleta: 'E-Bike', peso_90_mas: false },
  { nombre: 'E-Bike femenil: solo categorías E-Bike', fecha_nacimiento: '14/08/1992', sexo: 'F', tipo_bicicleta: 'E-Bike', peso_90_mas: false },
  { nombre: "Mamut's NO aparece sin peso 90+", fecha_nacimiento: '14/08/1992', sexo: 'M', tipo_bicicleta: 'MTB', peso_90_mas: false },
  { nombre: "Mamut's SÍ aparece con peso 90+", fecha_nacimiento: '14/08/1992', sexo: 'M', tipo_bicicleta: 'MTB', peso_90_mas: true },
  { nombre: "Mamut's NUNCA en rama femenil, ni con peso 90+", fecha_nacimiento: '14/08/1992', sexo: 'F', tipo_bicicleta: 'MTB', peso_90_mas: true },

  // --- bordes del rango ---
  { nombre: 'Borde inferior: 3 años nominales sí entra', fecha_nacimiento: '01/01/2023', sexo: 'M', tipo_bicicleta: 'MTB', peso_90_mas: false },
  { nombre: 'Fuera de rango: 2 años nominales queda sin categoría', fecha_nacimiento: '01/01/2024', sexo: 'M', tipo_bicicleta: 'MTB', peso_90_mas: false },
  { nombre: 'Borde superior: 99 años nominales sí entra', fecha_nacimiento: '01/01/1927', sexo: 'M', tipo_bicicleta: 'MTB', peso_90_mas: false },
  { nombre: 'Fuera de rango: 100 años nominales queda sin categoría', fecha_nacimiento: '01/01/1926', sexo: 'M', tipo_bicicleta: 'MTB', peso_90_mas: false },

  // --- infantiles ---
  { nombre: 'Pañales femenil (4 y menos), sin alternativas', fecha_nacimiento: '20/06/2022', sexo: 'F', tipo_bicicleta: 'MTB', peso_90_mas: false },
  { nombre: 'Frontera infantil/menor: 12 nominales sigue siendo infantil', fecha_nacimiento: '01/01/2014', sexo: 'M', tipo_bicicleta: 'MTB', peso_90_mas: false },
  { nombre: 'Frontera infantil/menor: 13 nominales ya NO es infantil', fecha_nacimiento: '01/01/2013', sexo: 'M', tipo_bicicleta: 'MTB', peso_90_mas: false },
  { nombre: 'Infantil en E-Bike: manda el corte infantil, no el de bicicleta', fecha_nacimiento: '01/01/2016', sexo: 'M', tipo_bicicleta: 'E-Bike', peso_90_mas: false },

  // --- cortes de edad de las abiertas ---
  { nombre: 'Elite no se ofrece antes de los 16', fecha_nacimiento: '01/01/2011', sexo: 'M', tipo_bicicleta: 'MTB', peso_90_mas: false },
  // A los 12 no hay abiertas que ofrecer porque manda el corte infantil. El
  // guardia `Rodadores && edad < 13` del motor es, por eso, código inalcanzable
  // (ver reporte de Fase 1). Este caso fija ese comportamiento.
  { nombre: 'A los 12 no hay abiertas: manda el corte infantil', fecha_nacimiento: '01/01/2014', sexo: 'F', tipo_bicicleta: 'MTB', peso_90_mas: false },

  // --- entradas inválidas ---
  { nombre: 'Sexo vacío: sin categoría', fecha_nacimiento: '14/08/1992', sexo: '', tipo_bicicleta: 'MTB', peso_90_mas: false },
  { nombre: 'Fecha inválida: sin categoría', fecha_nacimiento: '99/99/9999', sexo: 'M', tipo_bicicleta: 'MTB', peso_90_mas: false },
]

/** DD/MM/AAAA -> ISO, que es lo único que parsea `edadNominal()` en el front. */
function aIso(ddmmaaaa: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(ddmmaaaa)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}

/** Solo lo que identifica a la categoría: el resto ya lo cubre el catálogo. */
const resumir = (c: Categoria) => ({ id: c.id, clave: c.clave, nombre: c.nombre })

const casos = CASOS.map((caso) => {
  const edad = edadNominal(aIso(caso.fecha_nacimiento), ANIO_EVENTO)
  const r = categoriasElegibles({
    edadNominal: edad,
    sexo: caso.sexo,
    tipoBicicleta: caso.tipo_bicicleta,
    peso90mas: caso.peso_90_mas,
  })
  return {
    nombre: caso.nombre,
    entrada: {
      fecha_nacimiento: caso.fecha_nacimiento,
      sexo: caso.sexo,
      tipo_bicicleta: caso.tipo_bicicleta,
      peso_90_mas: caso.peso_90_mas,
    },
    esperado: {
      edad_nominal: edad,
      recomendada: r.recomendada ? resumir(r.recomendada) : null,
      alternativas: r.alternativas.map(resumir),
      sin_coincidencia: r.sinCoincidencia,
      infantiles: r.infantiles,
      solo_ebike: r.soloEbike === true,
    },
  }
})

const salida = {
  _generado_por: 'backend/scripts/exportar_casos.ts',
  _fuente: 'src/lib/categorias.ts (el motor del front es la verdad)',
  _nota: 'NO editar a mano. Lo consumen el test de TS y el de Python.',
  anio_evento: ANIO_EVENTO,
  casos,
}

const ruta = 'compartido/casos-elegibilidad.json'
writeFileSync(ruta, `${JSON.stringify(salida, null, 2)}\n`, 'utf8')
console.log(`${ruta}: ${casos.length} casos`)
