module.exports = function authorize(call, allowFn, denyFn, done) {
  var authorizationContext = {}
  authorizationContext.isClient = call.origin === 'client'
  authorizationContext.isServer = !authorizationContext.isClient

  return function() {
    var args = Array.prototype.slice.call(arguments)
      , count = 2
      , allow, deny

    var callback = function() {
      if (--count !== 0) return
      done(allow && !deny)
    }

    if (typeof (allow = allowFn.apply(authorizationContext, [process.domain.req].concat(args, function(res) {
      process.nextTick(function() {
        allow = res
        callback()
      })
    }))) === 'boolean' || allowFn.length <= (args.length + 1)) callback()
      
    if (typeof (deny = denyFn.apply(authorizationContext, [process.domain.req].concat(args, function(res) {
      process.nextTick(function() {
        deny = res
        callback()
      })
    }))) === 'boolean' || denyFn.length <= (args.length + 1)) callback()
  }
}