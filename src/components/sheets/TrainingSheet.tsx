import { useFindSub } from '../../lib/names';
import SubView from '../SubView';

/** Hoja de Entrenamiento. TEMPORAL: muestra la pantalla de siempre hasta que esté la hoja nueva. */
export default function TrainingSheet() {
  const found = useFindSub('entrenamiento', 'gimnasio');
  return found ? <SubView category={found.category} sub={found.sub} /> : null;
}
