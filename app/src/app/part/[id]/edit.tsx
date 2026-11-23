import { router, useLocalSearchParams } from 'expo-router';

import { PartConfigScreen } from '../../../components/PartConfigScreen';
import { Screen } from '../../../ui/kit';

export default function EditPartRoute() {
  const { id, carName } = useLocalSearchParams<{ id: string; carName: string }>();

  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <PartConfigScreen
        carName={carName}
        onDone={() => router.back()}
        partId={id}
      />
    </Screen>
  );
}
