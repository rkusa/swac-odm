module.exports = function(next) {
  // Not neccessary for post requests
  if (this.method === 'post') return next()

  var self = this

  if (this.cache.exists) {
    var result = this.cache.fetch()
    result = Array.isArray(result)
              ? result.map(this.cache.save.bind(this.cache))
              : this.cache.save(result)
    this.original = result
    if (this.isRead) {
      return this.end(result)
    } else if (this.method === 'delete') {
      this.input.instance = this.original
    } else if (this.method === 'put' && !this.input.instance && this.original) {
      this.input.instance = this.original.clone()
    }
    return next()
  }

  // request the database using the model's adapter
  var args = this.method === 'view'
    ? this.args.concat(this.query)
    : [this.id]
  this.adapter[this.method === 'view' ? 'view' : 'get'].apply(
    this.adapter,
    args.concat(function(err, original) {
      if (err) throw err
      self.original = original
      if (self.isRead) {
        self.input.instance = self.original
      } else if (self.method === 'delete') {
        self.input.instance = self.original
      } else if (self.method === 'put' && !self.input.instance && self.original) {
        self.input.instance = self.original.clone()
      }
      next()
    })
  )
}