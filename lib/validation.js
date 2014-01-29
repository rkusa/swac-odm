var validator = require('validator')

function ValidationError(message) {
  this.name = 'ValidationError'
  this.message = message
}
ValidationError.prototype = new Error()
ValidationError.prototype.constructor = ValidationError

function assert(value, message) {
  var args = Array.prototype.slice.call(arguments)
    , value = args.shift()
    , message = args.shift()

  if (value) return

  args.forEach(function(value, i) {
    message = message.replace('%' + (i + 1), value)
  })

  throw new ValidationError(message)
}

module.exports = function(model, schema, callback) {
  var issues = {}, waitCount = 1
  
  for (var prop in schema) {
    var rules = schema[prop]
      , value = model[prop]
    
    if (!rules.messages) rules.messages = {}
    
    try {
      if (value === undefined) {
        if (rules.required === true)
          throw new ValidationError(rules.messages.required || 'is required')
      
        continue
      }
      
      if (!rules.type) {
        if (rules.minimum !== undefined || rules.maximum !== undefined)
          rules.type = 'number'
        else if (rules.minLength !== undefined || rules.maxLength !== undefined)
          rules.type = 'string'
      }
    
      switch (rules.type) {
        case 'number':
          value = +value
          
          // type
          assert(validator.isFloat(value), rules.messages.type || 'must be a number')
          
          // minimum
          var min = rules.minimum || rules.min
          if (min !== undefined) {
            assert(value >= min, rules.messages.minimum || rules.messages.min || 'must be greater than or equal to %1', min)
          }
          
          // maximum
          var max = rules.maximum || rules.max
          if (max !== undefined) {
            assert(value <= max, rules.messages.maximum || rules.messages.max || 'must be less than or equal to %1', max)
          }
          
          break
        case 'string':
          value = '' + value

          // min length
          var min = rules.minLength
          if (min !== undefined) {
            assert(validator.isLength(value, min), rules.messages.minLength || 'is too short (minimum is %1 characters)', min)
          }
          
          // max length
          var max = rules.maxLength
          if (max !== undefined) {
            assert(validator.isLength(value, 0, max), rules.messages.maxLength || 'is too long (maximum is %1 characters)', max)
          }
          
          break
        case 'array':
          if (!Array.isArray(value))
            throw new ValidationError(rules.messages.type || 'must be an array')
          break
        case 'object':
          if (typeof value !== 'object' || Array.isArray(value))
            throw new ValidationError(rules.messages.type || 'must be an object')
          break
        case 'date':
          assert(validator.isDate(value), rules.messages.type || 'must be a valid date')
          break
        case 'boolean':
          if (value !== true && value !== false)
            throw new ValidationError(rules.messages.type || 'must be a boolean')
          break
        case 'email':
          assert(validator.isEmail(value), rules.messages.type || 'must be a valid email')
          break
      }
      
      if (rules.enum && Array.isArray(rules.enum)) {
        if (rules.enum.indexOf(value) === -1)
          throw new ValidationError(rules.messages.enum || 'must one of the following values: ' + rules.enum.join(', '))
      }
      
      if (rules.conform && typeof rules.conform === 'function') {
        // async
        if (rules.conform.length === 2) {
          waitCount++
          !function(rules, prop) {
            rules.conform.call(model, value, function(result) {
              if (!result) issues[prop] = {
                message: rules.messages.conform || 'must conform to given constraint'
              }
              if (--waitCount === 0 && callback) callback(issues)
            })
          }(rules, prop)
        }
        // sync
        else {
          if (!rules.conform.call(model, value))
            throw new ValidationError(rules.messages.conform || 'must conform to given constraint')
        }
      }
    } catch (e) {
      if (e instanceof ValidationError) {
        issues[prop] = {
          message: e.message
        }
      } else {
        throw e
      }
    }
  }
  
  if (--waitCount === 0) {
    if (callback) callback(issues)
    return issues
  }
}