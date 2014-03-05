var utils = require('./utils')
  , validator = require('validator')
  , validate = require('./validation')
  , proxy = require('node-eventproxy')
  , implode = require('implode')
  , ajaxAdapter = require('./ajax-adapter')
  , Observable

var Definition = function(name, obj, opts, callback) {
  this.name       = name
  this.obj        = obj
  this.opts       = opts
  this.callback   = callback
  this.properties = []
  this.views      = {}
  this.async      = false
  this.api        = null

  this._allow = { properties: {}, instance: {} }
  this._deny  = { properties: {}, instance: {} }
  this.hooks = {}

  Object.defineProperties(obj, {
    _type: { value: name }
  })

  Object.defineProperties(obj.prototype, {
    '_validation': { value: {} }
  })
}

Definition.prototype.apply = function(obj) {
  var values = {}
    , self = this

  this.properties.forEach(function(key) {
    values[key] = undefined
    Object.defineProperty(obj, key, {
      get: function get() {
        if (get.caller && typeof get.caller.fragment !== 'undefined' && !this._validation[key].silent)
          get.caller.fragment.observe(this, key)
        return values[key]
      },
      set: function set(newValue) {
        if (set.caller === implode.recover.traverse) {
          values[key] = newValue
          return
        }
        var scheme = this._validation[key]
        if (newValue !== undefined && newValue !== null) {
          if (scheme.embedded && scheme.type !== 'array' && !(newValue instanceof scheme.embedded)) {
            if (typeof newValue === 'object') {
              newValue = new scheme.embedded(newValue)
            } else {
              throw new Error('Property `' + key + '` must be a `' + scheme.embedded._type + '`')
            }
          }
          switch (scheme.type) {
            case 'number':
              if (!isNaN(parseFloat(newValue)) && isFinite(newValue))
                newValue = Number(newValue)
              else if (newValue.match(/^[0-9]+,([0-9]+)?$/))
                newValue = Number(newValue.replace(',', '.'))
              break
            case 'boolean':
              if (typeof newValue === 'string' && newValue.match(/^true|false$/i))
                newValue = newValue.toLowerCase() === 'true'
              break
            case 'string':
              newValue = '' + newValue
              break
          }
        }
        if (scheme.type !== 'html' && typeof newValue === 'string') {
          newValue = validator.escape(newValue)
        }
        if (values[key] === newValue) return
        this._changedValues[key] = values[key]
        this.changed = true
        if (scheme.type === 'array') {
          if (!Array.isArray(newValue)) {
            throw new Error('Value for property `' + key + '` must be an array')
          }
          if (!values[key]) values[key] = newValue
          else values[key].reset(newValue)
        } else {
          if (!scheme.silent) {
            if (newValue && typeof newValue.on === 'function') {
              newValue.on('changed', proxy(this, 'emit', this, 'changed'))
              newValue.on('changed', proxy(this, 'emit', this, 'changed.' + key))
              newValue.on('changed', proxy(this, 'triggerChanged', self))
            }
            if (values[key] && typeof values[key].on === 'function') {
              values[key].off('changed', proxy(this, 'emit', this, 'changed'))
              values[key].off('changed', proxy(this, 'emit', this, 'changed.' + key))
              values[key].off('changed', proxy(this, 'triggerChanged', self))
            }
          }
          values[key] = newValue
        }
        if (!obj._validation[key].silent) {
          this.emit('changed', this)
          this.emit('changed.' + key, this)
        }
      },
      enumerable: true,
      configurable: true
    })
  })
}

Definition.prototype.property = function property(key, opts) {
  if (!opts) opts = {}
  if (property.caller.serverOnly) opts.serverOnly = true
  this.obj.prototype._validation[key] = opts
  this.properties.push(key)
}

