import { useEffect, useState } from 'react'

/** Refleja prefers-reduced-motion y reacciona a cambios del sistema. */
export function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState<boolean>(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const alCambiar = () => setReduce(mq.matches)
    mq.addEventListener('change', alCambiar)
    return () => mq.removeEventListener('change', alCambiar)
  }, [])

  return reduce
}
