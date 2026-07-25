import { CONFIG } from '../data/config'

interface Pregunta {
  p: string
  r: string
}

const PREGUNTAS: Pregunta[] = [
  {
    p: '¿Cómo se calcula mi edad para la categoría?',
    r: `Con el año de nacimiento, no con tu cumpleaños: es el año del evento (${CONFIG.anioEvento}) menos tu año de nacimiento. Es la misma regla que usa el sistema de cronometraje, así que si cumples años después de la carrera tu categoría no cambia.`,
  },
  {
    p: 'Soy mujer y tengo entre 16 y 18 años. ¿Dónde compito?',
    r: 'Esta edición no tiene categoría femenil por edad para ese rango. Puedes competir en Elite Femenil o en Rodadores Femenil. Es una decisión pendiente del comité, no un error de la página.',
  },
  {
    p: '¿Puedo competir en una categoría distinta a la que me toca?',
    r: 'Sí, puedes subir a una categoría abierta como Elite o Rodadores. Lo que no puedes es premiar en la categoría Máster que te correspondía por edad si compites fuera de ella.',
  },
  {
    p: 'Traigo bicicleta eléctrica. ¿Puedo entrar a cualquier categoría?',
    r: 'No. Con e-bike solo se compite en las categorías E-Bike de tu rama, porque la asistencia cambia por completo la comparación de tiempos.',
  },
  {
    p: "¿Qué es la categoría Mamut's?",
    r: 'Es una categoría varonil abierta para competidores de 90 kg o más, sin límite de edad. Se pesa en la entrega de kits.',
  },
  {
    p: '¿La ruta depende de mi categoría?',
    r: 'Sí. Infantiles hacen el circuito por rodadas; Grupo Menor va a la ruta corta y Grupo Mayor a la larga. La tabla de arriba lo indica por grupo.',
  },
]

/** Acordeón nativo con <details>: accesible por teclado sin JavaScript. */
export function Preguntas() {
  return (
    <div className="preguntas">
      {PREGUNTAS.map((item) => (
        <details className="pregunta" key={item.p}>
          <summary className="pregunta__titulo">{item.p}</summary>
          <p className="pregunta__texto serif">{item.r}</p>
        </details>
      ))}
    </div>
  )
}
