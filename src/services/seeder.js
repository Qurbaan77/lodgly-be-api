exports.seed = (knex, tableName, payload) => Promise.all(payload.map(async (item) => {
  if (await knex(tableName).where('id', '=', item.id).first()) {
    return Promise.resolve([item.id]);
  }
  return knex(tableName).insert(item);
}));
