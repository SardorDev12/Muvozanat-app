import React from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

export type SheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Rendered pinned under the scrollable body — use for the save button. */
  footer?: React.ReactNode;
};

/**
 * A bottom sheet on phones, a centred dialog on wide screens. Built on RN's
 * Modal so it works identically under react-native-web.
 */
export function Sheet({ visible, onClose, title, children, footer }: SheetProps) {
  const { colors, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const isWide = Platform.OS === 'web';

  return (
    <Modal
      visible={visible}
      transparent
      animationType={isWide ? 'fade' : 'slide'}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[styles.backdropRoot, { backgroundColor: colors.overlay }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityLabel="Close"
          accessibilityRole="button"
          onPress={onClose}
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.bgElevated,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              borderBottomLeftRadius: isWide ? radius.xl : 0,
              borderBottomRightRadius: isWide ? radius.xl : 0,
              paddingBottom: isWide ? spacing.lg : insets.bottom + spacing.md,
              maxWidth: 560,
              alignSelf: isWide ? 'center' : 'stretch',
              marginBottom: isWide ? 'auto' : 0,
              marginTop: 'auto',
            },
          ]}
        >
          <View style={[styles.grabberRow, { paddingTop: spacing.md }]}>
            <View style={[styles.grabber, { backgroundColor: colors.borderStrong }]} />
          </View>

          {title ? (
            <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
              <Text variant="title">{title}</Text>
            </View>
          ) : null}

          <ScrollView
            style={styles.body}
            contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>

          {footer ? (
            <View
              style={{
                padding: spacing.lg,
                borderTopWidth: 1,
                borderTopColor: colors.border,
                gap: spacing.sm,
              }}
            >
              {footer}
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropRoot: { flex: 1, justifyContent: 'flex-end' },
  sheet: { width: '100%', maxHeight: '90%' },
  grabberRow: { alignItems: 'center' },
  grabber: { width: 40, height: 4, borderRadius: 2 },
  body: { flexGrow: 0 },
});
