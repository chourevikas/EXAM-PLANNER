"""Pure helpers of the hybrid similar-question search: exact subject matching and code-answer detection."""
import pytest

from app.services.vector.similarity_retrieval_service import is_informative_answer
from app.core.subjects import canonical_subject, normalize_subject, same_subject


@pytest.mark.parametrize("a, b", [
    ("Indian Polity & Governance", "Indian Polity and Governance"),  # "&" = "and"
    ("  Modern   History ", "modern history"),  # case and spacing
    ("History / CA", "History/CA"),  # spacing around "/"
    ("Science&Tech", "Science & Tech"),
])
def test_same_subject(a, b):
    assert same_subject(a, b)


@pytest.mark.parametrize("a, b", [
    # Exact names only: branches and synonyms are different subjects
    ("History", "Modern History"),
    ("History", "Medieval History"),
    ("History", "History & Culture"),
    ("History", "History / CA"),
    ("Polity", "Indian Polity & Governance"),
    ("Science & Tech", "Science & Technology"),
    ("Ecology & Environment", "Environment & Ecology"),
    ("Economy / Environment", "Environment"),
    ("Political Science", "Science"),
    (None, None),
    ("", "Polity"),
])
def test_different_subject(a, b):
    assert not same_subject(a, b)


def test_normalize_subject():
    assert normalize_subject("  Indian  Polity &  Governance ") == "indian polity and governance"
    assert normalize_subject("Economy/Environment") == "economy / environment"
    assert canonical_subject("Modern History") == "modern history"
    assert canonical_subject(None) is None
    assert canonical_subject("   ") is None


@pytest.mark.parametrize("answer", [
    "1 and 2 only", "1, 2 and 3", "Only two", "Neither 1 nor 2", "Both 1 and 2", "None", "1, 3, 2",
    "Statement-I is correct but Statement-II is incorrect", "A-1, B-2, C-3, D-4",
    "Both A and R are individually true and R is the correct explanation of A", "", None,
])
def test_code_answers_are_not_search_queries(answer):
    assert not is_informative_answer(answer)


@pytest.mark.parametrize("answer", ["Chandragupta Maurya", "Article 21", "Rust", "5th century B.C.", "Bihar"])
def test_real_answers_are_search_queries(answer):
    assert is_informative_answer(answer)
