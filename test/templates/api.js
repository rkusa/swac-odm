var expect = require('chai').expect
  , fixtures = require('../fixtures')
  , utils = require('../../lib/utils')

module.exports = function(isClient) {
  var Todo = fixtures.Todo
  suiteSetup(function() {
    var domain = require('domain')
    var d = domain.create()
    d.req = {}
    d.enter()
  })
  setup(function() {
    fixtures.db['1'] = new fixtures.Todo({ id: '1', task: '...', isDone: false })
  })
  teardown(function() {
    fixtures.adapter.clear()
  })
  test('view method existance', function() {
    expect(Todo).itself.to.respondTo('byList')
  })
  test('server-side only definition', function() {
    expect(Todo).itself.to.respondTo('all')
    expect(Todo).itself.to.respondTo('get')
    expect(Todo).itself.to.respondTo('find')
    expect(Todo).itself.to.respondTo('post')
    expect(Todo).itself.to.respondTo('put')
    expect(Todo).itself.to.respondTo('del')
    expect(Todo).itself.to.respondTo('delete')
  })
  test('all', function(done) {
    Todo.all(function(err, todos) {
      expect(err).to.not.exist
      expect(todos).to.be.an.array
      expect(todos).to.have.lengthOf(1)
      with (todos[0]) {
        expect(task).to.equal('...')
        expect(isDone).to.equal(false)
      }
      done()
    })
  })
  test('get', function(done) {
    Todo.get('1', function(err, todo) {
      expect(err).to.not.exist
      expect(todo.task).to.equal('...')
      expect(todo.isDone).to.equal(false)
      done()
    })
  })
  test('get to undefined', function(done) {
    Todo.get('2', function(err, todo) {
      expect(err).to.not.exist
      expect(todo).to.be.null
      done()
    })
  })
  test('delete', function(done) {
    Todo.del('1', function(err) {
      expect(err).to.not.exist
      expect(fixtures.db['1']).to.be.undefined
      done()
    })
  })
  test('delete to undefined', function(done) {
    Todo.del('2', function(err) {
      expect(err).to.have.property('status', 404)
      done()
    })
  })
  test('post', function(done) {
    Todo.post({ task: 'do this' }, function(err, todo) {
      expect(err).to.not.exist
      expect(todo).to.have.property('task', 'do this')
      expect(todo).to.have.property('id', 2)
      expect(fixtures.db[2]).to.exist
      expect(fixtures.db[2]).to.have.property('task', 'do this')
      done()
    })
  })
  test('put', function(done) {
    Todo.put('1', { task: 'do something else' }, function(err, todo) {
      expect(err).to.not.exist
      expect(todo).to.have.property('task', 'do something else')
      expect(fixtures.db['1']).to.have.property('task', 'do something else')
      done()
    })
  })
  test('put to undefined', function(done) {
    Todo.put(2, { task: 'do something else' }, function(err, todo) {
      expect(err).to.not.exist
      expect(todo).to.have.property('id', 2)
      expect(todo).to.have.property('task', 'do something else')
      expect(fixtures.db[2]).to.have.property('task', 'do something else')
      expect(fixtures.db[2]).to.have.property('task', 'do something else')
      done()
    })
  })
  test('view', function(done) {
    fixtures.db['2'] = new fixtures.Todo({ id: '2', task: '...', list: 'A' })
    fixtures.db['3'] = new fixtures.Todo({ id: '3', task: '...', list: 'A' })

    Todo.byList('A', function(err, todos) {
      expect(err).to.not.exist
      expect(todos).to.have.lengthOf(2)
      done()
    })
  })
  test('view query', function(done) {
    fixtures.db['2'] = new fixtures.Todo({ id: '2', task: '...', list: 'A' })
    fixtures.db['3'] = new fixtures.Todo({ id: '3', task: '...', list: 'A' })
    
    Todo.byList('A', { limit: 1 }, function(err, todos) {
      expect(err).to.not.exist
      expect(todos).to.have.lengthOf(1)
      done()
    })
  })
}