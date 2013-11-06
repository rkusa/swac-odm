var check = require('validator').check
  , sanitize = require('validator').sanitize

module.exports = function(model, schema, callback) {
  var issues = {}, waitCount = 1
  
  for (var prop in schema) {
    var rules = schema[prop]
      , value = model[prop]
    
    if (!rules.messages) rules.messages = {}
    
    try {
      if (value === undefined) {
        if (rules.required === true)
          throw new Error(rules.messages.required || 'is required')
      
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
          var validation = check(value, {
            isDecimal: rules.messages.type || 'must be a number',
            min: rules.messages.minimum || rules.messages.min || 'must be greater than or equal to %1',
            max: rules.messages.maximum || rules.messages.max || 'must be less than or equal to %1'
          })
          
          // type
          validation.isDecimal()
          
          // minimum
          var min = rules.minimum || rules.min
          if (min !== undefined) validation.min(min)
          
          // maximum
          var max = rules.maximum || rules.max
          if (max !== undefined) validation.max(max)
          
          break
        case 'string':
          value = '' + value
          var validation = check(value, {
            len: rules.messages.minLength || 'is too short (minimum is %1 characters)'
          })
          
          // min length
          var min = rules.minLength
          if (min !== undefined) validation.len(min)
          
          // max length
          validation.errorDictionary.len = rules.messages.maxLength || 'is too long (maximum is %2 characters)'
          var max = rules.maxLength
          if (max !== undefined) validation.len(0, max)
          
          break
        case 'array':
          if (!Array.isArray(value))
            throw new Error(rules.messages.type || 'must be an array')
          break
        case 'object':
          if (typeof value !== 'object' || Array.isArray(value))
            throw new Error(rules.messages.type || 'must be an object')
          break
        case 'date':
          var validation = check(value, {
            isDate: rules.messages.type || 'must be a valid date'
          })
          
          // type
          validation.isDate()
          
          break
        case 'boolean':
          if (value !== true && value !== false)
            throw new Error(rules.messages.type || 'must be a boolean')
          break
        case 'email':
          var validation = check(value, {
            isEmail: rules.messages.type || 'must be a valid email'
          })
          
          // type
          validation.isEmail()
          
          break
      }
      
      if (rules.enum && Array.isArray(rules.enum)) {
        if (rules.enum.indexOf(value) === -1)
          throw new Error(rules.messages.enum || 'must one of the following values: ' + rules.enum.join(', '))
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
            throw new Error(rules.messages.conform || 'must conform to given constraint')
        }
      }
    } catch (e) {
      issues[prop] = {
        message: e.message
      }
    }
  }
  
  if (--waitCount === 0) {
    if (callback) callback(issues)
    return issues
  }
}