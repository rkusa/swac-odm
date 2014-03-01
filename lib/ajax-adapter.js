var basePath = ''

var API = exports.API = function(model) {
  this.model = model
  this.cache = { views: {}, models: {} }
}

API.prototype.request = function(/*method, obj, success */) {
  // retrieve arguments
  var args    = Array.prototype.slice.call(arguments)
    , method  = args.shift()
    , success = args.pop()
    , obj, view, key, query, id

  if (method === 'view') {
    if (typeof args[args.length - 1] === 'object') query = args.pop()
    view  = args.shift()
    key   = args.shift()
  } else if (method === 'get') {
    id = args[0]
  } else {
    if (args.length === 2)
      id = args.shift()
    else
      id = args[0].id || args[0]
    obj  = args.shift()
  }

  if (!window.location.origin) {
    window.location.origin = window.location.protocol
                           + "//" + window.location.hostname
                           + (window.location.port ? ':' + window.location.port: '')
  }

  // compose url
  var url = window.location.origin + basePath
  switch (method) {
    case 'view':
      var opts = this.model._definition.views[view] || {}
      if ('at' in opts) {
        url += opts.at.replace(':id', encodeURIComponent(key))
      } else {
        url += '/' + this.model._type.toLowerCase()
        if (view) url += '/' + view.toLowerCase()
        if (key)  url += '/' + encodeURIComponent(key)
      }
      break
    default:
      url += '/' + this.model._type.toLowerCase()
  }

  if (method !== 'view' && method !== 'post') {
    url += '/' + encodeURIComponent(id)
  }

  // build ajax request
  var params = {
    type:     method === 'view' ? 'get' : method,
    dataType: 'json',
    url:      url,
    success:  function(data) {
      if (obj) {
        for (var key in obj.$errors)
          obj.emit('errors.changed.' + key)
        obj.$errors = {}
      }
      success(null, data)
    },
    error:    function(xhr)  {
      if (xhr.status === 400 && xhr.responseText) {
        var err = JSON.parse(xhr.responseText)
          , old = obj.$errors
        obj.$errors = {}
        if (typeof err.details === 'object') {
          Object.keys(err.details).forEach(function(key) {
            obj.$errors[key] = err.details[key]
            obj.emit('errors.changed.' + key)
          })
          obj.$errors = err.details
          for (var key in old) {
            if (!(key in obj.$errors))
              obj.emit('errors.changed.' + key)
          }
        }
        success(new APIError(xhr.status, xhr.statusText, err))
      } else if (xhr.status === 404 && method === 'get') {
        success(null, null)
      } else if (xhr.status === 401 && xhr.getResponseHeader('Location')) {
        window.location = xhr.getResponseHeader('Location')
      } else {
        success(new APIError(xhr.status, xhr.statusText, err))
      }
    }
  }

  // add data
  if (method === 'post' || method === 'put') {
    params.contentType = 'application/json'
    params.data = JSON.stringify(obj instanceof this.model ? obj.toJSON() : obj)
  } else if (method === 'view') {
    params.data = query || {}
  }

  // Fire in the hole
  $.ajax(params)
}

API.prototype.createModel = function(data) {
  var instance = new this.model(data)
  instance.isNew = false
  return this.cache.models[instance.id] = instance
}

API.prototype.mergeModel = function(instance, data) {
  Object.keys(data).forEach(function(key) {
    if (Array.isArray(instance[key])) return
    if (instance.hasOwnProperty(key) && instance[key] !== data[key] && instance._changedValues[key] === undefined)
      instance[key] = data[key]
  })
}

API.prototype.get = function(id, callback) {
  var self = this
  if (id in this.cache.models) return callback(null, this.cache.models[id])
  this.request('get', id, function(err, data) {
    if (err) return callback(err, null)
    callback(null, self.cache.models[id] = (data === null ? null : self.createModel(data)))
  })
}

API.prototype.view = function(/* view, key, query, callback */) {
  var self = this
    , args = Array.prototype.slice.call(arguments)
    , callback = args.pop()
  
  var id = args.join('/')
  if (!self.cache.views[this.model._type]) self.cache.views[this.model._type] = {}
  if (id in this.cache.views[this.model._type]) {
    return callback(null, [].concat(this.cache.views[this.model._type][id]))
  }
  this.request.apply(this, ['view'].concat(args, function(err, data) {
    if (err) return callback(err, null)
    if (!data || !Array.isArray(data)) return callback(null, data ? self.createModel(data) : null)
    callback(null, self.cache.views[self.model._type][id] = data.map(function(row) {
      return self.createModel(row)
    }))
  }))
}

API.prototype.put = function(/*[id], instance, callback*/) {
  var args = Array.prototype.slice.call(arguments)
    , callback = args.pop()
    , id = typeof args[0] === 'object' ? args[0].id : args.shift()
    , instance = args.shift()
    , self = this
  this.request.call(this, 'put', id, instance, function(err, data) {
    if (err) return callback(err, null)
    if (!(instance instanceof self.model))
      instance = self.createModel(instance)
    self.mergeModel(instance, data)
    instance.isNew = false
    self.cache.views[self.model._type] = {}
    callback(null, self.cache.models[instance.id] = instance)
  })
}

API.prototype.post = function(instance, callback) {
  var self = this
  this.request('post', instance, function(err, data) {
    if (err) return callback(err, null)
    if (!(instance instanceof self.model))
      instance = self.createModel(instance)
    self.mergeModel(instance, data)
    instance.isNew = false
    self.cache.views[self.model._type] = {}
    callback(null, self.cache.models[instance.id] = instance)
  })
}

API.prototype.delete = function(instance, callback) {
  var args = Array.prototype.slice.call(arguments)
    , callback = args.pop(), self = this
  this.request.apply(this, ['delete'].concat(args, function(err, data) {
    if (err) return callback(err, null)
    self.cache.models[instance.id] = null
    self.cache.views[self.model._type] = {}
    callback(null)
  }))
}

exports.initialize = function(model, opts, definition, callback) {
  var api = new API(model)
  if (callback) callback()
  return api
}

exports.init = function(base) {
  basePath = base
}

function APIError(status, message, details) {
    this.name = 'APIError'
    this.status = status
    this.message = message || ''
    this.details = details || {}
}
APIError.prototype = new Error()
APIError.prototype.constructor = APIError