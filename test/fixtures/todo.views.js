require('./todo').extend(function() {
  this.property('list')
  this.registerView('byList', { at: '/lists/:id/todos' })
})