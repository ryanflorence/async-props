# AsyncProps for React Router

[![npm package](https://img.shields.io/npm/v/async-props.svg?style=flat-square)](https://www.npmjs.org/package/async-props)
[![#rackt on freenode](https://img.shields.io/badge/irc-rackt_on_freenode-61DAFB.svg?style=flat-square)](https://webchat.freenode.net/)

Co-located data loading for React Router apps. Data is loaded before the new screen renders. It is designed to be both a useful solution for many apps, as well as a reference implementation for integrating data with React Router (stuff like redux, relay, falcor etc).

## Docs & Help

- [Changelog](/CHANGES.md)
- [#react-router @ Reactiflux](https://discord.gg/0ZcbPKXt5bYaNQ46)
- [Stack Overflow](http://stackoverflow.com/questions/tagged/react-router)

For questions and support, please visit [our channel on Reactiflux](https://discord.gg/0ZcbPKXt5bYaNQ46) or [Stack Overflow](http://stackoverflow.com/questions/tagged/react-router). The issue tracker is *exclusively* for bug reports and feature requests.

## Installation

Using [npm](https://www.npmjs.com/):

    $ npm install async-props

Then with a module bundler like [webpack](https://webpack.github.io/), use as you would anything else:

```js
// using an ES6 transpiler, like babel
import AsyncProps from 'async-props'
```

The UMD build is also available on [npmcdn](https://npmcdn.com):

```html
<script src="https://npmcdn.com/async-props/umd/AsyncProps.min.js"></script>
```

You can find the library on `window.AsyncProps`.

## Notes

This is pre-release, it's pretty close though. If you are using it then you are
a contributor. Please add tests with all pull requests.

## Usage

```js
import { Router, Route } from 'react-router'
import AsyncProps from 'async-props'
import React from 'react'
import { render } from 'react-dom'

class App extends React.Component {

  // 1. define a `loadProps` static method
  static loadProps(params, cb) {
    cb(null, {
      tacos: [ 'Pollo', 'Carnitas' ]
    })
  }

  render() {
    // 2. access data as props :D
    const tacos = this.props.tacos
    return (
      <div>
        <ul>
          {tacos.map(taco => (
            <li>{taco}</li>
          ))}
        </ul>
      </div>
    )
  }
}

// 3. Render `Router` with AsyncProps middleware
render((
  <Router render={(props) => <AsyncProps {...props}/>}>
    <Route path="/" component={App}/>
  </Router>
), el)
```

### Server

```js
import { renderToString } from 'react-dom/server'
import { match, RoutingContext } from 'react-router'
import AsyncProps, { loadPropsOnServer } from 'async-props'

app.get('*', (req, res) => {
  match({ routes, location: req.url }, (err, redirect, renderProps) => {

    // 1. load the props
    loadPropsOnServer(renderProps, (err, asyncProps, scriptTag) => {

      // 2. use `AsyncProps` instead of `RoutingContext` and pass it
      //    `renderProps` and `asyncProps`
      const appHTML = renderToString(
        <AsyncProps {...renderProps} {...asyncProps} />
      )

      // 3. render the script tag into the server markup
      const html = createPage(appHTML, scriptTag)
      res.send(html)
    })
  })
})

function createPage(html, scriptTag) {
  return `
    <!doctype html>
    <html>
      <!-- etc. --->
      <body>
        <div id="app">${html}</div>

        <!-- its a string -->
        ${scriptTag}
      </body>
    </html>
  `
}
```

## API

Please refer to the example, as it exercises the entire API. Docs will
come eventually :)

