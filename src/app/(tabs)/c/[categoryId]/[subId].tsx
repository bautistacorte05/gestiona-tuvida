import { useLocalSearchParams } from 'expo-router';
import { Fragment, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import DailyGoalsView from '../../../../components/DailyGoalsView';
import FinanceHomeView from '../../../../components/FinanceHomeView';
import LongGoalsView from '../../../../components/LongGoalsView';
import PetLostView from '../../../../components/PetLostView';
import PetProfileView from '../../../../components/PetProfileView';
import PetTrainingView from '../../../../components/PetTrainingView';
import PetWalkLiveView from '../../../../components/PetWalkLiveView';
import SubView from '../../../../components/SubView';
import { findSub } from '../../../../config/categories';

export default function SubRoute() {
  const { categoryId, subId } = useLocalSearchParams<{ categoryId: string; subId: string }>();
  // Dentro del menú lateral, pasar de una categoría a otra reutiliza esta pantalla con otros
  // parámetros: la key la reinicia para que no quede estado de la anterior (formularios, mes…).
  return <Fragment key={`${categoryId}/${subId}`}>{renderSub(categoryId, subId)}</Fragment>;
}

function renderSub(categoryId: string, subId: string): ReactNode {
  const found = findSub(categoryId, subId);

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
