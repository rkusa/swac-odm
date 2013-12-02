exports.middleware = require('./server').middleware
exports.Model = require('./model')
exports.init  = require('./ajax-adapter').init

var Collection = require('./collection')
exports.GroupedCollection = Collection.GroupedCollection
exports.Collection        = Collection.Collection

var Observable = require('./observable')
exports.Array = Observable.Array

var utils = require('./utils')
exports.ready = utils.ready