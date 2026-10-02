import { useFindSub } from '../../lib/names';
import SubView from '../SubView';

/** Hoja de Trabajo. TEMPORAL: muestra la pantalla de siempre hasta que esté la hoja nueva. */
export default function WorkSheet() {
  const found = useFindSub('trabajo', 'jornada');
  return found ? <SubView category={found.category} sub={found.sub} /> : null;
}
