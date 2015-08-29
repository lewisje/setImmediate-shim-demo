;(function (global, undefined) {
'use strict';
var defineProperty = Object.defineProperty, defProps = (function () {
    var //dom = document.createElement('div'), // Safari 5 doesn't support it on DOM nodes
      obj = {}; // IE 8 only supports `Object.defineProperty` on DOM elements
    try {defineProperty(obj, 'obj', obj); /*defineProperty(dom, 'obj', obj);*/ return 'obj' in obj/* && 'obj' in dom*/;}
    catch (_) {/*dom = */obj = null; return false;}
    finally {/*dom = */obj = null;}
  })(), Mutation = global.MutationObserver || global.WebKitMutationObserver,
  noNative, doc, slice, toString, timer, polyfill;
if (!defProps) { // simple implementation of Object.defineProperty
  defineProperty = function defineProperty(obj, key, attr) {
    if ('value' in attr) obj[key] = attr.value;
    else if ('get' in attr) obj[key] = attr['get'].call(obj);
  };
}
function defineConst(obj, key, val) {
  defineProperty(obj, key, {value: val});
}
function defineMethod(obj, key, func) {
  defineProperty(obj, key, {value: func, configurable: true, writable: true});
}
function isCallable(fn) {
  return typeof fn === 'function' || toString.call(fn) === '[object Function]' ||
    typeof fn === 'unknown' || (fn && typeof fn === 'object') || false; // 'unknown' means callable ActiveX in IE<9
}
function hasMethod(obj, key) {
  return key in obj && isCallable(obj[key]);
}
// See http://codeforhire.com/2013/09/21/setimmediate-and-messagechannel-broken-on-internet-explorer-10/
function notUseNative() {
  return global.navigator && /Trident/.test(global.navigator.userAgent);
}
// part of a pair of functions intended to isolate code that kills the optimizing compiler
// https://github.com/petkaantonov/bluebird/wiki/Optimization-killers
function functionize(func, arg) {
  switch (typeof func) {
    case 'string':
      return new Function(String(arg), func);
    case 'function':
      return func;
    default:
      return function () {return func;};
  }
}
// The first argument to the toCatch callback is the caught error;
// if toCatch is passed as a string, this argument must be named "e"
function trial(toTry, toCatch, toFinal) {
  var try1 = functionize(toTry),
    catch1 = functionize(toCatch, 'e'),
    final1 = functionize(toFinal);
  try {try1();}
  catch (e) {catch1(e);}
  finally {final1();}
}
noNative = notUseNative();
if (!noNative && (global.msSetImmediate || global.setImmediate)) {
  if (!global.setImmediate) {
    global.setImmediate = global.msSetImmediate;
    global.clearImmediate = global.msClearImmediate;
  }
  return;
}
doc = global.document;
slice = Array.prototype.slice;
toString = Object.prototype.toString;
timer = {polyfill: {}, nextId: 1, tasks: {}, lock: false};
timer.run = function (handleId) {
  var task;
  if (timer.lock) global.setTimeout(timer.wrap(timer.run, handleId), 0);
  else {
    task = timer.tasks[handleId];
    if (task) {
      timer.lock = true;
      trial(task, null, function () {
        timer.clear(handleId);
        timer.lock = false;
      });
    }
  }
};
timer.wrap = function (handler) {
  var args = slice.call(arguments, 1);
  function wrapped() {
    if (typeof handler === 'function') handler.apply(undefined, args);
    else functionize(String(handler))();
  }
  return wrapped;
};
timer.create = function(args) {
  timer.tasks[timer.nextId] = timer.wrap.apply(null, args);
  return timer.nextId++;
};
timer.clear = function(handleId) {
  delete timer.tasks[handleId];
};
timer.polyfill.messageChannel = function () {
  var channel = new global.MessageChannel();
  channel.port1.onmessage = function (event) {
    timer.run(Number(event.data));
  };
  function setImmediate() {
    var handleId = timer.create(arguments);
    channel.port2.postMessage(handleId);
    return handleId;
  }
  return setImmediate;
};
timer.polyfill.nextTick = function () {
  function setImmediate() {
    var handleId = timer.create(arguments);
    global.process.nextTick(timer.wrap(timer.run, handleId));
    return handleId;
  }
  return setImmediate;
};
timer.polyfill.postMessage = function () {
  var messagePrefix = 'setImmediate$' + Math.random() + '$',
    onGlobalMessage = function onGlobalMessage(event) {
      if (event.source === global &&
        typeof event.data === 'string' &&
        event.data.indexOf(messagePrefix) === 0) {
        timer.run(+event.data.slice(messagePrefix.length));
      }
    };
  if (hasMethod(global, 'addEventListener')) global.addEventListener('message', onGlobalMessage, false);
  else if (hasMethod(global, 'attachEvent')) global.attachEvent('onmessage', onGlobalMessage);
  else throw new Error('No suitable event model.');
  function setImmediate() {
    var handleId = timer.create(arguments);
    global.postMessage(messagePrefix + handleId, '*');
    return handleId;
  }
  return setImmediate;
};
// based on https://github.com/tildeio/rsvp.js/blob/master/lib/rsvp/asap.js
timer.polyfill.mutation = function () {
  var handleId = timer.create(arguments), called = 0,
    obs = new Mutation(handleId), elt = doc.createTextNode('');
  obs.observe(elt, {characterData: true});
  function setImmediate() {
    elt.data = (called = ++called % 2);
  }
  return setImmediate;
};
// based on https://github.com/Lcfvs/setImmediate/blob/master/setImmediate.js
timer.polyfill.image = function () {
  var src = '\0';
  src = 'data:image/gif;base64,R0lGODlhAQABAAAAADs=';
  function setImmediate() {
    var handleId = timer.create(arguments), image = new global.Image();
    image.onload =
    image.onerror = function () {
      timer.run(handleId);
    };
    image.src = src;
    return handleId;
  }
  return setImmediate;
};
timer.polyfill.readyStateChange = function () {
  var html = doc.documentElement;
  function setImmediate() {
    var handleId = timer.create(arguments),
      script = doc.createElement('script');
    script.onreadystatechange = function () {
      timer.run(handleId);
      script.onreadystatechange = null;
      html.removeChild(script);
      script = null;
    };
    html.appendChild(script);
    return handleId;
  }
  return setImmediate;
};
timer.polyfill.setTimeout = function () {
  function setImmediate() {
    var handleId = timer.create(arguments);
    global.setTimeout(timer.wrap(timer.run, handleId), 1);
    return handleId;
  }
  return setImmediate;
};
function canUsePostMessage() {
  if (hasMethod(global, 'postMessage') && !hasMethod(global, 'importScripts')) {
    var asynch = true, oldOnMessage = global.onmessage;
    global.onmessage = function () {
      asynch = false;
    };
    global.postMessage('', '*');
    global.onmessage = oldOnMessage;
    return asynch;
  }
}
// Don't get fooled by e.g. browserify environments.
// For Node.js before 0.9
if (toString.call(global.process) === '[object process]') polyfill = 'nextTick';
// For non-IE10 modern browsers
else if (canUsePostMessage()) polyfill = 'postMessage';
// For web workers, where supported
else if (!noNative && 'MessageChannel' in global) polyfill = 'messageChannel';
// For IE11, probably
else if (Mutation) polyfill = 'mutation';
// For IE 6-8, maybe older browsers
else if (doc && hasMethod(global, 'Image')) polyfill = 'image';
// For IE 6–8, in case image doesn't work
else if (doc && 'onreadystatechange' in doc.createElement('script')) polyfill = 'readyStateChange';
// For older browsers
else polyfill = 'setTimeout';
// If supported, we should attach to the prototype of global,
// since that is where setTimeout et al. live.
var attachTo = hasMethod(Object, 'getPrototypeOf') && Object.getPrototypeOf(global);
attachTo = attachTo && hasMethod(attachTo, 'setTimeout') ? attachTo : global;
defineMethod(attachTo, 'setImmediate', timer.polyfill[polyfill]());
defineConst(attachTo.setImmediate, 'usepolyfill', polyfill);
defineMethod(attachTo, 'msSetImmediate', attachTo.setImmediate);
defineMethod(attachTo, 'clearImmediate', timer.clear);
defineMethod(attachTo, 'msClearImmediate', attachTo.clearImmediate);
})(function(){return this||(1,eval)('this');}());
