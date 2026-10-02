import { useFindSub } from '../../lib/names';
import SubView from '../SubView';

/** Hoja de Bienestar. TEMPORAL: muestra la pantalla de siempre hasta que esté la hoja nueva. */
export default function WellbeingSheet() {
  const found = useFindSub('bienestar', 'sueno');
  return found ? <SubView category={found.category} sub={found.sub} /> : null;
}