Definition.prototype.use = function(adapter, opts, define) {
  this.async = true
  if (typeof opts === 'function') {
    define = opts
    opts = {}
  } else if (!opts) {
    opts = {}
  }

  if (utils.isServer) {
    if (typeof adapter === 'string') {
      adapter = (require)('swac-' + adapter.toLowerCase())
    }

    // wrap API to provide, authorization, hooks, etc.
    var wrapper = require('./server/adapter-wrapper')
    adapter = wrapper.wrap(adapter)
  }
  // do not define a client-side API, for serverOnly APIs
  else if (opts.serverOnly) {
    return
  }
  // force ajax adapter on the client-side
  else {
    adapter = ajaxAdapter
  }

  utils.wait('initialize adapter for ' + this.name)
  var self = this
  this.api = adapter.initialize(this.obj, opts, define, function() {
    utils.done('initialize adapter for ' + self.name)
    if (self.callback) self.callback()
  })

  var server = utils.isServer ? require('./server') : {}, self = this

  ;['view', 'get', 'post', 'put', 'delete'].forEach(function(method) {
    self.obj[method] = self.api[method].bind(self.api)
    if (!self.opts.serverOnly && utils.isServer) {
      server.defineAPI(self.obj, method, self.api[method], self.opts)
    }
  })

  // aliase
  this.obj.all = this.obj.view
  this.obj.find = this.obj.get
  this.obj.del = this.obj.delete

  // view methods
  for (var view in this.views) {
    this.obj[view] = this.api.view.bind(this.api, view)
    if (!self.opts.serverOnly && utils.isServer) {
      server.defineAPI(this.obj, { view: view, opts: this.views[view] }, self.api.view.bind(self.api), this.opts)
    }
  }

  return adapter
}

Definition.prototype.registerView = function(name, opts) {
  if (!opts) opts = {}
  this.views[name] = opts
}

Definition.prototype.allow = function(props, definition) {
  this.restrict('allow', props, definition)
}

Definition.prototype.deny = function(props, definition) {
  this.restrict('deny', props, definition)
}

;['before', 'after'].forEach(function(t) {
  ['Create', 'Save', 'Update', 'Delete'].forEach(function(callback) {
    Definition.prototype[t + callback] = function(fn) {
      this.hooks[t + callback] = fn
    }
  })
})

Definition.prototype.restrict = function(type, props, definition) {
  if (!definition) {
    definition = props
    props = undefined
  }
  if (props && !Array.isArray(props)) props = [props]
  var self = this
  if (!props) {
    Object.keys(definition).forEach(function(scope) {
      self['_' + type].instance[scope] = definition[scope]
    })
  } else {
    props.forEach(function(prop) {
      if (!self['_' + type].properties[prop])
        self['_' + type].properties[prop] = {}
      Object.keys(definition).forEach(function(scope) {
        self['_' + type].properties[prop][scope] = definition[scope]
      })
    })
  }
}

Definition.prototype.execute = function(fn) {
  fn.call(this)
  if (utils.isClient && !this.api) this.use(ajaxAdapter)
}

var Model = module.exports = function Model(properties) {
  var isNew = true
  Object.defineProperties(this, {
    'changed':        { value: false,       writable: true    },
    '_type':          { value: this._definition.name          },
    '_changedValues': { value: {},          writable: false   },
    '$errors':        { enumerable: true,   writable: true,
                        configurable: true, value: {}         },
    '$warnings':      { enumerable: true,   writable: true,
                        configurable: true, value: {}         },
    '_saveState':     { value: { inProgress: false, queue: [] }},
    'isNew': {
      enumerable: true,
      get: function get() {
        if (typeof get.caller.fragment != 'undefined')
          get.caller.fragment.observe(this, 'isNew')
        return isNew
      },
      set: function(val) {
        if (val === isNew) return
        isNew = val
        this.emit('changed', this)
        this.emit('changed.isNew', this)
      }
    },
    'hasErrors': {
      enumerable: true,
      get: function get() {
        if (typeof get.caller.fragment != 'undefined')
          get.caller.fragment.observe(this, 'hasErrors')
        return Object.keys(this.$errors).length > 0
      }
    },
    'hasWarnings': {
      enumerable: true,
      get: function get() {
        if (typeof get.caller.fragment != 'undefined')
          get.caller.fragment.observe(this, 'hasWarnings')
        return Object.keys(this.$warnings).length > 0
      }
    }
  })

  var self = this

  // apply definition
  this._definition.apply(this)
  
  // set default values
  this._definition.properties.forEach(function(property) {
    var scheme = self._validation[property]
    if (scheme.type === 'array') {
      var values = scheme.default || []
      var collection = scheme.collection || Observable.Array
      self[property] = scheme.embedded
        ? new collection(values, scheme.embedded)
        : new collection(values)
      if (!scheme.silent) {
        self[property].on('changed', proxy(self, 'emit', self, 'changed'))
        self[property].on('changed', proxy(self, 'emit', self, 'changed.' + property))
        self[property].on('changed', proxy(self, 'triggerChanged', self))
      }
    } else if (scheme.default) {
      self[property] = typeof scheme.default === 'function'
        ? scheme.default()
        : JSON.parse(JSON.stringify(scheme.default)) // clone!
    } else if (scheme.type === 'object') {
      self[property] = {}
    }
  })

  // if provided, apply values
  if (properties) {
    Object.keys(properties).forEach(function(property) {
      var scheme = self._validation[property]
      if (self._definition.properties.indexOf(property) !== -1) {
        if (typeof scheme.embedded === 'function') {
          if (scheme.type === 'array') {
            self[property].reset(properties[property].map(function(el) {
              return new scheme.embedded(el) 
            }))
          } else {
            self[property] = new scheme.embedded(properties[property])
          }
        }
        else {
          self[property] = properties[property]
        }
      }
    })
  }
  
  this.resetChangedStatus()
}

