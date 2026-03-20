"""Image processing — thumbnails, EXIF extraction, hashing."""

import hashlib
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path

from loguru import logger
from PIL import Image, ExifTags

try:
    import pillow_heif
    pillow_heif.register_heif_opener()
except ImportError:
    pass

try:
    import imagehash
except ImportError:
    imagehash = None


# Thumbnail sizes: name → max dimension (longest side)
THUMB_SIZES = {
    "sm": 200,
    "md": 600,
    "lg": 1200,
}

THUMB_QUALITY = 85


def compute_file_hash(file_bytes: bytes) -> str:
    """Compute SHA-256 hash of file bytes."""
    return hashlib.sha256(file_bytes).hexdigest()


def compute_perceptual_hash(img: Image.Image) -> str | None:
    """Compute perceptual hash (pHash) for near-duplicate detection."""
    if imagehash is None:
        return None
    try:
        return str(imagehash.phash(img))
    except Exception as e:
        logger.warning(f"pHash computation failed: {e}")
        return None


def extract_exif(img: Image.Image) -> dict:
    """Extract EXIF metadata from an image, returning a JSON-safe dict."""
    result = {}
    try:
        exif = img.getexif()
        if not exif:
            return result

        # Map tag IDs to names
        for tag_id, value in exif.items():
            tag_name = ExifTags.TAGS.get(tag_id, str(tag_id))
            # Skip binary/unserializable data
            if isinstance(value, bytes):
                continue
            if isinstance(value, (int, float, str, bool)):
                result[tag_name] = value
            elif isinstance(value, tuple):
                result[tag_name] = list(value)

        # IFD EXIF data (detailed camera info)
        ifd = exif.get_ifd(ExifTags.IFD.Exif)
        if ifd:
            for tag_id, value in ifd.items():
                tag_name = ExifTags.TAGS.get(tag_id, str(tag_id))
                if isinstance(value, bytes):
                    continue
                if isinstance(value, (int, float, str, bool)):
                    result[tag_name] = value
                elif isinstance(value, tuple):
                    result[tag_name] = list(value)

    except Exception as e:
        logger.warning(f"EXIF extraction failed: {e}")

    return result


def parse_exif_datetime(exif_data: dict) -> datetime | None:
    """Parse EXIF DateTimeOriginal or DateTime into a timezone-aware datetime."""
    for key in ("DateTimeOriginal", "DateTimeDigitized", "DateTime"):
        val = exif_data.get(key)
        if val and isinstance(val, str):
            try:
                dt = datetime.strptime(val, "%Y:%m:%d %H:%M:%S")
                return dt.replace(tzinfo=timezone.utc)
            except ValueError:
                continue
    return None


def parse_exif_gps(exif_data: dict) -> tuple[float | None, float | None]:
    """Extract GPS coordinates from EXIF data."""
    try:
        img_exif = exif_data
        # GPS data is often in IFD.GPSInfo — check raw keys
        gps_lat = img_exif.get("GPSLatitude")
        gps_lat_ref = img_exif.get("GPSLatitudeRef")
        gps_lon = img_exif.get("GPSLongitude")
        gps_lon_ref = img_exif.get("GPSLongitudeRef")

        if gps_lat and gps_lon:
            lat = _dms_to_decimal(gps_lat)
            lon = _dms_to_decimal(gps_lon)
            if gps_lat_ref == "S":
                lat = -lat
            if gps_lon_ref == "W":
                lon = -lon
            return lat, lon
    except Exception as e:
        logger.debug(f"GPS extraction failed: {e}")

    return None, None


def _dms_to_decimal(dms) -> float:
    """Convert DMS (degrees, minutes, seconds) to decimal degrees."""
    if isinstance(dms, (list, tuple)) and len(dms) == 3:
        d, m, s = float(dms[0]), float(dms[1]), float(dms[2])
        return d + m / 60.0 + s / 3600.0
    return float(dms)


