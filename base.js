import h from 'virtual-dom/h'
import diff from 'virtual-dom/diff'
import patch from 'virtual-dom/patch'
import createElement from 'virtual-dom/create-element'

let debug = true;

class Thunk {
  constructor(renderFn, state, shouldUpdate) {
    this.type = 'Thunk';
    this.renderFn = renderFn;
    this.state = state;
    this.shouldUpdate = shouldUpdate;
  }

  render(previous) {
    var previousState = previous ? previous.state : null;
    if (this.shouldUpdate(this.state, previousState)) {
      return this.renderFn(this.state);
    }
    return previous.vnode;
  }
}

export class Component {
  constructor(state) {
    this.thunk = this.newThunk(state);
  }

  newThunk(state) {
    return new Thunk((state) => {
      let Hook = function(){}
      Hook.prototype.hook = (node) => {
        this.node = node;
        this.nodeChanged(node);
      };
      let vnode = h(this.constructor.name, {
        'node-changed': new Hook(),
      }, [this.render(state)]);
      return vnode;
    }, state, this.shouldUpdate.bind(this));
  }

  render(state) {
    return h();
  }

  bind(parent) {
    this.node = createElement(this.thunk);
    parent.appendChild(this.node);
  }

  set(newState) {
    let newThunk = this.newThunk(newState);
    let patches = diff(this.thunk, newThunk);
    this.node = patch(this.node, patches);
    this.thunk = newThunk;
  }

  nodeChanged(node) {
    if (debug) {
      console.log('node changed', this.constructor.name);
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
          //console.log(this.constructor.name, 'diff at', key);
          return false;
        }
      }
      return true;
    default:
      return this.boundedEqual(a, b, n - 1);
    }
  }

  shouldUpdate(state, previousState) {
    if (previousState === undefined && state === undefined) {
      // no state
      return false;
    }
    if (!previousState || !state) {
      return true;
    }
    return !this.boundedEqual(state, previousState, 3);
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

export function div(...subs) {
  return h('div', {}, [...subs]);
}
