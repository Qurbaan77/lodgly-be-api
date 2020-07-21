const config = jest.genMockFromModule('config');

config.get.mockImplementation((arg) => {
  if (arg === 'logger.format') {
    return 'json';
  }
  return arg;
});

module.exports = config;
