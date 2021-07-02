const path = require('path');
// const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
  entry: './src/app.js',
  output: {
    libraryTarget: 'umd',
    umdNamedDefine: true,

    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
      },
    ],
  },
  plugins: [
    // new CopyPlugin({
    //   patterns: [
    //     { from: "public" },
    //   ],
    // }),
  ],
  resolve: {
    fallback: {
      fs: false
    }
  }
};

