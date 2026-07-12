module.exports = function (api) {
  const isJest = api.caller((caller) => caller?.name === 'babel-jest');
  api.cache.using(() => isJest);

  return {
    presets: isJest ? ['babel-preset-expo'] : ['babel-preset-expo', 'nativewind/babel'],
    plugins: isJest ? [] : [
      function transformImportMetaForMetro({ types: t }) {
        return {
          visitor: {
            MetaProperty(path) {
              if (path.node.meta.name !== 'import' || path.node.property.name !== 'meta') return;
              path.replaceWith(t.objectExpression([
                t.objectProperty(
                  t.identifier('env'),
                  t.objectExpression([
                    t.objectProperty(
                      t.identifier('MODE'),
                      t.memberExpression(
                        t.memberExpression(t.identifier('process'), t.identifier('env')),
                        t.identifier('NODE_ENV'),
                      ),
                    ),
                  ]),
                ),
              ]));
            },
          },
        };
      },
      'react-native-reanimated/plugin',
    ],
  };
};
