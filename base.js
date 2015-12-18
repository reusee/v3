import h from 'virtual-dom/h'
import diff from 'virtual-dom/diff'
import patch from 'virtual-dom/patch'
import createElement from 'virtual-dom/create-element'

class Thunk {
  constructor(renderFn, state, shouldUpdate) {
    this.type = 'Thunk';
    this.renderFn = renderFn;
    this.state = state;
    this.shouldUpdate = shouldUpdate;
  }

  render(previous) {
    var previousState = previous ? previous.state : null;
    if (this.shouldUpdate(previousState)) {
      return this.renderFn(this.state);
    }
    return previous.vnode;
  }
}

export class Component {
  constructor(state) {
    this.state = state;
    this.name = this.constructor.name;
    this.thunk = new Thunk((state) => {
      return h(this.name, {}, [this.render(state)]);
    }, this.state, this.shouldUpdate);
  }

  render(state) {
    return h();
  }

  bind(root) {
    this.node = createElement(this.thunk);
    root.appendChild(this.node);
  }

  set(newState) {
    this.state = newState;
    let newThunk = new Thunk((state) => {
      return h(this.name, {}, [this.render(state)]);
    }, this.state, this.shouldUpdate);
    let patches = diff(this.thunk, newThunk);
    this.node = patch(this.node, patches);
    this.thunk = newThunk
  }

  shouldUpdate(previousState) {
    if (!previousState || !this.state) {
      return true;
    }
    let previousType = typeof previousState;
    let currentType = typeof this.state;
    if (previousType != currentType) {
      return true;
    }
    switch (currentType) {
    case 'object': // shallow check
      let previousKeys = Object.keys(previousState);
      let currentKeys = Object.keys(this.state);
      if (previousKeys.length != currentKeys.length) {
        return true;
      }
      let len = currentKeys.length;
      for (let i = 0; i < len; i++) {
        let key = currentKeys[i];
        if (previousState[key] !== this.state[key]) {
          return true;
        }
      }
      return false;
    default:
      return !(previousState === this.state);
    }
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

