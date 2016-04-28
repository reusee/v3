import {e, div, p, button,
  Component, Store} from './base'

class App extends Component {
  render(state) {
    return div({}, [
        e(Label, {
          ...state.texts[state.text_index],
        }),
        e(Button, {
          button_text: state.button_text,
        }),
        div({}, [
          e('a', {
            href: 'http://qq.com',
            target: '_blank',
          }, 'QQ'),
        ]),
    ]);
  }
}

class Label extends Component {
  render(state) {
    return p({
      style: {
        color: state.color,
      },
    }, [
      state.text,
    ]);
  }
}

class Button extends Component {
  render(state) {
    return button({
      onclick: (ev) => {
        store.emit(ev_tick);
      },
    }, [
      state.button_text,
    ]);
  }
}

function ev_tick(state, data) {
  return {...state,
    text_index: -state.text_index + 1,
  };
}

let initState = {
  texts: [
    {color: 'red', text: 'Hello'},
    {color: 'blue', text: 'World'},
  ],
  text_index: 0,
  button_text: 'Click me',
}

let app = new App(initState);
app.bind(document.getElementById('app'));

let store = new Store(initState);
store.setComponent(app);

