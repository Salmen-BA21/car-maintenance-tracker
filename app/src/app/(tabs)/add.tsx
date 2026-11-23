import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { PartConfigScreen } from '../../components/PartConfigScreen';
import { getActiveCar } from '../../data/repositories/car-repository';
import { AppText, Screen } from '../../ui/kit';
import { useTheme } from '../../ui/theme';

export default function AddRoute() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const [car, setCar] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getActiveCar(db)
      .then((result) => { if (active) setCar(result); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load your car.'); });
    return () => { active = false; };
  }, [db]);

  return (
    <Screen edges={['top', 'left', 'right']}>
      {error ? <AppText color={theme.danger}>{error}</AppText> : null}
      {!error && !car ? <AppText>Loading your car…</AppText> : null}
      {car ? (
        <PartConfigScreen
          carId={car.id}
          carName={car.name}
          onDone={() => router.navigate('/(tabs)/garage')}
        />
      ) : null}
    </Screen>
  );
}
