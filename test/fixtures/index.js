var Model = require('../../lib/model')

var Todo = exports.Todo = Model.define('Todo', function() {
  this.property('task', { type: 'string', minLength: 1 })
  this.property('isDone', { type: 'boolean' })
  this.property('category')
})