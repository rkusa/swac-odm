var executeHook = require('../helper/execute-hook')

module.exports = function(next) {
  // not neccessary for read requests
  if (this.isRead) return next()

  var self = this, hook
  switch (this.method) {
    case 'delete': hook = 'afterDelete'; break
    case 'put':    hook = 'afterUpdate'; break
    case 'post':   hook = 'afterCreate'; break
  }
  if (!hook) return next()

  executeHook(self.model, self.input.instance, 'afterSave', function() {
    executeHook(self.model, self.input.instance, hook, next)
  })
}