import { Feather } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';

import { useTheme, type Theme } from './theme';
import { scaledLineHeight, textMaxScale, textVariants, type TextVariant } from './typography';

export type NavTab = 'garage' | 'add' | 'settings';

const variantFont = (variant: TextVariant, theme: Theme) => {
  if (variant === 'number') return theme.font.number;
  if (variant === 'body') return theme.font.regular;
  if (variant === 'caption' || variant === 'helper') return theme.font.semibold;
  if (variant === 'label' || variant === 'eyebrow') return theme.font.bold;
  return theme.font.extrabold;
};

export function AppText({
  children,
  variant = 'body',
  color,
  align,
  style,
  numberOfLines,
  maxFontSizeMultiplier,
  adjustsFontSizeToFit,
  minimumFontScale,
}: {
  children: ReactNode;
  variant?: TextVariant;
  color?: string;
  align?: TextStyle['textAlign'];
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  maxFontSizeMultiplier?: number;
  adjustsFontSizeToFit?: boolean;
  minimumFontScale?: number;
}) {
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();
  const cap = maxFontSizeMultiplier ?? textMaxScale[variant];
  const lineHeight = scaledLineHeight(StyleSheet.flatten([textVariants[variant], style])?.lineHeight, fontScale, cap);
  return (
    <Text
      adjustsFontSizeToFit={adjustsFontSizeToFit}
      maxFontSizeMultiplier={cap}
      minimumFontScale={minimumFontScale}
      numberOfLines={numberOfLines}
      style={[
        textVariants[variant],
        { color: color ?? (variant === 'eyebrow' ? theme.muted : theme.ink), fontFamily: variantFont(variant, theme) },
        align ? { textAlign: align } : null,
        style,
        lineHeight === undefined ? null : { lineHeight },
      ]}
    >
      {children}
    </Text>
  );
}

export function Screen({
  children,
  style,
  edges,
  maxWidth = 640,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: Edge[];
  maxWidth?: number;
}) {
  const theme = useTheme();
  return (
    <View style={{ alignItems: 'center', backgroundColor: theme.bg, flex: 1 }}>
      <SafeAreaView edges={edges} style={[{ backgroundColor: theme.bg, flex: 1, maxWidth, width: '100%' }, style]}>
        {children}
      </SafeAreaView>
    </View>
  );
}

export function ScrollScreen({ children, contentStyle }: { children: ReactNode; contentStyle?: StyleProp<ViewStyle> }) {
  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[{ padding: 20, paddingBottom: 36, gap: 0 }, contentStyle]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </Screen>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  backLabel,
  onBack,
  right,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  backLabel?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: 8 }}>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={backLabel ?? 'Back'}
          onPress={onBack}
          style={{ alignItems: 'center', flexDirection: 'row', gap: 4, minHeight: 44 }}
        >
          <Feather color={theme.highlight} name="chevron-left" size={20} />
          <AppText color={theme.highlight} style={{ fontFamily: theme.font.extrabold, fontSize: 15 }}>
            {backLabel ?? 'Back'}
          </AppText>
        </Pressable>
      ) : null}
      <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, gap: 8, paddingRight: 12 }}>
          {eyebrow ? <AppText variant="eyebrow">{eyebrow}</AppText> : null}
          <AppText variant="display">{title}</AppText>
          {subtitle ? <AppText style={{ lineHeight: 22 }} variant="body" color={theme.muted}>{subtitle}</AppText> : null}
        </View>
        {right}
      </View>
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
  icon?: keyof typeof Feather.glyphMap;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const colours = {
    primary: { background: theme.accent, border: theme.accent, text: theme.onAccent },
    secondary: { background: 'transparent', border: theme.border, text: theme.ink },
    quiet: { background: 'transparent', border: 'transparent', text: theme.highlight },
    danger: { background: 'transparent', border: theme.border, text: theme.danger },
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          alignItems: 'center',
          borderColor: colours.border,
          borderRadius: theme.radius.button,
          borderWidth: variant === 'primary' || variant === 'quiet' ? 0 : 1.5,
          flexDirection: 'row',
          gap: 8,
          justifyContent: 'center',
          minHeight: variant === 'quiet' ? 44 : 56,
          opacity: disabled ? 0.4 : pressed ? 0.82 : 1,
          paddingHorizontal: 18,
        },
        { backgroundColor: colours.background },
        style,
      ]}
    >
      {icon ? <Feather color={colours.text} name={icon} size={19} /> : null}
      <AppText style={{ color: colours.text, fontFamily: theme.font.extrabold, fontSize: variant === 'primary' ? 17 : 15 }} variant="button">
        {title}
      </AppText>
    </Pressable>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  variant = 'secondary',
  disabled,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  variant?: 'secondary' | 'bare';
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        borderColor: variant === 'bare' ? 'transparent' : theme.border,
        borderRadius: 22,
        borderWidth: variant === 'bare' ? 0 : 1.5,
        height: 44,
        justifyContent: 'center',
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        width: 44,
      })}
    >
      <Feather color={variant === 'bare' ? theme.ink : theme.ink} name={icon} size={20} />
    </Pressable>
  );
}

