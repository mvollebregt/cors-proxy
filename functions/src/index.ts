import * as functions from 'firebase-functions';
import * as request from 'request';
import * as express from 'express';
import {CookieJar, CoreOptions, Response} from 'request';
import {Cookie} from 'request';


// Start writing Firebase Functions
// https://firebase.google.com/docs/functions/typescript

const baseUrl = 'http://www.loopgroepgroningen.nl/';

export const ledeninfo = functions.https.onRequest((request, response) =>
  forward(request, response,
    'index.php/loopgroep-groningen-ledeninfo')
);

export const acceptCookies = functions.https.onRequest((request, response) =>
  forward(request, response,
    'index.php?option=com_ajax&plugin=eprivacy&format=raw&method=accept&consent=&country=not+detected')
);

export const proxy = functions.https.onRequest((request, response) =>
  forward(request, response, request.query['url'])
);

function forward(
  originalRequest: express.Request, eventualResponse: express.Response, url: string, cookieJar = new SingleUseCookieJar()): void {
  request(baseUrl + url, rewriteRequest(originalRequest, cookieJar), (error, response, body) => {
    eventualResponse.append('set-cookie', rewriteCookies(response));

    // TODO: specifieker maken!
    eventualResponse.header('Access-Control-Allow-Origin', '*');
    eventualResponse.header("Access-Control-Allow-Credentials', 'true");
    eventualResponse.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, OPTIONS');
    eventualResponse.header('Access-Control-Max-Age', '1000');
    eventualResponse.header('Access-Control-Allow-Headers', 'Origin, Content-Type, X-Auth-Token , Authorization');

    eventualResponse.status(200).send(body);
  });
}

function rewriteRequest(originalRequest: express.Request, cookieJar: SingleUseCookieJar): CoreOptions {
  let options: CoreOptions = {};
  options.method = originalRequest.method;
  if (options.method === 'POST') {
    options.form = originalRequest.body;
  }
  const cookieHeader = originalRequest.headers['cookie'];
  if (cookieHeader) {
    const cookies = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader];
    cookies.forEach(cookie => cookieJar.setCookie(cookie));
  }
  options.jar = cookieJar;
  return options;
}

function rewriteCookies(response: Response): string[] {
  let setCookie: string[] = response.headers['set-cookie'] || [];
  // TODO: localhost is nu nog hard coded value
  // console.log(`response set-cookie headers: ${setCookie}`);
  return setCookie.map(cookie => {
    return cookie
      .replace('www.loopgroepgroningen.nl', 'localhost')
      .replace('domain=.', 'domain=localhost')
  });
}

// https://www.npmjs.com/package/cors
// https://github.com/7kfpun/cors-proxy/blob/master/functions/index.js

class SingleUseCookieJar implements CookieJar {

  private cookies: {[key: string]: string} = {};

  setCookie(cookieString: string): void {
    const semicolonIndex = cookieString.indexOf(';');
    const cookieStringWithoutOptions = cookieString.substring(0, semicolonIndex> -1 ? semicolonIndex: cookieString.length);
    const equalsIndex = cookieStringWithoutOptions.indexOf('=');
    const cookieName = cookieStringWithoutOptions.substring(0, equalsIndex);
    this.cookies[cookieName] = cookieStringWithoutOptions.substring(equalsIndex + 1);
  }

  getCookieString(): string {
    return Object.keys(this.cookies).map(cookieName => `${cookieName}=${this.cookies[cookieName]}`).join('; ');
  }

  getCookies(): Cookie[] {
    throw 'SingleUseCookieJar.getCookies is not implemented';
  }
}
