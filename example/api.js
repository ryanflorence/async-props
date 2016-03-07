localStorage.token = localStorage.token || (Date.now()*Math.random())

//const API = 'http://addressbook-api.herokuapp.com'
const API = 'http://localhost:3000'

function setToken(req) {
  req.setRequestHeader('authorization', localStorage.token)
}

function getJSON(url, cb) {
  const req = new XMLHttpRequest()
  req.onload = function () {
    if (req.status === 404) {
      cb(new Error('not found'))
    } else {
      // fake spotty server
      const time = Math.random() * 1000
      setTimeout(() => {
        cb(null, JSON.parse(req.response))
      }, time)
    }
  }
  req.open('GET', url)
  setToken(req)
  req.send()
}

function postJSON(url, obj, cb) {
  var req = new XMLHttpRequest()
  req.onload = function () {
    cb(null, JSON.parse(req.response))
  }
  req.open('POST', url)
  req.setRequestHeader('Content-Type', 'application/json;charset=UTF-8')
  setToken(req)
  req.send(JSON.stringify(obj))
}

function deleteJSON(url, cb) {
  var req = new XMLHttpRequest()
  req.onload = function () {
    if (req.status === 500)
      cb(new Error(req.responseText))
    else
      cb(null, req.responseText)
  }
  req.open('DELETE', url)
  setToken(req)
  req.send()
}

export function fetchContact(id, cb) {
  getJSON(`${API}/contacts/${id}`, (err, res) => {
    if (err)
      cb(err)
    else
      cb(null, res.contact)
  })
}

export function fetchContacts(cb) {
  getJSON(`${API}/contacts`, (err, res) => {
    if (err)
      cb(err)
    else
      cb(null, res.contacts)
  })
}

export function deleteContact(contactId, cb) {
  deleteJSON(`${API}/contacts/${contactId}`, cb)
}

export function postContact(contact, cb) {
  postJSON(`${API}/contacts`, { contact }, (err, res) => {
    if (err)
      cb(err)
    else
      cb(null, res.contact)
  })
}

