module.exports = function executeHook(model, obj, hook, callback) {
  if (!model._definition.hooks[hook]) return callback()
  model._definition.hooks[hook](process.domain.req, obj, callback)
}