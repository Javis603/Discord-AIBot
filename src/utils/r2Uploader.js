/**
 * @file r2Uploader.js
 * @description Cloudflare R2 image upload utility
 * @author Javis
 */

const {
    S3Client,
    PutObjectCommand,
    ListObjectsV2Command,
    DeleteObjectsCommand,
    DeleteObjectCommand,
} = require('@aws-sdk/client-s3');
const crypto = require('crypto');

function isR2Configured() {
    return !!(
        process.env.CLOUDFLARE_R2_ACCOUNT_ID &&
        process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
        process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY &&
        process.env.CLOUDFLARE_R2_BUCKET_NAME
    );
}

function initR2Client() {
    if (!isR2Configured()) {
        return null;
    }

    const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;

    return new S3Client({
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        region: 'auto',
        credentials: {
            accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
            secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
        },
        forcePathStyle: true,
    });
}

function generateFilePath(userId, extension) {
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    return `${userId}/${timestamp}-${randomString}.${extension}`;
}

function getExtensionFromUrl(url) {
    try {
        const urlObj = new URL(url);
        const match = urlObj.pathname.match(/\.([a-z0-9]+)$/i);
        return match ? match[1] : 'png';
    } catch (error) {
        console.error('提取副檔名失敗:', error);
        return 'png';
    }
}

function getPublicUrl(filePath) {
    if (process.env.CLOUDFLARE_R2_PUBLIC_URL) {
        const baseUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL.replace(/\/$/, '');
        return `${baseUrl}/${filePath}`;
    }

    return `https://pub-${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.dev/${filePath}`;
}

async function uploadImageToR2(discordImageUrl, userId) {
    if (!isR2Configured()) {
        return null;
    }

    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const s3Client = initR2Client();
            if (!s3Client) {
                return null;
            }

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 30000);

            try {
                const response = await fetch(discordImageUrl, {
                    signal: controller.signal,
                });
                clearTimeout(timeout);

                if (!response.ok) {
                    throw new Error(`下載圖片失敗: ${response.statusText}`);
                }

                const imageBuffer = await response.arrayBuffer();
                const contentType = response.headers.get('content-type') || 'image/png';
                const extension = getExtensionFromUrl(discordImageUrl);
                const filePath = generateFilePath(userId, extension);

                const uploadParams = {
                    Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
                    Key: filePath,
                    Body: Buffer.from(imageBuffer),
                    ContentType: contentType,
                    CacheControl: 'public, max-age=31536000, immutable',
                };

                await s3Client.send(new PutObjectCommand(uploadParams));

                return getPublicUrl(filePath);
            } catch (fetchError) {
                clearTimeout(timeout);
                throw fetchError;
            }
        } catch (error) {
            if (attempt === maxRetries) {
                console.error(`❌ 上傳到 R2 失敗 (已重試 ${maxRetries} 次):`, error.message);
            } else {
                const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                console.log(`⚠️ 上傳失敗，${waitTime}ms 後重試 (${attempt}/${maxRetries})...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }

    return null;
}

async function processImageUrl(discordImageUrl, userId) {
    const r2Url = await uploadImageToR2(discordImageUrl, userId);
    return r2Url || discordImageUrl;
}

async function processMultipleImages(attachments, userId) {
    const urlPromises = attachments.map(attachment =>
        processImageUrl(attachment.url, userId)
    );
    return Promise.all(urlPromises);
}

async function deleteUserImages(userId) {
    if (!isR2Configured()) {
        console.log('⚠️ Cloudflare R2 未配置，無需刪除');
        return { success: true, deletedCount: 0 };
    }

    try {
        const s3Client = initR2Client();
        if (!s3Client) {
            return { success: false, deletedCount: 0, error: 'R2 客戶端初始化失敗' };
        }

        const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;
        const prefix = `${userId}/`;

        const listedObjects = await s3Client.send(new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: prefix,
        }));

        if (!listedObjects.Contents || listedObjects.Contents.length === 0) {
            return { success: true, deletedCount: 0 };
        }

        const deleteResult = await s3Client.send(new DeleteObjectsCommand({
            Bucket: bucketName,
            Delete: {
                Objects: listedObjects.Contents.map(({ Key }) => ({ Key })),
                Quiet: false,
            },
        }));

        const deletedCount = deleteResult.Deleted ? deleteResult.Deleted.length : 0;
        return { success: true, deletedCount };
    } catch (error) {
        console.error('❌ 從 R2 刪除圖片失敗:', error);
        return { success: false, deletedCount: 0, error: error.message };
    }
}

async function deleteImage(fileKey) {
    if (!isR2Configured()) {
        return false;
    }

    try {
        const s3Client = initR2Client();
        if (!s3Client) {
            return false;
        }

        await s3Client.send(new DeleteObjectCommand({
            Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
            Key: fileKey,
        }));

        return true;
    } catch (error) {
        console.error('❌ 刪除 R2 圖片失敗:', error);
        return false;
    }
}

async function deleteImageFromR2(imageUrl) {
    if (!imageUrl || typeof imageUrl !== 'string') {
        return false;
    }

    try {
        const url = new URL(imageUrl);
        const pathParts = url.pathname.split('/').filter(Boolean);

        if (pathParts.length < 2) {
            console.error('無效的 R2 URL 格式:', imageUrl);
            return false;
        }

        const fileKey = pathParts.join('/');
        return deleteImage(fileKey);
    } catch (error) {
        console.error('從 URL 刪除 R2 圖片失敗:', error);
        return false;
    }
}

module.exports = {
    isR2Configured,
    uploadImageToR2,
    processImageUrl,
    processMultipleImages,
    generateFilePath,
    deleteUserImages,
    deleteImage,
    deleteImageFromR2,
};
