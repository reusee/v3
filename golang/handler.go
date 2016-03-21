package main

import (
	"encoding/json"
	"net/http"
	"reflect"
	"strings"
)

type Handler struct {
	methods map[string]*Method
}

type Method struct {
	api               reflect.Value
	reqType, respType reflect.Type
	name              string
	fn                reflect.Value
}

var errorType = reflect.TypeOf((*error)(nil)).Elem()

func NewHandler() *Handler {
	return &Handler{
		methods: make(map[string]*Method),
	}
}

func (h *Handler) Register(o interface{}) {
	objType := reflect.TypeOf(o)
	nMethods := objType.NumMethod()
	apiValue := reflect.ValueOf(o)
	for i := 0; i < nMethods; i++ {
		method := objType.Method(i)
		methodType := method.Type
		nArgs := methodType.NumIn()
		if nArgs != 3 {
			continue
		}
		nReturns := methodType.NumOut()
		if nReturns != 1 {
			continue
		}
		if methodType.Out(0) != errorType {
			continue
		}
		m := &Method{
			api:      apiValue,
			reqType:  methodType.In(1).Elem(),
			respType: methodType.In(2).Elem(),
			name:     method.Name,
			fn:       method.Func,
		}
		h.methods[m.name] = m
	}
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// allow cross origin
	w.Header().Add("Access-Control-Allow-Origin", "*")
	// requested method
	what := strings.Split(r.URL.Path, "/")[2]
	var method *Method
	var ok bool
	if method, ok = h.methods[what]; !ok { // no method
		http.NotFound(w, r)
		return
	}
	// decode request data
	reqData := reflect.New(method.reqType)
	de := json.NewDecoder(r.Body)
	ce(de.Decode(reqData.Interface()), "decode")
	// call method
	respData := reflect.New(method.respType)
	method.fn.Call([]reflect.Value{
		method.api, reqData, respData,
	})[0].Interface()
	// encode response data
	en := json.NewEncoder(w)
	ce(en.Encode(respData.Interface()), "encode")
}
