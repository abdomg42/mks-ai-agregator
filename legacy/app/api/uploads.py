"""
Génère une URL présignée pour que le frontend upload directement le
screenshot vers S3 (ou R2/B2), sans faire transiter le fichier par l'API.
"""
import uuid

import boto3
from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import settings

router = APIRouter(prefix="/uploads", tags=["uploads"])

s3_client = boto3.client(
    "s3",
    endpoint_url=settings.s3_endpoint_url or None,
    aws_access_key_id=settings.s3_access_key or None,
    aws_secret_access_key=settings.s3_secret_key or None,
)


class PresignRequest(BaseModel):
    filename: str
    content_type: str = "image/png"


class PresignResponse(BaseModel):
    upload_url: str
    public_url: str
    object_key: str


@router.post("/presign", response_model=PresignResponse)
async def presign_upload(req: PresignRequest):
    object_key = f"uploads/{uuid.uuid4()}-{req.filename}"

    upload_url = s3_client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.s3_bucket,
            "Key": object_key,
            "ContentType": req.content_type,
        },
        ExpiresIn=600,  # 10 minutes pour uploader
    )

    public_url = f"{settings.s3_endpoint_url}/{settings.s3_bucket}/{object_key}"

    return PresignResponse(upload_url=upload_url, public_url=public_url, object_key=object_key)
