var Todo     = require('./todo')
  , fixtures = require('./')

Todo.extend(function() {
  this.use(fixtures.adapter, function() {
    this.view('byList', function(todo, list) {
      return todo.list === list
    })
  })
})