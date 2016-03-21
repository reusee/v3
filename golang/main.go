package main

import (
	"fmt"
	"net/http"
)

var (
	pt = fmt.Printf
)

func main() {
	handler := NewHandler()
	handler.Register(new(Api))
	http.Handle("/api/", handler)

	ce(http.ListenAndServe(":7899", nil), "listen and serve")
}
