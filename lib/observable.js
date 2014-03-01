var utils = require('./utils')
  , Model = require('./model')
  , proxy = require('node-eventproxy')
  , implode = require('implode')

var Group = exports.Group = Model.define('Group', function() {
  this.property('collection')
  this.property('keepIfEmpty')
})

var ObservableArray = exports.Array = function ObservableArray(values, model) {
  if (!model && !Array.isArray(values)) {
    model = values
    values = null
  }

  // inheriting from Array returns an object
  // to workaround this, we create an instance of Array
  // and overwrite the isntance's methods

  var array = new Array

  array._events = {}
  array._byId   = {}
  array.model   = model
  array.compareFunction = null

  var contract = ['model', '_events', '_byId', 'compareFunction']
  contract.id = 'ObservableArray'
  Object.defineProperty(array, '$contract', {
    value: contract,
    writable: true
  })

  for (var method in ObservableArray.prototype) {
    array[method] = ObservableArray.prototype[method]
  }

  Object.defineProperty(array, 'size', {
    get: array.getLength
  })

  if (values && Array.isArray(values)) {
    values.forEach(function(item) {
      array.push(item)
    })
  }

  return array
}

utils.inherits(ObservableArray, Array)
utils.eventify(ObservableArray)
  
function adding(element) {
  if (typeof element !== 'object') return element
  if (this.model && !(element instanceof this.model)) {
    element = new this.model(element)
    element.isNew = false
  }
  if (!('id' in element)) return element
  if (element.id !== undefined) {
    this._byId[element.id] = element
  } else {
    if (gotEventified(element)) {
      utils.observe('changed.id').until('removed')
           .call(this, 'reassign').withArgs(element)
           .on(element)
    }
  }
  return element
}

function added(element, index) {
  if (typeof element === 'object') {
    if (gotEventified(element)) {
      element.on('changed', proxy(this, 'emit', this, 'changed'))
      element.once('destroy', proxy(this, 'remove', this, element))
    }
  }
  
  this.emit('added', element, index)
}

function removed(element) {
  if (this._byId[element.id] === element)
    delete this._byId[element.id]
  this.emit('removed', element)
  if (gotEventified(element)) {
    element.emit('removed', this)
    element.off('changed', this)
    element.off('destroy', this)
    if (this.compareFunction && this.compareFunction.affected) {
      this.compareFunction.affected.forEach(function(key) {
        element.off('changed.' + key, this)
      })  
    }
  }
}

ObservableArray.isObservableArray = function(arr) {
  return arr.push === ObservableArray.prototype.push
}

ObservableArray.prototype.getLength = function() {
  return this.length
}

ObservableArray.prototype.clone = function() {
  return new ObservableArray(this, this.model)
}

ObservableArray.prototype.reassign = function(element) {
  this._byId[element.id] = element
  if (element._changedValues.id !== undefined
   || element._changedValues.id !== null)
    delete this._byId[element._changedValues.id]
}

ObservableArray.prototype.find = ObservableArray.prototype.get = function(id) {
  return this._byId[id]
}

ObservableArray.prototype.pop = function() {
  var result = Array.prototype.pop.apply(this, arguments)
  removed.call(this, result)
  this.emit('changed')
  return result
}

function push(element) {
  if (!this.compareFunction) {
    var result = Array.prototype.push.call(this, (element = adding.call(this, element)))
    added.call(this, element)
    return result - 1
  } else {
    var idx = binarySearch(this, element, true, this.compareFunction)
    Array.prototype.splice.call(this, idx, 0, (element = adding.call(this, element)))
    // array have to be appended to the event queue
    // because if multiple items should be inserted
    // the position of each can depend on each other
    // setTimeout(function() {
      var self = this
      added.call(this, element, idx)
      if (this.compareFunction.affected) {
        this.compareFunction.affected.forEach(function(key) {
          element.on('changed.' + key, proxy(self, 'move', self, element))
        })  
      }
    // })
    return idx
  }
}

