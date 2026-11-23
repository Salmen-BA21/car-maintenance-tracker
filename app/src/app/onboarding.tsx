import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { OnboardingScreen } from '../components/OnboardingScreen';
import { setOnboardingSeen } from '../data/repositories/car-repository';
import { Screen } from '../ui/kit';

export default function OnboardingRoute() {
  const db = useSQLiteContext();

  return (
    <Screen>
      <OnboardingScreen
        onDone={() => {
          void setOnboardingSeen(db).finally(() => router.replace('/setup'));
        }}
      />
    </Screen>
  );
}
