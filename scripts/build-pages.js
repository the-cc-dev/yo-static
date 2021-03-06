const fs = require('fs')
const path = require('path')
const mkdirp = require('mkdirp')

const config = require('../lib/config')
const createRouter = require('../lib/router')
const createRenderer = require('../lib/render')
const metadata = require('../lib/metadata')
const pages = require('../lib/pages')
const sanitizePath = require('../lib/util').sanitizePath
var siteConfig = require(config.config_file)
var layouts = require('../lib/layouts')
var head = require('../lib/head')

const api = require('../lib/api')()

const docType = '<!DOCTYPE html>\n'

module.exports = function buildPages (argv, cb) {
  const errors = []
  console.time('build pages')

  const routes = metadata.asArray.map(m => m.permalink).map(sanitizePath)
  Array.prototype.push.apply(routes, Object.keys(pages).map(sanitizePath))

  var render = createRenderer(metadata.byFilePath, layouts, head, {siteConfig: siteConfig})

  var router = createRouter(render, api)

  router.addPageRoutes(pages)
  router.addContentRoutes(metadata.byPermalink)

  // Add trailing slash to missing routes and try again
  router.on('error', function (route, err) {
    if (route.length > 1 && !/\/$/.test(route)) {
      return router.transitionTo(route + '/')
    }
    console.error(router, err)
    errors.push(err)
    router.transitionTo(routes.shift())
  })

  // On transition, render the app with the page
  router.on('transition', function (route, page) {
    const filename = path.join(config.site_dir, route.replace(/\/$/, '/index.html'))
    mkdirp(path.dirname(filename), function (err) {
      if (err) errors.push(err)
      fs.writeFile(filename, docType + page.toString(), function (err) {
        if (err) errors.push(err)
        if (routes.length) {
          router.transitionTo(routes.shift())
        } else {
          console.timeEnd('build pages')
          if (cb) return cb(errors.length ? errors : null)
        }
      })
    })
  })

  router.transitionTo(routes.shift())
}
