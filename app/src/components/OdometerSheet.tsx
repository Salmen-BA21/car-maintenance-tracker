import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, BottomSheet, Button, InlineError, TextField } from '../ui/kit';
import { formatDate } from '../ui/part-view';
import { useTheme } from '../ui/theme';

export function OdometerSheet({
  visible,
  current,
  lastDate,
  saving,
  error,
  onClose,
  onSave,
}: {
  visible: boolean;
  current: number;
  lastDate: string | null;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSave: (value: number) => void;
}) {
  const theme = useTheme();
  const [text, setText] = useState('');

  const input = readOdometer(text, current, lastDate);

  function save() {
    if (input.parsed === null || !input.canSave) return;
    onSave(input.parsed);
  }

  return (
    <BottomSheet onClose={onClose} subtitle={`Last entry ${current.toLocaleString()} km`} title="Update odometer" visible={visible}>
      <TextField
        accessibilityLabel="Current odometer in kilometres"
        error={input.tooLow}
        keyboardType="number-pad"
        label="Current odometer"
        maxFontSizeMultiplier={1.2}
        onChangeText={(value) => setText(value.replace(/[^0-9]/g, ''))}
        placeholder={String(current)}
        style={{ fontFamily: theme.font.number, fontSize: 36, letterSpacing: -0.7 }}
        suffix="km"
        value={text}
      />
      {input.errorText ? <InlineError>{input.errorText}</InlineError> : (
        <AppText color={theme.muted} style={{ fontFamily: theme.font.semibold, fontSize: 14 }}>
          {input.hint}
        </AppText>
      )}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {[100, 500, 1000].map((amount) => (
          <Pressable
            accessibilityLabel={`Add ${amount} kilometres`}
            accessibilityRole="button"
            key={amount}
            onPress={() => setText(String((input.parsed ?? current) + amount))}
            style={({ pressed }) => ({
              alignItems: 'center',
              borderColor: theme.border,
              borderRadius: theme.radius.button,
              borderWidth: 1.5,
              flex: 1,
              height: 44,
              justifyContent: 'center',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <AppText maxFontSizeMultiplier={1.2} numberOfLines={1} style={{ fontFamily: theme.font.extrabold, fontSize: 14 }}>+{amount.toLocaleString()} km</AppText>
          </Pressable>
        ))}
      </View>
      {error ? <InlineError>{error}</InlineError> : null}
      <Button disabled={!input.canSave || saving} onPress={save} title={saving ? 'Saving…' : 'Save odometer'} />
    </BottomSheet>
  );
}

function readOdometer(text: string, current: number, lastDate: string | null) {
  const parsed = text === '' ? null : Number(text);
  const tooLow = parsed !== null && parsed < current;
  const delta = parsed === null ? 0 : parsed - current;
  const hint = parsed === null
    ? 'Enter your odometer reading.'
    : delta === 0
      ? 'Same as your last entry.'
      : `+${delta.toLocaleString()} km since last entry${lastDate ? ` · ${formatDate(lastDate)}` : ''}`;
  return {
    parsed,
    tooLow,
    canSave: parsed !== null && parsed >= current && delta > 0,
    errorText: tooLow ? `Must be at least ${current.toLocaleString()} km, your last entry.` : '',
    hint,
  };
}
