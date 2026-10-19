const getUser = () => {
  if (process.env.NODE_ENV === 'test') {
    return require('../tests/mocks/User');
  }
  return require('../models/User');
};

module.exports = { getUser }; 