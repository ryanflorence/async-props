var webpack = require('webpack')

module.exports = {

  output: {
    library: 'AsyncProps',
    libraryTarget: 'umd'
  },

  module: {
    loaders: [
      { test: /\.js$/, exclude: /node_modules/, loader: 'babel?stage=0&loose=all' }
    ]
  },

  node: {
    Buffer: false
  }

}
