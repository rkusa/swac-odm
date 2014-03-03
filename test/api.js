var server = require('../lib/server')
  , express = require('express')
  , app = express()
  , httpServer
  , fixtures = require('./fixtures')
  , Todo = fixtures.Todo

suite('API Server', function() {
  suiteSetup(function() {
    require('./fixtures/todo.views')
  })
  require('./templates/api')(false)
})

suite('API Client', function() {
  suiteSetup(function(done) {
    GLOBAL.XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest
    GLOBAL.window = {
      location: { origin: 'http://127.0.0.1:3001' }
    }

    require('./fixtures/todo.views')

    var ajax = require('../lib/ajax-adapter')
    var api = ajax.initialize(Todo, {})
    ;['view', 'get', 'post', 'put', 'delete'].forEach(function(method) {
      Todo[method] = function() {
        var args = Array.prototype.slice.call(arguments)
        return api[method].apply(api, args)
      }
    })
    Todo.all = Todo.view
    Todo.find = Todo.get
    Todo.del = Todo.delete
    for (var view in Todo._definition.views) {
      Todo[view] = Todo.all.bind(Todo, view)
    }

    // configure sever
    // app.use(express.logger('dev'))
    app.use('/api', server.middleware())

    require('../lib').init('/api')

    // start server
    httpServer = require('http').createServer(app)
    httpServer.listen(3001, done)
  })
  suiteTeardown(function(done) {
    httpServer.close(done)
    server.reset()
    Todo.extend(function() {
      this.use(fixtures.adapter,require('./fixtures/todo.views.server').definition)
    })
    fixtures.adapter.clear()
  })
  require('./templates/api')(true)
})