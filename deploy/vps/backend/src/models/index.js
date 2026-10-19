const { Sequelize } = require('sequelize');
const config = require('../config/database');
const Testimonial = require('./testimonial');

const sequelize = new Sequelize(config);

const models = {
  Testimonial: Testimonial.init(sequelize),
};

// Run associations if any
Object.values(models)
  .filter((model) => typeof model.associate === 'function')
  .forEach((model) => model.associate(models));

module.exports = {
  sequelize,
  Testimonial,
}; 