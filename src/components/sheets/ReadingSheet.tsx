import { useFindSub } from '../../lib/names';
import SubView from '../SubView';

/** Hoja de Lectura. TEMPORAL: muestra la pantalla de siempre hasta que esté la hoja nueva. */
export default function ReadingSheet() {
  const found = useFindSub('lectura', 'libros');
  return found ? <SubView category={found.category} sub={found.sub} /> : null;
}
