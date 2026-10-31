import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import ApiError from "../../shared/utils/ApiError.js";
import { StatusCodes } from "http-status-codes";

export class StorageService {
  private client: S3Client;
  private bucket: string;

  constructor() {
    this.bucket = env.STORAGE_BUCKET_NAME;

    const s3Config: ConstructorParameters<typeof S3Client>[0] = {
      region: env.AWS_REGION,
      forcePathStyle: true,
    };

    if (env.AWS_ENDPOINT_URL_S3) {
      s3Config.endpoint = env.AWS_ENDPOINT_URL_S3;
    }

    if (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) {
      s3Config.credentials = {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      };
    }

    this.client = new S3Client(s3Config);
  }

  /**
   * Generates a deterministic, structured object storage key
   * Format: logsense/{organizationId}/{projectId}/{serviceName || "unassigned"}/{timestamp}-{cleanFileName}
   */
  generateLogKey(params: {
    organizationId: string;
    projectId: string;
    serviceName?: string | null;
    originalFileName: string;
  }): string {
    const cleanOrg = params.organizationId.replace(/[^a-zA-Z0-9_-]/g, "");
    const cleanProject = params.projectId.replace(/[^a-zA-Z0-9_-]/g, "");
    const cleanService = (params.serviceName || "unassigned").replace(/[^a-zA-Z0-9_-]/g, "");
    const cleanFile = params.originalFileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const timestamp = Date.now();

    return `logsense/${cleanOrg}/${cleanProject}/${cleanService}/${timestamp}-${cleanFile}`;
  }

  /**
   * Uploads raw buffer or stream to Object Storage
   */
  async uploadFile(params: {
    key: string;
    body: Buffer | Uint8Array | string;
    contentType?: string;
  }): Promise<{ key: string; bucket: string; size: number }> {
    try {
      const buffer = Buffer.isBuffer(params.body) ? params.body : Buffer.from(params.body);

      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: params.key,
        Body: buffer,
        ContentType: params.contentType || "text/plain",
      });

      await this.client.send(command);

      logger.info(`Successfully uploaded object to S3: ${this.bucket}/${params.key} (${buffer.length} bytes)`);

      return {
        key: params.key,
        bucket: this.bucket,
        size: buffer.length,
      };
    } catch (error) {
      logger.error(`S3 upload failed for key: ${params.key}`, error);
      throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, "Failed to upload file to object storage");
    }
  }

  /**
   * Generates a secure, temporary pre-signed URL to download or view raw log file
   */
  async getPresignedDownloadUrl(key: string, expiresInSeconds: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const url = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
      return url;
    } catch (error) {
      logger.error(`Failed to generate signed download URL for key: ${key}`, error);
      throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, "Failed to generate presigned download URL");
    }
  }

  /**
   * Reads raw file content as text from Object Storage
   */
  async getFileContent(key: string): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.client.send(command);
      if (!response.Body) {
        throw new Error("Empty body received from object storage");
      }

      const content = await response.Body.transformToString();
      return content;
    } catch (error) {
      logger.error(`Failed to read file from S3: ${key}`, error);
      throw new ApiError(StatusCodes.NOT_FOUND, "Log file not found in object storage");
    }
  }

  /**
   * Checks if an object exists in storage
   */
  async checkObjectExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      await this.client.send(command);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Deletes an object from storage
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      await this.client.send(command);
      logger.info(`Deleted object from S3: ${this.bucket}/${key}`);
    } catch (error) {
      logger.error(`Failed to delete object from S3: ${key}`, error);
      throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, "Failed to delete file from object storage");
    }
  }

  getBucketName(): string {
    return this.bucket;
  }
}

export const storageService = new StorageService();
