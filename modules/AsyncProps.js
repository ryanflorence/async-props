/*global __ASYNC_PROPS__*/
import React from 'react'
import RouterContext from 'react-router/lib/RouterContext'
import computeChangedRoutes from 'react-router/lib/computeChangedRoutes'

const { array, func, object } = React.PropTypes

function eachComponents(components, iterator) {
  for (var i = 0, l = components.length; i < l; i++) {
    if (typeof components[i] === 'object') {
      for (var key in components[i]) {
        iterator(components[i][key], i, key)
      }
    } else {
      iterator(components[i], i)
    }
  }
}

function filterAndFlattenComponents(components) {
  var flattened = []
  eachComponents(components, (Component) => {
    if (Component && Component.loadProps)
      flattened.push(Component)
  })
  return flattened
}

function loadAsyncProps({ components, params, loadContext }, cb) {
  // flatten the multi-component routes
  let componentsArray = []
  let propsArray = []
  let needToLoadCounter = components.length
  let hasCalledBack = []

  const maybeFinish = (err) => {
    if ( err ) {
      // error occured, stop executing
      cb(err)
      return
    }

    if (needToLoadCounter === 0)
      cb(null, { propsArray, componentsArray })
  }

  // If there are no components we should resolve directly
  if (needToLoadCounter === 0) {
    return maybeFinish()
  }

  components.forEach((Component, index) => {
    Component.loadProps({ params, loadContext }, (error, props) => {
      if (hasCalledBack[index] && needToLoadCounter === 0) {
        // deferred data
        cb(error, {
          propsArray: [ props ],
          componentsArray: [ Component ]
        })
      } else {
        if (!hasCalledBack[index])
          needToLoadCounter--
        propsArray[index] = props
        componentsArray[index] = Component
        hasCalledBack[index] = true
        maybeFinish(error)
      }
    })
  })
}

function lookupPropsForComponent(Component, propsAndComponents) {
  const { componentsArray, propsArray } = propsAndComponents
  var index = componentsArray.indexOf(Component)
  return propsArray[index]
}

function mergePropsAndComponents(current, changes) {
  for (var i = 0, l = changes.propsArray.length; i < l; i++) {
    let Component = changes.componentsArray[i]
    let position = current.componentsArray.indexOf(Component)
    let isNew = position === -1

    if (isNew) {
      current.propsArray.push(changes.propsArray[i])
      current.componentsArray.push(changes.componentsArray[i])
    } else {
      current.propsArray[position] = changes.propsArray[i]
    }
  }
  return current
}

function createElement(Component, props) {
  if (Component.loadProps)
    return <AsyncPropsContainer Component={Component} routerProps={props}/>
  else
    return <Component {...props}/>
}

export function loadPropsOnServer({ components, params }, loadContext, cb) {
  loadAsyncProps({
    components: filterAndFlattenComponents(components),
    params,
    loadContext
  }, (err, propsAndComponents) => {
    if (err) {
      cb(err)
    }
    else {
      const json = JSON.stringify(propsAndComponents.propsArray, null, 2)
      const scriptString = `<script>__ASYNC_PROPS__ = ${json}</script>`
      cb(null, propsAndComponents, scriptString)
    }
  })
}

function hydrate(props) {
  if (typeof __ASYNC_PROPS__ !== 'undefined')
    return {
      propsArray: __ASYNC_PROPS__,
      componentsArray: filterAndFlattenComponents(props.components)
    }
  else
    return null
}


const AsyncPropsContainer = React.createClass({

  propTypes: {
    Component: func.isRequired,
    routerProps: object.isRequired
  },

  contextTypes: {
    asyncProps: object.isRequired
  },

  render() {
    const { Component, routerProps, ...props } = this.props
    const { propsAndComponents, loading, reloadComponent } = this.context.asyncProps
    const asyncProps = lookupPropsForComponent(Component, propsAndComponents)
    const reload = () => reloadComponent(Component)
    return (
      <Component
        {...props}
        {...routerProps}
        {...asyncProps}
        reloadAsyncProps={reload}
        loading={loading}
      />
    )
  }

})

const AsyncProps = React.createClass({

  childContextTypes: {
    asyncProps: object
  },

  propTypes: {
    loadContext: object,
    components: array.isRequired,
    params: object.isRequired,
    location: object.isRequired,
    onError: func.isRequired,
    renderLoading: func.isRequired,

    // server rendering
    propsArray: array,
    componentsArray: array
  },

  getDefaultProps() {
    return {
      onError(err) {
        throw err
      },

      renderLoading() {
        return null
      },

      render(props) {
        return <RouterContext {...props} createElement={createElement}/>
      }
    }
  },

  getInitialState() {
    const { propsArray, componentsArray } = this.props
    const isServerRender = propsArray && componentsArray
    return {
      loading: false,
      prevProps: null,
      propsAndComponents: isServerRender ?
        { propsArray, componentsArray } :
        hydrate(this.props)
    }
  },

  getChildContext() {
    const { loading, propsAndComponents } = this.state
    return {
      asyncProps: {
        loading,
        propsAndComponents,
        reloadComponent: (Component) => {
          this.reloadComponent(Component)
        }
      }
    }
  },

  componentDidMount() {
    const wasHydrated = this.state.propsAndComponents !== null
    if (!wasHydrated) {
      const { components, params, location } = this.props
      this.loadAsyncProps(components, params, location)
    }
  },

  componentWillReceiveProps(nextProps) {
    if (nextProps.location === this.props.location)
      return

    const { enterRoutes } = computeChangedRoutes(
      { routes: this.props.routes, params: this.props.params },
      { routes: nextProps.routes, params: nextProps.params }
    )

    const indexDiff = nextProps.components.length - enterRoutes.length
    const components = []
    for (let i = 0, l = enterRoutes.length; i < l; i++)
      components.push(nextProps.components[indexDiff + i])

    this.loadAsyncProps(
      filterAndFlattenComponents(components),
      nextProps.params,
      nextProps.location
    )
  },

  handleError(cb) {
    return (err, ...args) => {
      if (err && this.props.onError)
        this.props.onError(err)
      else
        cb(null, ...args)
    }
  },

  componentWillUnmount() {
    this._unmounted = true
  },

  loadAsyncProps(components, params, location, options) {
    const { loadContext } = this.props
    this.setState({
      loading: true,
      prevProps: this.props
    }, () => {
      loadAsyncProps({
        components: filterAndFlattenComponents(components),
        params,
        loadContext
      }, this.handleError((err, propsAndComponents) => {
        const reloading = options && options.reload
        const didNotChangeRoutes = this.props.location === location
        // FIXME: next line has potential (rare) race conditions I think. If
        // somebody calls reloadAsyncProps, changes location, then changes
        // location again before its done and state gets out of whack (Rx folks
        // are like "LOL FLAT MAP LATEST NEWB"). Will revisit later.
        if ((reloading || didNotChangeRoutes) && !this._unmounted) {
          if (this.state.propsAndComponents) {
            propsAndComponents = mergePropsAndComponents(
              this.state.propsAndComponents,
              propsAndComponents
            )
          }
          this.setState({
            loading: false,
            propsAndComponents,
            prevProps: null
          })
        }
      }))
    })
  },

  reloadComponent(Component) {
    const { params } = this.props
    this.loadAsyncProps([ Component ], params, null, { reload: true })
  },

  render() {
    const { propsAndComponents } = this.state
    if (!propsAndComponents) {
      return this.props.renderLoading()
    }
    else {
      const props = this.state.loading ? this.state.prevProps : this.props
      return this.props.render(props)
    }
  }

})

export default AsyncProps
