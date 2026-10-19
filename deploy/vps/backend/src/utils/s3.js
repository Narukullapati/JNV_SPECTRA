const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { setupLogger } = require('./logger');

const logger = setupLogger();

// Configure AWS S3 client (S3_ENDPOINT enables S3-compatible stores like MinIO)
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  ...(process.env.S3_ENDPOINT && {
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true,
  }),
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

/**
 * Upload a file to S3
 * @param {string} filePath - The path where the file will be stored in S3
 * @param {Buffer} fileBuffer - The file buffer to upload
 * @param {string} contentType - The MIME type of the file
 * @returns {Promise<void>}
 */
const uploadToS3 = async (filePath, fileBuffer, contentType) => {
  try {
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: filePath,
      Body: fileBuffer,
      ContentType: contentType,
    });

    await s3Client.send(command);
    logger.info(`File uploaded successfully to ${filePath}`);
  } catch (error) {
    logger.error('Error uploading to S3:', error);
    throw error;
  }
};

/**
 * Get the public URL for a file in S3
 * @param {string} filePath - The path of the file in S3
 * @returns {string} - The public URL of the file
 */
const getS3PublicUrl = (filePath) => {
  if (process.env.S3_PUBLIC_BASE_URL) {
    return `${process.env.S3_PUBLIC_BASE_URL}/${filePath}`;
  }
  return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${filePath}`;
};

/**
 * Delete a file from S3
 * @param {string} filePath - The path of the file to delete in S3
 * @returns {Promise<void>}
 */
const deleteFromS3 = async (filePath) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: filePath,
    });

    await s3Client.send(command);
    logger.info(`File deleted successfully from ${filePath}`);
  } catch (error) {
    logger.error('Error deleting from S3:', error);
    throw error;
  }
};

module.exports = {
  uploadToS3,
  getS3PublicUrl,
  deleteFromS3,
}; 