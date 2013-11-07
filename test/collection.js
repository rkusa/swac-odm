var Todo = require('./fixtures').Todo
  , Collection = require('../lib/collection').Collection
  , expect = require('chai').expect
  , implode = require('implode')
  , proxy = require('node-eventproxy')

var Todos, todos

suite('Collection', function() {
  test('define', function() {
    expect(function() {
      Todos = Collection.define('TodoCollection')
    }).to.throw()
    expect(function() {
      Todos = Collection.define('TodoCollection', function() {})
    }).to.throw();
    expect(function() {
      Todos = Collection.define('TodoCollection', Todo, function() {
        this.property('completed', function() {
          var count = 0
          this.forEach(function(todo) {
            if (todo.isDone) ++count
          })
          return count
        })
      })
    }).not.to.throw()
  })
  test('instantiate', function() {
    todos = new Todos([
      new Todo({ task: 'First',  isDone: true }),
      new Todo({ task: 'Second', isDone: false })
    ])
    expect(todos).to.be.instanceOf(Array)
    expect(todos).to.have.lengthOf(2)
  })
  
  suite('Properties', function() {
    test('should work', function() {
      expect(todos).to.have.property('completed', 1)
      todos[1].isDone = true
      expect(todos).to.have.property('completed', 2)
    })
  })
  
  var prepared
  suite('Serialization', function() {
    suiteSetup(function() {
      todos.on('stackoverflow', proxy(todos, 'reset'))
      prepared = implode(todos)
    })
    test('should include the proper #$type', function() {
      expect(prepared).to.have.property('$type', 'Collection/TodoCollection')
    })
    test('should not include its functional properties', function() {
      expect(prepared.obj).to.not.have.property('completed')
    })
    test('should include events', function() {
      expect(prepared.obj).to.have.property('_events')
      expect(prepared.obj._events).to.have.property('stackoverflow')
    })
  })
    
  suite('Deserialization', function() {
    var recovered
    suiteSetup(function() {
      recovered = implode.recover(prepared)
    })
    test('should recover its instance', function() {
      expect(recovered).to.be.instanceof(Array)
    })
    test('shouldn\'t have the #$type property', function() {
      expect(recovered).to.not.have.property('$type')
    })
    test('should regain its functional properties', function() {
      expect(recovered).to.have.property('completed', 2)
    })
    test('should regain its events', function() {
      expect(recovered).to.have.property('_events')
      expect(recovered._events).to.have.property('stackoverflow')
    })
  })
})