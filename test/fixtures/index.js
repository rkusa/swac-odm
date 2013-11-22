var Todo = exports.Todo = require('./todo')
  , express = require('express')

var app = express()
// app.use(express.logger('dev'))
exports.server = require('../../lib/server')
app.use('/api', exports.server.middleware())
exports.client = require('supertest')(app)

var db = exports.db = {}
exports.adapter = {
  clear: function() {
    for (var key in db) delete db[key]
    delete process.domain.swac
  },
  initialize: function(Todo, opts, definition, callback) {
    var views = {}
    var api = {
      view: function(/*view, key, callback*/) {
        var args = Array.prototype.slice.call(arguments)
          , callback = args.pop()
          , view = args.shift()
          , key = args.shift()
        var arr = []
        Object.keys(db).forEach(function(key) {
          arr.push(db[key])
        })
        if (view) {
          arr = arr.filter(function(row) {
            return views[view](row, key)
          })
        }
        if (callback) callback(null, arr)
      },
      get: function(id, callback) {
        if (callback) callback(null, db[id] || null)
      },
      put: function(todo, callback) {
        if (!todo) return false
        db[todo.id] = todo
        if (callback) callback(null, todo)
      },
      post: function(instance, callback) {
        if (!instance.id) {
          var id = 1
          while (db[id]) id++
          instance.id = id
        }
        db[instance.id] = instance instanceof Todo ? instance : new Todo(instance)
        db[instance.id].isNew = false
        if (callback) callback(null, db[instance.id])
      },
      delete: function(instance, callback) {
        if (!instance) return callback()
        delete db[typeof instance === 'object' ? instance.id : instance]
        if (callback) callback()
      }
    }

    definition.call({
      view: function(name, reduceFn) {
        views[name] = reduceFn
      }
    })

    if (callback) callback()

    return api
  }
}