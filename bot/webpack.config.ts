export default {
  entry: {
    index: "./src/index.ts",
    taskApi: "./src/taskApi.ts",
  },
  mode: "production",
  target: "node",
  output: {
    filename: "[name].js",
    libraryTarget: "commonjs",
  },
  devtool: "source-map",
  resolve: {
    extensions: [".webpack.js", ".web.js", ".ts", ".js"],
    modules: ["node_modules"],
  },
  module: {
    rules: [
      { test: /\.tsx?$/, loader: "ts-loader" },
      { test: /\.js$/, loader: "source-map-loader" },
    ],
  },
};
