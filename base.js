let debug = false;

class Node {
  constructor() {
    this.tag = null;
    this.id = null;
    this.style = null;
    this.class = null;
    this.children = [];
    this.attributes = {};
    this.events = {};
    this.text = null;
  }

  toElement() {
    let element;
    if (this.text !== null) {
      element = document.createTextNode(this.text);
    } else {
      element = document.createElement(this.tag);
    }
    if (this.id !== null) {
      element.id = this.id;
    }
    if (this.style) {
      for (let key in this.style) {
        element.style[key] = this.style[key];
      }
    }
    if (this.class !== null) {
      element.className = this.class;
    }
    if (this.children) {
      for (let i = 0, max = this.children.length; i < max; i++) {
        let child = this.children[i];
        if (child instanceof Thunk) {
          let childElement = this.children[i].render().toElement();
          this.children[i].element = childElement;
          element.appendChild(childElement);
        } else if (child instanceof Node) {
          element.appendChild(this.children[i].toElement());
        } else {
          console.error('invalid child type', this.children[i]);
        }
      }
    }
    if (this.attributes) {
      for (let key in this.attributes) {
        let value = this.attributes[key];
        if (value !== undefined && value !== null) {
          element.setAttribute(key, value);
        }
      }
    }
    if (this.events) {
      for (let key in this.events) {
        element.addEventListener(key.substr(2), (ev) => {
          let handler = this.events[key];
          if (handler) {
            return handler(ev);
          }
        });
      }
    }
    return element;
  }
}

class Thunk {
  constructor(renderFn, state, shouldUpdate, name) {
    this.renderFn = renderFn;
    this.state = state;
    this.shouldUpdate = shouldUpdate;
    this.name = name;
    this.node = null;
    this.element = null;
  }

  render() {
    let node = this.renderFn(this.state);
    this.node = node;
    return node;
  }
}

