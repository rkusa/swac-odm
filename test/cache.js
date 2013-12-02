var fixtures = require('./fixtures')
  , Todo     = fixtures.Todo
  , expect   = require('chai').expect

suiteSetup(function() {
  require('./fixtures/todo.views')

  var domain = require('domain')
  var d = domain.create()
  d.req = {}
  d.enter()
})

suite('Cache', function() {
  setup(function() {
    fixtures.db[1] = new Todo({ id: 1, task: '...', list: 'A' })
    fixtures.db[2] = new Todo({ id: 2, task: '...', list: 'B' })
  })
  teardown(function() {
    fixtures.adapter.clear()
  })
  test('get', function(done) {
    expect(process.domain.cache).to.not.exist

    Todo.get(1, function(err, todo) {
      expect(err).to.not.exist
      expect(todo).to.have.property('id', 1)

      // should be cached
      expect(process.domain.swac).to.exist
      var cache = process.domain.swac.cache
      expect(cache.docs).to.have.property(1)

      // should be equal, but not the same object
      expect(cache.docs[1]).to.not.equal(todo)
      expect(cache.docs[1]).to.eql(todo)

      var mock = cache.docs[1] = new Todo({ task: 'mock' })

      // should be retrieved from cache
      Todo.get(1, function(err, todo) {
        expect(err).to.not.exist
        expect(todo).not.to.equal(fixtures.db[1])
        // should also not be the mock, it should return a copy
        expect(todo).to.not.equal(mock)
        expect(todo).to.have.property('task', 'mock')
        done()
      })
    })
  })
  test('all', function(done) {
    Todo.all(function(err, todos) {
      expect(err).to.not.exist
      expect(todos).to.have.lengthOf(2)

      // should be cached
      expect(process.domain.swac).to.exist
      var cache = process.domain.swac.cache
        , docs  = cache.docs
      expect(cache = cache.views.todos).to.exist
      expect(cache = cache.all).to.exist

      expect(cache).to.have.lengthOf(2)
      // should not be the same array
      expect(cache).to.not.equal(todos)
      // but the same content

      for (var i = 0; i < cache.length; ++i) {
        expect(cache[i]).to.eql(todos[i])
        expect(cache[i]).to.not.equal(todos[i])
        // should but docs into cache, too
        expect(docs[todos[i].id]).to.eql(todos[i])
        expect(docs[todos[i].id]).to.not.equal(todos[i])
      }

      // should be retrieved from cache
      var mock = [new Todo, new Todo]
      cache.splice.apply(cache, [0, 2].concat(mock))

      Todo.all(function(err, todos) {
        expect(err).to.not.exist

        expect(todos).to.have.lengthOf(2)
        expect(todos).to.not.have.members([fixtures.db[1], fixtures.db[2]])

        // should not return the cache, it should return a copy instead
        expect(todos).to.not.equal(mock)

        done()
      })
    })
  })
  test('view', function(done) {
    Todo.byList('A', function(err, todos) {
      expect(err).to.not.exist
      expect(todos).to.have.lengthOf(1)

      // should be cached
      expect(process.domain.swac).to.exist
      var cache = process.domain.swac.cache
      expect(cache = cache.views.todos).to.exist
      expect(cache = cache['byList/A']).to.exist

      expect(cache).to.have.lengthOf(1)
      // should not be the same array
      expect(cache).to.not.equal(todos)
      // but the same content
      for (var i = 0; i < cache.length; ++i) {
        expect(cache[i]).to.eql(todos[i])
      }

      // should be retrieved from cache
      var mock = [new Todo]
      cache.splice.apply(cache, [0, 1].concat(mock))

      Todo.byList('A', function(err, todos) {
        expect(err).to.not.exist

        expect(todos).to.have.lengthOf(1)
        expect(todos).to.not.have.members([fixtures.db[1], fixtures.db[2]])

        // should not return the cache, it should return a copy instead
        expect(todos).to.not.equal(mock)

        done()
      })
    })
  })
  test('post', function(done) {
    process.domain.swac = {
      cache: {
        docs: {},
        views: { all: [], 'byList/A': [] }
      }
    }
    var cache = process.domain.swac.cache

    Todo.post({ task: 'test' }, function(err, todo) {
      expect(err).to.not.exist

      // should be cached
      expect(cache.docs).to.have.property(todo.id)
      expect(cache.docs[todo.id]).to.not.equal(todo)
      expect(cache.docs[todo.id]).to.eql(todo)

      // should invalidate views
      expect(cache.views.todos).to.eql({})

      done()
    })
  })
  test('put', function(done) {
    Todo.get(1, function(err, todo) {
      expect(err).to.not.exist

      expect(process.domain.swac).to.exist
      var cache = process.domain.swac.cache

      expect(cache.docs).to.have.property(1)
      expect(cache.docs[1]).to.not.equal(todo)
      expect(cache.docs[1]).to.eql(todo)

      todo.task = 'updated'

      Todo.put(todo, function(err) {
        expect(err).to.not.exist

        // cache should be updated
        expect(cache.docs[1]).to.have.property('task', 'updated')

        // should invalidate views
        expect(cache.views.todos).to.eql({})

        done()
      })
    })
  })
  test('delete', function(done) {
    process.domain.swac = {
      cache: {
        docs: {},
        views: { all: [], 'byList/A': [] }
      }
    }
    var cache = process.domain.swac.cache

    Todo.get(1, function(err, todo) {
      expect(err).to.not.exist

      // should be cached
      expect(cache.docs).to.have.property(todo.id)
      expect(cache.docs[todo.id]).to.not.equal(todo)
      expect(cache.docs[todo.id]).to.eql(todo)

      Todo.delete(1, function(err) {
        expect(err).to.not.exist

        // should be cached
        expect(cache.docs).to.not.have.property(todo.id)

        // should invalidate views
        expect(cache.views.todos).to.eql({})

        done()
      })
    })
  })
})