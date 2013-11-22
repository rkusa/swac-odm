var request  = require('supertest')
  , fixtures = require('./fixtures')
  , client   = fixtures.client
  , expect   = require('chai').expect

suite('Server', function(){
  suiteSetup(function() {
    require('./fixtures/todo.views')
  })
  suite('Operations', function() {
    setup(function() {
      fixtures.db['1'] = new fixtures.Todo({ id: '1', task: '...' })
    })
    teardown(function() {
      fixtures.adapter.clear()
    })
    test('all', function(done) {
      client
      .get('/api/todos')
      .expect(200)
      .end(function(err, res) {
        expect(err).to.not.exist
        expect(res.body).to.be.an.array
        expect(res.body).to.have.lengthOf(1)
        with (res.body[0]) {
          expect(task).to.eql('...')
          expect(isDone).to.eql(false)
        }
        done()
      })
    })
    test('get', function(done) {
      client
      .get('/api/todos/1')
      .expect(200)
      .end(function(err, res) {
        expect(err).to.not.exist
        expect(res.body.task).to.eql('...')
        expect(res.body.isDone).to.eql(false)
        done()
      })
    })
    test('get to undefined', function(done) {
      client
      .get('/api/todos/2')
      .expect(404, done)
    })
    test('delete', function(done) {
      client
      .del('/api/todos/1')
      .expect(204)
      .end(function(err, res) {
        expect(err).to.not.exist
        expect(fixtures.db['1']).to.be.undefined
        done()
      })
    })
    test('delete to undefined', function(done) {
      client
      .del('/api/todos/2')
      .expect(404, done)
    })
    test('post', function(done) {
      client
      .post('/api/todos')
      .send({ task: 'do this' })
      .expect(200)
      .end(function(err, res) {
        expect(err).to.not.exist
        expect(fixtures.db['2']).to.exist
        expect(fixtures.db['2']).to.have.property('task', 'do this')
        done()
      })
    })
    test('put', function(done) {
      client
      .put('/api/todos/1')
      .send({ task: 'do something else'})
      .expect(200)
      .end(function(err, res) {
        expect(err).to.not.exist
        expect(res.body).to.have.property('task', 'do something else')
        expect(fixtures.db['1']).to.have.property('task', 'do something else')
        done()
      })
    })
    test('put to undefined', function(done) {
      client
      .put('/api/todos/2')
      .send({ task: 'do something else'})
      .expect(200)
      .end(function(err, res) {
        expect(err).to.not.exist
        expect(res.body).to.have.property('id', 2)
        expect(res.body).to.have.property('task', 'do something else')
        expect(fixtures.db[2]).to.have.property('task', 'do something else')
        expect(fixtures.db[2]).to.have.property('task', 'do something else')
        done()
      })
    })
    test('view', function(done) {
      fixtures.db['2'] = new fixtures.Todo({ id: '2', task: '...', list: 'A' })
      fixtures.db['3'] = new fixtures.Todo({ id: '3', task: '...', list: 'A' })

      client
      .get('/api/lists/A/todos')
      .expect(200)
      .end(function(err, res) {
        expect(err).to.not.exist
        expect(res.body).to.have.lengthOf(2)
        done()
      })
    })
  })
})