var Model = require('../../lib/model')
module.exports = Model.define('todos', function() {
  this.property('task', { type: 'string', minLength: 1 })
  this.property('isDone', { type: 'boolean' })
})