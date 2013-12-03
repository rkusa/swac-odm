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

exports.defineAPI = function(model, method, opts) {
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

  var fn = exports.getMethodFn(typeof method === 'object' ? 'view' : method, model, true)

  server[typeof method === 'object' || method === 'view' ? 'get' : method].apply(server,
  [path].concat(middleware, function(req, res) {
    var _fn = fn
    if (method === 'get' || method === 'put' || method === 'delete')
      _fn = _fn.bind(_fn, req.params.id)
    if (method === 'put' || method === 'post')
      _fn = _fn.bind(_fn, req.body)
    else if (method === 'view')
      _fn = _fn.bind(_fn, req.query.view, req.query.key ? decodeURIComponent(req.query.key) : undefined)
    else if (typeof method === 'object')
      _fn = _fn.bind(_fn, method.view, req.params.id ? decodeURIComponent(req.params.id) : undefined)
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
    if (!process.domain) {
      var d = domain.create()
      d.enter()
    }
    process.domain.req = req
    server.handle(req, res, next)
  }
}

// generic API Method
exports.getMethodFn = function(operation, model, isAPICall) {
  if (isAPICall === undefined) isAPICall = false
  return function() {
    if (!process.domain) {
      var d = domain.create()
      d.enter()
    }

    // initialize parameters
    var args = Array.prototype.slice.call(arguments)

    if (!model._definition.api)
      throw new Error('API for ' + model._type + ' not defined')

    var method   = operation 
      , callback = args.pop()
      , isRead   = method === 'get' || method === 'view'
      , isWrite  = !isRead
      , id

    // initialize cache
    if (!process.domain.swac) process.domain.swac = { cache: { docs: {}, views: {} }}
    var cache = process.domain.swac.cache
    if (!cache.views[model._type]) cache.views[model._type] = {}
    
    // else Server-Side (Authorization required)
    utils
    // Fetch Document(s)
    .chain(function(done) {
      var input = args[0]

      // Not neccessary for post requests
      if (method === 'post') {
        var instance = new model
        if ('id' in input) instance.id = input.id
        return done(input, instance)
      }
    
      // Not neccessary if the input is already an appropriated instance
      if (isWrite && input instanceof model) {
        // Per-Property && Server-Side!?
        // return done(input, input)
        id = input.id
      }

      // `get`, `delete` will and `put` could have the id
      // as the first argument
      if (typeof input !== 'object') {
        id = input
        // if `put` got called with an id, the second argument
        // is the object containing the changes
        if (method === 'put')
          input = args[1]
      }

      function cacheRow(row) {
        if (row) {
          row.isNew = false
          cache.docs[row.id] = row
        }
        return row instanceof model ? row.clone() : row
      }

      // request the database using the model's adapter
      if (method === 'view') {
        var viewId = args.join('/') || 'all'
          , viewCache = cache.views[model._type]

        if (viewId in viewCache) {
          // use #concat() to copy the array
          var rows = viewCache[viewId]
          return callback(null, Array.isArray(rows)
              ? rows.map(cacheRow)
              : cacheRow(rows))
        }

        model._definition.api.view.apply(
          model._definition.api,
          args.concat(function(err, rows) {
            if (err) throw err
            viewCache[viewId] = Array.isArray(rows)
              ? rows.map(cacheRow)
              : cacheRow(rows)
            done(input, Array.isArray(rows)
              ? rows.map(cacheRow)
              : cacheRow(rows))
          })
        )
      } else {
        if (id in cache.docs) {
          return done(input, cacheRow(cache.docs[id]))
        }

        model._definition.api.get(id, function(err, row) {
          if (err) throw err
          done(input, cacheRow(row))
        })
      }
    })
    // Authorize Write
    .chain(function (input, instance, done) {
      // Not neccessary for read requests
      if (isRead) return done(instance)
      if (method !== 'delete' && typeof input !== 'object')
        return done(instance)
      if (method === 'put' && !instance) method = 'post'
      else if(method === 'delete' && !instance) {
        return callback({ message: 'Not Found', status: 404, body: {}})
      }

      var data = input instanceof model ? input.toJSON(false, undefined, isAPICall) : input
      if (method === 'put')
        delete data.id

      if (!(input instanceof model))
        input = method === 'post' ? new model(input) : instance

      // the appropriated allow and deny method
      var allow = model._definition._allow.instance[method] || model._definition._allow.instance.write
        || model._definition._allow.instance.all || function() { return true }
      var deny = model._definition._deny.instance[method] || model._definition._deny.instance.write
        || model._definition._deny.instance.all || function() { return false }

      authorize(model, method, allow, deny,
        //allowed
        function() {
          utils
          // Per-Property Authorization
          .chain(function(done) {
            // not neccessary for `delete` requests
            if (method === 'delete') {
              input = instance
              return done()
            }

            // iterate properties
            utils.series(Object.keys(data), function(key, next) {
              // the appropriated allow and deny method
              var allow = model._definition._allow.properties[key]
                && (model._definition._allow.properties[key][method]
                || model._definition._allow.properties[key].write
                || model._definition._allow.properties[key].all)
                || function() { return true }
              var deny = model._definition._deny.properties[key]
                && (model._definition._deny.properties[key][method]
                || model._definition._deny.properties[key].write
                || model._definition._deny.properties[key].all)
                || function() { return false }

              if (
                // model does not have such a property
                !model.prototype._validation[key] ||
                // is serverOnly Property and got accessed through the Web Service
                (isAPICall === true && model.prototype._validation[key].serverOnly)
              ) {
                delete data[key]
                return next()
              }

              // authorize property
              authorize(model, method, allow, deny,
                // allowed
                next,
                // denied
                function() {
                  data[key] = instance[key]
                  next()
                },
                isAPICall
              )(method === 'post' ? input : instance, data[key], key)
            }, done)
          })
          // Hooks
          .chain(function(done) {
            if (method !== 'delete') {
              input.set(data)
              input.isNew = false
            }

            utils
            // Before Hooks
            .chain(function(done) {
              var hook
              switch (method) {
                case 'delete': hook = 'beforeDelete'; break
                case 'put':    hook = 'beforeUpdate'; break
                case 'post':   hook = 'beforeCreate'; break
              }
              if (!hook) return done()
              executeHook(model, input, 'beforeSave', function(err) {
                if (err) return callback({ message: 'Bad Request', status: 400, body: {
                  error: 'Save Rejected',
                  details: err
                } })
                executeHook(model, input, hook, function(err) {
                  if (err) return callback({ message: 'Bad Request', status: 400, body: {
                    error: method.charAt(0).toUpperCase() + method.slice(1) + ' Rejected',
                    details: err
                  } })
                  done()
                })
              }) 
            })
            // Validation
            .chain(function(done) {
              if (method === 'delete') return done()
              input.validate(function(isValid) {
                if (!isValid) {
                  if (callback) {
                    callback({ message: 'Bad Request', status: 400, body: {
                      error: 'Validation Error',
                      details: input.$errors
                    }})
                  }
                } else {
                  done()
                }
              })
            })
            // Execute Write
            .chain(function(done) {
              model._definition.api[method](input, function(err) {
                if (err) throw err
                // invalidate views
                cache.views[model._type] = {}
                // cache document
                if (method !== 'delete') {
                  cache.docs[input.id] = input.clone()
                } else {
                  delete cache.docs[input.id]
                }
                done()
              })
            })
            // After Hooks
            .chain(function() {
              var hook
              switch (method) {
                case 'delete': hook = 'afterDelete'; break
                case 'put':    hook = 'afterUpdate'; break
                case 'post':   hook = 'afterCreate'; break
              }
              if (!hook) return done(input)
              executeHook(model, input, 'afterSave', function() {
                executeHook(model, input, hook, function() {
                  done(input)
                })
              })
            })
          })
          // continue
          .chain(done)
        },
        // denied
        function() {
          if (callback) callback({ message: 'Forbidden', status: 403 })
        },
        isAPICall
      )(method === 'post' ? input : instance)
    })
    // Authorize Read
    .chain(function(rows) {
      if (rows === null) return callback(null, null)
      if (!callback) return
      if (isWrite) return callback(null, rows)

      if (method === 'view' && !Array.isArray(rows)) {
        method = 'get'
      }
      
      // the appropriated allow and deny method
      var allow = model._definition._allow.instance[method] || model._definition._allow.instance.read
        || model._definition._allow.instance.all || function() { return true }
      var deny = model._definition._deny.instance[method] || model._definition._deny.instance.read
        || model._definition._deny.instance.all || function() { return false }

      var input = Array.isArray(rows) ? rows : [rows]
        , output = []
      // authorize every row
      utils.series(input, function(row, next) {
        authorize(model, method, allow, deny,
          // allowed
          function() {
            output.push(row)
            next()
          },
          // denied
          next,
          isAPICall
        )(row)
      }, function() {
        callback(null, Array.isArray(rows) ? output : (output[0] || null))
      }, isAPICall)
    })
  }
}

function executeHook(model, obj, hook, callback) {
  if (!model._definition.hooks[hook]) return callback()
  model._definition.hooks[hook](process.domain.req, obj, callback)
}

function authorize(model, method, allowFn, denyFn, allowed, denied, isAPICall) {
  var authorizationContext = {}
  authorizationContext.isClient = isAPICall === true
  authorizationContext.isServer = !authorizationContext.isClient

  return function() {
    var args = Array.prototype.slice.call(arguments)
      , count = 2
      , allow, deny

    var callback = function() {
      if (--count !== 0) return
      if (allow && !deny) allowed.apply(null, args)
      else denied.apply(null, args)
    }

    if (typeof (allow = allowFn.apply(authorizationContext, [process.domain.req].concat(args, function(res) {
      process.nextTick(function() {
        allow = res
        callback()
      })
    }))) === 'boolean' || allowFn.length <= (args.length + 1)) callback()
      
    if (typeof (deny = denyFn.apply(authorizationContext, [process.domain.req].concat(args, function(res) {
      process.nextTick(function() {
        deny = res
        callback()
      })
    }))) === 'boolean' || denyFn.length <= (args.length + 1)) callback()
  }
}