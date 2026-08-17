import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, font, palette } from '@/theme/theme';

/**
 * Barra inferior de tres destinos: retos, explorar y progreso.
 *
 * Antes todo vivía en una única pantalla que había que desplazar para llegar a
 * los modos de juego. Separarlo deja cada cosa a un toque de distancia.
 *
 * La barra no es `position: absolute` a propósito: así el contenido se dispone
 * por encima de ella y ni el listado de Explorar ni los botones de una ficha
 * quedan tapados.
 */
export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        // El teclado de la búsqueda de Explorar no debe empujar la barra.
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: '#080C1A',
          borderTopWidth: StyleSheet.hairlineWidth * 2,
          borderTopColor: colors.border,
          height: 60 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom + 6,
        },
        tabBarLabelStyle: {
          fontFamily: font.bodySemi,
          fontSize: 11,
          letterSpacing: 0.2,
        },
        tabBarItemStyle: { paddingTop: 2 },
        sceneStyle: { backgroundColor: palette.void },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Retos',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              name={focused ? 'game-controller' : 'game-controller-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explorar',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? 'globe' : 'globe-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Progreso',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              name={focused ? 'stats-chart' : 'stats-chart-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
