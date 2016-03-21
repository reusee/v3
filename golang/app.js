import {div,
  Store, Component} from './base'

let initState = {
};

class App extends Component {
  render(state) {
    return div({
    }, 'hello');
  }
}

let app = new App(initState);
app.bind(document.getElementById('app'));

let store = new Store(initState);
store.setComponent(app);

export let emit = store.emit.bind(store);
