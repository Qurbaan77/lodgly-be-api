const { Readable } = require('stream');
const knex = require('knex');
const config = require('config');

const database = require('./database');

jest.mock('knex');
jest.mock('config');

describe('#database', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  describe('#getConnection', () => {
    let connection;

    beforeEach(() => {
      connection = new Readable();
      connection.data = 'connection';
      knex.mockReturnValue(connection);
    });

    it('should create a new connection to the database', async () => {
      expect(database.getConnection()).toEqual(connection);

      expect(knex).toBeCalledWith('database');
      expect(config.get).toHaveBeenNthCalledWith(1, 'database');
    });

    it('should get the same connection on subsequent calls', () => {
      expect(database.getConnection(true)).toEqual(connection);
      expect(database.getConnection()).toEqual(connection);

      expect(knex).toBeCalledTimes(1);
    });
  });

  describe('#transaction', () => {
    it('should use transaction', async () => {
      const handler = jest.fn();
      const results = 'data';

      const transaction = jest.fn().mockResolvedValue(results);
      const getConnection = jest.spyOn(database, 'getConnection').mockReturnValue({ transaction });

      expect(await database.transaction(handler)).toBe(results);

      expect(getConnection).toBeCalled();
      expect(transaction).toBeCalledWith(handler);
    });
  });

  describe('#select', () => {
    it('should select elements by condition from a table', async () => {
      const table = 'table';
      const condition = { id: 1 };
      const result = ['result'];
      const where = jest.fn().mockResolvedValue(result);
      const from = jest.fn().mockReturnValue({ where });
      const select = jest.fn().mockReturnValue({ from });
      const getConnection = jest.spyOn(database, 'getConnection').mockReturnValue({ select });

      expect(await database.select(table, condition)).toBe(result);

      expect(getConnection).toBeCalled();
      expect(select).toBeCalled();
      expect(from).toBeCalledWith(table);
      expect(where).toBeCalledWith(condition);
    });
  });

  describe('#insert', () => {
    it('should insert an element into a table', async () => {
      const table = 'table';
      const data = { firstname: 'John' };
      const result = ['result'];
      const into = jest.fn().mockReturnValue(result);
      const insert = jest.fn().mockReturnValue({ into });
      const getConnection = jest.spyOn(database, 'getConnection').mockReturnValue({ insert });

      expect(await database.insert(table, data)).toBe(result);

      expect(getConnection).toBeCalled();
      expect(insert).toBeCalledWith(data);
      expect(into).toBeCalledWith(table);
    });
  });

  describe('#update', () => {
    it('should update an element in a table with conditions', async () => {
      const table = 'table';
      const data = { firstname: 'John' };
      const conditions = { id: 1 };
      const result = ['result'];
      const into = jest.fn().mockResolvedValue(result);
      const update = jest.fn().mockReturnValue({ into });
      const where = jest.fn().mockReturnValue({ update });

      const getConnection = jest.spyOn(database, 'getConnection').mockReturnValue({ where });

      expect(await database.update(table, data, conditions)).toBe(result);

      expect(getConnection).toBeCalled();
      expect(where).toBeCalledWith(conditions);
      expect(update).toBeCalledWith(data);
      expect(into).toBeCalledWith(table);
    });
  });

  describe('#remove', () => {
    it('should remove an element from a table by conditions', async () => {
      const table = 'table';
      const conditions = { id: 1 };
      const result = ['result'];
      const del = jest.fn().mockResolvedValue(result);
      const into = jest.fn().mockReturnValue({ del });
      const where = jest.fn().mockReturnValue({ into });

      const getConnection = jest.spyOn(database, 'getConnection').mockReturnValue({ where });

      expect(await database.remove(table, conditions)).toBe(result);

      expect(getConnection).toBeCalled();
      expect(where).toBeCalledWith(conditions);
      expect(into).toBeCalledWith(table);
      expect(del).toBeCalled();
    });
  });
});
