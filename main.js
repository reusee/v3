import {createStore} from 'redux'
import {e, Component} from './base'

class App extends Component {
  name() { return 'App' }

  render(state) {
    return e('div', {}, [
        e(Label, {
          ...state.texts[state.text_index],
        }),
        e(Button, {
          text: state.button_text,
        }),
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
    }, [
      state.text,
    ]);
  }
}

let initState = {
  texts: [
    {color: 'red', text: 'Hello'},
    {color: 'blue', text: 'World'},
  ],
  text_index: 0,
  button_text: 'Click me',
}

let store = createStore((state = initState, action) => {
  switch (action.type) {
  case 'tick':
    return {...state,
      'text_index': -state.text_index + 1,
    }
  default:
    return state;
  }
});
store.subscribe(() => {
  app.set(store.getState());
});

let app = new App(initState);
app.bind(document.getElementById('app'));
