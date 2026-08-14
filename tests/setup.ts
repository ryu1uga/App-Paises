/**
 * Los tests cubren lógica pura (datos, geometría, sorteo de preguntas y
 * progreso), así que solo hace falta silenciar los módulos nativos que el store
 * arrastra al importarse.
 */
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));
