"""People business logic — CRUD, photo-person tagging, merge."""

from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from pos_contracts.exceptions import NotFoundError

from .events import publish_event
from .models import Person, Photo, PhotoPerson


async def list_people(session: AsyncSession, user_id: UUID) -> list[dict]:
    """List all people with photo counts."""
    result = await session.execute(
        select(
            Person,
            func.count(PhotoPerson.id).label("photo_count"),
        )
        .outerjoin(PhotoPerson, PhotoPerson.person_id == Person.id)
        .where(Person.user_id == user_id)
        .group_by(Person.id)
        .order_by(Person.name)
    )

    return [
        {
            "id": row[0].id,
            "name": row[0].name,
            "cover_photo_id": row[0].cover_photo_id,
            "photo_count": row[1],
            "created_at": row[0].created_at,
            "updated_at": row[0].updated_at,
        }
        for row in result
    ]


async def create_person(session: AsyncSession, user_id: UUID, name: str) -> Person:
    """Create a new person."""
    person = Person(user_id=user_id, name=name)
    session.add(person)
    await session.commit()
    await session.refresh(person)
    await publish_event("person.created", person)
    return person


async def get_person(session: AsyncSession, user_id: UUID, person_id: UUID) -> Person:
    """Get a person by ID."""
    result = await session.execute(
        select(Person).where(Person.id == person_id, Person.user_id == user_id)
    )
    person = result.scalar_one_or_none()
    if not person:
        raise NotFoundError(f"Person {person_id} not found")
    return person


async def update_person(
    session: AsyncSession, user_id: UUID, person_id: UUID, data: dict
) -> Person:
    """Update person fields."""
    person = await get_person(session, user_id, person_id)
    for field, value in data.items():
        if hasattr(person, field) and value is not None:
            setattr(person, field, value)
    await session.commit()
    await session.refresh(person)
    return person


async def delete_person(session: AsyncSession, user_id: UUID, person_id: UUID) -> None:
    """Delete a person (untags photos, doesn't delete them)."""
    person = await get_person(session, user_id, person_id)
    await session.delete(person)
    await session.commit()


async def get_person_photos(
    session: AsyncSession, user_id: UUID, person_id: UUID,
    *, limit: int = 100, offset: int = 0,
) -> list[Photo]:
    """Get photos tagged with a person."""
    await get_person(session, user_id, person_id)
    result = await session.execute(
        select(Photo)
        .join(PhotoPerson)
        .where(PhotoPerson.person_id == person_id, Photo.user_id == user_id)
        .order_by(Photo.taken_at.desc().nullslast(), Photo.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(result.scalars().all())


async def tag_photo_with_person(
    session: AsyncSession, user_id: UUID, photo_id: UUID, person_id: UUID
) -> None:
    """Tag a photo with a person."""
    # Verify both exist
    photo_result = await session.execute(
        select(Photo.id).where(Photo.id == photo_id, Photo.user_id == user_id)
    )
    if not photo_result.scalar_one_or_none():
        raise NotFoundError(f"Photo {photo_id} not found")

    await get_person(session, user_id, person_id)

    # Check if already tagged
    existing = await session.execute(
        select(PhotoPerson).where(
            PhotoPerson.photo_id == photo_id,
            PhotoPerson.person_id == person_id,
        )
    )
    if existing.scalar_one_or_none():
        return  # Already tagged

    link = PhotoPerson(user_id=user_id, photo_id=photo_id, person_id=person_id)
    session.add(link)
    await session.commit()


async def untag_photo_person(
    session: AsyncSession, user_id: UUID, photo_id: UUID, person_id: UUID
) -> None:
    """Remove a person tag from a photo."""
    result = await session.execute(
        select(PhotoPerson).where(
            PhotoPerson.photo_id == photo_id,
            PhotoPerson.person_id == person_id,
        )
    )
    link = result.scalar_one_or_none()
    if not link:
        raise NotFoundError("Person not tagged on this photo")
    await session.delete(link)
    await session.commit()


async def merge_people(
    session: AsyncSession, user_id: UUID, source_id: UUID, target_id: UUID
) -> Person:
    """Merge source person into target: move all photo tags, delete source."""
    source = await get_person(session, user_id, source_id)
    target = await get_person(session, user_id, target_id)

    # Get all photo_people for source
    result = await session.execute(
        select(PhotoPerson).where(PhotoPerson.person_id == source_id)
    )
    source_links = list(result.scalars().all())

    # Get existing target photo IDs
    target_result = await session.execute(
        select(PhotoPerson.photo_id).where(PhotoPerson.person_id == target_id)
    )
    target_photo_ids = {row[0] for row in target_result}

    # Move non-duplicate links
    for link in source_links:
        if link.photo_id not in target_photo_ids:
            link.person_id = target_id
        else:
            await session.delete(link)

    # Delete source person
    await session.delete(source)
    await session.commit()
    await session.refresh(target)
    return target
