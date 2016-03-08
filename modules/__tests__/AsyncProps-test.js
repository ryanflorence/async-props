import React from 'react'
import expect, { spyOn, restoreSpies } from 'expect'
import createHistory from 'react-router/lib/createMemoryHistory'
import { renderToString } from 'react-dom/server'
import { render, unmountComponentAtNode } from 'react-dom'
import { Router, match } from 'react-router'
import AsyncProps, { loadPropsOnServer } from '../AsyncProps'

function execNext(steps) {
  return () => {
    steps.shift()()
    if (steps.length === 1)
      steps.shift()()
  }
}

const DATA = {
  cereals: [ 'cinnamon life', 'berry berry kix' ],
  ingredients: [ 'sugar', 'sweetness' ],
  nutrition: [ 'lots', 'love' ]
}

class App extends React.Component {
  static loadProps(params, cb) {
    setTimeout(() => {
      cb(null, DATA)
    }, 0)
  }

  static setAssertions(assertions) {
    this.assertions = assertions
  }

  static clearAssertions() {
    this.assertions = null
  }

  componentDidMount() {
    this.assert()
  }

  componentDidUpdate() {
    this.assert()
  }

  assert() {
    if (this.constructor.assertions)
      this.constructor.assertions()
  }

  render() {
    const { cereals } = this.props
    return (
      <div>
        <ul>{cereals.map(c => <li key={c}>{c}</li>)}</ul>
        {this.props.children || <div>no child</div>}
      </div>
    )
  }
}

class Cereal extends React.Component {
  static loadProps(params, cb) {
    setTimeout(() => {
      cb(null, { cereal: DATA.cereals[params.index] })
    }, 0)
  }

  render() {
    let { cereal, children } = this.props
    return (
      <div>
        <h1>heck yeah! {cereal}</h1>
        {children ? React.cloneElement(children, { cereal }) : <div>no grandchild</div>}
      </div>
    )
  }
}

class Ingredients extends React.Component {
  static loadProps(params, cb) {
    setTimeout(() => {
      cb(null, { ingredients: DATA.ingredients[params.index] })
    }, 0)
  }

  render() {
    return (
      <div>
        <h1>ingredients for {this.props.cereal}: {this.props.ingredients}</h1>
        {this.props.children}
      </div>
    )
  }
}

class Nutrition extends React.Component {
  static loadProps(params, cb) {
    cb(null, { nutrition: DATA.nutrition[params.sub] })
  }

  render() {
    return <h1>contains {this.props.nutrition}</h1>
  }
}

class NoLoadProps extends React.Component {
  render() {
    return <h1>No loadProps!</h1>
  }
}

class AppNoLoadProps extends React.Component {
  static setAssertions(assertions) {
    this.assertions = assertions
  }

  static clearAssertions() {
    this.assertions = null
  }

  componentDidMount() {
    this.assert()
  }

  componentDidUpdate() {
    this.assert()
  }

  assert() {
    if (this.constructor.assertions)
      this.constructor.assertions()
  }

  render() {
    return (
      <div>
        {this.props.children || <div>no child</div>}
      </div>
    )
  }
}

const routes = {
  path: '/',
  component: App,
  childRoutes: [ {
    path: ':index',
    component: Cereal,
    childRoutes: [ {
      path: 'ingredients',
      component: Ingredients,
      childRoutes: [ {
        path: ':sub',
        component: Nutrition
      } ]
    } ]
  } ]
}

