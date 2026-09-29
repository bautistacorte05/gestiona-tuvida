import { router } from 'expo-router';

export function goToSub(categoryId: string, subId: string) {
  router.push(`/c/${categoryId}/${subId}` as never);
}
