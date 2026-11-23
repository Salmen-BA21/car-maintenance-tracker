import { SettingsScreen } from '../../components/SettingsScreen';
import { Screen } from '../../ui/kit';

export default function SettingsRoute() {
  return (
    <Screen edges={['top', 'left', 'right']}>
      <SettingsScreen />
    </Screen>
  );
}
