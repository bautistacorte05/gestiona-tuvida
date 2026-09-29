/** Categoría de adiestramiento de una mascota: cambia qué plan de pasos se le sugiere. */
export type TrainingCategory = 'compania' | 'pastoreo' | 'trabajo'

export interface TrainingStep {
  id: string
  title: string
  detail: string
}

export interface TrainingStage {
  id: string
  title: string
  steps: TrainingStep[]
}

export interface TrainingPlan {
  label: string
  /** Ejemplos de razas típicas de esta categoría, solo para ayudar a elegir. */
  ejemplos: string
  description: string
  /** Aviso especial (ej: recomendar profesional) que se muestra arriba del plan. */
  aviso?: string
  stages: TrainingStage[]
}

export const TRAINING_CATEGORIES: { id: TrainingCategory; label: string; icon: string }[] = [
  { id: 'compania', label: 'Compañía / casa', icon: '🏠' },
  { id: 'pastoreo', label: 'Pastoreo / caza', icon: '🐑' },
  { id: 'trabajo', label: 'Trabajo / protección', icon: '🛡️' },
]

export const TRAINING_PLANS: Record<TrainingCategory, TrainingPlan> = {
  compania: {
    label: 'Compañía / casa',
    ejemplos: 'Ej: mestizos, razas de compañía, retrievers como mascota de familia',
    description: 'Un plan de obediencia y convivencia básica, pensado para un perro de familia sin un trabajo específico.',
    stages: [
      {
        id: 'base',
        title: 'Base en casa (primeras 2 semanas)',
        steps: [
          { id: 'nombre', title: 'Enseñar su nombre', detail: 'Decir su nombre y premiar apenas te mire. Nunca lo uses para regañar.' },
          { id: 'rutina', title: 'Rutina fija de necesidades', detail: 'Sacarlo siempre al mismo lugar y horario para que asocie rápido dónde hacer sus necesidades.' },
          { id: 'zona-segura', title: 'Cama o transportín propio', detail: 'Un lugar tranquilo donde pueda retirarse a descansar sin que lo molesten.' },
        ],
      },
      {
        id: 'socializacion',
        title: 'Socialización temprana',
        steps: [
          { id: 'exposicion', title: 'Exposición gradual a estímulos', detail: 'Personas, otros perros, ruidos (aspiradora, tráfico) y superficies distintas, de a poco y siempre en positivo.' },
          { id: 'paseos-cortos', title: 'Paseos cortos y frecuentes', detail: 'Mejor varios paseos breves por zonas tranquilas que uno solo largo, al principio.' },
          { id: 'manejo', title: 'Manejo de manos', detail: 'Acostumbrarlo a que le toquen patas, orejas y boca, para que no sea un problema en el veterinario o la peluquería.' },
        ],
      },
      {
        id: 'obediencia',
        title: 'Obediencia básica',
        steps: [
          { id: 'sentado', title: 'Sentado', detail: 'Con premio en la mano, llevarlo hacia arriba y atrás de la cabeza hasta que se siente solo.' },
          { id: 'quieto', title: 'Quieto / Espera', detail: 'Pedir que se quede en una posición mientras te alejás unos pasos, aumentando la distancia de a poco.' },
          { id: 'ven', title: 'Acá / Ven', detail: 'Practicar en espacios seguros y cerrados antes de probarlo con distracciones o sin correa.' },
          { id: 'correa', title: 'Caminar sin tirar de la correa', detail: 'Detenerte cada vez que tire y retomar la marcha solo cuando la correa esté floja.' },
        ],
      },
      {
        id: 'convivencia',
        title: 'Convivencia diaria',
        steps: [
          { id: 'muebles', title: 'Reglas de la casa', detail: 'Decidir en familia qué está permitido (subir al sillón, a la cama) y ser consistentes todos.' },
          { id: 'mesa', title: 'Ignorar la comida de la mesa', detail: 'No darle nunca de la mesa, ni "solo por hoy" — rompe el hábito para siempre.' },
          { id: 'visitas', title: 'Saludo tranquilo a las visitas', detail: 'Practicar que se siente para saludar en vez de saltar, premiando la calma.' },
        ],
      },
      {
        id: 'mantenimiento',
        title: 'Mantenimiento',
        steps: [
          { id: 'repaso', title: 'Repasar comandos en lugares nuevos', detail: 'Lo que aprende en casa no siempre se traslada solo a la plaza o la calle: hay que repasar.' },
          { id: 'estimulacion', title: 'Juegos de olfato', detail: 'Esconder premios para que los busque — cansa mentalmente sin necesidad de más ejercicio físico.' },
        ],
      },
    ],
  },
  pastoreo: {
    label: 'Pastoreo / caza',
    ejemplos: 'Ej: Border Collie, Ovejero, Australian Shepherd, Labrador, Beagle',
    description: 'Perros con mucho instinto e impulso a perseguir o recolectar: el plan se enfoca en canalizar ese impulso en vez de reprimirlo.',
    stages: [
      {
        id: 'base',
        title: 'Vínculo y base',
        steps: [
          { id: 'nombre', title: 'Enseñar su nombre', detail: 'Igual que cualquier perro: nombre asociado siempre a algo bueno.' },
          { id: 'rutina', title: 'Rutina y transportín', detail: 'Rutina fija de necesidades y un lugar propio para descansar.' },
        ],
      },
      {
        id: 'energia',
        title: 'Gasto de energía controlado',
        steps: [
          { id: 'juegos-traccion', title: 'Juegos de tracción y búsqueda', detail: 'Canalizar el instinto de perseguir en juguetes (pelota, disco) en vez de autos, bicis o gente corriendo.' },
          { id: 'paseo-largo', title: 'Paseos largos + carrera controlada', detail: 'Estos perros necesitan bastante más ejercicio físico diario que el promedio.' },
        ],
      },
      {
        id: 'obediencia-distraccion',
        title: 'Obediencia con distracciones',
        steps: [
          { id: 'sentado-distraccion', title: 'Sentado/Quieto con distracciones', detail: 'Practicar con otro perro, pelota o gente corriendo cerca, aumentando la dificultad de a poco.' },
          { id: 'ven-confiable', title: 'Llamada confiable', detail: 'Que responda al "Ven" incluso con algo para perseguir cerca — es lo más importante para pasear sin correa.' },
          { id: 'suelta', title: '"Suelta" y "Dejalo"', detail: 'Para que largue lo que persiguió o encontró sin tener que perseguirlo vos.' },
        ],
      },
      {
        id: 'redireccion',
        title: 'Redirección del instinto',
        steps: [
          { id: 'pastoreo-simulado', title: 'Pastoreo simulado con juguetes', detail: 'Juegos de arrastre (pull toys) o disco para que gaste el instinto de arreo de forma segura.' },
          { id: 'olfato-agility', title: 'Olfato o agility básico', detail: 'Estimulación mental extra, muy recomendable en estas razas para que no se aburran.' },
        ],
      },
      {
        id: 'mantenimiento',
        title: 'Mantenimiento',
        steps: [
          { id: 'rutina-diaria', title: 'Rutina fija de ejercicio físico y mental', detail: 'Sin esto, es común que aparezcan problemas de conducta por aburrimiento.' },
          { id: 'repaso-estimulo', title: 'Repasar en ambientes con más estímulo', detail: 'Plazas concurridas, otros perros sueltos, etc.' },
        ],
      },
    ],
  },
  trabajo: {
    label: 'Trabajo / protección',
    ejemplos: 'Ej: Malinois, Pastor Alemán, Rottweiler, Dóberman, Cane Corso',
    description: 'Razas de alto impulso, criadas para trabajar. Necesitan estructura y estimulación mucho más exigentes que un perro de compañía.',
    aviso:
      'Esta guía es orientación general, no reemplaza a un adiestrador profesional. Para trabajo de mordida, protección o deporte canino (IGP/Ring), se recomienda sumar un club o adiestrador especializado en la raza — el riesgo de hacerlo mal (perro inseguro o sobre-reactivo) es alto.',
    stages: [
      {
        id: 'base',
        title: 'Vínculo y estructura temprana',
        steps: [
          { id: 'nombre', title: 'Enseñar su nombre', detail: 'Con refuerzo positivo, desde que llega a casa de cachorro.' },
          { id: 'reglas-claras', title: 'Reglas claras y consistentes', detail: 'Todos en la familia deben pedir lo mismo, de la misma forma — la inconsistencia confunde mucho a estas razas.' },
        ],
      },
      {
        id: 'socializacion-intensiva',
        title: 'Socialización intensiva (semanas 3 a 16)',
        steps: [
          { id: 'exposicion-amplia', title: 'Exposición controlada a muchos estímulos', detail: 'Gente, perros, ruidos, superficies, vehículos — cuantos más contextos distintos vea de cachorro, más equilibrado será de adulto.' },
          { id: 'mordida', title: 'Inhibición de mordida', detail: 'Enseñar desde cachorro a controlar la fuerza de su boca jugando, algo clave en razas con drive alto.' },
        ],
      },
      {
        id: 'obediencia-estructurada',
        title: 'Obediencia estructurada',
        steps: [
          { id: 'obediencia-solida', title: 'Sentado/Quieto/Ven sólidos bajo distracción', detail: 'No alcanza con que obedezca en casa: tiene que responder igual con estímulos fuertes cerca.' },
          { id: 'impulsos', title: 'Control de impulsos', detail: 'Esperar antes de comer, antes de cruzar una puerta, antes de bajar del auto.' },
          { id: 'profesional', title: 'Sumar un adiestrador o club de la raza', detail: 'Muy recomendable en esta categoría para guiar el entrenamiento de obediencia avanzada.' },
        ],
      },
      {
        id: 'canalizacion',
        title: 'Canalización del impulso',
        steps: [
          { id: 'juguetes-especificos', title: 'Tracción y mordida solo en juguetes específicos', detail: 'Nunca en manos ni ropa — un juguete de mordida fijo ayuda a marcar qué está permitido morder.' },
          { id: 'autocontrol', title: 'Ejercicios de autocontrol', detail: '"Dejalo", "Suelta" y quietud con distracción alta (otro perro, comida, gente).' },
        ],
      },
      {
        id: 'avanzado',
        title: 'Trabajo avanzado (opcional)',
        steps: [
          { id: 'deporte-canino', title: 'Deporte canino con un club especializado', detail: 'Si se busca protección o deporte (IGP/Ring), hacerlo siempre con un profesional certificado en la raza.' },
          { id: 'mantenimiento-exigente', title: 'Mantenimiento físico y mental diario', detail: 'Estas razas necesitan tarea diaria — sin trabajo, canalizan la energía en problemas de conducta.' },
        ],
      },
    ],
  },
}
