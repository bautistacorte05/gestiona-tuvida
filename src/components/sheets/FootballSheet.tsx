import { useFindSub } from '../../lib/names';
import SubView from '../SubView';

/** Hoja de Fútbol. TEMPORAL: muestra la pantalla de siempre hasta que esté la hoja nueva. */
export default function FootballSheet() {
  const found = useFindSub('futbol', 'partidos');
  return found ? <SubView category={found.category} sub={found.sub} /> : null;
}
