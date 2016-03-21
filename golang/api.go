package main

type Api struct {
}

func NewApi() (*Api, error) {
	return new(Api), nil
}

type RespCommon struct {
	Ok bool `json:"ok"`
}

type PingReq struct {
	Greetings string
}
type PingResp struct {
	RespCommon
	Echo string
}

func (a *Api) Ping(req *PingReq, resp *PingResp) error {
	resp.Ok = true
	resp.Echo = req.Greetings
	return nil
}
