const { merge } = require('webpack-merge');
const configs = [require("./webpack.common.cjs").browserConfig];

module.exports = configs.map((config) =>
  merge(config, {
    mode: 'production',
    optimization: {
      minimize: true,
    },
  })
);
