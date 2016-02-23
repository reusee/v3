var webpack = require('webpack');

module.exports = {
  entry: './main.js',
  output: {
    path: __dirname,
    filename: 'bundle.js'
  },
  devtool: '#dev-source-map',
  plugins: [
    new webpack.ProvidePlugin({
    }),
  ],
  module: {
    loaders: [
      { test: /\.js$/, exclude: /node_modules/, 
        loader: 'babel?presets[]=es2015,plugins[]=transform-object-rest-spread' }
    ]
  },
  devServer: {
    contentBase: __dirname,
    port: 18080,
  }
};

if (process.env.PRO) {
  module.exports.output.filename = 'bundle.js';
  module.exports.plugins.push(new webpack.optimize.UglifyJsPlugin({
    compress: {
      warnings: false,
    },
  }));
  module.exports.plugins.push(new webpack.optimize.OccurenceOrderPlugin());
}
