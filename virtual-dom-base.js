import h from 'virtual-dom/h'
import diff from 'virtual-dom/diff'
import patch from 'virtual-dom/patch'
import createElement from 'virtual-dom/create-element'

let debug = false;

class Thunk {
  constructor(renderFn, state, shouldUpdate, name) {
    this.type = 'Thunk';
    this.renderFn = renderFn;
    this.state = state;
    this.shouldUpdate = shouldUpdate;
    this.name = name;
  }

  call_render() {
    return this.renderFn(this.state);
  }

  render(previous) {
    if (!previous) {
      return this.call_render();
    }
    if (previous.name != this.name) {
      return this.call_render();
    }
    var previousState = previous ? previous.state : null;
    if (this.state === undefined && previousState === undefined && previous.vnode) {
      return previous.vnode;
    }
    if (this.shouldUpdate(this.state, previousState)) {
      if (debug) {
        console.log('call render of ', this.name);
      }
      return this.call_render();
    }
    return previous.vnode;
  }
}

export function $pick_state(state) {
  return Object.defineProperty({
    state: state,
  }, '_pick_state', {
    __proto__: null,
    value: true,
  });
}

export class Component {
  constructor(state) {
    if (state != undefined && state._pick_state) {
      let pick = {};
      let keys = this.stateKeys();
      if (Array.isArray(keys)) {
        keys.forEach(key => {
          pick[key] = state.state[key];
        });
      } else {
        for (let key in keys) {
          pick[key] = state.state[keys[key]];
        }
      }
      state = pick;
    }
    this.thunk = this.newThunk(state);
    this.state = state;
  }

  stateKeys() {
    return [];
  }

  newThunk(state) {
    return new Thunk((state) => {
      let Hook = function(){}
      Hook.prototype.hook = (element, hook_name) => {
        this.element = element;
        this.elementChanged(element);
      };
      let vnode = h('v3-' + this.constructor.name, {
        'element-changed': new Hook(),
      }, [this.render(state)]);
      //let vnode = this.render(state);
      //vnode.properties['_v3_hook_'] = new Hook();
      return vnode;
    }, state, this.shouldUpdate.bind(this), this.constructor.name);
  }

  // abstract
  render(state) {
    return h();
  }

  bind(parent) {
    this.element = createElement(this.thunk);
    parent.appendChild(this.element);
  }

  setState(newState) {
    this.state = newState;
    if (this.element) {
      let newThunk = this.newThunk(this.state);
      let patches = diff(this.thunk, newThunk);
      this.element = patch(this.element, patches);
      this.thunk = newThunk;
    } else {
      console.warn('not bind');
    }
  }

  setStore(store) {
    store.setComponent(this);
  }

  // abstract
  elementChanged(element) {
    if (debug) {
      console.log('element changed', this.constructor.name);
    }
  }

  // abstract
  shouldUpdate(state, previousState) {
    return shouldUpdate(state, previousState);
  }
}

function shouldUpdate(state, previousState) {
  if (previousState === undefined && state === undefined) {
    // no state
    return true;
  }
  if (!previousState || !state) {
    return true;
  }
  let keys = Object.keys(state);
  let prevKeys = Object.keys(previousState);
  if (keys.length != prevKeys.length) {
    return true;
  }
  if (state.style) {
    state.state = computed(state.style);
  }
  for (let i = 0, len = keys.length; i < len; i++) {
    let key = keys[i];
    let value = state[key];
    let prevValue = previousState[key];
    if (value !== prevValue) {
      // skip explicitly specified
      if ((!is_none(value) && value._skip_in_should_update_check) 
          || (!is_none(prevValue) && prevValue._skip_in_should_update_check)) {
        continue;
      }
      // do deep compare
      if ((!is_none(value) && value._do_deep_compare) 
          || (!is_none(prevValue) && prevValue._do_deep_compare)) {
        if (boundedEqual(value, prevValue, -1)) {
          continue
        }
      }
      if (debug) {
        console.log('key changed:', key);
      }
      return true;
    }
  }
  return false;
}

function boundedEqual(a, b, n) {
  if (a === b) {
    return true;
  }
  if (n <= 0) {
    return a === b;
  }
  let aType = typeof a;
  let bType = typeof b;
  if (aType != bType) {
    return false;
  }
  switch (aType) {
  case 'object':
    let aKeys = Object.keys(a);
    let bKeys = Object.keys(b);
    if (aKeys.length != bKeys.length) {
      return false;
    }
    for (let i = 0, len = aKeys.length; i < len; i++) {
      let key = aKeys[i];
      if (!boundedEqual(a[key], b[key], n - 1)) {
        return false;
      }
    }
    return true;
  default:
    return boundedEqual(a, b, n - 1);
  }
}

function is_none(o) {
  return o === undefined || o === null;
}

function has_key(o, key) {
  if (is_none(o)) {
    return false;
  }
  return key in o;
}

export function constant(obj) {
  return Object.defineProperty(obj, '_skip_in_should_update_check', {
    __proto__: null,
    value: true,
  });
}

