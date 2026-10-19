const BaseModel = require('./BaseModel');

class Gallery extends BaseModel {
  constructor() {
    super('galleries');
  }

  async createGallery(data) {
    const { title, tagline, images } = data;
    
    if (!title || !tagline || !images || !Array.isArray(images)) {
      throw new Error('Invalid gallery data');
    }

    return await this.create({
      title,
      tagline,
      images,
      created_at: new Date(),
      updated_at: new Date(),
    });
  }

  async updateGallery(id, data) {
    const { title, tagline, images } = data;
    
    if (images && !Array.isArray(images)) {
      throw new Error('Images must be an array');
    }

    const updateData = {
      ...data,
      updated_at: new Date(),
    };

    return await this.update(id, updateData);
  }

  async getGallery(id) {
    const gallery = await this.findById(id);
    return gallery;
  }

  async getAllGalleries() {
    const galleries = await this.findAll();
    return galleries;
  }
}

module.exports = new Gallery(); 