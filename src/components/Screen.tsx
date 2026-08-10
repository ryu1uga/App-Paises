import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { gradients } from '@/theme/theme';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: readonly Edge[];
  /** Manchas de color difuminadas al fondo. */
  glow?: boolean;
};

/** Fondo base de la app: degradado profundo + auroras suaves. */
export function Screen({ children, style, edges = ['top'], glow = true }: Props) {
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={gradients.app as unknown as [string, string, string]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {glow && (
        <>
          <View style={[styles.blob, styles.blobA]} />
          <View style={[styles.blob, styles.blobB]} />
          <View style={[styles.blob, styles.blobC]} />
        </>
      )}
      <SafeAreaView edges={edges} style={[styles.safe, style]}>
        {children}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05060F' },
  safe: { flex: 1 },
  blob: { position: 'absolute', borderRadius: 999, opacity: 0.16 },
  blobA: { width: 340, height: 340, backgroundColor: '#2DD4BF', top: -110, left: -90 },
  blobB: { width: 300, height: 300, backgroundColor: '#818CF8', top: 120, right: -120 },
  blobC: { width: 380, height: 380, backgroundColor: '#F472B6', bottom: -160, left: -60, opacity: 0.1 },
});
