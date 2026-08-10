const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// three.js y expo-gl necesitan estas extensiones para modelos/texturas
config.resolver.assetExts = [...new Set([...config.resolver.assetExts, 'glb', 'gltf', 'obj', 'mtl', 'hdr'])];

module.exports = config;
