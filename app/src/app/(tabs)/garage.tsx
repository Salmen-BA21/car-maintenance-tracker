import { router } from 'expo-router';

import { DashboardScreen } from '../../components/DashboardScreen';
import { Screen } from '../../ui/kit';

export default function GarageRoute() {
  return (
    <Screen edges={['top', 'left', 'right']}>
      <DashboardScreen
        onAddPart={() => router.navigate('/(tabs)/add')}
        onEditPart={(partId) => router.push(`/part/${partId}/edit`)}
        onPartPress={(partId) => router.push(`/part/${partId}`)}
        onSettings={() => router.navigate('/(tabs)/settings')}
      />
    </Screen>
  );
}
