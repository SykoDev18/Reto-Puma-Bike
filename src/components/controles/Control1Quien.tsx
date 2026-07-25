import { useEffect, useState } from 'react'
import type { CampoFormulario, DatosFormulario, ErroresFormulario } from '../../types/registro'
import type { Sexo } from '../../types/roadbook'
import { CONFIG } from '../../data/config'
import { isoAPartes, partesAIso } from '../../lib/registro'
import { CampoTexto } from '../CampoTexto'
import { GrupoRadio } from '../GrupoRadio'
import { PlacaDorsal } from '../PlacaDorsal'

interface Partes {
  dia: string
  mes: string
  anio: string
}

/**
 * Conserva lo que el usuario escribió aunque la fecha aún no sea válida (ISO
 * vacío), y se resincroniza si el ISO llega de fuera (borrador recuperado).
 */
function usePartesVisibles(desdeIso: Partes): [Partes, (p: Partes) => void] {
  const [visibles, setVisibles] = useState<Partes>(desdeIso)
  const { dia, mes, anio } = desdeIso
  useEffect(() => {
    if (dia === '' && mes === '' && anio === '') return
    setVisibles((prev) =>
      prev.dia === dia && prev.mes === mes && prev.anio === anio ? prev : { dia, mes, anio },
    )
  }, [dia, mes, anio])
  return [visibles, setVisibles]
}

/** CONTROL 1 · KM 0 — Quién eres. */
export function Control1Quien({
  datos,
  errores,
  edad,
  onCampo,
  onBlur,
}: {
  datos: DatosFormulario
  errores: ErroresFormulario
  edad: number | null
  onCampo: <C extends CampoFormulario>(campo: C, valor: DatosFormulario[C]) => void
  onBlur: (campo: CampoFormulario) => void
}) {
  const [visibles, setVisibles] = usePartesVisibles(isoAPartes(datos.fecha_nacimiento))

  // Día/mes/año por separado (teclado numérico en móvil); se guarda en ISO y el
  // payload lo envía como DD/MM/AAAA.
  const cambiarParte = (cual: keyof Partes, valor: string) => {
    const limpio = valor.replace(/\D/g, '').slice(0, cual === 'anio' ? 4 : 2)
    const siguientes: Partes = { ...visibles, [cual]: limpio }
    setVisibles(siguientes)
    onCampo('fecha_nacimiento', partesAIso(siguientes.dia, siguientes.mes, siguientes.anio))
  }

  return (
    <>
      <div className="rejilla-campos">
        <CampoTexto
          etiqueta="Nombre(s)"
          valor={datos.nombre}
          onCambio={(v) => onCampo('nombre', v)}
          onBlur={() => onBlur('nombre')}
          error={errores.nombre}
          autoComplete="given-name"
          ancho="largo"
        />
        <CampoTexto
          etiqueta="Apellido paterno"
          valor={datos.apellido_paterno}
          onCambio={(v) => onCampo('apellido_paterno', v)}
          onBlur={() => onBlur('apellido_paterno')}
          error={errores.apellido_paterno}
          autoComplete="family-name"
          ancho="medio"
        />
        <CampoTexto
          etiqueta="Apellido materno"
          valor={datos.apellido_materno}
          onCambio={(v) => onCampo('apellido_materno', v)}
          onBlur={() => onBlur('apellido_materno')}
          error={errores.apellido_materno}
          opcional
          ancho="medio"
        />
      </div>

      <fieldset className="fecha">
        <legend className="campo__rot">Fecha de nacimiento</legend>
        <div className="fecha__campos">
          <CampoTexto
            etiqueta="Día"
            valor={visibles.dia}
            onCambio={(v) => cambiarParte('dia', v)}
            onBlur={() => onBlur('fecha_nacimiento')}
            inputMode="numeric"
            maxLength={2}
            placeholder="14"
            ancho="corto"
          />
          <CampoTexto
            etiqueta="Mes"
            valor={visibles.mes}
            onCambio={(v) => cambiarParte('mes', v)}
            onBlur={() => onBlur('fecha_nacimiento')}
            inputMode="numeric"
            maxLength={2}
            placeholder="08"
            ancho="corto"
          />
          <CampoTexto
            etiqueta="Año"
            valor={visibles.anio}
            onCambio={(v) => cambiarParte('anio', v)}
            onBlur={() => onBlur('fecha_nacimiento')}
            inputMode="numeric"
            maxLength={4}
            placeholder="1992"
            ancho="corto"
          />
        </div>
        {errores.fecha_nacimiento ? (
          <p className="campo__error" role="alert">
            {errores.fecha_nacimiento}
          </p>
        ) : null}
      </fieldset>

      <GrupoRadio<Sexo>
        nombre="sexo"
        leyenda="Rama"
        valor={datos.sexo === '' ? null : datos.sexo}
        error={errores.sexo}
        onCambio={(v) => onCampo('sexo', v)}
        opciones={[
          { valor: 'M', etiqueta: 'Masculino' },
          { valor: 'F', etiqueta: 'Femenino' },
        ]}
      />

      {edad !== null && datos.sexo !== '' ? (
        <div className="aviso aviso--edad">
          <PlacaDorsal numero={edad} etiqueta="años" variante="placa--clave" tono="oscuro" />
          <p className="serif">
            Tu edad para {CONFIG.anioEvento} es <strong>{edad} años</strong>. Se calcula con tu año
            de nacimiento, no con tu cumpleaños.
          </p>
        </div>
      ) : null}
    </>
  )
}
