const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.createTable('testimonials', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      client_name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      event_type: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      source: {
        type: DataTypes.ENUM('manual', 'post_event_email'),
        allowNull: false,
        defaultValue: 'manual',
      },
      designation_or_location: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      testimonial_text: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      client_photo: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      rating: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: {
          min: 1,
          max: 5,
        },
      },
      featured: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      related_object_type: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      related_object_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('active', 'inactive'),
        allowNull: false,
        defaultValue: 'active',
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    });

    // Add indexes for better query performance
    await queryInterface.addIndex('testimonials', ['related_object_type', 'related_object_id']);
    await queryInterface.addIndex('testimonials', ['featured']);
    await queryInterface.addIndex('testimonials', ['status']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('testimonials');
  },
}; 