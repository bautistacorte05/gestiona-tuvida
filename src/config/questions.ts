/**
 * Preguntas de la "Pregunta del día" de Hoy. Cada día toca una (lib/today.ts → questionFor) y
 * "Otra pregunta" muestra la siguiente de la lista.
 *
 * Los ids no se cambian nunca: quedan guardados en las respuestas (Note.questionId). Para sumar
 * preguntas, agregarlas al final con un id nuevo; para sacar una, borrarla (las respuestas viejas
 * guardan el texto de la pregunta, no se pierden).
 */

export interface Question {
  id: string
  text: string
}

export const QUESTIONS: readonly Question[] = [
  { id: 'postergar', text: '¿Qué decisión estás postergando?' },
  { id: 'energia', text: '¿Qué te dio energía esta semana?' },
  { id: 'sonrisa', text: '¿Qué te hizo sonreír hoy?' },
  { id: 'orgullo', text: '¿Qué hiciste hace poco que te dio orgullo?' },
  { id: 'aprendiste', text: '¿Qué aprendiste en estos días?' },
  { id: 'gracias-pendiente', text: '¿A quién le querés dar las gracias y todavía no lo hiciste?' },
  { id: 'no-vale-la-pena', text: '¿Qué te está cansando más de lo que vale la pena?' },
  { id: 'tarde-libre', text: 'Si mañana tuvieras la tarde libre, ¿qué harías?' },
  { id: 'consejo', text: '¿Qué consejo le darías a alguien que está pasando por lo mismo que vos?' },
  { id: 'dejar-de-hacer', text: '¿Qué podrías dejar de hacer sin que pase nada malo?' },
  { id: 'mas-tiempo-con', text: '¿Con quién te gustaría pasar más tiempo?' },
  { id: 'lugar-paz', text: '¿En qué lugar te sentís más en paz?' },
  { id: 'infancia', text: '¿Qué te encantaba hacer en tu infancia y dejaste de hacer?' },
  { id: 'semana-tranquila', text: '¿Cómo sería una semana tranquila para vos?' },
  { id: 'paso-chico', text: '¿Cuál es el paso más chico que podés dar hoy hacia algo que querés?' },
  { id: 'no-depende', text: '¿Qué te preocupa que en realidad no depende de vos?' },
  { id: 'mejor-momento', text: '¿Cuál fue el mejor momento del último mes?' },
  { id: 'cambiar-rutina', text: 'Si pudieras cambiar una sola cosa de tu rutina, ¿cuál sería?' },
  { id: 'elogio', text: '¿Cuál fue el último elogio que te hicieron? ¿Te lo creíste?' },
  { id: 'llamar', text: '¿A quién hace mucho que no llamás?' },
  { id: 'verguenza', text: '¿Qué harías si no te diera vergüenza?' },
  { id: 'plata-bien-gastada', text: '¿En qué gastaste plata hace poco que valió la pena?' },
  { id: 'cuerpo', text: '¿Qué te está pidiendo el cuerpo últimamente?' },
  { id: 'descansar', text: '¿Qué es lo que más te ayuda a descansar de verdad?' },
  { id: 'dando-vueltas', text: '¿Qué libro, película o canción te quedó dando vueltas?' },
  { id: 'pedir-ayuda', text: '¿En qué te vendría bien pedir una mano?' },
  { id: 'habito-un-anio', text: '¿Qué hábito te gustaría tener dentro de un año?' },
  { id: 'dia-comun-perfecto', text: '¿Cómo sería un día común, pero perfecto?' },
  { id: 'decir-que-no', text: '¿A qué te gustaría decirle que no más seguido?' },
  { id: 'recuerdo-lindo', text: '¿Qué recuerdo lindo te vino a la cabeza hace poco?' },
  { id: 'fin-de-semana', text: '¿Qué tenés ganas de hacer este fin de semana?' },
  { id: 'saca-energia', text: '¿Qué cosa te saca energía sin que te des cuenta?' },
  { id: 'aprender-por-gusto', text: '¿Qué te gustaría aprender aunque no te sirva para nada?' },
  { id: 'te-sale-bien', text: '¿Qué te sale bien y casi nunca te lo reconocés?' },
  { id: 'arrastrando', text: '¿Qué tarea chiquita venís arrastrando hace días?' },
  { id: 'sorpresa', text: '¿Qué te sorprendió esta semana?' },
  { id: 'amistad', text: '¿Qué amistad te gustaría cuidar más?' },
  { id: 'ordenar', text: '¿Qué rincón de tu casa te gustaría ordenar?' },
  { id: 'paciencia', text: '¿Con qué estás teniendo poca paciencia?' },
  { id: 'dentro-de-un-anio', text: '¿Qué te gustaría que fuera distinto dentro de un año?' },
  { id: 'te-hizo-bien', text: '¿Qué hiciste hoy que te hizo bien?' },
  { id: 'dia-complicado', text: '¿Qué te da tranquilidad cuando el día se complica?' },
  { id: 'comparar', text: '¿En qué te estás comparando de más con los demás?' },
  { id: 'se-va-el-tiempo', text: '¿En qué se te va el tiempo sin que te des cuenta?' },
  { id: 'darte-un-gusto', text: '¿Qué gusto te podrías dar esta semana?' },
  { id: 'disfrutar-solo', text: '¿Qué disfrutás aunque nadie te vea?' },
  { id: 'charla-pendiente', text: '¿Qué charla tenés pendiente con alguien?' },
  { id: 'tres-cosas-buenas', text: '¿Cuáles fueron tres cosas buenas de hoy, por chiquitas que sean?' },
  { id: 'empezar', text: '¿Qué te gustaría empezar y no sabés por dónde?' },
  { id: 'distinto', text: '¿Qué hiciste distinto esta semana?' },
  { id: 'dejar-atras', text: '¿Qué error tuyo ya podrías dejar atrás?' },
  { id: 'una-sola-cosa', text: 'Si mañana pudieras hacer una sola cosa, ¿cuál sería?' },
  { id: 'dar-una-mano', text: '¿A quién le podrías dar una mano esta semana?' },
  { id: 'aire-libre', text: '¿Cuándo fue la última vez que estuviste al aire libre sin apuro?' },
  { id: 'aburre', text: '¿Qué te aburre y podrías hacer de otra manera?' },
  { id: 'te-animaste', text: '¿Qué te animaste a hacer hace poco?' },
  { id: 'te-quedo-resonando', text: '¿Qué te dijo alguien que te quedó resonando?' },
  { id: 'menos-celular', text: '¿Qué harías con una hora menos de celular por día?' },
  { id: 'sueno-chiquito', text: '¿Qué sueño chiquito podrías cumplir este mes?' },
  { id: 'mas-despacio', text: '¿Qué te gustaría hacer más despacio?' },
  { id: 'manana-mejor', text: '¿Qué haría que mañana sea un poco mejor que hoy?' },
]
