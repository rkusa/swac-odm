var async    = require('async')
  , Todo     = require('./fixtures').Todo
  , fixtures = require('./fixtures')
  , client   = fixtures.client
  , expect   = require('chai').expect

suite('Security', function() {
  var a, b, allow = true
  suiteSetup(function(done) {
    require('./fixtures/todo.views')

    var domain = require('domain')
    var d = domain.create()
    d.req = {}
    d.enter()

    process.nextTick(function() {
      async.parallel([
        function(cb) {
          a = new Todo({ task: 'A', isDone: false })
          a.save(function() {
            cb()
          })
        },
        function(cb) {
          b = new Todo({ task: 'B', isDone: false })
          b.save(function() {
            cb()
          })
        }
      ], done)
    })
  })
  suiteTeardown(function() {
    Todo._definition._allow.instance = {}
    Todo._definition._deny.instance = {}
    fixtures.adapter.clear()
  })
  suite('all', function() {
    setup(function() {
      Todo._definition._allow.instance.all = function(req, todo) {
        return allow && (!todo || todo.task === 'A')
      }
      Todo._definition._deny.instance.all  = function() { return false  }
    })
    test('GET', function(done) {
      async.series([
        function(cb) {
          client.get('/api/todos/' + a.id)
          .end(function(err, res) {
            expect(res.status).to.equal(200)
            var obj = JSON.parse(res.text)
            expect(obj).to.have.property('id', a.id)
            cb()
          })
        },
        function(cb) {
          client.get('/api/todos/' + b.id)
          .end(function(err, res) {
            expect(res.status).to.equal(404)
            cb()
          })
        },
        function(cb) {
          Todo.get(a.id, function(err, todo) {
            expect(todo).to.have.property('id', a.id)
            cb()
          })
        },
        function(cb) {
          Todo.get(b.id, function(err, todo) {
            expect(todo).to.be.null
            cb()
          })
        }
      ], done)
    })
    test('View', function(done) {
      async.series([
        function(cb) {
          client.get('/api/todos')
          .end(function(err, res) {
            expect(res.status).to.equal(200)
            var obj = JSON.parse(res.text)
            expect(obj).to.have.lengthOf(1)
            expect(obj[0]).to.have.property('id', a.id)
            cb()
          })
        },
        function(cb) {
          Todo.all(function(err, todos) {
            expect(todos).to.have.lengthOf(1)
            expect(todos[0]).to.have.property('id', a.id)
            cb()
          })
        }
      ], done)
    })
    test('POST', function(done) {
      async.series([
        function(cb) {
          allow = false
          client.post('/api/todos')
          .send({ task: 'C' })
          .expect(403)
          .end(cb)
        },
        function(cb) {
          allow = true
          client.post('/api/todos')
          .send({ task: 'C' })
          .expect(403)
          .end(cb)
        },
        function(cb) {
          allow = true
          client.post('/api/todos')
          .send({ task: 'A' })
          .expect(200)
          .end(cb)
        },
        function(cb) {
          allow = false
          Todo.post({ task: 'D' }, function(err, todo) {
            expect(err).to.have.property('message', 'Forbidden')
            cb()
          })
        },
        function(cb) {
          allow = true
          Todo.post({ task: 'D' }, function(err, todo) {
            expect(err).to.have.property('message', 'Forbidden')
            cb()
          })
        },
        function(cb) {
          allow = true
          Todo.post({ task: 'A' }, function(err, todo) {
            expect(err).to.be.null
            expect(todo).to.have.property('task', 'A')
            cb()
          })
        }
      ], done)
    }),
    test.skip('PUT', function(done) {
    }),
    test.skip('DELETE', function(done) {
    })
  })
  var todo
  suite('server-only properties', function() {
    suiteSetup(function(done) {
      Todo.post({ task: 'A', isDone: true }, function(err, t) {
        expect(err).to.be.null
        todo = t
        Todo.prototype._validation.isDone.serverOnly = true
        done()
      })
    })
    suiteTeardown(function() {
      Todo.prototype._validation.isDone.serverOnly = false
    })
    test('server-side accessibility', function(done) {
      Todo.get(todo.id, function(err, t) {
        expect(err).to.be.null
        expect(t.isDone).to.equal(true)
        done()
      })
    })
    test('writable from the server-side', function(done) {
      todo.isDone = false
      todo.save(function(err) {
        expect(err).to.be.null
        expect(fixtures.db[todo.id].isDone).to.equal(false)
        done()
      })
    })
    test('not be accessible from the client-side', function(done) {
      client.get('/api/todos/' + todo.id)
      .end(function(err, res) {
        expect(res.status).to.equal(200)
        var obj = JSON.parse(res.text)
        expect(obj).to.not.have.property('isDone')
        done()
      })
    })
    test('not be writable from the client-side', function(done) {
      client.put('/api/todos/' + todo.id)
      .send({ task: 'A', isDone: true })
      .expect(200)
      .end(function(err, req) {
        Todo.get(todo.id, function(err, t) {
          expect(err).to.be.null
          expect(t.isDone).to.equal(false)
          done()
        })
      })
    })
  })
})