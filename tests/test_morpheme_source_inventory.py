import importlib.util
from pathlib import Path
import unittest

path=Path(__file__).resolve().parents[1]/'scripts/content/inventory-english-morphemes.py'
spec=importlib.util.spec_from_file_location('morpheme_source_inventory',path)
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class MorphemeSourceInventoryTest(unittest.TestCase):
    def setUp(self):
        self.row={'word':'ab-','lang_code':'en','pos':'prefix','senses':[{'glosses':['away from'],'tags':['morpheme']}]}
    def test_readable_prefix_keeps_source_identity(self):
        row=module.extract(self.row,42)
        self.assertEqual(row['form'],'ab-')
        self.assertEqual(row['provenance']['sourceLine'],42)
        self.assertEqual(row['provenance']['license'],'CC-BY-SA-4.0')
    def test_reconstructed_and_foreign_labels_are_not_display_forms(self):
        for form in ['*h₂eng-','/æd/','ἀντί']:
            with self.subTest(form=form):self.assertIsNone(module.extract({**self.row,'word':form},1))
    def test_foreign_language_and_ordinary_words_are_not_affix_records(self):
        self.assertIsNone(module.extract({**self.row,'lang_code':'la'},1))
        self.assertIsNone(module.extract({**self.row,'pos':'noun'},1))
    def test_hierarchical_glosses_are_preserved_without_losing_child_meanings(self):
        self.row['senses']=[{'glosses':['Forms nouns denoting:','a person practising a skill.']}]
        self.assertEqual(module.extract(self.row,1)['senses'][0]['glosses'],['Forms nouns denoting:','a person practising a skill.'])

if __name__=='__main__':unittest.main()