def get_camera_info(exif_data: dict) -> dict:
    """Extract human-readable camera info from EXIF."""
    info = {}
    if "Make" in exif_data:
        info["make"] = str(exif_data["Make"]).strip()
    if "Model" in exif_data:
        info["model"] = str(exif_data["Model"]).strip()
    if "LensModel" in exif_data:
        info["lens"] = str(exif_data["LensModel"]).strip()
    if "FocalLength" in exif_data:
        fl = exif_data["FocalLength"]
        info["focal_length"] = f"{float(fl):.1f}mm" if fl else None
    if "FNumber" in exif_data:
        fn = exif_data["FNumber"]
        info["aperture"] = f"f/{float(fn):.1f}" if fn else None
    if "ISOSpeedRatings" in exif_data:
        info["iso"] = exif_data["ISOSpeedRatings"]
    if "ExposureTime" in exif_data:
        et = exif_data["ExposureTime"]
        if isinstance(et, (int, float)):
            if et < 1:
                info["shutter_speed"] = f"1/{int(1/et)}s"
            else:
                info["shutter_speed"] = f"{et}s"
    return info


def apply_exif_orientation(img: Image.Image) -> Image.Image:
    """Rotate/flip image based on EXIF orientation tag."""
    try:
        exif = img.getexif()
        orientation = exif.get(274)  # 274 = Orientation tag
        if orientation == 2:
            img = img.transpose(Image.FLIP_LEFT_RIGHT)
        elif orientation == 3:
            img = img.rotate(180, expand=True)
        elif orientation == 4:
            img = img.transpose(Image.FLIP_TOP_BOTTOM)
        elif orientation == 5:
            img = img.transpose(Image.FLIP_LEFT_RIGHT).rotate(270, expand=True)
        elif orientation == 6:
            img = img.rotate(270, expand=True)
        elif orientation == 7:
            img = img.transpose(Image.FLIP_LEFT_RIGHT).rotate(90, expand=True)
        elif orientation == 8:
            img = img.rotate(90, expand=True)
    except Exception:
        pass
    return img


def generate_thumbnails(
    img: Image.Image,
    thumb_dir: Path,
    photo_uuid: str,
) -> dict[str, str]:
    """Generate all thumbnail sizes. Returns {size_name: relative_path}."""
    paths = {}

    for size_name, max_dim in THUMB_SIZES.items():
        size_dir = thumb_dir / size_name
        size_dir.mkdir(parents=True, exist_ok=True)

        thumb_path = size_dir / f"{photo_uuid}.jpg"

        thumb = img.copy()
        thumb.thumbnail((max_dim, max_dim), Image.LANCZOS)

        # Convert to RGB if necessary (e.g., RGBA, P mode)
        if thumb.mode not in ("RGB",):
            thumb = thumb.convert("RGB")

        thumb.save(str(thumb_path), "JPEG", quality=THUMB_QUALITY)
        paths[size_name] = str(thumb_path)

    return paths


def process_image(file_bytes: bytes) -> dict:
    """Process an image: extract metadata, dimensions, hashes.

    Returns a dict of extracted data (does NOT generate thumbnails — that
    happens in the background task with the storage path).
    """
    result = {
        "width": None,
        "height": None,
        "exif_data": {},
        "taken_at": None,
        "latitude": None,
        "longitude": None,
        "perceptual_hash": None,
    }

    try:
        img = Image.open(BytesIO(file_bytes))
        img = apply_exif_orientation(img)

        result["width"] = img.width
        result["height"] = img.height

        # EXIF
        exif = extract_exif(img)
        result["exif_data"] = exif

        # Date
        result["taken_at"] = parse_exif_datetime(exif)

        # GPS
        lat, lon = parse_exif_gps(exif)
        result["latitude"] = lat
        result["longitude"] = lon

        # Perceptual hash
        result["perceptual_hash"] = compute_perceptual_hash(img)

    except Exception as e:
        logger.error(f"Image processing failed: {e}")

    return result


def generate_thumbnails_from_bytes(
    file_bytes: bytes,
    thumb_dir: Path,
    photo_uuid: str,
) -> dict[str, str]:
    """Open image from bytes and generate all thumbnails."""
    try:
        img = Image.open(BytesIO(file_bytes))
        img = apply_exif_orientation(img)
        return generate_thumbnails(img, thumb_dir, photo_uuid)
    except Exception as e:
        logger.error(f"Thumbnail generation failed: {e}")
        return {}
