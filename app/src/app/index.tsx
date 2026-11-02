// Placeholder until the screens phase (doc 04). User-visible strings must go
// through i18next from Release 1 (D-65); added there, not here.
import { StyleSheet, Text, View } from 'react-native';

export default function Home() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Car Maintenance Tracker</Text>
      <Text>Scaffold OK — screens arrive next.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
});
