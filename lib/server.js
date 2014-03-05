var express = require('express')
  , utils   = require('./utils')
  , Model   = require('./model')
  , server

exports.reset = function() {
  server = express()
  server.use(express.urlencoded())
  server.use(express.json())
  server.use(express.methodOverride())
  server.get('/', function(req, res) {
    res.send(204)
  })
}

exports.reset()

exports.defineAPI = function(model, method, fn, opts) {
  var path = '/' + model._type.toLowerCase()
  if (typeof method === 'object') {
    if (method.opts.serverOnly === true) return

    if ('at' in method.opts) path = method.opts.at
    else path += '/' + method.view.toLowerCase() + '/:id'
  } else if (method !== 'post' && method !== 'view') {
    path += '/:id'
  }

  if (opts.scope) {
    throw new Error('opts.scope is not support anymore. use opts.middleware instead')
    var scope = exports.server.scope[opts.scope]
  }

  var middleware = []
  if (opts.middleware) {
    middleware = Array.isArray(opts.middleware) ? opts.middleware : [opts.middleware]
  }

  server[typeof method === 'object' || method === 'view' ? 'get' : method].apply(server,
  [path].concat(middleware, function(req, res) {
    process.domain.origin = 'client'

    var _fn = fn
    if (method === 'get' || method === 'put' || method === 'delete') {
      _fn = _fn.bind(_fn, req.params.id)
    }
    if (method === 'put' || method === 'post') {
      _fn = _fn.bind(_fn, req.body)
    } else if (method === 'view') {
      var view = req.query.view, key = req.query.key
      delete req.query.view
      delete req.query.key
      _fn = _fn.bind(_fn, view, key && decodeURIComponent(key), req.query)
    } else if (typeof method === 'object') {
      _fn = _fn.bind(_fn, method.view, req.params.id && decodeURIComponent(req.params.id), req.query)
    }
    _fn(function(err, result) {
      if (err) {
        if (!err.status) throw err
        if (!err.body) res.send(err.status)
        else res.send(err.status, err.body)
        return
      }
      
      if (!result) return res.send(404) // Not Found
      else if (method === 'delete') return res.send(204) // No Content
      res.json(Array.isArray(result) ? result.map(function(obj) {
        return obj.toJSON(false, method)
      }) : (typeof result.toJSON === 'function' ? result.toJSON() : result))
    })
  }))
}

var domain = require('domain')
exports.middleware = function() {
  return function(req, res, next) {
    server.handle(req, res, next)
  }
}

exports.initialize = function() {
  return function(req, res, next) {
    var d = domain.create()
    if (process.domain) {
      process.domain.add(d)
    }
    d.req = req
    d.run(next)
  }
}