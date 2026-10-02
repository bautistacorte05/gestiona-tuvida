import { useFindSub } from '../../lib/names';
import SubView from '../SubView';

/** Hoja de Proyectos. TEMPORAL: muestra la pantalla de siempre hasta que esté la hoja nueva. */
export default function ProjectsSheet() {
  const found = useFindSub('proyectos', 'proyectos');
  return found ? <SubView category={found.category} sub={found.sub} /> : null;
}
