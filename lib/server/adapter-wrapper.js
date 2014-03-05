var middlewareStack = [
  require('./middleware/fetch-documents'),
  require('./middleware/authorize-write'),
  require('./middleware/authorize-properties'),
  require('./middleware/before-hooks'),
  require('./middleware/validation'),
  require('./middleware/execute-write'),
  require('./middleware/after-hooks'),
  require('./middleware/authorize-read')
]

var Cache = require('./cache')

function APIError(status, message, body) {
    this.name = 'APIError'
    this.status = status
    this.message = message || ''
    this.body = body || {}
}
var utils = require('../utils')
utils.inherits(APIError, Error)

function APICall(model, adapter, operation, args) {
  this.model     = model
  this.adapter   = adapter
  this.operation = this.method = operation
  this.args      = args

  var callback  = this.args.pop()
  this.end = function(res) {
    if (callback) callback(null, res)
  }

  this.throw = function(status, message, body) {
    if (callback) callback(new APIError(status, message, body))
  }

  this.query     = operation === 'view'
    ? (typeof this.args[this.args.length - 1] === 'object' ? this.args.pop() : {})
    : null

  this.isRead    = operation === 'get' || operation === 'view'
  this.isWrite   = !this.isRead

  this.input     = this.args[0]
  this.result    = null
  this.req       = process.domain.req
  this.origin    = process.domain.origin === 'client' ? 'client' : 'server'
  this.cache     = new Cache(this)
}

var domain = require('domain')
function handle(model, untouched, operation, args) {
  if (!process.domain) {
    var d = domain.create()
    d.enter()
  }

  var call = new APICall(model, untouched, operation, args)

  var index = 0
  !function next() {
    var layer = middlewareStack[index++]

    layer.call(call, next)
  }()
}

exports.wrap = function(adapter) {
  return {
    initialize: function(model, opts, definition, callback) {
      var untouched = adapter.initialize(model, opts, definition, callback)
        , api = {}
      ;['get', 'view', 'post', 'put', 'delete'].forEach(function(operation) {
        api[operation] = function() {
          var args = Array.prototype.slice.call(arguments)
          handle(model, untouched, operation, args)
        }
      })

      return api
    }
  }
}