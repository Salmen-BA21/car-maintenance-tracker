import { Redirect, router, useLocalSearchParams } from 'expo-router';

import { BaselineScreen } from '../components/BaselineScreen';
import { Screen } from '../ui/kit';

export default function BaselineRoute() {
  const { carId } = useLocalSearchParams<{ carId: string }>();
  if (typeof carId !== 'string' || carId.length === 0) return <Redirect href="/setup" />;

  return (
    <Screen>
      <BaselineScreen carId={carId} onDone={() => router.replace('/(tabs)/garage')} />
    </Screen>
  );
}
