var authorize = require('../helper/authorize')

module.exports = function(next) {
  // Not neccessary for read requests
  if (this.isRead) return next()

  // if (this.method !== 'delete' && typeof this.input !== 'object')
  //   return next()
  if (this.method === 'put' && !this.original) {
    this.method = 'post'
  } else if(this.method === 'delete' && !this.original) {
    return this.throw(404, 'Not Found')
  }

  if (this.method === 'post' && !this.input.instance) {
    this.input.instance = new this.model(this.input.data)
  }

  // the appropriated allow and deny method
  var allow = this.model._definition._allow.instance[this.method]
              || this.model._definition._allow.instance.write
              || this.model._definition._allow.instance.all
              || function() { return true }
  var deny  = this.model._definition._deny.instance[this.method]
              || this.model._definition._deny.instance.write
              || this.model._definition._deny.instance.all
              || function() { return false }

  var self = this
  var auth = authorize(this, allow, deny, function(isAllowed) {
    if (isAllowed) next()
    else self.throw(403, 'Forbidden')
  })

  auth(this.method === 'post' ? this.input.instance : this.original)
}