ObservableArray.prototype.push = function() {
  var self = this
    , elements = Array.prototype.slice.call(arguments)

  elements = elements.filter(function(el) {
    return el !== null && el !== undefined
  })
  
  elements.forEach(function(element) {
    push.call(self, element)
  })

  this.emit('changed')
  return this.length
}

ObservableArray.prototype.add = function(element) {
  element = this[push.call(this, element)]
  this.emit('changed')
  return element
}

var remove = ObservableArray.prototype.remove = function(element) {
  var index = -1
  if ((index = this.indexOf(element)) === -1)
    return false
  this.splice(index, 1)
  return index
}

ObservableArray.prototype.reverse = function() {
  this.unsort()
  Array.prototype.reverse.apply(this, arguments)
  this.emit('changed')
}

ObservableArray.prototype.shift = function() {
  var result = Array.prototype.shift.apply(this, arguments)
  removed.call(this, result)
  this.emit('changed')
  return result
}

ObservableArray.prototype.sort = function(compareFunction) {
  var self = this
  
  this.compareFunction = compareFunction || function(lhs, rhs) {
    if (lhs < rhs) return -1
    if (lhs === rhs) return 0
    else return 1
  }
  var sorted = mergeSort(this, this.compareFunction)
  for (var i = 0; i < sorted.length; ++i) {
    this[i] = sorted[i]
    // if (gotEventified(this[i]))
    //   this[i].emit('moved', i)
  }

  if (this.model) {
    var tmp1 = new this.model
      , tmp2 = new this.model
    
    this.compareFunction.affected = []
    this.compareFunction.fragment = {
      observe: function(_, key) {
        if (self.compareFunction.affected.indexOf(key) === -1)
          self.compareFunction.affected.push(key)
      }
    }
    this.compareFunction(tmp1, tmp2)
    delete this.compareFunction.fragment
    
    this.forEach(function(element) {
      self.compareFunction.affected.forEach(function(key) {
        element.on('changed.' + key, proxy(self, 'move', self, element))
      })  
    })
  }

  this.emit('changed')
}

ObservableArray.prototype.sortBy = function(prop) {
  var fn = function sort(lhs, rhs) {
    var prop = sort.prop
    if (!lhs[prop] && !rhs[prop]) return 0
    if (!lhs[prop]) return -1
    if (!rhs[prop]) return 1
    var a = typeof lhs[prop] === 'string' ? lhs[prop].toLowerCase() : lhs[prop] 
      , b = typeof rhs[prop] === 'string' ? rhs[prop].toLowerCase() : rhs[prop] 
    if (a < b) return -1
    if (a === b) return 0
    else return 1
  }
  fn.prop = prop
  this.sort(fn)
}

ObservableArray.prototype.unsort = function() {
  var self = this
  if (this.compareFunction && this.compareFunction.affected) {
    this.forEach(function(element) {
      self.compareFunction.affected.forEach(function(key) {
        element.off('changed.' + key, proxy(self, 'move'))
      })
    })
  }
  this.compareFunction = null
}

ObservableArray.prototype.move = function(element) {
  var index = this.indexOf(element)
  if (index === -1) return
  
  Array.prototype.splice.call(this, index, 1)
  var idx = binarySearch(this, element, true, this.compareFunction)
  Array.prototype.splice.call(this, idx, 0, element)
  
  if (gotEventified(element))
    element.emit('moved', idx)
}

ObservableArray.prototype.splice = function() {
  var args = Array.prototype.slice.call(arguments)
    , index = args.shift()
    , howMany = args.shift()
    , newElements = []
    , self = this

  args.forEach(function(element) {
    newElements.push(element)
  })
  
  if (!this.compareFunction) {
    for (var i = 0; i < newElements.length; ++i)
      newElements[i] = adding.call(this, newElements[i])
    args = [index, howMany].concat(newElements)
  } else {
    args = [index, howMany]
  }
  
  var result = Array.prototype.splice.apply(this, args)
  result.forEach(function(element) {
    removed.call(self, element)
  })
  
  if (this.compareFunction) {
    this.push.apply(this, newElements)
  } else {    
    for (var i = 0; i < newElements.length; ++i)
      newElements[i] = added.call(this, newElements[i], index + i)
  }
  
  this.emit('changed')
  return result
}