export function computed(obj) {
  return Object.defineProperty(obj, '_do_deep_compare', {
    __proto__: null,
    value: true,
  });
}

export class Store {
  constructor(initState) {
    this.state = initState;
    this.settingState = false;
  }

  emit(event, ...args) {
    let newState = event(this.state, ...args);
    if (newState !== undefined && newState !== null) {
      this.state = merge(this.state, newState);
      if (this.component && !this.settingState) {
        this.settingState = true; // avoid recursive call to setState
        this.component.setState(this.state);
        this.settingState = false;
      }
    }
    return this.state;
  }

  setComponent(component) {
    this.component = component;
  }

  emitter(...path) {
    return function(ev, ...args) {
      let res = this.emit(ev, ...args);
      for (let i = path.length - 1; i >= 0; i--) {
        res = {
          [path[i]]: res,
        };
      }
      return res;
    }
  }
}

export function e(selector, properties, children) {
  let type = typeof selector;
  if (type == 'string') {
    return h(selector, properties, children);
  } else if (type == 'function' && !selector.name) {
    return new Thunk(selector, properties, shouldUpdate, 'anonymous');
  } else {
    return new selector(properties).thunk;
  }
}

export var none = h('div', { style: { display: 'none' } });
export var clear = h('div', { style: { clear: 'both' } });

export let div = (args, subs) => h('div', args, subs);
export let p = (args, subs) => h('p', args, subs);
export let span = (args, subs) => h('span', args, subs);
export let ul = (args, subs) => h('ul', args, subs);
export let li = (args, subs) => h('li', args, subs);
export let form = (args, subs) => h('form', args, subs);
export let label = (args, subs) => h('label', args, subs);
export let input = (args, subs) => h('input', args, subs);
export let select = (args, subs) => h('select', args, subs);
export let option = (args, subs) => h('option', args, subs);
export let img = (args, subs) => h('img', args, subs);
export let button = (args, subs) => h('button', args, subs);

export function merge(a, b) {
  if (b === null || b === undefined) {
    return a;
  }
  if (a === b) {
    return a;
  }
  let aType = typeof a;
  let bType = typeof b;
  if (Array.isArray(a)) {
    aType = 'array';
  }
  if (Array.isArray(b)) {
    bType = 'array';
  }
  if (aType == 'object' && bType == 'object') {
    // the new object
    let obj = {};
    if (has_key(b, '>_<')) {
      // wildcard update
      for (let key in a) {
        obj[key] = apply_change(a[key], b['>_<']);
      }
    } else {
      // merge
      for (let key in b) {
        obj[key] = apply_change(a[key], b[key]); 
      }
      // copy keys in a but not in b
      for (let key in a) {
        if (has_key(obj, key)) {
          continue
        }
        obj[key] = a[key];
      }
    }
    return obj;
  } else if (aType == 'array' && bType == 'object') {
    // the new object
    let obj = [];
    let wildcard = b['>_<'];
    for (let i = 0, len = a.length; i < len; i++) {
      if (has_key(b, i)) {
        obj.push(apply_change(a[i], b[i]));
      } else if (wildcard !== undefined && wildcard !== null) {
        obj.push(apply_change(a[i], wildcard));
      } else {
        obj.push(a[i]);
      }
    }
    return obj;
  } else {
    return b;
  }
}

export function op_insert(elem, index = 0) {
  return Object.defineProperty({
    elem: elem,
    index: index,
  }, '_op_insert', {
    __proto__: null,
    value: true,
  });
}

export function op_remove(index) {
  return Object.defineProperty({
    index: index,
  }, '_op_remove', {
    __proto__: null,
    value: true,
  });
}

export function op_call(cb) {
  return Object.defineProperty({
    cb: cb,
  }, '_op_call', {
    __proto__: null,
    value: true,
  });
}

export let $filter = op_call;
export let $remove = op_remove;
export let $insert = op_insert;

function apply_change(left, right) {
  if (right === null || right === undefined) {
    return right;
  }
  if (right._op_insert) {
    if (is_none(left)) {
      left = [];
    }
    return insert(left, right.elem, right.index);
  } else if (right._op_call) {
    return right.cb(left);
  } else if (right._op_remove) {
    return remove(left, right.index);
  }
  return merge(left, right);
}

export function insert(ary, elem, index = 0) {
  if (index < 0) {
    index = ary.length + index + 1;
  }
  return [
    ...ary.slice(0, index),
    elem,
    ...ary.slice(index),
  ];
}

export function remove(ary, index) {
  return [
    ...ary.slice(0, index),
    ...ary.slice(index + 1),
  ];
}

export function get_url_params() {
  // from http://stackoverflow.com/a/2880929
  let match,
    pl     = /\+/g,  // Regex for replacing addition symbol with a space
    search = /([^&=]+)=?([^&]*)/g,
    decode = function (s) { return decodeURIComponent(s.replace(pl, " ")); },
    query  = window.location.search.substring(1);
  let urlParams = {};
  while (match = search.exec(query))
     urlParams[decode(match[1])] = decode(match[2]);
  return urlParams;
}