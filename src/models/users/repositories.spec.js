const { select } = require('../../services/database');
const { TABLE_NAME } = require('./constants');

jest.mock('../../services/database');

const userRepository = require('./repositories');

describe('user repositories', () => {
  it('should get one investmentRequest by any condition', async () => {
    const result = { data: 'result' };
    const condition = { data: 'condition' };

    select.mockResolvedValue(result);

    await expect(userRepository.getOneBy(condition)).resolves.toEqual(result);

    expect(select).toBeCalledWith(TABLE_NAME, condition);
  });
});
