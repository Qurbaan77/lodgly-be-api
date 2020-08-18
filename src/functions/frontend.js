const config = require('config');
const { stringify } = require('querystring');
const { format } = require('util');

exports.frontendUrl = (subdomain, path = '/', params = {}) => [
  format(config.get('frontend.endpoint'), subdomain), path, '?', stringify(params),
].join('').replace(/\?$/, '');

exports.domainName = (subdomain) => format(config.get('frontend.endpoint'), subdomain)
  .replace(/^https?:\/\//, '');

exports.ownerPanelUrl = (subdomain, path = '/', params = {}) => [
  format(config.get('ownerFrontend.endpoint')), path, '?', stringify(params),
].join('').replace(/\?$/, '');

exports.ownerPanelDomaimName = (subdomain) => format(config.get('ownerFrontend.endpoint'), subdomain)
  .replace(/^https?:\/\//, '');
