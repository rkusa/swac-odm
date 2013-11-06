var utils = require('./utils')
  , sanitize = require('validator').sanitize
  , proxy = require('node-eventproxy')
  , Observable

var Definition = function(name, obj, opts, callback) {
  this.name       = name
  this.obj        = obj
  this.opts       = opts
  this.callback   = callback
  this.properties = []
  this.async      = false
  this._events    = {}

  Object.defineProperties(obj, {
    _type: { value: name },
    allow: { value: { properties: {}, instance: {} }, enumerable: true },
    deny:  { value: { properties: {}, instance: {} }, enumerable: true },
    hooks: { value: {}, enumerable: true }
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
    // default values:
    if ('default' in self.obj.prototype._validation[key]) {
      values[key] = typeof self.obj.prototype._validation[key].default === 'function'
        ? self.obj.prototype._validation[key].default()
        : self.obj.prototype._validation[key].default
    } else {
      switch (self.obj.prototype._validation[key].type) {
        case 'boolean':
          values[key] = false
          break
        case 'string':
          values[key] = ''
          break
      }
    }
    Object.defineProperty(obj, key, {
      get: function get() {
        if (typeof get.caller.fragment != 'undefined' && !this._validation[key].silent)
          get.caller.fragment.observe(this, key)
        return values[key]
      },
      set: function(newValue) {
        if (newValue !== undefined && newValue !== null) {
          switch (this._validation[key].type) {
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
        if (this._validation[key].type !== 'html' && typeof newValue === 'string') {
          newValue = sanitize(newValue).escape()
        }
        if (values[key] === newValue) return
        this._changedValues[key] = values[key]
        this.changed = true
        if (Array.isArray(newValue)) {
          if (Array.isArray(values[key]) && typeof values[key].off === 'function')
            values[key].off('changed', this)
          if ('emit' in newValue)
            values[key] = newValue
          else 
            values[key] = new Observable.Array(newValue)
          if (!this._validation[key].silent) {
            values[key].on('changed', proxy(this, 'emit', this, 'changed'))
            values[key].on('changed', proxy(this, 'emit', this, 'changed.' + key))
            values[key].on('changed', proxy(this, 'triggerChanged'))
          }
        } else {
          values[key] = newValue
        }
        if (!obj._validation[key].silent) {
          this.emit('changed', this)
          this.emit('changed.' + key, this)
        }
      },
      enumerable: true
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
  if (!opts) opts = {}
  if (utils.isServer) {
    if (typeof adapter === 'string')
      adapter = (require)('swac-' + adapter)
  } else if (adapter !== ajaxAdapter || opts.serverOnly) {
    return
  }
  utils.wait('initialize adapter for ' + this.name)
  var self = this
  api[this.name] = adapter.initialize(this.obj, opts, define, function() {
    utils.done('initialize adapter for ' + self.name)
    if (self.callback) self.callback()
  })
  ;['list', 'get', 'post', 'put', 'delete'].forEach(function(method) {
    self.obj[method] = Model.getMethodFn(method, self.obj)
    if (!self.opts.serverOnly && utils.isServer)
      defineApi(self.obj, method, self.opts)
  })
  return adapter
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
      this.obj.hooks[t + callback] = fn
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
      self.obj[type].instance[scope] = definition[scope]
    })
  } else {
    props.forEach(function(prop) {
      if (!self.obj[type].properties[prop])
        self.obj[type].properties[prop] = {}
      Object.keys(definition).forEach(function(scope) {
        self.obj[type].properties[prop][scope] = definition[scope]
      })
    })
  }
}

var Model = module.exports = function Model(properties) {
  Object.defineProperties(this, {
    'changed':        { value: false,       writable: true    },
    'isNew':          { value: true,        writable: true    },
    '_type':          { value: this._definition.name          },
    '_changedValues': { value: {},          writable: false   },
    '$errors':        { enumerable: true,   writable: true,
                        configurable: true, value: {}         },
    '$warnings':      { enumerable: true,   writable: true,
                        configurable: true, value: {}         },
    '_saveState':     { value: { inProgress: false, queue: [] } }
  })

  var self = this

  // apply definition
  this._definition.apply(this)
  
  // set default values
  this._definition.properties.forEach(function(property) {
    if (self._validation[property].default) {
      self[property] = typeof self._validation[property].default === 'function'
        ? self._validation[property].default()
        : JSON.parse(JSON.stringify(self._validation[property].default)) // clone!
    }
  })

  // if provided, apply values
  if (properties) {
    Object.keys(properties).forEach(function(property) {
      if (self._definition.properties.indexOf(property) !== -1) {
        if (typeof self._validation[property].embedded === 'function')
          self[property] = new self._validation[property].embedded(properties[property])
        else
          self[property] = properties[property]
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
    Object.defineProperty(this, '_definition', {
      value: definition
    })

    Model.super_.call(this, properties)
  }

  utils.inherits(model, Model)

  definition = new Definition(name, model, opts || {}, callback)
  Object.defineProperty(model, '_definition', {
    value: definition
  })
  define.call(definition)

  if (definition.properties.indexOf('id') === -1)
    definition.property('id')

  if (utils.isServer) {
    // workarround to get call stack to find file, which defines
    // the server-only part of this model
    var callStack = new Error().stack.split('\n')
      , caller = callStack[2]
      , parts = caller.match(/\(([^:]+):[0-9]+:[0-9]+\)$/)

    if (parts) {
      var path = parts[1].replace(/\.js$/, '.server.js')
        , fs = (require)('fs')
      if (fs.existsSync(path)) {
        // process.nextTick(function() {
          (require)(path)
        // })
      }
    }
  }

  if (!definition.async && callback) callback()

  return model
}

Model.prototype.extend = function(define) {
  var caller = (new Error().stack.split('\n'))[2]
  if (caller.match(/\.server\.js:[0-9]+:[0-9]+\)$/)) {
    define.serverOnly = true
  }
  define.call(this._definition)
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
    var allow = model.allow.properties[key]
      && (model.allow.properties[key][method || 'read']
      || model.allow.properties[key].read
      || model.allow.properties[key].all
      || function() { return true })
    var deny = model.deny.properties[key]
      && (model.deny.properties[key][method || 'read']
      || model.deny.properties[key].read
      || model.deny.properties[key].all
      || function() { return false })

    if (all || (
      !self._validation[key].serverOnly
      &&
      (!allow || allow.call(authorizationContext, process.domain.req, model))
      &&
      (!deny || !deny.call(authorizationContext, process.domain.req, model))
    )) {
      json[key] = self[key]
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
  this.isNew ? model.post(this, callback) : model.put(this.id, this, callback)
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
  this.isNew ? cb() : model.delete(this, cb)
}

Model.prototype.set = function(attrs, opts) {
  if (!attrs) return
  if (!opts) opts = {}
  var self = this
  Object.keys(attrs).forEach(function(key) {
    if (!self.hasOwnProperty(key)) return
    if (opts.silent) {
      var originalValue = self._validation[key].silent
      self._validation[key].silent = true
      self[key] = attrs[key]
      self._validation[key].silent = originalValue
    } else self[key] = attrs[key]
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
    
    hasWarnings = Object.keys(issues).length > 0

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

Observable = require('./observable')