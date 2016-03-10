import React from 'react'
import expect, { spyOn, restoreSpies } from 'expect'
import createHistory from 'react-router/lib/createMemoryHistory'
import { render } from 'react-dom'
import { Router, Route, match } from 'react-router'
import AsyncProps, { loadPropsOnServer } from '../AsyncProps'

const createRunner = (routes, extraProps) => {
  return ({ startPath, steps }) => {
    const history = createHistory(startPath)
    const div = document.createElement('div')
    const { push } = history
    const next = function () {
      if (steps.length)
        steps.shift()({ html: div.innerHTML, push })
    }
    const Container = React.createClass({
      componentDidMount: next,
      componentDidUpdate: next,
      render() { return this.props.children }
    })
    render((
      <Router
        history={history}
        routes={<Route component={Container} children={routes}/>}
        render={props => (
          <AsyncProps
            {...props}
            {...extraProps}
            renderLoading={() => <div>loading</div>}
          />
        )}
      />
    ), div, next)
  }
}

const assertPropsRenderedForComponent = (Component, html) => {
  expect(html).toContain(Component.name)
}

const assertPropsNotRenderedForComponent = (Component, html) => {
  expect(html).toNotContain(Component.name)
}

describe('rendering', () => {
  describe('with async callbacks and no server hydration', () => {
    const Component = ({ name }) => <div>{name}</div>
    Component.loadProps = (_, cb) => {
      setTimeout(() => cb(null, { name: Component.name }), 0)
    }
    const runner = createRunner(<Route path="/" component={Component}/>)

    it('renders null on first render', (done) => {
      runner({
        startPath: '/',
        steps: [
          ({ html }) => {
            assertPropsNotRenderedForComponent(Component, html)
            done()
          }
        ]
      })
    })

    it('renders with async props after props load', (done) => {
      runner({
        startPath: '/',
        steps: [
          ({ html }) => {
            assertPropsNotRenderedForComponent(Component, html)
          },
          ({ html }) => {
            assertPropsRenderedForComponent(Component, html)
            done()
          }
        ]
      })
    })
  })
  it('renders correctly when no components have loadProps', () => {
    const TEXT = 'no async props'
    const Component = () => <div>{TEXT}</div>
    createRunner(<Route component={Component} path="/"/>)({
      startPath: '/',
      steps: [
        ({ html }) => expect(html).toContain(TEXT)
      ]
    })
  })
})


describe('server rendering', () => {

  const DATA = { cereal: 'cinnamon life' }

  const Component = ({ cereal }) => <div>{cereal}</div>
  Component.loadProps = (_, cb) => cb(null, DATA)
  const routes = <Route component={Component} path="/"/>

  beforeEach(() => window.__ASYNC_PROPS__ = [ DATA ])
  afterEach(() => {
    restoreSpies()
    delete window.__ASYNC_PROPS__ 
  })


  it('renders synchronously with props from hydration', (done) => {
    createRunner(routes)({
      startPath: '/',
      steps: [
        ({ html }) => {
          expect(html).toContain(DATA.cereal)
          done()
        }
      ]
    })
  })

  it('does not call loadProps on the component', (done) => {
    const spy = spyOn(Component, 'loadProps').andCallThrough()
    createRunner(<Route component={Component} path="/"/>)({
      startPath: '/',
      steps: [
        () => { // ReactDOM.render callback
          expect(spy.calls.length).toEqual(0)
        },
        () => { // componentDidMount
          expect(spy.calls.length).toEqual(0)
          done()
        },
        () => {
          throw new Error('should not render again')
        }
      ]
    })
  })

  it('provides a script tag string to render on the server', () => {
    match({ routes, location: '/' }, (err, redirect, renderProps) => {
      loadPropsOnServer(renderProps, {}, (err, data, scriptString) => {
        expect(scriptString).toEqual(
          `<script>__ASYNC_PROPS__ = ${JSON.stringify([ DATA ], null, 2)}</script>`
        )
      })
    })
  })
})

