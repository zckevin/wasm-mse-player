const path = require("path");
const webpack = require("webpack");
const { IgnorePlugin } = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const { VueLoaderPlugin } = require("vue-loader");

const config = {
  mode: "development",
  entry: "./src/main.js",
  output: {
    filename: "bundle.js",
    path: path.resolve(__dirname, "dist"),
  },
  devServer: {
    contentBase: false,
    hot: true,
    port: 8080,
    open: false,
    compress: true,
    overlay: true,
  },
  watchOptions: {
    ignored: /node_modules/,
  },
  plugins: [
    new HtmlWebpackPlugin({
      title: "Hot Module Replacement",
      template: "./public/index.html",
    }),
    new IgnorePlugin(/^\.\/locale$/, /moment$/),
    new VueLoaderPlugin(),

    // shim for @jorgeferrero/stream-to-buffer
    new webpack.ProvidePlugin({
      process: "process/browser",
    }),
    new webpack.ProvidePlugin({
      Buffer: ["buffer", "Buffer"],
    }),
  ],
  module: {
    rules: [
      //Babel uses runtime to avoid injecting unnecessary code
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "babel-loader",
            options: {
              presets: ["@babel/preset-env"],
              plugins: ["@babel/plugin-transform-runtime"],
            },
          },
        ],
      },
      {
        test: /\.vue$/,
        loader: "vue-loader",
      },
    ],
  },
  resolve: {
    extensions: [".js", ".ts"],

    // shim for @jorgeferrero/stream-to-buffer
    fallback: {
      fs: false,
      stream: require.resolve("stream-browserify"),
    },
  },
};

module.exports = (env) => {
  return config;
};
