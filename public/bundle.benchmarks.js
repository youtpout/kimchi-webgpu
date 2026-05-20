// ../o1js/node_modules/reflect-metadata/Reflect.js
var Reflect2;
(function(Reflect3) {
  (function(factory) {
    var root = typeof global === "object" ? global : typeof self === "object" ? self : typeof this === "object" ? this : Function("return this;")();
    var exporter = makeExporter(Reflect3);
    if (typeof root.Reflect === "undefined") {
      root.Reflect = Reflect3;
    } else {
      exporter = makeExporter(root.Reflect, exporter);
    }
    factory(exporter);
    function makeExporter(target, previous) {
      return function(key, value) {
        if (typeof target[key] !== "function") {
          Object.defineProperty(target, key, { configurable: true, writable: true, value });
        }
        if (previous)
          previous(key, value);
      };
    }
  })(function(exporter) {
    var hasOwn = Object.prototype.hasOwnProperty;
    var supportsSymbol = typeof Symbol === "function";
    var toPrimitiveSymbol = supportsSymbol && typeof Symbol.toPrimitive !== "undefined" ? Symbol.toPrimitive : "@@toPrimitive";
    var iteratorSymbol = supportsSymbol && typeof Symbol.iterator !== "undefined" ? Symbol.iterator : "@@iterator";
    var supportsCreate = typeof Object.create === "function";
    var supportsProto = { __proto__: [] } instanceof Array;
    var downLevel = !supportsCreate && !supportsProto;
    var HashMap = {
      // create an object in dictionary mode (a.k.a. "slow" mode in v8)
      create: supportsCreate ? function() {
        return MakeDictionary(/* @__PURE__ */ Object.create(null));
      } : supportsProto ? function() {
        return MakeDictionary({ __proto__: null });
      } : function() {
        return MakeDictionary({});
      },
      has: downLevel ? function(map, key) {
        return hasOwn.call(map, key);
      } : function(map, key) {
        return key in map;
      },
      get: downLevel ? function(map, key) {
        return hasOwn.call(map, key) ? map[key] : void 0;
      } : function(map, key) {
        return map[key];
      }
    };
    var functionPrototype = Object.getPrototypeOf(Function);
    var usePolyfill = typeof process === "object" && process["env"] && process["env"]["REFLECT_METADATA_USE_MAP_POLYFILL"] === "true";
    var _Map = !usePolyfill && typeof Map === "function" && typeof Map.prototype.entries === "function" ? Map : CreateMapPolyfill();
    var _Set = !usePolyfill && typeof Set === "function" && typeof Set.prototype.entries === "function" ? Set : CreateSetPolyfill();
    var _WeakMap = !usePolyfill && typeof WeakMap === "function" ? WeakMap : CreateWeakMapPolyfill();
    var Metadata = new _WeakMap();
    function decorate(decorators, target, propertyKey, attributes) {
      if (!IsUndefined(propertyKey)) {
        if (!IsArray(decorators))
          throw new TypeError();
        if (!IsObject(target))
          throw new TypeError();
        if (!IsObject(attributes) && !IsUndefined(attributes) && !IsNull(attributes))
          throw new TypeError();
        if (IsNull(attributes))
          attributes = void 0;
        propertyKey = ToPropertyKey(propertyKey);
        return DecorateProperty(decorators, target, propertyKey, attributes);
      } else {
        if (!IsArray(decorators))
          throw new TypeError();
        if (!IsConstructor(target))
          throw new TypeError();
        return DecorateConstructor(decorators, target);
      }
    }
    exporter("decorate", decorate);
    function metadata(metadataKey, metadataValue) {
      function decorator(target, propertyKey) {
        if (!IsObject(target))
          throw new TypeError();
        if (!IsUndefined(propertyKey) && !IsPropertyKey(propertyKey))
          throw new TypeError();
        OrdinaryDefineOwnMetadata(metadataKey, metadataValue, target, propertyKey);
      }
      return decorator;
    }
    exporter("metadata", metadata);
    function defineMetadata(metadataKey, metadataValue, target, propertyKey) {
      if (!IsObject(target))
        throw new TypeError();
      if (!IsUndefined(propertyKey))
        propertyKey = ToPropertyKey(propertyKey);
      return OrdinaryDefineOwnMetadata(metadataKey, metadataValue, target, propertyKey);
    }
    exporter("defineMetadata", defineMetadata);
    function hasMetadata(metadataKey, target, propertyKey) {
      if (!IsObject(target))
        throw new TypeError();
      if (!IsUndefined(propertyKey))
        propertyKey = ToPropertyKey(propertyKey);
      return OrdinaryHasMetadata(metadataKey, target, propertyKey);
    }
    exporter("hasMetadata", hasMetadata);
    function hasOwnMetadata(metadataKey, target, propertyKey) {
      if (!IsObject(target))
        throw new TypeError();
      if (!IsUndefined(propertyKey))
        propertyKey = ToPropertyKey(propertyKey);
      return OrdinaryHasOwnMetadata(metadataKey, target, propertyKey);
    }
    exporter("hasOwnMetadata", hasOwnMetadata);
    function getMetadata(metadataKey, target, propertyKey) {
      if (!IsObject(target))
        throw new TypeError();
      if (!IsUndefined(propertyKey))
        propertyKey = ToPropertyKey(propertyKey);
      return OrdinaryGetMetadata(metadataKey, target, propertyKey);
    }
    exporter("getMetadata", getMetadata);
    function getOwnMetadata(metadataKey, target, propertyKey) {
      if (!IsObject(target))
        throw new TypeError();
      if (!IsUndefined(propertyKey))
        propertyKey = ToPropertyKey(propertyKey);
      return OrdinaryGetOwnMetadata(metadataKey, target, propertyKey);
    }
    exporter("getOwnMetadata", getOwnMetadata);
    function getMetadataKeys(target, propertyKey) {
      if (!IsObject(target))
        throw new TypeError();
      if (!IsUndefined(propertyKey))
        propertyKey = ToPropertyKey(propertyKey);
      return OrdinaryMetadataKeys(target, propertyKey);
    }
    exporter("getMetadataKeys", getMetadataKeys);
    function getOwnMetadataKeys(target, propertyKey) {
      if (!IsObject(target))
        throw new TypeError();
      if (!IsUndefined(propertyKey))
        propertyKey = ToPropertyKey(propertyKey);
      return OrdinaryOwnMetadataKeys(target, propertyKey);
    }
    exporter("getOwnMetadataKeys", getOwnMetadataKeys);
    function deleteMetadata(metadataKey, target, propertyKey) {
      if (!IsObject(target))
        throw new TypeError();
      if (!IsUndefined(propertyKey))
        propertyKey = ToPropertyKey(propertyKey);
      var metadataMap = GetOrCreateMetadataMap(
        target,
        propertyKey,
        /*Create*/
        false
      );
      if (IsUndefined(metadataMap))
        return false;
      if (!metadataMap.delete(metadataKey))
        return false;
      if (metadataMap.size > 0)
        return true;
      var targetMetadata = Metadata.get(target);
      targetMetadata.delete(propertyKey);
      if (targetMetadata.size > 0)
        return true;
      Metadata.delete(target);
      return true;
    }
    exporter("deleteMetadata", deleteMetadata);
    function DecorateConstructor(decorators, target) {
      for (var i = decorators.length - 1; i >= 0; --i) {
        var decorator = decorators[i];
        var decorated = decorator(target);
        if (!IsUndefined(decorated) && !IsNull(decorated)) {
          if (!IsConstructor(decorated))
            throw new TypeError();
          target = decorated;
        }
      }
      return target;
    }
    function DecorateProperty(decorators, target, propertyKey, descriptor) {
      for (var i = decorators.length - 1; i >= 0; --i) {
        var decorator = decorators[i];
        var decorated = decorator(target, propertyKey, descriptor);
        if (!IsUndefined(decorated) && !IsNull(decorated)) {
          if (!IsObject(decorated))
            throw new TypeError();
          descriptor = decorated;
        }
      }
      return descriptor;
    }
    function GetOrCreateMetadataMap(O, P, Create) {
      var targetMetadata = Metadata.get(O);
      if (IsUndefined(targetMetadata)) {
        if (!Create)
          return void 0;
        targetMetadata = new _Map();
        Metadata.set(O, targetMetadata);
      }
      var metadataMap = targetMetadata.get(P);
      if (IsUndefined(metadataMap)) {
        if (!Create)
          return void 0;
        metadataMap = new _Map();
        targetMetadata.set(P, metadataMap);
      }
      return metadataMap;
    }
    function OrdinaryHasMetadata(MetadataKey, O, P) {
      var hasOwn2 = OrdinaryHasOwnMetadata(MetadataKey, O, P);
      if (hasOwn2)
        return true;
      var parent = OrdinaryGetPrototypeOf(O);
      if (!IsNull(parent))
        return OrdinaryHasMetadata(MetadataKey, parent, P);
      return false;
    }
    function OrdinaryHasOwnMetadata(MetadataKey, O, P) {
      var metadataMap = GetOrCreateMetadataMap(
        O,
        P,
        /*Create*/
        false
      );
      if (IsUndefined(metadataMap))
        return false;
      return ToBoolean(metadataMap.has(MetadataKey));
    }
    function OrdinaryGetMetadata(MetadataKey, O, P) {
      var hasOwn2 = OrdinaryHasOwnMetadata(MetadataKey, O, P);
      if (hasOwn2)
        return OrdinaryGetOwnMetadata(MetadataKey, O, P);
      var parent = OrdinaryGetPrototypeOf(O);
      if (!IsNull(parent))
        return OrdinaryGetMetadata(MetadataKey, parent, P);
      return void 0;
    }
    function OrdinaryGetOwnMetadata(MetadataKey, O, P) {
      var metadataMap = GetOrCreateMetadataMap(
        O,
        P,
        /*Create*/
        false
      );
      if (IsUndefined(metadataMap))
        return void 0;
      return metadataMap.get(MetadataKey);
    }
    function OrdinaryDefineOwnMetadata(MetadataKey, MetadataValue, O, P) {
      var metadataMap = GetOrCreateMetadataMap(
        O,
        P,
        /*Create*/
        true
      );
      metadataMap.set(MetadataKey, MetadataValue);
    }
    function OrdinaryMetadataKeys(O, P) {
      var ownKeys = OrdinaryOwnMetadataKeys(O, P);
      var parent = OrdinaryGetPrototypeOf(O);
      if (parent === null)
        return ownKeys;
      var parentKeys = OrdinaryMetadataKeys(parent, P);
      if (parentKeys.length <= 0)
        return ownKeys;
      if (ownKeys.length <= 0)
        return parentKeys;
      var set2 = new _Set();
      var keys = [];
      for (var _i = 0, ownKeys_1 = ownKeys; _i < ownKeys_1.length; _i++) {
        var key = ownKeys_1[_i];
        var hasKey = set2.has(key);
        if (!hasKey) {
          set2.add(key);
          keys.push(key);
        }
      }
      for (var _a = 0, parentKeys_1 = parentKeys; _a < parentKeys_1.length; _a++) {
        var key = parentKeys_1[_a];
        var hasKey = set2.has(key);
        if (!hasKey) {
          set2.add(key);
          keys.push(key);
        }
      }
      return keys;
    }
    function OrdinaryOwnMetadataKeys(O, P) {
      var keys = [];
      var metadataMap = GetOrCreateMetadataMap(
        O,
        P,
        /*Create*/
        false
      );
      if (IsUndefined(metadataMap))
        return keys;
      var keysObj = metadataMap.keys();
      var iterator = GetIterator(keysObj);
      var k = 0;
      while (true) {
        var next = IteratorStep(iterator);
        if (!next) {
          keys.length = k;
          return keys;
        }
        var nextValue = IteratorValue(next);
        try {
          keys[k] = nextValue;
        } catch (e) {
          try {
            IteratorClose(iterator);
          } finally {
            throw e;
          }
        }
        k++;
      }
    }
    function Type(x) {
      if (x === null)
        return 1;
      switch (typeof x) {
        case "undefined":
          return 0;
        case "boolean":
          return 2;
        case "string":
          return 3;
        case "symbol":
          return 4;
        case "number":
          return 5;
        case "object":
          return x === null ? 1 : 6;
        default:
          return 6;
      }
    }
    function IsUndefined(x) {
      return x === void 0;
    }
    function IsNull(x) {
      return x === null;
    }
    function IsSymbol(x) {
      return typeof x === "symbol";
    }
    function IsObject(x) {
      return typeof x === "object" ? x !== null : typeof x === "function";
    }
    function ToPrimitive(input, PreferredType) {
      switch (Type(input)) {
        case 0:
          return input;
        case 1:
          return input;
        case 2:
          return input;
        case 3:
          return input;
        case 4:
          return input;
        case 5:
          return input;
      }
      var hint = PreferredType === 3 ? "string" : PreferredType === 5 ? "number" : "default";
      var exoticToPrim = GetMethod(input, toPrimitiveSymbol);
      if (exoticToPrim !== void 0) {
        var result = exoticToPrim.call(input, hint);
        if (IsObject(result))
          throw new TypeError();
        return result;
      }
      return OrdinaryToPrimitive(input, hint === "default" ? "number" : hint);
    }
    function OrdinaryToPrimitive(O, hint) {
      if (hint === "string") {
        var toString_1 = O.toString;
        if (IsCallable(toString_1)) {
          var result = toString_1.call(O);
          if (!IsObject(result))
            return result;
        }
        var valueOf = O.valueOf;
        if (IsCallable(valueOf)) {
          var result = valueOf.call(O);
          if (!IsObject(result))
            return result;
        }
      } else {
        var valueOf = O.valueOf;
        if (IsCallable(valueOf)) {
          var result = valueOf.call(O);
          if (!IsObject(result))
            return result;
        }
        var toString_2 = O.toString;
        if (IsCallable(toString_2)) {
          var result = toString_2.call(O);
          if (!IsObject(result))
            return result;
        }
      }
      throw new TypeError();
    }
    function ToBoolean(argument) {
      return !!argument;
    }
    function ToString(argument) {
      return "" + argument;
    }
    function ToPropertyKey(argument) {
      var key = ToPrimitive(
        argument,
        3
        /* String */
      );
      if (IsSymbol(key))
        return key;
      return ToString(key);
    }
    function IsArray(argument) {
      return Array.isArray ? Array.isArray(argument) : argument instanceof Object ? argument instanceof Array : Object.prototype.toString.call(argument) === "[object Array]";
    }
    function IsCallable(argument) {
      return typeof argument === "function";
    }
    function IsConstructor(argument) {
      return typeof argument === "function";
    }
    function IsPropertyKey(argument) {
      switch (Type(argument)) {
        case 3:
          return true;
        case 4:
          return true;
        default:
          return false;
      }
    }
    function GetMethod(V, P) {
      var func = V[P];
      if (func === void 0 || func === null)
        return void 0;
      if (!IsCallable(func))
        throw new TypeError();
      return func;
    }
    function GetIterator(obj) {
      var method = GetMethod(obj, iteratorSymbol);
      if (!IsCallable(method))
        throw new TypeError();
      var iterator = method.call(obj);
      if (!IsObject(iterator))
        throw new TypeError();
      return iterator;
    }
    function IteratorValue(iterResult) {
      return iterResult.value;
    }
    function IteratorStep(iterator) {
      var result = iterator.next();
      return result.done ? false : result;
    }
    function IteratorClose(iterator) {
      var f = iterator["return"];
      if (f)
        f.call(iterator);
    }
    function OrdinaryGetPrototypeOf(O) {
      var proto = Object.getPrototypeOf(O);
      if (typeof O !== "function" || O === functionPrototype)
        return proto;
      if (proto !== functionPrototype)
        return proto;
      var prototype = O.prototype;
      var prototypeProto = prototype && Object.getPrototypeOf(prototype);
      if (prototypeProto == null || prototypeProto === Object.prototype)
        return proto;
      var constructor = prototypeProto.constructor;
      if (typeof constructor !== "function")
        return proto;
      if (constructor === O)
        return proto;
      return constructor;
    }
    function CreateMapPolyfill() {
      var cacheSentinel = {};
      var arraySentinel = [];
      var MapIterator = (
        /** @class */
        (function() {
          function MapIterator2(keys, values, selector) {
            this._index = 0;
            this._keys = keys;
            this._values = values;
            this._selector = selector;
          }
          MapIterator2.prototype["@@iterator"] = function() {
            return this;
          };
          MapIterator2.prototype[iteratorSymbol] = function() {
            return this;
          };
          MapIterator2.prototype.next = function() {
            var index = this._index;
            if (index >= 0 && index < this._keys.length) {
              var result = this._selector(this._keys[index], this._values[index]);
              if (index + 1 >= this._keys.length) {
                this._index = -1;
                this._keys = arraySentinel;
                this._values = arraySentinel;
              } else {
                this._index++;
              }
              return { value: result, done: false };
            }
            return { value: void 0, done: true };
          };
          MapIterator2.prototype.throw = function(error) {
            if (this._index >= 0) {
              this._index = -1;
              this._keys = arraySentinel;
              this._values = arraySentinel;
            }
            throw error;
          };
          MapIterator2.prototype.return = function(value) {
            if (this._index >= 0) {
              this._index = -1;
              this._keys = arraySentinel;
              this._values = arraySentinel;
            }
            return { value, done: true };
          };
          return MapIterator2;
        })()
      );
      return (
        /** @class */
        (function() {
          function Map2() {
            this._keys = [];
            this._values = [];
            this._cacheKey = cacheSentinel;
            this._cacheIndex = -2;
          }
          Object.defineProperty(Map2.prototype, "size", {
            get: function() {
              return this._keys.length;
            },
            enumerable: true,
            configurable: true
          });
          Map2.prototype.has = function(key) {
            return this._find(
              key,
              /*insert*/
              false
            ) >= 0;
          };
          Map2.prototype.get = function(key) {
            var index = this._find(
              key,
              /*insert*/
              false
            );
            return index >= 0 ? this._values[index] : void 0;
          };
          Map2.prototype.set = function(key, value) {
            var index = this._find(
              key,
              /*insert*/
              true
            );
            this._values[index] = value;
            return this;
          };
          Map2.prototype.delete = function(key) {
            var index = this._find(
              key,
              /*insert*/
              false
            );
            if (index >= 0) {
              var size = this._keys.length;
              for (var i = index + 1; i < size; i++) {
                this._keys[i - 1] = this._keys[i];
                this._values[i - 1] = this._values[i];
              }
              this._keys.length--;
              this._values.length--;
              if (key === this._cacheKey) {
                this._cacheKey = cacheSentinel;
                this._cacheIndex = -2;
              }
              return true;
            }
            return false;
          };
          Map2.prototype.clear = function() {
            this._keys.length = 0;
            this._values.length = 0;
            this._cacheKey = cacheSentinel;
            this._cacheIndex = -2;
          };
          Map2.prototype.keys = function() {
            return new MapIterator(this._keys, this._values, getKey);
          };
          Map2.prototype.values = function() {
            return new MapIterator(this._keys, this._values, getValue);
          };
          Map2.prototype.entries = function() {
            return new MapIterator(this._keys, this._values, getEntry);
          };
          Map2.prototype["@@iterator"] = function() {
            return this.entries();
          };
          Map2.prototype[iteratorSymbol] = function() {
            return this.entries();
          };
          Map2.prototype._find = function(key, insert) {
            if (this._cacheKey !== key) {
              this._cacheIndex = this._keys.indexOf(this._cacheKey = key);
            }
            if (this._cacheIndex < 0 && insert) {
              this._cacheIndex = this._keys.length;
              this._keys.push(key);
              this._values.push(void 0);
            }
            return this._cacheIndex;
          };
          return Map2;
        })()
      );
      function getKey(key, _) {
        return key;
      }
      function getValue(_, value) {
        return value;
      }
      function getEntry(key, value) {
        return [key, value];
      }
    }
    function CreateSetPolyfill() {
      return (
        /** @class */
        (function() {
          function Set2() {
            this._map = new _Map();
          }
          Object.defineProperty(Set2.prototype, "size", {
            get: function() {
              return this._map.size;
            },
            enumerable: true,
            configurable: true
          });
          Set2.prototype.has = function(value) {
            return this._map.has(value);
          };
          Set2.prototype.add = function(value) {
            return this._map.set(value, value), this;
          };
          Set2.prototype.delete = function(value) {
            return this._map.delete(value);
          };
          Set2.prototype.clear = function() {
            this._map.clear();
          };
          Set2.prototype.keys = function() {
            return this._map.keys();
          };
          Set2.prototype.values = function() {
            return this._map.values();
          };
          Set2.prototype.entries = function() {
            return this._map.entries();
          };
          Set2.prototype["@@iterator"] = function() {
            return this.keys();
          };
          Set2.prototype[iteratorSymbol] = function() {
            return this.keys();
          };
          return Set2;
        })()
      );
    }
    function CreateWeakMapPolyfill() {
      var UUID_SIZE = 16;
      var keys = HashMap.create();
      var rootKey = CreateUniqueKey();
      return (
        /** @class */
        (function() {
          function WeakMap2() {
            this._key = CreateUniqueKey();
          }
          WeakMap2.prototype.has = function(target) {
            var table = GetOrCreateWeakMapTable(
              target,
              /*create*/
              false
            );
            return table !== void 0 ? HashMap.has(table, this._key) : false;
          };
          WeakMap2.prototype.get = function(target) {
            var table = GetOrCreateWeakMapTable(
              target,
              /*create*/
              false
            );
            return table !== void 0 ? HashMap.get(table, this._key) : void 0;
          };
          WeakMap2.prototype.set = function(target, value) {
            var table = GetOrCreateWeakMapTable(
              target,
              /*create*/
              true
            );
            table[this._key] = value;
            return this;
          };
          WeakMap2.prototype.delete = function(target) {
            var table = GetOrCreateWeakMapTable(
              target,
              /*create*/
              false
            );
            return table !== void 0 ? delete table[this._key] : false;
          };
          WeakMap2.prototype.clear = function() {
            this._key = CreateUniqueKey();
          };
          return WeakMap2;
        })()
      );
      function CreateUniqueKey() {
        var key;
        do
          key = "@@WeakMap@@" + CreateUUID();
        while (HashMap.has(keys, key));
        keys[key] = true;
        return key;
      }
      function GetOrCreateWeakMapTable(target, create) {
        if (!hasOwn.call(target, rootKey)) {
          if (!create)
            return void 0;
          Object.defineProperty(target, rootKey, { value: HashMap.create() });
        }
        return target[rootKey];
      }
      function FillRandomBytes(buffer, size) {
        for (var i = 0; i < size; ++i)
          buffer[i] = Math.random() * 255 | 0;
        return buffer;
      }
      function GenRandomBytes(size) {
        if (typeof Uint8Array === "function") {
          if (typeof crypto !== "undefined")
            return crypto.getRandomValues(new Uint8Array(size));
          if (typeof msCrypto !== "undefined")
            return msCrypto.getRandomValues(new Uint8Array(size));
          return FillRandomBytes(new Uint8Array(size), size);
        }
        return FillRandomBytes(new Array(size), size);
      }
      function CreateUUID() {
        var data = GenRandomBytes(UUID_SIZE);
        data[6] = data[6] & 79 | 64;
        data[8] = data[8] & 191 | 128;
        var result = "";
        for (var offset = 0; offset < UUID_SIZE; ++offset) {
          var byte = data[offset];
          if (offset === 4 || offset === 6 || offset === 8)
            result += "-";
          if (byte < 16)
            result += "0";
          result += byte.toString(16).toLowerCase();
        }
        return result;
      }
    }
    function MakeDictionary(obj) {
      obj.__ = void 0;
      delete obj.__;
      return obj;
    }
  });
})(Reflect2 || (Reflect2 = {}));

// src/test-utils/browserTestRunner.ts
var currentSuite = {
  name: "root",
  tests: [],
  beforeAllFns: [],
  beforeEachFns: [],
  afterEachFns: [],
  afterAllFns: [],
  suites: []
};
var rootSuite = currentSuite;
var hasOnly = false;
function describe2(name, fn) {
  const parent = currentSuite;
  const suite = {
    name,
    tests: [],
    beforeAllFns: [],
    beforeEachFns: [],
    afterEachFns: [],
    afterAllFns: [],
    suites: []
  };
  parent.suites.push(suite);
  currentSuite = suite;
  fn();
  currentSuite = parent;
}
function addTest(name, fn, timeout = Infinity, mode = "normal") {
  if (mode === "only") hasOnly = true;
  currentSuite.tests.push({ name, fn, timeout, mode });
}
function it2(name, fn, timeout = Infinity) {
  addTest(name, fn, timeout, "normal");
}
var test = it2;
it2.skip = (name, _fn) => addTest(name, null, 0, "skip");
it2.only = (name, fn, timeout = Infinity) => addTest(name, fn, timeout, "only");
test.skip = it2.skip;
test.only = it2.only;
function beforeAll(fn) {
  currentSuite.beforeAllFns.push(fn);
}
function beforeEach(fn) {
  currentSuite.beforeEachFns.push(fn);
}
function afterEach(fn) {
  currentSuite.afterEachFns.push(fn);
}
function after(fn) {
  currentSuite.afterAllFns.push(fn);
}
function withTimeout(promise, ms, testName) {
  if (ms === Infinity) return promise;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Test timed out after ${ms} ms: ${testName}`)),
      ms
    );
    promise.then((v) => {
      clearTimeout(timer);
      resolve(v);
    }).catch((err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}
var originalConsole = console;
function createConsoleLine(type3, ...args) {
  const logEl = document.createElement("div");
  logEl.style.margin = "2px 0";
  logEl.style.fontFamily = "monospace";
  logEl.style.whiteSpace = "pre-wrap";
  switch (type3) {
    case "error":
      logEl.style.color = "#e57373";
      break;
    case "warn":
      logEl.style.color = "#f9a825";
      break;
    case "info":
      logEl.style.color = "#64b5f6";
      break;
    case "log":
      logEl.style.color = "#388e3c";
      break;
    default:
      logEl.style.color = "#757575";
  }
  logEl.textContent = `[${type3.toUpperCase()}] ${args.map(String).join(" ")}`;
  return logEl;
}
function captureTestConsole(currentTestConsoleEl) {
  const originalConsole2 = {
    ...console
  };
  let hasLogs = false;
  const createFn = (type3) => (...args) => {
    if (!hasLogs) {
      currentTestConsoleEl.style.padding = "20px 20px 20px 20px";
      currentTestConsoleEl.style.display = "inline-block";
      currentTestConsoleEl.style.minWidth = "0";
      hasLogs = true;
    }
    const line = createConsoleLine(type3, ...args);
    line.style.wordBreak = "break-word";
    currentTestConsoleEl.appendChild(line);
    originalConsole2[type3](...args);
  };
  console = {
    ...originalConsole2,
    log: createFn("log"),
    info: createFn("info"),
    warn: createFn("warn"),
    error: createFn("error")
  };
  return () => {
    console = originalConsole2;
  };
}
async function runSuite(suite, depth = 0, parentHooks, parentEl) {
  const indent = "  ".repeat(depth);
  const beforeEachChain = [
    ...parentHooks?.beforeEach ?? [],
    ...suite.beforeEachFns
  ];
  const afterEachChain = [
    ...suite.afterEachFns,
    ...parentHooks?.afterEach ?? []
  ];
  const suiteEl = document.createElement("section");
  suiteEl.style.marginLeft = parentEl ? "20px" : "0";
  suiteEl.style.padding = "8px 8px 8px 20px";
  suiteEl.style.borderLeft = parentEl ? "2px solid #ccc" : "none";
  const title = document.createElement("h3");
  title.textContent = suite.name;
  title.style.fontFamily = "monospace";
  title.style.color = "#333";
  title.style.marginTop = "0";
  suiteEl.appendChild(title);
  (parentEl ?? document.body).appendChild(suiteEl);
  const testsContainer = document.createElement("div");
  testsContainer.style.borderLeft = "2px solid #ccc";
  testsContainer.style.paddingLeft = "10px";
  testsContainer.style.marginLeft = "20px";
  suiteEl.appendChild(testsContainer);
  console.log(`${indent}${suite.name}`);
  for (const fn of suite.beforeAllFns) await fn();
  const runnableTests = hasOnly ? suite.tests.filter((t) => t.mode === "only") : suite.tests;
  for (const t of runnableTests) {
    const testEl = document.createElement("section");
    testEl.style.marginLeft = "16px";
    testEl.style.fontFamily = "monospace";
    testsContainer.appendChild(testEl);
    const titleEl = document.createElement("div");
    titleEl.style.fontWeight = "bold";
    titleEl.style.marginBottom = "6px";
    titleEl.textContent = `\u25B6 ${t.name}`;
    titleEl.style.color = "#666";
    testEl.appendChild(titleEl);
    const consoleEl = document.createElement("div");
    consoleEl.style.fontFamily = "monospace";
    consoleEl.style.marginLeft = "20px";
    consoleEl.style.backgroundColor = "#ccc";
    testEl.appendChild(consoleEl);
    const prefix = indent + "  ";
    if (t.mode === "skip" || t.fn === null) {
      console.log(`${prefix}\u23ED\uFE0F  ${t.name}`);
      testEl.textContent = `\u23ED\uFE0F  ${t.name} (skipped)`;
      testEl.style.color = "gray";
      continue;
    }
    const restoreConsole = captureTestConsole(consoleEl);
    const testStart = performance.now();
    try {
      for (const fn of beforeEachChain) await fn();
      await withTimeout(Promise.resolve(t.fn()), t.timeout, t.name);
      const testEnd = performance.now();
      const duration = (testEnd - testStart).toFixed(2);
      originalConsole.log(`${prefix}\u2705 ${t.name} (${duration} ms)`);
      const titleEl2 = document.createElement("div");
      titleEl2.textContent = `\u2705 Completed in (${duration} ms)`;
      titleEl2.style.margin = "5px 0 7px 20px";
      titleEl2.style.color = "#388e3c";
      testEl.appendChild(titleEl2);
    } catch (err) {
      const testEnd = performance.now();
      const duration = (testEnd - testStart).toFixed(2);
      originalConsole.error(
        `${prefix}\u274C ${t.name} (${duration} ms)`,
        err
      );
      const titleEl2 = document.createElement("div");
      titleEl2.textContent = `\u274C Failed in (${duration} ms): ${err}`;
      titleEl2.style.margin = "5px 0 7px 20px";
      titleEl2.style.color = "#e57373";
      testEl.appendChild(titleEl2);
    } finally {
      restoreConsole();
      for (const fn of afterEachChain) await fn();
    }
  }
  for (const child of suite.suites) {
    await runSuite(
      child,
      depth + 1,
      { beforeEach: beforeEachChain, afterEach: afterEachChain },
      suiteEl
    );
  }
  for (const fn of suite.afterAllFns) await fn();
}
async function runTests() {
  const container = document.createElement("div");
  container.id = "test-results";
  container.style.fontFamily = "sans-serif";
  container.style.fontSize = "14px";
  container.style.lineHeight = "1.4";
  container.style.margin = "20px";
  document.body.appendChild(container);
  const startTime = performance.now();
  await runSuite(rootSuite, 0, void 0, container);
  const endTime = performance.now();
  const totalDuration = (endTime - startTime).toFixed(2);
  console.log(`Total test run time: ${totalDuration} ms`);
  const timeEl = document.createElement("div");
  timeEl.style.marginTop = "20px";
  timeEl.style.fontWeight = "bold";
  timeEl.textContent = `Total test run time: ${totalDuration} ms`;
  container.appendChild(timeEl);
  globalThis.testsFinished = true;
}
globalThis.describe = describe2;
globalThis.it = it2;
globalThis.test = test;
globalThis.beforeAll = beforeAll;
globalThis.beforeEach = beforeEach;
globalThis.afterEach = afterEach;
globalThis.after = after;
globalThis.runTests = runTests;

// node_modules/chai/index.js
var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var utils_exports = {};
__export(utils_exports, {
  addChainableMethod: () => addChainableMethod,
  addLengthGuard: () => addLengthGuard,
  addMethod: () => addMethod,
  addProperty: () => addProperty,
  checkError: () => check_error_exports,
  compareByInspect: () => compareByInspect,
  eql: () => deep_eql_default,
  events: () => events,
  expectTypes: () => expectTypes,
  flag: () => flag,
  getActual: () => getActual,
  getMessage: () => getMessage2,
  getName: () => getName,
  getOperator: () => getOperator,
  getOwnEnumerableProperties: () => getOwnEnumerableProperties,
  getOwnEnumerablePropertySymbols: () => getOwnEnumerablePropertySymbols,
  getPathInfo: () => getPathInfo,
  hasProperty: () => hasProperty,
  inspect: () => inspect2,
  isNaN: () => isNaN2,
  isNumeric: () => isNumeric,
  isProxyEnabled: () => isProxyEnabled,
  isRegExp: () => isRegExp2,
  objDisplay: () => objDisplay,
  overwriteChainableMethod: () => overwriteChainableMethod,
  overwriteMethod: () => overwriteMethod,
  overwriteProperty: () => overwriteProperty,
  proxify: () => proxify,
  test: () => test2,
  transferFlags: () => transferFlags,
  type: () => type
});
var check_error_exports = {};
__export(check_error_exports, {
  compatibleConstructor: () => compatibleConstructor,
  compatibleInstance: () => compatibleInstance,
  compatibleMessage: () => compatibleMessage,
  getConstructorName: () => getConstructorName,
  getMessage: () => getMessage
});
function isErrorInstance(obj) {
  return obj instanceof Error || Object.prototype.toString.call(obj) === "[object Error]";
}
__name(isErrorInstance, "isErrorInstance");
function isRegExp(obj) {
  return Object.prototype.toString.call(obj) === "[object RegExp]";
}
__name(isRegExp, "isRegExp");
function compatibleInstance(thrown, errorLike) {
  return isErrorInstance(errorLike) && thrown === errorLike;
}
__name(compatibleInstance, "compatibleInstance");
function compatibleConstructor(thrown, errorLike) {
  if (isErrorInstance(errorLike)) {
    return thrown.constructor === errorLike.constructor || thrown instanceof errorLike.constructor;
  } else if ((typeof errorLike === "object" || typeof errorLike === "function") && errorLike.prototype) {
    return thrown.constructor === errorLike || thrown instanceof errorLike;
  }
  return false;
}
__name(compatibleConstructor, "compatibleConstructor");
function compatibleMessage(thrown, errMatcher) {
  const comparisonString = typeof thrown === "string" ? thrown : thrown.message;
  if (isRegExp(errMatcher)) {
    return errMatcher.test(comparisonString);
  } else if (typeof errMatcher === "string") {
    return comparisonString.indexOf(errMatcher) !== -1;
  }
  return false;
}
__name(compatibleMessage, "compatibleMessage");
function getConstructorName(errorLike) {
  let constructorName = errorLike;
  if (isErrorInstance(errorLike)) {
    constructorName = errorLike.constructor.name;
  } else if (typeof errorLike === "function") {
    constructorName = errorLike.name;
    if (constructorName === "") {
      const newConstructorName = new errorLike().name;
      constructorName = newConstructorName || constructorName;
    }
  }
  return constructorName;
}
__name(getConstructorName, "getConstructorName");
function getMessage(errorLike) {
  let msg = "";
  if (errorLike && errorLike.message) {
    msg = errorLike.message;
  } else if (typeof errorLike === "string") {
    msg = errorLike;
  }
  return msg;
}
__name(getMessage, "getMessage");
function flag(obj, key, value) {
  let flags = obj.__flags || (obj.__flags = /* @__PURE__ */ Object.create(null));
  if (arguments.length === 3) {
    flags[key] = value;
  } else {
    return flags[key];
  }
}
__name(flag, "flag");
function test2(obj, args) {
  let negate = flag(obj, "negate"), expr = args[0];
  return negate ? !expr : expr;
}
__name(test2, "test");
function type(obj) {
  if (typeof obj === "undefined") {
    return "undefined";
  }
  if (obj === null) {
    return "null";
  }
  const stringTag = obj[Symbol.toStringTag];
  if (typeof stringTag === "string") {
    return stringTag;
  }
  const type3 = Object.prototype.toString.call(obj).slice(8, -1);
  return type3;
}
__name(type, "type");
var canElideFrames = "captureStackTrace" in Error;
var AssertionError = class _AssertionError extends Error {
  static {
    __name(this, "AssertionError");
  }
  message;
  get name() {
    return "AssertionError";
  }
  get ok() {
    return false;
  }
  constructor(message = "Unspecified AssertionError", props, ssf) {
    super(message);
    this.message = message;
    if (canElideFrames) {
      Error.captureStackTrace(this, ssf || _AssertionError);
    }
    for (const key in props) {
      if (!(key in this)) {
        this[key] = props[key];
      }
    }
  }
  toJSON(stack) {
    return {
      ...this,
      name: this.name,
      message: this.message,
      ok: false,
      stack: stack !== false ? this.stack : void 0
    };
  }
};
function expectTypes(obj, types) {
  let flagMsg = flag(obj, "message");
  let ssfi = flag(obj, "ssfi");
  flagMsg = flagMsg ? flagMsg + ": " : "";
  obj = flag(obj, "object");
  types = types.map(function(t) {
    return t.toLowerCase();
  });
  types.sort();
  let str = types.map(function(t, index) {
    let art = ~["a", "e", "i", "o", "u"].indexOf(t.charAt(0)) ? "an" : "a";
    let or = types.length > 1 && index === types.length - 1 ? "or " : "";
    return or + art + " " + t;
  }).join(", ");
  let objType = type(obj).toLowerCase();
  if (!types.some(function(expected) {
    return objType === expected;
  })) {
    throw new AssertionError(
      flagMsg + "object tested must be " + str + ", but " + objType + " given",
      void 0,
      ssfi
    );
  }
}
__name(expectTypes, "expectTypes");
function getActual(obj, args) {
  return args.length > 4 ? args[4] : obj._obj;
}
__name(getActual, "getActual");
var ansiColors = {
  bold: ["1", "22"],
  dim: ["2", "22"],
  italic: ["3", "23"],
  underline: ["4", "24"],
  // 5 & 6 are blinking
  inverse: ["7", "27"],
  hidden: ["8", "28"],
  strike: ["9", "29"],
  // 10-20 are fonts
  // 21-29 are resets for 1-9
  black: ["30", "39"],
  red: ["31", "39"],
  green: ["32", "39"],
  yellow: ["33", "39"],
  blue: ["34", "39"],
  magenta: ["35", "39"],
  cyan: ["36", "39"],
  white: ["37", "39"],
  brightblack: ["30;1", "39"],
  brightred: ["31;1", "39"],
  brightgreen: ["32;1", "39"],
  brightyellow: ["33;1", "39"],
  brightblue: ["34;1", "39"],
  brightmagenta: ["35;1", "39"],
  brightcyan: ["36;1", "39"],
  brightwhite: ["37;1", "39"],
  grey: ["90", "39"]
};
var styles = {
  special: "cyan",
  number: "yellow",
  bigint: "yellow",
  boolean: "yellow",
  undefined: "grey",
  null: "bold",
  string: "green",
  symbol: "green",
  date: "magenta",
  regexp: "red"
};
var truncator = "\u2026";
function colorise(value, styleType) {
  const color = ansiColors[styles[styleType]] || ansiColors[styleType] || "";
  if (!color) {
    return String(value);
  }
  return `\x1B[${color[0]}m${String(value)}\x1B[${color[1]}m`;
}
__name(colorise, "colorise");
function normaliseOptions({
  showHidden = false,
  depth = 2,
  colors = false,
  customInspect = true,
  showProxy = false,
  maxArrayLength = Infinity,
  breakLength = Infinity,
  seen = [],
  // eslint-disable-next-line no-shadow
  truncate: truncate2 = Infinity,
  stylize = String
} = {}, inspect3) {
  const options = {
    showHidden: Boolean(showHidden),
    depth: Number(depth),
    colors: Boolean(colors),
    customInspect: Boolean(customInspect),
    showProxy: Boolean(showProxy),
    maxArrayLength: Number(maxArrayLength),
    breakLength: Number(breakLength),
    truncate: Number(truncate2),
    seen,
    inspect: inspect3,
    stylize
  };
  if (options.colors) {
    options.stylize = colorise;
  }
  return options;
}
__name(normaliseOptions, "normaliseOptions");
function isHighSurrogate(char) {
  return char >= "\uD800" && char <= "\uDBFF";
}
__name(isHighSurrogate, "isHighSurrogate");
function truncate(string, length, tail = truncator) {
  string = String(string);
  const tailLength = tail.length;
  const stringLength = string.length;
  if (tailLength > length && stringLength > tailLength) {
    return tail;
  }
  if (stringLength > length && stringLength > tailLength) {
    let end = length - tailLength;
    if (end > 0 && isHighSurrogate(string[end - 1])) {
      end = end - 1;
    }
    return `${string.slice(0, end)}${tail}`;
  }
  return string;
}
__name(truncate, "truncate");
function inspectList(list, options, inspectItem, separator = ", ") {
  inspectItem = inspectItem || options.inspect;
  const size = list.length;
  if (size === 0)
    return "";
  const originalLength = options.truncate;
  let output = "";
  let peek = "";
  let truncated = "";
  for (let i = 0; i < size; i += 1) {
    const last = i + 1 === list.length;
    const secondToLast = i + 2 === list.length;
    truncated = `${truncator}(${list.length - i})`;
    const value = list[i];
    options.truncate = originalLength - output.length - (last ? 0 : separator.length);
    const string = peek || inspectItem(value, options) + (last ? "" : separator);
    const nextLength = output.length + string.length;
    const truncatedLength = nextLength + truncated.length;
    if (last && nextLength > originalLength && output.length + truncated.length <= originalLength) {
      break;
    }
    if (!last && !secondToLast && truncatedLength > originalLength) {
      break;
    }
    peek = last ? "" : inspectItem(list[i + 1], options) + (secondToLast ? "" : separator);
    if (!last && secondToLast && truncatedLength > originalLength && nextLength + peek.length > originalLength) {
      break;
    }
    output += string;
    if (!last && !secondToLast && nextLength + peek.length >= originalLength) {
      truncated = `${truncator}(${list.length - i - 1})`;
      break;
    }
    truncated = "";
  }
  return `${output}${truncated}`;
}
__name(inspectList, "inspectList");
function quoteComplexKey(key) {
  if (key.match(/^[a-zA-Z_][a-zA-Z_0-9]*$/)) {
    return key;
  }
  return JSON.stringify(key).replace(/'/g, "\\'").replace(/\\"/g, '"').replace(/(^"|"$)/g, "'");
}
__name(quoteComplexKey, "quoteComplexKey");
function inspectProperty([key, value], options) {
  options.truncate -= 2;
  if (typeof key === "string") {
    key = quoteComplexKey(key);
  } else if (typeof key !== "number") {
    key = `[${options.inspect(key, options)}]`;
  }
  options.truncate -= key.length;
  value = options.inspect(value, options);
  return `${key}: ${value}`;
}
__name(inspectProperty, "inspectProperty");
function inspectArray(array, options) {
  const nonIndexProperties = Object.keys(array).slice(array.length);
  if (!array.length && !nonIndexProperties.length)
    return "[]";
  options.truncate -= 4;
  const listContents = inspectList(array, options);
  options.truncate -= listContents.length;
  let propertyContents = "";
  if (nonIndexProperties.length) {
    propertyContents = inspectList(nonIndexProperties.map((key) => [key, array[key]]), options, inspectProperty);
  }
  return `[ ${listContents}${propertyContents ? `, ${propertyContents}` : ""} ]`;
}
__name(inspectArray, "inspectArray");
var getArrayName = /* @__PURE__ */ __name((array) => {
  if (typeof Buffer === "function" && array instanceof Buffer) {
    return "Buffer";
  }
  if (array[Symbol.toStringTag]) {
    return array[Symbol.toStringTag];
  }
  return array.constructor.name;
}, "getArrayName");
function inspectTypedArray(array, options) {
  const name = getArrayName(array);
  options.truncate -= name.length + 4;
  const nonIndexProperties = Object.keys(array).slice(array.length);
  if (!array.length && !nonIndexProperties.length)
    return `${name}[]`;
  let output = "";
  for (let i = 0; i < array.length; i++) {
    const string = `${options.stylize(truncate(array[i], options.truncate), "number")}${i === array.length - 1 ? "" : ", "}`;
    options.truncate -= string.length;
    if (array[i] !== array.length && options.truncate <= 3) {
      output += `${truncator}(${array.length - array[i] + 1})`;
      break;
    }
    output += string;
  }
  let propertyContents = "";
  if (nonIndexProperties.length) {
    propertyContents = inspectList(nonIndexProperties.map((key) => [key, array[key]]), options, inspectProperty);
  }
  return `${name}[ ${output}${propertyContents ? `, ${propertyContents}` : ""} ]`;
}
__name(inspectTypedArray, "inspectTypedArray");
function inspectDate(dateObject, options) {
  const stringRepresentation = dateObject.toJSON();
  if (stringRepresentation === null) {
    return "Invalid Date";
  }
  const split = stringRepresentation.split("T");
  const date = split[0];
  return options.stylize(`${date}T${truncate(split[1], options.truncate - date.length - 1)}`, "date");
}
__name(inspectDate, "inspectDate");
function inspectFunction(func, options) {
  const functionType = func[Symbol.toStringTag] || "Function";
  const name = func.name;
  if (!name) {
    return options.stylize(`[${functionType}]`, "special");
  }
  return options.stylize(`[${functionType} ${truncate(name, options.truncate - 11)}]`, "special");
}
__name(inspectFunction, "inspectFunction");
function inspectMapEntry([key, value], options) {
  options.truncate -= 4;
  key = options.inspect(key, options);
  options.truncate -= key.length;
  value = options.inspect(value, options);
  return `${key} => ${value}`;
}
__name(inspectMapEntry, "inspectMapEntry");
function mapToEntries(map) {
  const entries = [];
  map.forEach((value, key) => {
    entries.push([key, value]);
  });
  return entries;
}
__name(mapToEntries, "mapToEntries");
function inspectMap(map, options) {
  if (map.size === 0)
    return "Map{}";
  options.truncate -= 7;
  return `Map{ ${inspectList(mapToEntries(map), options, inspectMapEntry)} }`;
}
__name(inspectMap, "inspectMap");
var isNaN = Number.isNaN || ((i) => i !== i);
function inspectNumber(number, options) {
  if (isNaN(number)) {
    return options.stylize("NaN", "number");
  }
  if (number === Infinity) {
    return options.stylize("Infinity", "number");
  }
  if (number === -Infinity) {
    return options.stylize("-Infinity", "number");
  }
  if (number === 0) {
    return options.stylize(1 / number === Infinity ? "+0" : "-0", "number");
  }
  return options.stylize(truncate(String(number), options.truncate), "number");
}
__name(inspectNumber, "inspectNumber");
function inspectBigInt(number, options) {
  let nums = truncate(number.toString(), options.truncate - 1);
  if (nums !== truncator)
    nums += "n";
  return options.stylize(nums, "bigint");
}
__name(inspectBigInt, "inspectBigInt");
function inspectRegExp(value, options) {
  const flags = value.toString().split("/")[2];
  const sourceLength = options.truncate - (2 + flags.length);
  const source = value.source;
  return options.stylize(`/${truncate(source, sourceLength)}/${flags}`, "regexp");
}
__name(inspectRegExp, "inspectRegExp");
function arrayFromSet(set2) {
  const values = [];
  set2.forEach((value) => {
    values.push(value);
  });
  return values;
}
__name(arrayFromSet, "arrayFromSet");
function inspectSet(set2, options) {
  if (set2.size === 0)
    return "Set{}";
  options.truncate -= 7;
  return `Set{ ${inspectList(arrayFromSet(set2), options)} }`;
}
__name(inspectSet, "inspectSet");
var stringEscapeChars = new RegExp("['\\u0000-\\u001f\\u007f-\\u009f\\u00ad\\u0600-\\u0604\\u070f\\u17b4\\u17b5\\u200c-\\u200f\\u2028-\\u202f\\u2060-\\u206f\\ufeff\\ufff0-\\uffff]", "g");
var escapeCharacters = {
  "\b": "\\b",
  "	": "\\t",
  "\n": "\\n",
  "\f": "\\f",
  "\r": "\\r",
  "'": "\\'",
  "\\": "\\\\"
};
var hex = 16;
var unicodeLength = 4;
function escape(char) {
  return escapeCharacters[char] || `\\u${`0000${char.charCodeAt(0).toString(hex)}`.slice(-unicodeLength)}`;
}
__name(escape, "escape");
function inspectString(string, options) {
  if (stringEscapeChars.test(string)) {
    string = string.replace(stringEscapeChars, escape);
  }
  return options.stylize(`'${truncate(string, options.truncate - 2)}'`, "string");
}
__name(inspectString, "inspectString");
function inspectSymbol(value) {
  if ("description" in Symbol.prototype) {
    return value.description ? `Symbol(${value.description})` : "Symbol()";
  }
  return value.toString();
}
__name(inspectSymbol, "inspectSymbol");
var getPromiseValue = /* @__PURE__ */ __name(() => "Promise{\u2026}", "getPromiseValue");
var promise_default = getPromiseValue;
function inspectObject(object, options) {
  const properties = Object.getOwnPropertyNames(object);
  const symbols = Object.getOwnPropertySymbols ? Object.getOwnPropertySymbols(object) : [];
  if (properties.length === 0 && symbols.length === 0) {
    return "{}";
  }
  options.truncate -= 4;
  options.seen = options.seen || [];
  if (options.seen.includes(object)) {
    return "[Circular]";
  }
  options.seen.push(object);
  const propertyContents = inspectList(properties.map((key) => [key, object[key]]), options, inspectProperty);
  const symbolContents = inspectList(symbols.map((key) => [key, object[key]]), options, inspectProperty);
  options.seen.pop();
  let sep = "";
  if (propertyContents && symbolContents) {
    sep = ", ";
  }
  return `{ ${propertyContents}${sep}${symbolContents} }`;
}
__name(inspectObject, "inspectObject");
var toStringTag = typeof Symbol !== "undefined" && Symbol.toStringTag ? Symbol.toStringTag : false;
function inspectClass(value, options) {
  let name = "";
  if (toStringTag && toStringTag in value) {
    name = value[toStringTag];
  }
  name = name || value.constructor.name;
  if (!name || name === "_class") {
    name = "<Anonymous Class>";
  }
  options.truncate -= name.length;
  return `${name}${inspectObject(value, options)}`;
}
__name(inspectClass, "inspectClass");
function inspectArguments(args, options) {
  if (args.length === 0)
    return "Arguments[]";
  options.truncate -= 13;
  return `Arguments[ ${inspectList(args, options)} ]`;
}
__name(inspectArguments, "inspectArguments");
var errorKeys = [
  "stack",
  "line",
  "column",
  "name",
  "message",
  "fileName",
  "lineNumber",
  "columnNumber",
  "number",
  "description",
  "cause"
];
function inspectObject2(error, options) {
  const properties = Object.getOwnPropertyNames(error).filter((key) => errorKeys.indexOf(key) === -1);
  const name = error.name;
  options.truncate -= name.length;
  let message = "";
  if (typeof error.message === "string") {
    message = truncate(error.message, options.truncate);
  } else {
    properties.unshift("message");
  }
  message = message ? `: ${message}` : "";
  options.truncate -= message.length + 5;
  options.seen = options.seen || [];
  if (options.seen.includes(error)) {
    return "[Circular]";
  }
  options.seen.push(error);
  const propertyContents = inspectList(properties.map((key) => [key, error[key]]), options, inspectProperty);
  return `${name}${message}${propertyContents ? ` { ${propertyContents} }` : ""}`;
}
__name(inspectObject2, "inspectObject");
function inspectAttribute([key, value], options) {
  options.truncate -= 3;
  if (!value) {
    return `${options.stylize(String(key), "yellow")}`;
  }
  return `${options.stylize(String(key), "yellow")}=${options.stylize(`"${value}"`, "string")}`;
}
__name(inspectAttribute, "inspectAttribute");
function inspectNodeCollection(collection, options) {
  return inspectList(collection, options, inspectNode, "\n");
}
__name(inspectNodeCollection, "inspectNodeCollection");
function inspectNode(node, options) {
  switch (node.nodeType) {
    case 1:
      return inspectHTML(node, options);
    case 3:
      return options.inspect(node.data, options);
    default:
      return options.inspect(node, options);
  }
}
__name(inspectNode, "inspectNode");
function inspectHTML(element, options) {
  const properties = element.getAttributeNames();
  const name = element.tagName.toLowerCase();
  const head = options.stylize(`<${name}`, "special");
  const headClose = options.stylize(`>`, "special");
  const tail = options.stylize(`</${name}>`, "special");
  options.truncate -= name.length * 2 + 5;
  let propertyContents = "";
  if (properties.length > 0) {
    propertyContents += " ";
    propertyContents += inspectList(properties.map((key) => [key, element.getAttribute(key)]), options, inspectAttribute, " ");
  }
  options.truncate -= propertyContents.length;
  const truncate2 = options.truncate;
  let children = inspectNodeCollection(element.children, options);
  if (children && children.length > truncate2) {
    children = `${truncator}(${element.children.length})`;
  }
  return `${head}${propertyContents}${headClose}${children}${tail}`;
}
__name(inspectHTML, "inspectHTML");
var symbolsSupported = typeof Symbol === "function" && typeof Symbol.for === "function";
var chaiInspect = symbolsSupported ? Symbol.for("chai/inspect") : "@@chai/inspect";
var nodeInspect = Symbol.for("nodejs.util.inspect.custom");
var constructorMap = /* @__PURE__ */ new WeakMap();
var stringTagMap = {};
var baseTypesMap = {
  undefined: /* @__PURE__ */ __name((value, options) => options.stylize("undefined", "undefined"), "undefined"),
  null: /* @__PURE__ */ __name((value, options) => options.stylize("null", "null"), "null"),
  boolean: /* @__PURE__ */ __name((value, options) => options.stylize(String(value), "boolean"), "boolean"),
  Boolean: /* @__PURE__ */ __name((value, options) => options.stylize(String(value), "boolean"), "Boolean"),
  number: inspectNumber,
  Number: inspectNumber,
  bigint: inspectBigInt,
  BigInt: inspectBigInt,
  string: inspectString,
  String: inspectString,
  function: inspectFunction,
  Function: inspectFunction,
  symbol: inspectSymbol,
  // A Symbol polyfill will return `Symbol` not `symbol` from typedetect
  Symbol: inspectSymbol,
  Array: inspectArray,
  Date: inspectDate,
  Map: inspectMap,
  Set: inspectSet,
  RegExp: inspectRegExp,
  Promise: promise_default,
  // WeakSet, WeakMap are totally opaque to us
  WeakSet: /* @__PURE__ */ __name((value, options) => options.stylize("WeakSet{\u2026}", "special"), "WeakSet"),
  WeakMap: /* @__PURE__ */ __name((value, options) => options.stylize("WeakMap{\u2026}", "special"), "WeakMap"),
  Arguments: inspectArguments,
  Int8Array: inspectTypedArray,
  Uint8Array: inspectTypedArray,
  Uint8ClampedArray: inspectTypedArray,
  Int16Array: inspectTypedArray,
  Uint16Array: inspectTypedArray,
  Int32Array: inspectTypedArray,
  Uint32Array: inspectTypedArray,
  Float32Array: inspectTypedArray,
  Float64Array: inspectTypedArray,
  Generator: /* @__PURE__ */ __name(() => "", "Generator"),
  DataView: /* @__PURE__ */ __name(() => "", "DataView"),
  ArrayBuffer: /* @__PURE__ */ __name(() => "", "ArrayBuffer"),
  Error: inspectObject2,
  HTMLCollection: inspectNodeCollection,
  NodeList: inspectNodeCollection
};
var inspectCustom = /* @__PURE__ */ __name((value, options, type3, inspectFn) => {
  if (chaiInspect in value && typeof value[chaiInspect] === "function") {
    return value[chaiInspect](options);
  }
  if (nodeInspect in value && typeof value[nodeInspect] === "function") {
    return value[nodeInspect](options.depth, options, inspectFn);
  }
  if ("inspect" in value && typeof value.inspect === "function") {
    return value.inspect(options.depth, options);
  }
  if ("constructor" in value && constructorMap.has(value.constructor)) {
    return constructorMap.get(value.constructor)(value, options);
  }
  if (stringTagMap[type3]) {
    return stringTagMap[type3](value, options);
  }
  return "";
}, "inspectCustom");
var toString = Object.prototype.toString;
function inspect(value, opts = {}) {
  const options = normaliseOptions(opts, inspect);
  const { customInspect } = options;
  let type3 = value === null ? "null" : typeof value;
  if (type3 === "object") {
    type3 = toString.call(value).slice(8, -1);
  }
  if (type3 in baseTypesMap) {
    return baseTypesMap[type3](value, options);
  }
  if (customInspect && value) {
    const output = inspectCustom(value, options, type3, inspect);
    if (output) {
      if (typeof output === "string")
        return output;
      return inspect(output, options);
    }
  }
  const proto = value ? Object.getPrototypeOf(value) : false;
  if (proto === Object.prototype || proto === null) {
    return inspectObject(value, options);
  }
  if (value && typeof HTMLElement === "function" && value instanceof HTMLElement) {
    return inspectHTML(value, options);
  }
  if ("constructor" in value) {
    if (value.constructor !== Object) {
      return inspectClass(value, options);
    }
    return inspectObject(value, options);
  }
  if (value === Object(value)) {
    return inspectObject(value, options);
  }
  return options.stylize(String(value), type3);
}
__name(inspect, "inspect");
var config = {
  /**
   * ### config.includeStack
   *
   * User configurable property, influences whether stack trace
   * is included in Assertion error message. Default of false
   * suppresses stack trace in the error message.
   *
   *     chai.config.includeStack = true;  // enable stack on error
   *
   * @param {boolean}
   * @public
   */
  includeStack: false,
  /**
   * ### config.showDiff
   *
   * User configurable property, influences whether or not
   * the `showDiff` flag should be included in the thrown
   * AssertionErrors. `false` will always be `false`; `true`
   * will be true when the assertion has requested a diff
   * be shown.
   *
   * @param {boolean}
   * @public
   */
  showDiff: true,
  /**
   * ### config.truncateThreshold
   *
   * User configurable property, sets length threshold for actual and
   * expected values in assertion errors. If this threshold is exceeded, for
   * example for large data structures, the value is replaced with something
   * like `[ Array(3) ]` or `{ Object (prop1, prop2) }`.
   *
   * Set it to zero if you want to disable truncating altogether.
   *
   * This is especially userful when doing assertions on arrays: having this
   * set to a reasonable large value makes the failure messages readily
   * inspectable.
   *
   *     chai.config.truncateThreshold = 0;  // disable truncating
   *
   * @param {number}
   * @public
   */
  truncateThreshold: 40,
  /**
   * ### config.useProxy
   *
   * User configurable property, defines if chai will use a Proxy to throw
   * an error when a non-existent property is read, which protects users
   * from typos when using property-based assertions.
   *
   * Set it to false if you want to disable this feature.
   *
   *     chai.config.useProxy = false;  // disable use of Proxy
   *
   * This feature is automatically disabled regardless of this config value
   * in environments that don't support proxies.
   *
   * @param {boolean}
   * @public
   */
  useProxy: true,
  /**
   * ### config.proxyExcludedKeys
   *
   * User configurable property, defines which properties should be ignored
   * instead of throwing an error if they do not exist on the assertion.
   * This is only applied if the environment Chai is running in supports proxies and
   * if the `useProxy` configuration setting is enabled.
   * By default, `then` and `inspect` will not throw an error if they do not exist on the
   * assertion object because the `.inspect` property is read by `util.inspect` (for example, when
   * using `console.log` on the assertion object) and `.then` is necessary for promise type-checking.
   *
   *     // By default these keys will not throw an error if they do not exist on the assertion object
   *     chai.config.proxyExcludedKeys = ['then', 'inspect'];
   *
   * @param {Array}
   * @public
   */
  proxyExcludedKeys: ["then", "catch", "inspect", "toJSON"],
  /**
   * ### config.deepEqual
   *
   * User configurable property, defines which a custom function to use for deepEqual
   * comparisons.
   * By default, the function used is the one from the `deep-eql` package without custom comparator.
   *
   *     // use a custom comparator
   *     chai.config.deepEqual = (expected, actual) => {
   *         return chai.util.eql(expected, actual, {
   *             comparator: (expected, actual) => {
   *                 // for non number comparison, use the default behavior
   *                 if(typeof expected !== 'number') return null;
   *                 // allow a difference of 10 between compared numbers
   *                 return typeof actual === 'number' && Math.abs(actual - expected) < 10
   *             }
   *         })
   *     };
   *
   * @param {Function}
   * @public
   */
  deepEqual: null
};
function inspect2(obj, showHidden, depth, colors) {
  let options = {
    colors,
    depth: typeof depth === "undefined" ? 2 : depth,
    showHidden,
    truncate: config.truncateThreshold ? config.truncateThreshold : Infinity
  };
  return inspect(obj, options);
}
__name(inspect2, "inspect");
function objDisplay(obj) {
  let str = inspect2(obj), type3 = Object.prototype.toString.call(obj);
  if (config.truncateThreshold && str.length >= config.truncateThreshold) {
    if (type3 === "[object Function]") {
      return !obj.name || obj.name === "" ? "[Function]" : "[Function: " + obj.name + "]";
    } else if (type3 === "[object Array]") {
      return "[ Array(" + obj.length + ") ]";
    } else if (type3 === "[object Object]") {
      let keys = Object.keys(obj), kstr = keys.length > 2 ? keys.splice(0, 2).join(", ") + ", ..." : keys.join(", ");
      return "{ Object (" + kstr + ") }";
    } else {
      return str;
    }
  } else {
    return str;
  }
}
__name(objDisplay, "objDisplay");
function getMessage2(obj, args) {
  let negate = flag(obj, "negate");
  let val = flag(obj, "object");
  let expected = args[3];
  let actual = getActual(obj, args);
  let msg = negate ? args[2] : args[1];
  let flagMsg = flag(obj, "message");
  if (typeof msg === "function") msg = msg();
  msg = msg || "";
  msg = msg.replace(/#\{this\}/g, function() {
    return objDisplay(val);
  }).replace(/#\{act\}/g, function() {
    return objDisplay(actual);
  }).replace(/#\{exp\}/g, function() {
    return objDisplay(expected);
  });
  return flagMsg ? flagMsg + ": " + msg : msg;
}
__name(getMessage2, "getMessage");
function transferFlags(assertion, object, includeAll) {
  let flags = assertion.__flags || (assertion.__flags = /* @__PURE__ */ Object.create(null));
  if (!object.__flags) {
    object.__flags = /* @__PURE__ */ Object.create(null);
  }
  includeAll = arguments.length === 3 ? includeAll : true;
  for (let flag3 in flags) {
    if (includeAll || flag3 !== "object" && flag3 !== "ssfi" && flag3 !== "lockSsfi" && flag3 != "message") {
      object.__flags[flag3] = flags[flag3];
    }
  }
}
__name(transferFlags, "transferFlags");
function type2(obj) {
  if (typeof obj === "undefined") {
    return "undefined";
  }
  if (obj === null) {
    return "null";
  }
  const stringTag = obj[Symbol.toStringTag];
  if (typeof stringTag === "string") {
    return stringTag;
  }
  const sliceStart = 8;
  const sliceEnd = -1;
  return Object.prototype.toString.call(obj).slice(sliceStart, sliceEnd);
}
__name(type2, "type");
function FakeMap() {
  this._key = "chai/deep-eql__" + Math.random() + Date.now();
}
__name(FakeMap, "FakeMap");
FakeMap.prototype = {
  get: /* @__PURE__ */ __name(function get(key) {
    return key[this._key];
  }, "get"),
  set: /* @__PURE__ */ __name(function set(key, value) {
    if (Object.isExtensible(key)) {
      Object.defineProperty(key, this._key, {
        value,
        configurable: true
      });
    }
  }, "set")
};
var MemoizeMap = typeof WeakMap === "function" ? WeakMap : FakeMap;
function memoizeCompare(leftHandOperand, rightHandOperand, memoizeMap) {
  if (!memoizeMap || isPrimitive(leftHandOperand) || isPrimitive(rightHandOperand)) {
    return null;
  }
  var leftHandMap = memoizeMap.get(leftHandOperand);
  if (leftHandMap) {
    var result = leftHandMap.get(rightHandOperand);
    if (typeof result === "boolean") {
      return result;
    }
  }
  return null;
}
__name(memoizeCompare, "memoizeCompare");
function memoizeSet(leftHandOperand, rightHandOperand, memoizeMap, result) {
  if (!memoizeMap || isPrimitive(leftHandOperand) || isPrimitive(rightHandOperand)) {
    return;
  }
  var leftHandMap = memoizeMap.get(leftHandOperand);
  if (leftHandMap) {
    leftHandMap.set(rightHandOperand, result);
  } else {
    leftHandMap = new MemoizeMap();
    leftHandMap.set(rightHandOperand, result);
    memoizeMap.set(leftHandOperand, leftHandMap);
  }
}
__name(memoizeSet, "memoizeSet");
var deep_eql_default = deepEqual;
function deepEqual(leftHandOperand, rightHandOperand, options) {
  if (options && options.comparator) {
    return extensiveDeepEqual(leftHandOperand, rightHandOperand, options);
  }
  var simpleResult = simpleEqual(leftHandOperand, rightHandOperand);
  if (simpleResult !== null) {
    return simpleResult;
  }
  return extensiveDeepEqual(leftHandOperand, rightHandOperand, options);
}
__name(deepEqual, "deepEqual");
function simpleEqual(leftHandOperand, rightHandOperand) {
  if (leftHandOperand === rightHandOperand) {
    return leftHandOperand !== 0 || 1 / leftHandOperand === 1 / rightHandOperand;
  }
  if (leftHandOperand !== leftHandOperand && // eslint-disable-line no-self-compare
  rightHandOperand !== rightHandOperand) {
    return true;
  }
  if (isPrimitive(leftHandOperand) || isPrimitive(rightHandOperand)) {
    return false;
  }
  return null;
}
__name(simpleEqual, "simpleEqual");
function extensiveDeepEqual(leftHandOperand, rightHandOperand, options) {
  options = options || {};
  options.memoize = options.memoize === false ? false : options.memoize || new MemoizeMap();
  var comparator = options && options.comparator;
  var memoizeResultLeft = memoizeCompare(leftHandOperand, rightHandOperand, options.memoize);
  if (memoizeResultLeft !== null) {
    return memoizeResultLeft;
  }
  var memoizeResultRight = memoizeCompare(rightHandOperand, leftHandOperand, options.memoize);
  if (memoizeResultRight !== null) {
    return memoizeResultRight;
  }
  if (comparator) {
    var comparatorResult = comparator(leftHandOperand, rightHandOperand);
    if (comparatorResult === false || comparatorResult === true) {
      memoizeSet(leftHandOperand, rightHandOperand, options.memoize, comparatorResult);
      return comparatorResult;
    }
    var simpleResult = simpleEqual(leftHandOperand, rightHandOperand);
    if (simpleResult !== null) {
      return simpleResult;
    }
  }
  var leftHandType = type2(leftHandOperand);
  if (leftHandType !== type2(rightHandOperand)) {
    memoizeSet(leftHandOperand, rightHandOperand, options.memoize, false);
    return false;
  }
  memoizeSet(leftHandOperand, rightHandOperand, options.memoize, true);
  var result = extensiveDeepEqualByType(leftHandOperand, rightHandOperand, leftHandType, options);
  memoizeSet(leftHandOperand, rightHandOperand, options.memoize, result);
  return result;
}
__name(extensiveDeepEqual, "extensiveDeepEqual");
function extensiveDeepEqualByType(leftHandOperand, rightHandOperand, leftHandType, options) {
  switch (leftHandType) {
    case "String":
    case "Number":
    case "Boolean":
    case "Date":
      return deepEqual(leftHandOperand.valueOf(), rightHandOperand.valueOf());
    case "Promise":
    case "Symbol":
    case "function":
    case "WeakMap":
    case "WeakSet":
      return leftHandOperand === rightHandOperand;
    case "Error":
      return keysEqual(leftHandOperand, rightHandOperand, ["name", "message", "code"], options);
    case "Arguments":
    case "Int8Array":
    case "Uint8Array":
    case "Uint8ClampedArray":
    case "Int16Array":
    case "Uint16Array":
    case "Int32Array":
    case "Uint32Array":
    case "Float32Array":
    case "Float64Array":
    case "Array":
      return iterableEqual(leftHandOperand, rightHandOperand, options);
    case "RegExp":
      return regexpEqual(leftHandOperand, rightHandOperand);
    case "Generator":
      return generatorEqual(leftHandOperand, rightHandOperand, options);
    case "DataView":
      return iterableEqual(new Uint8Array(leftHandOperand.buffer), new Uint8Array(rightHandOperand.buffer), options);
    case "ArrayBuffer":
      return iterableEqual(new Uint8Array(leftHandOperand), new Uint8Array(rightHandOperand), options);
    case "Set":
      return entriesEqual(leftHandOperand, rightHandOperand, options);
    case "Map":
      return entriesEqual(leftHandOperand, rightHandOperand, options);
    case "Temporal.PlainDate":
    case "Temporal.PlainTime":
    case "Temporal.PlainDateTime":
    case "Temporal.Instant":
    case "Temporal.ZonedDateTime":
    case "Temporal.PlainYearMonth":
    case "Temporal.PlainMonthDay":
      return leftHandOperand.equals(rightHandOperand);
    case "Temporal.Duration":
      return leftHandOperand.total("nanoseconds") === rightHandOperand.total("nanoseconds");
    case "Temporal.TimeZone":
    case "Temporal.Calendar":
      return leftHandOperand.toString() === rightHandOperand.toString();
    default:
      return objectEqual(leftHandOperand, rightHandOperand, options);
  }
}
__name(extensiveDeepEqualByType, "extensiveDeepEqualByType");
function regexpEqual(leftHandOperand, rightHandOperand) {
  return leftHandOperand.toString() === rightHandOperand.toString();
}
__name(regexpEqual, "regexpEqual");
function entriesEqual(leftHandOperand, rightHandOperand, options) {
  try {
    if (leftHandOperand.size !== rightHandOperand.size) {
      return false;
    }
    if (leftHandOperand.size === 0) {
      return true;
    }
  } catch (sizeError) {
    return false;
  }
  var leftHandItems = [];
  var rightHandItems = [];
  leftHandOperand.forEach(/* @__PURE__ */ __name(function gatherEntries(key, value) {
    leftHandItems.push([key, value]);
  }, "gatherEntries"));
  rightHandOperand.forEach(/* @__PURE__ */ __name(function gatherEntries(key, value) {
    rightHandItems.push([key, value]);
  }, "gatherEntries"));
  return iterableEqual(leftHandItems.sort(), rightHandItems.sort(), options);
}
__name(entriesEqual, "entriesEqual");
function iterableEqual(leftHandOperand, rightHandOperand, options) {
  var length = leftHandOperand.length;
  if (length !== rightHandOperand.length) {
    return false;
  }
  if (length === 0) {
    return true;
  }
  var index = -1;
  while (++index < length) {
    if (deepEqual(leftHandOperand[index], rightHandOperand[index], options) === false) {
      return false;
    }
  }
  return true;
}
__name(iterableEqual, "iterableEqual");
function generatorEqual(leftHandOperand, rightHandOperand, options) {
  return iterableEqual(getGeneratorEntries(leftHandOperand), getGeneratorEntries(rightHandOperand), options);
}
__name(generatorEqual, "generatorEqual");
function hasIteratorFunction(target) {
  return typeof Symbol !== "undefined" && typeof target === "object" && typeof Symbol.iterator !== "undefined" && typeof target[Symbol.iterator] === "function";
}
__name(hasIteratorFunction, "hasIteratorFunction");
function getIteratorEntries(target) {
  if (hasIteratorFunction(target)) {
    try {
      return getGeneratorEntries(target[Symbol.iterator]());
    } catch (iteratorError) {
      return [];
    }
  }
  return [];
}
__name(getIteratorEntries, "getIteratorEntries");
function getGeneratorEntries(generator) {
  var generatorResult = generator.next();
  var accumulator = [generatorResult.value];
  while (generatorResult.done === false) {
    generatorResult = generator.next();
    accumulator.push(generatorResult.value);
  }
  return accumulator;
}
__name(getGeneratorEntries, "getGeneratorEntries");
function getEnumerableKeys(target) {
  var keys = [];
  for (var key in target) {
    keys.push(key);
  }
  return keys;
}
__name(getEnumerableKeys, "getEnumerableKeys");
function getEnumerableSymbols(target) {
  var keys = [];
  var allKeys = Object.getOwnPropertySymbols(target);
  for (var i = 0; i < allKeys.length; i += 1) {
    var key = allKeys[i];
    if (Object.getOwnPropertyDescriptor(target, key).enumerable) {
      keys.push(key);
    }
  }
  return keys;
}
__name(getEnumerableSymbols, "getEnumerableSymbols");
function keysEqual(leftHandOperand, rightHandOperand, keys, options) {
  var length = keys.length;
  if (length === 0) {
    return true;
  }
  for (var i = 0; i < length; i += 1) {
    if (deepEqual(leftHandOperand[keys[i]], rightHandOperand[keys[i]], options) === false) {
      return false;
    }
  }
  return true;
}
__name(keysEqual, "keysEqual");
function objectEqual(leftHandOperand, rightHandOperand, options) {
  var leftHandKeys = getEnumerableKeys(leftHandOperand);
  var rightHandKeys = getEnumerableKeys(rightHandOperand);
  var leftHandSymbols = getEnumerableSymbols(leftHandOperand);
  var rightHandSymbols = getEnumerableSymbols(rightHandOperand);
  leftHandKeys = leftHandKeys.concat(leftHandSymbols);
  rightHandKeys = rightHandKeys.concat(rightHandSymbols);
  if (leftHandKeys.length && leftHandKeys.length === rightHandKeys.length) {
    if (iterableEqual(mapSymbols(leftHandKeys).sort(), mapSymbols(rightHandKeys).sort()) === false) {
      return false;
    }
    return keysEqual(leftHandOperand, rightHandOperand, leftHandKeys, options);
  }
  var leftHandEntries = getIteratorEntries(leftHandOperand);
  var rightHandEntries = getIteratorEntries(rightHandOperand);
  if (leftHandEntries.length && leftHandEntries.length === rightHandEntries.length) {
    leftHandEntries.sort();
    rightHandEntries.sort();
    return iterableEqual(leftHandEntries, rightHandEntries, options);
  }
  if (leftHandKeys.length === 0 && leftHandEntries.length === 0 && rightHandKeys.length === 0 && rightHandEntries.length === 0) {
    return true;
  }
  return false;
}
__name(objectEqual, "objectEqual");
function isPrimitive(value) {
  return value === null || typeof value !== "object";
}
__name(isPrimitive, "isPrimitive");
function mapSymbols(arr) {
  return arr.map(/* @__PURE__ */ __name(function mapSymbol(entry) {
    if (typeof entry === "symbol") {
      return entry.toString();
    }
    return entry;
  }, "mapSymbol"));
}
__name(mapSymbols, "mapSymbols");
function hasProperty(obj, name) {
  if (typeof obj === "undefined" || obj === null) {
    return false;
  }
  return name in Object(obj);
}
__name(hasProperty, "hasProperty");
function parsePath(path) {
  const str = path.replace(/([^\\])\[/g, "$1.[");
  const parts = str.match(/(\\\.|[^.]+?)+/g);
  return parts.map((value) => {
    if (value === "constructor" || value === "__proto__" || value === "prototype") {
      return {};
    }
    const regexp = /^\[(\d+)\]$/;
    const mArr = regexp.exec(value);
    let parsed = null;
    if (mArr) {
      parsed = { i: parseFloat(mArr[1]) };
    } else {
      parsed = { p: value.replace(/\\([.[\]])/g, "$1") };
    }
    return parsed;
  });
}
__name(parsePath, "parsePath");
function internalGetPathValue(obj, parsed, pathDepth) {
  let temporaryValue = obj;
  let res = null;
  pathDepth = typeof pathDepth === "undefined" ? parsed.length : pathDepth;
  for (let i = 0; i < pathDepth; i++) {
    const part = parsed[i];
    if (temporaryValue) {
      if (typeof part.p === "undefined") {
        temporaryValue = temporaryValue[part.i];
      } else {
        temporaryValue = temporaryValue[part.p];
      }
      if (i === pathDepth - 1) {
        res = temporaryValue;
      }
    }
  }
  return res;
}
__name(internalGetPathValue, "internalGetPathValue");
function getPathInfo(obj, path) {
  const parsed = parsePath(path);
  const last = parsed[parsed.length - 1];
  const info = {
    parent: parsed.length > 1 ? internalGetPathValue(obj, parsed, parsed.length - 1) : obj,
    name: last.p || last.i,
    value: internalGetPathValue(obj, parsed)
  };
  info.exists = hasProperty(info.parent, info.name);
  return info;
}
__name(getPathInfo, "getPathInfo");
var Assertion = class _Assertion {
  static {
    __name(this, "Assertion");
  }
  /** @type {{}} */
  __flags = {};
  /**
   * Creates object for chaining.
   * `Assertion` objects contain metadata in the form of flags. Three flags can
   * be assigned during instantiation by passing arguments to this constructor:
   *
   * - `object`: This flag contains the target of the assertion. For example, in
   * the assertion `expect(numKittens).to.equal(7);`, the `object` flag will
   * contain `numKittens` so that the `equal` assertion can reference it when
   * needed.
   *
   * - `message`: This flag contains an optional custom error message to be
   * prepended to the error message that's generated by the assertion when it
   * fails.
   *
   * - `ssfi`: This flag stands for "start stack function indicator". It
   * contains a function reference that serves as the starting point for
   * removing frames from the stack trace of the error that's created by the
   * assertion when it fails. The goal is to provide a cleaner stack trace to
   * end users by removing Chai's internal functions. Note that it only works
   * in environments that support `Error.captureStackTrace`, and only when
   * `Chai.config.includeStack` hasn't been set to `false`.
   *
   * - `lockSsfi`: This flag controls whether or not the given `ssfi` flag
   * should retain its current value, even as assertions are chained off of
   * this object. This is usually set to `true` when creating a new assertion
   * from within another assertion. It's also temporarily set to `true` before
   * an overwritten assertion gets called by the overwriting assertion.
   *
   * - `eql`: This flag contains the deepEqual function to be used by the assertion.
   *
   * @param {unknown} obj target of the assertion
   * @param {string} [msg] (optional) custom error message
   * @param {Function} [ssfi] (optional) starting point for removing stack frames
   * @param {boolean} [lockSsfi] (optional) whether or not the ssfi flag is locked
   */
  constructor(obj, msg, ssfi, lockSsfi) {
    flag(this, "ssfi", ssfi || _Assertion);
    flag(this, "lockSsfi", lockSsfi);
    flag(this, "object", obj);
    flag(this, "message", msg);
    flag(this, "eql", config.deepEqual || deep_eql_default);
    return proxify(this);
  }
  /** @returns {boolean} */
  static get includeStack() {
    console.warn(
      "Assertion.includeStack is deprecated, use chai.config.includeStack instead."
    );
    return config.includeStack;
  }
  /** @param {boolean} value */
  static set includeStack(value) {
    console.warn(
      "Assertion.includeStack is deprecated, use chai.config.includeStack instead."
    );
    config.includeStack = value;
  }
  /** @returns {boolean} */
  static get showDiff() {
    console.warn(
      "Assertion.showDiff is deprecated, use chai.config.showDiff instead."
    );
    return config.showDiff;
  }
  /** @param {boolean} value */
  static set showDiff(value) {
    console.warn(
      "Assertion.showDiff is deprecated, use chai.config.showDiff instead."
    );
    config.showDiff = value;
  }
  /**
   * @param {string} name
   * @param {Function} fn
   */
  static addProperty(name, fn) {
    addProperty(this.prototype, name, fn);
  }
  /**
   * @param {string} name
   * @param {Function} fn
   */
  static addMethod(name, fn) {
    addMethod(this.prototype, name, fn);
  }
  /**
   * @param {string} name
   * @param {Function} fn
   * @param {Function} chainingBehavior
   */
  static addChainableMethod(name, fn, chainingBehavior) {
    addChainableMethod(this.prototype, name, fn, chainingBehavior);
  }
  /**
   * @param {string} name
   * @param {Function} fn
   */
  static overwriteProperty(name, fn) {
    overwriteProperty(this.prototype, name, fn);
  }
  /**
   * @param {string} name
   * @param {Function} fn
   */
  static overwriteMethod(name, fn) {
    overwriteMethod(this.prototype, name, fn);
  }
  /**
   * @param {string} name
   * @param {Function} fn
   * @param {Function} chainingBehavior
   */
  static overwriteChainableMethod(name, fn, chainingBehavior) {
    overwriteChainableMethod(this.prototype, name, fn, chainingBehavior);
  }
  /**
   * ### .assert(expression, message, negateMessage, expected, actual, showDiff)
   *
   * Executes an expression and check expectations. Throws AssertionError for reporting if test doesn't pass.
   *
   * @name assert
   * @param {unknown} _expr to be tested
   * @param {string | Function} msg or function that returns message to display if expression fails
   * @param {string | Function} _negateMsg or function that returns negatedMessage to display if negated expression fails
   * @param {unknown} expected value (remember to check for negation)
   * @param {unknown} _actual (optional) will default to `this.obj`
   * @param {boolean} showDiff (optional) when set to `true`, assert will display a diff in addition to the message if expression fails
   * @returns {void}
   */
  assert(_expr, msg, _negateMsg, expected, _actual, showDiff) {
    const ok = test2(this, arguments);
    if (false !== showDiff) showDiff = true;
    if (void 0 === expected && void 0 === _actual) showDiff = false;
    if (true !== config.showDiff) showDiff = false;
    if (!ok) {
      msg = getMessage2(this, arguments);
      const actual = getActual(this, arguments);
      const assertionErrorObjectProperties = {
        actual,
        expected,
        showDiff
      };
      const operator = getOperator(this, arguments);
      if (operator) {
        assertionErrorObjectProperties.operator = operator;
      }
      throw new AssertionError(
        msg,
        assertionErrorObjectProperties,
        // @ts-expect-error Not sure what to do about these types yet
        config.includeStack ? this.assert : flag(this, "ssfi")
      );
    }
  }
  /**
   * Quick reference to stored `actual` value for plugin developers.
   *
   * @returns {unknown}
   */
  get _obj() {
    return flag(this, "object");
  }
  /**
   * Quick reference to stored `actual` value for plugin developers.
   *
   * @param {unknown} val
   */
  set _obj(val) {
    flag(this, "object", val);
  }
};
var events = new EventTarget();
var PluginEvent = class extends Event {
  static {
    __name(this, "PluginEvent");
  }
  constructor(type3, name, fn) {
    super(type3);
    this.name = String(name);
    this.fn = fn;
  }
};
function isProxyEnabled() {
  return config.useProxy && typeof Proxy !== "undefined" && typeof Reflect !== "undefined";
}
__name(isProxyEnabled, "isProxyEnabled");
function addProperty(ctx, name, getter) {
  getter = getter === void 0 ? function() {
  } : getter;
  Object.defineProperty(ctx, name, {
    get: /* @__PURE__ */ __name(function propertyGetter() {
      if (!isProxyEnabled() && !flag(this, "lockSsfi")) {
        flag(this, "ssfi", propertyGetter);
      }
      let result = getter.call(this);
      if (result !== void 0) return result;
      let newAssertion = new Assertion();
      transferFlags(this, newAssertion);
      return newAssertion;
    }, "propertyGetter"),
    configurable: true
  });
  events.dispatchEvent(new PluginEvent("addProperty", name, getter));
}
__name(addProperty, "addProperty");
var fnLengthDesc = Object.getOwnPropertyDescriptor(function() {
}, "length");
function addLengthGuard(fn, assertionName, isChainable) {
  if (!fnLengthDesc.configurable) return fn;
  Object.defineProperty(fn, "length", {
    get: /* @__PURE__ */ __name(function() {
      if (isChainable) {
        throw Error(
          "Invalid Chai property: " + assertionName + '.length. Due to a compatibility issue, "length" cannot directly follow "' + assertionName + '". Use "' + assertionName + '.lengthOf" instead.'
        );
      }
      throw Error(
        "Invalid Chai property: " + assertionName + '.length. See docs for proper usage of "' + assertionName + '".'
      );
    }, "get")
  });
  return fn;
}
__name(addLengthGuard, "addLengthGuard");
function getProperties(object) {
  let result = Object.getOwnPropertyNames(object);
  function addProperty2(property) {
    if (result.indexOf(property) === -1) {
      result.push(property);
    }
  }
  __name(addProperty2, "addProperty");
  let proto = Object.getPrototypeOf(object);
  while (proto !== null) {
    Object.getOwnPropertyNames(proto).forEach(addProperty2);
    proto = Object.getPrototypeOf(proto);
  }
  return result;
}
__name(getProperties, "getProperties");
var builtins = ["__flags", "__methods", "_obj", "assert"];
function proxify(obj, nonChainableMethodName) {
  if (!isProxyEnabled()) return obj;
  return new Proxy(obj, {
    get: /* @__PURE__ */ __name(function proxyGetter(target, property) {
      if (typeof property === "string" && config.proxyExcludedKeys.indexOf(property) === -1 && !Reflect.has(target, property)) {
        if (nonChainableMethodName) {
          throw Error(
            "Invalid Chai property: " + nonChainableMethodName + "." + property + '. See docs for proper usage of "' + nonChainableMethodName + '".'
          );
        }
        let suggestion = null;
        let suggestionDistance = 4;
        getProperties(target).forEach(function(prop) {
          if (
            // we actually mean to check `Object.prototype` here
            // eslint-disable-next-line no-prototype-builtins
            !Object.prototype.hasOwnProperty(prop) && builtins.indexOf(prop) === -1
          ) {
            let dist = stringDistanceCapped(property, prop, suggestionDistance);
            if (dist < suggestionDistance) {
              suggestion = prop;
              suggestionDistance = dist;
            }
          }
        });
        if (suggestion !== null) {
          throw Error(
            "Invalid Chai property: " + property + '. Did you mean "' + suggestion + '"?'
          );
        } else {
          throw Error("Invalid Chai property: " + property);
        }
      }
      if (builtins.indexOf(property) === -1 && !flag(target, "lockSsfi")) {
        flag(target, "ssfi", proxyGetter);
      }
      return Reflect.get(target, property);
    }, "proxyGetter")
  });
}
__name(proxify, "proxify");
function stringDistanceCapped(strA, strB, cap) {
  if (Math.abs(strA.length - strB.length) >= cap) {
    return cap;
  }
  let memo = [];
  for (let i = 0; i <= strA.length; i++) {
    memo[i] = Array(strB.length + 1).fill(0);
    memo[i][0] = i;
  }
  for (let j = 0; j < strB.length; j++) {
    memo[0][j] = j;
  }
  for (let i = 1; i <= strA.length; i++) {
    let ch = strA.charCodeAt(i - 1);
    for (let j = 1; j <= strB.length; j++) {
      if (Math.abs(i - j) >= cap) {
        memo[i][j] = cap;
        continue;
      }
      memo[i][j] = Math.min(
        memo[i - 1][j] + 1,
        memo[i][j - 1] + 1,
        memo[i - 1][j - 1] + (ch === strB.charCodeAt(j - 1) ? 0 : 1)
      );
    }
  }
  return memo[strA.length][strB.length];
}
__name(stringDistanceCapped, "stringDistanceCapped");
function addMethod(ctx, name, method) {
  let methodWrapper = /* @__PURE__ */ __name(function() {
    if (!flag(this, "lockSsfi")) {
      flag(this, "ssfi", methodWrapper);
    }
    let result = method.apply(this, arguments);
    if (result !== void 0) return result;
    let newAssertion = new Assertion();
    transferFlags(this, newAssertion);
    return newAssertion;
  }, "methodWrapper");
  addLengthGuard(methodWrapper, name, false);
  ctx[name] = proxify(methodWrapper, name);
  events.dispatchEvent(new PluginEvent("addMethod", name, method));
}
__name(addMethod, "addMethod");
function overwriteProperty(ctx, name, getter) {
  let _get = Object.getOwnPropertyDescriptor(ctx, name), _super = /* @__PURE__ */ __name(function() {
  }, "_super");
  if (_get && "function" === typeof _get.get) _super = _get.get;
  Object.defineProperty(ctx, name, {
    get: /* @__PURE__ */ __name(function overwritingPropertyGetter() {
      if (!isProxyEnabled() && !flag(this, "lockSsfi")) {
        flag(this, "ssfi", overwritingPropertyGetter);
      }
      let origLockSsfi = flag(this, "lockSsfi");
      flag(this, "lockSsfi", true);
      let result = getter(_super).call(this);
      flag(this, "lockSsfi", origLockSsfi);
      if (result !== void 0) {
        return result;
      }
      let newAssertion = new Assertion();
      transferFlags(this, newAssertion);
      return newAssertion;
    }, "overwritingPropertyGetter"),
    configurable: true
  });
}
__name(overwriteProperty, "overwriteProperty");
function overwriteMethod(ctx, name, method) {
  let _method = ctx[name], _super = /* @__PURE__ */ __name(function() {
    throw new Error(name + " is not a function");
  }, "_super");
  if (_method && "function" === typeof _method) _super = _method;
  let overwritingMethodWrapper = /* @__PURE__ */ __name(function() {
    if (!flag(this, "lockSsfi")) {
      flag(this, "ssfi", overwritingMethodWrapper);
    }
    let origLockSsfi = flag(this, "lockSsfi");
    flag(this, "lockSsfi", true);
    let result = method(_super).apply(this, arguments);
    flag(this, "lockSsfi", origLockSsfi);
    if (result !== void 0) {
      return result;
    }
    let newAssertion = new Assertion();
    transferFlags(this, newAssertion);
    return newAssertion;
  }, "overwritingMethodWrapper");
  addLengthGuard(overwritingMethodWrapper, name, false);
  ctx[name] = proxify(overwritingMethodWrapper, name);
}
__name(overwriteMethod, "overwriteMethod");
var canSetPrototype = typeof Object.setPrototypeOf === "function";
var testFn = /* @__PURE__ */ __name(function() {
}, "testFn");
var excludeNames = Object.getOwnPropertyNames(testFn).filter(function(name) {
  let propDesc = Object.getOwnPropertyDescriptor(testFn, name);
  if (typeof propDesc !== "object") return true;
  return !propDesc.configurable;
});
var call = Function.prototype.call;
var apply = Function.prototype.apply;
var PluginAddChainableMethodEvent = class extends PluginEvent {
  static {
    __name(this, "PluginAddChainableMethodEvent");
  }
  constructor(type3, name, fn, chainingBehavior) {
    super(type3, name, fn);
    this.chainingBehavior = chainingBehavior;
  }
};
function addChainableMethod(ctx, name, method, chainingBehavior) {
  if (typeof chainingBehavior !== "function") {
    chainingBehavior = /* @__PURE__ */ __name(function() {
    }, "chainingBehavior");
  }
  let chainableBehavior = {
    method,
    chainingBehavior
  };
  if (!ctx.__methods) {
    ctx.__methods = {};
  }
  ctx.__methods[name] = chainableBehavior;
  Object.defineProperty(ctx, name, {
    get: /* @__PURE__ */ __name(function chainableMethodGetter() {
      chainableBehavior.chainingBehavior.call(this);
      let chainableMethodWrapper = /* @__PURE__ */ __name(function() {
        if (!flag(this, "lockSsfi")) {
          flag(this, "ssfi", chainableMethodWrapper);
        }
        let result = chainableBehavior.method.apply(this, arguments);
        if (result !== void 0) {
          return result;
        }
        let newAssertion = new Assertion();
        transferFlags(this, newAssertion);
        return newAssertion;
      }, "chainableMethodWrapper");
      addLengthGuard(chainableMethodWrapper, name, true);
      if (canSetPrototype) {
        let prototype = Object.create(this);
        prototype.call = call;
        prototype.apply = apply;
        Object.setPrototypeOf(chainableMethodWrapper, prototype);
      } else {
        let asserterNames = Object.getOwnPropertyNames(ctx);
        asserterNames.forEach(function(asserterName) {
          if (excludeNames.indexOf(asserterName) !== -1) {
            return;
          }
          let pd = Object.getOwnPropertyDescriptor(ctx, asserterName);
          Object.defineProperty(chainableMethodWrapper, asserterName, pd);
        });
      }
      transferFlags(this, chainableMethodWrapper);
      return proxify(chainableMethodWrapper);
    }, "chainableMethodGetter"),
    configurable: true
  });
  events.dispatchEvent(
    new PluginAddChainableMethodEvent(
      "addChainableMethod",
      name,
      method,
      chainingBehavior
    )
  );
}
__name(addChainableMethod, "addChainableMethod");
function overwriteChainableMethod(ctx, name, method, chainingBehavior) {
  let chainableBehavior = ctx.__methods[name];
  let _chainingBehavior = chainableBehavior.chainingBehavior;
  chainableBehavior.chainingBehavior = /* @__PURE__ */ __name(function overwritingChainableMethodGetter() {
    let result = chainingBehavior(_chainingBehavior).call(this);
    if (result !== void 0) {
      return result;
    }
    let newAssertion = new Assertion();
    transferFlags(this, newAssertion);
    return newAssertion;
  }, "overwritingChainableMethodGetter");
  let _method = chainableBehavior.method;
  chainableBehavior.method = /* @__PURE__ */ __name(function overwritingChainableMethodWrapper() {
    let result = method(_method).apply(this, arguments);
    if (result !== void 0) {
      return result;
    }
    let newAssertion = new Assertion();
    transferFlags(this, newAssertion);
    return newAssertion;
  }, "overwritingChainableMethodWrapper");
}
__name(overwriteChainableMethod, "overwriteChainableMethod");
function compareByInspect(a, b) {
  return inspect2(a) < inspect2(b) ? -1 : 1;
}
__name(compareByInspect, "compareByInspect");
function getOwnEnumerablePropertySymbols(obj) {
  if (typeof Object.getOwnPropertySymbols !== "function") return [];
  return Object.getOwnPropertySymbols(obj).filter(function(sym) {
    return Object.getOwnPropertyDescriptor(obj, sym).enumerable;
  });
}
__name(getOwnEnumerablePropertySymbols, "getOwnEnumerablePropertySymbols");
function getOwnEnumerableProperties(obj) {
  return Object.keys(obj).concat(getOwnEnumerablePropertySymbols(obj));
}
__name(getOwnEnumerableProperties, "getOwnEnumerableProperties");
var isNaN2 = Number.isNaN;
function isObjectType(obj) {
  let objectType = type(obj);
  let objectTypes = ["Array", "Object", "Function"];
  return objectTypes.indexOf(objectType) !== -1;
}
__name(isObjectType, "isObjectType");
function getOperator(obj, args) {
  let operator = flag(obj, "operator");
  let negate = flag(obj, "negate");
  let expected = args[3];
  let msg = negate ? args[2] : args[1];
  if (operator) {
    return operator;
  }
  if (typeof msg === "function") msg = msg();
  msg = msg || "";
  if (!msg) {
    return void 0;
  }
  if (/\shave\s/.test(msg)) {
    return void 0;
  }
  let isObject = isObjectType(expected);
  if (/\snot\s/.test(msg)) {
    return isObject ? "notDeepStrictEqual" : "notStrictEqual";
  }
  return isObject ? "deepStrictEqual" : "strictEqual";
}
__name(getOperator, "getOperator");
function getName(fn) {
  return fn.name;
}
__name(getName, "getName");
function isRegExp2(obj) {
  return Object.prototype.toString.call(obj) === "[object RegExp]";
}
__name(isRegExp2, "isRegExp");
function isNumeric(obj) {
  return ["Number", "BigInt"].includes(type(obj));
}
__name(isNumeric, "isNumeric");
var { flag: flag2 } = utils_exports;
[
  "to",
  "be",
  "been",
  "is",
  "and",
  "has",
  "have",
  "with",
  "that",
  "which",
  "at",
  "of",
  "same",
  "but",
  "does",
  "still",
  "also"
].forEach(function(chain) {
  Assertion.addProperty(chain);
});
Assertion.addProperty("not", function() {
  flag2(this, "negate", true);
});
Assertion.addProperty("deep", function() {
  flag2(this, "deep", true);
});
Assertion.addProperty("nested", function() {
  flag2(this, "nested", true);
});
Assertion.addProperty("own", function() {
  flag2(this, "own", true);
});
Assertion.addProperty("ordered", function() {
  flag2(this, "ordered", true);
});
Assertion.addProperty("any", function() {
  flag2(this, "any", true);
  flag2(this, "all", false);
});
Assertion.addProperty("all", function() {
  flag2(this, "all", true);
  flag2(this, "any", false);
});
var functionTypes = {
  function: [
    "function",
    "asyncfunction",
    "generatorfunction",
    "asyncgeneratorfunction"
  ],
  asyncfunction: ["asyncfunction", "asyncgeneratorfunction"],
  generatorfunction: ["generatorfunction", "asyncgeneratorfunction"],
  asyncgeneratorfunction: ["asyncgeneratorfunction"]
};
function an(type3, msg) {
  if (msg) flag2(this, "message", msg);
  type3 = type3.toLowerCase();
  let obj = flag2(this, "object"), article = ~["a", "e", "i", "o", "u"].indexOf(type3.charAt(0)) ? "an " : "a ";
  const detectedType = type(obj).toLowerCase();
  if (functionTypes["function"].includes(type3)) {
    this.assert(
      functionTypes[type3].includes(detectedType),
      "expected #{this} to be " + article + type3,
      "expected #{this} not to be " + article + type3
    );
  } else {
    this.assert(
      type3 === detectedType,
      "expected #{this} to be " + article + type3,
      "expected #{this} not to be " + article + type3
    );
  }
}
__name(an, "an");
Assertion.addChainableMethod("an", an);
Assertion.addChainableMethod("a", an);
function SameValueZero(a, b) {
  return isNaN2(a) && isNaN2(b) || a === b;
}
__name(SameValueZero, "SameValueZero");
function includeChainingBehavior() {
  flag2(this, "contains", true);
}
__name(includeChainingBehavior, "includeChainingBehavior");
function include(val, msg) {
  if (msg) flag2(this, "message", msg);
  let obj = flag2(this, "object"), objType = type(obj).toLowerCase(), flagMsg = flag2(this, "message"), negate = flag2(this, "negate"), ssfi = flag2(this, "ssfi"), isDeep = flag2(this, "deep"), descriptor = isDeep ? "deep " : "", isEql = isDeep ? flag2(this, "eql") : SameValueZero;
  flagMsg = flagMsg ? flagMsg + ": " : "";
  let included = false;
  switch (objType) {
    case "string":
      included = obj.indexOf(val) !== -1;
      break;
    case "weakset":
      if (isDeep) {
        throw new AssertionError(
          flagMsg + "unable to use .deep.include with WeakSet",
          void 0,
          ssfi
        );
      }
      included = obj.has(val);
      break;
    case "map":
      obj.forEach(function(item) {
        included = included || isEql(item, val);
      });
      break;
    case "set":
      if (isDeep) {
        obj.forEach(function(item) {
          included = included || isEql(item, val);
        });
      } else {
        included = obj.has(val);
      }
      break;
    case "array":
      if (isDeep) {
        included = obj.some(function(item) {
          return isEql(item, val);
        });
      } else {
        included = obj.indexOf(val) !== -1;
      }
      break;
    default: {
      if (val !== Object(val)) {
        throw new AssertionError(
          flagMsg + "the given combination of arguments (" + objType + " and " + type(val).toLowerCase() + ") is invalid for this assertion. You can use an array, a map, an object, a set, a string, or a weakset instead of a " + type(val).toLowerCase(),
          void 0,
          ssfi
        );
      }
      let props = Object.keys(val);
      let firstErr = null;
      let numErrs = 0;
      props.forEach(function(prop) {
        let propAssertion = new Assertion(obj);
        transferFlags(this, propAssertion, true);
        flag2(propAssertion, "lockSsfi", true);
        if (!negate || props.length === 1) {
          propAssertion.property(prop, val[prop]);
          return;
        }
        try {
          propAssertion.property(prop, val[prop]);
        } catch (err) {
          if (!check_error_exports.compatibleConstructor(err, AssertionError)) {
            throw err;
          }
          if (firstErr === null) firstErr = err;
          numErrs++;
        }
      }, this);
      if (negate && props.length > 1 && numErrs === props.length) {
        throw firstErr;
      }
      return;
    }
  }
  this.assert(
    included,
    "expected #{this} to " + descriptor + "include " + inspect2(val),
    "expected #{this} to not " + descriptor + "include " + inspect2(val)
  );
}
__name(include, "include");
Assertion.addChainableMethod("include", include, includeChainingBehavior);
Assertion.addChainableMethod("contain", include, includeChainingBehavior);
Assertion.addChainableMethod("contains", include, includeChainingBehavior);
Assertion.addChainableMethod("includes", include, includeChainingBehavior);
Assertion.addProperty("ok", function() {
  this.assert(
    flag2(this, "object"),
    "expected #{this} to be truthy",
    "expected #{this} to be falsy"
  );
});
Assertion.addProperty("true", function() {
  this.assert(
    true === flag2(this, "object"),
    "expected #{this} to be true",
    "expected #{this} to be false",
    flag2(this, "negate") ? false : true
  );
});
Assertion.addProperty("numeric", function() {
  const object = flag2(this, "object");
  this.assert(
    ["Number", "BigInt"].includes(type(object)),
    "expected #{this} to be numeric",
    "expected #{this} to not be numeric",
    flag2(this, "negate") ? false : true
  );
});
Assertion.addProperty("callable", function() {
  const val = flag2(this, "object");
  const ssfi = flag2(this, "ssfi");
  const message = flag2(this, "message");
  const msg = message ? `${message}: ` : "";
  const negate = flag2(this, "negate");
  const assertionMessage = negate ? `${msg}expected ${inspect2(val)} not to be a callable function` : `${msg}expected ${inspect2(val)} to be a callable function`;
  const isCallable = [
    "Function",
    "AsyncFunction",
    "GeneratorFunction",
    "AsyncGeneratorFunction"
  ].includes(type(val));
  if (isCallable && negate || !isCallable && !negate) {
    throw new AssertionError(assertionMessage, void 0, ssfi);
  }
});
Assertion.addProperty("false", function() {
  this.assert(
    false === flag2(this, "object"),
    "expected #{this} to be false",
    "expected #{this} to be true",
    flag2(this, "negate") ? true : false
  );
});
Assertion.addProperty("null", function() {
  this.assert(
    null === flag2(this, "object"),
    "expected #{this} to be null",
    "expected #{this} not to be null"
  );
});
Assertion.addProperty("undefined", function() {
  this.assert(
    void 0 === flag2(this, "object"),
    "expected #{this} to be undefined",
    "expected #{this} not to be undefined"
  );
});
Assertion.addProperty("NaN", function() {
  this.assert(
    isNaN2(flag2(this, "object")),
    "expected #{this} to be NaN",
    "expected #{this} not to be NaN"
  );
});
function assertExist() {
  let val = flag2(this, "object");
  this.assert(
    val !== null && val !== void 0,
    "expected #{this} to exist",
    "expected #{this} to not exist"
  );
}
__name(assertExist, "assertExist");
Assertion.addProperty("exist", assertExist);
Assertion.addProperty("exists", assertExist);
Assertion.addProperty("empty", function() {
  let val = flag2(this, "object"), ssfi = flag2(this, "ssfi"), flagMsg = flag2(this, "message"), itemsCount;
  flagMsg = flagMsg ? flagMsg + ": " : "";
  switch (type(val).toLowerCase()) {
    case "array":
    case "string":
      itemsCount = val.length;
      break;
    case "map":
    case "set":
      itemsCount = val.size;
      break;
    case "weakmap":
    case "weakset":
      throw new AssertionError(
        flagMsg + ".empty was passed a weak collection",
        void 0,
        ssfi
      );
    case "function": {
      const msg = flagMsg + ".empty was passed a function " + getName(val);
      throw new AssertionError(msg.trim(), void 0, ssfi);
    }
    default:
      if (val !== Object(val)) {
        throw new AssertionError(
          flagMsg + ".empty was passed non-string primitive " + inspect2(val),
          void 0,
          ssfi
        );
      }
      itemsCount = Object.keys(val).length;
  }
  this.assert(
    0 === itemsCount,
    "expected #{this} to be empty",
    "expected #{this} not to be empty"
  );
});
function checkArguments() {
  let obj = flag2(this, "object"), type3 = type(obj);
  this.assert(
    "Arguments" === type3,
    "expected #{this} to be arguments but got " + type3,
    "expected #{this} to not be arguments"
  );
}
__name(checkArguments, "checkArguments");
Assertion.addProperty("arguments", checkArguments);
Assertion.addProperty("Arguments", checkArguments);
function assertEqual(val, msg) {
  if (msg) flag2(this, "message", msg);
  let obj = flag2(this, "object");
  if (flag2(this, "deep")) {
    let prevLockSsfi = flag2(this, "lockSsfi");
    flag2(this, "lockSsfi", true);
    this.eql(val);
    flag2(this, "lockSsfi", prevLockSsfi);
  } else {
    this.assert(
      val === obj,
      "expected #{this} to equal #{exp}",
      "expected #{this} to not equal #{exp}",
      val,
      this._obj,
      true
    );
  }
}
__name(assertEqual, "assertEqual");
Assertion.addMethod("equal", assertEqual);
Assertion.addMethod("equals", assertEqual);
Assertion.addMethod("eq", assertEqual);
function assertEql(obj, msg) {
  if (msg) flag2(this, "message", msg);
  let eql = flag2(this, "eql");
  this.assert(
    eql(obj, flag2(this, "object")),
    "expected #{this} to deeply equal #{exp}",
    "expected #{this} to not deeply equal #{exp}",
    obj,
    this._obj,
    true
  );
}
__name(assertEql, "assertEql");
Assertion.addMethod("eql", assertEql);
Assertion.addMethod("eqls", assertEql);
function assertAbove(n, msg) {
  if (msg) flag2(this, "message", msg);
  let obj = flag2(this, "object"), doLength = flag2(this, "doLength"), flagMsg = flag2(this, "message"), msgPrefix = flagMsg ? flagMsg + ": " : "", ssfi = flag2(this, "ssfi"), objType = type(obj).toLowerCase(), nType = type(n).toLowerCase();
  if (doLength && objType !== "map" && objType !== "set") {
    new Assertion(obj, flagMsg, ssfi, true).to.have.property("length");
  }
  if (!doLength && objType === "date" && nType !== "date") {
    throw new AssertionError(
      msgPrefix + "the argument to above must be a date",
      void 0,
      ssfi
    );
  } else if (!isNumeric(n) && (doLength || isNumeric(obj))) {
    throw new AssertionError(
      msgPrefix + "the argument to above must be a number",
      void 0,
      ssfi
    );
  } else if (!doLength && objType !== "date" && !isNumeric(obj)) {
    let printObj = objType === "string" ? "'" + obj + "'" : obj;
    throw new AssertionError(
      msgPrefix + "expected " + printObj + " to be a number or a date",
      void 0,
      ssfi
    );
  }
  if (doLength) {
    let descriptor = "length", itemsCount;
    if (objType === "map" || objType === "set") {
      descriptor = "size";
      itemsCount = obj.size;
    } else {
      itemsCount = obj.length;
    }
    this.assert(
      itemsCount > n,
      "expected #{this} to have a " + descriptor + " above #{exp} but got #{act}",
      "expected #{this} to not have a " + descriptor + " above #{exp}",
      n,
      itemsCount
    );
  } else {
    this.assert(
      obj > n,
      "expected #{this} to be above #{exp}",
      "expected #{this} to be at most #{exp}",
      n
    );
  }
}
__name(assertAbove, "assertAbove");
Assertion.addMethod("above", assertAbove);
Assertion.addMethod("gt", assertAbove);
Assertion.addMethod("greaterThan", assertAbove);
function assertLeast(n, msg) {
  if (msg) flag2(this, "message", msg);
  let obj = flag2(this, "object"), doLength = flag2(this, "doLength"), flagMsg = flag2(this, "message"), msgPrefix = flagMsg ? flagMsg + ": " : "", ssfi = flag2(this, "ssfi"), objType = type(obj).toLowerCase(), nType = type(n).toLowerCase(), errorMessage, shouldThrow = true;
  if (doLength && objType !== "map" && objType !== "set") {
    new Assertion(obj, flagMsg, ssfi, true).to.have.property("length");
  }
  if (!doLength && objType === "date" && nType !== "date") {
    errorMessage = msgPrefix + "the argument to least must be a date";
  } else if (!isNumeric(n) && (doLength || isNumeric(obj))) {
    errorMessage = msgPrefix + "the argument to least must be a number";
  } else if (!doLength && objType !== "date" && !isNumeric(obj)) {
    let printObj = objType === "string" ? "'" + obj + "'" : obj;
    errorMessage = msgPrefix + "expected " + printObj + " to be a number or a date";
  } else {
    shouldThrow = false;
  }
  if (shouldThrow) {
    throw new AssertionError(errorMessage, void 0, ssfi);
  }
  if (doLength) {
    let descriptor = "length", itemsCount;
    if (objType === "map" || objType === "set") {
      descriptor = "size";
      itemsCount = obj.size;
    } else {
      itemsCount = obj.length;
    }
    this.assert(
      itemsCount >= n,
      "expected #{this} to have a " + descriptor + " at least #{exp} but got #{act}",
      "expected #{this} to have a " + descriptor + " below #{exp}",
      n,
      itemsCount
    );
  } else {
    this.assert(
      obj >= n,
      "expected #{this} to be at least #{exp}",
      "expected #{this} to be below #{exp}",
      n
    );
  }
}
__name(assertLeast, "assertLeast");
Assertion.addMethod("least", assertLeast);
Assertion.addMethod("gte", assertLeast);
Assertion.addMethod("greaterThanOrEqual", assertLeast);
function assertBelow(n, msg) {
  if (msg) flag2(this, "message", msg);
  let obj = flag2(this, "object"), doLength = flag2(this, "doLength"), flagMsg = flag2(this, "message"), msgPrefix = flagMsg ? flagMsg + ": " : "", ssfi = flag2(this, "ssfi"), objType = type(obj).toLowerCase(), nType = type(n).toLowerCase(), errorMessage, shouldThrow = true;
  if (doLength && objType !== "map" && objType !== "set") {
    new Assertion(obj, flagMsg, ssfi, true).to.have.property("length");
  }
  if (!doLength && objType === "date" && nType !== "date") {
    errorMessage = msgPrefix + "the argument to below must be a date";
  } else if (!isNumeric(n) && (doLength || isNumeric(obj))) {
    errorMessage = msgPrefix + "the argument to below must be a number";
  } else if (!doLength && objType !== "date" && !isNumeric(obj)) {
    let printObj = objType === "string" ? "'" + obj + "'" : obj;
    errorMessage = msgPrefix + "expected " + printObj + " to be a number or a date";
  } else {
    shouldThrow = false;
  }
  if (shouldThrow) {
    throw new AssertionError(errorMessage, void 0, ssfi);
  }
  if (doLength) {
    let descriptor = "length", itemsCount;
    if (objType === "map" || objType === "set") {
      descriptor = "size";
      itemsCount = obj.size;
    } else {
      itemsCount = obj.length;
    }
    this.assert(
      itemsCount < n,
      "expected #{this} to have a " + descriptor + " below #{exp} but got #{act}",
      "expected #{this} to not have a " + descriptor + " below #{exp}",
      n,
      itemsCount
    );
  } else {
    this.assert(
      obj < n,
      "expected #{this} to be below #{exp}",
      "expected #{this} to be at least #{exp}",
      n
    );
  }
}
__name(assertBelow, "assertBelow");
Assertion.addMethod("below", assertBelow);
Assertion.addMethod("lt", assertBelow);
Assertion.addMethod("lessThan", assertBelow);
function assertMost(n, msg) {
  if (msg) flag2(this, "message", msg);
  let obj = flag2(this, "object"), doLength = flag2(this, "doLength"), flagMsg = flag2(this, "message"), msgPrefix = flagMsg ? flagMsg + ": " : "", ssfi = flag2(this, "ssfi"), objType = type(obj).toLowerCase(), nType = type(n).toLowerCase(), errorMessage, shouldThrow = true;
  if (doLength && objType !== "map" && objType !== "set") {
    new Assertion(obj, flagMsg, ssfi, true).to.have.property("length");
  }
  if (!doLength && objType === "date" && nType !== "date") {
    errorMessage = msgPrefix + "the argument to most must be a date";
  } else if (!isNumeric(n) && (doLength || isNumeric(obj))) {
    errorMessage = msgPrefix + "the argument to most must be a number";
  } else if (!doLength && objType !== "date" && !isNumeric(obj)) {
    let printObj = objType === "string" ? "'" + obj + "'" : obj;
    errorMessage = msgPrefix + "expected " + printObj + " to be a number or a date";
  } else {
    shouldThrow = false;
  }
  if (shouldThrow) {
    throw new AssertionError(errorMessage, void 0, ssfi);
  }
  if (doLength) {
    let descriptor = "length", itemsCount;
    if (objType === "map" || objType === "set") {
      descriptor = "size";
      itemsCount = obj.size;
    } else {
      itemsCount = obj.length;
    }
    this.assert(
      itemsCount <= n,
      "expected #{this} to have a " + descriptor + " at most #{exp} but got #{act}",
      "expected #{this} to have a " + descriptor + " above #{exp}",
      n,
      itemsCount
    );
  } else {
    this.assert(
      obj <= n,
      "expected #{this} to be at most #{exp}",
      "expected #{this} to be above #{exp}",
      n
    );
  }
}
__name(assertMost, "assertMost");
Assertion.addMethod("most", assertMost);
Assertion.addMethod("lte", assertMost);
Assertion.addMethod("lessThanOrEqual", assertMost);
Assertion.addMethod("within", function(start, finish, msg) {
  if (msg) flag2(this, "message", msg);
  let obj = flag2(this, "object"), doLength = flag2(this, "doLength"), flagMsg = flag2(this, "message"), msgPrefix = flagMsg ? flagMsg + ": " : "", ssfi = flag2(this, "ssfi"), objType = type(obj).toLowerCase(), startType = type(start).toLowerCase(), finishType = type(finish).toLowerCase(), errorMessage, shouldThrow = true, range = startType === "date" && finishType === "date" ? start.toISOString() + ".." + finish.toISOString() : start + ".." + finish;
  if (doLength && objType !== "map" && objType !== "set") {
    new Assertion(obj, flagMsg, ssfi, true).to.have.property("length");
  }
  if (!doLength && objType === "date" && (startType !== "date" || finishType !== "date")) {
    errorMessage = msgPrefix + "the arguments to within must be dates";
  } else if ((!isNumeric(start) || !isNumeric(finish)) && (doLength || isNumeric(obj))) {
    errorMessage = msgPrefix + "the arguments to within must be numbers";
  } else if (!doLength && objType !== "date" && !isNumeric(obj)) {
    let printObj = objType === "string" ? "'" + obj + "'" : obj;
    errorMessage = msgPrefix + "expected " + printObj + " to be a number or a date";
  } else {
    shouldThrow = false;
  }
  if (shouldThrow) {
    throw new AssertionError(errorMessage, void 0, ssfi);
  }
  if (doLength) {
    let descriptor = "length", itemsCount;
    if (objType === "map" || objType === "set") {
      descriptor = "size";
      itemsCount = obj.size;
    } else {
      itemsCount = obj.length;
    }
    this.assert(
      itemsCount >= start && itemsCount <= finish,
      "expected #{this} to have a " + descriptor + " within " + range,
      "expected #{this} to not have a " + descriptor + " within " + range
    );
  } else {
    this.assert(
      obj >= start && obj <= finish,
      "expected #{this} to be within " + range,
      "expected #{this} to not be within " + range
    );
  }
});
function assertInstanceOf(constructor, msg) {
  if (msg) flag2(this, "message", msg);
  let target = flag2(this, "object");
  let ssfi = flag2(this, "ssfi");
  let flagMsg = flag2(this, "message");
  let isInstanceOf;
  try {
    isInstanceOf = target instanceof constructor;
  } catch (err) {
    if (err instanceof TypeError) {
      flagMsg = flagMsg ? flagMsg + ": " : "";
      throw new AssertionError(
        flagMsg + "The instanceof assertion needs a constructor but " + type(constructor) + " was given.",
        void 0,
        ssfi
      );
    }
    throw err;
  }
  let name = getName(constructor);
  if (name == null) {
    name = "an unnamed constructor";
  }
  this.assert(
    isInstanceOf,
    "expected #{this} to be an instance of " + name,
    "expected #{this} to not be an instance of " + name
  );
}
__name(assertInstanceOf, "assertInstanceOf");
Assertion.addMethod("instanceof", assertInstanceOf);
Assertion.addMethod("instanceOf", assertInstanceOf);
function assertProperty(name, val, msg) {
  if (msg) flag2(this, "message", msg);
  let isNested = flag2(this, "nested"), isOwn = flag2(this, "own"), flagMsg = flag2(this, "message"), obj = flag2(this, "object"), ssfi = flag2(this, "ssfi"), nameType = typeof name;
  flagMsg = flagMsg ? flagMsg + ": " : "";
  if (isNested) {
    if (nameType !== "string") {
      throw new AssertionError(
        flagMsg + "the argument to property must be a string when using nested syntax",
        void 0,
        ssfi
      );
    }
  } else {
    if (nameType !== "string" && nameType !== "number" && nameType !== "symbol") {
      throw new AssertionError(
        flagMsg + "the argument to property must be a string, number, or symbol",
        void 0,
        ssfi
      );
    }
  }
  if (isNested && isOwn) {
    throw new AssertionError(
      flagMsg + 'The "nested" and "own" flags cannot be combined.',
      void 0,
      ssfi
    );
  }
  if (obj === null || obj === void 0) {
    throw new AssertionError(
      flagMsg + "Target cannot be null or undefined.",
      void 0,
      ssfi
    );
  }
  let isDeep = flag2(this, "deep"), negate = flag2(this, "negate"), pathInfo = isNested ? getPathInfo(obj, name) : null, value = isNested ? pathInfo.value : obj[name], isEql = isDeep ? flag2(this, "eql") : (val1, val2) => val1 === val2;
  let descriptor = "";
  if (isDeep) descriptor += "deep ";
  if (isOwn) descriptor += "own ";
  if (isNested) descriptor += "nested ";
  descriptor += "property ";
  let hasProperty2;
  if (isOwn) hasProperty2 = Object.prototype.hasOwnProperty.call(obj, name);
  else if (isNested) hasProperty2 = pathInfo.exists;
  else hasProperty2 = hasProperty(obj, name);
  if (!negate || arguments.length === 1) {
    this.assert(
      hasProperty2,
      "expected #{this} to have " + descriptor + inspect2(name),
      "expected #{this} to not have " + descriptor + inspect2(name)
    );
  }
  if (arguments.length > 1) {
    this.assert(
      hasProperty2 && isEql(val, value),
      "expected #{this} to have " + descriptor + inspect2(name) + " of #{exp}, but got #{act}",
      "expected #{this} to not have " + descriptor + inspect2(name) + " of #{act}",
      val,
      value
    );
  }
  flag2(this, "object", value);
}
__name(assertProperty, "assertProperty");
Assertion.addMethod("property", assertProperty);
function assertOwnProperty(_name, _value, _msg) {
  flag2(this, "own", true);
  assertProperty.apply(this, arguments);
}
__name(assertOwnProperty, "assertOwnProperty");
Assertion.addMethod("ownProperty", assertOwnProperty);
Assertion.addMethod("haveOwnProperty", assertOwnProperty);
function assertOwnPropertyDescriptor(name, descriptor, msg) {
  if (typeof descriptor === "string") {
    msg = descriptor;
    descriptor = null;
  }
  if (msg) flag2(this, "message", msg);
  let obj = flag2(this, "object");
  let actualDescriptor = Object.getOwnPropertyDescriptor(Object(obj), name);
  let eql = flag2(this, "eql");
  if (actualDescriptor && descriptor) {
    this.assert(
      eql(descriptor, actualDescriptor),
      "expected the own property descriptor for " + inspect2(name) + " on #{this} to match " + inspect2(descriptor) + ", got " + inspect2(actualDescriptor),
      "expected the own property descriptor for " + inspect2(name) + " on #{this} to not match " + inspect2(descriptor),
      descriptor,
      actualDescriptor,
      true
    );
  } else {
    this.assert(
      actualDescriptor,
      "expected #{this} to have an own property descriptor for " + inspect2(name),
      "expected #{this} to not have an own property descriptor for " + inspect2(name)
    );
  }
  flag2(this, "object", actualDescriptor);
}
__name(assertOwnPropertyDescriptor, "assertOwnPropertyDescriptor");
Assertion.addMethod("ownPropertyDescriptor", assertOwnPropertyDescriptor);
Assertion.addMethod("haveOwnPropertyDescriptor", assertOwnPropertyDescriptor);
function assertLengthChain() {
  flag2(this, "doLength", true);
}
__name(assertLengthChain, "assertLengthChain");
function assertLength(n, msg) {
  if (msg) flag2(this, "message", msg);
  let obj = flag2(this, "object"), objType = type(obj).toLowerCase(), flagMsg = flag2(this, "message"), ssfi = flag2(this, "ssfi"), descriptor = "length", itemsCount;
  switch (objType) {
    case "map":
    case "set":
      descriptor = "size";
      itemsCount = obj.size;
      break;
    default:
      new Assertion(obj, flagMsg, ssfi, true).to.have.property("length");
      itemsCount = obj.length;
  }
  this.assert(
    itemsCount == n,
    "expected #{this} to have a " + descriptor + " of #{exp} but got #{act}",
    "expected #{this} to not have a " + descriptor + " of #{act}",
    n,
    itemsCount
  );
}
__name(assertLength, "assertLength");
Assertion.addChainableMethod("length", assertLength, assertLengthChain);
Assertion.addChainableMethod("lengthOf", assertLength, assertLengthChain);
function assertMatch(re, msg) {
  if (msg) flag2(this, "message", msg);
  let obj = flag2(this, "object");
  this.assert(
    re.exec(obj),
    "expected #{this} to match " + re,
    "expected #{this} not to match " + re
  );
}
__name(assertMatch, "assertMatch");
Assertion.addMethod("match", assertMatch);
Assertion.addMethod("matches", assertMatch);
Assertion.addMethod("string", function(str, msg) {
  if (msg) flag2(this, "message", msg);
  let obj = flag2(this, "object"), flagMsg = flag2(this, "message"), ssfi = flag2(this, "ssfi");
  new Assertion(obj, flagMsg, ssfi, true).is.a("string");
  this.assert(
    ~obj.indexOf(str),
    "expected #{this} to contain " + inspect2(str),
    "expected #{this} to not contain " + inspect2(str)
  );
});
function assertKeys(keys) {
  let obj = flag2(this, "object"), objType = type(obj), keysType = type(keys), ssfi = flag2(this, "ssfi"), isDeep = flag2(this, "deep"), str, deepStr = "", actual, ok = true, flagMsg = flag2(this, "message");
  flagMsg = flagMsg ? flagMsg + ": " : "";
  let mixedArgsMsg = flagMsg + "when testing keys against an object or an array you must give a single Array|Object|String argument or multiple String arguments";
  if (objType === "Map" || objType === "Set") {
    deepStr = isDeep ? "deeply " : "";
    actual = [];
    obj.forEach(function(val, key) {
      actual.push(key);
    });
    if (keysType !== "Array") {
      keys = Array.prototype.slice.call(arguments);
    }
  } else {
    actual = getOwnEnumerableProperties(obj);
    switch (keysType) {
      case "Array":
        if (arguments.length > 1) {
          throw new AssertionError(mixedArgsMsg, void 0, ssfi);
        }
        break;
      case "Object":
        if (arguments.length > 1) {
          throw new AssertionError(mixedArgsMsg, void 0, ssfi);
        }
        keys = Object.keys(keys);
        break;
      default:
        keys = Array.prototype.slice.call(arguments);
    }
    keys = keys.map(function(val) {
      return typeof val === "symbol" ? val : String(val);
    });
  }
  if (!keys.length) {
    throw new AssertionError(flagMsg + "keys required", void 0, ssfi);
  }
  let len = keys.length, any = flag2(this, "any"), all = flag2(this, "all"), expected = keys, isEql = isDeep ? flag2(this, "eql") : (val1, val2) => val1 === val2;
  if (!any && !all) {
    all = true;
  }
  if (any) {
    ok = expected.some(function(expectedKey) {
      return actual.some(function(actualKey) {
        return isEql(expectedKey, actualKey);
      });
    });
  }
  if (all) {
    ok = expected.every(function(expectedKey) {
      return actual.some(function(actualKey) {
        return isEql(expectedKey, actualKey);
      });
    });
    if (!flag2(this, "contains")) {
      ok = ok && keys.length == actual.length;
    }
  }
  if (len > 1) {
    keys = keys.map(function(key) {
      return inspect2(key);
    });
    let last = keys.pop();
    if (all) {
      str = keys.join(", ") + ", and " + last;
    }
    if (any) {
      str = keys.join(", ") + ", or " + last;
    }
  } else {
    str = inspect2(keys[0]);
  }
  str = (len > 1 ? "keys " : "key ") + str;
  str = (flag2(this, "contains") ? "contain " : "have ") + str;
  this.assert(
    ok,
    "expected #{this} to " + deepStr + str,
    "expected #{this} to not " + deepStr + str,
    expected.slice(0).sort(compareByInspect),
    actual.sort(compareByInspect),
    true
  );
}
__name(assertKeys, "assertKeys");
Assertion.addMethod("keys", assertKeys);
Assertion.addMethod("key", assertKeys);
function assertThrows(errorLike, errMsgMatcher, msg) {
  if (msg) flag2(this, "message", msg);
  let obj = flag2(this, "object"), ssfi = flag2(this, "ssfi"), flagMsg = flag2(this, "message"), negate = flag2(this, "negate") || false;
  new Assertion(obj, flagMsg, ssfi, true).is.a("function");
  if (isRegExp2(errorLike) || typeof errorLike === "string") {
    errMsgMatcher = errorLike;
    errorLike = null;
  }
  let caughtErr;
  let errorWasThrown = false;
  try {
    obj();
  } catch (err) {
    errorWasThrown = true;
    caughtErr = err;
  }
  let everyArgIsUndefined = errorLike === void 0 && errMsgMatcher === void 0;
  let everyArgIsDefined = Boolean(errorLike && errMsgMatcher);
  let errorLikeFail = false;
  let errMsgMatcherFail = false;
  if (everyArgIsUndefined || !everyArgIsUndefined && !negate) {
    let errorLikeString = "an error";
    if (errorLike instanceof Error) {
      errorLikeString = "#{exp}";
    } else if (errorLike) {
      errorLikeString = check_error_exports.getConstructorName(errorLike);
    }
    let actual = caughtErr;
    if (caughtErr instanceof Error) {
      actual = caughtErr.toString();
    } else if (typeof caughtErr === "string") {
      actual = caughtErr;
    } else if (caughtErr && (typeof caughtErr === "object" || typeof caughtErr === "function")) {
      try {
        actual = check_error_exports.getConstructorName(caughtErr);
      } catch (_err) {
      }
    }
    this.assert(
      errorWasThrown,
      "expected #{this} to throw " + errorLikeString,
      "expected #{this} to not throw an error but #{act} was thrown",
      errorLike && errorLike.toString(),
      actual
    );
  }
  if (errorLike && caughtErr) {
    if (errorLike instanceof Error) {
      let isCompatibleInstance = check_error_exports.compatibleInstance(
        caughtErr,
        errorLike
      );
      if (isCompatibleInstance === negate) {
        if (everyArgIsDefined && negate) {
          errorLikeFail = true;
        } else {
          this.assert(
            negate,
            "expected #{this} to throw #{exp} but #{act} was thrown",
            "expected #{this} to not throw #{exp}" + (caughtErr && !negate ? " but #{act} was thrown" : ""),
            errorLike.toString(),
            caughtErr.toString()
          );
        }
      }
    }
    let isCompatibleConstructor = check_error_exports.compatibleConstructor(
      caughtErr,
      errorLike
    );
    if (isCompatibleConstructor === negate) {
      if (everyArgIsDefined && negate) {
        errorLikeFail = true;
      } else {
        this.assert(
          negate,
          "expected #{this} to throw #{exp} but #{act} was thrown",
          "expected #{this} to not throw #{exp}" + (caughtErr ? " but #{act} was thrown" : ""),
          errorLike instanceof Error ? errorLike.toString() : errorLike && check_error_exports.getConstructorName(errorLike),
          caughtErr instanceof Error ? caughtErr.toString() : caughtErr && check_error_exports.getConstructorName(caughtErr)
        );
      }
    }
  }
  if (caughtErr && errMsgMatcher !== void 0 && errMsgMatcher !== null) {
    let placeholder = "including";
    if (isRegExp2(errMsgMatcher)) {
      placeholder = "matching";
    }
    let isCompatibleMessage = check_error_exports.compatibleMessage(
      caughtErr,
      errMsgMatcher
    );
    if (isCompatibleMessage === negate) {
      if (everyArgIsDefined && negate) {
        errMsgMatcherFail = true;
      } else {
        this.assert(
          negate,
          "expected #{this} to throw error " + placeholder + " #{exp} but got #{act}",
          "expected #{this} to throw error not " + placeholder + " #{exp}",
          errMsgMatcher,
          check_error_exports.getMessage(caughtErr)
        );
      }
    }
  }
  if (errorLikeFail && errMsgMatcherFail) {
    this.assert(
      negate,
      "expected #{this} to throw #{exp} but #{act} was thrown",
      "expected #{this} to not throw #{exp}" + (caughtErr ? " but #{act} was thrown" : ""),
      errorLike instanceof Error ? errorLike.toString() : errorLike && check_error_exports.getConstructorName(errorLike),
      caughtErr instanceof Error ? caughtErr.toString() : caughtErr && check_error_exports.getConstructorName(caughtErr)
    );
  }
  flag2(this, "object", caughtErr);
}
__name(assertThrows, "assertThrows");
Assertion.addMethod("throw", assertThrows);
Assertion.addMethod("throws", assertThrows);
Assertion.addMethod("Throw", assertThrows);
function respondTo(method, msg) {
  if (msg) flag2(this, "message", msg);
  let obj = flag2(this, "object"), itself = flag2(this, "itself"), context = "function" === typeof obj && !itself ? obj.prototype[method] : obj[method];
  this.assert(
    "function" === typeof context,
    "expected #{this} to respond to " + inspect2(method),
    "expected #{this} to not respond to " + inspect2(method)
  );
}
__name(respondTo, "respondTo");
Assertion.addMethod("respondTo", respondTo);
Assertion.addMethod("respondsTo", respondTo);
Assertion.addProperty("itself", function() {
  flag2(this, "itself", true);
});
function satisfy(matcher, msg) {
  if (msg) flag2(this, "message", msg);
  let obj = flag2(this, "object");
  let result = matcher(obj);
  this.assert(
    result,
    "expected #{this} to satisfy " + objDisplay(matcher),
    "expected #{this} to not satisfy" + objDisplay(matcher),
    flag2(this, "negate") ? false : true,
    result
  );
}
__name(satisfy, "satisfy");
Assertion.addMethod("satisfy", satisfy);
Assertion.addMethod("satisfies", satisfy);
function closeTo(expected, delta, msg) {
  if (msg) flag2(this, "message", msg);
  let obj = flag2(this, "object"), flagMsg = flag2(this, "message"), ssfi = flag2(this, "ssfi");
  new Assertion(obj, flagMsg, ssfi, true).is.numeric;
  let message = "A `delta` value is required for `closeTo`";
  if (delta == void 0) {
    throw new AssertionError(
      flagMsg ? `${flagMsg}: ${message}` : message,
      void 0,
      ssfi
    );
  }
  new Assertion(delta, flagMsg, ssfi, true).is.numeric;
  message = "A `expected` value is required for `closeTo`";
  if (expected == void 0) {
    throw new AssertionError(
      flagMsg ? `${flagMsg}: ${message}` : message,
      void 0,
      ssfi
    );
  }
  new Assertion(expected, flagMsg, ssfi, true).is.numeric;
  const abs = /* @__PURE__ */ __name((x) => x < 0n ? -x : x, "abs");
  const strip = /* @__PURE__ */ __name((number) => parseFloat(parseFloat(number).toPrecision(12)), "strip");
  this.assert(
    strip(abs(obj - expected)) <= delta,
    "expected #{this} to be close to " + expected + " +/- " + delta,
    "expected #{this} not to be close to " + expected + " +/- " + delta
  );
}
__name(closeTo, "closeTo");
Assertion.addMethod("closeTo", closeTo);
Assertion.addMethod("approximately", closeTo);
function isSubsetOf(_subset, _superset, cmp, contains, ordered) {
  let superset = Array.from(_superset);
  let subset = Array.from(_subset);
  if (!contains) {
    if (subset.length !== superset.length) return false;
    superset = superset.slice();
  }
  return subset.every(function(elem, idx) {
    if (ordered) return cmp ? cmp(elem, superset[idx]) : elem === superset[idx];
    if (!cmp) {
      let matchIdx = superset.indexOf(elem);
      if (matchIdx === -1) return false;
      if (!contains) superset.splice(matchIdx, 1);
      return true;
    }
    return superset.some(function(elem2, matchIdx) {
      if (!cmp(elem, elem2)) return false;
      if (!contains) superset.splice(matchIdx, 1);
      return true;
    });
  });
}
__name(isSubsetOf, "isSubsetOf");
Assertion.addMethod("members", function(subset, msg) {
  if (msg) flag2(this, "message", msg);
  let obj = flag2(this, "object"), flagMsg = flag2(this, "message"), ssfi = flag2(this, "ssfi");
  new Assertion(obj, flagMsg, ssfi, true).to.be.iterable;
  new Assertion(subset, flagMsg, ssfi, true).to.be.iterable;
  let contains = flag2(this, "contains");
  let ordered = flag2(this, "ordered");
  let subject, failMsg, failNegateMsg;
  if (contains) {
    subject = ordered ? "an ordered superset" : "a superset";
    failMsg = "expected #{this} to be " + subject + " of #{exp}";
    failNegateMsg = "expected #{this} to not be " + subject + " of #{exp}";
  } else {
    subject = ordered ? "ordered members" : "members";
    failMsg = "expected #{this} to have the same " + subject + " as #{exp}";
    failNegateMsg = "expected #{this} to not have the same " + subject + " as #{exp}";
  }
  let cmp = flag2(this, "deep") ? flag2(this, "eql") : void 0;
  this.assert(
    isSubsetOf(subset, obj, cmp, contains, ordered),
    failMsg,
    failNegateMsg,
    subset,
    obj,
    true
  );
});
Assertion.addProperty("iterable", function(msg) {
  if (msg) flag2(this, "message", msg);
  let obj = flag2(this, "object");
  this.assert(
    obj != void 0 && obj[Symbol.iterator],
    "expected #{this} to be an iterable",
    "expected #{this} to not be an iterable",
    obj
  );
});
function oneOf(list, msg) {
  if (msg) flag2(this, "message", msg);
  let expected = flag2(this, "object"), flagMsg = flag2(this, "message"), ssfi = flag2(this, "ssfi"), contains = flag2(this, "contains"), isDeep = flag2(this, "deep"), eql = flag2(this, "eql");
  new Assertion(list, flagMsg, ssfi, true).to.be.an("array");
  if (contains) {
    this.assert(
      list.some(function(possibility) {
        return expected.indexOf(possibility) > -1;
      }),
      "expected #{this} to contain one of #{exp}",
      "expected #{this} to not contain one of #{exp}",
      list,
      expected
    );
  } else {
    if (isDeep) {
      this.assert(
        list.some(function(possibility) {
          return eql(expected, possibility);
        }),
        "expected #{this} to deeply equal one of #{exp}",
        "expected #{this} to deeply equal one of #{exp}",
        list,
        expected
      );
    } else {
      this.assert(
        list.indexOf(expected) > -1,
        "expected #{this} to be one of #{exp}",
        "expected #{this} to not be one of #{exp}",
        list,
        expected
      );
    }
  }
}
__name(oneOf, "oneOf");
Assertion.addMethod("oneOf", oneOf);
function assertChanges(subject, prop, msg) {
  if (msg) flag2(this, "message", msg);
  let fn = flag2(this, "object"), flagMsg = flag2(this, "message"), ssfi = flag2(this, "ssfi");
  new Assertion(fn, flagMsg, ssfi, true).is.a("function");
  let initial;
  if (!prop) {
    new Assertion(subject, flagMsg, ssfi, true).is.a("function");
    initial = subject();
  } else {
    new Assertion(subject, flagMsg, ssfi, true).to.have.property(prop);
    initial = subject[prop];
  }
  fn();
  let final = prop === void 0 || prop === null ? subject() : subject[prop];
  let msgObj = prop === void 0 || prop === null ? initial : "." + prop;
  flag2(this, "deltaMsgObj", msgObj);
  flag2(this, "initialDeltaValue", initial);
  flag2(this, "finalDeltaValue", final);
  flag2(this, "deltaBehavior", "change");
  flag2(this, "realDelta", final !== initial);
  this.assert(
    initial !== final,
    "expected " + msgObj + " to change",
    "expected " + msgObj + " to not change"
  );
}
__name(assertChanges, "assertChanges");
Assertion.addMethod("change", assertChanges);
Assertion.addMethod("changes", assertChanges);
function assertIncreases(subject, prop, msg) {
  if (msg) flag2(this, "message", msg);
  let fn = flag2(this, "object"), flagMsg = flag2(this, "message"), ssfi = flag2(this, "ssfi");
  new Assertion(fn, flagMsg, ssfi, true).is.a("function");
  let initial;
  if (!prop) {
    new Assertion(subject, flagMsg, ssfi, true).is.a("function");
    initial = subject();
  } else {
    new Assertion(subject, flagMsg, ssfi, true).to.have.property(prop);
    initial = subject[prop];
  }
  new Assertion(initial, flagMsg, ssfi, true).is.a("number");
  fn();
  let final = prop === void 0 || prop === null ? subject() : subject[prop];
  let msgObj = prop === void 0 || prop === null ? initial : "." + prop;
  flag2(this, "deltaMsgObj", msgObj);
  flag2(this, "initialDeltaValue", initial);
  flag2(this, "finalDeltaValue", final);
  flag2(this, "deltaBehavior", "increase");
  flag2(this, "realDelta", final - initial);
  this.assert(
    final - initial > 0,
    "expected " + msgObj + " to increase",
    "expected " + msgObj + " to not increase"
  );
}
__name(assertIncreases, "assertIncreases");
Assertion.addMethod("increase", assertIncreases);
Assertion.addMethod("increases", assertIncreases);
function assertDecreases(subject, prop, msg) {
  if (msg) flag2(this, "message", msg);
  let fn = flag2(this, "object"), flagMsg = flag2(this, "message"), ssfi = flag2(this, "ssfi");
  new Assertion(fn, flagMsg, ssfi, true).is.a("function");
  let initial;
  if (!prop) {
    new Assertion(subject, flagMsg, ssfi, true).is.a("function");
    initial = subject();
  } else {
    new Assertion(subject, flagMsg, ssfi, true).to.have.property(prop);
    initial = subject[prop];
  }
  new Assertion(initial, flagMsg, ssfi, true).is.a("number");
  fn();
  let final = prop === void 0 || prop === null ? subject() : subject[prop];
  let msgObj = prop === void 0 || prop === null ? initial : "." + prop;
  flag2(this, "deltaMsgObj", msgObj);
  flag2(this, "initialDeltaValue", initial);
  flag2(this, "finalDeltaValue", final);
  flag2(this, "deltaBehavior", "decrease");
  flag2(this, "realDelta", initial - final);
  this.assert(
    final - initial < 0,
    "expected " + msgObj + " to decrease",
    "expected " + msgObj + " to not decrease"
  );
}
__name(assertDecreases, "assertDecreases");
Assertion.addMethod("decrease", assertDecreases);
Assertion.addMethod("decreases", assertDecreases);
function assertDelta(delta, msg) {
  if (msg) flag2(this, "message", msg);
  let msgObj = flag2(this, "deltaMsgObj");
  let initial = flag2(this, "initialDeltaValue");
  let final = flag2(this, "finalDeltaValue");
  let behavior = flag2(this, "deltaBehavior");
  let realDelta = flag2(this, "realDelta");
  let expression;
  if (behavior === "change") {
    expression = Math.abs(final - initial) === Math.abs(delta);
  } else {
    expression = realDelta === Math.abs(delta);
  }
  this.assert(
    expression,
    "expected " + msgObj + " to " + behavior + " by " + delta,
    "expected " + msgObj + " to not " + behavior + " by " + delta
  );
}
__name(assertDelta, "assertDelta");
Assertion.addMethod("by", assertDelta);
Assertion.addProperty("extensible", function() {
  let obj = flag2(this, "object");
  let isExtensible = obj === Object(obj) && Object.isExtensible(obj);
  this.assert(
    isExtensible,
    "expected #{this} to be extensible",
    "expected #{this} to not be extensible"
  );
});
Assertion.addProperty("sealed", function() {
  let obj = flag2(this, "object");
  let isSealed = obj === Object(obj) ? Object.isSealed(obj) : true;
  this.assert(
    isSealed,
    "expected #{this} to be sealed",
    "expected #{this} to not be sealed"
  );
});
Assertion.addProperty("frozen", function() {
  let obj = flag2(this, "object");
  let isFrozen = obj === Object(obj) ? Object.isFrozen(obj) : true;
  this.assert(
    isFrozen,
    "expected #{this} to be frozen",
    "expected #{this} to not be frozen"
  );
});
Assertion.addProperty("finite", function(_msg) {
  let obj = flag2(this, "object");
  this.assert(
    typeof obj === "number" && isFinite(obj),
    "expected #{this} to be a finite number",
    "expected #{this} to not be a finite number"
  );
});
function compareSubset(expected, actual) {
  if (expected === actual) {
    return true;
  }
  if (typeof actual !== typeof expected) {
    return false;
  }
  if (typeof expected !== "object" || expected === null) {
    return expected === actual;
  }
  if (!actual) {
    return false;
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      return false;
    }
    return expected.every(function(exp) {
      return actual.some(function(act) {
        return compareSubset(exp, act);
      });
    });
  }
  if (expected instanceof Date) {
    if (actual instanceof Date) {
      return expected.getTime() === actual.getTime();
    } else {
      return false;
    }
  }
  return Object.keys(expected).every(function(key) {
    let expectedValue = expected[key];
    let actualValue = actual[key];
    if (typeof expectedValue === "object" && expectedValue !== null && actualValue !== null) {
      return compareSubset(expectedValue, actualValue);
    }
    if (typeof expectedValue === "function") {
      return expectedValue(actualValue);
    }
    return actualValue === expectedValue;
  });
}
__name(compareSubset, "compareSubset");
Assertion.addMethod("containSubset", function(expected) {
  const actual = flag(this, "object");
  const showDiff = config.showDiff;
  this.assert(
    compareSubset(expected, actual),
    "expected #{act} to contain subset #{exp}",
    "expected #{act} to not contain subset #{exp}",
    expected,
    actual,
    showDiff
  );
});
function expect(val, message) {
  return new Assertion(val, message);
}
__name(expect, "expect");
expect.fail = function(actual, expected, message, operator) {
  if (arguments.length < 2) {
    message = actual;
    actual = void 0;
  }
  message = message || "expect.fail()";
  throw new AssertionError(
    message,
    {
      actual,
      expected,
      operator
    },
    expect.fail
  );
};
var should_exports = {};
__export(should_exports, {
  Should: () => Should,
  should: () => should
});
function loadShould() {
  function shouldGetter() {
    if (this instanceof String || this instanceof Number || this instanceof Boolean || typeof Symbol === "function" && this instanceof Symbol || typeof BigInt === "function" && this instanceof BigInt) {
      return new Assertion(this.valueOf(), null, shouldGetter);
    }
    return new Assertion(this, null, shouldGetter);
  }
  __name(shouldGetter, "shouldGetter");
  function shouldSetter(value) {
    Object.defineProperty(this, "should", {
      value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  }
  __name(shouldSetter, "shouldSetter");
  Object.defineProperty(Object.prototype, "should", {
    set: shouldSetter,
    get: shouldGetter,
    configurable: true
  });
  let should2 = {};
  should2.fail = function(actual, expected, message, operator) {
    if (arguments.length < 2) {
      message = actual;
      actual = void 0;
    }
    message = message || "should.fail()";
    throw new AssertionError(
      message,
      {
        actual,
        expected,
        operator
      },
      should2.fail
    );
  };
  should2.equal = function(actual, expected, message) {
    new Assertion(actual, message).to.equal(expected);
  };
  should2.Throw = function(fn, errt, errs, msg) {
    new Assertion(fn, msg).to.Throw(errt, errs);
  };
  should2.exist = function(val, msg) {
    new Assertion(val, msg).to.exist;
  };
  should2.not = {};
  should2.not.equal = function(actual, expected, msg) {
    new Assertion(actual, msg).to.not.equal(expected);
  };
  should2.not.Throw = function(fn, errt, errs, msg) {
    new Assertion(fn, msg).to.not.Throw(errt, errs);
  };
  should2.not.exist = function(val, msg) {
    new Assertion(val, msg).to.not.exist;
  };
  should2["throw"] = should2["Throw"];
  should2.not["throw"] = should2.not["Throw"];
  return should2;
}
__name(loadShould, "loadShould");
var should = loadShould;
var Should = loadShould;
function assert(express, errmsg) {
  let test22 = new Assertion(null, null, assert, true);
  test22.assert(express, errmsg, "[ negation message unavailable ]");
}
__name(assert, "assert");
assert.fail = function(actual, expected, message, operator) {
  if (arguments.length < 2) {
    message = actual;
    actual = void 0;
  }
  message = message || "assert.fail()";
  throw new AssertionError(
    message,
    {
      actual,
      expected,
      operator
    },
    assert.fail
  );
};
assert.isOk = function(val, msg) {
  new Assertion(val, msg, assert.isOk, true).is.ok;
};
assert.isNotOk = function(val, msg) {
  new Assertion(val, msg, assert.isNotOk, true).is.not.ok;
};
assert.equal = function(act, exp, msg) {
  let test22 = new Assertion(act, msg, assert.equal, true);
  test22.assert(
    exp == flag(test22, "object"),
    "expected #{this} to equal #{exp}",
    "expected #{this} to not equal #{act}",
    exp,
    act,
    true
  );
};
assert.notEqual = function(act, exp, msg) {
  let test22 = new Assertion(act, msg, assert.notEqual, true);
  test22.assert(
    exp != flag(test22, "object"),
    "expected #{this} to not equal #{exp}",
    "expected #{this} to equal #{act}",
    exp,
    act,
    true
  );
};
assert.strictEqual = function(act, exp, msg) {
  new Assertion(act, msg, assert.strictEqual, true).to.equal(exp);
};
assert.notStrictEqual = function(act, exp, msg) {
  new Assertion(act, msg, assert.notStrictEqual, true).to.not.equal(exp);
};
assert.deepEqual = assert.deepStrictEqual = function(act, exp, msg) {
  new Assertion(act, msg, assert.deepEqual, true).to.eql(exp);
};
assert.notDeepEqual = function(act, exp, msg) {
  new Assertion(act, msg, assert.notDeepEqual, true).to.not.eql(exp);
};
assert.isAbove = function(val, abv, msg) {
  new Assertion(val, msg, assert.isAbove, true).to.be.above(abv);
};
assert.isAtLeast = function(val, atlst, msg) {
  new Assertion(val, msg, assert.isAtLeast, true).to.be.least(atlst);
};
assert.isBelow = function(val, blw, msg) {
  new Assertion(val, msg, assert.isBelow, true).to.be.below(blw);
};
assert.isAtMost = function(val, atmst, msg) {
  new Assertion(val, msg, assert.isAtMost, true).to.be.most(atmst);
};
assert.isTrue = function(val, msg) {
  new Assertion(val, msg, assert.isTrue, true).is["true"];
};
assert.isNotTrue = function(val, msg) {
  new Assertion(val, msg, assert.isNotTrue, true).to.not.equal(true);
};
assert.isFalse = function(val, msg) {
  new Assertion(val, msg, assert.isFalse, true).is["false"];
};
assert.isNotFalse = function(val, msg) {
  new Assertion(val, msg, assert.isNotFalse, true).to.not.equal(false);
};
assert.isNull = function(val, msg) {
  new Assertion(val, msg, assert.isNull, true).to.equal(null);
};
assert.isNotNull = function(val, msg) {
  new Assertion(val, msg, assert.isNotNull, true).to.not.equal(null);
};
assert.isNaN = function(val, msg) {
  new Assertion(val, msg, assert.isNaN, true).to.be.NaN;
};
assert.isNotNaN = function(value, message) {
  new Assertion(value, message, assert.isNotNaN, true).not.to.be.NaN;
};
assert.exists = function(val, msg) {
  new Assertion(val, msg, assert.exists, true).to.exist;
};
assert.notExists = function(val, msg) {
  new Assertion(val, msg, assert.notExists, true).to.not.exist;
};
assert.isUndefined = function(val, msg) {
  new Assertion(val, msg, assert.isUndefined, true).to.equal(void 0);
};
assert.isDefined = function(val, msg) {
  new Assertion(val, msg, assert.isDefined, true).to.not.equal(void 0);
};
assert.isCallable = function(value, message) {
  new Assertion(value, message, assert.isCallable, true).is.callable;
};
assert.isNotCallable = function(value, message) {
  new Assertion(value, message, assert.isNotCallable, true).is.not.callable;
};
assert.isObject = function(val, msg) {
  new Assertion(val, msg, assert.isObject, true).to.be.a("object");
};
assert.isNotObject = function(val, msg) {
  new Assertion(val, msg, assert.isNotObject, true).to.not.be.a("object");
};
assert.isArray = function(val, msg) {
  new Assertion(val, msg, assert.isArray, true).to.be.an("array");
};
assert.isNotArray = function(val, msg) {
  new Assertion(val, msg, assert.isNotArray, true).to.not.be.an("array");
};
assert.isString = function(val, msg) {
  new Assertion(val, msg, assert.isString, true).to.be.a("string");
};
assert.isNotString = function(val, msg) {
  new Assertion(val, msg, assert.isNotString, true).to.not.be.a("string");
};
assert.isNumber = function(val, msg) {
  new Assertion(val, msg, assert.isNumber, true).to.be.a("number");
};
assert.isNotNumber = function(val, msg) {
  new Assertion(val, msg, assert.isNotNumber, true).to.not.be.a("number");
};
assert.isNumeric = function(val, msg) {
  new Assertion(val, msg, assert.isNumeric, true).is.numeric;
};
assert.isNotNumeric = function(val, msg) {
  new Assertion(val, msg, assert.isNotNumeric, true).is.not.numeric;
};
assert.isFinite = function(val, msg) {
  new Assertion(val, msg, assert.isFinite, true).to.be.finite;
};
assert.isBoolean = function(val, msg) {
  new Assertion(val, msg, assert.isBoolean, true).to.be.a("boolean");
};
assert.isNotBoolean = function(val, msg) {
  new Assertion(val, msg, assert.isNotBoolean, true).to.not.be.a("boolean");
};
assert.typeOf = function(val, type3, msg) {
  new Assertion(val, msg, assert.typeOf, true).to.be.a(type3);
};
assert.notTypeOf = function(value, type3, message) {
  new Assertion(value, message, assert.notTypeOf, true).to.not.be.a(type3);
};
assert.instanceOf = function(val, type3, msg) {
  new Assertion(val, msg, assert.instanceOf, true).to.be.instanceOf(type3);
};
assert.notInstanceOf = function(val, type3, msg) {
  new Assertion(val, msg, assert.notInstanceOf, true).to.not.be.instanceOf(
    type3
  );
};
assert.include = function(exp, inc, msg) {
  new Assertion(exp, msg, assert.include, true).include(inc);
};
assert.notInclude = function(exp, inc, msg) {
  new Assertion(exp, msg, assert.notInclude, true).not.include(inc);
};
assert.deepInclude = function(exp, inc, msg) {
  new Assertion(exp, msg, assert.deepInclude, true).deep.include(inc);
};
assert.notDeepInclude = function(exp, inc, msg) {
  new Assertion(exp, msg, assert.notDeepInclude, true).not.deep.include(inc);
};
assert.nestedInclude = function(exp, inc, msg) {
  new Assertion(exp, msg, assert.nestedInclude, true).nested.include(inc);
};
assert.notNestedInclude = function(exp, inc, msg) {
  new Assertion(exp, msg, assert.notNestedInclude, true).not.nested.include(
    inc
  );
};
assert.deepNestedInclude = function(exp, inc, msg) {
  new Assertion(exp, msg, assert.deepNestedInclude, true).deep.nested.include(
    inc
  );
};
assert.notDeepNestedInclude = function(exp, inc, msg) {
  new Assertion(
    exp,
    msg,
    assert.notDeepNestedInclude,
    true
  ).not.deep.nested.include(inc);
};
assert.ownInclude = function(exp, inc, msg) {
  new Assertion(exp, msg, assert.ownInclude, true).own.include(inc);
};
assert.notOwnInclude = function(exp, inc, msg) {
  new Assertion(exp, msg, assert.notOwnInclude, true).not.own.include(inc);
};
assert.deepOwnInclude = function(exp, inc, msg) {
  new Assertion(exp, msg, assert.deepOwnInclude, true).deep.own.include(inc);
};
assert.notDeepOwnInclude = function(exp, inc, msg) {
  new Assertion(exp, msg, assert.notDeepOwnInclude, true).not.deep.own.include(
    inc
  );
};
assert.match = function(exp, re, msg) {
  new Assertion(exp, msg, assert.match, true).to.match(re);
};
assert.notMatch = function(exp, re, msg) {
  new Assertion(exp, msg, assert.notMatch, true).to.not.match(re);
};
assert.property = function(obj, prop, msg) {
  new Assertion(obj, msg, assert.property, true).to.have.property(prop);
};
assert.notProperty = function(obj, prop, msg) {
  new Assertion(obj, msg, assert.notProperty, true).to.not.have.property(prop);
};
assert.propertyVal = function(obj, prop, val, msg) {
  new Assertion(obj, msg, assert.propertyVal, true).to.have.property(prop, val);
};
assert.notPropertyVal = function(obj, prop, val, msg) {
  new Assertion(obj, msg, assert.notPropertyVal, true).to.not.have.property(
    prop,
    val
  );
};
assert.deepPropertyVal = function(obj, prop, val, msg) {
  new Assertion(obj, msg, assert.deepPropertyVal, true).to.have.deep.property(
    prop,
    val
  );
};
assert.notDeepPropertyVal = function(obj, prop, val, msg) {
  new Assertion(
    obj,
    msg,
    assert.notDeepPropertyVal,
    true
  ).to.not.have.deep.property(prop, val);
};
assert.ownProperty = function(obj, prop, msg) {
  new Assertion(obj, msg, assert.ownProperty, true).to.have.own.property(prop);
};
assert.notOwnProperty = function(obj, prop, msg) {
  new Assertion(obj, msg, assert.notOwnProperty, true).to.not.have.own.property(
    prop
  );
};
assert.ownPropertyVal = function(obj, prop, value, msg) {
  new Assertion(obj, msg, assert.ownPropertyVal, true).to.have.own.property(
    prop,
    value
  );
};
assert.notOwnPropertyVal = function(obj, prop, value, msg) {
  new Assertion(
    obj,
    msg,
    assert.notOwnPropertyVal,
    true
  ).to.not.have.own.property(prop, value);
};
assert.deepOwnPropertyVal = function(obj, prop, value, msg) {
  new Assertion(
    obj,
    msg,
    assert.deepOwnPropertyVal,
    true
  ).to.have.deep.own.property(prop, value);
};
assert.notDeepOwnPropertyVal = function(obj, prop, value, msg) {
  new Assertion(
    obj,
    msg,
    assert.notDeepOwnPropertyVal,
    true
  ).to.not.have.deep.own.property(prop, value);
};
assert.nestedProperty = function(obj, prop, msg) {
  new Assertion(obj, msg, assert.nestedProperty, true).to.have.nested.property(
    prop
  );
};
assert.notNestedProperty = function(obj, prop, msg) {
  new Assertion(
    obj,
    msg,
    assert.notNestedProperty,
    true
  ).to.not.have.nested.property(prop);
};
assert.nestedPropertyVal = function(obj, prop, val, msg) {
  new Assertion(
    obj,
    msg,
    assert.nestedPropertyVal,
    true
  ).to.have.nested.property(prop, val);
};
assert.notNestedPropertyVal = function(obj, prop, val, msg) {
  new Assertion(
    obj,
    msg,
    assert.notNestedPropertyVal,
    true
  ).to.not.have.nested.property(prop, val);
};
assert.deepNestedPropertyVal = function(obj, prop, val, msg) {
  new Assertion(
    obj,
    msg,
    assert.deepNestedPropertyVal,
    true
  ).to.have.deep.nested.property(prop, val);
};
assert.notDeepNestedPropertyVal = function(obj, prop, val, msg) {
  new Assertion(
    obj,
    msg,
    assert.notDeepNestedPropertyVal,
    true
  ).to.not.have.deep.nested.property(prop, val);
};
assert.lengthOf = function(exp, len, msg) {
  new Assertion(exp, msg, assert.lengthOf, true).to.have.lengthOf(len);
};
assert.hasAnyKeys = function(obj, keys, msg) {
  new Assertion(obj, msg, assert.hasAnyKeys, true).to.have.any.keys(keys);
};
assert.hasAllKeys = function(obj, keys, msg) {
  new Assertion(obj, msg, assert.hasAllKeys, true).to.have.all.keys(keys);
};
assert.containsAllKeys = function(obj, keys, msg) {
  new Assertion(obj, msg, assert.containsAllKeys, true).to.contain.all.keys(
    keys
  );
};
assert.doesNotHaveAnyKeys = function(obj, keys, msg) {
  new Assertion(obj, msg, assert.doesNotHaveAnyKeys, true).to.not.have.any.keys(
    keys
  );
};
assert.doesNotHaveAllKeys = function(obj, keys, msg) {
  new Assertion(obj, msg, assert.doesNotHaveAllKeys, true).to.not.have.all.keys(
    keys
  );
};
assert.hasAnyDeepKeys = function(obj, keys, msg) {
  new Assertion(obj, msg, assert.hasAnyDeepKeys, true).to.have.any.deep.keys(
    keys
  );
};
assert.hasAllDeepKeys = function(obj, keys, msg) {
  new Assertion(obj, msg, assert.hasAllDeepKeys, true).to.have.all.deep.keys(
    keys
  );
};
assert.containsAllDeepKeys = function(obj, keys, msg) {
  new Assertion(
    obj,
    msg,
    assert.containsAllDeepKeys,
    true
  ).to.contain.all.deep.keys(keys);
};
assert.doesNotHaveAnyDeepKeys = function(obj, keys, msg) {
  new Assertion(
    obj,
    msg,
    assert.doesNotHaveAnyDeepKeys,
    true
  ).to.not.have.any.deep.keys(keys);
};
assert.doesNotHaveAllDeepKeys = function(obj, keys, msg) {
  new Assertion(
    obj,
    msg,
    assert.doesNotHaveAllDeepKeys,
    true
  ).to.not.have.all.deep.keys(keys);
};
assert.throws = function(fn, errorLike, errMsgMatcher, msg) {
  if ("string" === typeof errorLike || errorLike instanceof RegExp) {
    errMsgMatcher = errorLike;
    errorLike = null;
  }
  let assertErr = new Assertion(fn, msg, assert.throws, true).to.throw(
    errorLike,
    errMsgMatcher
  );
  return flag(assertErr, "object");
};
assert.doesNotThrow = function(fn, errorLike, errMsgMatcher, message) {
  if ("string" === typeof errorLike || errorLike instanceof RegExp) {
    errMsgMatcher = errorLike;
    errorLike = null;
  }
  new Assertion(fn, message, assert.doesNotThrow, true).to.not.throw(
    errorLike,
    errMsgMatcher
  );
};
assert.operator = function(val, operator, val2, msg) {
  let ok;
  switch (operator) {
    case "==":
      ok = val == val2;
      break;
    case "===":
      ok = val === val2;
      break;
    case ">":
      ok = val > val2;
      break;
    case ">=":
      ok = val >= val2;
      break;
    case "<":
      ok = val < val2;
      break;
    case "<=":
      ok = val <= val2;
      break;
    case "!=":
      ok = val != val2;
      break;
    case "!==":
      ok = val !== val2;
      break;
    default:
      msg = msg ? msg + ": " : msg;
      throw new AssertionError(
        msg + 'Invalid operator "' + operator + '"',
        void 0,
        assert.operator
      );
  }
  let test22 = new Assertion(ok, msg, assert.operator, true);
  test22.assert(
    true === flag(test22, "object"),
    "expected " + inspect2(val) + " to be " + operator + " " + inspect2(val2),
    "expected " + inspect2(val) + " to not be " + operator + " " + inspect2(val2)
  );
};
assert.closeTo = function(act, exp, delta, msg) {
  new Assertion(act, msg, assert.closeTo, true).to.be.closeTo(exp, delta);
};
assert.approximately = function(act, exp, delta, msg) {
  new Assertion(act, msg, assert.approximately, true).to.be.approximately(
    exp,
    delta
  );
};
assert.sameMembers = function(set1, set2, msg) {
  new Assertion(set1, msg, assert.sameMembers, true).to.have.same.members(set2);
};
assert.notSameMembers = function(set1, set2, msg) {
  new Assertion(
    set1,
    msg,
    assert.notSameMembers,
    true
  ).to.not.have.same.members(set2);
};
assert.sameDeepMembers = function(set1, set2, msg) {
  new Assertion(
    set1,
    msg,
    assert.sameDeepMembers,
    true
  ).to.have.same.deep.members(set2);
};
assert.notSameDeepMembers = function(set1, set2, msg) {
  new Assertion(
    set1,
    msg,
    assert.notSameDeepMembers,
    true
  ).to.not.have.same.deep.members(set2);
};
assert.sameOrderedMembers = function(set1, set2, msg) {
  new Assertion(
    set1,
    msg,
    assert.sameOrderedMembers,
    true
  ).to.have.same.ordered.members(set2);
};
assert.notSameOrderedMembers = function(set1, set2, msg) {
  new Assertion(
    set1,
    msg,
    assert.notSameOrderedMembers,
    true
  ).to.not.have.same.ordered.members(set2);
};
assert.sameDeepOrderedMembers = function(set1, set2, msg) {
  new Assertion(
    set1,
    msg,
    assert.sameDeepOrderedMembers,
    true
  ).to.have.same.deep.ordered.members(set2);
};
assert.notSameDeepOrderedMembers = function(set1, set2, msg) {
  new Assertion(
    set1,
    msg,
    assert.notSameDeepOrderedMembers,
    true
  ).to.not.have.same.deep.ordered.members(set2);
};
assert.includeMembers = function(superset, subset, msg) {
  new Assertion(superset, msg, assert.includeMembers, true).to.include.members(
    subset
  );
};
assert.notIncludeMembers = function(superset, subset, msg) {
  new Assertion(
    superset,
    msg,
    assert.notIncludeMembers,
    true
  ).to.not.include.members(subset);
};
assert.includeDeepMembers = function(superset, subset, msg) {
  new Assertion(
    superset,
    msg,
    assert.includeDeepMembers,
    true
  ).to.include.deep.members(subset);
};
assert.notIncludeDeepMembers = function(superset, subset, msg) {
  new Assertion(
    superset,
    msg,
    assert.notIncludeDeepMembers,
    true
  ).to.not.include.deep.members(subset);
};
assert.includeOrderedMembers = function(superset, subset, msg) {
  new Assertion(
    superset,
    msg,
    assert.includeOrderedMembers,
    true
  ).to.include.ordered.members(subset);
};
assert.notIncludeOrderedMembers = function(superset, subset, msg) {
  new Assertion(
    superset,
    msg,
    assert.notIncludeOrderedMembers,
    true
  ).to.not.include.ordered.members(subset);
};
assert.includeDeepOrderedMembers = function(superset, subset, msg) {
  new Assertion(
    superset,
    msg,
    assert.includeDeepOrderedMembers,
    true
  ).to.include.deep.ordered.members(subset);
};
assert.notIncludeDeepOrderedMembers = function(superset, subset, msg) {
  new Assertion(
    superset,
    msg,
    assert.notIncludeDeepOrderedMembers,
    true
  ).to.not.include.deep.ordered.members(subset);
};
assert.oneOf = function(inList, list, msg) {
  new Assertion(inList, msg, assert.oneOf, true).to.be.oneOf(list);
};
assert.isIterable = function(obj, msg) {
  if (obj == void 0 || !obj[Symbol.iterator]) {
    msg = msg ? `${msg} expected ${inspect2(obj)} to be an iterable` : `expected ${inspect2(obj)} to be an iterable`;
    throw new AssertionError(msg, void 0, assert.isIterable);
  }
};
assert.changes = function(fn, obj, prop, msg) {
  if (arguments.length === 3 && typeof obj === "function") {
    msg = prop;
    prop = null;
  }
  new Assertion(fn, msg, assert.changes, true).to.change(obj, prop);
};
assert.changesBy = function(fn, obj, prop, delta, msg) {
  if (arguments.length === 4 && typeof obj === "function") {
    let tmpMsg = delta;
    delta = prop;
    msg = tmpMsg;
  } else if (arguments.length === 3) {
    delta = prop;
    prop = null;
  }
  new Assertion(fn, msg, assert.changesBy, true).to.change(obj, prop).by(delta);
};
assert.doesNotChange = function(fn, obj, prop, msg) {
  if (arguments.length === 3 && typeof obj === "function") {
    msg = prop;
    prop = null;
  }
  return new Assertion(fn, msg, assert.doesNotChange, true).to.not.change(
    obj,
    prop
  );
};
assert.changesButNotBy = function(fn, obj, prop, delta, msg) {
  if (arguments.length === 4 && typeof obj === "function") {
    let tmpMsg = delta;
    delta = prop;
    msg = tmpMsg;
  } else if (arguments.length === 3) {
    delta = prop;
    prop = null;
  }
  new Assertion(fn, msg, assert.changesButNotBy, true).to.change(obj, prop).but.not.by(delta);
};
assert.increases = function(fn, obj, prop, msg) {
  if (arguments.length === 3 && typeof obj === "function") {
    msg = prop;
    prop = null;
  }
  return new Assertion(fn, msg, assert.increases, true).to.increase(obj, prop);
};
assert.increasesBy = function(fn, obj, prop, delta, msg) {
  if (arguments.length === 4 && typeof obj === "function") {
    let tmpMsg = delta;
    delta = prop;
    msg = tmpMsg;
  } else if (arguments.length === 3) {
    delta = prop;
    prop = null;
  }
  new Assertion(fn, msg, assert.increasesBy, true).to.increase(obj, prop).by(delta);
};
assert.doesNotIncrease = function(fn, obj, prop, msg) {
  if (arguments.length === 3 && typeof obj === "function") {
    msg = prop;
    prop = null;
  }
  return new Assertion(fn, msg, assert.doesNotIncrease, true).to.not.increase(
    obj,
    prop
  );
};
assert.increasesButNotBy = function(fn, obj, prop, delta, msg) {
  if (arguments.length === 4 && typeof obj === "function") {
    let tmpMsg = delta;
    delta = prop;
    msg = tmpMsg;
  } else if (arguments.length === 3) {
    delta = prop;
    prop = null;
  }
  new Assertion(fn, msg, assert.increasesButNotBy, true).to.increase(obj, prop).but.not.by(delta);
};
assert.decreases = function(fn, obj, prop, msg) {
  if (arguments.length === 3 && typeof obj === "function") {
    msg = prop;
    prop = null;
  }
  return new Assertion(fn, msg, assert.decreases, true).to.decrease(obj, prop);
};
assert.decreasesBy = function(fn, obj, prop, delta, msg) {
  if (arguments.length === 4 && typeof obj === "function") {
    let tmpMsg = delta;
    delta = prop;
    msg = tmpMsg;
  } else if (arguments.length === 3) {
    delta = prop;
    prop = null;
  }
  new Assertion(fn, msg, assert.decreasesBy, true).to.decrease(obj, prop).by(delta);
};
assert.doesNotDecrease = function(fn, obj, prop, msg) {
  if (arguments.length === 3 && typeof obj === "function") {
    msg = prop;
    prop = null;
  }
  return new Assertion(fn, msg, assert.doesNotDecrease, true).to.not.decrease(
    obj,
    prop
  );
};
assert.doesNotDecreaseBy = function(fn, obj, prop, delta, msg) {
  if (arguments.length === 4 && typeof obj === "function") {
    let tmpMsg = delta;
    delta = prop;
    msg = tmpMsg;
  } else if (arguments.length === 3) {
    delta = prop;
    prop = null;
  }
  return new Assertion(fn, msg, assert.doesNotDecreaseBy, true).to.not.decrease(obj, prop).by(delta);
};
assert.decreasesButNotBy = function(fn, obj, prop, delta, msg) {
  if (arguments.length === 4 && typeof obj === "function") {
    let tmpMsg = delta;
    delta = prop;
    msg = tmpMsg;
  } else if (arguments.length === 3) {
    delta = prop;
    prop = null;
  }
  new Assertion(fn, msg, assert.decreasesButNotBy, true).to.decrease(obj, prop).but.not.by(delta);
};
assert.ifError = function(val) {
  if (val) {
    throw val;
  }
};
assert.isExtensible = function(obj, msg) {
  new Assertion(obj, msg, assert.isExtensible, true).to.be.extensible;
};
assert.isNotExtensible = function(obj, msg) {
  new Assertion(obj, msg, assert.isNotExtensible, true).to.not.be.extensible;
};
assert.isSealed = function(obj, msg) {
  new Assertion(obj, msg, assert.isSealed, true).to.be.sealed;
};
assert.isNotSealed = function(obj, msg) {
  new Assertion(obj, msg, assert.isNotSealed, true).to.not.be.sealed;
};
assert.isFrozen = function(obj, msg) {
  new Assertion(obj, msg, assert.isFrozen, true).to.be.frozen;
};
assert.isNotFrozen = function(obj, msg) {
  new Assertion(obj, msg, assert.isNotFrozen, true).to.not.be.frozen;
};
assert.isEmpty = function(val, msg) {
  new Assertion(val, msg, assert.isEmpty, true).to.be.empty;
};
assert.isNotEmpty = function(val, msg) {
  new Assertion(val, msg, assert.isNotEmpty, true).to.not.be.empty;
};
assert.containsSubset = function(val, exp, msg) {
  new Assertion(val, msg).to.containSubset(exp);
};
assert.doesNotContainSubset = function(val, exp, msg) {
  new Assertion(val, msg).to.not.containSubset(exp);
};
var aliases = [
  ["isOk", "ok"],
  ["isNotOk", "notOk"],
  ["throws", "throw"],
  ["throws", "Throw"],
  ["isExtensible", "extensible"],
  ["isNotExtensible", "notExtensible"],
  ["isSealed", "sealed"],
  ["isNotSealed", "notSealed"],
  ["isFrozen", "frozen"],
  ["isNotFrozen", "notFrozen"],
  ["isEmpty", "empty"],
  ["isNotEmpty", "notEmpty"],
  ["isCallable", "isFunction"],
  ["isNotCallable", "isNotFunction"],
  ["containsSubset", "containSubset"]
];
for (const [name, as] of aliases) {
  assert[as] = assert[name];
}
var used = [];
function use(fn) {
  const exports = {
    use,
    AssertionError,
    util: utils_exports,
    config,
    expect,
    assert,
    Assertion,
    ...should_exports
  };
  if (!~used.indexOf(fn)) {
    fn(exports, utils_exports);
    used.push(fn);
  }
  return exports;
}
__name(use, "use");

// src/gpu/256bit/types.wgsl
var types_default = "// types.wgsl\n\n// Represents a 256-bit integer as 8 32-bit limbs (little-endian)\n// limbs[0] = least significant 32 bits\nstruct Limbs256 {\n    limbs: array<u32, 8>       // limbs[0] = least significant 32 bits\n};\n\n// Represents a zero limbed 256-bit integer as 8 32-bit limbs (little-endian) all zeros\nconst IDENTITY_LIMBS_256: Limbs256 = Limbs256(\n    array<u32, 8>(0u, 0u, 0u, 0u, 0u, 0u, 0u, 0u)\n);\n\n// Represents a point in affine coordinates over a 256-bit field\n// x, y coordinates are in Montgomery form\nstruct Point256 {\n    x: Limbs256,                // x-coordinate of the point\n    y: Limbs256                 // y-coordinate of the point\n};\n\n// Represents a point in projective coordinates over a 256-bit field\n// x, y, z are in Montgomery form\n// Point at infinity if Z = 0\nstruct ProjectivePoint256 {\n    x: Limbs256,                // Projective x coordinate\n    y: Limbs256,                // Projective y coordinate\n    z: Limbs256                 // Projective z coordinate (point at infinity if z = 0)\n};\n\n// Represents the parameters of a 256-bit elliptic curve\n// p      : prime modulus of the field\n// r2     : R\xB2 mod p, for Montgomery conversion\n// mont_inv32 : -p\u207B\xB9 mod 2^32 for Montgomery reduction\n// a, b   : curve coefficients\n// p_minus_2  : p - 2, used for modular inverse via Fermat's little theorem\n// r_mod_p : Montgomery representation of 1 (R mod p), used to initialize Z in projective points\nstruct Curve256 {\n    p: array<u32, 8>,          // Prime modulus of the curve (field size)\n    r2: array<u32, 8>,         // R\xB2 mod p, used for converting numbers into Montgomery form\n    mont_inv32: u32,           // -p\u207B\xB9 mod 2^32, used in Montgomery reduction\n    a: array<u32, 8>,          // Curve coefficient 'a' in the equation y\xB2 = x\xB3 + a*x + b\n    b: array<u32, 8>,          // Curve coefficient 'b' in the equation y\xB2 = x\xB3 + a*x + b\n    p_minus_2: array<u32, 8>,   // p - 2, for computing modular inverse: a^(-1) = a^(p-2) mod p\n    r_mod_p: array<u32, 8>     // Montgomery representation of 1 (R mod p), for initializing Z in projective points\n};";

// src/gpu/256bit/arithmetic.wgsl
var arithmetic_default = "// arithmetic.wgsl\n\n// @import types.wgsl\n\n// Compare two 256-bit integers\n// Inputs: a, b : 256-bit integers\n// Output: true if a >= b\n// Path: compare most significant limb first, stop at first difference\nfn gte_256(a: array<u32, 8>, b: array<u32, 8>) -> bool {\n    var i: i32 = 7;\n    loop {\n        if (i < 0) { break; }\n        if (a[i] > b[i]) { return true; }\n        if (a[i] < b[i]) { return false; }\n        i = i - 1;\n    }\n    return true;\n}\n\n// Subtract two 256-bit integers without underflow\n// Inputs: a, b : 256-bit integers\n// Output: result = a - b (wraparound prevented)\n// Formula: result[i] = a[i] - b[i] - borrow_from_previous\n// borrow = 1 if previous subtraction underflowed, 0 otherwise\nfn sub_no_borrow_256(a: array<u32, 8>, b: array<u32, 8>) -> array<u32, 8> {\n    var result: array<u32, 8>;\n    var borrow: u32 = 0u;\n\n    for (var i = 0u; i < 8u; i = i + 1u) {\n        let ai = a[i];\n        let bi = b[i];\n        // Two-step subtraction avoids the bi+borrow u32 overflow when bi=0xFFFFFFFF\n        // and borrow=1 (which wraps to 0 and silently drops the carry).\n        let sub1 = ai - bi;\n        let borrow1 = u32(ai < bi);\n        let sub2 = sub1 - borrow;\n        let borrow2 = u32(sub1 < borrow);\n        result[i] = sub2;\n        borrow = borrow1 + borrow2; // always 0 or 1 (never 2)\n    }\n\n    return result;\n}\n\n// Modular addition: (a + b) mod p\n// Inputs: a, b : 256-bit integers; p : modulus\n// Output: (a + b) mod p\n// Path: limb-wise addition with carry; subtract p if result >= p\nfn add_mod_256(a: array<u32, 8>, b: array<u32, 8>, p: array<u32, 8>) -> array<u32, 8> {\n    var result: array<u32, 8>;\n    var carry: u32 = 0u;\n    \n    for (var i = 0u; i < 8u; i = i + 1u) {\n        let sum_low = a[i] + b[i];\n        let carry_from_low = u32(sum_low < a[i]);\n        \n        let sum_with_carry = sum_low + carry;\n        let carry_from_carry = u32(sum_with_carry < sum_low);\n        \n        result[i] = sum_with_carry;\n        carry = carry_from_low + carry_from_carry;\n    }\n    \n    if (carry != 0u || gte_256(result, p)) {\n        result = sub_no_borrow_256(result, p);\n    }\n    \n    return result;\n}\n\n// Modular subtraction: (a - b) mod p\n// Inputs: a, b : 256-bit integers; p : modulus\n// Output: (a - b) mod p\n// Path: if a >= b, result = a - b; else result = p - (b - a)\nfn sub_mod_256(a: array<u32, 8>, b: array<u32, 8>, p: array<u32, 8>) -> array<u32, 8> {\n    if (gte_256(a, b)) {\n        return sub_no_borrow_256(a, b);\n    } else {\n        let diff = sub_no_borrow_256(b, a);\n        return sub_no_borrow_256(p, diff);\n    }\n}\n\n// Multiply two 32-bit integers and accumulate with carry\n// Inputs: a, b : u32 integers; acc : current limb value; carry : propagated carry\n// Output: updated limb = (a*b + acc + *carry) mod 2^32\n// Path: split a, b into high/low 16-bit halves, compute cross-products, propagate carry\nfn mul_add_carry(a: u32, b: u32, acc: u32, carry: ptr<function, u32>) -> u32 {\n    let a_lo = a & 0xFFFFu;\n    let a_hi = a >> 16u;\n    let b_lo = b & 0xFFFFu;\n    let b_hi = b >> 16u;\n\n    let p0 = a_lo * b_lo;\n    let p1 = a_lo * b_hi;\n    let p2 = a_hi * b_lo;\n    let p3 = a_hi * b_hi;\n\n    // Combine middle terms\n    let mid = p1 + p2;\n    let mid_carry = u32(mid < p1);\n\n    // Add lower 16 bits of mid to low part\n    let low = p0 + (mid << 16u);\n    let low_carry = u32(low < p0);\n\n    // Compute high 32-bit including previous carries\n    // mid_carry needs to be at bit position 32 (upper 16 bits of the high word)\n    let high = p3 + (mid >> 16u) + (mid_carry << 16u) + low_carry;\n\n    // Add acc\n    let temp = low + acc;\n    let temp_carry = u32(temp < low);\n\n    // Add existing carry\n    let final_res = temp + *carry;\n    let final_carry = u32(final_res < temp);\n\n    // Update carry\n    *carry = high + temp_carry + final_carry;\n\n    return final_res;\n}\n\n// Montgomery reduction: REDC(T) = T * R^-1 mod p\n// Inputs:\n//   t          : 512-bit integer (16 u32 limbs)\n//   mont_inv32 : -p\u207B\xB9 mod 2^32\n//   p          : prime modulus\n// Output: 256-bit integer = T * R^-1 mod p\n// Path:\n//   For each limb i of t:\n//     m = t[i] * mont_inv32\n//     temp += m * p -> t[i] becomes 0\n//   Upper 256 bits = result\n//   If result >= p, subtract p\nfn montgomery_reduce_256(t: array<u32, 16>, mont_inv32: u32, p: array<u32, 8>) -> array<u32, 8> {\n    var temp = t;\n    \n    // Montgomery reduction loop\n    for (var i = 0u; i < 8u; i = i + 1u) {\n        // m = temp[i] * mont_inv32 mod 2^32\n        let m = temp[i] * mont_inv32;\n        \n        // temp += m * p (this makes temp[i] = 0)\n        var carry: u32 = 0u;\n        for (var j = 0u; j < 8u; j = j + 1u) {\n            temp[i + j] = mul_add_carry(m, p[j], temp[i + j], &carry);\n        }\n        \n        // Propagate carry to high limbs\n        var k = i + 8u;\n        loop {\n            if (k >= 16u || carry == 0u) { break; }\n            let sum = temp[k] + carry;\n            carry = u32(sum < temp[k]);\n            temp[k] = sum;\n            k = k + 1u;\n        }\n    }\n    \n    // Extract upper 256 bits (temp >> 256)\n    var result: array<u32, 8>;\n    for (var i = 0u; i < 8u; i = i + 1u) {\n        result[i] = temp[i + 8u];\n    }\n    \n    // Final conditional subtraction\n    if (gte_256(result, p)) {\n        result = sub_no_borrow_256(result, p);\n    }\n    \n    return result;\n}\n\n// Montgomery multiplication: (a * b * R^-1) mod p\n// Inputs: a, b : 256-bit integers; mont_inv32, p : parameters\n// Output: 256-bit integer = a * b * R^-1 mod p\n// Path: compute 512-bit product, then Montgomery reduce\nfn mont_mul_256(a: array<u32, 8>, b: array<u32, 8>, mont_inv32: u32, p: array<u32, 8>) -> array<u32, 8> {\n    var product: array<u32, 16>;\n    for (var i = 0u; i < 16u; i = i + 1u) {\n        product[i] = 0u;\n    }\n    \n    // Compute a * b\n    for (var i = 0u; i < 8u; i = i + 1u) {\n        var carry: u32 = 0u;\n        for (var j = 0u; j < 8u; j = j + 1u) {\n            product[i + j] = mul_add_carry(a[i], b[j], product[i + j], &carry);\n        }\n        product[i + 8u] = carry;\n    }\n    \n    return montgomery_reduce_256(product, mont_inv32, p);\n}\n\n// Convert a 256-bit integer to Montgomery form\n// Inputs: a, r2, mont_inv32, p\n// Output: a * R mod p\nfn to_montgomery_256(a: array<u32, 8>, r2: array<u32, 8>, mont_inv32: u32, p: array<u32, 8>) -> array<u32, 8> {\n    return mont_mul_256(a, r2, mont_inv32, p);\n}\n\n// Convert a 256-bit integer from Montgomery form\n// Inputs: a : 256-bit integer in Montgomery form; mont_inv32, p : Montgomery parameters\n// Output: a * R^-1 mod p\n// Path: multiply by 1 using Montgomery multiplication\nfn from_montgomery_256(a: array<u32, 8>, mont_inv32: u32, p: array<u32, 8>) -> array<u32, 8> {\n    let one: array<u32, 8> = array<u32, 8>(1u, 0u, 0u, 0u, 0u, 0u, 0u, 0u);\n    return mont_mul_256(a, one, mont_inv32, p);\n}\n\n// Modular inverse in Montgomery form\n// Inputs: a : 256-bit integer in Montgomery form\n//         r2, mont_inv32, p : parameters\n//         p_minus_2 : p-2 for Fermat's inverse\n// Output: a^-1 mod p in Montgomery form\n// Path: exponentiation by squaring: result = a^(p-2)\nfn mod_inverse_mont_256(a: array<u32, 8>, r2: array<u32, 8>, mont_inv32: u32, p: array<u32, 8>, p_minus_2: array<u32, 8>) -> array<u32, 8> {\n    var result: array<u32, 8>;\n    result[0] = 1u;\n    for (var i = 1u; i < 8u; i = i + 1u) {\n        result[i] = 0u;\n    }\n    result = to_montgomery_256(result, r2, mont_inv32, p); // 1 in Montgomery form\n    \n    var base = a; // Already in Montgomery form\n    \n    for (var limb_idx = 0u; limb_idx < 8u; limb_idx = limb_idx + 1u) {\n        var bits = p_minus_2[limb_idx];\n        \n        for (var bit = 0u; bit < 32u; bit = bit + 1u) {\n            if ((bits & 1u) == 1u) {\n                result = mont_mul_256(result, base, mont_inv32, p);\n            }\n            base = mont_mul_256(base, base, mont_inv32, p);\n            bits = bits >> 1u;\n        }\n    }\n    \n    return result;\n}\n\n// Check if projective point P is infinity (z == 0)\nfn is_infinity_proj_256(P: ProjectivePoint256) -> bool {\n    for (var i = 0u; i < 8u; i = i + 1u) {\n        if (P.z.limbs[i] != 0u) {\n            return false;\n        }\n    }\n    return true;\n}\n\n// Convert affine point (x, y) to projective coordinates (x:y:z)\n// Inputs: x, y : Limbs256, r2, mont_inv32, p\n// Output: ProjectivePoint256 P in Montgomery form, z = 1\nfn to_projective_256(x: Limbs256, y: Limbs256, r2: array<u32, 8>, mont_inv32: u32, p: array<u32, 8>) -> ProjectivePoint256 {\n    var P: ProjectivePoint256;\n    // Convert to Montgomery form\n    P.x.limbs = to_montgomery_256(x.limbs, r2, mont_inv32, p);\n    P.y.limbs = to_montgomery_256(y.limbs, r2, mont_inv32, p);\n    P.z.limbs[0] = 1u;\n    for (var i = 1u; i < 8u; i = i + 1u) {\n        P.z.limbs[i] = 0u;\n    }\n    P.z.limbs = to_montgomery_256(P.z.limbs, r2, mont_inv32, p);\n    return P;\n}\n\n// Convert Jacobian projective point to affine coordinates.\n// The addition and doubling formulas use Jacobian coordinates where\n// affine = (X/Z\xB2, Y/Z\xB3).\n// Inputs: P : ProjectivePoint256 in Jacobian form, r2, mont_inv32, p, p_minus_2\n// Output: Q : Point256 (x, y) in affine coordinates (standard form)\nfn to_affine_256(P: ProjectivePoint256, r2: array<u32, 8>, mont_inv32: u32, p: array<u32, 8>, p_minus_2: array<u32, 8>) -> Point256 {\n    if (is_infinity_proj_256(P)) { // Note is_infinity_proj_256 returns are not constant time and so would be vulnerable to timing attacks FIXME\n        var inf: Point256;\n        for (var i = 0u; i < 8u; i = i + 1u) {\n            inf.x.limbs[i] = 0u;\n            inf.y.limbs[i] = 0u;\n        }\n        return inf;\n    }\n\n    // Jacobian: affine x = X / Z\xB2, affine y = Y / Z\xB3\n    let z_inv  = mod_inverse_mont_256(P.z.limbs, r2, mont_inv32, p, p_minus_2);\n    let z_inv2 = mont_mul_256(z_inv, z_inv, mont_inv32, p);\n    let z_inv3 = mont_mul_256(z_inv2, z_inv, mont_inv32, p);\n\n    var Q: Point256;\n    Q.x.limbs = mont_mul_256(P.x.limbs, z_inv2, mont_inv32, p);\n    Q.y.limbs = mont_mul_256(P.y.limbs, z_inv3, mont_inv32, p);\n\n    // Convert back from Montgomery form\n    Q.x.limbs = from_montgomery_256(Q.x.limbs, mont_inv32, p);\n    Q.y.limbs = from_montgomery_256(Q.y.limbs, mont_inv32, p);\n\n    return Q;\n}\n\n// Point doubling in projective coordinates\n// Inputs: P : ProjectivePoint256, r2, mont_inv32, p\n// Output: Q = 2*P in projective coordinates\n// Path:\n//   xx = x^2, yy = y^2, yyyy = yy^2, zz = z^2\n//   s  = 2*((x+yy)^2 - xx - yyyy)\n//   m  = 3*xx\n//   x3 = m^2 - 2*s\n//   y3 = m*(s - x3) - 8*yyyy\n//   z3 = (y+z)^2 - yy - zz\nfn point_double_proj_256(P: ProjectivePoint256, r2: array<u32, 8>, mont_inv32: u32, p: array<u32, 8>) -> ProjectivePoint256 {\n    if (is_infinity_proj_256(P)) { return P; } // Note is_infinity_proj_256 returns are not constant time and so would be vulnerable to timing attacks FIXME\n    \n    let xx = mont_mul_256(P.x.limbs, P.x.limbs, mont_inv32, p);\n    let yy = mont_mul_256(P.y.limbs, P.y.limbs, mont_inv32, p);\n    let yyyy = mont_mul_256(yy, yy, mont_inv32, p);\n    let zz = mont_mul_256(P.z.limbs, P.z.limbs, mont_inv32, p);\n    \n    var s = add_mod_256(P.x.limbs, yy, p);\n    s = mont_mul_256(s, s, mont_inv32, p);\n    s = sub_mod_256(s, xx, p);\n    s = sub_mod_256(s, yyyy, p);\n    s = add_mod_256(s, s, p);\n    \n    var m = add_mod_256(xx, xx, p);\n    m = add_mod_256(m, xx, p);\n    \n    var t = mont_mul_256(m, m, mont_inv32, p);\n    t = sub_mod_256(t, add_mod_256(s, s, p), p);\n    \n    var Q: ProjectivePoint256;\n    Q.x.limbs = t;\n    \n    var y3 = sub_mod_256(s, t, p);\n    y3 = mont_mul_256(m, y3, mont_inv32, p);\n    var yyyy8 = add_mod_256(yyyy, yyyy, p);\n    yyyy8 = add_mod_256(yyyy8, yyyy8, p);\n    yyyy8 = add_mod_256(yyyy8, yyyy8, p);\n    Q.y.limbs = sub_mod_256(y3, yyyy8, p);\n    \n    var z3 = add_mod_256(P.y.limbs, P.z.limbs, p);\n    z3 = mont_mul_256(z3, z3, mont_inv32, p);\n    z3 = sub_mod_256(z3, yy, p);\n    z3 = sub_mod_256(z3, zz, p);\n    Q.z.limbs = z3;\n    \n    return Q;\n}\n\n// Point addition in projective coordinates\n// Inputs: P, Q : ProjectivePoint256, r2, mont_inv32, p\n// Output: R = P + Q in projective coordinates\n// Path:\n//   z1z1 = z1^2, z2z2 = z2^2\n//   u1 = x1*z2z2, u2 = x2*z1z1\n//   s1 = y1*z2*z2z2, s2 = y2*z1*z1z1\n//   If u1 == u2 and s1 == s2, return 2*P\n//   h = u2 - u1, i = (2*h)^2, j = h*i\n//   r = 2*(s2 - s1), v = u1*i\n//   x3 = r^2 - j - 2*v\n//   y3 = r*(v - x3) - 2*s1*j\n//   z3 = ((z1+z2)^2 - z1z1 - z2z2)*h\nfn point_add_proj_256(P: ProjectivePoint256, Q: ProjectivePoint256, r2: array<u32, 8>, mont_inv32: u32, p: array<u32, 8>) -> ProjectivePoint256 {\n    // Note is_infinity_proj_256 returns are not constant time and so would be vulnerable to timing attacks FIXME\n    if (is_infinity_proj_256(P)) { return Q; }\n    if (is_infinity_proj_256(Q)) { return P; }\n    \n    let z1z1 = mont_mul_256(P.z.limbs, P.z.limbs, mont_inv32, p);\n    let z2z2 = mont_mul_256(Q.z.limbs, Q.z.limbs, mont_inv32, p);\n    \n    let u1 = mont_mul_256(P.x.limbs, z2z2, mont_inv32, p);\n    let u2 = mont_mul_256(Q.x.limbs, z1z1, mont_inv32, p);\n    \n    let s1 = mont_mul_256(P.y.limbs, mont_mul_256(Q.z.limbs, z2z2, mont_inv32, p), mont_inv32, p);\n    let s2 = mont_mul_256(Q.y.limbs, mont_mul_256(P.z.limbs, z1z1, mont_inv32, p), mont_inv32, p);\n    \n    var same_x = true;\n    var same_y = true;\n    for (var i = 0u; i < 8u; i = i + 1u) {\n        if (u1[i] != u2[i]) { same_x = false; }\n        if (s1[i] != s2[i]) { same_y = false; }\n    }\n    if (same_x && same_y) {\n        return point_double_proj_256(P, r2, mont_inv32, p);\n    }\n    \n    let h = sub_mod_256(u2, u1, p);\n    var i = add_mod_256(h, h, p);\n    i = mont_mul_256(i, i, mont_inv32, p);\n    let j = mont_mul_256(h, i, mont_inv32, p);\n    \n    var r = sub_mod_256(s2, s1, p);\n    r = add_mod_256(r, r, p);\n    \n    let v = mont_mul_256(u1, i, mont_inv32, p);\n    \n    var x3 = mont_mul_256(r, r, mont_inv32, p);\n    x3 = sub_mod_256(x3, j, p);\n    x3 = sub_mod_256(x3, add_mod_256(v, v, p), p);\n    \n    var y3 = sub_mod_256(v, x3, p);\n    y3 = mont_mul_256(r, y3, mont_inv32, p);\n    let s1j = mont_mul_256(s1, j, mont_inv32, p);\n    let s1j2 = add_mod_256(s1j, s1j, p);\n    y3 = sub_mod_256(y3, s1j2, p);\n    \n    var z3 = add_mod_256(P.z.limbs, Q.z.limbs, p);\n    z3 = mont_mul_256(z3, z3, mont_inv32, p);\n    z3 = sub_mod_256(z3, z1z1, p);\n    z3 = sub_mod_256(z3, z2z2, p);\n    z3 = mont_mul_256(z3, h, mont_inv32, p);\n    \n    var R: ProjectivePoint256;\n    R.x.limbs = x3;\n    R.y.limbs = y3;\n    R.z.limbs = z3;\n    return R;\n}\n\n// Scalar multiplication: k*P\n// Inputs: k : scalar (Limbs256), P : point (x, y coordinates), r2, mont_inv32, p, p_minus_2\n// Output: Q = k*P in affine coordinates\n// Path: double-and-add algorithm, process scalar bits from LSB to MSB\nfn scalar_mul_256(k: Limbs256, P_x: Limbs256, P_y: Limbs256, r2: array<u32, 8>, mont_inv32: u32, p: array<u32, 8>, p_minus_2: array<u32, 8>) -> Point256 {\n    let P = to_projective_256(P_x, P_y, r2, mont_inv32, p);\n    \n    var Q: ProjectivePoint256;\n    for (var i = 0u; i < 8u; i = i + 1u) {\n        Q.x.limbs[i] = 0u;\n        Q.y.limbs[i] = 0u;\n        Q.z.limbs[i] = 0u;\n    }\n    \n    var base = P;\n    \n    for (var limb_idx = 0u; limb_idx < 8u; limb_idx = limb_idx + 1u) {\n        var bits = k.limbs[limb_idx];\n        \n        for (var bit = 0u; bit < 32u; bit = bit + 1u) {\n            if ((bits & 1u) == 1u) {\n                Q = point_add_proj_256(Q, base, r2, mont_inv32, p);\n            }\n            base = point_double_proj_256(base, r2, mont_inv32, p);\n            bits = bits >> 1u;\n        }\n    }\n    \n    return to_affine_256(Q, r2, mont_inv32, p, p_minus_2);\n}\n\n// Scalar multiplication for arbitrary curve: k*P\n// Inputs: k : scalar (Limbs256), P : point (x, y coordinates), curve : Curve256 parameters\n// Output: Q = k*P in affine coordinates\n// Path: uses curve parameters with generic scalar_mul_256\nfn curve_scalar_mul(k: Limbs256, P_x: Limbs256, P_y: Limbs256, curve: Curve256) -> Point256 {\n    return scalar_mul_256(\n        k, P_x, P_y,\n        curve.r2,\n        curve.mont_inv32,\n        curve.p,\n        curve.p_minus_2\n    );\n}";

// src/gpu/256bit/pallas/curve.wgsl
var curve_default = "// curve.wgsl\n\n// @import types.wgsl\n\n// Pallas curve equation: y\xB2 = x\xB3 + 5\n\n// Pallas prime modulus (field size)  \nconst PALLAS_P: array<u32, 8> = array<u32, 8>(\n    0x00000001u, 0x992d30edu, 0x094cf91bu, 0x224698fcu,\n    0x00000000u, 0x00000000u, 0x00000000u, 0x40000000u\n);\n\n// Pallas R\xB2 mod p, used to convert numbers into Montgomery form for fast arithmetic  \nconst PALLAS_R2: array<u32, 8> = array<u32, 8>(\n    0x0000000Fu, 0x8C78ECB3u, 0x8B0DE0E7u, 0xD7D30DBDu,\n    0xC3C95D18u, 0x7797A99Bu, 0x7B9CB714u, 0x096D41AFu\n);\n\n// Pallas -p\u207B\xB9 mod 2^32, required for Montgomery reduction in field operations  \nconst PALLAS_MONT_INV32: u32 = 0xffffffffu;\n\n// Pallas curve coefficient 'a' in y\xB2 = x\xB3 + a*x + b (here a = 0 for Pallas)  \nconst PALLAS_A: array<u32, 8> = array<u32, 8>(\n    0u, 0u, 0u, 0u, 0u, 0u, 0u, 0u\n);\n\n// Pallas curve coefficient 'b' in y\xB2 = x\xB3 + a*x + b (here b = 5 for Pallas)  \nconst PALLAS_B: array<u32, 8> = array<u32, 8>(\n    0u, 0u, 0u, 0u, 0u, 0u, 0u, 5u\n);\n\n// Pallas p - 2, used for modular inverse computation\nconst PALLAS_P_MINUS_2: array<u32, 8> = array<u32, 8>(\n    0xFFFFFFFFu, 0x992D30ECu, 0x094CF91Bu, 0x224698FCu,\n    0x00000000u, 0x00000000u, 0x00000000u, 0x40000000u\n);\n\n// Pallas r_mod_p : Montgomery representation of 1 (R mod p), used to initialize Z in projective points\nconst PALLAS_R_MOD_P: array<u32, 8> = array<u32, 8>(\n    0xFFFFFFFDu, 0x34786D38u, 0xE41914ADu, 0x992C350Bu,\n    0xFFFFFFFFu, 0xFFFFFFFFu, 0xFFFFFFFFu, 0x3FFFFFFFu\n);\n\n// Complete Pallas curve parameters as a Curve256 instance  \nconst PALLAS_CURVE: Curve256 = Curve256(PALLAS_P, PALLAS_R2, PALLAS_MONT_INV32, PALLAS_A, PALLAS_B, PALLAS_P_MINUS_2, PALLAS_R_MOD_P);";

// src/gpu/256bit/pallas/pippenger_msm.wgslc.ts
var pippengerShaderPassAProjectiveConversion = `
${types_default}
${arithmetic_default}
${curve_default}

@group(0) @binding(0) var<storage, read> x: array<Limbs256>;
@group(0) @binding(1) var<storage, read> y: array<Limbs256>;
@group(0) @binding(2) var<storage, read_write> Px: array<Limbs256>;
@group(0) @binding(3) var<storage, read_write> Py: array<Limbs256>;
@group(0) @binding(4) var<storage, read_write> Pz: array<Limbs256>;
@group(0) @binding(5) var<uniform> n: u32; 

const WORKGROUP_SIZE: u32 = 64u;

@compute @workgroup_size(WORKGROUP_SIZE)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let idx = gid.x;
    
    if (idx >= n) {
        return;
    }
    
    let P = to_projective_256(x[idx], y[idx], PALLAS_CURVE.r2, PALLAS_CURVE.mont_inv32, PALLAS_CURVE.p);
    Px[idx] = P.x;
    Py[idx] = P.y;
    Pz[idx] = P.z;
}
`;
var pippengerShaderPassBi1BucketScalarWeightedPointContribution = `
${types_default}
${arithmetic_default}
${curve_default}

// Group 0: constant parameters (BUCKET_WIDTH_BITS never changes, window_idx changes per window)
@group(0) @binding(0) var<uniform> BUCKET_WIDTH_BITS: u32;
@group(0) @binding(1) var<uniform> window_idx: u32;

@group(1) @binding(0) var<uniform> bucket_idx: u32;

@group(2) @binding(0) var<storage, read> k: array<Limbs256>;
@group(2) @binding(1) var<storage, read> Px: array<Limbs256>;
@group(2) @binding(2) var<storage, read> Py: array<Limbs256>;
@group(2) @binding(3) var<storage, read> Pz: array<Limbs256>;

@group(3) @binding(0) var<storage, read_write> WGGx: array<Limbs256>;
@group(3) @binding(1) var<storage, read_write> WGGy: array<Limbs256>;
@group(3) @binding(2) var<storage, read_write> WGGz: array<Limbs256>;

const WORKGROUP_SIZE: u32 = 64u;

var<workgroup> WGLx: array<Limbs256, 64>;
var<workgroup> WGLy: array<Limbs256, 64>;
var<workgroup> WGLz: array<Limbs256, 64>;

@compute @workgroup_size(WORKGROUP_SIZE)
fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(workgroup_id) wgid: vec3<u32>) {
    let idx = gid.x;
    let workgroup_idx = wgid.x;
    let local_idx = gid.x % WORKGROUP_SIZE;

    // Initialize workgroup memory with identity points for all threads
    WGLx[local_idx] = IDENTITY_LIMBS_256;
    WGLy[local_idx] = IDENTITY_LIMBS_256;
    WGLz[local_idx] = IDENTITY_LIMBS_256;

    workgroupBarrier();

    // Only process valid indices, but all threads participate in reduction
    if (idx < arrayLength(&k)) {
        // Extract the scalar bits for this window (window_idx) \u2014 NOT bucket_idx.
        // bucket_idx is the VALUE we are looking for within this window.
        let bit_offset = window_idx * BUCKET_WIDTH_BITS;
        let limb_index = bit_offset / 32u;
        let bit_in_limb = bit_offset % 32u;
        let mask = (1u << BUCKET_WIDTH_BITS) - 1u;

        var k_ij = 0u;
        if (bit_in_limb + BUCKET_WIDTH_BITS) <= 32u {
            k_ij = (k[idx].limbs[limb_index] >> bit_in_limb) & mask;
        } else {
            let bits_in_first_limb = 32u - bit_in_limb;
            let low_bits = k[idx].limbs[limb_index] >> bit_in_limb;
            let high_bits = k[idx].limbs[limb_index + 1u] << bits_in_first_limb;
            k_ij = (low_bits | high_bits) & mask;
        }

        if (k_ij == bucket_idx) {
            WGLx[local_idx] = Px[idx];
            WGLy[local_idx] = Py[idx];
            WGLz[local_idx] = Pz[idx];
        }
    }
    
    workgroupBarrier();

    // Tree reduce the workgroup memory bucket values by binary halving
    var stride = WORKGROUP_SIZE / 2u;
    while (stride > 0u) {
        if (local_idx < stride) {
            let temp = point_add_proj_256(
                ProjectivePoint256(WGLx[local_idx], WGLy[local_idx], WGLz[local_idx]),
                ProjectivePoint256(WGLx[local_idx + stride], WGLy[local_idx + stride], WGLz[local_idx + stride]),
                PALLAS_CURVE.r2,
                PALLAS_CURVE.mont_inv32,
                PALLAS_CURVE.p
            );
            WGLx[local_idx] = temp.x;
            WGLy[local_idx] = temp.y;
            WGLz[local_idx] = temp.z;
        }
        workgroupBarrier();
        stride = stride / 2u;
    }

    // Set the global buffer based on the value of WGL_x,y,z[0] which contains the reduction
    if (local_idx == 0) {
        WGGx[workgroup_idx] = WGLx[0];
        WGGy[workgroup_idx] = WGLy[0];
        WGGz[workgroup_idx] = WGLz[0];
    }
}
`;
var pippengerShaderPassBi2TreeReduceBucket = `
${types_default}
${arithmetic_default}
${curve_default}

// Group 0: reduction parameters \u2014 packed into one uniform struct to minimise bind-group slots.
struct Bi2Uniforms {
    n: u32,                 // WGG elements to reduce in this dispatch
    window_idx: u32,        // which window we are processing
    number_of_buckets: u32, // NUMBER_OF_BUCKETS = 1 << BUCKET_WIDTH_BITS
}
@group(0) @binding(0) var<uniform> bi2: Bi2Uniforms;

@group(1) @binding(0) var<uniform> bucket_idx: u32;

@group(2) @binding(0) var<storage, read_write> WGGx: array<Limbs256>;
@group(2) @binding(1) var<storage, read_write> WGGy: array<Limbs256>;
@group(2) @binding(2) var<storage, read_write> WGGz: array<Limbs256>;

@group(3) @binding(0) var<storage, read_write> Bx: array<Limbs256>;
@group(3) @binding(1) var<storage, read_write> By: array<Limbs256>;
@group(3) @binding(2) var<storage, read_write> Bz: array<Limbs256>;

// 64 threads \xD7 3 coordinates \xD7 8 limbs \xD7 4 bytes = 6,144 bytes \u2014 well within the 16 KB limit.
const WORKGROUP_SIZE: u32 = 64u;

var<workgroup> WGLx: array<Limbs256, WORKGROUP_SIZE>;
var<workgroup> WGLy: array<Limbs256, WORKGROUP_SIZE>;
var<workgroup> WGLz: array<Limbs256, WORKGROUP_SIZE>;

@compute @workgroup_size(WORKGROUP_SIZE)
fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>, @builtin(workgroup_id) wgid: vec3<u32>) {
    let idx = gid.x;
    let local_idx = lid.x;
    let workgroup_idx = wgid.x;
    let n = bi2.n;

    let workgroups_needed = (n + WORKGROUP_SIZE - 1u) / WORKGROUP_SIZE;
    if (workgroup_idx >= workgroups_needed) {
        return;
    }

    // Load WGG into workgroup-local memory, padding out-of-bounds with identity.
    if (idx >= n) {
        WGLx[local_idx] = IDENTITY_LIMBS_256;
        WGLy[local_idx] = IDENTITY_LIMBS_256;
        WGLz[local_idx] = IDENTITY_LIMBS_256;
    } else {
        WGLx[local_idx] = WGGx[idx];
        WGLy[local_idx] = WGGy[idx];
        WGLz[local_idx] = WGGz[idx];
    }

    workgroupBarrier(); // ensure all loads are visible before reduction starts

    // Standard binary tree reduction: stride halves each step.
    // FIX: was using "half = stride >> 1" as the partner offset which skipped the upper
    // half of the workgroup entirely.  The correct partner is local_idx + stride.
    var stride = WORKGROUP_SIZE / 2u;
    while (stride > 0u) {
        if (local_idx < stride) {
            let temp = point_add_proj_256(
                ProjectivePoint256(WGLx[local_idx], WGLy[local_idx], WGLz[local_idx]),
                ProjectivePoint256(WGLx[local_idx + stride], WGLy[local_idx + stride], WGLz[local_idx + stride]),
                PALLAS_CURVE.r2,
                PALLAS_CURVE.mont_inv32,
                PALLAS_CURVE.p
            );
            WGLx[local_idx] = temp.x;
            WGLy[local_idx] = temp.y;
            WGLz[local_idx] = temp.z;
        }
        workgroupBarrier();
        stride = stride / 2u;
    }

    // Thread 0 writes its workgroup's reduced result back to WGG.
    if (local_idx == 0u) {
        WGGx[workgroup_idx] = WGLx[0u];
        WGGy[workgroup_idx] = WGLy[0u];
        WGGz[workgroup_idx] = WGLz[0u];
    }

    // For the final pass (n fits in one workgroup), store the bucket result.
    // FIX: index into B using the 2-D (window, bucket) layout instead of a flat bucket_idx.
    if (idx == 0u && n <= WORKGROUP_SIZE) {
        let b_idx = bi2.window_idx * bi2.number_of_buckets + bucket_idx;
        Bx[b_idx] = WGGx[0u];
        By[b_idx] = WGGy[0u];
        Bz[b_idx] = WGGz[0u];
    }
}
`;
var pippengerShaderPassCBucketAggregation = `
${types_default}
${arithmetic_default}
${curve_default}

// Group 0: per-window uniform parameters.
struct CUniforms {
    window_idx: u32,        // which window's buckets to aggregate
    number_of_buckets: u32, // NUMBER_OF_BUCKETS = 1 << BUCKET_WIDTH_BITS
}
@group(0) @binding(0) var<uniform> cu: CUniforms;

// B is now NUM_WINDOWS * NUMBER_OF_BUCKETS in size.
// B[window_idx * number_of_buckets + v] = sum of P_i where window w of scalar k_i equals v.
@group(1) @binding(0) var<storage, read_write> Bx: array<Limbs256>;
@group(1) @binding(1) var<storage, read_write> By: array<Limbs256>;
@group(1) @binding(2) var<storage, read_write> Bz: array<Limbs256>;

// F receives partial weighted sums (one entry per workgroup).
@group(2) @binding(0) var<storage, read_write> Fx: array<Limbs256>;
@group(2) @binding(1) var<storage, read_write> Fy: array<Limbs256>;
@group(2) @binding(2) var<storage, read_write> Fz: array<Limbs256>;

const WORKGROUP_SIZE: u32 = 64u;
var<workgroup> scaled: array<ProjectivePoint256, WORKGROUP_SIZE>;

@compute @workgroup_size(WORKGROUP_SIZE)
fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>, @builtin(workgroup_id) wgid: vec3<u32>) {
    let idx = gid.x;       // bucket value v within this window (0 .. number_of_buckets-1)
    let local_idx = lid.x;
    let workgroup_idx = wgid.x;
    let NB = cu.number_of_buckets;

    let workgroups_needed = (NB + WORKGROUP_SIZE - 1u) / WORKGROUP_SIZE;
    if (workgroup_idx >= workgroups_needed) {
        return;
    }

    // Step 1: Load B[window_idx * NB + idx] and apply Pippenger weight = idx (the bucket value).
    // Bucket 0 contributes nothing (scalar bits = 0 means the point is not in this bucket window).
    // FIX: weight = idx (the bucket value v), NOT NUM_BUCKETS - idx.
    if (idx == 0u || idx >= NB) {
        // Bucket 0 has weight 0; out-of-range threads hold identity.
        scaled[local_idx] = ProjectivePoint256(IDENTITY_LIMBS_256, IDENTITY_LIMBS_256, IDENTITY_LIMBS_256);
    } else {
        let b_idx = cu.window_idx * NB + idx;
        var weight = idx; // weight = bucket value v (1 .. NB-1)
        var accumulator = ProjectivePoint256(IDENTITY_LIMBS_256, IDENTITY_LIMBS_256, IDENTITY_LIMBS_256);
        var temp = ProjectivePoint256(Bx[b_idx], By[b_idx], Bz[b_idx]);

        // Binary scalar multiplication: weight * B[window_idx * NB + v]
        while (weight > 0u) {
            if ((weight & 1u) != 0u) {
                accumulator = point_add_proj_256(
                    accumulator, temp,
                    PALLAS_CURVE.r2, PALLAS_CURVE.mont_inv32, PALLAS_CURVE.p
                );
            }
            weight = weight >> 1u;
            if (weight > 0u) {
                temp = point_double_proj_256(
                    temp,
                    PALLAS_CURVE.r2, PALLAS_CURVE.mont_inv32, PALLAS_CURVE.p
                );
            }
        }
        scaled[local_idx] = accumulator;
    }

    workgroupBarrier();

    // Step 2: Tree reduction \u2014 sum all weighted bucket contributions within the workgroup.
    var stride = WORKGROUP_SIZE / 2u;
    while (stride > 0u) {
        if (local_idx < stride) {
            scaled[local_idx] = point_add_proj_256(
                scaled[local_idx],
                scaled[local_idx + stride],
                PALLAS_CURVE.r2, PALLAS_CURVE.mont_inv32, PALLAS_CURVE.p
            );
        }
        workgroupBarrier();
        stride = stride / 2u;
    }

    // Step 3: Thread 0 writes the partial weighted sum to F.
    // Pass D will reduce F[0..ceil(NB/64)-1] into a single S_w for this window.
    if (local_idx == 0u) {
        Fx[workgroup_idx] = scaled[0u].x;
        Fy[workgroup_idx] = scaled[0u].y;
        Fz[workgroup_idx] = scaled[0u].z;
    }
}
`;
var pippengerShaderPassDTreeReduceFinalPoint = `
${types_default}
${arithmetic_default}
${curve_default}

// Uniform: number of points to reduce in this dispatch
@group(0) @binding(0) var<uniform> n: u32;
@group(0) @binding(1) var<uniform> batch_idx: u32;

// Storage: partially reduced points from Pass C
@group(1) @binding(0) var<storage, read_write> Fx: array<Limbs256>;
@group(1) @binding(1) var<storage, read_write> Fy: array<Limbs256>;
@group(1) @binding(2) var<storage, read_write> Fz: array<Limbs256>;

// Storage for batch final points (projective) - one per batch processed
@group(2) @binding(0) var<storage, read_write> batch_final_points_x: array<Limbs256>;
@group(2) @binding(1) var<storage, read_write> batch_final_points_y: array<Limbs256>;
@group(2) @binding(2) var<storage, read_write> batch_final_points_z: array<Limbs256>;

const WORKGROUP_SIZE: u32 = 64u;

var<workgroup> WGLx: array<Limbs256, WORKGROUP_SIZE>;
var<workgroup> WGLy: array<Limbs256, WORKGROUP_SIZE>;
var<workgroup> WGLz: array<Limbs256, WORKGROUP_SIZE>;

@compute @workgroup_size(WORKGROUP_SIZE)
fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>, @builtin(workgroup_id) wgid: vec3<u32>) {
    let idx = gid.x;
    let local_idx = lid.x;
    let workgroup_idx = wgid.x;

    // Number of workgroups needed
    let workgroups_needed = (n + WORKGROUP_SIZE - 1u) / WORKGROUP_SIZE;
    if (workgroup_idx >= workgroups_needed) { 
        return; // We don't need these threads
    }

    // Load points into local workgroup memory
    if (idx >= n) {
        WGLx[local_idx] = IDENTITY_LIMBS_256;
        WGLy[local_idx] = IDENTITY_LIMBS_256;
        WGLz[local_idx] = IDENTITY_LIMBS_256;
    } else {
        WGLx[local_idx] = Fx[idx];
        WGLy[local_idx] = Fy[idx];
        WGLz[local_idx] = Fz[idx];
    }

    workgroupBarrier();

    // Tree reduction within workgroup
    var stride = WORKGROUP_SIZE / 2u;
    while (stride > 0u) {
        if (local_idx < stride) {
            let temp = point_add_proj_256(
                ProjectivePoint256(WGLx[local_idx], WGLy[local_idx], WGLz[local_idx]),
                ProjectivePoint256(WGLx[local_idx + stride], WGLy[local_idx + stride], WGLz[local_idx + stride]),
                PALLAS_CURVE.r2,
                PALLAS_CURVE.mont_inv32,
                PALLAS_CURVE.p
            );
            WGLx[local_idx] = temp.x;
            WGLy[local_idx] = temp.y;
            WGLz[local_idx] = temp.z;
        }
        workgroupBarrier();
        stride = stride / 2u;
    }

    // Local thread 0 writes reduced result back to global Fx/y/z
    if (local_idx == 0u) {
        Fx[workgroup_idx] = WGLx[0];
        Fy[workgroup_idx] = WGLy[0];
        Fz[workgroup_idx] = WGLz[0];
    }

    // For the final pass (single workgroup), first global thread writes output
    if (idx == 0u && n <= WORKGROUP_SIZE) {
        batch_final_points_x[batch_idx] = Fx[0];
        batch_final_points_y[batch_idx] = Fy[0];
        batch_final_points_z[batch_idx] = Fz[0];
    }
}
`;
var pippengerShaderPassEFinalAccumulation = `
${types_default}
${arithmetic_default}
${curve_default}

// Uniform: number of batch final points to reduce in this dispatch
@group(0) @binding(0) var<uniform> n: u32;

// Storage: batch final points from Pass D (projective)
@group(1) @binding(0) var<storage, read_write> batch_final_points_x: array<Limbs256>;
@group(1) @binding(1) var<storage, read_write> batch_final_points_y: array<Limbs256>;
@group(1) @binding(2) var<storage, read_write> batch_final_points_z: array<Limbs256>;

// Storage for final affine point
@group(2) @binding(0) var<storage, read_write> final_point_x: Limbs256;
@group(2) @binding(1) var<storage, read_write> final_point_y: Limbs256;

const WORKGROUP_SIZE: u32 = 64u;

var<workgroup> WGLx: array<Limbs256, WORKGROUP_SIZE>;
var<workgroup> WGLy: array<Limbs256, WORKGROUP_SIZE>;
var<workgroup> WGLz: array<Limbs256, WORKGROUP_SIZE>;

@compute @workgroup_size(WORKGROUP_SIZE)
fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>, @builtin(workgroup_id) wgid: vec3<u32>) {
    let idx = gid.x;
    let local_idx = lid.x;
    let workgroup_idx = wgid.x;

    // Number of workgroups needed
    let workgroups_needed = (n + WORKGROUP_SIZE - 1u) / WORKGROUP_SIZE;
    if (workgroup_idx >= workgroups_needed) { 
        return; // We don't need these threads
    }

    // Load batch final points into local workgroup memory
    if (idx >= n) {
        WGLx[local_idx] = IDENTITY_LIMBS_256;
        WGLy[local_idx] = IDENTITY_LIMBS_256;
        WGLz[local_idx] = IDENTITY_LIMBS_256;
    } else {
        WGLx[local_idx] = batch_final_points_x[idx];
        WGLy[local_idx] = batch_final_points_y[idx];
        WGLz[local_idx] = batch_final_points_z[idx];
    }

    workgroupBarrier();

    // Tree reduction within workgroup
    var stride = WORKGROUP_SIZE / 2u;
    while (stride > 0u) {
        if (local_idx < stride) {
            let temp = point_add_proj_256(
                ProjectivePoint256(WGLx[local_idx], WGLy[local_idx], WGLz[local_idx]),
                ProjectivePoint256(WGLx[local_idx + stride], WGLy[local_idx + stride], WGLz[local_idx + stride]),
                PALLAS_CURVE.r2,
                PALLAS_CURVE.mont_inv32,
                PALLAS_CURVE.p
            );
            WGLx[local_idx] = temp.x;
            WGLy[local_idx] = temp.y;
            WGLz[local_idx] = temp.z;
        }
        workgroupBarrier();
        stride = stride / 2u;
    }

    // Local thread 0 writes reduced result back to global batch_final_points
    if (local_idx == 0u) {
        batch_final_points_x[workgroup_idx] = WGLx[0];
        batch_final_points_y[workgroup_idx] = WGLy[0];
        batch_final_points_z[workgroup_idx] = WGLz[0];
    }

    // For the final pass (single workgroup), first global thread converts to affine and writes final output
    if (idx == 0u && n <= WORKGROUP_SIZE) {
        let finalProj = ProjectivePoint256(batch_final_points_x[0], batch_final_points_y[0], batch_final_points_z[0]);
        let finalAffine = to_affine_256(finalProj, PALLAS_CURVE.r2, PALLAS_CURVE.mont_inv32, PALLAS_CURVE.p, PALLAS_CURVE.p_minus_2);
        final_point_x = finalAffine.x;
        final_point_y = finalAffine.y;
    }
}
`;
var pippengerShaderPassHorner = `
${types_default}
${arithmetic_default}
${curve_default}

struct HornerUniforms {
    num_windows: u32,
    bucket_width_bits: u32,
    batch_idx: u32,
}
@group(0) @binding(0) var<uniform> hu: HornerUniforms;

// F_windows[w] = S_w, the weighted bucket sum for window w.
@group(1) @binding(0) var<storage, read_write> fw_x: array<Limbs256>;
@group(1) @binding(1) var<storage, read_write> fw_y: array<Limbs256>;
@group(1) @binding(2) var<storage, read_write> fw_z: array<Limbs256>;

// Output: batch_final_points[batch_idx] = Horner result (projective).
@group(2) @binding(0) var<storage, read_write> batch_final_points_x: array<Limbs256>;
@group(2) @binding(1) var<storage, read_write> batch_final_points_y: array<Limbs256>;
@group(2) @binding(2) var<storage, read_write> batch_final_points_z: array<Limbs256>;

@compute @workgroup_size(1)
fn main() {
    let NW = hu.num_windows;
    let W  = hu.bucket_width_bits;

    // Initialise with the highest window's sum.
    var result = ProjectivePoint256(
        fw_x[NW - 1u],
        fw_y[NW - 1u],
        fw_z[NW - 1u]
    );

    // Horner descent: result = 2^W * result + S_{w}  for w = NW-2 .. 0
    var w: i32 = i32(NW) - 2;
    while (w >= 0) {
        // Multiply result by 2^W via W repeated doublings.
        for (var d = 0u; d < W; d = d + 1u) {
            result = point_double_proj_256(result, PALLAS_CURVE.r2, PALLAS_CURVE.mont_inv32, PALLAS_CURVE.p);
        }
        // Add S_w.
        let sw = ProjectivePoint256(fw_x[u32(w)], fw_y[u32(w)], fw_z[u32(w)]);
        result = point_add_proj_256(result, sw, PALLAS_CURVE.r2, PALLAS_CURVE.mont_inv32, PALLAS_CURVE.p);
        w = w - 1;
    }

    batch_final_points_x[hu.batch_idx] = result.x;
    batch_final_points_y[hu.batch_idx] = result.y;
    batch_final_points_z[hu.batch_idx] = result.z;
}
`;

// src/gpu/256bit/helpers.ts
function writeBigint256ToLimbs(value, target, offset = 0) {
  let v = value;
  for (let i = 0; i < 8; i++) {
    target[offset + i] = Number(v & 0xFFFFFFFFn);
    v >>= 32n;
  }
}
function limbs256ToBigint(limbs) {
  let result = 0n;
  for (let i = 7; i >= 0; i--) {
    result = result << 32n | BigInt(limbs[i]);
  }
  return result;
}
var LIMBS_PER_ELEMENT_256 = 8;
var BYTES_PER_LIMB = 4;
var BYTES_PER_ELEMENT_256 = LIMBS_PER_ELEMENT_256 * BYTES_PER_LIMB;

// src/gpu/256bit/pallas/pippenger_msm.ts
var WORKGROUP_SIZE_A = 64;
var WORKGROUP_SIZE_BI1 = 64;
var WORKGROUP_SIZE_BI2 = 64;
var WORKGROUP_SIZE_C = 64;
var WORKGROUP_SIZE_D = 64;
var WORKGROUP_SIZE_E = 64;
var SCALAR_BITS = 256;
var runnerCache = /* @__PURE__ */ new WeakMap();
function normalizeBucketWidthBits(config2) {
  const bucketWidthBits = config2?.bucketWidthBits ?? 8;
  if (bucketWidthBits < 1 || bucketWidthBits > 22) {
    throw new Error("bucketWidthBits must be 1\u201322");
  }
  return bucketWidthBits;
}
function createPippengerMSMPallasRunner(device, config2) {
  const bucketWidthBits = normalizeBucketWidthBits(config2);
  let runnersByBucketWidth = runnerCache.get(device);
  if (!runnersByBucketWidth) {
    runnersByBucketWidth = /* @__PURE__ */ new Map();
    runnerCache.set(device, runnersByBucketWidth);
  }
  let runner = runnersByBucketWidth.get(bucketWidthBits);
  if (!runner) {
    runner = new PippengerMSMPallasRunner(device, bucketWidthBits);
    runnersByBucketWidth.set(bucketWidthBits, runner);
  }
  return runner;
}
async function pippengerMSMPallas(device, scalars, points, config2) {
  const runner = createPippengerMSMPallasRunner(device, config2);
  return runner.run(scalars, points, config2);
}
var PippengerMSMPallasRunner = class {
  constructor(device, bucketWidthBits) {
    this.batchFinalPointsCapacity = 0;
    this.device = device;
    this.bucketWidthBits = bucketWidthBits;
    this.numberOfBuckets = 1 << bucketWidthBits;
    this.numWindows = Math.ceil(SCALAR_BITS / bucketWidthBits);
    const maxBufferSize = device.limits.maxStorageBufferBindingSize;
    const maxWorkgroups = 65535;
    this.maxChunkN = Math.min(
      Math.floor(maxBufferSize / BYTES_PER_ELEMENT_256),
      maxWorkgroups * WORKGROUP_SIZE_BI1
    );
    this.maxNumWorkgroupsBi1 = Math.ceil(this.maxChunkN / WORKGROUP_SIZE_BI1);
    this.maxNumWorkgroupsC = Math.ceil(this.numberOfBuckets / WORKGROUP_SIZE_C);
    this.kHost = new Uint32Array(this.maxChunkN * LIMBS_PER_ELEMENT_256);
    this.pxHost = new Uint32Array(this.maxChunkN * LIMBS_PER_ELEMENT_256);
    this.pyHost = new Uint32Array(this.maxChunkN * LIMBS_PER_ELEMENT_256);
    this.layoutPassA = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } }
      ]
    });
    this.layoutBi1Params = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } }
      ]
    });
    this.layoutUniformSingle = device.createBindGroupLayout({
      entries: [{ binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } }]
    });
    const layoutPassBi1Input = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } }
      ]
    });
    this.layoutWGG = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } }
      ]
    });
    this.layoutBi2Uniforms = device.createBindGroupLayout({
      entries: [{ binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } }]
    });
    this.layoutBucketsStorage = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } }
      ]
    });
    this.layoutCUniforms = device.createBindGroupLayout({
      entries: [{ binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } }]
    });
    this.layoutFStorage = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } }
      ]
    });
    this.layoutUniformNBatchIdx = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } }
      ]
    });
    this.layoutBatchFinalPoints = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } }
      ]
    });
    this.layoutHornerUniforms = device.createBindGroupLayout({
      entries: [{ binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } }]
    });
    this.layoutFinalPoint = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } }
      ]
    });
    const shaderModules = {
      A: device.createShaderModule({ code: pippengerShaderPassAProjectiveConversion }),
      Bi1: device.createShaderModule({ code: pippengerShaderPassBi1BucketScalarWeightedPointContribution }),
      Bi2: device.createShaderModule({ code: pippengerShaderPassBi2TreeReduceBucket }),
      C: device.createShaderModule({ code: pippengerShaderPassCBucketAggregation }),
      D: device.createShaderModule({ code: pippengerShaderPassDTreeReduceFinalPoint }),
      E: device.createShaderModule({ code: pippengerShaderPassEFinalAccumulation }),
      Horner: device.createShaderModule({ code: pippengerShaderPassHorner })
    };
    this.pipelineA = device.createComputePipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [this.layoutPassA] }),
      compute: { module: shaderModules.A, entryPoint: "main" }
    });
    this.pipelineBi1 = device.createComputePipeline({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [
          this.layoutBi1Params,
          this.layoutUniformSingle,
          layoutPassBi1Input,
          this.layoutWGG
        ]
      }),
      compute: { module: shaderModules.Bi1, entryPoint: "main" }
    });
    this.pipelineBi2 = device.createComputePipeline({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [
          this.layoutBi2Uniforms,
          this.layoutUniformSingle,
          this.layoutWGG,
          this.layoutBucketsStorage
        ]
      }),
      compute: { module: shaderModules.Bi2, entryPoint: "main" }
    });
    this.pipelineC = device.createComputePipeline({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [this.layoutCUniforms, this.layoutBucketsStorage, this.layoutFStorage]
      }),
      compute: { module: shaderModules.C, entryPoint: "main" }
    });
    this.pipelineD = device.createComputePipeline({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [
          this.layoutUniformNBatchIdx,
          this.layoutFStorage,
          this.layoutBatchFinalPoints
        ]
      }),
      compute: { module: shaderModules.D, entryPoint: "main" }
    });
    this.pipelineE = device.createComputePipeline({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [
          this.layoutUniformSingle,
          this.layoutBatchFinalPoints,
          this.layoutFinalPoint
        ]
      }),
      compute: { module: shaderModules.E, entryPoint: "main" }
    });
    this.pipelineHorner = device.createComputePipeline({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [
          this.layoutHornerUniforms,
          this.layoutFStorage,
          this.layoutBatchFinalPoints
        ]
      }),
      compute: { module: shaderModules.Horner, entryPoint: "main" }
    });
    const bBufferSize = this.numWindows * this.numberOfBuckets * BYTES_PER_ELEMENT_256;
    this.bXBuffer = this.createBuffer(bBufferSize, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    this.bYBuffer = this.createBuffer(bBufferSize, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    this.bZBuffer = this.createBuffer(bBufferSize, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    this.fWindowsXBuffer = this.createBuffer(
      this.numWindows * BYTES_PER_ELEMENT_256,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    );
    this.fWindowsYBuffer = this.createBuffer(
      this.numWindows * BYTES_PER_ELEMENT_256,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    );
    this.fWindowsZBuffer = this.createBuffer(
      this.numWindows * BYTES_PER_ELEMENT_256,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    );
    this.finalPointXBuffer = this.createBuffer(
      BYTES_PER_ELEMENT_256,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    );
    this.finalPointYBuffer = this.createBuffer(
      BYTES_PER_ELEMENT_256,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    );
    this.finalPointXStagingBuffer = this.createBuffer(
      BYTES_PER_ELEMENT_256,
      GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
    );
    this.finalPointYStagingBuffer = this.createBuffer(
      BYTES_PER_ELEMENT_256,
      GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
    );
    const u32Size = 4;
    this.bi1BucketWidthBitsBuffer = this.createUniformBufferWithData([bucketWidthBits]);
    this.bi1WindowIdxBuffer = this.createBuffer(u32Size, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    this.bucketIdxUniform = this.createBuffer(u32Size, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    this.bi2UniformsBuffer = this.createBuffer(16, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    this.passANUniform = this.createBuffer(u32Size, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    this.cUniformsBuffer = this.createBuffer(8, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    this.passDNUniform = this.createBuffer(u32Size, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    this.passDBatchIdxUniform = this.createBuffer(u32Size, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    this.passENUniform = this.createBuffer(u32Size, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    this.hornerUniformsBuffer = this.createBuffer(16, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    const perBatchBufferSize = this.maxChunkN * BYTES_PER_ELEMENT_256;
    this.kBuffer = this.createBuffer(perBatchBufferSize, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
    this.pxBuffer = this.createBuffer(perBatchBufferSize, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
    this.pyBuffer = this.createBuffer(perBatchBufferSize, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
    this.ppxBuffer = this.createBuffer(perBatchBufferSize, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    this.ppyBuffer = this.createBuffer(perBatchBufferSize, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    this.ppzBuffer = this.createBuffer(perBatchBufferSize, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    const wggSizeMax = this.maxNumWorkgroupsBi1 * BYTES_PER_ELEMENT_256;
    this.wggXBuffer = this.createBuffer(wggSizeMax, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    this.wggYBuffer = this.createBuffer(wggSizeMax, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    this.wggZBuffer = this.createBuffer(wggSizeMax, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    const fBufferSizeMax = this.maxNumWorkgroupsC * BYTES_PER_ELEMENT_256;
    this.fXBuffer = this.createBuffer(fBufferSizeMax, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    this.fYBuffer = this.createBuffer(fBufferSizeMax, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    this.fZBuffer = this.createBuffer(fBufferSizeMax, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    this.bindGroupPassA = device.createBindGroup({
      layout: this.layoutPassA,
      entries: [
        { binding: 0, resource: { buffer: this.pxBuffer } },
        { binding: 1, resource: { buffer: this.pyBuffer } },
        { binding: 2, resource: { buffer: this.ppxBuffer } },
        { binding: 3, resource: { buffer: this.ppyBuffer } },
        { binding: 4, resource: { buffer: this.ppzBuffer } },
        { binding: 5, resource: { buffer: this.passANUniform } }
      ]
    });
    this.bindGroupBi1Params = device.createBindGroup({
      layout: this.layoutBi1Params,
      entries: [
        { binding: 0, resource: { buffer: this.bi1BucketWidthBitsBuffer } },
        { binding: 1, resource: { buffer: this.bi1WindowIdxBuffer } }
      ]
    });
    this.bindGroupBucketIdx = device.createBindGroup({
      layout: this.layoutUniformSingle,
      entries: [{ binding: 0, resource: { buffer: this.bucketIdxUniform } }]
    });
    this.bindGroupPassBi1Input = device.createBindGroup({
      layout: layoutPassBi1Input,
      entries: [
        { binding: 0, resource: { buffer: this.kBuffer } },
        { binding: 1, resource: { buffer: this.ppxBuffer } },
        { binding: 2, resource: { buffer: this.ppyBuffer } },
        { binding: 3, resource: { buffer: this.ppzBuffer } }
      ]
    });
    this.bindGroupWGG = device.createBindGroup({
      layout: this.layoutWGG,
      entries: [
        { binding: 0, resource: { buffer: this.wggXBuffer } },
        { binding: 1, resource: { buffer: this.wggYBuffer } },
        { binding: 2, resource: { buffer: this.wggZBuffer } }
      ]
    });
    this.bindGroupBi2Uniforms = device.createBindGroup({
      layout: this.layoutBi2Uniforms,
      entries: [{ binding: 0, resource: { buffer: this.bi2UniformsBuffer } }]
    });
    this.bindGroupBucketsStorage = device.createBindGroup({
      layout: this.layoutBucketsStorage,
      entries: [
        { binding: 0, resource: { buffer: this.bXBuffer } },
        { binding: 1, resource: { buffer: this.bYBuffer } },
        { binding: 2, resource: { buffer: this.bZBuffer } }
      ]
    });
    this.bindGroupCUniforms = device.createBindGroup({
      layout: this.layoutCUniforms,
      entries: [{ binding: 0, resource: { buffer: this.cUniformsBuffer } }]
    });
    this.bindGroupFStorage = device.createBindGroup({
      layout: this.layoutFStorage,
      entries: [
        { binding: 0, resource: { buffer: this.fXBuffer } },
        { binding: 1, resource: { buffer: this.fYBuffer } },
        { binding: 2, resource: { buffer: this.fZBuffer } }
      ]
    });
    this.bindGroupPassDUniforms = device.createBindGroup({
      layout: this.layoutUniformNBatchIdx,
      entries: [
        { binding: 0, resource: { buffer: this.passDNUniform } },
        { binding: 1, resource: { buffer: this.passDBatchIdxUniform } }
      ]
    });
    this.bindGroupFWindowsOutput = device.createBindGroup({
      layout: this.layoutBatchFinalPoints,
      entries: [
        { binding: 0, resource: { buffer: this.fWindowsXBuffer } },
        { binding: 1, resource: { buffer: this.fWindowsYBuffer } },
        { binding: 2, resource: { buffer: this.fWindowsZBuffer } }
      ]
    });
    this.bindGroupHornerUniforms = device.createBindGroup({
      layout: this.layoutHornerUniforms,
      entries: [{ binding: 0, resource: { buffer: this.hornerUniformsBuffer } }]
    });
    this.bindGroupFWindowsInput = device.createBindGroup({
      layout: this.layoutFStorage,
      entries: [
        { binding: 0, resource: { buffer: this.fWindowsXBuffer } },
        { binding: 1, resource: { buffer: this.fWindowsYBuffer } },
        { binding: 2, resource: { buffer: this.fWindowsZBuffer } }
      ]
    });
    this.bindGroupPassEN = device.createBindGroup({
      layout: this.layoutUniformSingle,
      entries: [{ binding: 0, resource: { buffer: this.passENUniform } }]
    });
    this.bindGroupFinalPoint = device.createBindGroup({
      layout: this.layoutFinalPoint,
      entries: [
        { binding: 0, resource: { buffer: this.finalPointXBuffer } },
        { binding: 1, resource: { buffer: this.finalPointYBuffer } }
      ]
    });
  }
  async run(scalars, points, config2) {
    const n = scalars.length;
    if (n === 0) throw new Error("scalars and points arrays cannot be empty");
    if (points.length !== n) throw new Error("scalars and points must have same length");
    const verbose = config2?.verbose ?? true;
    const numBatches = Math.ceil(n / this.maxChunkN);
    this.ensureBatchFinalPointsCapacity(numBatches);
    if (verbose) {
      console.log("=== Pippenger MSM Configuration ===");
      console.log(`Total points:         ${n}`);
      console.log(`Bucket width (bits):  ${this.bucketWidthBits}`);
      console.log(`Number of buckets:    ${this.numberOfBuckets}`);
      console.log(`Number of windows:    ${this.numWindows}`);
      console.log(`Max points per batch: ${this.maxChunkN}`);
      console.log(`Number of batches:    ${numBatches}`);
      console.log("===================================");
    }
    let passCountA = 0;
    let passCountBi1 = 0;
    let passCountBi2 = 0;
    let passCountC = 0;
    let passCountD = 0;
    let passCountHorner = 0;
    let passCountE = 0;
    let commandEncoder = this.device.createCommandEncoder();
    this.clearReusableState(commandEncoder, numBatches);
    this.device.queue.submit([commandEncoder.finish()]);
    commandEncoder = this.device.createCommandEncoder();
    for (let batchIdx = 0; batchIdx < numBatches; batchIdx++) {
      const batchOffset = batchIdx * this.maxChunkN;
      const currentBatchN = Math.min(n - batchOffset, this.maxChunkN);
      if (verbose) {
        console.log(`Batch ${batchIdx + 1}/${numBatches} (${currentBatchN} points)`);
      }
      this.packBatchInputs(scalars, points, batchOffset, currentBatchN);
      const usedHostLimbs = currentBatchN * LIMBS_PER_ELEMENT_256;
      this.device.queue.writeBuffer(
        this.kBuffer,
        0,
        this.kHost.buffer,
        0,
        usedHostLimbs * Uint32Array.BYTES_PER_ELEMENT
      );
      this.device.queue.writeBuffer(
        this.pxBuffer,
        0,
        this.pxHost.buffer,
        0,
        usedHostLimbs * Uint32Array.BYTES_PER_ELEMENT
      );
      this.device.queue.writeBuffer(
        this.pyBuffer,
        0,
        this.pyHost.buffer,
        0,
        usedHostLimbs * Uint32Array.BYTES_PER_ELEMENT
      );
      this.device.queue.writeBuffer(this.passANUniform, 0, new Uint32Array([currentBatchN]));
      {
        const numWG = Math.ceil(currentBatchN / WORKGROUP_SIZE_A);
        const pass = commandEncoder.beginComputePass();
        pass.setPipeline(this.pipelineA);
        pass.setBindGroup(0, this.bindGroupPassA);
        pass.dispatchWorkgroups(numWG);
        pass.end();
        passCountA++;
      }
      const numWorkgroupsBi1 = Math.ceil(currentBatchN / WORKGROUP_SIZE_BI1);
      for (let windowIdx = 0; windowIdx < this.numWindows; windowIdx++) {
        this.device.queue.writeBuffer(this.bi1WindowIdxBuffer, 0, new Uint32Array([windowIdx]));
        for (let bucketValue = 1; bucketValue < this.numberOfBuckets; bucketValue++) {
          this.device.queue.writeBuffer(this.bucketIdxUniform, 0, new Uint32Array([bucketValue]));
          {
            const pass = commandEncoder.beginComputePass();
            pass.setPipeline(this.pipelineBi1);
            pass.setBindGroup(0, this.bindGroupBi1Params);
            pass.setBindGroup(1, this.bindGroupBucketIdx);
            pass.setBindGroup(2, this.bindGroupPassBi1Input);
            pass.setBindGroup(3, this.bindGroupWGG);
            pass.dispatchWorkgroups(numWorkgroupsBi1);
            pass.end();
            passCountBi1++;
          }
          let currentNBi2 = numWorkgroupsBi1;
          while (currentNBi2 >= 1) {
            this.device.queue.writeBuffer(
              this.bi2UniformsBuffer,
              0,
              new Uint32Array([currentNBi2, windowIdx, this.numberOfBuckets, 0])
            );
            const numWG = Math.ceil(currentNBi2 / WORKGROUP_SIZE_BI2);
            const pass = commandEncoder.beginComputePass();
            pass.setPipeline(this.pipelineBi2);
            pass.setBindGroup(0, this.bindGroupBi2Uniforms);
            pass.setBindGroup(1, this.bindGroupBucketIdx);
            pass.setBindGroup(2, this.bindGroupWGG);
            pass.setBindGroup(3, this.bindGroupBucketsStorage);
            pass.dispatchWorkgroups(numWG);
            pass.end();
            passCountBi2++;
            if (currentNBi2 <= WORKGROUP_SIZE_BI2) {
              break;
            }
            currentNBi2 = Math.ceil(currentNBi2 / WORKGROUP_SIZE_BI2);
          }
          this.device.queue.submit([commandEncoder.finish()]);
          commandEncoder = this.device.createCommandEncoder();
        }
        this.device.queue.writeBuffer(
          this.cUniformsBuffer,
          0,
          new Uint32Array([windowIdx, this.numberOfBuckets])
        );
        {
          const numWG = Math.ceil(this.numberOfBuckets / WORKGROUP_SIZE_C);
          const pass = commandEncoder.beginComputePass();
          pass.setPipeline(this.pipelineC);
          pass.setBindGroup(0, this.bindGroupCUniforms);
          pass.setBindGroup(1, this.bindGroupBucketsStorage);
          pass.setBindGroup(2, this.bindGroupFStorage);
          pass.dispatchWorkgroups(numWG);
          pass.end();
          passCountC++;
        }
        let currentND = this.maxNumWorkgroupsC;
        while (currentND >= 1) {
          this.device.queue.writeBuffer(this.passDNUniform, 0, new Uint32Array([currentND]));
          this.device.queue.writeBuffer(
            this.passDBatchIdxUniform,
            0,
            new Uint32Array([windowIdx])
          );
          const numWG = Math.ceil(currentND / WORKGROUP_SIZE_D);
          const pass = commandEncoder.beginComputePass();
          pass.setPipeline(this.pipelineD);
          pass.setBindGroup(0, this.bindGroupPassDUniforms);
          pass.setBindGroup(1, this.bindGroupFStorage);
          pass.setBindGroup(2, this.bindGroupFWindowsOutput);
          pass.dispatchWorkgroups(numWG);
          pass.end();
          passCountD++;
          if (currentND <= WORKGROUP_SIZE_D) {
            break;
          }
          currentND = Math.ceil(currentND / WORKGROUP_SIZE_D);
        }
        this.device.queue.submit([commandEncoder.finish()]);
        commandEncoder = this.device.createCommandEncoder();
      }
      this.device.queue.writeBuffer(
        this.hornerUniformsBuffer,
        0,
        new Uint32Array([this.numWindows, this.bucketWidthBits, batchIdx, 0])
      );
      {
        const pass = commandEncoder.beginComputePass();
        pass.setPipeline(this.pipelineHorner);
        pass.setBindGroup(0, this.bindGroupHornerUniforms);
        pass.setBindGroup(1, this.bindGroupFWindowsInput);
        pass.setBindGroup(2, this.bindGroupBatchFinalPoints);
        pass.dispatchWorkgroups(1);
        pass.end();
        passCountHorner++;
      }
      this.device.queue.submit([commandEncoder.finish()]);
      commandEncoder = this.device.createCommandEncoder();
    }
    let currentNE = numBatches;
    while (currentNE >= 1) {
      this.device.queue.writeBuffer(this.passENUniform, 0, new Uint32Array([currentNE]));
      const pass = commandEncoder.beginComputePass();
      pass.setPipeline(this.pipelineE);
      pass.setBindGroup(0, this.bindGroupPassEN);
      pass.setBindGroup(1, this.bindGroupBatchFinalPoints);
      pass.setBindGroup(2, this.bindGroupFinalPoint);
      pass.dispatchWorkgroups(Math.ceil(currentNE / WORKGROUP_SIZE_E));
      pass.end();
      passCountE++;
      if (currentNE <= WORKGROUP_SIZE_E) {
        break;
      }
      currentNE = Math.ceil(currentNE / WORKGROUP_SIZE_E);
    }
    commandEncoder.copyBufferToBuffer(
      this.finalPointXBuffer,
      0,
      this.finalPointXStagingBuffer,
      0,
      BYTES_PER_ELEMENT_256
    );
    commandEncoder.copyBufferToBuffer(
      this.finalPointYBuffer,
      0,
      this.finalPointYStagingBuffer,
      0,
      BYTES_PER_ELEMENT_256
    );
    if (verbose) {
      console.log("\n--- Dispatches per Stage ---");
      console.log(`Pass A:      ${passCountA}`);
      console.log(`Pass Bi1:    ${passCountBi1}`);
      console.log(`Pass Bi2:    ${passCountBi2}`);
      console.log(`Pass C:      ${passCountC}`);
      console.log(`Pass D:      ${passCountD}`);
      console.log(`Pass Horner: ${passCountHorner}`);
      console.log(`Pass E:      ${passCountE}`);
      console.log(
        `TOTAL:       ${passCountA + passCountBi1 + passCountBi2 + passCountC + passCountD + passCountHorner + passCountE}`
      );
      console.log("============================\n");
    }
    this.device.queue.submit([commandEncoder.finish()]);
    await this.device.queue.onSubmittedWorkDone();
    await this.finalPointXStagingBuffer.mapAsync(GPUMapMode.READ);
    await this.finalPointYStagingBuffer.mapAsync(GPUMapMode.READ);
    const xView = new Uint32Array(this.finalPointXStagingBuffer.getMappedRange()).slice();
    const yView = new Uint32Array(this.finalPointYStagingBuffer.getMappedRange()).slice();
    this.finalPointXStagingBuffer.unmap();
    this.finalPointYStagingBuffer.unmap();
    return { x: limbs256ToBigint(xView), y: limbs256ToBigint(yView) };
  }
  destroy() {
    this.batchFinalPointsXBuffer?.destroy();
    this.batchFinalPointsYBuffer?.destroy();
    this.batchFinalPointsZBuffer?.destroy();
  }
  packBatchInputs(scalars, points, batchOffset, currentBatchN) {
    for (let i = 0; i < currentBatchN; i++) {
      const sourceIndex = batchOffset + i;
      const targetOffset = i * LIMBS_PER_ELEMENT_256;
      writeBigint256ToLimbs(scalars[sourceIndex], this.kHost, targetOffset);
      writeBigint256ToLimbs(points[sourceIndex].x, this.pxHost, targetOffset);
      writeBigint256ToLimbs(points[sourceIndex].y, this.pyHost, targetOffset);
    }
  }
  ensureBatchFinalPointsCapacity(numBatches) {
    if (numBatches <= this.batchFinalPointsCapacity) {
      return;
    }
    this.batchFinalPointsXBuffer?.destroy();
    this.batchFinalPointsYBuffer?.destroy();
    this.batchFinalPointsZBuffer?.destroy();
    const batchFinalPointsSize = Math.max(
      numBatches * BYTES_PER_ELEMENT_256,
      BYTES_PER_ELEMENT_256
    );
    this.batchFinalPointsXBuffer = this.createBuffer(
      batchFinalPointsSize,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    );
    this.batchFinalPointsYBuffer = this.createBuffer(
      batchFinalPointsSize,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    );
    this.batchFinalPointsZBuffer = this.createBuffer(
      batchFinalPointsSize,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    );
    this.bindGroupBatchFinalPoints = this.device.createBindGroup({
      layout: this.layoutBatchFinalPoints,
      entries: [
        { binding: 0, resource: { buffer: this.batchFinalPointsXBuffer } },
        { binding: 1, resource: { buffer: this.batchFinalPointsYBuffer } },
        { binding: 2, resource: { buffer: this.batchFinalPointsZBuffer } }
      ]
    });
    this.batchFinalPointsCapacity = numBatches;
  }
  clearReusableState(commandEncoder, numBatches) {
    const batchBytes = Math.max(numBatches * BYTES_PER_ELEMENT_256, BYTES_PER_ELEMENT_256);
    commandEncoder.clearBuffer(this.bXBuffer);
    commandEncoder.clearBuffer(this.bYBuffer);
    commandEncoder.clearBuffer(this.bZBuffer);
    commandEncoder.clearBuffer(this.fWindowsXBuffer);
    commandEncoder.clearBuffer(this.fWindowsYBuffer);
    commandEncoder.clearBuffer(this.fWindowsZBuffer);
    commandEncoder.clearBuffer(this.batchFinalPointsXBuffer, 0, batchBytes);
    commandEncoder.clearBuffer(this.batchFinalPointsYBuffer, 0, batchBytes);
    commandEncoder.clearBuffer(this.batchFinalPointsZBuffer, 0, batchBytes);
    commandEncoder.clearBuffer(this.finalPointXBuffer);
    commandEncoder.clearBuffer(this.finalPointYBuffer);
  }
  createBuffer(size, usage) {
    return this.device.createBuffer({ size, usage });
  }
  createUniformBufferWithData(values) {
    const buffer = this.device.createBuffer({
      size: values.length * 4,
      usage: GPUBufferUsage.UNIFORM,
      mappedAtCreation: true
    });
    new Uint32Array(buffer.getMappedRange()).set(values);
    buffer.unmap();
    return buffer;
  }
};

// src/benchmarks/pippenger_real_data.spec.ts
var Fp = 0x40000000000000000000000000000000224698fc094cf91b992d30ed00000001n;
var Fr = 0x40000000000000000000000000000000224698fc0994a8dd8c46eb2100000001n;
var PALLAS_G = pallasMakePoint(1n);
function fpMod(a) {
  return (a % Fp + Fp) % Fp;
}
function fpAdd(a, b) {
  return fpMod(a + b);
}
function fpSub(a, b) {
  return fpMod(a - b);
}
function fpMul(a, b) {
  return fpMod(a * b);
}
function fpPow(base, exp) {
  let result = 1n;
  base = fpMod(base);
  while (exp > 0n) {
    if (exp & 1n) result = fpMul(result, base);
    exp >>= 1n;
    base = fpMul(base, base);
  }
  return result;
}
function fpInv(a) {
  return fpPow(a, Fp - 2n);
}
function tonelliShanks(n) {
  if (n === 0n) return 0n;
  if (fpPow(n, (Fp - 1n) / 2n) !== 1n) return null;
  let q = Fp - 1n;
  let s = 0n;
  while ((q & 1n) === 0n) {
    q >>= 1n;
    s++;
  }
  let z = 2n;
  while (fpPow(z, (Fp - 1n) / 2n) !== Fp - 1n) z++;
  let m = s;
  let c = fpPow(z, q);
  let t = fpPow(n, q);
  let r = fpPow(n, (q + 1n) / 2n);
  while (true) {
    if (t === 1n) return r;
    let i = 1n;
    let tmp = fpMul(t, t);
    while (tmp !== 1n) {
      tmp = fpMul(tmp, tmp);
      i++;
    }
    const b = fpPow(c, fpPow(2n, m - i - 1n));
    m = i;
    c = fpMul(b, b);
    t = fpMul(t, c);
    r = fpMul(r, b);
  }
}
function pallasMakePoint(x) {
  const rhs = fpAdd(fpMul(fpMul(x, x), x), 5n);
  const y = tonelliShanks(rhs);
  if (y === null) throw new Error(`invalid Pallas point for x=${x}`);
  return { x, y, isInfinity: false };
}
var CPU_INFINITY = { x: 0n, y: 0n, isInfinity: true };
function cpuAdd(p, q) {
  if (p.isInfinity) return q;
  if (q.isInfinity) return p;
  if (p.x === q.x) {
    if (p.y !== q.y) return CPU_INFINITY;
    return cpuDouble(p);
  }
  const lambda = fpMul(fpSub(q.y, p.y), fpInv(fpSub(q.x, p.x)));
  const x3 = fpSub(fpSub(fpMul(lambda, lambda), p.x), q.x);
  const y3 = fpSub(fpMul(lambda, fpSub(p.x, x3)), p.y);
  return { x: x3, y: y3, isInfinity: false };
}
function cpuDouble(p) {
  if (p.isInfinity) return p;
  const lambda = fpMul(fpMul(3n, fpMul(p.x, p.x)), fpInv(fpMul(2n, p.y)));
  const x3 = fpSub(fpMul(lambda, lambda), fpMul(2n, p.x));
  const y3 = fpSub(fpMul(lambda, fpSub(p.x, x3)), p.y);
  return { x: x3, y: y3, isInfinity: false };
}
function cpuScalarMul(k, p) {
  k = (k % Fr + Fr) % Fr;
  let r = CPU_INFINITY;
  let base = p;
  while (k > 0n) {
    if (k & 1n) r = cpuAdd(r, base);
    base = cpuDouble(base);
    k >>= 1n;
  }
  return r;
}
function cpuMSM(scalars, points) {
  let acc = CPU_INFINITY;
  for (let i = 0; i < scalars.length; i++) {
    acc = cpuAdd(acc, cpuScalarMul(scalars[i], points[i]));
  }
  return acc;
}
function deterministicScalar(i) {
  let x = BigInt(i + 1) * 0x9e3779b97f4a7c15n + 0xbf58476d1ce4e5b9n;
  x ^= x >> 30n;
  x *= 0xbf58476d1ce4e5b9n;
  x ^= x >> 27n;
  x *= 0x94d049bb133111ebn;
  x ^= x >> 31n;
  return x % (Fr - 1n) + 1n;
}
function buildDataset(n) {
  const scalars = new Array(n);
  const cpuPoints = new Array(n);
  const gpuPoints = new Array(n);
  let current = PALLAS_G;
  for (let i = 0; i < n; i++) {
    if (i > 0) current = cpuAdd(current, PALLAS_G);
    scalars[i] = deterministicScalar(i);
    cpuPoints[i] = current;
    gpuPoints[i] = { x: current.x, y: current.y };
  }
  return { scalars, cpuPoints, gpuPoints };
}
async function getDevice() {
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error("No WebGPU adapter found");
  return adapter.requestDevice();
}
function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
async function runGpuTimed(run, rounds) {
  const timingsMs = [];
  let result = await run();
  for (let i = 0; i < rounds; i++) {
    const start = performance.now();
    result = await run();
    timingsMs.push(performance.now() - start);
  }
  return { result, timingsMs };
}
function parsePositiveInt(value, fallback) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
function defaultBucketWidthBits(n) {
  if (n <= 1024) return 8;
  if (n <= 16384) return 10;
  return 12;
}
function readBenchmarkConfig() {
  const params = new URLSearchParams(window.location.search);
  const rounds = parsePositiveInt(params.get("rounds"), 3);
  const cpuMaxN = parsePositiveInt(params.get("cpuMaxN"), 1024);
  const forcedBucketWidthBits = params.get("bucketWidthBits");
  const forcedBucketWidth = forcedBucketWidthBits !== null ? parsePositiveInt(forcedBucketWidthBits, 8) : null;
  const sizesParam = params.get("sizes");
  const defaultCases = [
    { n: 128, bucketWidthBits: 8, verifyCpu: true },
    { n: 1024, bucketWidthBits: 8, verifyCpu: true },
    { n: 4096, bucketWidthBits: 8, verifyCpu: false },
    { n: 16384, bucketWidthBits: 10, verifyCpu: false }
  ];
  if (!sizesParam) {
    return { cases: defaultCases, rounds };
  }
  const sizes = sizesParam.split(",").map((value) => Number.parseInt(value.trim(), 10)).filter((value) => Number.isFinite(value) && value > 0);
  if (sizes.length === 0) {
    return { cases: defaultCases, rounds };
  }
  const cases = sizes.map((n) => ({
    n,
    bucketWidthBits: forcedBucketWidth ?? defaultBucketWidthBits(n),
    verifyCpu: n <= cpuMaxN
  }));
  return { cases, rounds };
}
var shouldRunDefaultBenchmark = !new URLSearchParams(window.location.search).get("dataset") && !new URLSearchParams(window.location.search).get("proofArtifact");
if (shouldRunDefaultBenchmark) {
  describe("Pippenger MSM benchmark with valid Pallas data", () => {
    it(
      "measures correctness on small sets and throughput on larger sets",
      async () => {
        const device = await getDevice();
        const { cases, rounds } = readBenchmarkConfig();
        for (const testCase of cases) {
          const { n, bucketWidthBits, verifyCpu } = testCase;
          const { scalars, cpuPoints, gpuPoints } = buildDataset(n);
          let cpuMs = null;
          console.log("");
          console.log(
            `=== Benchmark case: N=${n}, bucketWidthBits=${bucketWidthBits} ===`
          );
          let expected = null;
          if (verifyCpu) {
            const cpuStart = performance.now();
            expected = cpuMSM(scalars, cpuPoints);
            cpuMs = performance.now() - cpuStart;
            console.log(`CPU reference: ${cpuMs.toFixed(2)} ms`);
          } else {
            console.log("CPU reference skipped for this size");
          }
          const coldStart = performance.now();
          const coldResult = await pippengerMSMPallas(
            device,
            scalars,
            gpuPoints,
            { bucketWidthBits, verbose: false }
          );
          const coldMs = performance.now() - coldStart;
          console.log(`GPU cold run: ${coldMs.toFixed(2)} ms`);
          if (expected && !expected.isInfinity) {
            expect(coldResult.x).to.equal(expected.x, `cold run x for N=${n}`);
            expect(coldResult.y).to.equal(expected.y, `cold run y for N=${n}`);
          }
          const runner = createPippengerMSMPallasRunner(device, {
            bucketWidthBits
          });
          await runner.run(scalars, gpuPoints, { verbose: false });
          const { result, timingsMs } = await runGpuTimed(
            () => runner.run(scalars, gpuPoints, { verbose: false }),
            rounds
          );
          const medianMs = median(timingsMs);
          const avgMs = timingsMs.reduce((sum, value) => sum + value, 0) / timingsMs.length;
          const msmPerSecond = n / medianMs * 1e3;
          console.log(
            `GPU warm runs: ${timingsMs.map((ms) => ms.toFixed(2)).join(", ")} ms`
          );
          console.log(`GPU median warm run: ${medianMs.toFixed(2)} ms`);
          console.log(`GPU average warm run: ${avgMs.toFixed(2)} ms`);
          console.log(
            `Approx throughput: ${Math.round(msmPerSecond).toLocaleString()} scalar-point pairs/s`
          );
          if (cpuMs !== null) {
            console.log(
              `Speedup CPU/GPU cold: ${(cpuMs / coldMs).toFixed(2)}x`
            );
            console.log(
              `Speedup CPU/GPU warm median: ${(cpuMs / medianMs).toFixed(2)}x`
            );
          }
          if (expected && !expected.isInfinity) {
            expect(result.x).to.equal(expected.x, `warm run x for N=${n}`);
            expect(result.y).to.equal(expected.y, `warm run y for N=${n}`);
            console.log("Correctness: CPU/GPU match");
          } else if (expected?.isInfinity) {
            expect(result.x).to.equal(0n, `warm run x identity for N=${n}`);
            expect(result.y).to.equal(0n, `warm run y identity for N=${n}`);
            console.log("Correctness: CPU/GPU match on identity");
          }
        }
      },
      18e5
    );
  });
}

// src/gpu/256bit/vesta/curve.wgsl
var curve_default2 = "// curve.wgsl\n\n// @import types.wgsl\n\n// Vesta curve equation: y\xB2 = x\xB3 + 5\n\n// Vesta prime modulus (field size)\nconst PALLAS_P: array<u32, 8> = array<u32, 8>(\n    0x00000001u, 0x8C46EB21u, 0x0994A8DDu, 0x224698FCu,\n    0x00000000u, 0x00000000u, 0x00000000u, 0x40000000u\n);\n\n// Vesta R\xB2 mod p, used to convert numbers into Montgomery form for fast arithmetic\nconst PALLAS_R2: array<u32, 8> = array<u32, 8>(\n    0x0000000Fu, 0xFC9678FFu, 0x891A16E3u, 0x67BB433Du,\n    0x04CCF590u, 0x7FAE2310u, 0x7CCFDAA9u, 0x096D41AFu\n);\n\n// Pallas -p\u207B\xB9 mod 2^32, required for Montgomery reduction in field operations  \nconst PALLAS_MONT_INV32: u32 = 0xffffffffu;\n\n// Vesta curve coefficient 'a' in y\xB2 = x\xB3 + a*x + b (here a = 0 for Vesta)\nconst PALLAS_A: array<u32, 8> = array<u32, 8>(\n    0u, 0u, 0u, 0u, 0u, 0u, 0u, 0u\n);\n\n// Vesta curve coefficient 'b' in y\xB2 = x\xB3 + a*x + b (here b = 5 for Vesta)\nconst PALLAS_B: array<u32, 8> = array<u32, 8>(\n    0u, 0u, 0u, 0u, 0u, 0u, 0u, 5u\n);\n\n// Vesta p - 2, used for modular inverse computation\nconst PALLAS_P_MINUS_2: array<u32, 8> = array<u32, 8>(\n    0xFFFFFFFFu, 0x8C46EB20u, 0x0994A8DDu, 0x224698FCu,\n    0x00000000u, 0x00000000u, 0x00000000u, 0x40000000u\n);\n\n// Vesta r_mod_p : Montgomery representation of 1 (R mod p), used to initialize Z in projective points\nconst PALLAS_R_MOD_P: array<u32, 8> = array<u32, 8>(\n    0xFFFFFFFDu, 0x5B2B3E9Cu, 0xE3420567u, 0x992C350Bu,\n    0xFFFFFFFFu, 0xFFFFFFFFu, 0xFFFFFFFFu, 0x3FFFFFFFu\n);\n\n// Complete Vesta curve parameters as a Curve256 instance\nconst PALLAS_CURVE: Curve256 = Curve256(PALLAS_P, PALLAS_R2, PALLAS_MONT_INV32, PALLAS_A, PALLAS_B, PALLAS_P_MINUS_2, PALLAS_R_MOD_P);\n";

// src/gpu/256bit/vesta/pippenger_msm.wgslc.ts
var pippengerShaderPassAProjectiveConversion2 = `
${types_default}
${arithmetic_default}
${curve_default2}

@group(0) @binding(0) var<storage, read> x: array<Limbs256>;
@group(0) @binding(1) var<storage, read> y: array<Limbs256>;
@group(0) @binding(2) var<storage, read_write> Px: array<Limbs256>;
@group(0) @binding(3) var<storage, read_write> Py: array<Limbs256>;
@group(0) @binding(4) var<storage, read_write> Pz: array<Limbs256>;
@group(0) @binding(5) var<uniform> n: u32; 

const WORKGROUP_SIZE: u32 = 64u;

@compute @workgroup_size(WORKGROUP_SIZE)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let idx = gid.x;
    
    if (idx >= n) {
        return;
    }
    
    let P = to_projective_256(x[idx], y[idx], PALLAS_CURVE.r2, PALLAS_CURVE.mont_inv32, PALLAS_CURVE.p);
    Px[idx] = P.x;
    Py[idx] = P.y;
    Pz[idx] = P.z;
}
`;
var pippengerShaderPassBi1BucketScalarWeightedPointContribution2 = `
${types_default}
${arithmetic_default}
${curve_default2}

// Group 0: constant parameters (BUCKET_WIDTH_BITS never changes, window_idx changes per window)
@group(0) @binding(0) var<uniform> BUCKET_WIDTH_BITS: u32;
@group(0) @binding(1) var<uniform> window_idx: u32;

@group(1) @binding(0) var<uniform> bucket_idx: u32;

@group(2) @binding(0) var<storage, read> k: array<Limbs256>;
@group(2) @binding(1) var<storage, read> Px: array<Limbs256>;
@group(2) @binding(2) var<storage, read> Py: array<Limbs256>;
@group(2) @binding(3) var<storage, read> Pz: array<Limbs256>;

@group(3) @binding(0) var<storage, read_write> WGGx: array<Limbs256>;
@group(3) @binding(1) var<storage, read_write> WGGy: array<Limbs256>;
@group(3) @binding(2) var<storage, read_write> WGGz: array<Limbs256>;

const WORKGROUP_SIZE: u32 = 64u;

var<workgroup> WGLx: array<Limbs256, 64>;
var<workgroup> WGLy: array<Limbs256, 64>;
var<workgroup> WGLz: array<Limbs256, 64>;

@compute @workgroup_size(WORKGROUP_SIZE)
fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(workgroup_id) wgid: vec3<u32>) {
    let idx = gid.x;
    let workgroup_idx = wgid.x;
    let local_idx = gid.x % WORKGROUP_SIZE;

    // Initialize workgroup memory with identity points for all threads
    WGLx[local_idx] = IDENTITY_LIMBS_256;
    WGLy[local_idx] = IDENTITY_LIMBS_256;
    WGLz[local_idx] = IDENTITY_LIMBS_256;

    workgroupBarrier();

    // Only process valid indices, but all threads participate in reduction
    if (idx < arrayLength(&k)) {
        // Extract the scalar bits for this window (window_idx) \u2014 NOT bucket_idx.
        // bucket_idx is the VALUE we are looking for within this window.
        let bit_offset = window_idx * BUCKET_WIDTH_BITS;
        let limb_index = bit_offset / 32u;
        let bit_in_limb = bit_offset % 32u;
        let mask = (1u << BUCKET_WIDTH_BITS) - 1u;

        var k_ij = 0u;
        if (bit_in_limb + BUCKET_WIDTH_BITS) <= 32u {
            k_ij = (k[idx].limbs[limb_index] >> bit_in_limb) & mask;
        } else {
            let bits_in_first_limb = 32u - bit_in_limb;
            let low_bits = k[idx].limbs[limb_index] >> bit_in_limb;
            let high_bits = k[idx].limbs[limb_index + 1u] << bits_in_first_limb;
            k_ij = (low_bits | high_bits) & mask;
        }

        if (k_ij == bucket_idx) {
            WGLx[local_idx] = Px[idx];
            WGLy[local_idx] = Py[idx];
            WGLz[local_idx] = Pz[idx];
        }
    }
    
    workgroupBarrier();

    // Tree reduce the workgroup memory bucket values by binary halving
    var stride = WORKGROUP_SIZE / 2u;
    while (stride > 0u) {
        if (local_idx < stride) {
            let temp = point_add_proj_256(
                ProjectivePoint256(WGLx[local_idx], WGLy[local_idx], WGLz[local_idx]),
                ProjectivePoint256(WGLx[local_idx + stride], WGLy[local_idx + stride], WGLz[local_idx + stride]),
                PALLAS_CURVE.r2,
                PALLAS_CURVE.mont_inv32,
                PALLAS_CURVE.p
            );
            WGLx[local_idx] = temp.x;
            WGLy[local_idx] = temp.y;
            WGLz[local_idx] = temp.z;
        }
        workgroupBarrier();
        stride = stride / 2u;
    }

    // Set the global buffer based on the value of WGL_x,y,z[0] which contains the reduction
    if (local_idx == 0) {
        WGGx[workgroup_idx] = WGLx[0];
        WGGy[workgroup_idx] = WGLy[0];
        WGGz[workgroup_idx] = WGLz[0];
    }
}
`;
var pippengerShaderPassBi2TreeReduceBucket2 = `
${types_default}
${arithmetic_default}
${curve_default2}

// Group 0: reduction parameters \u2014 packed into one uniform struct to minimise bind-group slots.
struct Bi2Uniforms {
    n: u32,                 // WGG elements to reduce in this dispatch
    window_idx: u32,        // which window we are processing
    number_of_buckets: u32, // NUMBER_OF_BUCKETS = 1 << BUCKET_WIDTH_BITS
}
@group(0) @binding(0) var<uniform> bi2: Bi2Uniforms;

@group(1) @binding(0) var<uniform> bucket_idx: u32;

@group(2) @binding(0) var<storage, read_write> WGGx: array<Limbs256>;
@group(2) @binding(1) var<storage, read_write> WGGy: array<Limbs256>;
@group(2) @binding(2) var<storage, read_write> WGGz: array<Limbs256>;

@group(3) @binding(0) var<storage, read_write> Bx: array<Limbs256>;
@group(3) @binding(1) var<storage, read_write> By: array<Limbs256>;
@group(3) @binding(2) var<storage, read_write> Bz: array<Limbs256>;

// 64 threads \xD7 3 coordinates \xD7 8 limbs \xD7 4 bytes = 6,144 bytes \u2014 well within the 16 KB limit.
const WORKGROUP_SIZE: u32 = 64u;

var<workgroup> WGLx: array<Limbs256, WORKGROUP_SIZE>;
var<workgroup> WGLy: array<Limbs256, WORKGROUP_SIZE>;
var<workgroup> WGLz: array<Limbs256, WORKGROUP_SIZE>;

@compute @workgroup_size(WORKGROUP_SIZE)
fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>, @builtin(workgroup_id) wgid: vec3<u32>) {
    let idx = gid.x;
    let local_idx = lid.x;
    let workgroup_idx = wgid.x;
    let n = bi2.n;

    let workgroups_needed = (n + WORKGROUP_SIZE - 1u) / WORKGROUP_SIZE;
    if (workgroup_idx >= workgroups_needed) {
        return;
    }

    // Load WGG into workgroup-local memory, padding out-of-bounds with identity.
    if (idx >= n) {
        WGLx[local_idx] = IDENTITY_LIMBS_256;
        WGLy[local_idx] = IDENTITY_LIMBS_256;
        WGLz[local_idx] = IDENTITY_LIMBS_256;
    } else {
        WGLx[local_idx] = WGGx[idx];
        WGLy[local_idx] = WGGy[idx];
        WGLz[local_idx] = WGGz[idx];
    }

    workgroupBarrier(); // ensure all loads are visible before reduction starts

    // Standard binary tree reduction: stride halves each step.
    // FIX: was using "half = stride >> 1" as the partner offset which skipped the upper
    // half of the workgroup entirely.  The correct partner is local_idx + stride.
    var stride = WORKGROUP_SIZE / 2u;
    while (stride > 0u) {
        if (local_idx < stride) {
            let temp = point_add_proj_256(
                ProjectivePoint256(WGLx[local_idx], WGLy[local_idx], WGLz[local_idx]),
                ProjectivePoint256(WGLx[local_idx + stride], WGLy[local_idx + stride], WGLz[local_idx + stride]),
                PALLAS_CURVE.r2,
                PALLAS_CURVE.mont_inv32,
                PALLAS_CURVE.p
            );
            WGLx[local_idx] = temp.x;
            WGLy[local_idx] = temp.y;
            WGLz[local_idx] = temp.z;
        }
        workgroupBarrier();
        stride = stride / 2u;
    }

    // Thread 0 writes its workgroup's reduced result back to WGG.
    if (local_idx == 0u) {
        WGGx[workgroup_idx] = WGLx[0u];
        WGGy[workgroup_idx] = WGLy[0u];
        WGGz[workgroup_idx] = WGLz[0u];
    }

    // For the final pass (n fits in one workgroup), store the bucket result.
    // FIX: index into B using the 2-D (window, bucket) layout instead of a flat bucket_idx.
    if (idx == 0u && n <= WORKGROUP_SIZE) {
        let b_idx = bi2.window_idx * bi2.number_of_buckets + bucket_idx;
        Bx[b_idx] = WGGx[0u];
        By[b_idx] = WGGy[0u];
        Bz[b_idx] = WGGz[0u];
    }
}
`;
var pippengerShaderPassCBucketAggregation2 = `
${types_default}
${arithmetic_default}
${curve_default2}

// Group 0: per-window uniform parameters.
struct CUniforms {
    window_idx: u32,        // which window's buckets to aggregate
    number_of_buckets: u32, // NUMBER_OF_BUCKETS = 1 << BUCKET_WIDTH_BITS
}
@group(0) @binding(0) var<uniform> cu: CUniforms;

// B is now NUM_WINDOWS * NUMBER_OF_BUCKETS in size.
// B[window_idx * number_of_buckets + v] = sum of P_i where window w of scalar k_i equals v.
@group(1) @binding(0) var<storage, read_write> Bx: array<Limbs256>;
@group(1) @binding(1) var<storage, read_write> By: array<Limbs256>;
@group(1) @binding(2) var<storage, read_write> Bz: array<Limbs256>;

// F receives partial weighted sums (one entry per workgroup).
@group(2) @binding(0) var<storage, read_write> Fx: array<Limbs256>;
@group(2) @binding(1) var<storage, read_write> Fy: array<Limbs256>;
@group(2) @binding(2) var<storage, read_write> Fz: array<Limbs256>;

const WORKGROUP_SIZE: u32 = 64u;
var<workgroup> scaled: array<ProjectivePoint256, WORKGROUP_SIZE>;

@compute @workgroup_size(WORKGROUP_SIZE)
fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>, @builtin(workgroup_id) wgid: vec3<u32>) {
    let idx = gid.x;       // bucket value v within this window (0 .. number_of_buckets-1)
    let local_idx = lid.x;
    let workgroup_idx = wgid.x;
    let NB = cu.number_of_buckets;

    let workgroups_needed = (NB + WORKGROUP_SIZE - 1u) / WORKGROUP_SIZE;
    if (workgroup_idx >= workgroups_needed) {
        return;
    }

    // Step 1: Load B[window_idx * NB + idx] and apply Pippenger weight = idx (the bucket value).
    // Bucket 0 contributes nothing (scalar bits = 0 means the point is not in this bucket window).
    // FIX: weight = idx (the bucket value v), NOT NUM_BUCKETS - idx.
    if (idx == 0u || idx >= NB) {
        // Bucket 0 has weight 0; out-of-range threads hold identity.
        scaled[local_idx] = ProjectivePoint256(IDENTITY_LIMBS_256, IDENTITY_LIMBS_256, IDENTITY_LIMBS_256);
    } else {
        let b_idx = cu.window_idx * NB + idx;
        var weight = idx; // weight = bucket value v (1 .. NB-1)
        var accumulator = ProjectivePoint256(IDENTITY_LIMBS_256, IDENTITY_LIMBS_256, IDENTITY_LIMBS_256);
        var temp = ProjectivePoint256(Bx[b_idx], By[b_idx], Bz[b_idx]);

        // Binary scalar multiplication: weight * B[window_idx * NB + v]
        while (weight > 0u) {
            if ((weight & 1u) != 0u) {
                accumulator = point_add_proj_256(
                    accumulator, temp,
                    PALLAS_CURVE.r2, PALLAS_CURVE.mont_inv32, PALLAS_CURVE.p
                );
            }
            weight = weight >> 1u;
            if (weight > 0u) {
                temp = point_double_proj_256(
                    temp,
                    PALLAS_CURVE.r2, PALLAS_CURVE.mont_inv32, PALLAS_CURVE.p
                );
            }
        }
        scaled[local_idx] = accumulator;
    }

    workgroupBarrier();

    // Step 2: Tree reduction \u2014 sum all weighted bucket contributions within the workgroup.
    var stride = WORKGROUP_SIZE / 2u;
    while (stride > 0u) {
        if (local_idx < stride) {
            scaled[local_idx] = point_add_proj_256(
                scaled[local_idx],
                scaled[local_idx + stride],
                PALLAS_CURVE.r2, PALLAS_CURVE.mont_inv32, PALLAS_CURVE.p
            );
        }
        workgroupBarrier();
        stride = stride / 2u;
    }

    // Step 3: Thread 0 writes the partial weighted sum to F.
    // Pass D will reduce F[0..ceil(NB/64)-1] into a single S_w for this window.
    if (local_idx == 0u) {
        Fx[workgroup_idx] = scaled[0u].x;
        Fy[workgroup_idx] = scaled[0u].y;
        Fz[workgroup_idx] = scaled[0u].z;
    }
}
`;
var pippengerShaderPassDTreeReduceFinalPoint2 = `
${types_default}
${arithmetic_default}
${curve_default2}

// Uniform: number of points to reduce in this dispatch
@group(0) @binding(0) var<uniform> n: u32;
@group(0) @binding(1) var<uniform> batch_idx: u32;

// Storage: partially reduced points from Pass C
@group(1) @binding(0) var<storage, read_write> Fx: array<Limbs256>;
@group(1) @binding(1) var<storage, read_write> Fy: array<Limbs256>;
@group(1) @binding(2) var<storage, read_write> Fz: array<Limbs256>;

// Storage for batch final points (projective) - one per batch processed
@group(2) @binding(0) var<storage, read_write> batch_final_points_x: array<Limbs256>;
@group(2) @binding(1) var<storage, read_write> batch_final_points_y: array<Limbs256>;
@group(2) @binding(2) var<storage, read_write> batch_final_points_z: array<Limbs256>;

const WORKGROUP_SIZE: u32 = 64u;

var<workgroup> WGLx: array<Limbs256, WORKGROUP_SIZE>;
var<workgroup> WGLy: array<Limbs256, WORKGROUP_SIZE>;
var<workgroup> WGLz: array<Limbs256, WORKGROUP_SIZE>;

@compute @workgroup_size(WORKGROUP_SIZE)
fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>, @builtin(workgroup_id) wgid: vec3<u32>) {
    let idx = gid.x;
    let local_idx = lid.x;
    let workgroup_idx = wgid.x;

    // Number of workgroups needed
    let workgroups_needed = (n + WORKGROUP_SIZE - 1u) / WORKGROUP_SIZE;
    if (workgroup_idx >= workgroups_needed) { 
        return; // We don't need these threads
    }

    // Load points into local workgroup memory
    if (idx >= n) {
        WGLx[local_idx] = IDENTITY_LIMBS_256;
        WGLy[local_idx] = IDENTITY_LIMBS_256;
        WGLz[local_idx] = IDENTITY_LIMBS_256;
    } else {
        WGLx[local_idx] = Fx[idx];
        WGLy[local_idx] = Fy[idx];
        WGLz[local_idx] = Fz[idx];
    }

    workgroupBarrier();

    // Tree reduction within workgroup
    var stride = WORKGROUP_SIZE / 2u;
    while (stride > 0u) {
        if (local_idx < stride) {
            let temp = point_add_proj_256(
                ProjectivePoint256(WGLx[local_idx], WGLy[local_idx], WGLz[local_idx]),
                ProjectivePoint256(WGLx[local_idx + stride], WGLy[local_idx + stride], WGLz[local_idx + stride]),
                PALLAS_CURVE.r2,
                PALLAS_CURVE.mont_inv32,
                PALLAS_CURVE.p
            );
            WGLx[local_idx] = temp.x;
            WGLy[local_idx] = temp.y;
            WGLz[local_idx] = temp.z;
        }
        workgroupBarrier();
        stride = stride / 2u;
    }

    // Local thread 0 writes reduced result back to global Fx/y/z
    if (local_idx == 0u) {
        Fx[workgroup_idx] = WGLx[0];
        Fy[workgroup_idx] = WGLy[0];
        Fz[workgroup_idx] = WGLz[0];
    }

    // For the final pass (single workgroup), first global thread writes output
    if (idx == 0u && n <= WORKGROUP_SIZE) {
        batch_final_points_x[batch_idx] = Fx[0];
        batch_final_points_y[batch_idx] = Fy[0];
        batch_final_points_z[batch_idx] = Fz[0];
    }
}
`;
var pippengerShaderPassEFinalAccumulation2 = `
${types_default}
${arithmetic_default}
${curve_default2}

// Uniform: number of batch final points to reduce in this dispatch
@group(0) @binding(0) var<uniform> n: u32;

// Storage: batch final points from Pass D (projective)
@group(1) @binding(0) var<storage, read_write> batch_final_points_x: array<Limbs256>;
@group(1) @binding(1) var<storage, read_write> batch_final_points_y: array<Limbs256>;
@group(1) @binding(2) var<storage, read_write> batch_final_points_z: array<Limbs256>;

// Storage for final affine point
@group(2) @binding(0) var<storage, read_write> final_point_x: Limbs256;
@group(2) @binding(1) var<storage, read_write> final_point_y: Limbs256;

const WORKGROUP_SIZE: u32 = 64u;

var<workgroup> WGLx: array<Limbs256, WORKGROUP_SIZE>;
var<workgroup> WGLy: array<Limbs256, WORKGROUP_SIZE>;
var<workgroup> WGLz: array<Limbs256, WORKGROUP_SIZE>;

@compute @workgroup_size(WORKGROUP_SIZE)
fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>, @builtin(workgroup_id) wgid: vec3<u32>) {
    let idx = gid.x;
    let local_idx = lid.x;
    let workgroup_idx = wgid.x;

    // Number of workgroups needed
    let workgroups_needed = (n + WORKGROUP_SIZE - 1u) / WORKGROUP_SIZE;
    if (workgroup_idx >= workgroups_needed) { 
        return; // We don't need these threads
    }

    // Load batch final points into local workgroup memory
    if (idx >= n) {
        WGLx[local_idx] = IDENTITY_LIMBS_256;
        WGLy[local_idx] = IDENTITY_LIMBS_256;
        WGLz[local_idx] = IDENTITY_LIMBS_256;
    } else {
        WGLx[local_idx] = batch_final_points_x[idx];
        WGLy[local_idx] = batch_final_points_y[idx];
        WGLz[local_idx] = batch_final_points_z[idx];
    }

    workgroupBarrier();

    // Tree reduction within workgroup
    var stride = WORKGROUP_SIZE / 2u;
    while (stride > 0u) {
        if (local_idx < stride) {
            let temp = point_add_proj_256(
                ProjectivePoint256(WGLx[local_idx], WGLy[local_idx], WGLz[local_idx]),
                ProjectivePoint256(WGLx[local_idx + stride], WGLy[local_idx + stride], WGLz[local_idx + stride]),
                PALLAS_CURVE.r2,
                PALLAS_CURVE.mont_inv32,
                PALLAS_CURVE.p
            );
            WGLx[local_idx] = temp.x;
            WGLy[local_idx] = temp.y;
            WGLz[local_idx] = temp.z;
        }
        workgroupBarrier();
        stride = stride / 2u;
    }

    // Local thread 0 writes reduced result back to global batch_final_points
    if (local_idx == 0u) {
        batch_final_points_x[workgroup_idx] = WGLx[0];
        batch_final_points_y[workgroup_idx] = WGLy[0];
        batch_final_points_z[workgroup_idx] = WGLz[0];
    }

    // For the final pass (single workgroup), first global thread converts to affine and writes final output
    if (idx == 0u && n <= WORKGROUP_SIZE) {
        let finalProj = ProjectivePoint256(batch_final_points_x[0], batch_final_points_y[0], batch_final_points_z[0]);
        let finalAffine = to_affine_256(finalProj, PALLAS_CURVE.r2, PALLAS_CURVE.mont_inv32, PALLAS_CURVE.p, PALLAS_CURVE.p_minus_2);
        final_point_x = finalAffine.x;
        final_point_y = finalAffine.y;
    }
}
`;
var pippengerShaderPassHorner2 = `
${types_default}
${arithmetic_default}
${curve_default2}

struct HornerUniforms {
    num_windows: u32,
    bucket_width_bits: u32,
    batch_idx: u32,
}
@group(0) @binding(0) var<uniform> hu: HornerUniforms;

// F_windows[w] = S_w, the weighted bucket sum for window w.
@group(1) @binding(0) var<storage, read_write> fw_x: array<Limbs256>;
@group(1) @binding(1) var<storage, read_write> fw_y: array<Limbs256>;
@group(1) @binding(2) var<storage, read_write> fw_z: array<Limbs256>;

// Output: batch_final_points[batch_idx] = Horner result (projective).
@group(2) @binding(0) var<storage, read_write> batch_final_points_x: array<Limbs256>;
@group(2) @binding(1) var<storage, read_write> batch_final_points_y: array<Limbs256>;
@group(2) @binding(2) var<storage, read_write> batch_final_points_z: array<Limbs256>;

@compute @workgroup_size(1)
fn main() {
    let NW = hu.num_windows;
    let W  = hu.bucket_width_bits;

    // Initialise with the highest window's sum.
    var result = ProjectivePoint256(
        fw_x[NW - 1u],
        fw_y[NW - 1u],
        fw_z[NW - 1u]
    );

    // Horner descent: result = 2^W * result + S_{w}  for w = NW-2 .. 0
    var w: i32 = i32(NW) - 2;
    while (w >= 0) {
        // Multiply result by 2^W via W repeated doublings.
        for (var d = 0u; d < W; d = d + 1u) {
            result = point_double_proj_256(result, PALLAS_CURVE.r2, PALLAS_CURVE.mont_inv32, PALLAS_CURVE.p);
        }
        // Add S_w.
        let sw = ProjectivePoint256(fw_x[u32(w)], fw_y[u32(w)], fw_z[u32(w)]);
        result = point_add_proj_256(result, sw, PALLAS_CURVE.r2, PALLAS_CURVE.mont_inv32, PALLAS_CURVE.p);
        w = w - 1;
    }

    batch_final_points_x[hu.batch_idx] = result.x;
    batch_final_points_y[hu.batch_idx] = result.y;
    batch_final_points_z[hu.batch_idx] = result.z;
}
`;

// src/gpu/256bit/vesta/pippenger_msm.ts
var WORKGROUP_SIZE_A2 = 64;
var WORKGROUP_SIZE_BI12 = 64;
var WORKGROUP_SIZE_BI22 = 64;
var WORKGROUP_SIZE_C2 = 64;
var WORKGROUP_SIZE_D2 = 64;
var WORKGROUP_SIZE_E2 = 64;
var SCALAR_BITS2 = 256;
var runnerCache2 = /* @__PURE__ */ new WeakMap();
function normalizeBucketWidthBits2(config2) {
  const bucketWidthBits = config2?.bucketWidthBits ?? 8;
  if (bucketWidthBits < 1 || bucketWidthBits > 22) {
    throw new Error("bucketWidthBits must be 1\u201322");
  }
  return bucketWidthBits;
}
function createPippengerMSMVestaRunner(device, config2) {
  const bucketWidthBits = normalizeBucketWidthBits2(config2);
  let runnersByBucketWidth = runnerCache2.get(device);
  if (!runnersByBucketWidth) {
    runnersByBucketWidth = /* @__PURE__ */ new Map();
    runnerCache2.set(device, runnersByBucketWidth);
  }
  let runner = runnersByBucketWidth.get(bucketWidthBits);
  if (!runner) {
    runner = new PippengerMSMVestaRunner(device, bucketWidthBits);
    runnersByBucketWidth.set(bucketWidthBits, runner);
  }
  return runner;
}
async function pippengerMSMVesta(device, scalars, points, config2) {
  const runner = createPippengerMSMVestaRunner(device, config2);
  return runner.run(scalars, points, config2);
}
var PippengerMSMVestaRunner = class {
  constructor(device, bucketWidthBits) {
    this.batchFinalPointsCapacity = 0;
    this.device = device;
    this.bucketWidthBits = bucketWidthBits;
    this.numberOfBuckets = 1 << bucketWidthBits;
    this.numWindows = Math.ceil(SCALAR_BITS2 / bucketWidthBits);
    const maxBufferSize = device.limits.maxStorageBufferBindingSize;
    const maxWorkgroups = 65535;
    this.maxChunkN = Math.min(
      Math.floor(maxBufferSize / BYTES_PER_ELEMENT_256),
      maxWorkgroups * WORKGROUP_SIZE_BI12
    );
    this.maxNumWorkgroupsBi1 = Math.ceil(this.maxChunkN / WORKGROUP_SIZE_BI12);
    this.maxNumWorkgroupsC = Math.ceil(this.numberOfBuckets / WORKGROUP_SIZE_C2);
    this.kHost = new Uint32Array(this.maxChunkN * LIMBS_PER_ELEMENT_256);
    this.pxHost = new Uint32Array(this.maxChunkN * LIMBS_PER_ELEMENT_256);
    this.pyHost = new Uint32Array(this.maxChunkN * LIMBS_PER_ELEMENT_256);
    this.layoutPassA = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } }
      ]
    });
    this.layoutBi1Params = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } }
      ]
    });
    this.layoutUniformSingle = device.createBindGroupLayout({
      entries: [{ binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } }]
    });
    const layoutPassBi1Input = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } }
      ]
    });
    this.layoutWGG = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } }
      ]
    });
    this.layoutBi2Uniforms = device.createBindGroupLayout({
      entries: [{ binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } }]
    });
    this.layoutBucketsStorage = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } }
      ]
    });
    this.layoutCUniforms = device.createBindGroupLayout({
      entries: [{ binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } }]
    });
    this.layoutFStorage = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } }
      ]
    });
    this.layoutUniformNBatchIdx = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } }
      ]
    });
    this.layoutBatchFinalPoints = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } }
      ]
    });
    this.layoutHornerUniforms = device.createBindGroupLayout({
      entries: [{ binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } }]
    });
    this.layoutFinalPoint = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } }
      ]
    });
    const shaderModules = {
      A: device.createShaderModule({ code: pippengerShaderPassAProjectiveConversion2 }),
      Bi1: device.createShaderModule({ code: pippengerShaderPassBi1BucketScalarWeightedPointContribution2 }),
      Bi2: device.createShaderModule({ code: pippengerShaderPassBi2TreeReduceBucket2 }),
      C: device.createShaderModule({ code: pippengerShaderPassCBucketAggregation2 }),
      D: device.createShaderModule({ code: pippengerShaderPassDTreeReduceFinalPoint2 }),
      E: device.createShaderModule({ code: pippengerShaderPassEFinalAccumulation2 }),
      Horner: device.createShaderModule({ code: pippengerShaderPassHorner2 })
    };
    this.pipelineA = device.createComputePipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [this.layoutPassA] }),
      compute: { module: shaderModules.A, entryPoint: "main" }
    });
    this.pipelineBi1 = device.createComputePipeline({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [
          this.layoutBi1Params,
          this.layoutUniformSingle,
          layoutPassBi1Input,
          this.layoutWGG
        ]
      }),
      compute: { module: shaderModules.Bi1, entryPoint: "main" }
    });
    this.pipelineBi2 = device.createComputePipeline({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [
          this.layoutBi2Uniforms,
          this.layoutUniformSingle,
          this.layoutWGG,
          this.layoutBucketsStorage
        ]
      }),
      compute: { module: shaderModules.Bi2, entryPoint: "main" }
    });
    this.pipelineC = device.createComputePipeline({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [this.layoutCUniforms, this.layoutBucketsStorage, this.layoutFStorage]
      }),
      compute: { module: shaderModules.C, entryPoint: "main" }
    });
    this.pipelineD = device.createComputePipeline({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [
          this.layoutUniformNBatchIdx,
          this.layoutFStorage,
          this.layoutBatchFinalPoints
        ]
      }),
      compute: { module: shaderModules.D, entryPoint: "main" }
    });
    this.pipelineE = device.createComputePipeline({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [
          this.layoutUniformSingle,
          this.layoutBatchFinalPoints,
          this.layoutFinalPoint
        ]
      }),
      compute: { module: shaderModules.E, entryPoint: "main" }
    });
    this.pipelineHorner = device.createComputePipeline({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [
          this.layoutHornerUniforms,
          this.layoutFStorage,
          this.layoutBatchFinalPoints
        ]
      }),
      compute: { module: shaderModules.Horner, entryPoint: "main" }
    });
    const bBufferSize = this.numWindows * this.numberOfBuckets * BYTES_PER_ELEMENT_256;
    this.bXBuffer = this.createBuffer(bBufferSize, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    this.bYBuffer = this.createBuffer(bBufferSize, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    this.bZBuffer = this.createBuffer(bBufferSize, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    this.fWindowsXBuffer = this.createBuffer(
      this.numWindows * BYTES_PER_ELEMENT_256,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    );
    this.fWindowsYBuffer = this.createBuffer(
      this.numWindows * BYTES_PER_ELEMENT_256,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    );
    this.fWindowsZBuffer = this.createBuffer(
      this.numWindows * BYTES_PER_ELEMENT_256,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    );
    this.finalPointXBuffer = this.createBuffer(
      BYTES_PER_ELEMENT_256,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    );
    this.finalPointYBuffer = this.createBuffer(
      BYTES_PER_ELEMENT_256,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    );
    this.finalPointXStagingBuffer = this.createBuffer(
      BYTES_PER_ELEMENT_256,
      GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
    );
    this.finalPointYStagingBuffer = this.createBuffer(
      BYTES_PER_ELEMENT_256,
      GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
    );
    const u32Size = 4;
    this.bi1BucketWidthBitsBuffer = this.createUniformBufferWithData([bucketWidthBits]);
    this.bi1WindowIdxBuffer = this.createBuffer(u32Size, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    this.bucketIdxUniform = this.createBuffer(u32Size, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    this.bi2UniformsBuffer = this.createBuffer(16, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    this.passANUniform = this.createBuffer(u32Size, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    this.cUniformsBuffer = this.createBuffer(8, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    this.passDNUniform = this.createBuffer(u32Size, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    this.passDBatchIdxUniform = this.createBuffer(u32Size, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    this.passENUniform = this.createBuffer(u32Size, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    this.hornerUniformsBuffer = this.createBuffer(16, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    const perBatchBufferSize = this.maxChunkN * BYTES_PER_ELEMENT_256;
    this.kBuffer = this.createBuffer(perBatchBufferSize, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
    this.pxBuffer = this.createBuffer(perBatchBufferSize, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
    this.pyBuffer = this.createBuffer(perBatchBufferSize, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
    this.ppxBuffer = this.createBuffer(perBatchBufferSize, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    this.ppyBuffer = this.createBuffer(perBatchBufferSize, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    this.ppzBuffer = this.createBuffer(perBatchBufferSize, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    const wggSizeMax = this.maxNumWorkgroupsBi1 * BYTES_PER_ELEMENT_256;
    this.wggXBuffer = this.createBuffer(wggSizeMax, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    this.wggYBuffer = this.createBuffer(wggSizeMax, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    this.wggZBuffer = this.createBuffer(wggSizeMax, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    const fBufferSizeMax = this.maxNumWorkgroupsC * BYTES_PER_ELEMENT_256;
    this.fXBuffer = this.createBuffer(fBufferSizeMax, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    this.fYBuffer = this.createBuffer(fBufferSizeMax, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    this.fZBuffer = this.createBuffer(fBufferSizeMax, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    this.bindGroupPassA = device.createBindGroup({
      layout: this.layoutPassA,
      entries: [
        { binding: 0, resource: { buffer: this.pxBuffer } },
        { binding: 1, resource: { buffer: this.pyBuffer } },
        { binding: 2, resource: { buffer: this.ppxBuffer } },
        { binding: 3, resource: { buffer: this.ppyBuffer } },
        { binding: 4, resource: { buffer: this.ppzBuffer } },
        { binding: 5, resource: { buffer: this.passANUniform } }
      ]
    });
    this.bindGroupBi1Params = device.createBindGroup({
      layout: this.layoutBi1Params,
      entries: [
        { binding: 0, resource: { buffer: this.bi1BucketWidthBitsBuffer } },
        { binding: 1, resource: { buffer: this.bi1WindowIdxBuffer } }
      ]
    });
    this.bindGroupBucketIdx = device.createBindGroup({
      layout: this.layoutUniformSingle,
      entries: [{ binding: 0, resource: { buffer: this.bucketIdxUniform } }]
    });
    this.bindGroupPassBi1Input = device.createBindGroup({
      layout: layoutPassBi1Input,
      entries: [
        { binding: 0, resource: { buffer: this.kBuffer } },
        { binding: 1, resource: { buffer: this.ppxBuffer } },
        { binding: 2, resource: { buffer: this.ppyBuffer } },
        { binding: 3, resource: { buffer: this.ppzBuffer } }
      ]
    });
    this.bindGroupWGG = device.createBindGroup({
      layout: this.layoutWGG,
      entries: [
        { binding: 0, resource: { buffer: this.wggXBuffer } },
        { binding: 1, resource: { buffer: this.wggYBuffer } },
        { binding: 2, resource: { buffer: this.wggZBuffer } }
      ]
    });
    this.bindGroupBi2Uniforms = device.createBindGroup({
      layout: this.layoutBi2Uniforms,
      entries: [{ binding: 0, resource: { buffer: this.bi2UniformsBuffer } }]
    });
    this.bindGroupBucketsStorage = device.createBindGroup({
      layout: this.layoutBucketsStorage,
      entries: [
        { binding: 0, resource: { buffer: this.bXBuffer } },
        { binding: 1, resource: { buffer: this.bYBuffer } },
        { binding: 2, resource: { buffer: this.bZBuffer } }
      ]
    });
    this.bindGroupCUniforms = device.createBindGroup({
      layout: this.layoutCUniforms,
      entries: [{ binding: 0, resource: { buffer: this.cUniformsBuffer } }]
    });
    this.bindGroupFStorage = device.createBindGroup({
      layout: this.layoutFStorage,
      entries: [
        { binding: 0, resource: { buffer: this.fXBuffer } },
        { binding: 1, resource: { buffer: this.fYBuffer } },
        { binding: 2, resource: { buffer: this.fZBuffer } }
      ]
    });
    this.bindGroupPassDUniforms = device.createBindGroup({
      layout: this.layoutUniformNBatchIdx,
      entries: [
        { binding: 0, resource: { buffer: this.passDNUniform } },
        { binding: 1, resource: { buffer: this.passDBatchIdxUniform } }
      ]
    });
    this.bindGroupFWindowsOutput = device.createBindGroup({
      layout: this.layoutBatchFinalPoints,
      entries: [
        { binding: 0, resource: { buffer: this.fWindowsXBuffer } },
        { binding: 1, resource: { buffer: this.fWindowsYBuffer } },
        { binding: 2, resource: { buffer: this.fWindowsZBuffer } }
      ]
    });
    this.bindGroupHornerUniforms = device.createBindGroup({
      layout: this.layoutHornerUniforms,
      entries: [{ binding: 0, resource: { buffer: this.hornerUniformsBuffer } }]
    });
    this.bindGroupFWindowsInput = device.createBindGroup({
      layout: this.layoutFStorage,
      entries: [
        { binding: 0, resource: { buffer: this.fWindowsXBuffer } },
        { binding: 1, resource: { buffer: this.fWindowsYBuffer } },
        { binding: 2, resource: { buffer: this.fWindowsZBuffer } }
      ]
    });
    this.bindGroupPassEN = device.createBindGroup({
      layout: this.layoutUniformSingle,
      entries: [{ binding: 0, resource: { buffer: this.passENUniform } }]
    });
    this.bindGroupFinalPoint = device.createBindGroup({
      layout: this.layoutFinalPoint,
      entries: [
        { binding: 0, resource: { buffer: this.finalPointXBuffer } },
        { binding: 1, resource: { buffer: this.finalPointYBuffer } }
      ]
    });
  }
  async run(scalars, points, config2) {
    const n = scalars.length;
    if (n === 0) throw new Error("scalars and points arrays cannot be empty");
    if (points.length !== n) throw new Error("scalars and points must have same length");
    const verbose = config2?.verbose ?? true;
    const numBatches = Math.ceil(n / this.maxChunkN);
    this.ensureBatchFinalPointsCapacity(numBatches);
    if (verbose) {
      console.log("=== Pippenger MSM Configuration ===");
      console.log(`Total points:         ${n}`);
      console.log(`Bucket width (bits):  ${this.bucketWidthBits}`);
      console.log(`Number of buckets:    ${this.numberOfBuckets}`);
      console.log(`Number of windows:    ${this.numWindows}`);
      console.log(`Max points per batch: ${this.maxChunkN}`);
      console.log(`Number of batches:    ${numBatches}`);
      console.log("===================================");
    }
    let passCountA = 0;
    let passCountBi1 = 0;
    let passCountBi2 = 0;
    let passCountC = 0;
    let passCountD = 0;
    let passCountHorner = 0;
    let passCountE = 0;
    let commandEncoder = this.device.createCommandEncoder();
    this.clearReusableState(commandEncoder, numBatches);
    this.device.queue.submit([commandEncoder.finish()]);
    commandEncoder = this.device.createCommandEncoder();
    for (let batchIdx = 0; batchIdx < numBatches; batchIdx++) {
      const batchOffset = batchIdx * this.maxChunkN;
      const currentBatchN = Math.min(n - batchOffset, this.maxChunkN);
      if (verbose) {
        console.log(`Batch ${batchIdx + 1}/${numBatches} (${currentBatchN} points)`);
      }
      this.packBatchInputs(scalars, points, batchOffset, currentBatchN);
      const usedHostLimbs = currentBatchN * LIMBS_PER_ELEMENT_256;
      this.device.queue.writeBuffer(
        this.kBuffer,
        0,
        this.kHost.buffer,
        0,
        usedHostLimbs * Uint32Array.BYTES_PER_ELEMENT
      );
      this.device.queue.writeBuffer(
        this.pxBuffer,
        0,
        this.pxHost.buffer,
        0,
        usedHostLimbs * Uint32Array.BYTES_PER_ELEMENT
      );
      this.device.queue.writeBuffer(
        this.pyBuffer,
        0,
        this.pyHost.buffer,
        0,
        usedHostLimbs * Uint32Array.BYTES_PER_ELEMENT
      );
      this.device.queue.writeBuffer(this.passANUniform, 0, new Uint32Array([currentBatchN]));
      {
        const numWG = Math.ceil(currentBatchN / WORKGROUP_SIZE_A2);
        const pass = commandEncoder.beginComputePass();
        pass.setPipeline(this.pipelineA);
        pass.setBindGroup(0, this.bindGroupPassA);
        pass.dispatchWorkgroups(numWG);
        pass.end();
        passCountA++;
      }
      const numWorkgroupsBi1 = Math.ceil(currentBatchN / WORKGROUP_SIZE_BI12);
      for (let windowIdx = 0; windowIdx < this.numWindows; windowIdx++) {
        this.device.queue.writeBuffer(this.bi1WindowIdxBuffer, 0, new Uint32Array([windowIdx]));
        for (let bucketValue = 1; bucketValue < this.numberOfBuckets; bucketValue++) {
          this.device.queue.writeBuffer(this.bucketIdxUniform, 0, new Uint32Array([bucketValue]));
          {
            const pass = commandEncoder.beginComputePass();
            pass.setPipeline(this.pipelineBi1);
            pass.setBindGroup(0, this.bindGroupBi1Params);
            pass.setBindGroup(1, this.bindGroupBucketIdx);
            pass.setBindGroup(2, this.bindGroupPassBi1Input);
            pass.setBindGroup(3, this.bindGroupWGG);
            pass.dispatchWorkgroups(numWorkgroupsBi1);
            pass.end();
            passCountBi1++;
          }
          let currentNBi2 = numWorkgroupsBi1;
          while (currentNBi2 >= 1) {
            this.device.queue.writeBuffer(
              this.bi2UniformsBuffer,
              0,
              new Uint32Array([currentNBi2, windowIdx, this.numberOfBuckets, 0])
            );
            const numWG = Math.ceil(currentNBi2 / WORKGROUP_SIZE_BI22);
            const pass = commandEncoder.beginComputePass();
            pass.setPipeline(this.pipelineBi2);
            pass.setBindGroup(0, this.bindGroupBi2Uniforms);
            pass.setBindGroup(1, this.bindGroupBucketIdx);
            pass.setBindGroup(2, this.bindGroupWGG);
            pass.setBindGroup(3, this.bindGroupBucketsStorage);
            pass.dispatchWorkgroups(numWG);
            pass.end();
            passCountBi2++;
            if (currentNBi2 <= WORKGROUP_SIZE_BI22) {
              break;
            }
            currentNBi2 = Math.ceil(currentNBi2 / WORKGROUP_SIZE_BI22);
          }
          this.device.queue.submit([commandEncoder.finish()]);
          commandEncoder = this.device.createCommandEncoder();
        }
        this.device.queue.writeBuffer(
          this.cUniformsBuffer,
          0,
          new Uint32Array([windowIdx, this.numberOfBuckets])
        );
        {
          const numWG = Math.ceil(this.numberOfBuckets / WORKGROUP_SIZE_C2);
          const pass = commandEncoder.beginComputePass();
          pass.setPipeline(this.pipelineC);
          pass.setBindGroup(0, this.bindGroupCUniforms);
          pass.setBindGroup(1, this.bindGroupBucketsStorage);
          pass.setBindGroup(2, this.bindGroupFStorage);
          pass.dispatchWorkgroups(numWG);
          pass.end();
          passCountC++;
        }
        let currentND = this.maxNumWorkgroupsC;
        while (currentND >= 1) {
          this.device.queue.writeBuffer(this.passDNUniform, 0, new Uint32Array([currentND]));
          this.device.queue.writeBuffer(
            this.passDBatchIdxUniform,
            0,
            new Uint32Array([windowIdx])
          );
          const numWG = Math.ceil(currentND / WORKGROUP_SIZE_D2);
          const pass = commandEncoder.beginComputePass();
          pass.setPipeline(this.pipelineD);
          pass.setBindGroup(0, this.bindGroupPassDUniforms);
          pass.setBindGroup(1, this.bindGroupFStorage);
          pass.setBindGroup(2, this.bindGroupFWindowsOutput);
          pass.dispatchWorkgroups(numWG);
          pass.end();
          passCountD++;
          if (currentND <= WORKGROUP_SIZE_D2) {
            break;
          }
          currentND = Math.ceil(currentND / WORKGROUP_SIZE_D2);
        }
        this.device.queue.submit([commandEncoder.finish()]);
        commandEncoder = this.device.createCommandEncoder();
      }
      this.device.queue.writeBuffer(
        this.hornerUniformsBuffer,
        0,
        new Uint32Array([this.numWindows, this.bucketWidthBits, batchIdx, 0])
      );
      {
        const pass = commandEncoder.beginComputePass();
        pass.setPipeline(this.pipelineHorner);
        pass.setBindGroup(0, this.bindGroupHornerUniforms);
        pass.setBindGroup(1, this.bindGroupFWindowsInput);
        pass.setBindGroup(2, this.bindGroupBatchFinalPoints);
        pass.dispatchWorkgroups(1);
        pass.end();
        passCountHorner++;
      }
      this.device.queue.submit([commandEncoder.finish()]);
      commandEncoder = this.device.createCommandEncoder();
    }
    let currentNE = numBatches;
    while (currentNE >= 1) {
      this.device.queue.writeBuffer(this.passENUniform, 0, new Uint32Array([currentNE]));
      const pass = commandEncoder.beginComputePass();
      pass.setPipeline(this.pipelineE);
      pass.setBindGroup(0, this.bindGroupPassEN);
      pass.setBindGroup(1, this.bindGroupBatchFinalPoints);
      pass.setBindGroup(2, this.bindGroupFinalPoint);
      pass.dispatchWorkgroups(Math.ceil(currentNE / WORKGROUP_SIZE_E2));
      pass.end();
      passCountE++;
      if (currentNE <= WORKGROUP_SIZE_E2) {
        break;
      }
      currentNE = Math.ceil(currentNE / WORKGROUP_SIZE_E2);
    }
    commandEncoder.copyBufferToBuffer(
      this.finalPointXBuffer,
      0,
      this.finalPointXStagingBuffer,
      0,
      BYTES_PER_ELEMENT_256
    );
    commandEncoder.copyBufferToBuffer(
      this.finalPointYBuffer,
      0,
      this.finalPointYStagingBuffer,
      0,
      BYTES_PER_ELEMENT_256
    );
    if (verbose) {
      console.log("\n--- Dispatches per Stage ---");
      console.log(`Pass A:      ${passCountA}`);
      console.log(`Pass Bi1:    ${passCountBi1}`);
      console.log(`Pass Bi2:    ${passCountBi2}`);
      console.log(`Pass C:      ${passCountC}`);
      console.log(`Pass D:      ${passCountD}`);
      console.log(`Pass Horner: ${passCountHorner}`);
      console.log(`Pass E:      ${passCountE}`);
      console.log(
        `TOTAL:       ${passCountA + passCountBi1 + passCountBi2 + passCountC + passCountD + passCountHorner + passCountE}`
      );
      console.log("============================\n");
    }
    this.device.queue.submit([commandEncoder.finish()]);
    await this.device.queue.onSubmittedWorkDone();
    await this.finalPointXStagingBuffer.mapAsync(GPUMapMode.READ);
    await this.finalPointYStagingBuffer.mapAsync(GPUMapMode.READ);
    const xView = new Uint32Array(this.finalPointXStagingBuffer.getMappedRange()).slice();
    const yView = new Uint32Array(this.finalPointYStagingBuffer.getMappedRange()).slice();
    this.finalPointXStagingBuffer.unmap();
    this.finalPointYStagingBuffer.unmap();
    return { x: limbs256ToBigint(xView), y: limbs256ToBigint(yView) };
  }
  destroy() {
    this.batchFinalPointsXBuffer?.destroy();
    this.batchFinalPointsYBuffer?.destroy();
    this.batchFinalPointsZBuffer?.destroy();
  }
  packBatchInputs(scalars, points, batchOffset, currentBatchN) {
    for (let i = 0; i < currentBatchN; i++) {
      const sourceIndex = batchOffset + i;
      const targetOffset = i * LIMBS_PER_ELEMENT_256;
      writeBigint256ToLimbs(scalars[sourceIndex], this.kHost, targetOffset);
      writeBigint256ToLimbs(points[sourceIndex].x, this.pxHost, targetOffset);
      writeBigint256ToLimbs(points[sourceIndex].y, this.pyHost, targetOffset);
    }
  }
  ensureBatchFinalPointsCapacity(numBatches) {
    if (numBatches <= this.batchFinalPointsCapacity) {
      return;
    }
    this.batchFinalPointsXBuffer?.destroy();
    this.batchFinalPointsYBuffer?.destroy();
    this.batchFinalPointsZBuffer?.destroy();
    const batchFinalPointsSize = Math.max(
      numBatches * BYTES_PER_ELEMENT_256,
      BYTES_PER_ELEMENT_256
    );
    this.batchFinalPointsXBuffer = this.createBuffer(
      batchFinalPointsSize,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    );
    this.batchFinalPointsYBuffer = this.createBuffer(
      batchFinalPointsSize,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    );
    this.batchFinalPointsZBuffer = this.createBuffer(
      batchFinalPointsSize,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    );
    this.bindGroupBatchFinalPoints = this.device.createBindGroup({
      layout: this.layoutBatchFinalPoints,
      entries: [
        { binding: 0, resource: { buffer: this.batchFinalPointsXBuffer } },
        { binding: 1, resource: { buffer: this.batchFinalPointsYBuffer } },
        { binding: 2, resource: { buffer: this.batchFinalPointsZBuffer } }
      ]
    });
    this.batchFinalPointsCapacity = numBatches;
  }
  clearReusableState(commandEncoder, numBatches) {
    const batchBytes = Math.max(numBatches * BYTES_PER_ELEMENT_256, BYTES_PER_ELEMENT_256);
    commandEncoder.clearBuffer(this.bXBuffer);
    commandEncoder.clearBuffer(this.bYBuffer);
    commandEncoder.clearBuffer(this.bZBuffer);
    commandEncoder.clearBuffer(this.fWindowsXBuffer);
    commandEncoder.clearBuffer(this.fWindowsYBuffer);
    commandEncoder.clearBuffer(this.fWindowsZBuffer);
    commandEncoder.clearBuffer(this.batchFinalPointsXBuffer, 0, batchBytes);
    commandEncoder.clearBuffer(this.batchFinalPointsYBuffer, 0, batchBytes);
    commandEncoder.clearBuffer(this.batchFinalPointsZBuffer, 0, batchBytes);
    commandEncoder.clearBuffer(this.finalPointXBuffer);
    commandEncoder.clearBuffer(this.finalPointYBuffer);
  }
  createBuffer(size, usage) {
    return this.device.createBuffer({ size, usage });
  }
  createUniformBufferWithData(values) {
    const buffer = this.device.createBuffer({
      size: values.length * 4,
      usage: GPUBufferUsage.UNIFORM,
      mappedAtCreation: true
    });
    new Uint32Array(buffer.getMappedRange()).set(values);
    buffer.unmap();
    return buffer;
  }
};

// src/datasets/kimchiMsmDataset.ts
function kimchiMsmDatasetFromJson(dataset) {
  return {
    ...dataset,
    scalars: dataset.scalars.map((scalar) => BigInt(scalar)),
    points: dataset.points.map((point) => ({
      x: BigInt(point.x),
      y: BigInt(point.y)
    }))
  };
}
function kimchiMsmDatasetFileFromJson(file) {
  return {
    version: file.version,
    datasets: file.datasets.map(kimchiMsmDatasetFromJson)
  };
}

// src/benchmarks/kimchi_dataset_replay.spec.ts
var PALLAS_BASE_FIELD = 0x40000000000000000000000000000000224698fc094cf91b992d30ed00000001n;
var PALLAS_SCALAR_FIELD = 0x40000000000000000000000000000000224698fc0994a8dd8c46eb2100000001n;
var VESTA_BASE_FIELD = 0x40000000000000000000000000000000224698fc0994a8dd8c46eb2100000001n;
var VESTA_SCALAR_FIELD = 0x40000000000000000000000000000000224698fc094cf91b992d30ed00000001n;
var CPU_INFINITY2 = { x: 0n, y: 0n, isInfinity: true };
async function getDevice2() {
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error("No WebGPU adapter found");
  return adapter.requestDevice();
}
async function fetchDatasetFile() {
  const params = new URLSearchParams(window.location.search);
  const datasetPath = params.get("dataset");
  if (!datasetPath) return null;
  const response = await fetch(`/${datasetPath}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch dataset file: ${datasetPath}`);
  }
  return kimchiMsmDatasetFileFromJson(await response.json());
}
async function fetchCpuBenchmarkFile() {
  const params = new URLSearchParams(window.location.search);
  const cpuResultsPath = params.get("cpuResults");
  if (!cpuResultsPath) return null;
  const response = await fetch(`/${cpuResultsPath}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch CPU benchmark file: ${cpuResultsPath}`);
  }
  return await response.json();
}
function median2(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
function curveParams(curve) {
  return curve === "pallas" ? { baseField: PALLAS_BASE_FIELD, scalarField: PALLAS_SCALAR_FIELD } : { baseField: VESTA_BASE_FIELD, scalarField: VESTA_SCALAR_FIELD };
}
function fpMod2(a, modulus) {
  return (a % modulus + modulus) % modulus;
}
function fpSub2(a, b, modulus) {
  return fpMod2(a - b, modulus);
}
function fpMul2(a, b, modulus) {
  return fpMod2(a * b, modulus);
}
function fpPow2(base, exp, modulus) {
  let result = 1n;
  base = fpMod2(base, modulus);
  while (exp > 0n) {
    if (exp & 1n) result = fpMul2(result, base, modulus);
    exp >>= 1n;
    base = fpMul2(base, base, modulus);
  }
  return result;
}
function fpInv2(a, modulus) {
  return fpPow2(a, modulus - 2n, modulus);
}
function cpuAdd2(p, q, modulus) {
  if (p.isInfinity) return q;
  if (q.isInfinity) return p;
  if (p.x === q.x) {
    if (p.y !== q.y) return CPU_INFINITY2;
    return cpuDouble2(p, modulus);
  }
  const lambda = fpMul2(
    fpSub2(q.y, p.y, modulus),
    fpInv2(fpSub2(q.x, p.x, modulus), modulus),
    modulus
  );
  const x3 = fpSub2(fpSub2(fpMul2(lambda, lambda, modulus), p.x, modulus), q.x, modulus);
  const y3 = fpSub2(fpMul2(lambda, fpSub2(p.x, x3, modulus), modulus), p.y, modulus);
  return { x: x3, y: y3, isInfinity: false };
}
function cpuDouble2(p, modulus) {
  if (p.isInfinity) return p;
  const lambda = fpMul2(
    fpMul2(3n, fpMul2(p.x, p.x, modulus), modulus),
    fpInv2(fpMul2(2n, p.y, modulus), modulus),
    modulus
  );
  const x3 = fpSub2(fpMul2(lambda, lambda, modulus), fpMul2(2n, p.x, modulus), modulus);
  const y3 = fpSub2(fpMul2(lambda, fpSub2(p.x, x3, modulus), modulus), p.y, modulus);
  return { x: x3, y: y3, isInfinity: false };
}
function cpuScalarMul2(k, p, curve) {
  const { baseField, scalarField } = curveParams(curve);
  k = (k % scalarField + scalarField) % scalarField;
  let r = CPU_INFINITY2;
  let base = p;
  while (k > 0n) {
    if (k & 1n) r = cpuAdd2(r, base, baseField);
    base = cpuDouble2(base, baseField);
    k >>= 1n;
  }
  return r;
}
function cpuMSM2(scalars, points, curve) {
  const { baseField } = curveParams(curve);
  let acc = CPU_INFINITY2;
  for (let i = 0; i < scalars.length; i++) {
    acc = cpuAdd2(
      acc,
      cpuScalarMul2(scalars[i], { ...points[i], isInfinity: false }, curve),
      baseField
    );
  }
  return acc;
}
function pointMismatchSummary(gpu, cpu, curve) {
  const { baseField } = curveParams(curve);
  if (gpu.x === cpu.x && gpu.y === cpu.y) return null;
  const negCpuY = fpMod2(-cpu.y, baseField);
  if (gpu.x === cpu.x && gpu.y === negCpuY) {
    return "same x but negated y (gpu.y = -cpu.y mod p)";
  }
  return `x mismatch: gpu=${gpu.x} cpu=${cpu.x}; y mismatch: gpu=${gpu.y} cpu=${cpu.y}`;
}
async function runTimed(run, rounds) {
  const timingsMs = [];
  let result = await run();
  for (let i = 0; i < rounds; i++) {
    const start = performance.now();
    result = await run();
    timingsMs.push(performance.now() - start);
  }
  return { result, timingsMs };
}
function createRunner(device, curve) {
  return curve === "pallas" ? createPippengerMSMPallasRunner(device, { bucketWidthBits: 8 }) : createPippengerMSMVestaRunner(device, { bucketWidthBits: 8 });
}
async function runCold(device, curve, scalars, points) {
  return curve === "pallas" ? pippengerMSMPallas(device, scalars, points, {
    bucketWidthBits: 8,
    verbose: false
  }) : pippengerMSMVesta(device, scalars, points, {
    bucketWidthBits: 8,
    verbose: false
  });
}
var requestedDataset = new URLSearchParams(window.location.search).get("dataset");
if (requestedDataset) {
  describe("Kimchi MSM dataset replay", () => {
    it(
      "replays exported Kimchi MSM datasets",
      async () => {
        const datasetFile = await fetchDatasetFile();
        if (!datasetFile) {
          throw new Error("Dataset query parameter was set but no dataset file was loaded");
        }
        const params = new URLSearchParams(window.location.search);
        const roundsParam = params.get("rounds");
        const rounds = roundsParam ? Number.parseInt(roundsParam, 10) : 3;
        const cpuMaxNParam = params.get("cpuMaxN");
        const cpuMaxN = cpuMaxNParam ? Number.parseInt(cpuMaxNParam, 10) : 4096;
        const cpuBenchmarkFile = await fetchCpuBenchmarkFile();
        const cpuBenchmarks = new Map(
          (cpuBenchmarkFile?.results ?? []).map((entry) => [entry.label, entry])
        );
        const device = await getDevice2();
        for (const dataset of datasetFile.datasets) {
          console.log("");
          console.log(`=== Dataset: ${dataset.label} ===`);
          console.log(`Source: ${dataset.source}`);
          console.log(`Curve: ${dataset.curve}`);
          console.log(`MSM kind: ${dataset.msmKind}`);
          console.log(`Point count: ${dataset.pointCount}`);
          expect(dataset.scalars.length).to.equal(
            dataset.points.length,
            `${dataset.label} scalar/point length mismatch`
          );
          let cpuMs = null;
          let cpuColdMs = null;
          let cpuResult = null;
          const cpuBenchmark = cpuBenchmarks.get(dataset.label);
          if (cpuBenchmark) {
            cpuColdMs = cpuBenchmark.coldMs;
            cpuMs = cpuBenchmark.medianWarmMs;
            cpuResult = {
              x: BigInt(cpuBenchmark.result.x),
              y: BigInt(cpuBenchmark.result.y),
              isInfinity: false
            };
            console.log(`CPU wasm cold run: ${cpuColdMs.toFixed(2)} ms`);
            console.log(`CPU wasm median warm run: ${cpuMs.toFixed(2)} ms`);
          } else if (dataset.pointCount <= cpuMaxN) {
            const cpuStart = performance.now();
            cpuResult = cpuMSM2(
              dataset.scalars,
              dataset.points,
              dataset.curve
            );
            cpuMs = performance.now() - cpuStart;
            cpuColdMs = cpuMs;
            console.log(`CPU reference: ${cpuMs.toFixed(2)} ms`);
          } else {
            console.log("CPU reference skipped for this dataset");
          }
          const coldStart = performance.now();
          const coldResult = await runCold(
            device,
            dataset.curve,
            dataset.scalars,
            dataset.points
          );
          const coldMs = performance.now() - coldStart;
          console.log(`GPU cold run: ${coldMs.toFixed(2)} ms`);
          console.log(
            `Cold result x: ${coldResult.x.toString().slice(0, 24)}...`
          );
          const runner = createRunner(device, dataset.curve);
          await runner.run(dataset.scalars, dataset.points, {
            verbose: false
          });
          const { result, timingsMs } = await runTimed(
            () => runner.run(dataset.scalars, dataset.points, {
              verbose: false
            }),
            rounds
          );
          const medianMs = median2(timingsMs);
          console.log(
            `GPU warm runs: ${timingsMs.map((ms) => ms.toFixed(2)).join(", ")} ms`
          );
          console.log(`GPU median warm run: ${medianMs.toFixed(2)} ms`);
          console.log(
            `Warm result x: ${result.x.toString().slice(0, 24)}...`
          );
          if (cpuMs !== null && cpuResult !== null) {
            const mismatch = pointMismatchSummary(
              result,
              cpuResult,
              dataset.curve
            );
            expect(
              mismatch,
              mismatch === null ? void 0 : `${dataset.label} CPU/GPU mismatch: ${mismatch}`
            ).to.equal(null);
            console.log("Correctness: CPU/GPU match");
            if (cpuColdMs !== null) {
              console.log(
                `Speedup CPU/GPU cold: ${(cpuColdMs / coldMs).toFixed(2)}x`
              );
            }
            console.log(
              `Speedup CPU/GPU warm median: ${(cpuMs / medianMs).toFixed(2)}x`
            );
          }
        }
      },
      18e5
    );
  });
}

// src/datasets/kimchiProofArtifacts.ts
function pointFromJson(point) {
  if (point === null) return null;
  return {
    x: BigInt(point.x),
    y: BigInt(point.y)
  };
}
function kimchiProofArtifactFromJson(artifact) {
  return {
    ...artifact,
    publicInput: artifact.publicInput.map((value) => BigInt(value)),
    publicOutput: artifact.publicOutput.map((value) => BigInt(value)),
    commitments: {
      wComm: artifact.commitments.wComm.map((commitment) => ({
        unshifted: commitment.unshifted.map(pointFromJson)
      })),
      zComm: {
        unshifted: artifact.commitments.zComm.unshifted.map(pointFromJson)
      },
      tComm: {
        unshifted: artifact.commitments.tComm.unshifted.map(pointFromJson)
      }
    },
    openingProof: {
      lr: artifact.openingProof.lr.map((pair) => ({
        left: pointFromJson(pair.left),
        right: pointFromJson(pair.right)
      })),
      delta: pointFromJson(artifact.openingProof.delta),
      z1: BigInt(artifact.openingProof.z1),
      z2: BigInt(artifact.openingProof.z2),
      sg: pointFromJson(artifact.openingProof.sg)
    },
    prevChallenges: artifact.prevChallenges.map((challenge) => ({
      scalars: challenge.scalars.map((value) => BigInt(value)),
      commitment: {
        unshifted: challenge.commitment.unshifted.map(pointFromJson)
      }
    }))
  };
}
function kimchiProofArtifactFileFromJson(file) {
  return {
    version: file.version,
    artifacts: file.artifacts.map(kimchiProofArtifactFromJson)
  };
}

// src/datasets/kimchiProofArtifactReplay.ts
var PALLAS_BASE_FIELD2 = 0x40000000000000000000000000000000224698fc094cf91b992d30ed00000001n;
var PALLAS_SCALAR_FIELD2 = 0x40000000000000000000000000000000224698fc0994a8dd8c46eb2100000001n;
var VESTA_BASE_FIELD2 = 0x40000000000000000000000000000000224698fc0994a8dd8c46eb2100000001n;
function isList(node) {
  return Array.isArray(node);
}
function isAtom(node) {
  return typeof node === "string";
}
function tokenizeSexp(input) {
  const tokens = [];
  let current = "";
  for (const char of input) {
    if (char === "(" || char === ")") {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
      tokens.push(char);
      continue;
    }
    if (/\s/.test(char)) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }
  if (current.length > 0) {
    tokens.push(current);
  }
  return tokens;
}
function parseSexpTokens(tokens, cursor) {
  const token = tokens[cursor.index++];
  if (token === void 0) {
    throw new Error("Unexpected end of serialized proof while parsing S-expression");
  }
  if (token === "(") {
    const list = [];
    while (tokens[cursor.index] !== ")") {
      if (cursor.index >= tokens.length) {
        throw new Error("Unclosed list in serialized proof");
      }
      list.push(parseSexpTokens(tokens, cursor));
    }
    cursor.index++;
    return list;
  }
  if (token === ")") {
    throw new Error("Unexpected closing parenthesis in serialized proof");
  }
  return token;
}
function parseSerializedProofSexp(input) {
  const decoded = typeof Buffer !== "undefined" ? Buffer.from(input, "base64").toString("utf8") : decodeURIComponent(
    Array.from(
      atob(input),
      (char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`
    ).join("")
  );
  const tokens = tokenizeSexp(decoded);
  const cursor = { index: 0 };
  const parsed = parseSexpTokens(tokens, cursor);
  if (cursor.index !== tokens.length) {
    throw new Error("Trailing tokens after serialized proof root");
  }
  return parsed;
}
function findNamedInChildren(nodes, name) {
  for (const child of nodes) {
    if (isList(child) && child.length > 0 && isAtom(child[0]) && child[0] === name) {
      return child;
    }
  }
  return null;
}
function findDirectNamed(node, name) {
  if (!isList(node)) return null;
  const found = findNamedInChildren(node, name);
  if (found !== null) {
    return found;
  }
  if (node.length > 1 && isList(node[1])) {
    return findNamedInChildren(node[1], name);
  }
  return null;
}
function findRecursiveNamed(node, name) {
  if (!isList(node)) return null;
  if (node.length > 0 && isAtom(node[0]) && node[0] === name) {
    return node;
  }
  for (const child of node) {
    const found = findRecursiveNamed(child, name);
    if (found) return found;
  }
  return null;
}
function parseFieldAtom(atom) {
  if (!isAtom(atom)) {
    throw new Error("Expected field atom in serialized proof");
  }
  if (/^(0x)?[0-9a-fA-F]+$/.test(atom)) {
    return BigInt(atom.startsWith("0x") ? atom : `0x${atom}`);
  }
  return BigInt(atom);
}
function parsePoint(pointNode) {
  if (!isList(pointNode) || pointNode.length !== 2) {
    throw new Error("Expected affine point pair in serialized proof");
  }
  return {
    x: parseFieldAtom(pointNode[0]),
    y: parseFieldAtom(pointNode[1])
  };
}
function parsePointSequence(node) {
  if (!isList(node)) {
    throw new Error("Expected point sequence in serialized proof");
  }
  return node.map(parsePoint);
}
function parseCommNode(node) {
  if (node === null || node.length < 2) {
    return { unshifted: [] };
  }
  const payload = node[1];
  if (!isList(payload)) {
    return { unshifted: [parsePoint(payload)] };
  }
  if (payload.length === 0) {
    return { unshifted: [] };
  }
  if (isList(payload[0])) {
    return { unshifted: parsePointSequence(payload) };
  }
  return { unshifted: [parsePoint(payload)] };
}
function parseLrPairs(node) {
  if (node === null || node.length < 2 || !isList(node[1])) {
    return [];
  }
  return node[1].map((pair) => {
    if (!isList(pair) || pair.length !== 2) {
      throw new Error("Invalid LR pair in serialized proof");
    }
    return {
      left: parsePoint(pair[0]),
      right: parsePoint(pair[1])
    };
  });
}
function parsePointValue(node) {
  if (node === null || node.length < 2) return null;
  return parsePoint(node[1]);
}
function curveScalarField(curve) {
  return curve === "pallas" ? PALLAS_SCALAR_FIELD2 : PALLAS_BASE_FIELD2;
}
function curveBaseField(curve) {
  return curve === "pallas" ? PALLAS_BASE_FIELD2 : VESTA_BASE_FIELD2;
}
function mod(a, p) {
  return (a % p + p) % p;
}
function isPointOnCurve(point, curve) {
  const p = curveBaseField(curve);
  const lhs = mod(point.y * point.y, p);
  const rhs = mod(point.x * point.x * point.x + 5n, p);
  return lhs === rhs;
}
function isCoordinateInField(coordinate, curve) {
  const p = curveBaseField(curve);
  return coordinate >= 0n && coordinate < p;
}
function detectCurveFromPoints(points) {
  if (points.length === 0) return null;
  const pallasMatches = points.every(
    (point) => isCoordinateInField(point.x, "pallas") && isCoordinateInField(point.y, "pallas") && isPointOnCurve(point, "pallas")
  );
  if (pallasMatches) return "pallas";
  const vestaMatches = points.every(
    (point) => isCoordinateInField(point.x, "vesta") && isCoordinateInField(point.y, "vesta") && isPointOnCurve(point, "vesta")
  );
  if (vestaMatches) return "vesta";
  return null;
}
function labelSeed(label) {
  let seed = 0n;
  for (let i = 0; i < label.length; i++) {
    seed = (seed * 131n + BigInt(label.charCodeAt(i))) % PALLAS_SCALAR_FIELD2;
  }
  return seed;
}
function deriveSyntheticScalar(point, index, seed, modulus) {
  const mixed = seed + BigInt(index + 1) * 0x9e3779b97f4a7c15n + point.x * 0x10001n + point.y * 0x1000003n;
  const reduced = (mixed % modulus + modulus) % modulus;
  return reduced === 0n ? 1n : reduced;
}
function flattenCommitmentPoints(artifact) {
  return [
    ...artifact.commitments.wComm.flatMap((commitment) => commitment.unshifted),
    ...artifact.commitments.zComm.unshifted,
    ...artifact.commitments.tComm.unshifted
  ].filter((point) => point !== null);
}
function flattenOpeningPoints(artifact) {
  return [
    ...artifact.openingProof.lr.flatMap((pair) => [pair.left, pair.right]),
    artifact.openingProof.delta,
    artifact.openingProof.sg
  ].filter((point) => point !== null);
}
function enrichKimchiProofArtifact(artifact) {
  const hasStructuredPoints = artifact.commitments.wComm.length > 0 || artifact.commitments.zComm.unshifted.length > 0 || artifact.commitments.tComm.unshifted.length > 0 || artifact.openingProof.lr.length > 0 || artifact.openingProof.delta !== null || artifact.openingProof.sg !== null;
  if (hasStructuredPoints || artifact.serializedProof?.proof === void 0) {
    return artifact;
  }
  const root = parseSerializedProofSexp(artifact.serializedProof.proof);
  const proofNode = findRecursiveNamed(root, "proof");
  if (proofNode === null) {
    throw new Error(`Could not find proof node in serialized proof for ${artifact.label}`);
  }
  const commitmentsNode = findDirectNamed(proofNode, "commitments");
  const bulletproofNode = findRecursiveNamed(proofNode, "bulletproof");
  const parsedArtifact = {
    ...artifact,
    commitments: {
      wComm: parseCommNode(findDirectNamed(commitmentsNode, "w_comm")).unshifted.map(
        (point) => ({ unshifted: point === null ? [] : [point] })
      ),
      zComm: parseCommNode(findDirectNamed(commitmentsNode, "z_comm")),
      tComm: parseCommNode(findDirectNamed(commitmentsNode, "t_comm"))
    },
    openingProof: {
      ...artifact.openingProof,
      lr: parseLrPairs(findDirectNamed(bulletproofNode, "lr")),
      delta: parsePointValue(findDirectNamed(bulletproofNode, "delta")),
      z1: findDirectNamed(bulletproofNode, "z_1") !== null ? parseFieldAtom(findDirectNamed(bulletproofNode, "z_1")[1]) : artifact.openingProof.z1,
      z2: findDirectNamed(bulletproofNode, "z_2") !== null ? parseFieldAtom(findDirectNamed(bulletproofNode, "z_2")[1]) : artifact.openingProof.z2,
      sg: parsePointValue(
        findDirectNamed(bulletproofNode, "challenge_polynomial_commitment")
      )
    },
    prevChallenges: artifact.prevChallenges,
    metadata: {
      ...artifact.metadata,
      extractionMode: "serialized-proof-parser"
    }
  };
  const parsedPoints = [
    ...flattenCommitmentPoints(parsedArtifact),
    ...flattenOpeningPoints(parsedArtifact)
  ];
  const detectedCurve = detectCurveFromPoints(parsedPoints);
  if (detectedCurve !== null && detectedCurve !== parsedArtifact.curve) {
    parsedArtifact.curve = detectedCurve;
    parsedArtifact.metadata = {
      ...parsedArtifact.metadata,
      detectedCurve,
      curveOverriddenFromSerializedProof: true
    };
  }
  return parsedArtifact;
}
function summarizeKimchiProofArtifact(artifact) {
  let enriched = artifact;
  let parserError;
  try {
    enriched = enrichKimchiProofArtifact(artifact);
  } catch (error) {
    parserError = error instanceof Error ? error.message : String(error);
  }
  const commitmentPoints = flattenCommitmentPoints(enriched);
  const openingPoints = flattenOpeningPoints(enriched);
  const allPoints = [...commitmentPoints, ...openingPoints];
  const invalidFieldPoints = allPoints.filter(
    (point) => !isCoordinateInField(point.x, enriched.curve) || !isCoordinateInField(point.y, enriched.curve)
  );
  const offCurvePoints = allPoints.filter(
    (point) => isCoordinateInField(point.x, enriched.curve) && isCoordinateInField(point.y, enriched.curve) && !isPointOnCurve(point, enriched.curve)
  );
  return {
    label: enriched.label,
    source: enriched.source,
    curve: enriched.curve,
    extractionMode: enriched.metadata?.extractionMode ?? "unknown",
    serializedProofBytes: enriched.serializedProof?.proof.length ?? 0,
    commitmentPointCount: commitmentPoints.length,
    openingPointCount: openingPoints.length,
    totalReplayPointCount: commitmentPoints.length + openingPoints.length,
    prevChallengeCount: enriched.prevChallenges.length,
    invalidFieldPointCount: invalidFieldPoints.length,
    offCurvePointCount: offCurvePoints.length,
    firstInvalidFieldPoint: invalidFieldPoints.length > 0 ? invalidFieldPoints[0] : void 0,
    firstOffCurvePoint: offCurvePoints.length > 0 ? offCurvePoints[0] : void 0,
    parserError
  };
}
function kimchiProofArtifactToSyntheticDatasets(artifact) {
  let enriched;
  try {
    enriched = enrichKimchiProofArtifact(artifact);
  } catch {
    return [];
  }
  const modulus = curveScalarField(enriched.curve);
  const seed = labelSeed(enriched.label);
  const commitmentPoints = flattenCommitmentPoints(enriched);
  const openingPoints = flattenOpeningPoints(enriched);
  const buildDataset2 = (suffix, msmKind, points) => {
    if (points.length === 0) return null;
    return {
      version: 1,
      label: `${enriched.label}-${suffix}`,
      source: enriched.source,
      curve: enriched.curve,
      msmKind,
      pointCount: points.length,
      scalars: points.map(
        (point, index) => deriveSyntheticScalar(point, index, seed, modulus)
      ),
      points,
      metadata: {
        proofArtifact: enriched.label,
        extractionMode: String(enriched.metadata?.extractionMode ?? "unknown"),
        scalarMode: "derived-from-point-and-label"
      }
    };
  };
  return [
    buildDataset2(
      "commitments",
      "proof-commitments-synthetic",
      commitmentPoints
    ),
    buildDataset2("opening", "proof-opening-synthetic", openingPoints),
    buildDataset2(
      "all-points",
      "proof-all-points-synthetic",
      [...commitmentPoints, ...openingPoints]
    )
  ].filter((dataset) => dataset !== null);
}
function kimchiProofArtifactFileToSyntheticDatasetFile(file) {
  return {
    version: 1,
    datasets: file.artifacts.flatMap(kimchiProofArtifactToSyntheticDatasets)
  };
}
function summarizeKimchiProofArtifactFile(file) {
  return file.artifacts.map(summarizeKimchiProofArtifact);
}
function validateSyntheticDatasetPoints(dataset) {
  const invalidFieldPoints = dataset.points.filter(
    (point) => !isCoordinateInField(point.x, dataset.curve) || !isCoordinateInField(point.y, dataset.curve)
  );
  const offCurvePoints = dataset.points.filter(
    (point) => isCoordinateInField(point.x, dataset.curve) && isCoordinateInField(point.y, dataset.curve) && !isPointOnCurve(point, dataset.curve)
  );
  return {
    invalidFieldPointCount: invalidFieldPoints.length,
    offCurvePointCount: offCurvePoints.length,
    firstInvalidFieldPoint: invalidFieldPoints.length > 0 ? invalidFieldPoints[0] : void 0,
    firstOffCurvePoint: offCurvePoints.length > 0 ? offCurvePoints[0] : void 0
  };
}

// src/benchmarks/kimchi_proof_artifact_replay.spec.ts
var PALLAS_BASE_FIELD3 = 0x40000000000000000000000000000000224698fc094cf91b992d30ed00000001n;
var PALLAS_SCALAR_FIELD3 = 0x40000000000000000000000000000000224698fc0994a8dd8c46eb2100000001n;
var VESTA_BASE_FIELD3 = 0x40000000000000000000000000000000224698fc0994a8dd8c46eb2100000001n;
var VESTA_SCALAR_FIELD2 = 0x40000000000000000000000000000000224698fc094cf91b992d30ed00000001n;
async function getDevice3() {
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error("No WebGPU adapter found");
  return adapter.requestDevice();
}
async function fetchArtifactFile() {
  const params = new URLSearchParams(window.location.search);
  const artifactPath = params.get("proofArtifact");
  if (!artifactPath) return null;
  const response = await fetch(`/${artifactPath}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch proof artifact file: ${artifactPath}`);
  }
  return kimchiProofArtifactFileFromJson(await response.json());
}
function median3(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
function curveParams2(curve) {
  return curve === "pallas" ? { baseField: PALLAS_BASE_FIELD3, scalarField: PALLAS_SCALAR_FIELD3 } : { baseField: VESTA_BASE_FIELD3, scalarField: VESTA_SCALAR_FIELD2 };
}
function pointMismatchSummary2(gpu, cpu, curve) {
  const { baseField } = curveParams2(curve);
  if (gpu.x === cpu.x && gpu.y === cpu.y) return null;
  const negCpuY = fpMod3(-cpu.y, baseField);
  if (gpu.x === cpu.x && gpu.y === negCpuY) {
    return `same x but negated y (gpu.y = -cpu.y mod p)`;
  }
  return `x mismatch: gpu=${gpu.x} cpu=${cpu.x}; y mismatch: gpu=${gpu.y} cpu=${cpu.y}`;
}
function fpMod3(a, modulus) {
  return (a % modulus + modulus) % modulus;
}
function fpSub3(a, b, modulus) {
  return fpMod3(a - b, modulus);
}
function fpMul3(a, b, modulus) {
  return fpMod3(a * b, modulus);
}
function fpPow3(base, exp, modulus) {
  let result = 1n;
  base = fpMod3(base, modulus);
  while (exp > 0n) {
    if (exp & 1n) result = fpMul3(result, base, modulus);
    exp >>= 1n;
    base = fpMul3(base, base, modulus);
  }
  return result;
}
function fpInv3(a, modulus) {
  return fpPow3(a, modulus - 2n, modulus);
}
var CPU_INFINITY3 = { x: 0n, y: 0n, isInfinity: true };
function cpuAdd3(p, q, modulus) {
  if (p.isInfinity) return q;
  if (q.isInfinity) return p;
  if (p.x === q.x) {
    if (p.y !== q.y) return CPU_INFINITY3;
    return cpuDouble3(p, modulus);
  }
  const lambda = fpMul3(
    fpSub3(q.y, p.y, modulus),
    fpInv3(fpSub3(q.x, p.x, modulus), modulus),
    modulus
  );
  const x3 = fpSub3(fpSub3(fpMul3(lambda, lambda, modulus), p.x, modulus), q.x, modulus);
  const y3 = fpSub3(fpMul3(lambda, fpSub3(p.x, x3, modulus), modulus), p.y, modulus);
  return { x: x3, y: y3, isInfinity: false };
}
function cpuDouble3(p, modulus) {
  if (p.isInfinity) return p;
  const lambda = fpMul3(
    fpMul3(3n, fpMul3(p.x, p.x, modulus), modulus),
    fpInv3(fpMul3(2n, p.y, modulus), modulus),
    modulus
  );
  const x3 = fpSub3(fpMul3(lambda, lambda, modulus), fpMul3(2n, p.x, modulus), modulus);
  const y3 = fpSub3(fpMul3(lambda, fpSub3(p.x, x3, modulus), modulus), p.y, modulus);
  return { x: x3, y: y3, isInfinity: false };
}
function cpuScalarMul3(k, p, curve) {
  const { baseField, scalarField } = curveParams2(curve);
  k = (k % scalarField + scalarField) % scalarField;
  let r = CPU_INFINITY3;
  let base = p;
  while (k > 0n) {
    if (k & 1n) r = cpuAdd3(r, base, baseField);
    base = cpuDouble3(base, baseField);
    k >>= 1n;
  }
  return r;
}
function cpuMSM3(scalars, points, curve) {
  const { baseField } = curveParams2(curve);
  let acc = CPU_INFINITY3;
  for (let i = 0; i < scalars.length; i++) {
    acc = cpuAdd3(
      acc,
      cpuScalarMul3(scalars[i], { ...points[i], isInfinity: false }, curve),
      baseField
    );
  }
  return acc;
}
async function runTimed2(run, rounds) {
  const timingsMs = [];
  let result = await run();
  for (let i = 0; i < rounds; i++) {
    const start = performance.now();
    result = await run();
    timingsMs.push(performance.now() - start);
  }
  return { result, timingsMs };
}
function createRunner2(device, curve) {
  return curve === "pallas" ? createPippengerMSMPallasRunner(device, { bucketWidthBits: 8 }) : createPippengerMSMVestaRunner(device, { bucketWidthBits: 8 });
}
async function runCold2(device, curve, scalars, points) {
  return curve === "pallas" ? pippengerMSMPallas(device, scalars, points, {
    bucketWidthBits: 8,
    verbose: false
  }) : pippengerMSMVesta(device, scalars, points, {
    bucketWidthBits: 8,
    verbose: false
  });
}
var requestedArtifact = new URLSearchParams(window.location.search).get(
  "proofArtifact"
);
if (requestedArtifact) {
  describe("Kimchi proof artifact replay", () => {
    it(
      "parses proof artifacts and benchmarks replayable datasets",
      async () => {
        const artifactFile = await fetchArtifactFile();
        if (!artifactFile) {
          throw new Error(
            "proofArtifact query parameter was set but no artifact file was loaded"
          );
        }
        const summaries = summarizeKimchiProofArtifactFile(artifactFile);
        for (const summary of summaries) {
          console.log("");
          console.log(`=== Proof artifact: ${summary.label} ===`);
          console.log(`Curve: ${summary.curve}`);
          console.log(`Extraction mode: ${summary.extractionMode}`);
          console.log(`Commitment points: ${summary.commitmentPointCount}`);
          console.log(`Opening points: ${summary.openingPointCount}`);
          console.log(`Replayable points total: ${summary.totalReplayPointCount}`);
          console.log(`Invalid field points: ${summary.invalidFieldPointCount}`);
          console.log(`Off-curve points: ${summary.offCurvePointCount}`);
        }
        const datasetFile = kimchiProofArtifactFileToSyntheticDatasetFile(artifactFile);
        expect(datasetFile.datasets.length).to.be.greaterThan(
          0,
          "No synthetic replay datasets were generated from the proof artifacts"
        );
        const roundsParam = new URLSearchParams(window.location.search).get(
          "rounds"
        );
        const rounds = roundsParam ? Number.parseInt(roundsParam, 10) : 3;
        const cpuMaxNParam = new URLSearchParams(window.location.search).get(
          "cpuMaxN"
        );
        const cpuMaxN = cpuMaxNParam ? Number.parseInt(cpuMaxNParam, 10) : 4096;
        const device = await getDevice3();
        for (const dataset of datasetFile.datasets) {
          console.log("");
          console.log(`=== Synthetic dataset: ${dataset.label} ===`);
          console.log(`Curve: ${dataset.curve}`);
          console.log(`MSM kind: ${dataset.msmKind}`);
          console.log(`Point count: ${dataset.pointCount}`);
          const validation = validateSyntheticDatasetPoints(dataset);
          console.log(
            `Dataset invalid field points: ${validation.invalidFieldPointCount}`
          );
          console.log(
            `Dataset off-curve points: ${validation.offCurvePointCount}`
          );
          if (validation.invalidFieldPointCount > 0) {
            throw new Error(
              `${dataset.label} contains ${validation.invalidFieldPointCount} points with coordinates outside the ${dataset.curve} base field`
            );
          }
          if (validation.offCurvePointCount > 0) {
            throw new Error(
              `${dataset.label} contains ${validation.offCurvePointCount} points that are not on the ${dataset.curve} curve`
            );
          }
          expect(dataset.scalars.length).to.equal(
            dataset.points.length,
            `${dataset.label} scalar/point length mismatch`
          );
          let cpuMs = null;
          let cpuResult = null;
          if (dataset.pointCount <= cpuMaxN) {
            const cpuStart = performance.now();
            cpuResult = cpuMSM3(
              dataset.scalars,
              dataset.points,
              dataset.curve
            );
            cpuMs = performance.now() - cpuStart;
            console.log(`CPU reference: ${cpuMs.toFixed(2)} ms`);
          } else {
            console.log("CPU reference skipped for this dataset");
          }
          const coldStart = performance.now();
          const coldResult = await runCold2(
            device,
            dataset.curve,
            dataset.scalars,
            dataset.points
          );
          const coldMs = performance.now() - coldStart;
          console.log(`GPU cold run: ${coldMs.toFixed(2)} ms`);
          console.log(
            `Cold result x: ${coldResult.x.toString().slice(0, 24)}...`
          );
          const runner = createRunner2(device, dataset.curve);
          await runner.run(dataset.scalars, dataset.points, {
            verbose: false
          });
          const { result, timingsMs } = await runTimed2(
            () => runner.run(dataset.scalars, dataset.points, {
              verbose: false
            }),
            rounds
          );
          const medianMs = median3(timingsMs);
          console.log(
            `GPU warm runs: ${timingsMs.map((ms) => ms.toFixed(2)).join(", ")} ms`
          );
          console.log(`GPU median warm run: ${medianMs.toFixed(2)} ms`);
          if (cpuMs !== null && cpuResult !== null) {
            const mismatch = pointMismatchSummary2(
              result,
              cpuResult,
              dataset.curve
            );
            if (mismatch !== null) {
              console.log(
                `CPU/GPU mismatch detail for ${dataset.label}: ${mismatch}`
              );
              throw new Error(
                `${dataset.label} CPU/GPU mismatch: ${mismatch}`
              );
            }
            console.log(
              `Speedup CPU/GPU cold: ${(cpuMs / coldMs).toFixed(2)}x`
            );
            console.log(
              `Speedup CPU/GPU warm median: ${(cpuMs / medianMs).toFixed(2)}x`
            );
            console.log("Correctness: CPU/GPU match");
          }
          console.log(
            `Warm result x: ${result.x.toString().slice(0, 24)}...`
          );
        }
      },
      18e5
    );
  });
}

// src/benchmarks/o1js_browser_proving.spec.ts
function median4(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
async function timeRun(run) {
  const startMs = performance.now();
  const result = await run();
  return { result, elapsedMs: performance.now() - startMs };
}
var browserProving = new URLSearchParams(window.location.search).get("browserProving");
if (browserProving === "counter") {
  describe("Browser o1js proving", () => {
    it(
      "runs the real counter proving flow in the browser",
      async () => {
        const params = new URLSearchParams(window.location.search);
        const roundsParam = params.get("rounds");
        const rounds = roundsParam ? Number.parseInt(roundsParam, 10) : 1;
        if (!Number.isFinite(rounds) || rounds < 1) {
          throw new Error(`Invalid rounds parameter: ${roundsParam}`);
        }
        console.log(`[browser-proving] target=counter rounds=${rounds}`);
        const harnessModulePath = "/dist/src/proof/runCounterProof.js";
        const { createCounterProofHarness } = await import(harnessModulePath);
        const setup = await timeRun(async () => createCounterProofHarness());
        console.log(
          `[browser-proving] setup_total_ms=${setup.elapsedMs.toFixed(2)}`
        );
        const cold = await timeRun(async () => setup.result.proveIncrement());
        console.log(
          `[browser-proving] cold_prove_ms=${cold.elapsedMs.toFixed(2)} final_counter=${cold.result.finalCounter}`
        );
        const warmTimingsMs = [];
        let lastFinalCounter = cold.result.finalCounter;
        for (let i = 0; i < rounds; i++) {
          const warm = await timeRun(async () => setup.result.proveIncrement());
          warmTimingsMs.push(warm.elapsedMs);
          lastFinalCounter = warm.result.finalCounter;
          console.log(
            `[browser-proving] warm_prove_round=${i + 1} elapsed_ms=${warm.elapsedMs.toFixed(2)} final_counter=${warm.result.finalCounter}`
          );
        }
        console.log(
          `[browser-proving] warm_prove_runs_ms=${warmTimingsMs.map((value) => value.toFixed(2)).join(", ")}`
        );
        console.log(
          `[browser-proving] warm_prove_median_ms=${median4(warmTimingsMs).toFixed(2)}`
        );
        expect(lastFinalCounter).to.equal("0");
      },
      Infinity
    );
  });
}
/*! Bundled license information:

reflect-metadata/Reflect.js:
  (*! *****************************************************************************
  Copyright (C) Microsoft. All rights reserved.
  Licensed under the Apache License, Version 2.0 (the "License"); you may not use
  this file except in compliance with the License. You may obtain a copy of the
  License at http://www.apache.org/licenses/LICENSE-2.0
  
  THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
  KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
  WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
  MERCHANTABLITY OR NON-INFRINGEMENT.
  
  See the Apache Version 2.0 License for specific language governing permissions
  and limitations under the License.
  ***************************************************************************** *)

chai/index.js:
  (*!
   * Chai - flag utility
   * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
   * MIT Licensed
   *)
  (*!
   * Chai - test utility
   * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
   * MIT Licensed
   *)
  (*!
   * Chai - expectTypes utility
   * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
   * MIT Licensed
   *)
  (*!
   * Chai - getActual utility
   * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
   * MIT Licensed
   *)
  (*!
   * Chai - message composition utility
   * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
   * MIT Licensed
   *)
  (*!
   * Chai - transferFlags utility
   * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
   * MIT Licensed
   *)
  (*!
   * chai
   * http://chaijs.com
   * Copyright(c) 2011-2014 Jake Luer <jake@alogicalparadox.com>
   * MIT Licensed
   *)
  (*!
   * Chai - events utility
   * Copyright(c) 2011-2016 Jake Luer <jake@alogicalparadox.com>
   * MIT Licensed
   *)
  (*!
   * Chai - isProxyEnabled helper
   * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
   * MIT Licensed
   *)
  (*!
   * Chai - addProperty utility
   * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
   * MIT Licensed
   *)
  (*!
   * Chai - addLengthGuard utility
   * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
   * MIT Licensed
   *)
  (*!
   * Chai - getProperties utility
   * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
   * MIT Licensed
   *)
  (*!
   * Chai - proxify utility
   * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
   * MIT Licensed
   *)
  (*!
   * Chai - addMethod utility
   * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
   * MIT Licensed
   *)
  (*!
   * Chai - overwriteProperty utility
   * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
   * MIT Licensed
   *)
  (*!
   * Chai - overwriteMethod utility
   * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
   * MIT Licensed
   *)
  (*!
   * Chai - addChainingMethod utility
   * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
   * MIT Licensed
   *)
  (*!
   * Chai - overwriteChainableMethod utility
   * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
   * MIT Licensed
   *)
  (*!
   * Chai - compareByInspect utility
   * Copyright(c) 2011-2016 Jake Luer <jake@alogicalparadox.com>
   * MIT Licensed
   *)
  (*!
   * Chai - getOwnEnumerablePropertySymbols utility
   * Copyright(c) 2011-2016 Jake Luer <jake@alogicalparadox.com>
   * MIT Licensed
   *)
  (*!
   * Chai - getOwnEnumerableProperties utility
   * Copyright(c) 2011-2016 Jake Luer <jake@alogicalparadox.com>
   * MIT Licensed
   *)
  (*!
   * Chai - isNaN utility
   * Copyright(c) 2012-2015 Sakthipriyan Vairamani <thechargingvolcano@gmail.com>
   * MIT Licensed
   *)
  (*!
   * chai
   * Copyright(c) 2011 Jake Luer <jake@alogicalparadox.com>
   * MIT Licensed
   *)
  (*!
   * chai
   * Copyright(c) 2011-2014 Jake Luer <jake@alogicalparadox.com>
   * MIT Licensed
   *)
  (*! Bundled license information:
  
  deep-eql/index.js:
    (*!
     * deep-eql
     * Copyright(c) 2013 Jake Luer <jake@alogicalparadox.com>
     * MIT Licensed
     *)
    (*!
     * Check to see if the MemoizeMap has recorded a result of the two operands
     *
     * @param {Mixed} leftHandOperand
     * @param {Mixed} rightHandOperand
     * @param {MemoizeMap} memoizeMap
     * @returns {Boolean|null} result
    *)
    (*!
     * Set the result of the equality into the MemoizeMap
     *
     * @param {Mixed} leftHandOperand
     * @param {Mixed} rightHandOperand
     * @param {MemoizeMap} memoizeMap
     * @param {Boolean} result
    *)
    (*!
     * Primary Export
     *)
    (*!
     * The main logic of the `deepEqual` function.
     *
     * @param {Mixed} leftHandOperand
     * @param {Mixed} rightHandOperand
     * @param {Object} [options] (optional) Additional options
     * @param {Array} [options.comparator] (optional) Override default algorithm, determining custom equality.
     * @param {Array} [options.memoize] (optional) Provide a custom memoization object which will cache the results of
        complex objects for a speed boost. By passing `false` you can disable memoization, but this will cause circular
        references to blow the stack.
     * @return {Boolean} equal match
    *)
    (*!
     * Compare two Regular Expressions for equality.
     *
     * @param {RegExp} leftHandOperand
     * @param {RegExp} rightHandOperand
     * @return {Boolean} result
     *)
    (*!
     * Compare two Sets/Maps for equality. Faster than other equality functions.
     *
     * @param {Set} leftHandOperand
     * @param {Set} rightHandOperand
     * @param {Object} [options] (Optional)
     * @return {Boolean} result
     *)
    (*!
     * Simple equality for flat iterable objects such as Arrays, TypedArrays or Node.js buffers.
     *
     * @param {Iterable} leftHandOperand
     * @param {Iterable} rightHandOperand
     * @param {Object} [options] (Optional)
     * @return {Boolean} result
     *)
    (*!
     * Simple equality for generator objects such as those returned by generator functions.
     *
     * @param {Iterable} leftHandOperand
     * @param {Iterable} rightHandOperand
     * @param {Object} [options] (Optional)
     * @return {Boolean} result
     *)
    (*!
     * Determine if the given object has an @@iterator function.
     *
     * @param {Object} target
     * @return {Boolean} `true` if the object has an @@iterator function.
     *)
    (*!
     * Gets all iterator entries from the given Object. If the Object has no @@iterator function, returns an empty array.
     * This will consume the iterator - which could have side effects depending on the @@iterator implementation.
     *
     * @param {Object} target
     * @returns {Array} an array of entries from the @@iterator function
     *)
    (*!
     * Gets all entries from a Generator. This will consume the generator - which could have side effects.
     *
     * @param {Generator} target
     * @returns {Array} an array of entries from the Generator.
     *)
    (*!
     * Gets all own and inherited enumerable keys from a target.
     *
     * @param {Object} target
     * @returns {Array} an array of own and inherited enumerable keys from the target.
     *)
    (*!
     * Determines if two objects have matching values, given a set of keys. Defers to deepEqual for the equality check of
     * each key. If any value of the given key is not equal, the function will return false (early).
     *
     * @param {Mixed} leftHandOperand
     * @param {Mixed} rightHandOperand
     * @param {Array} keys An array of keys to compare the values of leftHandOperand and rightHandOperand against
     * @param {Object} [options] (Optional)
     * @return {Boolean} result
     *)
    (*!
     * Recursively check the equality of two Objects. Once basic sameness has been established it will defer to `deepEqual`
     * for each enumerable key in the object.
     *
     * @param {Mixed} leftHandOperand
     * @param {Mixed} rightHandOperand
     * @param {Object} [options] (Optional)
     * @return {Boolean} result
     *)
    (*!
     * Returns true if the argument is a primitive.
     *
     * This intentionally returns true for all objects that can be compared by reference,
     * including functions and symbols.
     *
     * @param {Mixed} value
     * @return {Boolean} result
     *)
  *)
*/
