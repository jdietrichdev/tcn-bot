import path from "path";

export default {
  entry: "./src/index.ts",
  mode: "production",
  target: "node",
  output: {
    filename: "index.js",
    libraryTarget: "commonjs",
  },
  devtool: "source-map",
  resolve: {
    extensions: [".webpack.js", ".web.js", ".ts", ".js"],
    modules: ["node_modules"],
    alias: {
      "command-handlers": path.resolve(__dirname, "src/command-handlers/index"),
      "adapters": path.resolve(__dirname, "src/adapters"),
    },
  },
  module: {
    rules: [
      { test: /\.tsx?$/, loader: "ts-loader" },
      {
        test: /\.js$/,
        enforce: "pre",
        use: ["source-map-loader"],
        exclude: /node_modules/,
      },
    ],
  },
};
