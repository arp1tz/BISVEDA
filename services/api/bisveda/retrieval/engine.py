from pathlib import Path
from typing import Optional

from bisveda.retrieval.fts_engine import FTSRetrievalEngine


class RetrievalEngine(FTSRetrievalEngine):
    """
    In-memory Hybrid Retrieval Engine for BIS Standards.
    Inherits SQLite FTS5 full-text indexing with BM25 ranking,
    exact IS number regex matching, technical clause chunk retrieval,
    and Reciprocal Rank Fusion (RRF, k=60).
    """

    def __init__(self, seed_file: Optional[Path] = None, disambig_file: Optional[Path] = None):
        super().__init__(seed_file=seed_file, disambig_file=disambig_file)
