import multer from "multer";
import { StatusCodes } from "http-status-codes";
import ApiError from "../../shared/utils/ApiError.js";

// Max file size: 50 MB
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

const storage = multer.memoryStorage();

const ALLOWED_EXTENSIONS = [".log", ".txt", ".json", ".csv", ".out", ".ndjson", ".gz"];

export const uploadLogMiddleware = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const originalName = file.originalname.toLowerCase();
    const hasValidExtension = ALLOWED_EXTENSIONS.some((ext) => originalName.endsWith(ext));

    if (!hasValidExtension) {
      return cb(
        new ApiError(
          StatusCodes.BAD_REQUEST,
          `Invalid file format. Supported extensions: ${ALLOWED_EXTENSIONS.join(", ")}`,
        ),
      );
    }

    cb(null, true);
  },
});
