# Revision engine

Canonical revisions address stable item IDs. `applyRevision` permits a bounded size or color patch, validates the complete result, records only a SHA-256 instruction hash and exact changed path, and throws on unknown IDs. Tests compare unchanged objects byte-for-byte. Legacy revision normalization is retained while endpoint migration is incomplete.
