import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const getR2Client = () => {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey || accessKeyId.startsWith("your_")) {
    return null;
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
};

// Separate client for presigned URLs — disables checksum injection
// so the generated URL doesn't include x-amz-sdk-checksum-algorithm
// which Cloudflare R2 CORS preflight rejects.
export const getR2PresignClient = () => {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey || accessKeyId.startsWith("your_")) {
    return null;
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    // Disable flexible checksums — prevents CRC32 query params in presigned URLs
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
};

export async function uploadToR2(
  fileBuffer: Buffer, 
  fileName: string, 
  contentType: string = "video/mp4",
  prefix: string = "ASSET"
): Promise<string> {
  const r2 = getR2Client();
  const bucketName = process.env.R2_BUCKET_NAME || "jewelry-assets";

  let key = "";
  if (prefix.startsWith("music") || prefix.includes("music")) {
    const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    key = `music/${cleanName}`;
  } else if (prefix.startsWith("ICON_") || prefix.includes("template-icons")) {
    const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    key = `template-icons/${cleanName}`;
  } else if (prefix.startsWith("OUTRO_") || prefix.includes("outro")) {
    const cleanCode = prefix.replace(/^OUTRO_/, "").replace(/[^a-zA-Z0-9-]/g, "");
    key = `outro/${cleanCode}_outro.mp4`;
  } else if (
    contentType.startsWith("image/") || 
    fileName.toLowerCase().endsWith(".webp") || 
    fileName.toLowerCase().endsWith(".png") || 
    fileName.toLowerCase().endsWith(".jpg") || 
    fileName.toLowerCase().endsWith(".jpeg")
  ) {
    const cleanCode = prefix.replace(/[^a-zA-Z0-9-]/g, "");
    const ext = (contentType === "image/png" || fileName.toLowerCase().endsWith(".png")) ? "png" : "webp";
    key = `logos/${cleanCode}_logo.${ext}`;

    // Clean up alternate format file to avoid stale image mix-ups
    if (r2) {
      const altExt = ext === "png" ? "webp" : "png";
      const altKey = `logos/${cleanCode}_logo.${altExt}`;
      try {
        await r2.send(
          new DeleteObjectCommand({
            Bucket: bucketName,
            Key: altKey,
          })
        );
        console.log(`[R2] Cleaned up alternate stale logo asset: ${altKey}`);
      } catch (e) {
        // Ignored if file does not exist
      }
    }
  } else {
    key = `videos/${prefix}.mp4`;
  }

  if (!r2) {
    return `/api/media/${key}`;
  }

  // Upload exact raw binary buffer with explicit ContentLength
  await r2.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
      ContentLength: fileBuffer.length,
    })
  );

  return `/api/media/${key}`;
}

export async function listR2Objects(prefixPath: string): Promise<{ key: string; url: string; size: number; lastModified?: Date }[]> {
  const r2 = getR2Client();
  const bucketName = process.env.R2_BUCKET_NAME || "jewelry-assets";
  if (!r2) return [];

  try {
    const res = await r2.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefixPath,
      })
    );

    return (res.Contents || []).map((item) => ({
      key: item.Key || "",
      url: `/api/media/${item.Key}`,
      size: item.Size || 0,
      lastModified: item.LastModified,
    }));
  } catch (err) {
    console.error("Failed to list objects from R2:", err);
    return [];
  }
}

export async function deleteFromR2(keyPath: string): Promise<boolean> {
  const r2 = getR2Client();
  const bucketName = process.env.R2_BUCKET_NAME || "jewelry-assets";
  if (!r2) return false;

  const cleanKey = keyPath.replace(/^\/api\/media\//, "").replace(/^https?:\/\/[^\/]+\//, "");

  try {
    await r2.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: cleanKey,
      })
    );
    return true;
  } catch (err) {
    console.error("Failed to delete object from R2:", err);
    return false;
  }
}

export async function checkR2ObjectExists(keyPath: string): Promise<boolean> {
  const r2 = getR2Client();
  const bucketName = process.env.R2_BUCKET_NAME || "jewelry-assets";
  if (!r2) return true;

  const cleanKey = keyPath.replace(/^\/api\/media\//, "").replace(/^https?:\/\/[^\/]+\//, "");

  try {
    await r2.send(
      new HeadObjectCommand({
        Bucket: bucketName,
        Key: cleanKey,
      })
    );
    return true;
  } catch (err: any) {
    if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
      return false;
    }
    return true;
  }
}

