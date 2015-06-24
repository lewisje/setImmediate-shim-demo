;(function (global, undefined) {
'use strict';
var noNative, doc, slice, toString, timer, polyfill;
// See http://codeforhire.com/2013/09/21/setimmediate-and-messagechannel-broken-on-internet-explorer-10/
function notUseNative() {
  return global.navigator && /Trident/.test(global.navigator.userAgent);
}
// part of a pair of functions intended to isolate code that kills the optimizing compiler
// https://github.com/petkaantonov/bluebird/wiki/Optimization-killers
function functionize(func, arg) {
  switch (typeof func) {
    case 'string':
      return new Function(func, String(arg));
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
timer.wrap = function(handler) {
  var args = slice.call(arguments, 1);
  return function () {
    if (typeof handler === 'function') handler.apply(undefined, args);
    else functionize(String(handler))();
  };
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
  return function () {
    var handleId = timer.create(arguments);
    channel.port2.postMessage(handleId);
    return handleId;
  };
};
timer.polyfill.nextTick = function () {
  return function () {
    var handleId = timer.create(arguments);
    global.process.nextTick(timer.wrap(timer.run, handleId));
    return handleId;
  };
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
  if (global.addEventListener) global.addEventListener('message', onGlobalMessage, false);
  else global.attachEvent('onmessage', onGlobalMessage);
  return function () {
    var handleId = timer.create(arguments);
    global.postMessage(messagePrefix + handleId, '*');
    return handleId;
  };
};
timer.polyfill.readyStateChange = function () {
  var html = doc.documentElement;
  return function () {
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
  };
};
timer.polyfill.setTimeout = function () {
  return function () {
    var handleId = timer.create(arguments);
    global.setTimeout(timer.wrap(timer.run, handleId), 1);
    return handleId;
  };
};
function canUsePostMessage() {
  if (global.postMessage && !global.importScripts) {
    var asynch = true, oldOnMessage = global.onmessage;
    global.onmessage = function () {
      asynch = false;
    };
    global.postMessage('', '*');
    global.onmessage = oldOnMessage;
    return asynch;
  }
}
if (noNative) polyfill = 'setTimeout';
// Don't get fooled by e.g. browserify environments.
// For Node.js before 0.9
else if (toString.call(global.process) === '[object process]') polyfill = 'nextTick';
// For non-IE10 modern browsers
else if (canUsePostMessage()) polyfill = 'postMessage';
// For web workers, where supported
else if (global.MessageChannel) polyfill = 'messageChannel';
// For IE 6–8
else if (doc && ('onreadystatechange' in doc.createElement('script'))) polyfill = 'readyStateChange';
// For older browsers
else polyfill = 'setTimeout';
// If supported, we should attach to the prototype of global,
// since that is where setTimeout et al. live.
var attachTo = Object.getPrototypeOf && Object.getPrototypeOf(global);
attachTo = attachTo && attachTo.setTimeout ? attachTo : global;
attachTo.setImmediate = timer.polyfill[polyfill]();
attachTo.setImmediate.usepolyfill = polyfill;
attachTo.msSetImmediate = attachTo.setImmediate;
attachTo.clearImmediate = attachTo.msClearImmediate = timer.clear;
})(function(){return this||(1,eval)('this');}());
