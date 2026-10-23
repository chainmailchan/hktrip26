"""Rebuild fonts/noto-sans-hk-700.woff2 with only the characters in data/greetings.json.

Run after greetings change. Characters missing from the subset still show,
in the phone's own Chinese font, so this is about looks, not breakage.

  npm pack @expo-google-fonts/noto-sans-hk   # source TTF (OFL), not committed
  tar -xzf expo-google-fonts-noto-sans-hk-*.tgz
  pip install fonttools brotli
  python3 tools/subset-noto.py package/700Bold/NotoSansHK_700Bold.ttf
"""
import json, sys
from pathlib import Path
from fontTools import subset

root = Path(__file__).resolve().parent.parent
text = (root / 'data' / 'greetings.json').read_text(encoding='utf-8')
chars = sorted({c for c in text if ord(c) > 0x2E7F} | set('，！？'))

opts = subset.Options()
opts.flavor = 'woff2'
opts.layout_features = ['*']
opts.name_IDs = ['*']  # keep the OFL copyright and licence records
font = subset.load_font(sys.argv[1], opts)
s = subset.Subsetter(opts)
s.populate(text=''.join(chars))
s.subset(font)
out = root / 'fonts' / 'noto-sans-hk-700.woff2'
subset.save_font(font, str(out), opts)
print(f'{len(chars)} characters -> {out} ({out.stat().st_size} bytes)')
