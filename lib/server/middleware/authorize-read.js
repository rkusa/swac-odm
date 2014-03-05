var utils = require('../../utils')
  , authorize = require('../helper/authorize')

module.exports = function(next) {
  if (this.isRead) {
    this.input = this.original
  }
  
  if (this.input === null) {
    return this.end(null)
  }

  if (this.isWrite) {
    return this.end(this.input)
  }

  if (this.method === 'view' && !Array.isArray(this.input)) {
    this.method = 'get'
  }
  
  // the appropriated allow and deny method
  var allow = this.model._definition._allow.instance[this.method]
            || this.model._definition._allow.instance.read
            || this.model._definition._allow.instance.all
            || function() { return true }
  var deny  = this.model._definition._deny.instance[this.method]
            || this.model._definition._deny.instance.read
            || this.model._definition._deny.instance.all
            || function() { return false }

  var input = Array.isArray(this.input) ? this.input : [this.input]
    , output = []
    , self = this

  // authorize every row
  utils.series(input, function(row, cont) {
    var auth = authorize(self, allow, deny, function(isAllowed) {
      if (isAllowed) {
        output.push(row)
      }
      cont()
    })

    auth(row)
  },
  // done
  function() {
    // Cache Result
    var result = Array.isArray(self.input) ? output : (output[0] || null)
    if (self.method === 'view') {
      self.cache.saveView(result)
      result = Array.isArray(result)
        ? result.map(self.cache.save.bind(self.cache))
        : self.cache.save(result)
    } else {
      result = self.cache.save(result)
    }

    self.end(result)
  })
}