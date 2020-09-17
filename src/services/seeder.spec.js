const { seed } = require('./seeder');

describe('seeder service', () => {
  const tableName = 'tableName';
  const payload = [
    { id: 1, name: 'name' },
    { name: 'some' },
  ];

  it('should run seeder and insert new items', async () => {
    const results = [1, 2];
    const first = jest.fn().mockResolvedValue(null);
    const where = jest.fn().mockReturnValue({ first });
    const insert = jest.fn().mockReturnValue(results);

    const knex = jest.fn().mockImplementation(() => ({ where, insert }));

    await expect(seed(knex, tableName, payload)).resolves.toEqual(results);

    expect(knex).toBeCalledWith(tableName);
    expect(where).toBeCalledWith('id', '=', 1);
    expect(first).toBeCalled();
    expect(insert).toBeCalledWith(payload[0]);
  });

  it('should run seeder and do not insert', async () => {
    const results = [2];

    const first = jest.fn().mockResolvedValue({ id: 1 });
    const where = jest.fn().mockReturnValue({ first });
    const insert = jest.fn().mockReturnValue();

    const knex = jest.fn().mockImplementation(() => ({ where, insert }));

    await expect(seed(knex, tableName, payload)).resolves.toEqual(results);

    expect(knex).toBeCalledWith(tableName);
    expect(where).toBeCalledWith('id', '=', 1);
    expect(first).toBeCalled();
    expect(insert).not.toBeCalled();
  });
});