utils.eventify(Model)

Model.define = function(name, opts, define, callback) {
  if (typeof opts === 'function') {
    callback = define
    define = opts
    opts = {}
  }

  var definition

  var model = function Model(properties) {
    Object.defineProperties(this, {
      _definition: { value: definition },
      _events: { value: {}, writable: true }
    })

    Model.super_.call(this, properties)
  }

  utils.inherits(model, Model)

  definition = new Definition(name, model, opts || {}, callback)
  Object.defineProperty(model, '_definition', {
    value: definition
  })

  model.extend = function(define) {
    var caller = (new Error().stack.split('\n'))[2]
    if (caller.match(/\.server\.js:[0-9]+:[0-9]+\)$/)) {
      define.serverOnly = true
    } else {
      tryLoadingServerOnlyPart()
    }

    this._definition.execute(define)

    return model
  }

  definition.execute(define)

  if (definition.properties.indexOf('id') === -1)
    definition.property('id')

  implode.register('Model/' + name, model,
                  ['id', '_events', 'isNew', '$errors', '$warnings'].concat(definition.properties))

  tryLoadingServerOnlyPart()

  if (!definition.async && callback) callback()

  return model
}

Model.prototype.triggerChanged = function() {
  this.changed = true
}

Model.prototype.resetChangedStatus = function() {
  this.changed = false
  var self = this
  this._definition.properties.forEach(function(property) {
    self._changedValues[property] = undefined
  })
}

Model.prototype.toJSON = function(all, method, isAPICall) {
  if (!all && (this._definition.opts.serverOnly && isAPICall === true))
    return null

  var self = this
    , json = {}
  
  var authorizationContext = {}
  authorizationContext.isClient = utils.isBrowser ? true : (isAPICall === true)
  authorizationContext.isServer = !authorizationContext.isClient

  this._definition.properties.forEach(function(key) {
    var scheme = self._validation[key]
    if (scheme.persistent === false) return
    
    var allow = self._definition._allow.properties[key]
      && (self._definition._allow.properties[key][method || 'read']
      || self._definition._allow.properties[key].read
      || self._definition._allow.properties[key].all
      || function() { return true })
    var deny = self._definition._deny.properties[key]
      && (self._definition._deny.properties[key][method || 'read']
      || self._definition._deny.properties[key].read
      || self._definition._deny.properties[key].all
      || function() { return false })

    if (all || (
      !scheme.serverOnly
      &&
      (!allow || allow.call(authorizationContext, process.domain.req, self, self[key], key))
      &&
      (!deny || !deny.call(authorizationContext, process.domain.req, self, self[key], key))
    )) {
      if (scheme.embedded && self[key]) {
        json[key] = self[key].toJSON()
      } else if (Array.isArray(self[key]) && Observable.Array.isObservableArray(self[key])) {
        json[key] = self[key].slice()
      } else {
        json[key] = self[key]
      }
    }
  })

  return json
}

