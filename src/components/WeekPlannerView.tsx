import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import BackButton from './BackButton';
import ScreenTitle from './ScreenTitle';

/** Planificador semanal (en construcción). */
export default function WeekPlannerView() {
  return (
    <SafeAreaView className="flex-1 bg-ink-950" edges={['top']}>
      <ScrollView className="flex-1 px-4" contentContainerClassName="gap-5 pb-10 pt-4">
        <View className="flex-row items-center gap-2">
          <BackButton />
          <ScreenTitle categoryId="semana" subId="plan" />
        </View>
        <Text className="text-ink-400">En construcción.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