// These tests are probably overkill for the implementation, could
// probably just test that when things show up in the matched tree,
// or were there before and their params changed, we update, but
// might as well be explicit on what we want this thing to do!
describe('navigating', () => {

  afterEach(() => restoreSpies())

  const Parent = ({ children, name }) => <div>{name} {children}</div>
  Parent.loadProps = (_, cb) => cb(null, { name: Parent.name })

  const Reference = ({ children, name, param }) => <div>{name} {param} {children}</div>
  Reference.loadProps = ({ params }, cb) => cb(null, { name: Reference.name, param: params.reference })

  const Sibling = ({ children, name }) => <div>{name} {children}</div>
  Sibling.loadProps = (_, cb) => cb(null, { name: Sibling.name })

  const Cousin = ({ children, name }) => <div>{name} {children}</div>
  Cousin.loadProps = (_, cb) => cb(null, { name: Cousin.name })

  const Child = ({ children, name, param }) => <div>{name} {param} {children}</div>
  Child.loadProps = ({ params }, cb) => cb(null, { name: Child.name, param: params.child })

  const Grandchild = ({ children, name }) => <div>{name} {children}</div>
  Grandchild.loadProps = (_, cb) => cb(null, { name: Grandchild.name })

  const Aunt = ({ children, name }) => <div>{name} {children}</div>
  Aunt.loadProps = (_, cb) => cb(null, { name: Aunt.name })

  const Neice = ({ children, name }) => <div>{name} {children}</div>
  Neice.loadProps = (_, cb) => cb(null, { name: Neice.name })

  const runNavigationAssertions = createRunner(
    <Route>
      <Route path="/" component={Parent}>
        <Route path="reference/:reference" component={Reference}>
          <Route path="child/:child" component={Child}>
            <Route path="grandchild" component={Grandchild}/>
          </Route>
        </Route>
        <Route path="sibling" component={Sibling}>
          <Route path="neice" component={Neice}/>
        </Route>
      </Route>
      <Route path="aunt" component={Aunt}>
        <Route path="cousin" component={Cousin}/>
      </Route>
    </Route>
  )

  describe('initially', () => {
    it('calls loadProps on all matched route components', () => {
      runNavigationAssertions({
        startPath: '/reference/123/child/456/grandchild',
        steps: [
          ({ html }) => {
            assertPropsRenderedForComponent(Parent, html)
            assertPropsRenderedForComponent(Reference, html)
            assertPropsRenderedForComponent(Child, html)
            assertPropsRenderedForComponent(Grandchild, html)
          }
        ]
      })
    })
  })

  describe('from parent -> child', () => {
    it('loadProps on the child', (done) => {
      runNavigationAssertions({
        startPath: '/',
        steps: [
          ({ html, push }) => {
            assertPropsRenderedForComponent(Parent, html)
            assertPropsNotRenderedForComponent(Reference, html)
            push('/reference/123')
          },
          () => {/*loading*/},
          ({ html }) => {
            assertPropsRenderedForComponent(Parent, html)
            assertPropsRenderedForComponent(Reference, html)
            done()
          }
        ]
      })
    })

    it('does not call loadProps again on the parent', (done) => {
      const spy = spyOn(Parent, 'loadProps').andCallThrough()
      runNavigationAssertions({
        startPath: '/',
        steps: [
          ({ push }) => push('/reference/123'),
          () => {/*loading*/},
          () => {
            expect(spy.calls.length).toEqual(1)
            done()
          }
        ]
      })
    })
  })

  describe('from child -> parent', () => {
    it('does not call loadProps on any', (done) => {
      const parentSpy = spyOn(Parent, 'loadProps').andCallThrough()
      const referenceSpy = spyOn(Reference, 'loadProps').andCallThrough()
      runNavigationAssertions({
        startPath: '/reference/123',
        steps: [
          ({ push }) => push('/'),
          () => {
            expect(parentSpy.calls.length).toEqual(1)
            expect(referenceSpy.calls.length).toEqual(1)
            done()
          }
        ]
      })
    })
  })

  describe('from grandchild -> parent', () => {
    it('does not call loadProps on any', (done) => {
      const parentSpy = spyOn(Parent, 'loadProps').andCallThrough()
      const referenceSpy = spyOn(Reference, 'loadProps').andCallThrough()
      const childSpy = spyOn(Child, 'loadProps').andCallThrough()
      runNavigationAssertions({
        startPath: '/reference/123/child/456',
        steps: [
          ({ push }) => push('/'),
          () => {
            expect(parentSpy.calls.length).toEqual(1)
            expect(referenceSpy.calls.length).toEqual(1)
            expect(childSpy.calls.length).toEqual(1)
            done()
          }
        ]
      })
    })
  })

  describe('to sibling', () => {
    it('calls loadProps on the sibling', (done) => {
      runNavigationAssertions({
        startPath: '/reference/123',
        steps: [
          ({ push }) => push('/sibling'),
          () => {/*loading*/},
          ({ html }) => {
            assertPropsRenderedForComponent(Parent, html)
            assertPropsRenderedForComponent(Sibling, html)
            done()
          }
        ]
      })
    })
  })

  describe('from neice to aunt', () => {
    it('calls loadProps on the aunt', (done) => {
      runNavigationAssertions({
        startPath: '/sibling/neice',
        steps: [
          ({ push }) => push('/reference/123'),
          () => {/*loading*/},
          ({ html }) => {
            assertPropsRenderedForComponent(Parent, html)
            assertPropsRenderedForComponent(Reference, html)
            done()
          }
        ]
      })
    })
  })

  describe('from aunt to neice', () => {
    it('calls loadProps the neice and sibling', (done) => {
      runNavigationAssertions({
        startPath: '/reference/123',
        steps: [
          ({ push }) => push('/sibling/neice'),
          () => {/*loading*/},
          ({ html }) => {
            assertPropsRenderedForComponent(Sibling, html)
            assertPropsRenderedForComponent(Neice, html)
            done()
          }
        ]
      })
    })
  })

  describe('to cousin', () => {
    it('calls loadProps on cousin and aunt', (done) => {
      runNavigationAssertions({
        startPath: '/reference/123',
        steps: [
          ({ push }) => push('/aunt/cousin'),
          () => {/*loading*/},
          ({ html }) => {
            assertPropsRenderedForComponent(Aunt, html)
            assertPropsRenderedForComponent(Cousin, html)
            done()
          }
        ]
      })
    })
  })

  describe('to self with the same params', () => {
    it('calls loadProps on self?')
  })

  describe('to self with different params', () => {
    it('calls loadProps on self', (done) => {
      runNavigationAssertions({
        startPath: '/reference/123',
        steps: [
          ({ push }) => push('/reference/456'),
          () => {/*loading*/},
          ({ html }) => {
            assertPropsRenderedForComponent(Reference, html)
            expect(html).toContain('456')
            done()
          }
        ]
      })
    })
  })

  describe('to self with new parent params', () => {
    it('calls loadProps on self and parent', (done) => {
      const referenceSpy = spyOn(Reference, 'loadProps').andCallThrough()
      const childSpy = spyOn(Child, 'loadProps').andCallThrough()
      runNavigationAssertions({
        startPath: '/reference/foo/child/bar',
        steps: [
          ({ push }) => push('/reference/baz/child/bar'),
          () => { },
          ({ html }) => {
            expect(referenceSpy.calls.length).toEqual(2)
            expect(childSpy.calls.length).toEqual(2)
            assertPropsRenderedForComponent(Reference, html)
            assertPropsRenderedForComponent(Child, html)
            expect(html).toContain('baz')
            done()
          }
        ]
      })
    })
  })

  describe('to same child with new child params', () => {
    it('does not call loadProps on self', (done) => {
      const referenceSpy = spyOn(Reference, 'loadProps').andCallThrough()
      runNavigationAssertions({
        startPath: '/reference/123/child/456',
        steps: [
          ({ push }) => push('/reference/123/child/789'),
          () => {/*loading*/},
          () => {
            expect(referenceSpy.calls.length).toEqual(1)
            done()
          }
        ]
      })
    })

    it('calls loadProps on child', (done) => {
      runNavigationAssertions({
        startPath: '/reference/123/child/456',
        steps: [
          ({ push }) => push('/reference/123/child/789'),
          () => {/*loading*/},
          ({ html }) => {
            assertPropsRenderedForComponent(Child, html)
            expect(html).toContain('789')
            done()
          }
        ]
      })
    })
  })

  it('renders the old screen until props load', (done) => {
    runNavigationAssertions({
      startPath: '/reference/123',
      steps: [
        ({ html, push }) => {
          assertPropsRenderedForComponent(Reference, html)
          push('/sibling')
        },
        ({ html }) => {
          /* loading */
          assertPropsRenderedForComponent(Reference, html)
        },
        ({ html }) => {
          assertPropsNotRenderedForComponent(Reference, html)
          assertPropsRenderedForComponent(Sibling, html)
          done()
        }
      ]
    })
  })
})

