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

  render(previous) {
    var previousState = previous ? previous.state : null;
    if (this.shouldUpdate(this.state, previousState)) {
      if (debug) {
        console.log('call render of ', this.name);
      }
      return this.renderFn(this.state);
    }
    return previous.vnode;
  }
}

export class Component {
  constructor(state) {
    this.thunk = this.newThunk(state);
    this._skip_keys = {};
    let keys = this.skipKeys();
    for (let i = 0; i < keys.length; i++) {
      this._skip_keys[keys[i]] = true;
    }
  }

  skipKeys() {
    return [];
  }

  newThunk(state) {
    return new Thunk((state) => {
      let Hook = function(){}
      Hook.prototype.hook = (element) => {
        this.element = element;
        this.elementChanged(element);
      };
      let vnode = h(this.constructor.name, {
        'element-changed': new Hook(),
      }, [this.render(state)]);
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
    let newThunk = this.newThunk(newState);
    let patches = diff(this.thunk, newThunk);
    this.element = patch(this.element, patches);
    this.thunk = newThunk;
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

  boundedEqual(a, b, n) {
    if (a === b) {
      return true;
    }
    if (n == 0) {
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
      let len = aKeys.length;
      for (let i = 0; i < len; i++) {
        let key = aKeys[i];
        if (!this.boundedEqual(a[key], b[key], n - 1)) {
          if (key.slice(0, 1) == 'on' && typeof a[key] == 'function' && typeof b[key] == 'function') {
            continue; // skip event handlers
          }
          return false;
        }
      }
      return true;
    default:
      return this.boundedEqual(a, b, n - 1);
    }
  }

  // abstract
  shouldUpdate(state, previousState) {
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
    for (let i = 0; i < keys.length; i++) {
      let key = keys[i];
      if (this._skip_keys[key]) {
        continue;
      }
      let value = state[key];
      let prevValue = previousState[key];
      if (value !== prevValue) {
        // skip event handler
        if (key.slice(0, 1) == 'on' && typeof value == 'function' && typeof prevValue == 'function') {
          continue;
        }
        // skip explicitly specified
        if ((value !== undefined && value._skip_in_should_update_check) 
            || (prevValue !== undefined && prevValue._skip_in_should_update_check)) {
          continue;
        }
        // do deep compare
        if ((value !== undefined && value._do_deep_compare) 
            || (prevValue !== undefined && prevValue._do_deep_compare)) {
          if (this.boundedEqual(value, prevValue, -1)) {
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
  constructor(initState, eventHandler) {
    this.state = initState;
    this.eventHandler = eventHandler;
  }

  emit(type, data) {
    this.state = this.eventHandler(this.state, type, data);
    if (this.component) {
      this.component.setState(this.state);
    }
  }

  setComponent(component) {
    this.component = component;
  }
}

export function e(selector, properties, children) {
  switch (typeof selector) {
  case 'string':
    return h(selector, properties, children);
  default:
    return new selector(properties).thunk;
  }
}

export var none = h('div', { style: { display: 'none' } });
export var clear = h('div', { style: { clear: 'both' } });

export let div = (args, subs) => h('div', args, subs);
export let span = (args, subs) => h('span', args, subs);
export let ul = (args, subs) => h('ul', args, subs);
export let li = (args, subs) => h('li', args, subs);
export let form = (args, subs) => h('form', args, subs);
export let label = (args, subs) => h('label', args, subs);
export let input = (args, subs) => h('input', args, subs);
export let select = (args, subs) => h('select', args, subs);
export let option = (args, subs) => h('option', args, subs);
export let img = (args, subs) => h('img', args, subs);

export function merge(a, b) {
  let aType = typeof a;
  let bType = typeof b;
  if (aType == 'object' && bType == 'object') {
    let obj = {};
    if (b['>_<']) {
      for (let key in a) {
        obj[key] = merge(a[key], b['>_<']);
      }
    } else {
      for (let key in b) {
        if (a[key]) {
          obj[key] = merge(a[key], b[key]);
        } else {
          obj[key] = b[key];
        }
      }
      for (let key in a) {
        if (key in obj) {
          continue
        }
        obj[key] = a[key];
      }
    }
    return obj;
  } else {
    return b;
  }
}

