module.exports = function(next) {
  // not neccessary for read requests
  if (this.isRead) return next()

  var self = this
  this.adapter[this.method](this.input, function(err) {
    if (err) throw err

    // update cache
    self.cache.invalidate()

    if (self.method !== 'delete') {
      self.cache.store.docs[self.input.id] = self.input.clone()
    } else {
      delete self.cache.store.docs[self.input.id]
    }

    next()
  })
}