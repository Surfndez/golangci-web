import { match } from 'react-router';
import { createMemoryHistory } from 'history';
import React from 'react';
import {renderToString} from 'react-dom/server';
import {Provider} from 'react-redux';
import * as express from 'express';
//import createRoutes from './routes';
import configureStore from './store/configure';
import Helmet from 'react-helmet';
import {syncHistoryWithStore} from 'react-router-redux';
import * as queryString from 'query-string';
import buildRoutes from './routes/routes';
import { IAppStore } from './reducers';
import rootSaga from './sagas';
import { StaticRouter } from 'react-router-dom';
import { setMobileDetect, mobileParser } from 'react-responsive-redux'


const env = process.env;

var webpackPartialTmpl: string;

const render = (req: express.Request, res: express.Response) => {
  let startedAt = Date.now();
  let qs = "?" + queryString.stringify(req.query);

  const memoryHistory = createMemoryHistory();

  let initialState: IAppStore = {
    auth: {
      cookie: (req.headers.cookie || "").toString(),
    }
  };
  console.log("initial state is", initialState);
  const store: any = configureStore(initialState, memoryHistory);
  const history = syncHistoryWithStore(memoryHistory, store);

  // do our mobile detection
  const mobileDetect = mobileParser(req)

  // set mobile detection for our responsive store
  store.dispatch(setMobileDetect(mobileDetect))

  const routes = buildRoutes();

  let context: any = {};
  const rootComp = (
    <Provider store={store}>
      <StaticRouter location={req.url} context={context}>
        {routes}
      </StaticRouter>
    </Provider>
  );

  // When first render is done and all saga's are run, render again with updated store.
  store.runSaga(rootSaga).done.then(() => {
    let preloadedAt = Date.now();
    const html = renderToString(rootComp);
    let state: IAppStore = store.getState();
    if (state.result.apiResultHttpCode != 200) {
      console.warn("request %s was processed for %sms: return %d",
        req.url, Date.now() - startedAt, state.result.apiResultHttpCode);
      res.sendStatus(state.result.apiResultHttpCode);
      return;
    }

    if (context.url) {
      res.redirect(307, context.url);
      console.info("request %s was processed for %sms: redirect to %s",
        req.url, Date.now() - startedAt, context.url);
      return;
    }

    let renderedAt = Date.now();
    let retHtml = renderHtml(html, state);
    let htmlCreatedAt = Date.now();
    res.status(200).send(retHtml);
    let sentAt = Date.now();
    console.info("request %s was processed for %sms: preload=%sms, render=%sms, html=%sms, send=%sms",
      req.url, Date.now() - startedAt,
      preloadedAt - startedAt, renderedAt - preloadedAt,
      htmlCreatedAt - renderedAt, sentAt - htmlCreatedAt
    );
  });

  // Do first render, starts initial actions.
  renderToString(rootComp);

  // When the first render is finished, send the END action to redux-saga.
  store.close();
}

const faviconHtml = `
<link rel="apple-touch-icon" sizes="180x180" href="/favicon/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon/favicon-16x16.png">
<link rel="manifest" href="/favicon/manifest.json">
<link rel="mask-icon" href="/favicon/safari-pinned-tab.svg" color="#5bbad5">
<link rel="shortcut icon" href="/favicon/favicon.ico">
<meta name="msapplication-TileColor" content="#2b5797">
<meta name="msapplication-TileImage" content="/favicon/mstile-144x144.png">
<meta name="msapplication-config" content="/favicon/browserconfig.xml">
<meta name="theme-color" content="#ffffff">
`;

const loadWebpackPartialTmpl = () => {
  if (__DEV__) {
    webpackPartialTmpl = `
      <script src="/js/dist/dev/dev.client.app.js" type="text/javascript" defer></script>
      <link href="https://fonts.googleapis.com/css?family=Roboto" rel="stylesheet"></link>
    `;
    return;
  }

  let fs = require('fs')
  webpackPartialTmpl = fs.readFileSync("./dist/prod/webpack.partial.html");
  console.log("loaded webpack partial");
}

const renderHtml = (content: string, state: IAppStore) => {
  if (!webpackPartialTmpl) {
    loadWebpackPartialTmpl();
  }

  const head = Helmet.rewind();
  const statScripts = __DEV__ ? '' : `
  <!-- Yandex.Metrika counter -->
  <script type="text/javascript" >
      (function (d, w, c) {
          (w[c] = w[c] || []).push(function() {
              try {
                  w.yaCounter47296422 = new Ya.Metrika({
                      id:47296422,
                      clickmap:true,
                      trackLinks:true,
                      accurateTrackBounce:true,
                      webvisor:true
                  });
              } catch(e) { }
          });

          var n = d.getElementsByTagName("script")[0],
              s = d.createElement("script"),
              f = function () { n.parentNode.insertBefore(s, n); };
          s.type = "text/javascript";
          s.async = true;
          s.src = "https://mc.yandex.ru/metrika/watch.js";

          if (w.opera == "[object Opera]") {
              d.addEventListener("DOMContentLoaded", f, false);
          } else { f(); }
      })(document, window, "yandex_metrika_callbacks");
  </script>
  <noscript><div><img src="https://mc.yandex.ru/watch/47296422" style="position:absolute; left:-9999px;" alt="" /></div></noscript>
  <!-- /Yandex.Metrika counter -->

  <!-- Global site tag (gtag.js) - Google Analytics -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=UA-48413061-12"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());

    gtag('config', 'UA-48413061-12');
  </script>
  `;

  return `
  <!DOCTYPE html>
  <!--[if IE 8]> <html lang="en" class="ie8"> <![endif]-->
  <!--[if IE 9]> <html lang="en" class="ie9"> <![endif]-->
  <!--[if !IE]><!-->
  <html lang="ru">
    <!--<![endif]-->
    <head>
      ${head.title.toString()}
      ${head.script.toString()}
      ${head.link.toString()}
      ${head.meta.toString()}

      ${faviconHtml}

      <script>
        window.__INITIAL_STATE__ = JSON.parse(decodeURIComponent("${encodeURIComponent(JSON.stringify(state))}"));
      </script>

      ${webpackPartialTmpl}

      ${statScripts}
    </head>
    <body data-spy="scroll"><div id="react-app">${content}</div></body>
  </html>`
}

export default render;