export async function initiateR2MultipartUpload(
  fileName: string,
  contentType: string = "video/mp4",
  prefix: string = "ASSET"
): Promise<{ uploadId: string; key: string }> {
  const r2 = getR2Client();
  const bucketName = process.env.R2_BUCKET_NAME || "jewelry-assets";
  if (!r2) throw new Error("R2 client is not configured");

  let key = "";
  if (prefix.startsWith("music") || prefix.includes("music")) {
    const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    key = `music/${cleanName}`;
  } else if (prefix.startsWith("ICON_") || prefix.includes("template-icons")) {
    const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    key = `template-icons/${cleanName}`;
  } else if (prefix.startsWith("OUTRO_") || prefix.includes("outro")) {
    const cleanCode = prefix.replace(/^OUTRO_/, "").replace(/[^a-zA-Z0-9-]/g, "");
    key = `outro/${cleanCode}_outro.mp4`;
  } else if (
    contentType.startsWith("image/") || 
    fileName.toLowerCase().endsWith(".webp") || 
    fileName.toLowerCase().endsWith(".png") || 
    fileName.toLowerCase().endsWith(".jpg") || 
    fileName.toLowerCase().endsWith(".jpeg")
  ) {
    const cleanCode = prefix.replace(/[^a-zA-Z0-9-]/g, "");
    const ext = (contentType === "image/png" || fileName.toLowerCase().endsWith(".png")) ? "png" : "webp";
    key = `logos/${cleanCode}_logo.${ext}`;
  } else {
    key = `videos/${prefix}.mp4`;
  }

  const res = await r2.send(
    new CreateMultipartUploadCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType,
    })
  );

  return {
    uploadId: res.UploadId || "",
    key,
  };
}

export async function uploadR2Part(
  uploadId: string,
  key: string,
  partNumber: number,
  body: Uint8Array | Buffer
): Promise<string> {
  const r2 = getR2Client();
  const bucketName = process.env.R2_BUCKET_NAME || "jewelry-assets";
  if (!r2) throw new Error("R2 client is not configured");

  const res = await r2.send(
    new UploadPartCommand({
      Bucket: bucketName,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
      Body: body,
      ContentLength: (body as any).byteLength !== undefined ? (body as any).byteLength : (body as any).length,
    })
  );

  return res.ETag || "";
}

export async function completeR2MultipartUpload(
  uploadId: string,
  key: string,
  parts: { PartNumber: number; ETag: string }[]
): Promise<string> {
  const r2 = getR2Client();
  const bucketName = process.env.R2_BUCKET_NAME || "jewelry-assets";
  if (!r2) throw new Error("R2 client is not configured");

  await r2.send(
    new CompleteMultipartUploadCommand({
      Bucket: bucketName,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber),
      },
    })
  );

  return `/api/media/${key}`;
}

export async function getR2PresignedUploadUrl(
  fileName: string,
  contentType: string = "video/mp4",
  prefix: string = "ASSET"
): Promise<{ url: string; key: string; publicUrl: string }> {
  const r2 = getR2Client();
  const bucketName = process.env.R2_BUCKET_NAME || "jewelry-assets";
  if (!r2) throw new Error("R2 client is not configured");

  let key = "";
  if (prefix.startsWith("music") || prefix.includes("music")) {
    const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    key = `music/${cleanName}`;
  } else if (prefix.startsWith("ICON_") || prefix.includes("template-icons")) {
    const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    key = `template-icons/${cleanName}`;
  } else if (prefix.startsWith("OUTRO_") || prefix.includes("outro")) {
    const cleanCode = prefix.replace(/^OUTRO_/, "").replace(/[^a-zA-Z0-9-]/g, "");
    key = `outro/${cleanCode}_outro.mp4`;
  } else if (
    contentType.startsWith("image/") || 
    fileName.toLowerCase().endsWith(".webp") || 
    fileName.toLowerCase().endsWith(".png") || 
    fileName.toLowerCase().endsWith(".jpg") || 
    fileName.toLowerCase().endsWith(".jpeg")
  ) {
    const cleanCode = prefix.replace(/[^a-zA-Z0-9-]/g, "");
    const ext = (contentType === "image/png" || fileName.toLowerCase().endsWith(".png")) ? "png" : "webp";
    key = `logos/${cleanCode}_logo.${ext}`;
  } else if (prefix === "renders") {
    key = `renders/${fileName}`;
  } else {
    key = `videos/${prefix}.mp4`;
  }

  // Use dedicated presign client that strips the CRC32 checksum headers
  const presignClient = getR2PresignClient();
  if (!presignClient) throw new Error("R2 presign client is not configured");

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType,
  });

  const url = await getSignedUrl(presignClient, command, {
    expiresIn: 900, // 15 minutes
    unhoistableHeaders: new Set(["content-type"]),
  });

  const publicDomain = process.env.R2_PUBLIC_DOMAIN;
  const publicUrl = (publicDomain && key.startsWith("renders/")) 
    ? `${publicDomain}/${key}` 
    : `/api/media/${key}`;

  return {
    url,
    key,
    publicUrl
  };
}
