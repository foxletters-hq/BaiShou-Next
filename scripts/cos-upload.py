#!/usr/bin/env python3
"""
Tencent Cloud COS explicit concurrent multipart uploader & server-side copier.
Bypasses coscmd's 100MB single-PUT threshold so 50-200MB installers always use
fast multi-threaded chunked uploads across international GitHub Actions links.
"""
import concurrent.futures
import os
import sys
import time
from qcloud_cos import CosConfig, CosS3Client

PART_SIZE = 1 * 1024 * 1024  # 1 MB per part (minimum COS multipart size for fast feedback)
MAX_THREADS = 24


def get_client():
    secret_id = os.environ["COS_SECRET_ID"].strip()
    secret_key = os.environ["COS_SECRET_KEY"].strip()
    region = os.environ.get("COS_REGION", "ap-shanghai").strip() or "ap-shanghai"
    config = CosConfig(
        Region=region,
        SecretId=secret_id,
        SecretKey=secret_key,
        Timeout=120,
        PoolConnections=32,
        PoolMaxSize=32,
    )
    return CosS3Client(config, retry=3), os.environ.get("COS_BUCKET", "baishou-release-1305030750").strip() or "baishou-release-1305030750", region


def upload_file(local_path: str, cos_key: str):
    client, bucket, _ = get_client()
    file_size = os.path.getsize(local_path)
    t0 = time.time()

    if file_size <= PART_SIZE:
        with open(local_path, "rb") as fp:
            data = fp.read()
        client.put_object(Bucket=bucket, Body=data, Key=cos_key)
        print(f"[{time.strftime('%H:%M:%S')}] PUT {cos_key} ({file_size} B) in {time.time() - t0:.2f}s", flush=True)
        return

    total_parts = (file_size + PART_SIZE - 1) // PART_SIZE
    print(
        f"[{time.strftime('%H:%M:%S')}] Starting multipart upload: {local_path} -> {cos_key} "
        f"({file_size / (1024 * 1024):.1f} MB, {total_parts} parts x {PART_SIZE // (1024 * 1024)}MB, {MAX_THREADS} threads)",
        flush=True,
    )

    init_resp = client.create_multipart_upload(Bucket=bucket, Key=cos_key)
    upload_id = init_resp["UploadId"]

    completed_parts = []
    done_count = 0

    def upload_one_part(part_num: int, offset: int, length: int):
        with open(local_path, "rb") as fp:
            fp.seek(offset)
            chunk = fp.read(length)
        for attempt in range(1, 5):
            try:
                resp = client.upload_part(
                    Bucket=bucket,
                    Key=cos_key,
                    Body=chunk,
                    PartNumber=part_num,
                    UploadId=upload_id,
                )
                return {"PartNumber": part_num, "ETag": resp["ETag"]}
            except Exception as err:
                if attempt == 4:
                    raise
                print(f"[{time.strftime('%H:%M:%S')}] Part {part_num} retry {attempt}/3: {err}", flush=True)
                time.sleep(attempt)

    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_THREADS) as pool:
        futures = []
        for idx in range(total_parts):
            part_num = idx + 1
            offset = idx * PART_SIZE
            length = min(PART_SIZE, file_size - offset)
            futures.append(pool.submit(upload_one_part, part_num, offset, length))

        for fut in concurrent.futures.as_completed(futures):
            part_info = fut.result()
            completed_parts.append(part_info)
            done_count += 1
            if done_count == 1 or done_count % 5 == 0 or done_count == total_parts:
                elapsed = max(0.001, time.time() - t0)
                mb_done = (done_count * PART_SIZE) / (1024 * 1024)
                mb_total = file_size / (1024 * 1024)
                speed = min(mb_done, mb_total) / elapsed
                print(
                    f"[{time.strftime('%H:%M:%S')}] {cos_key}: {done_count}/{total_parts} parts "
                    f"({done_count * 100 // total_parts}%, {speed:.2f} MB/s)",
                    flush=True,
                )

    completed_parts.sort(key=lambda x: x["PartNumber"])
    client.complete_multipart_upload(
        Bucket=bucket,
        Key=cos_key,
        UploadId=upload_id,
        MultipartUpload={"Part": completed_parts},
    )
    elapsed = time.time() - t0
    print(
        f"[{time.strftime('%H:%M:%S')}] Completed {cos_key} ({file_size / (1024 * 1024):.1f} MB) in {elapsed:.1f}s "
        f"({(file_size / (1024 * 1024)) / max(0.001, elapsed):.2f} MB/s)",
        flush=True,
    )


def copy_object(src_key: str, dest_key: str):
    client, bucket, region = get_client()
    t0 = time.time()
    client.copy(
        Bucket=bucket,
        Key=dest_key,
        CopySource={"Bucket": bucket, "Region": region, "Key": src_key},
        PartSize=20,
        MAXThread=10,
    )
    print(f"[{time.strftime('%H:%M:%S')}] Server-side copy {src_key} -> {dest_key} in {time.time() - t0:.2f}s", flush=True)


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "upload":
        upload_file(sys.argv[2], sys.argv[3])
    elif cmd == "copy":
        copy_object(sys.argv[2], sys.argv[3])
    else:
        raise SystemExit(f"Unknown command: {cmd}")
