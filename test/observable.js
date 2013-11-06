var Observable = require('../lib/observable')
  , Model = require('../lib/model')
  , Todo = require('./fixtures').Todo
  , expect = require('chai').expect

suite('Array', function() {
  var todos
  before(function() {
    todos = new Observable.Array(Todo)
  })
  suite('.add()', function() {
    var todo
    before(function() {
      todo = new Todo
    })
    test('add provided models to internal collection', function() {
      var todo = new Todo
      todos.add(todo)
      expect(todos[0]).to.eql(todo)
    })
    test('only accept the defined model type')
    test('trigger the changed event', function() {
      var called = false
      todos.on('changed', function callback() {
        called = true
        todos.off('changed', callback)
      })
      todos.add(new Todo)
      expect(called).to.be.ok
    })
    test('should trigger the add event', function() {
      var called = false
      todos.once('added', function callback() {
        called = true
      })
      todos.add(new Todo)
      expect(called).to.be.ok
    })
  })
  suite('.remove()', function() {
    test('should be triggered if a contained model got destroyed', function() {
      var todo = new Todo
      todos.add(todo)
      var pos = todos.length - 1
      expect(todo).to.eql(todos[pos])
      todo.destroy()
      expect(todos[pos]).to.be.undefined
    })
    test('should trigger the changed event', function() {
      var called = false
      todos.once('changed', function callback() {
        called = true
      })
      todos.remove(todos[0])
      expect(called).to.be.ok
    })
    test('should remove all events from model', function() {
      var todo = new Todo
      todos.add(todo)
      todos.remove(todo)
      
      Object.keys(todo._events).forEach(function(i) {
        expect(todo._events[i]).to.have.lengthOf(0)
      })
    })
  })
  suite('.get()', function() {
    test('should track item\'s #id property', function() {
      var todo = new Todo
      expect(todo).to.have.ownProperty('id')
      expect(todo.id).to.be.undefiend
      todos.add(todo)
      todo.id = 10
      expect(todos.find(10)).to.equal(todo)
      todo.id = 11
      expect(todos.find(10)).to.be.undefined
      expect(todos.find(11)).to.equal(todo)
    })
    test('should return the appropriated model')
  })
  suite('.reset()', function() {
    test('should add the provided models to the internal collection')
  })
  suite('Sort', function() {
    var cmp = function(lhs, rhs) {
      return lhs - rhs
    }
    test('should sort on first call', function() {
      var arr1 = [5, 7, 9, 2, 12, 42, 1]
        , arr2 = Observable.Array(arr1.slice())
      arr1.sort(cmp)
      arr2.sort(cmp)
      expect(arr2).to.have.lengthOf(7)
      for (var i = 0; i < 7; ++i)
        expect(arr1[i]).to.equal(arr2[i])
    })
    suite('should insert new elements appropriately', function() {
      var arr = Observable.Array([5, 7, 9, 2, 12, 42, 1])
      arr.sort(cmp)
      test('on #push()', function() {
        arr.push(10)
        expect(arr).to.have.lengthOf(8)
        expect(arr.indexOf(10)).to.equal(5)
      })
      test('on #unshift()', function() {
        arr.unshift(6)
        expect(arr).to.have.lengthOf(9)
        expect(arr.indexOf(6)).to.equal(3)
      })
      test('on #splice()', function() {
        arr.splice(1, 1, 41)
        expect(arr).to.have.lengthOf(9)
        expect(arr.indexOf(41)).to.equal(7)
      })
    })
    suite('should break insertion-sort appropriately', function() {
      test('on #reverse()', function() {
        var arr = Observable.Array([5, 7, 9, 2, 12, 42, 1])
        arr.sort(cmp)
        arr.reverse()
        expect(arr.compareFunction).to.be.null
      })
      test('on #unsort()', function() {
        var arr = Observable.Array([5, 7, 9, 2, 12, 42, 1])
        arr.sort(cmp)
        arr.unsort()
        expect(arr.compareFunction).to.be.null
      })
    })
    test('should should re-arrange elements on property changes appropriately', function() {
      var arr = new Observable.Array(Todo)
        , a = new Todo({ task: 'A' })
      arr.push(new Todo({ task: 'D' }))
      arr.push(a)
      arr.push(new Todo({ task: 'F' }))
      arr.sort(function(lhs, rhs) {
        if (lhs.task < rhs.task) return -1
        if (lhs.task === rhs.task) return 0
        else return 1
      })
      a.task = 'G'
      expect(arr).to.have.lengthOf(3)
      expect(arr[2].task).to.equal(a.task)
    })
  })
})

suite('Grouped Array', function() {
  var Item = Model.define('Item', function() {
    this.property('type')
  })
  var items
  before(function() {
    items = (new Observable.Array(Item)).groupBy('type')
  })
  test('.add()', function() {
    items.add(new Item({ id: 1, type: 'a' }))
    items.add(new Item({ id: 2, type: 'a' }))
    items.add(new Item({ id: 3, type: 'b' }))
    expect(items).to.have.lengthOf(2)
    expect(items[0]).to.have.property('collection')
    expect(items[0]).to.have.property('id', 'a')
    expect(items[0].collection).to.have.lengthOf(2)
    expect(items[1].collection).to.have.lengthOf(1)
  })
  var a, b
  test('.find()', function() {
    a = items.find(1)
    b = items.find(3)
    expect(a).to.be.instanceOf(Item)
    expect(b).to.be.instanceOf(Item)
  })
  test('.remove', function() {
    items.remove(b)
    expect(items).to.have.lengthOf(1)
  })
  test('change pivot', function() {
    a.type = 'c'
    expect(items).to.have.lengthOf(2)
    expect(items[0].collection).to.have.lengthOf(1)
  })
})