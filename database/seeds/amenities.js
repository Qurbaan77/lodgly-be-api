const { seed } = require('../../src/services/seeder');
const amenity = require('../../src/uitls/utils');

exports.seed = (knex) => seed(knex, 'amenities', amenity);
