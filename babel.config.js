module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'react' }]],
    // react-native-worklets/plugin reemplaza a react-native-reanimated/plugin
    // desde Reanimated 4. Debe ir siempre al final.
    plugins: ['react-native-worklets/plugin'],
  };
};
