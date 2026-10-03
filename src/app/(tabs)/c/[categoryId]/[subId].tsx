import { useLocalSearchParams } from 'expo-router';
import { Fragment, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import DailyGoalsView from '../../../../components/DailyGoalsView';
import FinanceHomeView from '../../../../components/FinanceHomeView';
import LifeWheelView from '../../../../components/LifeWheelView';
import LongGoalsView from '../../../../components/LongGoalsView';
import NotesView from '../../../../components/NotesView';
import PetLostView from '../../../../components/PetLostView';
import PetProfileView from '../../../../components/PetProfileView';
import PetTrainingView from '../../../../components/PetTrainingView';
import PetWalkLiveView from '../../../../components/PetWalkLiveView';
import RitualView from '../../../../components/RitualView';
import FootballSheet from '../../../../components/sheets/FootballSheet';
import ProjectsSheet from '../../../../components/sheets/ProjectsSheet';
import ReadingSheet from '../../../../components/sheets/ReadingSheet';
import TrainingSheet from '../../../../components/sheets/TrainingSheet';
import WellbeingSheet from '../../../../components/sheets/WellbeingSheet';
import WorkSheet from '../../../../components/sheets/WorkSheet';
import SubView from '../../../../components/SubView';
import WeekPlannerView from '../../../../components/WeekPlannerView';
import type { Category, Subcategory } from '../../../../config/categories';
import { useFindSub } from '../../../../lib/names';

export default function SubRoute() {
  const { categoryId, subId } = useLocalSearchParams<{ categoryId: string; subId: string }>();
  // Dentro del menú lateral, pasar de una categoría a otra reutiliza esta pantalla con otros
  // parámetros: la key la reinicia para que no quede estado de la anterior (formularios, mes…).
  // Con los nombres que eligió el usuario (✏️ en el título de cada pantalla).
  const found = useFindSub(categoryId, subId);
  return <Fragment key={`${categoryId}/${subId}`}>{renderSub(found)}</Fragment>;
}

function renderSub(found: { category: Category; sub: Subcategory } | undefined): ReactNode {
  if (!found) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-ink-950">
        <Text className="text-ink-400">No se encontró esa pantalla.</Text>
      </SafeAreaView>
    );
  }

  if (found.sub.custom === 'pet-walk-live') return <PetWalkLiveView />;
  if (found.sub.custom === 'finance-home') return <FinanceHomeView />;
  if (found.sub.custom === 'daily-goals') return <DailyGoalsView />;
  if (found.sub.custom === 'long-goals') return <LongGoalsView />;
  if (found.sub.custom === 'pet-profile') return <PetProfileView />;
  if (found.sub.custom === 'pet-lost') return <PetLostView />;
  if (found.sub.custom === 'pet-training') return <PetTrainingView />;
  // Hojas de categoría (una por categoría, con todas sus secciones).
  if (found.sub.custom === 'training-sheet') return <TrainingSheet />;
  if (found.sub.custom === 'work-sheet') return <WorkSheet />;
  if (found.sub.custom === 'football-sheet') return <FootballSheet />;
  if (found.sub.custom === 'reading-sheet') return <ReadingSheet />;
  if (found.sub.custom === 'wellbeing-sheet') return <WellbeingSheet />;
  if (found.sub.custom === 'projects-sheet') return <ProjectsSheet />;
  if (found.sub.custom === 'ritual') return <RitualView />;
  if (found.sub.custom === 'week-planner') return <WeekPlannerView />;
  if (found.sub.custom === 'notes') return <NotesView />;
  if (found.sub.custom === 'life-wheel') return <LifeWheelView />;

  if (found.sub.custom) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-ink-950 px-8">
        <View className="items-center gap-2">
          <Text className="text-4xl">{found.sub.icon}</Text>
          <Text className="text-lg font-semibold text-ink-100">{found.sub.name}</Text>
          <Text className="text-center text-sm text-ink-400">Esta pantalla todavía no está portada a la app nativa. Es el próximo paso.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return <SubView category={found.category} sub={found.sub} />;
}
