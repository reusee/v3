import h from 'virtual-dom/h'
import diff from 'virtual-dom/diff'
import patch from 'virtual-dom/patch'
import createElement from 'virtual-dom/create-element'

class Thunk {
  constructor(renderFn, state) {
    this.type = 'Thunk';
    this.renderFn = renderFn;
    this.state = state;
  }

  render(previous) {
    var previousState = previous ? previous.state : null;
    if (previousState === this.state) {
      return previous.vnode;
    }
    return this.renderFn(this.state);
  }
}

export class Component {
  constructor(state) {
    this.state = state || {};
    this.thunk = new Thunk(this.render, this.state);
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
    let newThunk = new Thunk(this.render, this.state);
    let patches = diff(this.thunk, newThunk);
    this.node = patch(this.node, patches);
    this.thunk = newThunk
  }

  name() {
    return 'Component'
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

