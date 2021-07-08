const path = require("path");
const webpack = require("webpack");

const clientConfig = {
  target: "web",
  entry: "./index.js",
  output: {
    libraryTarget: "umd",
    umdNamedDefine: true,
    path: path.resolve(__dirname, "dist"),
    filename: "bundle.js",
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        loader: "babel-loader",
      },
    ],
  },
  plugins: [
    // new webpack.ProvidePlugin({
    //   process: "process/browser",
    // }),
    new webpack.ProvidePlugin({
      Buffer: ["buffer", "Buffer"],
    }),
  ],
  resolve: {
    fallback: {
      fs: false,
      stream: require.resolve("stream-browserify"),
    },
  },
};

const nodeConfig = {
  target: "node",
  entry: "./index.node.js",
  output: {
    libraryTarget: "commonjs",
    path: path.resolve(__dirname, "dist"),
    filename: "bundle.node.js",
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        loader: "babel-loader",
      },
    ],
  },
};

module.exports = [clientConfig, nodeConfig];
