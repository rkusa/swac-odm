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

exports.chain = function(fn) {
  return new Chain(fn)
}

function Chain(fn) {
  var self = this
  this.queue = []
  this.waiting = false
  this.args = []
  this.callback = function() {
    self.args = Array.prototype.slice.call(arguments)
    var next = self.queue.shift()
    if (!next) return self.waiting = false
    self.waiting = true
    next.apply(null, self.args.concat(self.callback))
  }
  this.queue.push(fn)
  this.callback()
}

Chain.prototype.chain = function(fn) {
  this.queue.push(fn)
  if (!this.waiting) this.callback.apply(this, this.args)
  return this
}

exports.series = function(arr, fn, done) {
  var arr = arr.slice()
  !function async() {
    if (arr.length === 0) return done ? done() : undefined
    fn(arr.shift(), async, arr.length)
  }()
}