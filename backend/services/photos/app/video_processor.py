"""Video processing — thumbnail extraction and metadata via ffmpeg/ffprobe."""

import json
import subprocess
import shutil
from io import BytesIO
from pathlib import Path
from tempfile import NamedTemporaryFile

from loguru import logger
from PIL import Image

from .image_processor import generate_thumbnails


def _ffmpeg_available() -> bool:
    """Check if ffmpeg is on the system PATH."""
    return shutil.which("ffmpeg") is not None


def _ffprobe_available() -> bool:
    """Check if ffprobe is on the system PATH."""
    return shutil.which("ffprobe") is not None


def extract_video_thumbnail(video_path: str | Path) -> bytes | None:
    """Extract a single frame from a video at 1 second (or first frame).

    Returns JPEG bytes of the extracted frame, or None on failure.
    """
    if not _ffmpeg_available():
        logger.warning("ffmpeg not found — cannot extract video thumbnail")
        return None

    try:
        with NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            tmp_path = tmp.name

        # Try at 1 second first
        result = subprocess.run(
            [
                "ffmpeg", "-y",
                "-ss", "1",
                "-i", str(video_path),
                "-vframes", "1",
                "-f", "image2",
                tmp_path,
            ],
            capture_output=True,
            timeout=30,
        )

        tmp_file = Path(tmp_path)
        if result.returncode != 0 or not tmp_file.exists() or tmp_file.stat().st_size == 0:
            # Fall back to first frame (video might be < 1 second)
            result = subprocess.run(
                [
                    "ffmpeg", "-y",
                    "-i", str(video_path),
                    "-vframes", "1",
                    "-f", "image2",
                    tmp_path,
                ],
                capture_output=True,
                timeout=30,
            )

        if tmp_file.exists() and tmp_file.stat().st_size > 0:
            frame_bytes = tmp_file.read_bytes()
            tmp_file.unlink(missing_ok=True)
            return frame_bytes

        tmp_file.unlink(missing_ok=True)
        logger.warning(f"ffmpeg failed to extract frame from {video_path}")
        return None

    except subprocess.TimeoutExpired:
        logger.warning(f"ffmpeg timeout extracting frame from {video_path}")
        return None
    except Exception as e:
        logger.error(f"Video thumbnail extraction error: {e}")
        return None


def extract_video_metadata(video_path: str | Path) -> dict:
    """Extract video metadata (duration, width, height) via ffprobe.

    Returns dict with keys: duration, width, height, content_type.
    """
    result = {
        "duration": None,
        "width": None,
        "height": None,
    }

    if not _ffprobe_available():
        logger.warning("ffprobe not found — cannot extract video metadata")
        return result

    try:
        proc = subprocess.run(
            [
                "ffprobe",
                "-v", "quiet",
                "-print_format", "json",
                "-show_format", "-show_streams",
                str(video_path),
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )

        if proc.returncode != 0:
            logger.warning(f"ffprobe failed for {video_path}: {proc.stderr}")
            return result

        data = json.loads(proc.stdout)

        # Duration from format
        fmt = data.get("format", {})
        if "duration" in fmt:
            result["duration"] = float(fmt["duration"])

        # Width/height from first video stream
        for stream in data.get("streams", []):
            if stream.get("codec_type") == "video":
                result["width"] = stream.get("width")
                result["height"] = stream.get("height")
                # Use stream duration if format duration not available
                if result["duration"] is None and "duration" in stream:
                    result["duration"] = float(stream["duration"])
                break

    except subprocess.TimeoutExpired:
        logger.warning(f"ffprobe timeout for {video_path}")
    except Exception as e:
        logger.error(f"Video metadata extraction error: {e}")

    return result


def process_video(
    content: bytes,
    storage_path: Path,
    thumb_dir: Path,
    photo_uuid: str,
) -> dict:
    """Process a video file: extract metadata and generate thumbnails.

    Returns dict with: width, height, duration, thumbnail_generated.
    """
    result = {
        "width": None,
        "height": None,
        "duration": None,
        "thumbnail_generated": False,
    }

    # Extract metadata from stored file
    meta = extract_video_metadata(storage_path)
    result["width"] = meta["width"]
    result["height"] = meta["height"]
    result["duration"] = meta["duration"]

    # Extract thumbnail frame
    frame_bytes = extract_video_thumbnail(storage_path)
    if frame_bytes:
        try:
            img = Image.open(BytesIO(frame_bytes))
            generate_thumbnails(img, thumb_dir, photo_uuid)
            result["thumbnail_generated"] = True
        except Exception as e:
            logger.warning(f"Video thumbnail generation failed: {e}")

    return result


def check_ffmpeg_available() -> dict:
    """Check ffmpeg/ffprobe availability. Called at startup for logging."""
    status = {
        "ffmpeg": _ffmpeg_available(),
        "ffprobe": _ffprobe_available(),
    }
    if not status["ffmpeg"]:
        logger.warning("ffmpeg not found on PATH — video thumbnails will not be generated")
    if not status["ffprobe"]:
        logger.warning("ffprobe not found on PATH — video metadata extraction disabled")
    return status
