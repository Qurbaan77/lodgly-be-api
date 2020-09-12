exports.seed = (knex, tableName, payload) => payload.reduce((acc, item, index) => acc.then(async () => {
  const id = item.id || (index + 1);

  if (await knex(tableName).where('id', '=', id).first()) {
    return Promise.resolve([id]);
  }
  return knex(tableName).insert(item);
}), Promise.resolve());
