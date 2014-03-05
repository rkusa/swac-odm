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

  executeHook(self.model, self.input, 'beforeSave', function(err) {
    if (err) return self.throw(400, 'Bad Request', {
      error: 'Save Rejected',
      details: err
    })

    executeHook(self.model, self.input, hook, function(err) {
      if (err) return self.throw(400, 'Bad Request', {
        error: method.charAt(0).toUpperCase() + method.slice(1) + ' Rejected',
        details: err
      })
      
      next()
    })
  })
}