/*global __ASYNC_PROPS__*/
import React from 'react'
import RoutingContext from 'react-router/lib/RoutingContext'

const { array, func, object } = React.PropTypes

function last(arr) {
  return arr[arr.length - 1]
}

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
    if (Component.loadProps)
      flattened.push(Component)
  })
  return flattened
}

function loadAsyncProps(components, params, cb) {
  // flatten the multi-component routes
  let componentsArray = []
  let propsArray = []
  let needToLoadCounter = components.length

  const maybeFinish = () => {
    if (needToLoadCounter === 0)
      cb(null, { propsArray, componentsArray })
  }

  // If there is no components we should resolve directly
  if (needToLoadCounter === 0) {
    return maybeFinish()
  }

  components.forEach((Component, index) => {
    Component.loadProps(params, (error, props) => {
      needToLoadCounter--
      propsArray[index] = props
      componentsArray[index] = Component
      maybeFinish()
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

function arrayDiff(previous, next) {
  var diff = []

  for (var i = 0, l = next.length; i < l; i++)
    if (previous.indexOf(next[i]) === -1)
      diff.push(next[i])

  return diff
}

function shallowEqual(a, b) {
  var key
  var ka = 0
  var kb = 0

  for (key in a) {
    if (a.hasOwnProperty(key) && a[key] !== b[key])
      return false
    ka++
  }

  for (key in b)
    if (b.hasOwnProperty(key))
      kb++

  return ka === kb
}

function createElement(Component, props) {
  if (Component.loadProps)
    return <AsyncPropsContainer Component={Component} routerProps={props}/>
  else
    return <Component {...props}/>
}

export function loadPropsOnServer({ components, params }, cb) {
  loadAsyncProps(
    filterAndFlattenComponents(components),
    params,
    (err, propsAndComponents) => {
      if (err) {
        cb(err)
      }
      else {
        const json = JSON.stringify(propsAndComponents.propsArray, null, 2)
        const scriptString = `<script>__ASYNC_PROPS__ = ${json}</script>`
        cb(null, propsAndComponents, scriptString)
      }
    }
  )
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


class AsyncPropsContainer extends React.Component {

  static propTypes = {
    Component: func.isRequired,
    routerProps: object.isRequired
  }

  static contextTypes = {
    asyncProps: object.isRequired
  }

  render() {
    const { Component, routerProps } = this.props
    const { propsAndComponents, loading, reloadComponent } = this.context.asyncProps
    const asyncProps = lookupPropsForComponent(Component, propsAndComponents)
    const reload = () => reloadComponent(Component)
    return (
      <Component
        {...routerProps}
        {...asyncProps}
        reloadAsyncProps={reload}
        loading={loading}
      />
    )
  }

}

class AsyncProps extends React.Component {

  static childContextTypes = {
    asyncProps: object
  }

  static propTypes = {
    components: array.isRequired,
    params: object.isRequired,
    location: object.isRequired,
    onError: func.isRequired,
    renderLoading: func.isRequired,

    // server rendering
    propsArray: array,
    componentsArray: array
  }

  static defaultProps = {
    onError(err) {
      throw err
    },
    renderLoading() {
      return null
    }
  }

  constructor(props, context) {
    super(props, context)
    const { propsArray, componentsArray } = this.props
    const isServerRender = propsArray && componentsArray
    this.state = {
      loading: false,
      prevProps: null,
      propsAndComponents: isServerRender ?
        { propsArray, componentsArray } :
        hydrate(props)
    }
  }

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
  }

  componentDidMount() {
    const { components, params, location } = this.props
    this.loadAsyncProps(components, params, location)
  }

  componentWillReceiveProps(nextProps) {
    const routeChanged = nextProps.location !== this.props.location
    if (!routeChanged)
      return

    const oldComponents = filterAndFlattenComponents(this.props.components)
    const newComponents = filterAndFlattenComponents(nextProps.components)
    let components = arrayDiff(oldComponents, newComponents)

    if (components.length === 0) {
      const sameComponents = shallowEqual(oldComponents, newComponents)
      if (sameComponents) {
        const paramsChanged = !shallowEqual(nextProps.params, this.props.params)
        if (paramsChanged)
          components = [ last(newComponents) ]
      }
    }

    if (components.length > 0)
      this.loadAsyncProps(components, nextProps.params, nextProps.location)
  }

  handleError(cb) {
    return (err, ...args) => {
      if (err && this.props.onError)
        this.props.onError(err)
      else
        cb(null, ...args)
    }
  }

  componentWillUnmount() {
    this._unmounted = true
  }

  loadAsyncProps(components, params, location, options) {
    this.setState({
      loading: true,
      prevProps: this.props
    })
    loadAsyncProps(
      filterAndFlattenComponents(components),
      params,
      this.handleError((err, propsAndComponents) => {
        const force = options && options.force
        const sameLocation = this.props.location === location
        // FIXME: next line has potential (rare) race conditions I think. If
        // somebody calls reloadAsyncProps, changes location, then changes
        // location again before its done and state gets out of whack (Rx folks
        // are like "LOL FLAT MAP LATEST NEWB"). Will revisit later.
        if ((force || sameLocation) && !this._unmounted) {
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
      })
    )
  }

  reloadComponent(Component) {
    const { params } = this.props
    this.loadAsyncProps([ Component ], params, null, { force: true })
  }

  render() {
    const { propsAndComponents } = this.state
    if (!propsAndComponents) {
      return this.props.renderLoading()
    }
    else {
      const props = this.state.loading ? this.state.prevProps : this.props
      return <RoutingContext {...props} createElement={createElement} />
    }
  }

}

export default AsyncProps
