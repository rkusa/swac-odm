var Cache = module.exports = function(call) {
  this.call = call

  if (!process.domain.swac) {
    process.domain.swac = { cache: { docs: {}, views: {} } }
  }

  var cache = process.domain.swac.cache

  this.store = {
    docs: cache.docs,
    view: cache.views[call.model._type] || (cache.views[call.model._type] = {})
  }

  if (call.operation === 'view') {
    this.id = ((call.args.join('/') || 'all') + '?' + Object.keys(call.query).map(function(key) {
      return key + '=' + call.query[key]
    }).join('&')).replace(/\?$/, '')
  } else {
    this.id = typeof call.input === 'object'
                ? call.input.id
                : call.input
  }
}

Object.defineProperties(Cache.prototype, {
  exists: { enumerable: true, get: function() {
    if (this.call.operation === 'view') {
      return this.id in this.store.view
    } else {
      return this.id in this.store.docs
    }
  }}
})

Cache.prototype.save = function(doc) {
  if (!doc) return doc
  this.store.docs[doc.id] = doc
  if (doc instanceof this.call.model) {
    doc.isNew = false
    return doc.clone()
  } else {
    return doc
  }
}

Cache.prototype.saveView = function(docs) {
  if (this.call.operation === 'view') {
    this.store.view[this.id] = docs
  }
}

Cache.prototype.fetch = function() {
  if (this.call.operation === 'view') {
    return this.store.view[this.id]
  } else {
    return this.store.docs[this.id]
  }
}

Cache.prototype.invalidate = function() {
  if (this.call.operation === 'view') {
    process.domain.swac.cache.views[this.call.model._type] = {}
  }
}