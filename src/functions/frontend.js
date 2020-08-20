const config = require('config');
const { stringify } = require('querystring');
const { format } = require('util');

exports.frontendUrl = (subdomain, path = '/', params = {}) => [
  format(config.get('frontend.app.endpoint'), subdomain), path, '?', stringify(params),
].join('').replace(/\?$/, '');

exports.domainName = (subdomain) => format(config.get('frontend.app.endpoint'), subdomain)
  .replace(/^https?:\/\//, '');

exports.ownerPanelUrl = (subdomain, path = '/', params = {}) => [
  format(config.get('frontend.owners.endpoint')), path, '?', stringify(params),
].join('').replace(/\?$/, '');

exports.ownerPanelDomaimName = (subdomain) => format(config.get('frontend.owners.endpoint'), subdomain)
  .replace(/^https?:\/\//, '');
