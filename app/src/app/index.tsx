import { Redirect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { getCarCount, hasSeenOnboarding } from '../data/repositories/car-repository';
import { AppText, Screen } from '../ui/kit';
import { useTheme } from '../ui/theme';

type Destination = '/onboarding' | '/setup' | '/(tabs)/garage';

export default function Home() {
  const db = useSQLiteContext();
  const [destination, setDestination] = useState<Destination | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([getCarCount(db), hasSeenOnboarding(db)])
      .then(([count, seen]) => {
        if (!active) return;
        setDestination(!seen ? '/onboarding' : count === 0 ? '/setup' : '/(tabs)/garage');
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not open your local garage.');
      });
    return () => {
      active = false;
    };
  }, [db]);

  if (error !== null) return <MessageScreen message={error} title="Your garage could not open." />;
  if (destination === null) return <MessageScreen title="Loading your garage…" />;
  return <Redirect href={destination} />;
}

function MessageScreen({ title, message }: { title: string; message?: string }) {
  const theme = useTheme();
  return (
    <Screen>
      <AppText variant="display">{title}</AppText>
      {message ? <AppText align="center" color={theme.muted} style={{ marginTop: 12 }}>{message}</AppText> : null}
    </Screen>
  );
}
