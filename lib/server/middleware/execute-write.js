module.exports = function(next) {
  // not neccessary for read requests
  if (this.isRead) return next()

  var self = this
  this.adapter[this.method](this.input.instance, function(err) {
    if (err) throw err

    // update cache
    self.cache.invalidate()

    if (self.method !== 'delete') {
      self.cache.store.docs[self.input.instance.id] = self.input.instance.clone()
    } else {
      delete self.cache.store.docs[self.input.instance.id]
    }

    next()
  })
}