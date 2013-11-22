var Todo     = require('./todo')
  , fixtures = require('./')

exports.definition = function() {
  this.view('byList', function(todo, list) {
    return todo.list === list
  })
}

Todo.extend(function() {
  this.use(fixtures.adapter, exports.definition)
})