import { router, useLocalSearchParams } from 'expo-router';

import { PartDetailScreen } from '../../components/PartDetailScreen';
import { Screen } from '../../ui/kit';

export default function PartRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <PartDetailScreen
        partId={id}
        onBack={() => router.back()}
        onEdit={(carName) => router.push(`/part/${id}/edit?carName=${encodeURIComponent(carName)}`)}
      />
    </Screen>
  );
}
