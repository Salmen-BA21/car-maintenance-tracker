import { Pressable, Text, View } from 'react-native';

import { styles } from './uiStyles';

export function ChoiceField({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: [string, string][];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.choiceRow}>
        {options.map(([value, text]) => (
          <Pressable
            accessibilityLabel={text}
            accessibilityRole="radio"
            accessibilityState={{ selected: selected === value }}
            key={value}
            onPress={() => onSelect(value)}
            style={[styles.choice, selected === value && styles.choiceSelected]}
          >
            <Text style={[styles.choiceText, selected === value && styles.choiceTextSelected]}>{text}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}