function patch(element, current, previous) {
  if (!element) {
    console.error('patching null element');
  }
  let currentType = current instanceof Thunk ? 'Thunk' : 'Node';
  let previousType = previous instanceof Node ? 'Node' : 'Thunk';

  // not diff
  if (!previous 
      || currentType != previousType
      || currentType == 'Thunk' && current.name != previous.name
      || currentType == 'Thunk' && !previous.node
      ) {
    let newElement;
    if (currentType == 'Thunk') {
      newElement = current.render().toElement();
      current.element = newElement;
    } else {
      newElement = current.toElement();
    }
    element.parentNode.insertBefore(newElement, element);
    element.parentNode.removeChild(element);
    return newElement;
  }

  // get nodes
  let oldNode;
  let node;
  if (currentType == 'Thunk') {
    oldNode = previous.node;
    if (current.shouldUpdate(current.state, previous.state)) {
      node = current.render();
    } else {
      node = oldNode;
    }
    current.element = element;
    current.node = node;
  } else {
    oldNode = previous;
    node = current;
  }
  if (node === oldNode) {
    return element;
  }

  // tag
  if (node.tag != oldNode.tag) {
    let newElement;
    if (currentType == 'Thunk') {
      newElement = current.render().toElement();
      current.element = newElement;
    } else {
      newElement = current.toElement();
    }
    element.parentNode.insertBefore(newElement, element);
    element.parentNode.removeChild(element);
    return newElement;
  }

  // id
  if (node.id != oldNode.id) {
    element.id = node.id;
  }

  // style
  for (let key in node.style) {
    if (node.style[key] != oldNode.style[key]) {
      element.style[key] = node.style[key];
    }
  }
  for (let key in oldNode.style) {
    if (!(key in node.style)) {
      element.style[key] = null;
    }
  }

  // class
  if (node.class != oldNode.class) {
    element.className = node.class;
  }

  // attributes
  for (let key in node.attributes) {
    if (node.attributes[key] != oldNode.attributes[key]) {
      let value = node.attributes[key];
      if (value !== undefined && value !== null) {
        element.setAttribute(key, value);
      }
    }
  }
  for (let key in oldNode.attributes) {
    if (!(key in node.attributes)) {
      element.removeAttribute(key);
    }
  }

  // events
  for (let key in oldNode.events) {
    if (oldNode.events[key] != node.events[key]) {
      if (!oldNode.events[key]) { // new
        element.addEventListener(key.substr(2), (ev) => {
          let handler = oldNode.events[key];
          if (handler) {
            return handler(ev);
          }
        });
      }
      oldNode.events[key] = node.events[key];
    }
  }
  for (let key in node.events) {
    if (!(key in oldNode.events)) {
      oldNode.events[key] = null;
    }
  }
  node.events = oldNode.events;

  // children
  let max_length = node.children.length;
  if (oldNode.children.length < max_length) {
    max_length = oldNode.children.length;
  }
  let elementChildren = element.childNodes;
  for (let i = 0; i < max_length; i++) {
    patch(elementChildren[i], node.children[i], oldNode.children[i]);
  }
  if (node.children.length > max_length) {
    for (let i = max_length, max = node.children.length; i < max; i++) {
      let child = node.children[i];
      if (child instanceof Thunk) {
        let childElement = child.render().toElement();
        child.element = childElement;
        element.appendChild(childElement);
      } else if (child instanceof Node) {
        element.appendChild(child.toElement());
      } else {
        console.error('invalid child type', child);
      }
    }
  }
  if (oldNode.children.length > max_length) {
    for (let i = max_length, max = oldNode.children.length; i < max; i++) {
      element.removeChild(elementChildren[max_length]);
    }
  }

  // text
  if (node.text != null && node.text != oldNode.text) {
    element.nodeValue = node.text;
  }

  return element;
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
    return new Thunk(this.render.bind(this),
      state,
      this.shouldUpdate.bind(this), 
      this.constructor.name);
  }

  // abstract
  render(state) {
    return e('div');
  }

  bind(parent) {
    this.element = this.thunk.render().toElement();
    this.thunk.element = this.element;
    parent.appendChild(this.element);
  }

  setState(newState) {
    //let t0 = new Date();
    this.state = newState;
    if (this.element) {
      let oldThunk = this.thunk;
      this.thunk = this.newThunk(this.state);
      this.element = patch(this.element, this.thunk, oldThunk);
    } else {
      console.warn('not bind');
    }
    //console.log('%c refresh in ', 'background: #333; color: #328922', new Date() - t0);
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

  select(selector) {
    return this.thunk.element.querySelector(selector);
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

export function e(selector, properties, ...children) {
  let type = typeof selector;
  if (type == 'string') {
    // not component 
    let node = new Node();
    node.tag = selector;
    for (let key in properties) {
      if (key == 'id' || key == 'style' || key == 'class') {
        node[key] = properties[key];
      } else if (key in event_types) {
        node.events = node.events || {};
        node.events[key] = properties[key];
      } else {
        node.attributes = node.attributes || {};
        node.attributes[key] = properties[key];
      }
    }
    node.children = children_to_nodes(children);
    return node;
  } else if (type == 'function' && !selector.name) {
    // function based component
    return new Thunk(selector, properties, shouldUpdate, 'anonymous');
  } else {
    // class based component
    return new selector(properties).thunk;
  }
}

function children_to_nodes(children) {
  let ret = [];
  for (let i = 0, max = children.length; i < max; i++) {
    let child = children[i];
    if (Array.isArray(child)) {
      let nodes = children_to_nodes(child);
      if (nodes.length > 0) {
        ret.push(...nodes);
      }
    } else if (child instanceof Thunk || child instanceof Node) {
      ret.push(child);
    } else if (is_none(child)) {
      console.error('null child', child);
    } else {
      let node = new Node();
      node.text = String(child);
      ret.push(node);
    }
  }
  return ret;
}

export var none = e('div', { style: { display: 'none' } });
export var clear = e('div', { style: { clear: 'both' } });

export let div = (args, ...subs) => e('div', args, subs);
export let p = (args, ...subs) => e('p', args, subs);
export let span = (args, ...subs) => e('span', args, subs);
export let ul = (args, ...subs) => e('ul', args, subs);
export let li = (args, ...subs) => e('li', args, subs);
export let form = (args, ...subs) => e('form', args, subs);
export let label = (args, ...subs) => e('label', args, subs);
export let input = (args, ...subs) => e('input', args, subs);
export let select = (args, ...subs) => e('select', args, subs);
export let option = (args, ...subs) => e('option', args, subs);
export let img = (args, ...subs) => e('img', args, subs);
export let button = (args, ...subs) => e('button', args, subs);

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

let event_types = {
  onDOMActivate: true,
  onDOMAttrModified: true,
  onDOMAttributeNameChanged: true,
  onDOMCharacterDataModified: true,
  onDOMContentLoaded: true,
  onDOMElementNameChanged: true,
  onDOMFocusIn: true,
  onDOMFocusOut: true,
  onDOMNodeInserted: true,
  onDOMNodeInsertedIntoDocument: true,
  onDOMNodeRemoved: true,
  onDOMNodeRemovedFromDocument: true,
  onDOMSubtreeModified: true,
  onSVGAbort: true,
  onSVGError: true,
  onSVGLoad: true,
  onSVGResize: true,
  onSVGScroll: true,
  onSVGUnload: true,
  onSVGZoom: true,
  onabort: true,
  onafterprint: true,
  onanimationend: true,
  onanimationiteration: true,
  onanimationstart: true,
  onaudioend: true,
  onaudioprocess: true,
  onaudiostart: true,
  onbeforeprint: true,
  onbeforeunload: true,
  onbeginEvent: true,
  onblocked: true,
  onblur: true,
  onboundary: true,
  oncached: true,
  oncanplay: true,
  oncanplaythrough: true,
  onchange: true,
  onchargingchange: true,
  onchargingtimechange: true,
  onchecking: true,
  onclick: true,
  onclose: true,
  oncomplete: true,
  oncompositionend: true,
  oncompositionstart: true,
  oncompositionupdate: true,
  oncontextmenu: true,
  oncopy: true,
  oncut: true,
  ondblclick: true,
  ondevicelight: true,
  ondevicemotion: true,
  ondeviceorientation: true,
  ondeviceproximity: true,
  ondischargingtimechange: true,
  ondownloading: true,
  ondrag: true,
  ondragend: true,
  ondragenter: true,
  ondragleave: true,
  ondragover: true,
  ondragstart: true,
  ondrop: true,
  ondurationchange: true,
  onemptied: true,
  onend: true,
  onendEvent: true,
  onended: true,
  onerror: true,
  onfocus: true,
  onfocusinUnimplemented: true,
  onfocusoutUnimplemented: true,
  onfullscreenchange: true,
  onfullscreenerror: true,
  ongamepadconnected: true,
  ongamepaddisconnected: true,
  ongotpointercapture: true,
  onhashchange: true,
  oninput: true,
  oninvalid: true,
  onkeydown: true,
  onkeypress: true,
  onkeyup: true,
  onlanguagechange: true,
  onlevelchange: true,
  onload: true,
  onloadeddata: true,
  onloadedmetadata: true,
  onloadend: true,
  onloadstart: true,
  onlostpointercapture: true,
  onmark: true,
  onmessage: true,
  onmousedown: true,
  onmouseenter: true,
  onmouseleave: true,
  onmousemove: true,
  onmouseout: true,
  onmouseover: true,
  onmouseup: true,
  onnomatch: true,
  onnotificationclick: true,
  onnoupdate: true,
  onobsolete: true,
  onoffline: true,
  ononline: true,
  onopen: true,
  onorientationchange: true,
  onpagehide: true,
  onpageshow: true,
  onpaste: true,
  onpause: true,
  onplay: true,
  onplaying: true,
  onpointercancel: true,
  onpointerdown: true,
  onpointerenter: true,
  onpointerleave: true,
  onpointerlockchange: true,
  onpointerlockerror: true,
  onpointermove: true,
  onpointerout: true,
  onpointerover: true,
  onpointerup: true,
  onpopstate: true,
  onprogress: true,
  onpush: true,
  onpushsubscriptionchange: true,
  onratechange: true,
  onreadystatechange: true,
  onrepeatEvent: true,
  onreset: true,
  onresize: true,
  onresourcetimingbufferfull: true,
  onresult: true,
  onresume: true,
  onscroll: true,
  onseeked: true,
  onseeking: true,
  onselect: true,
  onselectionchange: true,
  onselectstart: true,
  onshow: true,
  onsoundend: true,
  onsoundstart: true,
  onspeechend: true,
  onspeechstart: true,
  onstalled: true,
  onstart: true,
  onstorage: true,
  onsubmit: true,
  onsuccess: true,
  onsuspend: true,
  ontimeout: true,
  ontimeupdate: true,
  ontouchcancel: true,
  ontouchend: true,
  ontouchenter: true,
  ontouchleave: true,
  ontouchmove: true,
  ontouchstart: true,
  ontransitionend: true,
  onunload: true,
  onupdateready: true,
  onupgradeneeded: true,
  onuserproximity: true,
  onversionchange: true,
  onvisibilitychange: true,
  onvoiceschanged: true,
  onvolumechange: true,
  onvrdisplayconnected: true,
  onvrdisplaydisconnected: true,
  onvrdisplaypresentchange: true,
  onwaiting: true,
  onwheel: true,
}
