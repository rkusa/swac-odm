module.exports = function(next) {
  // not neccessary for read requests
  if (this.isRead) return next()

  if (this.method === 'delete') return next()

  var self = this
  this.input.instance.validate(function(isValid) {
    if (!isValid) {
      return self.throw(400, 'Bad Request', {
        error: 'Validation Error',
        details: self.input.instance.$errors
      })
    }

    next()
  })
}
