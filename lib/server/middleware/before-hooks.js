var executeHook = require('../helper/execute-hook')

module.exports = function(next) {
  // not neccessary for read requests
  if (this.isRead) return next()

  var self = this, hook
  switch (this.method) {
    case 'delete': hook = 'beforeDelete'; break
    case 'put':    hook = 'beforeUpdate'; break
    case 'post':   hook = 'beforeCreate'; break
  }
  if (!hook) return next()

  var origin = process.domain.origin
  process.domain.origin = 'server'

  executeHook(self.model, self.input.intance, 'beforeSave', function(err) {
    if (err) return self.throw(400, 'Bad Request', {
      error: 'Save Rejected',
      details: err
    })

    executeHook(self.model, self.input.instance, hook, function(err) {
      if (err) return self.throw(400, 'Bad Request', {
        error: self.method.charAt(0).toUpperCase() + self.method.slice(1) + ' Rejected',
        details: err
      })

      process.domain.origin = origin
      next()
    })
  })
}