var expect = require('chai').expect

suite('Model', function() {
  var Todo = require('./fixtures').Todo

  test('#define()', function() {
    expect(Todo).to.be.a('function')
  })

  test('defined properties', function() {
    var todo = new Todo({ task: 'Tu dies' })
    expect(todo).to.have.ownProperty('id')
    expect(todo).to.have.ownProperty('task', 'Tu dies')
    expect(todo).to.have.ownProperty('isDone', null)
  })
})