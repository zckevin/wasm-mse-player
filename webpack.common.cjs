const path = require('path');
const keysTransformer = require('ts-transformer-keys/transformer').default;

const browserConfig = {
  entry: {
    main: {
      import: "./worker/player.ts",
      library: {
        name: "MsePlayer",
        type: "umd",
      },
    },
  },
  target: "web",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        exclude: /node_modules/,
        options: {
          // make sure not to set `transpileOnly: true` here, otherwise it will not work
          getCustomTransformers: program => ({
            before: [
              keysTransformer(program)
            ]
          })
        }
      },
      {
        test: /\.js$/,
        loader: "babel-loader",
      },
    ],
  },
  plugins: [
  ],
  resolve: {
    extensions: [".js", ".jsx", ".json", ".ts", ".tsx"],
    fallback: {
      fs: false,
      net: false,
    },
  },
};

const karmaConfig = {
  mode: "development",
  entry: './worker/player.ts',
  resolve: {
    extensions: [".js", ".jsx", ".json", ".ts", ".tsx"],
  },
  module: {
    rules: [
      {
        test: /\.(mp4|mkv)$/i,
        loader: 'file-loader',
      },
      ...browserConfig.module.rules,
    ],
  },
  // devtool: 'inline-source-map',
}

module.exports = {
  browserConfig,
  karmaConfig,
}
