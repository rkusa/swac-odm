var utils = require('../../utils')
  , authorize = require('../helper/authorize')

module.exports = function(next) {
  // not neccessary for read requests
  if (this.isRead) return next()

  // not neccessary for `delete` requests
  if (this.method === 'delete') {
    this.input = this.original
    return next()
  }

  var data = this.input instanceof this.model
      ? this.input.toJSON(true, undefined, this.origin === 'client')
      : this.input

  if (this.method === 'put') {
    delete data.id
  }

  // iterate properties
  var self = this
  utils.series(Object.keys(data), function(key, cont) {
    // the appropriated allow and deny method
    var allow = self.model._definition._allow.properties[key]
                && (self.model._definition._allow.properties[key][self.method]
                || self.model._definition._allow.properties[key].write
                || self.model._definition._allow.properties[key].all)
                || function() { return true }
    var deny  = self.model._definition._deny.properties[key]
                && (self.model._definition._deny.properties[key][self.method]
                || self.model._definition._deny.properties[key].write
                || self.model._definition._deny.properties[key].all)
                || function() { return false }

    if (
      // model does not have such a property
      !self.model.prototype._validation[key] ||
      // is serverOnly Property and got accessed through the Web Service
      (self.origin === 'client' && self.model.prototype._validation[key].serverOnly)
    ) {
      delete data[key]
      return cont()
    }

    // authorize property
    var auth = authorize(self, allow, deny, function(isAllowed) {
      if (!isAllowed) {
        data[key] = self.original[key]
      }
      cont()
    })

    auth(self.method === 'post' ? self.input : self.original, data[key], key)
  },
  // done
  function() {
    if (self.method !== 'delete') {
      if (self.method !== 'post') {
        self.input = self.original.clone()
      }
      self.input.set(data)
      self.input.isNew = false
    }

    next()
  })
}