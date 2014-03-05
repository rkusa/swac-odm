var utils = require('../../utils')
  , authorize = require('../helper/authorize')

module.exports = function(next) {
  // not neccessary for read requests
  if (this.isRead) return next()

  // not neccessary for `delete` requests
  if (this.method === 'delete') return next()

  // iterate properties
  var self = this
  utils.series(Object.keys(self.input.data), function(key, cont) {
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
      delete self.input.data[key]
      return cont()
    }

    // authorize property
    var auth = authorize(self, allow, deny, function(isAllowed) {
      if (!isAllowed) {
        self.input.data[key] = self.original ? self.original[key] : undefined
      }
      cont()
    })

    auth(self.input.instance, self.input.data[key], key)
  },
  // done
  function() {
    if (self.method !== 'delete') {
      self.input.instance.set(self.input.data)
      self.input.instance.isNew = false
    }

    next()
  })
}