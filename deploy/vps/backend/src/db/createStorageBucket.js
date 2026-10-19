require('dotenv').config();
const { supabaseAdmin } = require('../config/supabase');
const { setupLogger } = require('../utils/logger');
const { AppError } = require('../utils/AppError');

const logger = setupLogger();
const BUCKET_NAME = 'documents';

async function createStorageBucket() {
  try {
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
    
    if (listError) {
      throw new AppError('Error listing buckets', 500);
    }

    const bucketExists = buckets.some((bucket) => bucket.name === BUCKET_NAME);

    if (!bucketExists) {
      // Create bucket with public access
      const { error: createError } = await supabaseAdmin.storage.createBucket(BUCKET_NAME, {
        public: true,
        fileSizeLimit: 1024 * 1024 * 5, // 5MB limit
        allowedMimeTypes: ['application/pdf'],
      });

      if (createError) {
        throw new AppError('Error creating bucket', 500);
      }

      logger.info(`Created storage bucket: ${BUCKET_NAME}`);
    } else {
      // Update existing bucket to ensure it's public
      const { error: updateError } = await supabaseAdmin.storage.updateBucket(BUCKET_NAME, {
        public: true,
      });

      if (updateError) {
        throw new AppError('Error updating bucket', 500);
      }

      logger.info(`Updated storage bucket: ${BUCKET_NAME}`);
    }

    // Verify bucket is public
    const { data: bucket, error: getError } = await supabaseAdmin.storage.getBucket(BUCKET_NAME);
    
    if (getError) {
      throw new AppError('Error getting bucket info', 500);
    }

    if (!bucket.public) {
      throw new AppError('Bucket is not public', 500);
    }

    logger.info('Storage bucket setup completed successfully');
  } catch (error) {
    logger.error('Error in createStorageBucket:', error);
    throw error;
  }
}

// Run the script if called directly
if (require.main === module) {
  createStorageBucket()
    .then(() => process.exit(0))
    .catch((error) => {
      logger.error('Failed to create storage bucket:', error);
      process.exit(1);
    });
}

module.exports = createStorageBucket; 