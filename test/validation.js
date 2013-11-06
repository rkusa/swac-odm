var expect   = require('chai').expect
  , Model    = require('../lib/model')
  , validate = require('../lib/validation')

suite('Validation', function() {
  suite('required', function() {
    
  })
  suite('number', function() {
    var model = Model.define('NumberValidation', function() {
      this.property('num')
    })
    suite('type', function() {
      test('undefined', function() {
        var issues = validate(new model(), { num: { type: 'number' } })
        expect(issues.num).to.be.undefined
      })
      test('integer', function() {
        var issues = validate(new model({ num: 42 }), { num: { type: 'number' } })
        expect(issues.num).to.be.undefined
      })
      test('integer provided as strings', function() {
        var issues = validate(new model({ num: '42' }), { num: { type: 'number' } })
        expect(issues.num).to.be.undefined
      })
      test('floats', function() {
        var issues = validate(new model({ num: 3.14159265359 }), { num: { type: 'number' } })
        expect(issues.num).to.be.undefined
      })
      test('floats provided as strings', function() {
        var issues = validate(new model({ num: '3.14159265359' }), { num: { type: 'number' } })
        expect(issues.num).to.be.undefined
      })
      test('empty strings', function() {
        var instance = new model({ num: '' })
        var issues = validate(instance, { num: { type: 'number' } })
        expect(issues.num).to.be.undefined
        expect(instance).to.have.property('num', '')
      })
      test('non numeric inputs', function() {
        var issues = validate(new model({ num: 'asd' }), { num: { type: 'number' } })
        expect(issues.num).to.have.property('message', 'must be a number')
      })
    })
    test('minimum', function() {
      var instance = new model({ num: '' }), schema = { num: { type: 'number', min: 42 } }
      var issues = validate(instance, schema)
      expect(issues.num).to.have.property('message', 'must be greater than or equal to 42')
      instance.num = 42
      issues = validate(instance, schema)
      expect(issues.num).to.be.undefined
    })
    test('maximum', function() {
      var instance = new model({ num: 43 }), schema = { num: { type: 'number', max: 42 } }
      var issues = validate(instance, schema)
      expect(issues.num).to.have.property('message', 'must be less than or equal to 42')
      instance.num = 41
      issues = validate(instance, schema)
      expect(issues.num).to.be.undefined
    })
  })
  suite('string', function() {
    var model = Model.define('StringValidation', function() {
      this.property('str')
    })
    test('minLength', function() {
      var instance = new model({ str: '' }), schema = { str: { minLength: 1 } }
      var issues = validate(instance, schema)
      expect(issues.str).to.have.property('message', 'is too short (minimum is 1 characters)')
      instance.str = 'swac'
      issues = validate(instance, schema)
      expect(issues.str).to.be.undefined
    })
    test('maxLength', function() {
      var instance = new model({ str: 'swac' }), schema = { str: { maxLength: 1 } }
      var issues = validate(instance, schema)
      expect(issues.str).to.have.property('message', 'is too long (maximum is 1 characters)')
      instance.str = 'S'
      issues = validate(instance, schema)
      expect(issues.str).to.be.undefined
    })
  })
  suite('array', function() {
    var model = Model.define('ArrayValidation', function() {
      this.property('arr')
    })
    test('validation', function() {
      var instance = new model({ arr: 'swac' }), schema = { arr: { type: 'array' } }
      var issues = validate(instance, schema)
      expect(issues.arr).to.have.property('message', 'must be an array')
      instance.arr = ['swac']
      issues = validate(instance, schema)
      expect(issues.arr).to.be.undefined
    })
  })
  suite('object', function() {
    var model = Model.define('ObjectValidation', function() {
      this.property('obj')
    })
    test('validation', function() {
      var instance = new model({ obj: [] }), schema = { obj: { type: 'object' } }
      var issues = validate(instance, schema)
      expect(issues.obj).to.have.property('message', 'must be an object')
      instance.obj = { name: 'swac' }
      issues = validate(instance, schema)
      expect(issues.obj).to.be.undefined
    })
  })
  suite('date', function() {
    var model = Model.define('DateValidation', function() {
      this.property('date')
    })
    test('validation', function() {
      var instance = new model({ date: 'asd' }), schema = { date: { type: 'date' } }
      var issues = validate(instance, schema)
      expect(issues.date).to.have.property('message', 'must be a valid date')
      instance.date = new Date
      issues = validate(instance, schema)
      expect(issues.date).to.be.undefined
    })
  })
  suite('boolean', function() {
    var model = Model.define('BooleanValidation', function() {
      this.property('bool')
    })
    test('validation', function() {
      var instance = new model({ bool: 'swac' }), schema = { bool: { type: 'boolean' } }
      var issues = validate(instance, schema)
      expect(issues.bool).to.have.property('message', 'must be a boolean')
      instance.bool = true
      issues = validate(instance, schema)
      expect(issues.bool).to.be.undefined
    })
  })
  suite('email', function() {
    var model = Model.define('EmailValidation', function() {
      this.property('email')
    })
    test('validation', function() {
      var instance = new model({ email: 'asd' }), schema = { email: { type: 'email' } }
      var issues = validate(instance, schema)
      expect(issues.email).to.have.property('message', 'must be a valid email')
      instance.email = 'github.m@rkusa.st'
      issues = validate(instance, schema)
      expect(issues.email).to.be.undefined
    })
  })
  suite('enum', function() {
    var model = Model.define('EnumValidation', function() {
      this.property('enum')
    })
    test('validation', function() {
      var instance = new model({ enum: 'd' }), schema = { enum: { enum: ['a', 'b', 'c'] } }
      var issues = validate(instance, schema)
      expect(issues.enum).to.have.property('message', 'must one of the following values: a, b, c')
      instance.enum = 'a'
      issues = validate(instance, schema)
      expect(issues.enum).to.be.undefined
    })
  })
  suite('conform', function() {
    var model = Model.define('ConformValidation', function() {
      this.property('conform')
    })
    test('synchronously', function() {
      var instance = new model({ conform: 'asdf' }), schema = { conform: { conform: function(val) {
        return val === 'swac'
      } } }
      var issues = validate(instance, schema)
      expect(issues.conform).to.have.property('message', 'must conform to given constraint')
      instance.conform = 'swac'
      issues = validate(instance, schema)
      expect(issues.conform).to.be.undefined
    })
    test('asynchronously', function(done) {
      var instance = new model({ conform: 'asdf' }), schema = { conform: { conform: function(val, done) {
        process.nextTick(function() {
          done(val === 'swac')
        })
      } } }
      validate(instance, schema, function(issues) {
        expect(issues.conform).to.have.property('message', 'must conform to given constraint')
        instance.conform = 'swac'
        validate(instance, schema, function(issues) {
          expect(issues.conform).to.be.undefined
          done()
        })
      })
    })
  })
})