ObservableArray.prototype.unshift = function() {
  var self = this
    , elements = Array.prototype.slice.call(arguments)
    , result
  
  if (!this.compareFunction) {
    elements.forEach(function(element) {
      result = Array.prototype.unshift.call(self, (element = adding.call(self, element)))
      added.call(self, element, 0)
    })
  } else {
    this.push.apply(this, elements)
  }
  
  this.emit('changed')
  return result
}

ObservableArray.prototype.reset = function(elements) {
  if (typeof elements === 'undefined') elements = []
  else if (typeof elements === 'object' && !Array.isArray(elements)) {
    elements = Object.keys(elements).map(function(id) {
      var obj = elements[id]
      obj.id = id
      return obj
    })
  }
  this.splice.apply(this, [0, this.length].concat(elements))
  return this.length
}

ObservableArray.prototype.save = function(callback) {
  var waitFor = this.length
    , cb = function() {
    if (--waitFor === 0 && callback) callback()
  }
  this.forEach(function(item) {
    item.save(cb)
  })
}

ObservableArray.prototype.groupBy = function(prop, sub) {
  return exports.GroupedArray.call(this, this.model, prop, sub)
}

ObservableArray.prototype.toJSON = function() {
  return Array.prototype.map.call(this, function(item) {
    return item.toJSON()
  })
}

var defaultMethods = ['map', 'filter', 'reduce']
defaultMethods.forEach(function(method) {
  ObservableArray.prototype[method] = function custom(fn, arg1) {
    var self = this
    fn.fragment = custom.caller.fragment
    var result = Array.prototype[method].call(self, function() {
      var args = Array.prototype.slice.call(arguments)
      return fn.apply(self, args)
    }, arg1)
    return Array.isArray(result) ? new exports.Array(result, this.model) : result
  }
})

ObservableArray.prototype.$deserialize = function(obj) {
  if (typeof obj.compareFunction === 'function')
    obj.sort(obj.compareFunction)
  return obj
}

var GroupedObservableArray = exports.GroupedArray = function GroupedObservableArray(model, prop, sub) {
  var grouped = new exports.Array(Group)
  grouped.prop = prop
  grouped.compareFunction = null
  grouped.sub = sub
  grouped.subModel = model

  grouped.prop = prop
  grouped.$contract.id = 'ObservableGroupedArray'
  grouped.$contract.push('prop')

  for (var method in GroupedObservableArray.prototype) {
    grouped[method] = GroupedObservableArray.prototype[method]
  }

  if (this.length > 0)
    this.forEach(grouped.add.bind(grouped))
  
  return grouped
}

GroupedObservableArray.prototype.check = function(group) {
  if (!group.keepIfEmpty && group.collection.length === 0) {
    group.off('changed', this)
    group.destroy()
  }
}

GroupedObservableArray.prototype.pivotChanged = function(item) {
  this.remove(item, true)
  this.add(item)
}

GroupedObservableArray.prototype.add = function(item) {
  var group = this.get(item[this.prop])
  if (!group) {
    group = this.createGroup(item[this.prop])
    this.push(group)
  }
  item = group.collection.add(item)
  
  if (gotEventified(item))
    item.once('changed.' + this.prop, proxy(this, 'pivotChanged', this, item))
}

GroupedObservableArray.prototype.reset = function(items) {
  // empty
  for (var i = this.length - 1; i >= 0; --i)
    this[i].collection.reset()
  
  var self = this
  this.forEach(function(group) {
    self.check(group)
  })
  
  // insert
  if (items)
    items.forEach(this.add.bind(this))
}

