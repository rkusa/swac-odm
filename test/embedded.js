var expect = require('chai').expect
  , Model = require('../lib/model')
  , Todo = require('./fixtures').Todo

var Project = Model.define('project', function() {
  this.property('todo', { embedded: Todo })
  this.property('todos', { type: 'array', embedded: Todo })
})

suite('Embedded Models', function() {
  describe('Directly embedded', function() {
    it('should be undefined by default', function() {
      var project = new Project
      expect(project.todo).to.be.undefined
    })
    it('should be recognised on model creation', function() {
      var project = new Project({ todo: { task: 'Write more tests' }})
      expect(project.todo).to.be.instanceOf(Todo)
      expect(project.todo.task).to.equal('Write more tests')
    })
    it('should be converted to JSON on #toJSON calls too', function() {
      var project = (new Project({ todo: { task: 'Write more tests' }})).toJSON()
      expect(project.todo).to.not.be.instanceOf(Todo)
      expect(project.todo.task).to.equal('Write more tests')
    })
    it('should only accept propper values', function() {
      var project = new Project
      expect(function() {
        project.todo = 'asd'
      }).to.throw('Property `todo` must be a `todos`')
      expect(function() {
        project.todo = new Todo
      }).to.not.throw()
      expect(function() {
        project.todo = null
      }).to.not.throw()
    })
    it('changed event should be bubbled', function() {
      var project = new Project
      var todo = project.todo = new Todo
      var hasChanged = false
      project.on('changed', function() {
        hasChanged = true
      })
      todo.task = 'something'
      expect(hasChanged).to.be.ok
      project.todo = new Todo
      hasChanged = false
      todo.task = 'something else'
      expect(hasChanged).to.be.not.ok
    })
  })
  describe('Array of embedded models', function() {
    it('should be by default an observable array with the propper child model', function() {
      var project = new Project
      expect(project.todos).to.be.an.array
      expect(project.todos.model).to.equal(Todo)
    })
    it('should be recognised on model creation', function() {
      var project = new Project({ todos: [{ task: 'A' }, { task: 'B' }]})
      expect(project.todos).to.have.lengthOf(2)
      expect(project.todos[0]).to.be.instanceOf(Todo)
      expect(project.todos[1]).to.be.instanceOf(Todo)
      expect(project.todos[0].task).to.equal('A')
      expect(project.todos[1].task).to.equal('B')
    })
    it('should be converted to JSON on #toJSON calls too', function() {
      var project = (new Project({ todos: [{ task: 'A' }, { task: 'B' }]})).toJSON()
      expect(project.todos).to.have.lengthOf(2)
      expect(project.todos[0]).to.not.be.instanceOf(Todo)
      expect(project.todos[1]).to.not.be.instanceOf(Todo)
      expect(project.todos[0].task).to.equal('A')
      expect(project.todos[1].task).to.equal('B')
    })
    it('changed event should be bubbled', function() {
      var project = new Project
      var todo = new Todo
      project.todos = [todo]
      var hasChanged = false
      project.on('changed', function() {
        hasChanged = true
      })
      todo.task = 'something'
      expect(hasChanged).to.be.ok
      project.todos = []
      hasChanged = false
      todo.task = 'something else'
      expect(hasChanged).to.be.not.ok
      project.todos.push(new Todo)
      expect(hasChanged).to.be.ok
    })
  })
})