describe('AsyncProps', () => {
  beforeEach(() => App.clearAssertions())
  afterEach(() => restoreSpies())

  describe('rendering', () => {
    let div = document.createElement('div')

    beforeEach(() => div = document.createElement('div') )
    afterEach(() => unmountComponentAtNode(div) )

    it('renders null on first render', (done) => {
      const next = execNext([
        () => {
          expect(div.textContent.trim()).toEqual('')
        },
        done
      ])

      App.setAssertions(next)

      render((
        <Router
          history={createHistory('/')}
          routes={routes}
          render={(props) => <AsyncProps {...props}/>}
        />
      ), div, next)
    })

    it('renders with async props after props load', (done) => {
      const next = execNext([
        () => {
          expect(div.textContent.trim()).toEqual('')
        },
        () => {
          expect(div.textContent).toContain('cinnamon life')
          expect(div.textContent).toContain('berry berry kix')
        },
        done
      ])

      App.setAssertions(next)

      render((
        <Router
          history={createHistory('/')}
          render={(props) => <AsyncProps {...props}/>}
          routes={routes}
        />
      ), div, next)
    })


    it('renders nested async props', (done) => {
      const next = execNext([
        () => {},
        () => expect(div.textContent).toContain('heck yeah! cinnamon life'),
        done
      ])

      App.setAssertions(next)

      render((
        <Router
          history={createHistory('/0')}
          render={(props) => <AsyncProps {...props}/>}
          routes={routes}
        />
      ), div, next)
    })

    it('passes extra props through', (done) => {
      const next = execNext([
        () => {},
        () => expect(div.textContent).toContain('ingredients for cinnamon life: sugar'),
        done
      ])

      App.setAssertions(next)

      render((
        <Router
          history={createHistory('/0/ingredients')}
          render={(props) => <AsyncProps {...props}/>}
          routes={routes}
        />
      ), div, next)
    })

    it('renders the old screen on route changes until props load', (done) => {
      const history = createHistory('/')

      const next = execNext([
        () => {},
        () => {
          expect(div.textContent).toContain('no child')
          history.pushState(null, '/1')
        },
        () => expect(div.textContent).toContain('no child'),
        () => expect(div.textContent).toContain('heck yeah! berry berry kix'),
        done
      ])

      App.setAssertions(next)

      render((
        <Router
          history={history}
          render={(props) => <AsyncProps {...props}/>}
          routes={routes}
        />
      ), div, next)
    })

    it('renders loads props on pivot route changes', (done) => {
      const history = createHistory('/0')

      const next = execNext([
        () => {},
        () => {
          expect(div.textContent).toContain('heck yeah! cinnamon life'),
          history.pushState(null, '/1')
        },
        () => expect(div.textContent).toContain('heck yeah! cinnamon life'),
        () => expect(div.textContent).toContain('heck yeah! berry berry kix'),
        done
      ])

      App.setAssertions(next)

      render((
        <Router
          history={history}
          render={(props) => <AsyncProps {...props}/>}
          routes={routes}
        />
      ), div, next)
    })

    it('renders loads props coming up', (done) => {
      const history = createHistory('/0/ingredients')

      const next = execNext([
        () => {},
        () => {
          expect(div.textContent).toContain('heck yeah! cinnamon life')
          expect(div.textContent).toContain('ingredients for cinnamon life: sugar')
          history.pushState(null, '/1')
        },
        () => expect(div.textContent).toContain('heck yeah! cinnamon life'),
        () => expect(div.textContent).toContain('heck yeah! berry berry kix'),
        done
      ])

      App.setAssertions(next)

      render((
        <Router
          history={history}
          render={(props) => <AsyncProps {...props}/>}
          routes={routes}
        />
      ), div, next)
    })

    it('renders loads props going down', (done) => {
      const history = createHistory('/0')

      const next = execNext([
        () => {},
        () => {
          expect(div.textContent).toContain('heck yeah! cinnamon life')
          history.pushState(null, '/1/ingredients')
        },
        () => expect(div.textContent).toContain('heck yeah! cinnamon life'),
        () => {
          expect(div.textContent).toContain('heck yeah! berry berry kix')
          expect(div.textContent).toContain('ingredients for berry berry kix: sweetness')
        },
        done
      ])

      App.setAssertions(next)

      render((
        <Router
          history={history}
          render={(props) => <AsyncProps {...props}/>}
          routes={routes}
        />
      ), div, next)
    })


    it('does not load props for routes above pivot', (done) => {
      const appSpy = spyOn(App, 'loadProps').andCallThrough()
      const cerealSpy = spyOn(Cereal, 'loadProps').andCallThrough()
      const history = createHistory('/0')

      const next = execNext([
        () => {},
        () => {
          history.pushState(null, '/1')
        },
        () => {
          expect(appSpy.calls.length).toEqual(1)
          expect(cerealSpy.calls.length).toEqual(2)
        },
        done
      ])

      App.setAssertions(next)

      render((
        <Router
          history={history}
          render={(props) => <AsyncProps {...props}/>}
          routes={routes}
        />
      ), div, next)
    })

    it('renders correctly when no components have loadProps', (done) => {
      const history = createHistory('/')

      const noLoadPropsRoutes = {
        path: '/',
        component: AppNoLoadProps,
        childRoutes: [ {
          path: 'update',
          component: NoLoadProps
        } ]
      }

      const next = execNext([
        () => {},
        () => {
          expect(div.textContent).toContain('no child')
          history.pushState(null, '/update')
        },
        () => {
          () => expect(div.textContent).toContain('No loadProps!')
        },
        done
      ])

      AppNoLoadProps.setAssertions(next)

      render((
        <Router
          history={history}
          render={(props) => <AsyncProps {...props}/>}
          routes={noLoadPropsRoutes}
        />
      ), div, next)
    })

    it('only calls loadProps once on route changes', (done) => {
      const cerealSpy = spyOn(Cereal, 'loadProps').andCallThrough()
      const history = createHistory('/0')

      const next = execNext([
        () => expect(cerealSpy.calls.length).toEqual(1),
        () => history.pushState(null, '/1'),
        () => expect(cerealSpy.calls.length).toEqual(2),
        () => history.pushState(null, '/2'),
        () => expect(cerealSpy.calls.length).toEqual(3),
        done
      ])

      App.setAssertions(next)

      render((
          <Router
              history={history}
              render={(props) => <AsyncProps {...props}/>}
              routes={routes}
          />
      ), div, next)
    })

    it('refreshes when a parent route changes', (done) => {
      const cerealSpy = spyOn(Cereal, 'loadProps').andCallThrough()
      const history = createHistory('/0/ingredients/0')

      const next = execNext([
        () => expect(cerealSpy.calls.length).toEqual(1),
        () => history.pushState(null, '/1/ingredients/0'),
        () => expect(cerealSpy.calls.length).toEqual(2),
        done
      ])

      App.setAssertions(next)

      render((
          <Router
              history={history}
              render={(props) => <AsyncProps {...props}/>}
              routes={routes}
          />
      ), div, next)
    })
  })

  describe('server rendering', () => {
    const routes = {
      path: '/',
      component: App,
      childRoutes: [ {
        path: ':index',
        component: Cereal
      } ]
    }

    beforeEach(() => window.__ASYNC_PROPS__ = [ DATA ])
    afterEach(() => delete window.__ASYNC_PROPS__ )

    it('renders correctly when no components have loadProps', (done) => {
      const noLoadPropsRoutes = {
        path: '/',
        component: AppNoLoadProps
      }
      match({ routes: noLoadPropsRoutes, location: '/' }, (err, redirect, renderProps) => {
        loadPropsOnServer(renderProps, done)
      })
    })

    it('renders synchronously with props from hydration', () => {
      const html = renderToString(
        <Router
          history={createHistory('/')}
          render={(props) => <AsyncProps {...props}/>}
          routes={routes}
        />
      )
      expect(html).toMatch(/cinnamon life/)
      expect(html).toMatch(/berry berry kix/)
    })

    it('provides a script tag string to render on the server', () => {
      match({ routes, location: '/' }, (err, redirect, renderProps) => {
        loadPropsOnServer(renderProps, (err, scriptString) => {
          expect(scriptString).toEqual(
            `<script>__ASYNC_PROPS__ = ${JSON.stringify([ DATA ], null, 2)}</script>`
          )
        })
      })
    })
  })
})

