const { seed } = require('../../src/services/seeder');

exports.seed = (knex) => seed(knex, 'plan', [
  {
    id: 1,
    planType: 'basic',
    booking: 1,
    calendar: 1,
    properties: 1,
    team: 1,
    invoice: 1,
    stats: 1,
    owner: 1,
    websiteBuilder: 0,
    channelManager: 1,
  },
  {
    id: 1,
    planType: 'advance',
    booking: 1,
    calendar: 1,
    properties: 1,
    team: 1,
    invoice: 1,
    stats: 1,
    owner: 1,
    websiteBuilder: 1,
    channelManager: 1,
  },
]);
