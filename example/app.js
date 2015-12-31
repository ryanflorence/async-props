import React from 'react'
import { render } from 'react-dom'
import { Router, Route, IndexRoute, Link, browserHistory } from 'react-router'
import AsyncProps from 'async-props'
import { fetchContacts, fetchContact, deleteContact, postContact } from './api'
import serializeForm from 'form-serialize'

class App extends React.Component {

  static loadProps(params, cb) {
    fetchContacts((err, contacts) => {
      cb(null, { contacts })
    })
  }

  // Feel free to have your own opinion here: AsyncProps sends a prop
  // `reloadAsyncProps` to allow your app to reload props for a component
  // outside of route changes. Components deeper in the tree may need to do
  // that when they update/add/remove data that affects data higher up. To get
  // that down the tree I like to use context so anybody can get it.  This
  // allows for super simple data loading that doesn't require stores, caches,
  // etc.
  static childContextTypes = {
    reloadContacts: React.PropTypes.func
  }

  getChildContext() {
    return {
      reloadContacts: () => this.props.reloadAsyncProps()
    }
  }

  render() {
    // props.loading comes from AsyncProps
    const { contacts, loading } = this.props
    const style = {
      opacity: loading ? 0.5 : 1,
      transition: loading ? 'opacity 250ms ease 300ms' : ''
    }

    return (
      <div style={style}>
        <h1>Contacts List</h1>
        <p><Link activeStyle={{ color: 'red' }} to="/new">New Contact</Link></p>
        <ul>
          {contacts.map(contact => (
            <li key={contact.id}>
              <Link activeStyle={{ color: 'red' }} to={contact.id}>{contact.first} {contact.last}</Link>
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

  static contextTypes = {
    reloadContacts: React.PropTypes.func.isRequired
  }

  delete() {
    deleteContact(this.props.contact.id, (err) => {
      if (err) {
        alert(err)
      }
      else {
        this.context.reloadContacts()
        this.props.history.pushState(null, '/')
      }
    })
  }

  render() {
    const { contact } = this.props
    return (
      <div>
        <h2>{contact.first} {contact.last}</h2>
        <img src={contact.avatar} height="100" key={contact.id}/>
        <button onClick={() => this.delete()}>Delete</button>
      </div>
    )
  }
}

class New extends React.Component {

  static contextTypes = {
    reloadContacts: React.PropTypes.func.isRequired
  }

  submit(e) {
    e.preventDefault()
    const contact = serializeForm(e.target, { hash: true })
    postContact(contact, (err, savedContact) => {
      this.context.reloadContacts()
      this.props.history.pushState(null, `/${savedContact.id}`)
    })
  }

  render() {
    return (
      <form onSubmit={(e) => this.submit(e)}>
        <h2>New Contact</h2>
        <p>
          <label><input type="text" name="first" placeholder="first name"/></label>{' '}
          <label><input type="text" name="last" placeholder="last name"/></label><br/>
          <label><input type="text" name="avatar" placeholder="avatar"/></label>
        </p>
        <p>
          <button type="submit">Create</button>
        </p>
      </form>
    )
  }

}

function Index() {
  return (
    <div>
      <h2>About</h2>
      <p>
        AsyncProps let you co-locate your data fetching with your
        route components without any data loading opinions. You don’t
        even need any caching.
      </p>
      <p><b>Note:</b> There is a random delay up to 1 second added to every request.</p>
    </div>
  )
}

render((
  <Router
    history={browserHistory}
    render={(props) => (
      <AsyncProps
        {...props}
        renderLoading={() => <div>Loading...</div>}
      />
    )}
  >
    <Route path="/" component={App}>
      <IndexRoute component={Index}/>
      <Route path="new" component={New}/>
      <Route path=":contactId" component={Contact}/>
    </Route>
  </Router>
), document.getElementById('app'))

