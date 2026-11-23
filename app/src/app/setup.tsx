import { router } from 'expo-router';

import { SetupScreen } from '../components/SetupScreen';
import { Screen } from '../ui/kit';

export default function SetupRoute() {
  return (
    <Screen>
      <SetupScreen onCreated={(carId) => router.replace(`/baseline?carId=${carId}`)} />
    </Screen>
  );
}