export function Card({ children, style, tint }: { children: ReactNode; style?: StyleProp<ViewStyle>; tint?: boolean }) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: tint ? theme.tint : theme.card,
          borderColor: theme.line,
          borderRadius: theme.radius.card,
          borderWidth: 1,
          padding: 16,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function FieldLabel({ children, optional }: { children: ReactNode; optional?: boolean }) {
  const theme = useTheme();
  return (
    <AppText variant="label">
      {children}
      {optional ? <AppText color={theme.muted} style={{ fontFamily: theme.font.semibold, fontSize: 14 }}> · optional</AppText> : null}
    </AppText>
  );
}

export function TextField({
  label,
  suffix,
  optional,
  error,
  style,
  ...props
}: TextInputProps & {
  label?: string;
  suffix?: string;
  optional?: boolean;
  error?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      {label ? <FieldLabel optional={optional}>{label}</FieldLabel> : null}
      <View
        style={{
          alignItems: 'center',
          backgroundColor: theme.card,
          borderColor: error ? theme.danger : focused ? theme.highlight : theme.border,
          borderRadius: theme.radius.field,
          borderWidth: focused ? 2 : 1.5,
          flexDirection: 'row',
          minHeight: 56,
        }}
      >
        <TextInput
          {...props}
          maxFontSizeMultiplier={props.maxFontSizeMultiplier ?? 1.4}
          onBlur={(event) => {
            setFocused(false);
            props.onBlur?.(event);
          }}
          onFocus={(event) => {
            setFocused(true);
            props.onFocus?.(event);
          }}
          placeholderTextColor={props.placeholderTextColor ?? theme.muted}
          style={[
            {
              color: theme.ink,
              flex: 1,
              fontFamily: theme.font.semibold,
              fontSize: 17,
              minHeight: 54,
              minWidth: 0,
              paddingHorizontal: 16,
              paddingVertical: 10,
            },
            style,
          ]}
        />
        {suffix ? (
          <AppText color={theme.muted} style={{ fontFamily: theme.font.bold, fontSize: 15, paddingRight: 16 }}>
            {suffix}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

export function ProgressBar({ percent, color }: { percent: number | null; color?: string }) {
  const theme = useTheme();
  return (
    <View style={{ backgroundColor: theme.track, borderRadius: 3, height: 6, overflow: 'hidden' }}>
      <View
        style={{
          backgroundColor: color ?? theme.ok,
          borderRadius: 3,
          height: 6,
          width: `${percent ?? 0}%`,
        }}
      />
    </View>
  );
}

export function StatusPill({ status }: { status: string }) {
  const theme = useTheme();
  const map: Record<string, { bg: string; fg: string; icon: keyof typeof Feather.glyphMap; label: string }> = {
    OK: { bg: theme.okBg, fg: theme.okText, icon: 'check', label: 'OK' },
    DueSoon: { bg: theme.warnBg, fg: theme.warn, icon: 'clock', label: 'Due soon' },
    Overdue: { bg: theme.dangerBg, fg: theme.danger, icon: 'alert-circle', label: 'Overdue' },
    Unknown: { bg: theme.track, fg: theme.muted, icon: 'help-circle', label: 'Unknown' },
    SetInterval: { bg: theme.tint, fg: theme.highlight, icon: 'sliders', label: 'Set interval' },
    Inspect: { bg: theme.warnBg, fg: theme.warn, icon: 'eye', label: 'Inspect' },
  };
  const entry = map[status] ?? map.Unknown;
  return (
    <View style={{ alignItems: 'center', alignSelf: 'flex-start', backgroundColor: entry.bg, borderRadius: 12, flexDirection: 'row', gap: 4, paddingHorizontal: 10, paddingVertical: 4 }}>
      <Feather color={entry.fg} name={entry.icon} size={12} />
      <AppText maxFontSizeMultiplier={1.3} style={{ color: entry.fg, fontFamily: theme.font.extrabold, fontSize: 12, lineHeight: 14 }}>{entry.label}</AppText>
    </View>
  );
}

export function Toggle({ value, onChange, label, disabled }: { value: boolean; onChange: (value: boolean) => void; label: string; disabled?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={{ alignItems: 'center', height: 44, justifyContent: 'center', opacity: disabled ? 0.4 : 1, width: 60 }}
    >
      <View style={{ backgroundColor: value ? theme.toggleOn : theme.border, borderRadius: 16, height: 32, width: 52 }}>
        <View
          style={{
            backgroundColor: value ? theme.toggleKnob : '#FFFFFF',
            borderRadius: 14,
            height: 28,
            left: value ? 22 : 2,
            position: 'absolute',
            top: 2,
            width: 28,
          }}
        />
      </View>
    </Pressable>
  );
}

export function Notice({ title, children, tone = 'warn' }: { title: string; children?: ReactNode; tone?: 'warn' | 'error' }) {
  const theme = useTheme();
  return (
    <View style={{ backgroundColor: tone === 'error' ? theme.dangerBg : theme.warnBg, borderRadius: theme.radius.card, gap: 4, padding: 14 }}>
      <AppText variant="label" color={tone === 'error' ? theme.danger : theme.warn}>{title}</AppText>
      {children}
    </View>
  );
}

export function InlineError({ children }: { children?: ReactNode }) {
  const theme = useTheme();
  if (!children) return null;
  return (
    <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
      <Feather color={theme.danger} name="alert-circle" size={18} />
      <AppText color={theme.danger} style={{ flex: 1, fontFamily: theme.font.bold, fontSize: 14 }}>{children}</AppText>
    </View>
  );
}

export function BottomSheet({
  visible,
  title,
  subtitle,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const side = Math.max(0, (width - 640) / 2);
  return (
    <Modal animationType="slide" onRequestClose={onClose} statusBarTranslucent transparent visible={visible}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          <Pressable accessibilityLabel={`Close ${title}`} accessibilityRole="button" onPress={onClose} style={{ backgroundColor: theme.scrim, bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 }} />
          <View
            accessibilityLabel={title}
            accessibilityViewIsModal
            style={{
              backgroundColor: theme.card,
              borderColor: theme.line,
              borderTopLeftRadius: theme.radius.sheet,
              borderTopRightRadius: theme.radius.sheet,
              borderTopWidth: 1,
              bottom: 0,
              left: side,
              maxHeight: '92%',
              paddingBottom: 20 + insets.bottom,
              paddingHorizontal: 20,
              paddingTop: 10,
              position: 'absolute',
              right: side,
            }}
          >
            <View style={{ alignSelf: 'center', backgroundColor: theme.border, borderRadius: 3, height: 5, marginBottom: 14, width: 40 }} />
            <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 }}>
              <View style={{ flex: 1, gap: 2, paddingRight: 12 }}>
                <AppText style={{ fontFamily: theme.font.extrabold, fontSize: 22 }}>{title}</AppText>
                {subtitle ? <AppText color={theme.muted} style={{ fontFamily: theme.font.semibold, fontSize: 14 }}>{subtitle}</AppText> : null}
              </View>
              <IconButton icon="x" label="Close" onPress={onClose} />
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={{ gap: 18 }}>{children}</View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function BottomNav({ active, onNavigate }: { active: NavTab; onNavigate: (tab: NavTab) => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const items: { id: NavTab; label: string; icon: keyof typeof Feather.glyphMap }[] = [
    { id: 'garage', label: 'Garage', icon: 'home' },
    { id: 'add', label: 'Add part', icon: 'plus' },
    { id: 'settings', label: 'Settings', icon: 'sliders' },
  ];
  return (
    <View
      accessibilityRole="tablist"
      style={{
        alignItems: 'center',
        backgroundColor: theme.navBg,
        borderTopColor: theme.navLine,
        borderTopWidth: 1,
        flexDirection: 'row',
        height: 56 + insets.bottom,
        justifyContent: 'space-around',
        paddingBottom: insets.bottom,
        paddingHorizontal: 24,
        paddingTop: 6,
      }}
    >
      {items.map((item) => {
        const selected = active === item.id;
        const colour = selected ? theme.navActive : theme.navInactive;
        return (
          <Pressable
            accessibilityLabel={item.label}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={item.id}
            onPress={() => onNavigate(item.id)}
            style={{ alignItems: 'center', gap: 3, minHeight: 44, minWidth: 64 }}
          >
            <Feather color={colour} name={item.icon} size={24} />
            <AppText maxFontSizeMultiplier={1.2} numberOfLines={1} style={{ color: colour, fontFamily: selected ? theme.font.extrabold : theme.font.bold, fontSize: 11, lineHeight: 13 }}>{item.label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Divider() {
  const theme = useTheme();
  return <View style={{ backgroundColor: theme.line, height: 1 }} />;
}
