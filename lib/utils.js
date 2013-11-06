exports.isClient = typeof window !== 'undefined' && !!window.document
exports.isServer = !exports.isClient

exports.inherits = function(ctor, superCtor) {
  ctor.super_ = superCtor;
  ctor.prototype = Object.create(superCtor.prototype, {
    constructor: { value: ctor, enumerable: false }
  })
}

var EventEmitter = require('events').EventEmitter
  , proxy = require('node-eventproxy')
exports.eventify = function(constructor) {
  for (var method in EventEmitter.prototype) {
    constructor.prototype[method] = EventEmitter.prototype[method]
  }
  proxy.enable(constructor)
  constructor.prototype.off = constructor.prototype.removeListener
}

var proxy = require('node-eventproxy')

var Observer = function(event) {
  this.event = event
  this.args = []
}

Observer.prototype.until = function(event) {
  this.until = event
  return this
}

Observer.prototype.withArgs = function() {
  this.args.push.apply(this.args, Array.prototype.slice.call(arguments))
  return this
}

Observer.prototype.call = function(target, method) {
  this.target = target
  this.method = method
  return this
}

Observer.prototype.on = function(target) {
  target.on(this.event, proxy.apply(null, [this.target, this.method, this.target].concat(this.args)))
  if (!this.until) return
  target.once(this.until, proxy(target, 'off', target, this.event, proxy(this.target, this.method)))
}

exports.observe = function(event) {
  return new Observer(event)
}