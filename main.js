import h from 'virtual-dom/h'
import diff from 'virtual-dom/diff'
import patch from 'virtual-dom/patch'
import createElement from 'virtual-dom/create-element'
import {createStore} from 'redux'
import Immutable from 'immutable'

class Thunk {
  constructor(renderFn, state) {
    this.type = 'Thunk';
    this.renderFn = renderFn;
    this.state = state;
  }

  render(previous) {
    var previousState = previous ? previous.state : null;
    if (Immutable.is(previousState, this.state)) {
      return previous.vnode;
    }
    return this.renderFn(this.state);
  }
}

class Component {
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

function e(selector, properties, children) {
  switch (typeof selector) {
  case 'string':
    return h(selector, properties, children);
  default:
    return new selector(properties).thunk;
  }
}

class App extends Component {
  name() { return 'App' }

  render(state) {
    return e('div', {}, [
        e(Label, {
          color: state.color,
          text: state.text,
        }),
        e(Button, Immutable.fromJS({
          text: 'Foo',
        })),
    ]);
  }
}

class Label extends Component {
  name() { return 'Label' }

  render(state) {
    return e('p', {
      style: {
        color: state.color,
      },
    }, [
      state.text,
    ]);
  }
}

class Button extends Component {
  name() { return 'Button' }

  render(state) {
    return e('button', {
      onclick: (ev) => {
        store.dispatch({type: 'tick'});
      },
    }, [state.get('text')]);
  }
}

let data = [
  {color: 'red', text: 'Hello'},
  {color: 'blue', text: 'World'},
];
let data_index = 0;

let store = createStore((state = data[data_index], action) => {
  switch (action.type) {
  case 'tick':
    data_index = -data_index + 1;
    return data[data_index];
  default:
    return state;
  }
});
store.subscribe(() => {
  app.set(store.getState());
});

let app = new App(data[data_index]);
app.bind(document.getElementById('app'));
