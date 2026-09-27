import sys
from pathlib import Path

api_root = str(Path(__file__).resolve().parent.parent.parent)
if api_root not in sys.path:
    sys.path.insert(0, api_root)

from bisveda.taxonomy.validator import TaxonomyValidator, TaxonomyInvariantError

def test_taxonomy_invariants_pass():
    validator = TaxonomyValidator()
    report = validator.validate(raise_on_error=True)
    assert report.is_valid is True
    assert report.total_groups == 5
    assert report.total_must_contain_standards > 0
    assert report.verified_standards_count == report.total_must_contain_standards
    assert len(report.errors) == 0
    print(f"Taxonomy invariants passed! Checked {report.total_groups} groups and {report.verified_standards_count} standards.")

def test_taxonomy_fails_on_missing_standard(tmp_path=None):
    import tempfile, json, yaml
    with tempfile.TemporaryDirectory() as tmpdir:
        tax_path = Path(tmpdir) / "groups.yaml"
        std_path = Path(tmpdir) / "standards.json"
        
        tax_data = {
            "groups": [
                {
                    "id": "test_grp",
                    "name": "Test Group",
                    "committees": ["CED 01"],
                    "must_contain": ["IS 99999"]
                }
            ]
        }
        with open(tax_path, "w", encoding="utf-8") as f:
            yaml.safe_dump(tax_data, f)
            
        std_data = [{"standard_number": "IS 1234"}]
        with open(std_path, "w", encoding="utf-8") as f:
            json.dump(std_data, f)
            
        val = TaxonomyValidator(taxonomy_file=tax_path, standards_file=std_path)
        report = val.validate(raise_on_error=False)
        assert report.is_valid is False
        assert "IS 99999" in report.missing_standards["test_grp"]
        
        try:
            val.validate(raise_on_error=True)
            assert False, "Expected TaxonomyInvariantError was not raised"
        except TaxonomyInvariantError:
            pass

if __name__ == "__main__":
    test_taxonomy_invariants_pass()
    test_taxonomy_fails_on_missing_standard()
    print("All taxonomy invariant tests passed!")
