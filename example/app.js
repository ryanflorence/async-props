import React from 'react'
import { render } from 'react-dom'
import { createHistory } from 'history'
import { Router, Route, Link } from 'react-router'
import AsyncProps from 'async-props'
import { fetchContacts, fetchContact } from './api'

class App extends React.Component {
  static loadProps(params, cb) {
    fetchContacts((err, contacts) => {
      cb(null, { contacts })
    })
  }

  render() {
    const { contacts } = this.props

    return (
      <div>
        <h1>Contacts List</h1>
        <ul>
          {contacts.map(contact => (
            <li key={contact.id}>
              <Link to={contact.id}>{contact.first} {contact.last}</Link>
            </li>
          ))}
        </ul>
        {this.props.children}
      </div>
    )
  }
}

class Contact extends React.Component {
  static loadProps(params, cb) {
    fetchContact(params.contactId, (err, contact) => {
      cb(null, { contact })
    })
  }

  render() {
    const { contact } = this.props
    return (
      <div>
        <h2>{contact.first} {contact.last}</h2>
        <img src={contact.avatar} height="100" key={contact.id}/>
      </div>
    )
  }
}

render((
  <Router
    RoutingContext={AsyncProps}
    history={createHistory()}
  >
    <Route path="/" component={App}>
      <Route path=":contactId" component={Contact}/>
    </Route>
  </Router>
), document.getElementById('app'))