GroupedObservableArray.prototype.createGroup = function(key, keepIfEmpty) {
  var group = new Group({
    collection: (this.sub ? new this.sub : new exports.Array(this.subModel)),
    keepIfEmpty: keepIfEmpty === true
  })
  group.id = key
  group.isNew = true
  group.collection.on('removed', proxy(this, 'check', this, group))
  group.collection.on('changed', proxy(this, 'emit', this, 'changed'))
  if (this.compareFunction) {
    group.collection.sort(this.compareFunction)
  }
  return group
}

GroupedObservableArray.prototype.sort = function(compareFunction) {
  var self = this
  
  this.compareFunction = compareFunction || function(lhs, rhs) {
    if (lhs < rhs) return -1
    if (lhs === rhs) return 0
    else return 1
  }
  
  this.forEach(function(group) {
    group.collection.sort(self.compareFunction)
  })
}

GroupedObservableArray.prototype.unsort = function() {
  var self = this
  this.forEach(function(group) {
    group.collection.unsort(self.compareFunction)
  })
  this.compareFunction = null
}

GroupedObservableArray.prototype.getOrCreate = function(id) {
  var group = this.get(id)
  if (!group) {
    group = this.createGroup(id, true)
    this.push(group)
  }
  group.keepIfEmpty = true
  return group
}

var remove = function(element) {
  var index = -1
  if ((index = this.indexOf(element)) === -1)
    return false
  return this.splice(index, 1)
}

GroupedObservableArray.prototype.remove = function(item, move) {
  if (typeof item === 'undefined') return
  if (item instanceof Group)
    return remove.call(this, item)
  if (gotEventified(item))
    item.off('changed.' + this.prop, this)
  var group = this.get(move ? item._changedValues[this.prop] : item[this.prop])
  if (!group) return
  group.collection.remove(item)
}

GroupedObservableArray.prototype.find = function(id) {
  for (var i = 0; i < this.length; ++i) {
    var result = this[i].collection.find(id)
    if (result) return result
  }
  return null
}

GroupedObservableArray.prototype.$deserialize = function(obj) {
  var compareFunction
  eval('compareFunction = ' + obj.compareFunction)
  obj.compareFunction = compareFunction
  return obj
}

implode.register('ObservableArray', exports.Array, ['model', '_events'])
implode.register('ObservableGroupedArray', exports.GroupedArray, ['model', '_events'])

function gotEventified(obj) {
  return obj && typeof obj.emit === 'function'
}

var merge = function(lhs, rhs, compareFunction) {
  var result = []
  
  while (lhs.length && rhs.length) {
    if (compareFunction(lhs[0], rhs[0]) < 1)
      result.push(lhs.shift())
    else
      result.push(rhs.shift())
  }
  
  while (lhs.length)
    result.push(lhs.shift())
  
  while (rhs.length)
    result.push(rhs.shift())
  
  return result
}

function mergeSort(arr, compareFunction) {
  if (arr.length < 2)
    return arr
  
  var middle = parseInt(arr.length / 2)
  var left   = arr.slice(0, middle)
  var right  = arr.slice(middle, arr.length)
  
  return merge(mergeSort(left, compareFunction),
               mergeSort(right, compareFunction),
               compareFunction)
}

// modified version of
//+ Carlos R. L. Rodrigues
//@ http://jsfromhell.com/array/search [rev. #2]
// o: array that will be looked up
// v: object that will be searched
// b: if true, the function will return the index where the value should be inserted to keep the array ordered, otherwise returns the index where the value was found or -1 if it wasn't found
function binarySearch(o, v, i, compareFunction){
    var h = o.length, l = -1, m
    while(h - l > 1)
        if(compareFunction(o[m = h + l >> 1], v) < 1) l = m
        else h = m
    return o[h] != v ? i ? h : -1 : h
}