Model.prototype.save = function(onSuccess, onError) {
  if (!this.isNew && !this.changed) {
    if (onSuccess) onSuccess(null, this)
    return
  }
  if (this._saveState.inProgress === true) {
    this._saveState.queue.push(onSuccess)
    return
  }
  var self = this
  var callback = function(err, res) {
    self._saveState.inProgress = false
    if (err) {
      if (onError) onError(err)
      else if (onSuccess) onSuccess(err)
      return
    }
    if (onSuccess) onSuccess(null, res)
    if (onSuccess = self._saveState.queue.shift()) {
      self.changed = true
      self.save(onSuccess)
    }
  }
  this._saveState.inProgress = true
  this.resetChangedStatus()
  this.isNew ? this.constructor.post(this, callback) : this.constructor.put(this.id, this, callback)
}

Model.prototype.destroy = function(onSuccess, onError) {
  var self = this
    , cb = function(err) {
      if (err) {
        if (onError) onError(err)
        else if (onSuccess) onSuccess(err)
        return
      }
      self.emit('destroy')
      if (onSuccess) onSuccess(null)
    }
  this.isNew ? cb() : this.constructor.delete(this, cb)
}

Model.prototype.set = function(attrs, opts) {
  if (!attrs) return
  if (!opts) opts = {}
  var self = this
  Object.keys(attrs).forEach(function(key) {
    if (!self._validation.hasOwnProperty(key)) return
    var scheme = self._validation[key]
    if (opts.silent) {
      var originalValue = self._validation[key].silent
      self._validation[key].silent = true
    }

    if (scheme.type === 'array') {
      self[key].reset(attrs[key])
    } else {
      self[key] = attrs[key]
    }    

    if (opts.silent) {
      self._validation[key].silent = originalValue
    }
  })
}

Model.prototype.validate = function(properties, callback) {
  if (typeof properties === 'function') {
    callback = properties
    properties = undefined
  }
  var self = this, isValid = undefined
  if (properties && !Array.isArray(properties)) properties = [properties]
  
  var expectation = {}
  for (var prop in this._validation) {
    if ('expect' in this._validation[prop])
      expectation[prop] = this._validation[prop].expect
  }
  validate(this, expectation, function(issues) {
    var old = self.$warnings
    self.$warnings = {}
    for (var prop in issues) {
      if (properties && !!!~properties.indexOf(prop)) continue
      self.$warnings[prop] = issues[prop]
      self.emit('warnings.changed.' + prop)
    }
    Object.keys(old).forEach(function(key) {
      if (!(key in self.$warnings))
        self.emit('warnings.changed.' + key)
    })
    
    var hasWarnings = Object.keys(issues).length > 0

    validate(self, self._validation, function(issues) {
      var old = self.$errors
      self.$errors = {}
      for (var prop in issues) {
        if (properties && !!!~properties.indexOf(prop)) continue
        self.$errors[prop] = issues[prop]
        self.emit('errors.changed.' + prop)
      }
      Object.keys(old).forEach(function(key) {
        if (!(key in self.$errors))
          self.emit('errors.changed.' + key)
      })
      
      isValid = Object.keys(issues).length === 0

      self.emit('changed', self)
      self.emit('changed.hasErrors', self)
      self.emit('changed.hasWarnings', self)
      
      if (callback) callback(isValid, hasWarnings)
    })
  })
  
  if (isValid !== undefined) return isValid
}

Model.prototype.errorFor = function errorFor(key) {
  if (typeof errorFor.caller.fragment != 'undefined' && !this._validation[key].silent)
    errorFor.caller.fragment.observeError(this, key)
  return this.$errors[key] ? this.$errors[key].message : ''
}

Model.prototype.warningFor = function warningFor(key) {
  if (typeof warningFor.caller.fragment != 'undefined' && !this._validation[key].silent)
    warningFor.caller.fragment.observeWarning(this, key)
  return this.$warnings[key] ? this.$warnings[key].message : ''
}

Model.prototype.clone = function() {
  var clone = new this.constructor()
  clone.set(this.toJSON(true))
  clone.isNew = this.isNew
  return clone
}

function tryLoadingServerOnlyPart() {
  if (utils.isServer) {
    // workarround to get call stack to find file, which defines
    // the server-only part of this model
    var callStack = new Error().stack.split('\n')
      , caller = callStack[3]
      , parts = caller.match(/\(([^:]+):[0-9]+:[0-9]+\)$/)

    if (parts) {
      var path = parts[1].replace(/\.js$/, '.server.js')
        , fs = (require)('fs')
      if (fs.existsSync(path)) {
        process.nextTick(function() {
          (require)(path)
        })
      }
    }
  }
}

Observable = require('./observable')