describe('deferred loading', () => {

  const Parent = (props) => <div>{props.name} {props.children}</div>
  Parent.loadProps = (_, cb) => Parent.cb = cb
  Parent.fullProps = { name: 'parent' }
  Parent.callbackFull = () => Parent.cb(null, Parent.fullProps)

  const Child = (props) => <div>{props.partial} {props.full}</div>
  Child.loadProps = (_, cb) => Child.cb = cb
  Child.partialProps = { partial: 'partial' }
  Child.fullProps = { partial: 'partial', full: 'full' }
  Child.callbackPartial = () => Child.cb(null, Child.partialProps)
  Child.callbackFull = () => Child.cb(null, Child.fullProps)

  const assertLoadingRender = (html) => {
    expect(html).toContain('loading')
  }

  const assertFullPropsRendered = (Component, html) => {
    for (const key in Component.fullProps)
      expect(html).toContain(Component.fullProps[key])
  }

  const assertPartialPropsRendered = (Component, html) => {
    for (const key in Component.partialProps)
      expect(html).toContain(Component.partialProps[key])
  }

  it('renders when called back later', (done) => {
    createRunner(
      <Route path="/" component={Parent}>
        <Route path="child" component={Child}/>
      </Route>
    )({
      startPath: '/child',
      steps: [
        ({ html }) => {
          assertLoadingRender(html)
          Child.callbackPartial()
          Parent.callbackFull()
        },
        ({ html }) => {
          assertFullPropsRendered(Parent, html)
          assertPartialPropsRendered(Child, html)
          Child.callbackFull()
        },
        ({ html }) => {
          assertFullPropsRendered(Parent, html)
          assertFullPropsRendered(Child, html)
          done()
        }
      ]
    })
  })

  it('waits for all components to callback even if one has called back twice', () => {
    createRunner(
      <Route path="/" component={Parent}>
        <Route path="child" component={Child}/>
      </Route>
    )({
      startPath: '/child',
      steps: [
        ({ html }) => {
          assertLoadingRender(html)
          Child.callbackPartial()
          Child.callbackFull()
        },
        () => {
          throw new Error('should not have gotten here yet')
        }
      ]
    })
  })
})

