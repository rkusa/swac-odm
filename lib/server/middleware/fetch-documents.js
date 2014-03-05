module.exports = function(next) {
  // Not neccessary for post requests
  if (this.method === 'post') {
    this.original = new this.model
    if ('id' in this.input) this.original.id = this.input.id
    return next()
  }
  
  var self = this, id

  // Not neccessary if the input is already an appropriated instance
  if (this.isWrite && this.input instanceof this.model) {
    id = this.input.id
  }

  // `get`, `delete` will and `put` could have the id
  // as the first argument
  if (typeof this.input !== 'object') {
    id = this.input
    // if `put` got called with an id, the second argument
    // is the object containing the changes
    if (this.method === 'put')
      this.input = this.args[1]
  }

  if (this.cache.exists) {
    var result = this.cache.fetch()
    result = Array.isArray(result)
              ? result.map(this.cache.save.bind(this.cache))
              : this.cache.save(result)
    if (this.isRead) {
      return this.end(result)
    } else {
      this.original = result
      return next()
    }
  }

  // request the database using the model's adapter
  if (this.method === 'view') {
    this.adapter.view.apply(
      this.adapter,
      this.args.concat(this.query, function(err, docs) {
        if (err) throw err
        self.original = docs
        next()
      })
    )
  } else {
    this.adapter.get(id, function(err, doc) {
      if (err) throw err
      self.original = doc
      next()
    })
  }
}