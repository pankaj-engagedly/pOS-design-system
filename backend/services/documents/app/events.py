"""Documents domain events using the declarative DomainEvent pattern."""

from pos_events import DomainEvent, event_bus

from pos_contracts.models import UserScopedBase  # noqa — keep consistent


class DocumentsEvent(DomainEvent):
    _source_service = "documents"


FOLDER_FIELDS = ("id", "user_id", "name", "parent_id")
FOLDER_IDENTITY = ("id", "user_id")

DOC_FIELDS = ("id", "user_id", "name", "folder_id", "attachment_id", "content_type", "file_size")
DOC_IDENTITY = ("id", "user_id")

TAG_FIELDS = ("id", "name")
SHARE_FIELDS = ("id", "owner_user_id", "shared_with_user_id", "document_id", "folder_id", "permission")
SHARE_IDENTITY = ("id",)


class FolderCreated(DocumentsEvent):
    _event_name = "doc.folder.created"
    _payload_fields = FOLDER_FIELDS


class FolderUpdated(DocumentsEvent):
    _event_name = "doc.folder.updated"
    _payload_fields = FOLDER_FIELDS


class FolderMoved(DocumentsEvent):
    _event_name = "doc.folder.moved"
    _payload_fields = FOLDER_FIELDS


class FolderDeleted(DocumentsEvent):
    _event_name = "doc.folder.deleted"
    _payload_fields = FOLDER_IDENTITY


class DocumentUploaded(DocumentsEvent):
    _event_name = "doc.document.uploaded"
    _payload_fields = DOC_FIELDS


class DocumentUpdated(DocumentsEvent):
    _event_name = "doc.document.updated"
    _payload_fields = DOC_FIELDS


class DocumentMoved(DocumentsEvent):
    _event_name = "doc.document.moved"
    _payload_fields = DOC_FIELDS


class DocumentDeleted(DocumentsEvent):
    _event_name = "doc.document.deleted"
    _payload_fields = DOC_IDENTITY


class TagAdded(DocumentsEvent):
    _event_name = "doc.tag.added"
    _payload_fields = TAG_FIELDS


class TagRemoved(DocumentsEvent):
    _event_name = "doc.tag.removed"
    _payload_fields = ("id",)


class DocumentShared(DocumentsEvent):
    _event_name = "doc.share.created"
    _payload_fields = SHARE_FIELDS


class DocumentUnshared(DocumentsEvent):
    _event_name = "doc.share.revoked"
    _payload_fields = SHARE_IDENTITY


# -- Publish helpers --

_folder_event_map = {
    "doc.folder.created": FolderCreated,
    "doc.folder.updated": FolderUpdated,
    "doc.folder.moved": FolderMoved,
    "doc.folder.deleted": FolderDeleted,
}

_doc_event_map = {
    "doc.document.uploaded": DocumentUploaded,
    "doc.document.updated": DocumentUpdated,
    "doc.document.moved": DocumentMoved,
    "doc.document.deleted": DocumentDeleted,
}

_share_event_map = {
    "doc.share.created": DocumentShared,
    "doc.share.revoked": DocumentUnshared,
}


async def publish_folder_event(event_name: str, folder) -> None:
    cls = _folder_event_map.get(event_name)
    if cls:
        await event_bus.publish(cls.from_model(folder))


async def publish_doc_event(event_name: str, doc) -> None:
    cls = _doc_event_map.get(event_name)
    if cls:
        await event_bus.publish(cls.from_model(doc))


async def publish_tag_event(event_name: str, tag, **extra) -> None:
    if event_name == "doc.tag.added":
        await event_bus.publish(TagAdded.from_model(tag, **extra))
    elif event_name == "doc.tag.removed":
        await event_bus.publish(TagRemoved.from_model(tag, **extra))


async def publish_share_event(event_name: str, share) -> None:
    cls = _share_event_map.get(event_name)
    if cls:
        await event_bus.publish(cls.from_model(share))
