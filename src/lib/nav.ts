import { router } from 'expo-router';

// Las categorías viven dentro del menú lateral (no apiladas encima): se navega a ellas, no se "empujan".
export function goToSub(categoryId: string, subId: string) {
  router.navigate(`/c/${categoryId}/${subId}` as never);
}
