import { Pressable, Text, View } from 'react-native';
import { TRAINING_CATEGORIES, TRAINING_PLANS } from '../config/training';
import { useDb, type PetProfile } from '../lib/db';
import { Card } from './common';

/** Plan de adiestramiento por etapas, sugerido según el tipo de mascota (config/training.ts). */
export default function TrainingPlan({ profile }: { profile: PetProfile }) {
  const updatePetProfile = useDb((s) => s.updatePetProfile);
  const trainingProgress = useDb((s) => s.trainingProgress);
  const toggleTrainingStep = useDb((s) => s.toggleTrainingStep);

  if (!profile.tipoAdiestramiento) {
    return (
      <Card>
        <Text className="mb-1 font-semibold text-ink-100">Plan de adiestramiento</Text>
        <Text className="mb-3 text-sm text-ink-400">Elegí el tipo que mejor describe a {profile.nombre || 'tu mascota'} para ver un plan de pasos sugerido.</Text>
        <View className="gap-2">
          {TRAINING_CATEGORIES.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => updatePetProfile(profile.id, { tipoAdiestramiento: c.id })}
              className="rounded-lg border border-ink-700 bg-ink-900/60 p-3">
              <Text className="font-medium text-ink-100">
                {c.icon} {c.label}
              </Text>
              <Text className="text-xs text-ink-500">{TRAINING_PLANS[c.id].ejemplos}</Text>
            </Pressable>
          ))}
        </View>
      </Card>
    );
  }

  const plan = TRAINING_PLANS[profile.tipoAdiestramiento];
  const doneIds = new Set(trainingProgress.filter((t) => t.petId === profile.id).map((t) => t.stepId));
  const totalSteps = plan.stages.reduce((n, s) => n + s.steps.length, 0);
  const doneCount = plan.stages.reduce((n, s) => n + s.steps.filter((st) => doneIds.has(st.id)).length, 0);

  return (
    <View className="gap-3">
      <Card>
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="font-semibold text-ink-100">{plan.label}</Text>
            <Text className="mt-0.5 text-xs text-ink-400">{plan.description}</Text>
          </View>
          <Pressable onPress={() => updatePetProfile(profile.id, { tipoAdiestramiento: undefined })}>
            <Text className="text-xs text-shu-400">Cambiar</Text>
          </Pressable>
        </View>
        {plan.aviso && <Text className="mt-2 text-xs text-gold-400">⚠️ {plan.aviso}</Text>}
        <View className="mt-3 h-2 overflow-hidden rounded-full bg-ink-800">
          <View className="h-full rounded-full bg-shu-500" style={{ width: `${totalSteps ? (doneCount / totalSteps) * 100 : 0}%` }} />
        </View>
        <Text className="mt-1 text-xs text-ink-500">
          {doneCount} / {totalSteps} pasos
        </Text>
      </Card>

      {plan.stages.map((stage, i) => {
        const stageDone = stage.steps.filter((s) => doneIds.has(s.id)).length;
        return (
          <View key={stage.id} className="rounded-xl border border-ink-800 bg-ink-900/60 p-4">
            <Text className="mb-2 font-medium text-ink-100">
              {i + 1}. {stage.title} <Text className="text-xs text-ink-500">({stageDone}/{stage.steps.length})</Text>
            </Text>
            <View className="gap-2.5">
              {stage.steps.map((step) => {
                const done = doneIds.has(step.id);
                return (
                  <Pressable key={step.id} onPress={() => toggleTrainingStep(profile.id, step.id)} className="flex-row items-start gap-2.5">
                    <View className={`mt-0.5 h-5 w-5 shrink-0 items-center justify-center rounded-md border ${done ? 'border-moss-500 bg-moss-500/30' : 'border-ink-700'}`}>
                      {done && <Text className="text-xs text-moss-300">✓</Text>}
                    </View>
                    <View className="flex-1">
                      <Text className={`text-sm ${done ? 'text-ink-500 line-through' : 'text-ink-100'}`}>{step.title}</Text>
                      <Text className="text-xs text-ink-500">{step.detail}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}
