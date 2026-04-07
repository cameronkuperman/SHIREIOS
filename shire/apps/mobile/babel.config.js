module.exports = function (api) {
  const isJest = api.caller((caller) => caller?.name === 'babel-jest');
  api.cache.using(() => isJest);

  return {
    presets: isJest ? ['babel-preset-expo'] : ['babel-preset-expo', 'nativewind/babel'],
    plugins: isJest ? [] : ['react-native-reanimated/plugin'],
  };
};
