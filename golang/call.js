import req from 'reqwest'

let apiEndpoint = '';

export function call(what, data, cb, retry = 5) {
  req({
    crossOrigin: true,
    url: apiEndpoint + '/' + what,
    type: 'json',
    method: 'post',
    withCredentials: true,
    data: JSON.stringify(data),
    success: (resp) => {
      cb(resp);
    },
    error: (err) => {
      if (retry > 0) {
        call(what, data, cb, retry - 1);
      } else {
        console.error('call error', what, data, err);
        cb({
          ok: false,
        });
      }
    },
  });
}

